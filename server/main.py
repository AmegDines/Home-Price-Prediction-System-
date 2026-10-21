"""
main.py — Bengaluru Home Price Prediction FastAPI Server
=========================================================
Loads a trained scikit-learn / XGBoost model and a frequency-encoded
location map from server/model/ at startup.  All prediction logic lives
here; there is zero fallback maths or embedded coefficients.
"""

import json
import logging
import os
import pickle
import time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model")
MODEL_PATH = os.path.join(MODEL_DIR, "home_price_model.pkl")
ENCODER_PATH = os.path.join(MODEL_DIR, "location_encoder.pkl")
METRICS_PATH = os.path.join(BASE_DIR, "..", "model_training", "metrics.json")

# ---------------------------------------------------------------------------
# Application state (populated at startup)
# ---------------------------------------------------------------------------
_state: dict[str, Any] = {
    "model": None,
    # location_encoder: dict[str, float]  name → frequency score
    "location_encoder": None,
    "metrics": {},
    "total_predictions": 0,
    "total_errors": 0,
    "total_latency_ms": 0.0,
}


# ---------------------------------------------------------------------------
# Startup / shutdown lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model artefacts once at startup; release on shutdown."""
    _load_artefacts()
    yield
    log.info("Server shutting down.")


def _load_artefacts() -> None:
    """Deserialise model and encoder from server/model/.

    Raises RuntimeError if either file is missing.
    """
    if not os.path.exists(MODEL_PATH):
        raise RuntimeError(
            f"Model not found at {MODEL_PATH}. "
            "Run model_training/train.py first."
        )
    if not os.path.exists(ENCODER_PATH):
        raise RuntimeError(
            f"Encoder not found at {ENCODER_PATH}. "
            "Run model_training/train.py first."
        )

    with open(MODEL_PATH, "rb") as fh:
        _state["model"] = pickle.load(fh)
    log.info("Model loaded from %s", MODEL_PATH)

    with open(ENCODER_PATH, "rb") as fh:
        _state["location_encoder"] = pickle.load(fh)
    log.info(
        "Location encoder loaded (%d locations)", len(_state["location_encoder"])
    )

    if os.path.exists(METRICS_PATH):
        with open(METRICS_PATH) as fh:
            _state["metrics"] = json.load(fh)
        log.info("Metrics loaded from %s", METRICS_PATH)


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Bengaluru Home Price Prediction API",
    description=(
        "Predict Bengaluru residential property prices using a trained ML model. "
        "No client-side maths — all predictions are server-side."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request logging middleware
# ---------------------------------------------------------------------------


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log every inbound request with method, path, and latency."""
    t0 = time.perf_counter()
    response = await call_next(request)
    latency_ms = (time.perf_counter() - t0) * 1000
    log.info(
        "%s %s → %d  (%.1f ms)",
        request.method,
        request.url.path,
        response.status_code,
        latency_ms,
    )
    return response


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class PredictRequest(BaseModel):
    """Input schema for /api/predict."""

    location: str = Field(..., description="Bengaluru neighbourhood name")
    sqft: float = Field(..., gt=0, description="Total built-up area in sq ft")
    bhk: int = Field(..., ge=1, le=20, description="Number of bedrooms")
    bath: int = Field(..., ge=1, le=20, description="Number of bathrooms")

    @field_validator("location")
    @classmethod
    def location_not_empty(cls, v: str) -> str:
        """Reject blank location strings."""
        stripped = v.strip()
        if not stripped:
            raise ValueError("location must not be empty")
        return stripped

    @field_validator("sqft")
    @classmethod
    def sqft_positive(cls, v: float) -> float:
        """Reject non-positive sqft values."""
        if v <= 0:
            raise ValueError("sqft must be greater than 0")
        return v


class PredictResponse(BaseModel):
    """Output schema for /api/predict."""

    predicted_price: float
    currency: str = "Lakhs"
    confidence_range: list[float]


class HealthResponse(BaseModel):
    """Output schema for /api/health."""

    status: str
    model_version: str
    dataset_size: int
    r2_score: float


class MetricsResponse(BaseModel):
    """Output schema for /api/metrics."""

    total_predictions: int
    avg_response_ms: float
    errors: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/api/health", response_model=HealthResponse, tags=["Monitoring"])
def health() -> HealthResponse:
    """Return server health and model metadata.

    Used as the Kubernetes readiness probe target.
    """
    m = _state["metrics"]
    return HealthResponse(
        status="healthy" if _state["model"] is not None else "model_not_loaded",
        model_version=m.get("model", "unknown"),
        dataset_size=int(m.get("dataset_size", 0)),
        r2_score=float(m.get("r2", 0.0)),
    )


@app.get("/api/locations", tags=["Data"])
def get_locations() -> dict[str, list[str]]:
    """Return sorted list of valid location names from the trained encoder."""
    encoder: dict[str, float] | None = _state["location_encoder"]
    if encoder is None:
        raise HTTPException(status_code=503, detail="Model artefacts not loaded.")

    # Exclude 'other' from the user-facing list (it is used as an internal fallback)
    locations = sorted(loc for loc in encoder.keys() if loc != "other")
    return {"locations": locations}


@app.post("/api/predict", response_model=PredictResponse, tags=["Prediction"])
def predict(req: PredictRequest, request: Request) -> PredictResponse:
    """Predict the Bengaluru home price in Lakhs.

    Input validation is handled by Pydantic.  If location is unknown it is
    mapped to the 'other' bucket — this is intentional and not an error.
    Returns a ±8 % confidence band around the point estimate.
    """
    t0 = time.perf_counter()
    model = _state["model"]
    encoder: dict[str, float] | None = _state["location_encoder"]

    if model is None or encoder is None:
        _state["total_errors"] += 1
        raise HTTPException(status_code=503, detail="Model artefacts not loaded.")

    location_key = req.location.strip().lower()

    # Validate that the location is known or falls back to 'other'
    if location_key not in encoder and "other" not in encoder:
        _state["total_errors"] += 1
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unknown location '{req.location}'. "
                "Call GET /api/locations for valid options."
            ),
        )

    loc_freq = encoder.get(location_key, encoder.get("other", 0.0))

    features = np.array([[req.sqft, req.bhk, req.bath, loc_freq]])

    try:
        raw_pred = float(model.predict(features)[0])
    except Exception as exc:
        _state["total_errors"] += 1
        log.error("Model inference failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Model inference error: {exc}")

    # Clamp to a floor of 1 Lakh (model can't legitimately go below zero)
    predicted = max(round(raw_pred, 2), 1.0)
    confidence_range = [round(predicted * 0.92, 2), round(predicted * 1.08, 2)]

    latency_ms = (time.perf_counter() - t0) * 1000
    _state["total_predictions"] += 1
    _state["total_latency_ms"] += latency_ms

    log.info(
        "PREDICT | location=%s sqft=%.0f bhk=%d bath=%d → %.2f L  (%.1f ms)",
        req.location,
        req.sqft,
        req.bhk,
        req.bath,
        predicted,
        latency_ms,
    )

    return PredictResponse(
        predicted_price=predicted,
        currency="Lakhs",
        confidence_range=confidence_range,
    )


@app.get("/api/metrics", response_model=MetricsResponse, tags=["Monitoring"])
def api_metrics() -> MetricsResponse:
    """Return cumulative runtime metrics since server start."""
    total = _state["total_predictions"]
    avg_ms = (
        _state["total_latency_ms"] / total if total > 0 else 0.0
    )
    return MetricsResponse(
        total_predictions=total,
        avg_response_ms=round(avg_ms, 2),
        errors=_state["total_errors"],
    )


@app.get("/", tags=["Root"])
def root() -> dict[str, str]:
    """Root health ping."""
    return {
        "service": "Bengaluru Home Price Prediction API",
        "version": "2.0.0",
        "docs": "/docs",
    }
