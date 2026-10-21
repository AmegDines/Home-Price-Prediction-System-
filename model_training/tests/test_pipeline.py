"""
tests/test_pipeline.py — Unit tests for the ML data pipeline.

Run with:  pytest model_training/tests/test_pipeline.py -v
"""

import os
import sys

import numpy as np
import pandas as pd
import pytest

# Allow importing from model_training/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import pipeline as pl


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def raw_df() -> pd.DataFrame:
    """Load and return the raw Bengaluru CSV from model_training/."""
    csv_path = os.path.join(
        os.path.dirname(__file__), "..", "Bengaluru_House_Data.csv"
    )
    if not os.path.exists(csv_path):
        pytest.skip("Bengaluru_House_Data.csv not found — skipping pipeline tests.")
    return pd.read_csv(csv_path)


@pytest.fixture(scope="module")
def cleaned_df() -> pd.DataFrame:
    """Return the fully cleaned dataframe produced by the pipeline."""
    df_raw = pl.load_and_merge_csvs()
    return pl.clean(df_raw)


@pytest.fixture(scope="module")
def encoded_df(cleaned_df: pd.DataFrame):
    """Return encoded dataframe and encoder dict."""
    df, encoder = pl.encode_locations(cleaned_df)
    return df, encoder


# ---------------------------------------------------------------------------
# Test 1: No nulls in required columns after cleaning
# ---------------------------------------------------------------------------


def test_no_nulls_in_required_columns(cleaned_df: pd.DataFrame) -> None:
    """Cleaned dataframe must have zero nulls in price, sqft, bhk, bath, location."""
    required = ["price", "sqft", "bhk", "bath", "location"]
    for col in required:
        null_count = cleaned_df[col].isnull().sum()
        assert null_count == 0, (
            f"Column '{col}' has {null_count} null values after cleaning."
        )


# ---------------------------------------------------------------------------
# Test 2: No outliers remain after cleaning
# ---------------------------------------------------------------------------


def test_no_sqft_per_bhk_outliers(cleaned_df: pd.DataFrame) -> None:
    """No row should have sqft/BHK < 300 after cleaning."""
    violations = cleaned_df[cleaned_df["sqft"] / cleaned_df["bhk"] < 300]
    assert len(violations) == 0, (
        f"{len(violations)} rows have sqft/BHK < 300 after cleaning."
    )


def test_no_bathroom_outliers(cleaned_df: pd.DataFrame) -> None:
    """No row should have bath > bhk + 2 after cleaning."""
    violations = cleaned_df[cleaned_df["bath"] > cleaned_df["bhk"] + 2]
    assert len(violations) == 0, (
        f"{len(violations)} rows have bath > bhk+2 after cleaning."
    )


def test_no_price_per_sqft_extreme_outliers(cleaned_df: pd.DataFrame) -> None:
    """No location should have price_per_sqft rows beyond mean ± 3σ."""
    df = cleaned_df.copy()
    df["price_per_sqft"] = df["price"] * 100_000 / df["sqft"]
    for loc, sub in df.groupby("location"):
        if len(sub) < 4:
            continue  # can't compute meaningful std with too few rows
        mu = sub["price_per_sqft"].mean()
        sigma = sub["price_per_sqft"].std()
        if sigma == 0 or np.isnan(sigma):
            continue
        beyond = sub[
            (sub["price_per_sqft"] < mu - 3 * sigma)
            | (sub["price_per_sqft"] > mu + 3 * sigma)
        ]
        assert len(beyond) == 0, (
            f"Location '{loc}' has {len(beyond)} price_per_sqft outliers beyond ±3σ."
        )


# ---------------------------------------------------------------------------
# Test 3: Model R² > 0.75 on held-out test set
# ---------------------------------------------------------------------------


def test_model_r2_above_threshold(encoded_df) -> None:
    """Best selected model must achieve R² > 0.75 on the 20% test set."""
    from sklearn.metrics import r2_score
    from sklearn.model_selection import train_test_split

    df, encoder = encoded_df
    X = df[["sqft", "bhk", "bath", "location_freq"]]
    y = df["price"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    _best_model, _best_name, _cv, X_te, y_te = pl.train_and_select(df)
    preds = _best_model.predict(X_te)
    r2 = r2_score(y_te, preds)

    assert r2 > 0.75, (
        f"Best model R² = {r2:.4f} is below the required threshold of 0.75."
    )


# ---------------------------------------------------------------------------
# Test 4: Encoder contains expected keys
# ---------------------------------------------------------------------------


def test_encoder_has_other_key(encoded_df) -> None:
    """Location encoder must always have an 'other' key as fallback."""
    _, encoder = encoded_df
    assert "other" in encoder, "Encoder is missing 'other' fallback key."


def test_encoder_top_n_locations(encoded_df) -> None:
    """Encoder should not exceed TOP_N_LOCATIONS + 1 ('other') entries."""
    _, encoder = encoded_df
    # +1 for 'other'
    assert len(encoder) <= pl.TOP_N_LOCATIONS + 1, (
        f"Encoder has {len(encoder)} entries, expected ≤ {pl.TOP_N_LOCATIONS + 1}."
    )
