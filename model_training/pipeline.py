"""
pipeline.py — Bengaluru Home Price ML Pipeline
================================================
Merges all Kaggle CSV datasets found in model_training/,
cleans and validates data, trains four models with 5-fold CV,
picks the best by R² and serialises artefacts to server/model/.
"""

import glob
import json
import logging
import os
import pickle
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_score, train_test_split
from xgboost import XGBRegressor

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")
SERVER_MODEL_DIR = os.path.join(SCRIPT_DIR, "..", "server", "model")
CLEANED_CSV = os.path.join(DATA_DIR, "cleaned.csv")
METRICS_JSON = os.path.join(SCRIPT_DIR, "metrics.json")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(SERVER_MODEL_DIR, exist_ok=True)

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Column name mappings — covers multiple Kaggle schemas
# ---------------------------------------------------------------------------
COLUMN_ALIASES: dict[str, list[str]] = {
    "location": [
        "location",
        "area",
        "locality",
        "neighbourhood",
        "place",
        "address",
    ],
    "sqft": [
        "total_sqft",
        "sqft",
        "area_sqft",
        "carpet_area",
        "built_up_area",
        "super_built_up_area",
        "size_sqft",
    ],
    "bhk": [
        "bhk",
        "bedrooms",
        "bedroom",
        "beds",
        "no_of_bedrooms",
        "bhk_no",
        "size",
    ],
    "bath": [
        "bath",
        "bathrooms",
        "bathroom",
        "baths",
        "no_of_bathrooms",
        "washrooms",
    ],
    "price": [
        "price",
        "price_in_lakhs",
        "cost",
        "total_price",
        "sale_price",
    ],
}

TOP_N_LOCATIONS = 100


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _resolve_column(df: pd.DataFrame, canonical: str) -> str | None:
    """Return the first column in *df* that matches an alias for *canonical*."""
    aliases = [a.lower() for a in COLUMN_ALIASES[canonical]]
    for col in df.columns:
        if col.strip().lower() in aliases:
            return col
    return None


def _convert_sqft(val: object) -> float | None:
    """Convert a sqft cell to a float.

    Handles ranges ('1000 - 1200'), plain numbers, and non-numeric junk.
    """
    s = str(val).strip()
    parts = s.split("-")
    if len(parts) == 2:
        try:
            return (float(parts[0]) + float(parts[1])) / 2.0
        except ValueError:
            return None
    try:
        return float(s)
    except ValueError:
        return None


def _extract_bhk_from_size(val: object) -> float | None:
    """Extract integer BHK from strings like '2 BHK', '3 Bedroom', etc."""
    import re

    m = re.search(r"(\d+)", str(val))
    return float(m.group(1)) if m else None


# ---------------------------------------------------------------------------
# Step 1 — Ingest & merge
# ---------------------------------------------------------------------------


def load_and_merge_csvs() -> pd.DataFrame:
    """Find every *.csv in model_training/, standardise columns, and merge.

    Returns a dataframe with exactly these columns (all strings / numerics):
        location, sqft, bhk, bath, price
    """
    csv_files = glob.glob(os.path.join(SCRIPT_DIR, "*.csv"))
    if not csv_files:
        raise FileNotFoundError(
            f"No CSV files found in {SCRIPT_DIR}. "
            "Place at least one Kaggle dataset there."
        )

    frames: list[pd.DataFrame] = []
    for path in csv_files:
        log.info("Reading %s …", os.path.basename(path))
        raw = pd.read_csv(path, low_memory=False)
        raw.columns = [c.strip().lower() for c in raw.columns]

        # Map columns to canonical names
        renamed: dict[str, str] = {}
        for canonical in COLUMN_ALIASES:
            src = _resolve_column(raw, canonical)
            if src:
                renamed[src] = canonical

        if not renamed:
            log.warning("Skipping %s — no recognisable columns.", path)
            continue

        df = raw.rename(columns=renamed)[list(renamed.values())].copy()

        # Ensure all five canonical columns exist
        for col in ["location", "sqft", "bhk", "bath", "price"]:
            if col not in df.columns:
                df[col] = np.nan

        frames.append(df[["location", "sqft", "bhk", "bath", "price"]])
        log.info("  → %d rows loaded from %s", len(df), os.path.basename(path))

    if not frames:
        raise ValueError("No usable CSV files with recognisable columns found.")

    merged = pd.concat(frames, ignore_index=True)
    log.info("Total rows after merge: %d", len(merged))
    return merged


# ---------------------------------------------------------------------------
# Step 2 — Clean
# ---------------------------------------------------------------------------


def clean(df: pd.DataFrame) -> pd.DataFrame:
    """Apply all cleaning rules and return a tidy dataframe."""
    original = len(df)

    # --- Normalise sqft ---
    df["sqft"] = df["sqft"].apply(_convert_sqft).astype("float64")

    # --- Parse BHK from size strings (e.g. '2 BHK') ---
    def _coerce_bhk(val: object) -> float | None:
        try:
            return float(val)
        except (TypeError, ValueError):
            return _extract_bhk_from_size(val)

    df["bhk"] = df["bhk"].apply(_coerce_bhk)
    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    df["bath"] = pd.to_numeric(df["bath"], errors="coerce")

    # --- Drop rows where price or sqft is null ---
    df = df.dropna(subset=["price", "sqft"])
    log.info("After dropping null price/sqft: %d rows", len(df))

    # --- Median-impute bath and bhk ---
    df["bath"] = df["bath"].fillna(df["bath"].median())
    df["bhk"] = df["bhk"].fillna(df["bhk"].median())

    # Convert to int
    df["bath"] = df["bath"].round().astype(int)
    df["bhk"] = df["bhk"].round().astype(int)

    # --- Normalise location ---
    df["location"] = (
        df["location"]
        .fillna("other")
        .astype(str)
        .str.strip()
        .str.lower()
    )

    # --- Outlier: sqft per BHK < 300 ---
    mask_sqft = df["sqft"] / df["bhk"] < 300
    df = df[~mask_sqft]
    log.info("After sqft/BHK < 300 filter: %d rows", len(df))

    # --- Price per sqft outliers: > 3 std dev from location mean ---
    df["price_per_sqft"] = df["price"] * 100_000 / df["sqft"]
    clean_frames: list[pd.DataFrame] = []
    for loc, sub in df.groupby("location"):
        mu = sub["price_per_sqft"].mean()
        sigma = sub["price_per_sqft"].std()
        if pd.isna(sigma) or sigma == 0:
            clean_frames.append(sub)
        else:
            clean_frames.append(
                sub[
                    (sub["price_per_sqft"] >= mu - 3 * sigma)
                    & (sub["price_per_sqft"] <= mu + 3 * sigma)
                ]
            )
    df = pd.concat(clean_frames, ignore_index=True)
    log.info("After price_per_sqft ±3σ filter: %d rows", len(df))

    # --- Outlier: bath > bhk + 2 ---
    df = df[df["bath"] <= df["bhk"] + 2]
    log.info("After bath > bhk+2 filter: %d rows", len(df))

    # Drop helper column
    df = df.drop(columns=["price_per_sqft"])

    log.info(
        "Cleaning done: %d rows removed, %d remaining.",
        original - len(df),
        len(df),
    )
    return df.reset_index(drop=True)


# ---------------------------------------------------------------------------
# Step 3 — Location frequency encoding (top 100, rest → 'other')
# ---------------------------------------------------------------------------


def encode_locations(
    df: pd.DataFrame,
) -> tuple[pd.DataFrame, dict[str, str]]:
    """Frequency-encode location into a single numeric column.

    Also returns a mapping {original_name → canonical_name} for the encoder.
    Top-N locations keep their name; the rest are collapsed to 'other'.
    The encoder dict maps each valid location to itself (or 'other').
    """
    counts = df["location"].value_counts()
    top_locations: list[str] = counts.nlargest(TOP_N_LOCATIONS).index.tolist()

    encoder: dict[str, str] = {loc: loc for loc in top_locations}
    # everything else maps to 'other'

    df["location_canonical"] = df["location"].apply(
        lambda x: x if x in encoder else "other"
    )

    # Build frequency map on canonical names
    freq = df["location_canonical"].value_counts(normalize=True).to_dict()
    df["location_freq"] = df["location_canonical"].map(freq)

    # Save encoder: canonical_name → frequency (used at inference time)
    location_encoder: dict[str, float] = {
        loc: freq.get(loc, 0.0) for loc in sorted(top_locations)
    }
    # Add 'other' sentinel
    location_encoder["other"] = freq.get("other", 0.0)

    return df, location_encoder


# ---------------------------------------------------------------------------
# Step 4 — Train & compare models
# ---------------------------------------------------------------------------


MODELS: dict = {
    "LinearRegression": LinearRegression(),
    "Ridge": Ridge(alpha=1.0),
    "GradientBoostingRegressor": GradientBoostingRegressor(
        n_estimators=200, learning_rate=0.1, max_depth=4, random_state=42
    ),
    "XGBRegressor": XGBRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=5,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        verbosity=0,
    ),
}


def train_and_select(
    df: pd.DataFrame,
) -> tuple[object, str, dict, pd.DataFrame, pd.Series]:
    """Train all MODELS with 5-fold CV, select the best by R², return it.

    Returns: (best_model, best_name, cv_results, X_test, y_test)
    """
    X = df[["sqft", "bhk", "bath", "location_freq"]]
    y = df["price"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    cv_results: dict[str, dict] = {}

    for name, model in MODELS.items():
        log.info("Training %s …", name)
        cv_scores = cross_val_score(
            model, X_train, y_train, cv=kf, scoring="r2", n_jobs=-1
        )
        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        r2 = r2_score(y_test, preds)
        mae = mean_absolute_error(y_test, preds)
        rmse = float(np.sqrt(mean_squared_error(y_test, preds)))

        cv_results[name] = {
            "cv_r2_mean": float(cv_scores.mean()),
            "cv_r2_std": float(cv_scores.std()),
            "test_r2": float(r2),
            "test_mae": float(mae),
            "test_rmse": float(rmse),
        }
        log.info(
            "  %s → CV R²: %.4f ± %.4f | Test R²: %.4f",
            name,
            cv_scores.mean(),
            cv_scores.std(),
            r2,
        )

    best_name = max(cv_results, key=lambda n: cv_results[n]["test_r2"])
    log.info("Best model: %s (Test R²=%.4f)", best_name, cv_results[best_name]["test_r2"])

    # Re-fit best model on full training set
    best_model = MODELS[best_name]
    best_model.fit(X_train, y_train)

    return best_model, best_name, cv_results, X_test, y_test


# ---------------------------------------------------------------------------
# Step 5 — Persist artefacts
# ---------------------------------------------------------------------------


def save_artefacts(
    model: object,
    model_name: str,
    location_encoder: dict[str, float],
    cv_results: dict,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    dataset_size: int,
) -> None:
    """Serialise model, encoder, and metrics to disk."""
    model_path = os.path.join(SERVER_MODEL_DIR, "home_price_model.pkl")
    encoder_path = os.path.join(SERVER_MODEL_DIR, "location_encoder.pkl")

    with open(model_path, "wb") as fh:
        pickle.dump(model, fh)
    log.info("Model saved → %s", model_path)

    with open(encoder_path, "wb") as fh:
        pickle.dump(location_encoder, fh)
    log.info("Encoder saved → %s", encoder_path)

    # Compute final test metrics
    preds = model.predict(X_test)
    metrics = {
        "model": model_name,
        "r2": round(r2_score(y_test, preds), 6),
        "mae": round(mean_absolute_error(y_test, preds), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(y_test, preds))), 4),
        "trained_on": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "dataset_size": dataset_size,
        "cv_results": cv_results,
    }
    with open(METRICS_JSON, "w") as fh:
        json.dump(metrics, fh, indent=2)
    log.info("Metrics saved → %s", METRICS_JSON)
    log.info(
        "Final → R²=%.4f  MAE=%.2f  RMSE=%.2f",
        metrics["r2"],
        metrics["mae"],
        metrics["rmse"],
    )


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def run_pipeline() -> None:
    """Execute the full data → model pipeline end-to-end."""
    log.info("=== Bengaluru Home Price Pipeline START ===")

    df_raw = load_and_merge_csvs()
    df_clean = clean(df_raw)

    # Save cleaned CSV
    df_clean.to_csv(CLEANED_CSV, index=False)
    log.info("Cleaned data saved → %s (%d rows)", CLEANED_CSV, len(df_clean))

    df_encoded, location_encoder = encode_locations(df_clean)

    best_model, best_name, cv_results, X_test, y_test = train_and_select(df_encoded)

    save_artefacts(
        model=best_model,
        model_name=best_name,
        location_encoder=location_encoder,
        cv_results=cv_results,
        X_test=X_test,
        y_test=y_test,
        dataset_size=len(df_encoded),
    )
    log.info("=== Pipeline DONE ===")


if __name__ == "__main__":
    run_pipeline()
