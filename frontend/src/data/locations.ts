/**
 * locations.ts — intentionally empty stub.
 *
 * Location data is no longer embedded in the frontend bundle.
 * Locations are fetched dynamically from GET /api/locations at runtime.
 * See frontend/src/utils/predictor.ts → fetchLocations()
 *
 * This file is kept to avoid breaking any import that references @/data/locations,
 * but the exported array is always empty — the real data comes from the API.
 */
export const locations: string[] = [];
