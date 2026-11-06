"""
main.py — Bengaluru Home Price Prediction FastAPI Server
=========================================================
Loads the trained scikit-learn pipeline and locality price priors from
server/model/ at startup. All prediction logic runs server-side.
"""

import json
import logging
import os
import sqlite3
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any

import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest
from fastapi.responses import Response

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger(__name__)
HTTP_REQUESTS = Counter(
    "home_price_http_requests_total",
    "HTTP requests handled by the prediction API",
    ["method", "path", "status_code"],
)
HTTP_REQUEST_DURATION = Histogram(
    "home_price_http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "path"],
)
PREDICTIONS = Counter(
    "home_price_predictions",
    "Prediction requests processed by the model",
    ["result"],
)
INFERENCE_LATENCY = Histogram(
    "home_price_inference_latency_seconds",
    "Time spent in the trained model prediction call",
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0),
)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.environ.get("MODEL_DIR", os.path.join(BASE_DIR, "model"))
LISTINGS_TABLE = os.environ.get("LISTINGS_TABLE", "").strip()
LISTINGS_DB_PATH = os.environ.get(
    "LISTINGS_DB_PATH", os.path.join(BASE_DIR, "data", "listings.sqlite3")
)
AWS_REGION = os.environ.get("AWS_REGION", "ap-south-1")
MODEL_PATH = os.path.join(MODEL_DIR, "home_price_model.pkl")
ENCODER_PATH = os.path.join(MODEL_DIR, "location_encoder.pkl")
METRICS_PATH = os.path.join(MODEL_DIR, "metrics.json")

# ---------------------------------------------------------------------------
# Application state (populated at startup)
# ---------------------------------------------------------------------------
_state: dict[str, Any] = {
    "model": None,
    # location_encoder: name → training-derived location price statistics
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
    _initialize_local_listing_store()
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

    _state["model"] = joblib.load(MODEL_PATH)
    log.info("Model loaded from %s", MODEL_PATH)

    _state["location_encoder"] = joblib.load(ENCODER_PATH)
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
    allow_origins=[
        origin.strip()
        for origin in os.environ.get("CORS_ALLOW_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
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
    route = request.url.path
    if route not in {
        "/api/health",
        "/api/locations",
        "/api/predict",
        "/api/metrics",
        "/api/listings",
        "/metrics",
    }:
        route = "/other"
    HTTP_REQUESTS.labels(request.method, route, str(response.status_code)).inc()
    HTTP_REQUEST_DURATION.labels(request.method, route).observe(latency_ms / 1000)
    log.info(
        "%s %s → %d  (%.1f ms)",
        request.method,
        request.url.path,
        response.status_code,
        latency_ms,
    )
    return response


@app.get("/metrics", include_in_schema=False)
def prometheus_metrics() -> Response:
    """Expose API telemetry for the private Prometheus container network."""
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


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


class ListingCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=90)
    location: str = Field(..., min_length=1, max_length=120)
    bhk: int = Field(..., ge=1, le=20)
    bath: int = Field(..., ge=1, le=20)
    total_sqft: float = Field(..., gt=0)
    balcony: int = Field(..., ge=0, le=20)
    asking_price_lakhs: float = Field(..., gt=0)
    seller_name: str = Field(..., min_length=1, max_length=120)
    seller_phone: str = Field(..., min_length=3, max_length=32)
    imageUrl: str | None = None

    @field_validator("title", "location", "seller_name", "seller_phone")
    @classmethod
    def trim_listing_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field must not be blank")
        return value


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


def _initialize_local_listing_store() -> None:
    if LISTINGS_TABLE:
        return
    os.makedirs(os.path.dirname(LISTINGS_DB_PATH), exist_ok=True)
    with sqlite3.connect(LISTINGS_DB_PATH) as db:
        db.execute("CREATE TABLE IF NOT EXISTS listings (id TEXT PRIMARY KEY, payload TEXT NOT NULL)")


def _dynamodb_table():
    import boto3

    return boto3.resource("dynamodb", region_name=AWS_REGION).Table(LISTINGS_TABLE)


def _save_listing(listing: dict[str, Any]) -> None:
    payload = json.dumps(listing, separators=(",", ":"))
    if LISTINGS_TABLE:
        _dynamodb_table().put_item(Item={"id": listing["id"], "payload": payload})
        return
    with sqlite3.connect(LISTINGS_DB_PATH) as db:
        db.execute("INSERT OR REPLACE INTO listings (id, payload) VALUES (?, ?)", (listing["id"], payload))


def _read_listings() -> list[dict[str, Any]]:
    if LISTINGS_TABLE:
        table = _dynamodb_table()
        rows: list[dict[str, Any]] = []
        response = table.scan(ProjectionExpression="#payload", ExpressionAttributeNames={"#payload": "payload"})
        rows.extend(response.get("Items", []))
        while response.get("LastEvaluatedKey"):
            response = table.scan(
                ProjectionExpression="#payload",
                ExpressionAttributeNames={"#payload": "payload"},
                ExclusiveStartKey=response["LastEvaluatedKey"],
            )
            rows.extend(response.get("Items", []))
        return [json.loads(row["payload"]) for row in rows]
    with sqlite3.connect(LISTINGS_DB_PATH) as db:
        rows = db.execute("SELECT payload FROM listings ORDER BY rowid DESC").fetchall()
    return [json.loads(row[0]) for row in rows]


@app.get("/api/listings", tags=["Listings"])
def list_listings() -> dict[str, list[dict[str, Any]]]:
    try:
        listings = _read_listings()
    except Exception as exc:
        log.exception("Could not read listings")
        raise HTTPException(status_code=503, detail="Listing storage is unavailable.") from exc
    listings.sort(key=lambda listing: listing.get("created_at", ""), reverse=True)
    return {"listings": listings}


@app.post("/api/listings", status_code=201, tags=["Listings"])
def create_listing(req: ListingCreateRequest, request: Request) -> dict[str, Any]:
    try:
        prediction = predict(
            PredictRequest(location=req.location, sqft=req.total_sqft, bhk=req.bhk, bath=req.bath),
            request,
        )
        listing = {
            **req.model_dump(),
            "id": str(uuid.uuid4()),
            "predicted_price_lakhs": prediction.predicted_price,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        _save_listing(listing)
    except HTTPException:
        raise
    except Exception as exc:
        log.exception("Could not save listing")
        raise HTTPException(status_code=503, detail="Listing storage is unavailable.") from exc
    return listing


@app.get("/api/health", response_model=HealthResponse, tags=["Monitoring"])
def health() -> HealthResponse:
    """Return server health and model metadata.

    Used by local health checks and future hosting health checks.
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
    encoder: dict[str, dict[str, float]] | None = _state["location_encoder"]
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
    encoder: dict[str, dict[str, float]] | None = _state["location_encoder"]

    if model is None or encoder is None:
        _state["total_errors"] += 1
        PREDICTIONS.labels(result="error").inc()
        raise HTTPException(status_code=503, detail="Model artefacts not loaded.")

    location_key = req.location.strip().lower()

    # Validate that the location is known or falls back to 'other'
    if location_key not in encoder and "other" not in encoder:
        _state["total_errors"] += 1
        PREDICTIONS.labels(result="error").inc()
        raise HTTPException(
            status_code=422,
            detail=(
                f"Unknown location '{req.location}'. "
                "Call GET /api/locations for valid options."
            ),
        )

    priors = encoder.get(location_key, encoder["other"])
    features = pd.DataFrame([{
        "location": location_key,
        "sqft": req.sqft,
        "bhk": req.bhk,
        "bath": req.bath,
        "median_location_price": priors["median_price"],
        "median_location_price_per_sqft": priors["median_price_per_sqft"],
        "sqft_per_bhk": req.sqft / req.bhk,
    }])

    try:
        with INFERENCE_LATENCY.time():
            raw_pred = float(model.predict(features)[0])
    except Exception as exc:
        _state["total_errors"] += 1
        PREDICTIONS.labels(result="error").inc()
        log.error("Model inference failed: %s", exc)
        raise HTTPException(status_code=500, detail="Model inference failed.") from exc

    # Clamp to a floor of 1 Lakh (model can't legitimately go below zero)
    predicted = max(round(raw_pred, 2), 1.0)
    confidence_range = [round(predicted * 0.92, 2), round(predicted * 1.08, 2)]

    latency_ms = (time.perf_counter() - t0) * 1000
    _state["total_predictions"] += 1
    _state["total_latency_ms"] += latency_ms
    PREDICTIONS.labels(result="success").inc()

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
