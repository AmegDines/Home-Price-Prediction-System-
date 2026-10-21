/**
 * predictor.ts — API client for the home price prediction service.
 *
 * All prediction logic runs server-side. This module only handles
 * HTTP communication with POST /api/predict and related endpoints.
 * There are NO embedded model coefficients or fallback maths here.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PredictRequest {
  location: string;
  sqft: number;
  bhk: number;
  bath: number;
}

export interface PredictionResult {
  predicted_price: number;
  currency: string;
  confidence_range: [number, number];
}

export interface HealthData {
  status: string;
  model_version: string;
  dataset_size: number;
  r2_score: number;
}

export interface ApiError {
  message: string;
  detail?: string;
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

/**
 * Call POST /api/predict with the given property features.
 * Returns a PredictionResult or throws an ApiError.
 */
export async function fetchPrediction(
  req: PredictRequest
): Promise<PredictionResult> {
  const res = await fetch(`${API_BASE}/api/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      location: req.location,
      sqft: req.sqft,
      bhk: req.bhk,
      bath: req.bath,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw {
      message: `Prediction failed (HTTP ${res.status})`,
      detail: err?.detail ?? "Unknown server error",
    } satisfies ApiError;
  }

  return res.json() as Promise<PredictionResult>;
}

/**
 * Call GET /api/locations to retrieve the sorted list of valid location names
 * that the model was trained on.
 */
export async function fetchLocations(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/locations`);
  if (!res.ok) {
    throw {
      message: `Failed to load locations (HTTP ${res.status})`,
    } satisfies ApiError;
  }
  const data = (await res.json()) as { locations: string[] };
  return data.locations;
}

/**
 * Call GET /api/health to retrieve model metadata shown in the UI footer.
 */
export async function fetchHealth(): Promise<HealthData> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) {
    throw {
      message: `Failed to fetch health data (HTTP ${res.status})`,
    } satisfies ApiError;
  }
  return res.json() as Promise<HealthData>;
}
