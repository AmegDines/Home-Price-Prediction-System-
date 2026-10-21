"""
tests/test_predict.py — Integration tests for the FastAPI prediction server.

Run with:  pytest server/tests/test_predict.py -v
The tests use TestClient so no running server is needed.
"""

import os
import sys

import pytest

# Allow importing main from server/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Import app lazily so we can mock artefact loading
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def client():
    """Create a FastAPI TestClient with a mocked model and encoder.

    This lets the test suite run without trained .pkl files on disk.
    """
    from fastapi.testclient import TestClient

    mock_model = MagicMock()
    # Predict 75 Lakhs for any input vector
    mock_model.predict.return_value = [75.0]

    mock_encoder = {
        "whitefield": 0.08,
        "hsr layout": 0.07,
        "indiranagar": 0.05,
        "other": 0.01,
    }

    mock_metrics = {
        "model": "XGBRegressor",
        "r2": 0.89,
        "mae": 12.4,
        "rmse": 18.7,
        "dataset_size": 12000,
    }

    with patch("main._state", {
        "model": mock_model,
        "location_encoder": mock_encoder,
        "metrics": mock_metrics,
        "total_predictions": 0,
        "total_errors": 0,
        "total_latency_ms": 0.0,
    }):
        # Patch lifespan so TestClient does not try to load real files
        with patch("main._load_artefacts", return_value=None):
            import main as server_module
            # Override lifespan to a no-op so TestClient skips it
            from contextlib import asynccontextmanager
            @asynccontextmanager
            async def noop_lifespan(app):
                yield
            server_module.app.router.lifespan_context = noop_lifespan
            yield TestClient(server_module.app, raise_server_exceptions=True)


# ---------------------------------------------------------------------------
# Test 1: Valid prediction returns a positive price
# ---------------------------------------------------------------------------


def test_valid_prediction_returns_positive_price(client) -> None:
    """A well-formed request should return a positive predicted_price."""
    response = client.post(
        "/api/predict",
        json={
            "location": "whitefield",
            "sqft": 1200.0,
            "bhk": 2,
            "bath": 2,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert "predicted_price" in body
    assert body["predicted_price"] > 0
    assert body["currency"] == "Lakhs"
    assert len(body["confidence_range"]) == 2
    low, high = body["confidence_range"]
    assert low < body["predicted_price"] < high


# ---------------------------------------------------------------------------
# Test 2: Negative sqft returns HTTP 422
# ---------------------------------------------------------------------------


def test_negative_sqft_returns_422(client) -> None:
    """Negative sqft must be rejected with a 422 Unprocessable Entity."""
    response = client.post(
        "/api/predict",
        json={
            "location": "whitefield",
            "sqft": -500.0,
            "bhk": 2,
            "bath": 2,
        },
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Test 3: Zero sqft returns HTTP 422
# ---------------------------------------------------------------------------


def test_zero_sqft_returns_422(client) -> None:
    """Zero sqft must be rejected with a 422 Unprocessable Entity."""
    response = client.post(
        "/api/predict",
        json={
            "location": "whitefield",
            "sqft": 0,
            "bhk": 2,
            "bath": 2,
        },
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Test 4: Unknown location is gracefully handled (maps to 'other')
# ---------------------------------------------------------------------------


def test_unknown_location_maps_to_other(client) -> None:
    """An unknown location should NOT raise 422 — it falls back to 'other' bucket."""
    response = client.post(
        "/api/predict",
        json={
            "location": "atlantis_nagar_super_unknown_99",
            "sqft": 1000.0,
            "bhk": 2,
            "bath": 2,
        },
    )
    # Should succeed (map to 'other')
    assert response.status_code == 200
    assert response.json()["predicted_price"] > 0


# ---------------------------------------------------------------------------
# Test 5: Empty location string returns HTTP 422
# ---------------------------------------------------------------------------


def test_empty_location_returns_422(client) -> None:
    """An empty location string must be rejected with 422."""
    response = client.post(
        "/api/predict",
        json={
            "location": "   ",
            "sqft": 1000.0,
            "bhk": 2,
            "bath": 2,
        },
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Test 6: /api/health returns correct model metadata
# ---------------------------------------------------------------------------


def test_health_returns_model_metadata(client) -> None:
    """GET /api/health should return status, model_version, dataset_size, r2_score."""
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "healthy"
    assert body["model_version"] == "XGBRegressor"
    assert body["dataset_size"] == 12000
    assert body["r2_score"] == pytest.approx(0.89)


# ---------------------------------------------------------------------------
# Test 7: /api/locations returns a list of strings
# ---------------------------------------------------------------------------


def test_locations_returns_sorted_list(client) -> None:
    """GET /api/locations should return a sorted list of location strings."""
    response = client.get("/api/locations")
    assert response.status_code == 200
    body = response.json()
    assert "locations" in body
    locs = body["locations"]
    assert isinstance(locs, list)
    assert all(isinstance(l, str) for l in locs)
    # 'other' should NOT appear in the user-facing list
    assert "other" not in locs
    # Should be sorted
    assert locs == sorted(locs)


# ---------------------------------------------------------------------------
# Test 8: /api/metrics returns runtime counters
# ---------------------------------------------------------------------------


def test_metrics_endpoint(client) -> None:
    """GET /api/metrics should return prediction counters."""
    response = client.get("/api/metrics")
    assert response.status_code == 200
    body = response.json()
    assert "total_predictions" in body
    assert "avg_response_ms" in body
    assert "errors" in body
