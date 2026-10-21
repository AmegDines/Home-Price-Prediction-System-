/**
 * model_data.ts — intentionally empty stub.
 *
 * Model coefficients are NO LONGER embedded in the frontend.
 * All predictions are served by the FastAPI backend.
 * This file satisfies any legacy import without exporting real data.
 */
export interface ModelData {
  intercept: number;
  coef_sqft: number;
  coef_bhk: number;
  coef_bath: number;
  location_coefs: Record<string, number>;
}

/** @deprecated — use POST /api/predict instead */
export const modelData: ModelData = {
  intercept: 0,
  coef_sqft: 0,
  coef_bhk: 0,
  coef_bath: 0,
  location_coefs: {},
};
