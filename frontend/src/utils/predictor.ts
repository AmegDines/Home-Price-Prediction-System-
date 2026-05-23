import { modelData } from "@/data/model_data";

export interface PredictionResult {
  predictedPriceLakhs: number;
  pricePerSqft: number;
  priceRangeMin: number;
  priceRangeMax: number;
  isFallback: boolean;
}

/**
 * Predicts the price of a house in Bengaluru using the client-side trained regression model.
 * Formula: price = intercept + sqft * coef_sqft + bhk * coef_bhk + bath * coef_bath + location_coef
 */
export function predictHomePriceClient(
  location: string,
  totalSqft: number,
  bhk: number,
  bath: number
): PredictionResult {
  const { intercept, coef_sqft, coef_bhk, coef_bath, location_coefs } = modelData;

  const locKey = location.toLowerCase().trim();
  // Find location coefficient or fallback to 'other' or 0
  const locCoef = location_coefs[locKey] !== undefined ? location_coefs[locKey] : (location_coefs["other"] || 0);

  // Compute prediction
  let price = intercept + (totalSqft * coef_sqft) + (bhk * coef_bhk) + (bath * coef_bath) + locCoef;
  let isFallback = false;

  // Boundary Protection: If inputs are extreme or lead to a negative/unrealistic price, apply a professional fallback
  if (price <= 0 || isNaN(price)) {
    isFallback = true;
    // Solid real estate rule of thumb for Bengaluru (avg cost is around 4,500 - 6,500 Rs per sqft based on location class)
    let baseRate = 0.045; // 4.5k per sqft
    if (locCoef > 50) {
      baseRate = 0.095; // Highly premium (Indiranagar, Koramangala)
    } else if (locCoef > 10) {
      baseRate = 0.07;  // Premium (HSR, JP Nagar)
    } else if (locCoef < -30) {
      baseRate = 0.035; // Budget friendly (Anekal, Bidadi)
    }
    
    price = (totalSqft * baseRate) + (bhk * 4.0) + (bath * 2.5);
  }

  // Calculate metrics
  const pricePerSqft = (price * 100000) / totalSqft;
  
  // Approximate standard error intervals (+/- 8% for clean estimation)
  const priceRangeMin = Math.max(price * 0.92, totalSqft * 0.025);
  const priceRangeMax = price * 1.08;

  return {
    predictedPriceLakhs: parseFloat(price.toFixed(2)),
    pricePerSqft: parseFloat(pricePerSqft.toFixed(2)),
    priceRangeMin: parseFloat(priceRangeMin.toFixed(2)),
    priceRangeMax: parseFloat(priceRangeMax.toFixed(2)),
    isFallback
  };
}
