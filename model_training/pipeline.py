"""
pipeline.py — Bengaluru Home Price ML Pipeline
================================================
Merges CSV datasets found in model_training/, cleans the rows,
cross-fits locality priors, evaluates a fixed holdout, and saves
the full-data model and serving artifacts to server/model/.
"""

import glob
import json
import logging
import os
import joblib
from datetime import datetime, timezone

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import ExtraTreesRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

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
MINIMUM_HOLDOUT_R2 = 0.75


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
# Step 3 — Location priors for API inference
# ---------------------------------------------------------------------------


def encode_locations(
    df: pd.DataFrame,
) -> tuple[pd.DataFrame, dict[str, dict[str, float]]]:
    """Return rows and a compact map of locality median price priors."""
    with_pps = df.assign(price_per_sqft=df["price"] * 100_000 / df["sqft"])
    grouped = with_pps.groupby("location").agg(
        median_price=("price", "median"),
        median_price_per_sqft=("price_per_sqft", "median"),
    )
    top_locations = df["location"].value_counts().nlargest(TOP_N_LOCATIONS).index
    encoder = {
        str(loc): {
            "median_price": float(grouped.loc[loc, "median_price"]),
            "median_price_per_sqft": float(grouped.loc[loc, "median_price_per_sqft"]),
        }
        for loc in top_locations
    }
    encoder["other"] = {
        "median_price": float(df["price"].median()),
        "median_price_per_sqft": float(with_pps["price_per_sqft"].median()),
    }
    return df.copy(), encoder


def _location_priors(df: pd.DataFrame) -> dict[str, dict[str, float]]:
    """Calculate locality medians using only the supplied training rows."""
    with_pps = df.assign(price_per_sqft=df["price"] * 100_000 / df["sqft"])
    grouped = with_pps.groupby("location").agg(
        median_price=("price", "median"),
        median_price_per_sqft=("price_per_sqft", "median"),
    )
    priors = {
        str(loc): {
            "median_price": float(row["median_price"]),
            "median_price_per_sqft": float(row["median_price_per_sqft"]),
        }
        for loc, row in grouped.iterrows()
    }
    priors["other"] = {
        "median_price": float(df["price"].median()),
        "median_price_per_sqft": float(with_pps["price_per_sqft"].median()),
    }
    return priors


def make_features(rows: pd.DataFrame, priors: dict) -> pd.DataFrame:
    """Construct the shared training and serving feature frame."""
    fallback = priors["other"]
    features = rows[["location", "sqft", "bhk", "bath"]].copy()
    stats = [priors.get(str(loc), fallback) for loc in features["location"]]
    features["median_location_price"] = [s["median_price"] for s in stats]
    features["median_location_price_per_sqft"] = [
        s["median_price_per_sqft"] for s in stats
    ]
    features["sqft_per_bhk"] = features["sqft"] / features["bhk"]
    return features


def _new_model() -> Pipeline:
    numeric = [
        "sqft", "bhk", "bath", "median_location_price",
        "median_location_price_per_sqft", "sqft_per_bhk",
    ]
    preprocess = ColumnTransformer([
        ("location", OneHotEncoder(handle_unknown="ignore", min_frequency=5), ["location"]),
        ("numeric", "passthrough", numeric),
    ])
    return Pipeline([
        ("features", preprocess),
        ("regressor", ExtraTreesRegressor(
            n_estimators=100, min_samples_leaf=2, max_features=1.0,
            n_jobs=-1, random_state=42,
        )),
    ])


# ---------------------------------------------------------------------------
# Step 4 — Train and evaluate the selected model
# ---------------------------------------------------------------------------

def train_and_select(
    df: pd.DataFrame,
) -> tuple[object, str, dict, pd.DataFrame, pd.Series]:
    """Fit ExtraTrees with cross-fitted locality priors; keep a fixed holdout."""
    train, test = train_test_split(df, test_size=0.2, random_state=42)
    y_train, y_test = train["price"], test["price"]

    # Cross-fit target-derived locality priors so a row never contributes to
    # the locality statistics used to predict itself during model fitting.
    train_features = pd.DataFrame(index=train.index)
    folds = KFold(n_splits=5, shuffle=True, random_state=42)
    for fit_idx, fold_idx in folds.split(train):
        fit_rows, fold_rows = train.iloc[fit_idx], train.iloc[fold_idx]
        fold_features = make_features(fold_rows, _location_priors(fit_rows))
        train_features.loc[fold_rows.index, fold_features.columns] = fold_features

    test_features = make_features(test, _location_priors(train))
    model = _new_model()
    log.info("Training ExtraTreesRegressor with cross-fitted locality features …")
    model.fit(train_features, y_train)
    predictions = model.predict(test_features)
    result = {
        "test_r2": float(r2_score(y_test, predictions)),
        "test_mae": float(mean_absolute_error(y_test, predictions)),
        "test_rmse": float(np.sqrt(mean_squared_error(y_test, predictions))),
    }
    log.info(
        "ExtraTreesRegressor → held-out R²: %.4f | MAE: %.2f | RMSE: %.2f",
        result["test_r2"], result["test_mae"], result["test_rmse"],
    )

    # After measuring the untouched holdout, refit the deployable model on all
    # available rows. Cross-fitting still keeps each row's priors independent.
    full_features = pd.DataFrame(index=df.index)
    for fit_idx, fold_idx in folds.split(df):
        fit_rows, fold_rows = df.iloc[fit_idx], df.iloc[fold_idx]
        fold_features = make_features(fold_rows, _location_priors(fit_rows))
        full_features.loc[fold_rows.index, fold_features.columns] = fold_features
    final_model = _new_model()
    final_model.fit(full_features, df["price"])
    return final_model, "ExtraTreesRegressor", {"ExtraTreesRegressor": result}, test_features, y_test


# ---------------------------------------------------------------------------
# Step 5 — Persist artefacts
# ---------------------------------------------------------------------------


def save_artefacts(
    model: object,
    model_name: str,
    location_encoder: dict[str, dict[str, float]],
    cv_results: dict,
    X_test: pd.DataFrame,
    y_test: pd.Series,
    dataset_size: int,
) -> None:
    """Serialise model, encoder, and metrics to disk."""
    model_path = os.path.join(SERVER_MODEL_DIR, "home_price_model.pkl")
    encoder_path = os.path.join(SERVER_MODEL_DIR, "location_encoder.pkl")

    joblib.dump(model, model_path, compress=3)
    log.info("Model saved → %s", model_path)

    joblib.dump(location_encoder, encoder_path, compress=3)
    log.info("Encoder saved → %s", encoder_path)

    # Persist the untouched holdout results computed before the full-data refit.
    holdout = cv_results[model_name]
    metrics = {
        "model": model_name,
        "r2": round(holdout["test_r2"], 6),
        "mae": round(holdout["test_mae"], 4),
        "rmse": round(holdout["test_rmse"], 4),
        "trained_on": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "dataset_size": dataset_size,
        "holdout": holdout,
    }
    with open(METRICS_JSON, "w") as fh:
        json.dump(metrics, fh, indent=2)
    # Package the same metrics beside the model so the API image is self-contained.
    with open(os.path.join(SERVER_MODEL_DIR, "metrics.json"), "w") as fh:
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

    holdout_r2 = cv_results[best_name]["test_r2"]
    if holdout_r2 < MINIMUM_HOLDOUT_R2:
        raise RuntimeError(
            f"Holdout R² {holdout_r2:.4f} is below the required "
            f"{MINIMUM_HOLDOUT_R2:.2f}; refusing to publish model artifacts."
        )

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
