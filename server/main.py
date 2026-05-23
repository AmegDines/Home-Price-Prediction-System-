import os
import pickle
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="Bengaluru House Price Prediction API", version="1.0.0")

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "..", "model_training", "bengaluru_house_prices_model.pkl")
COLUMNS_PATH = os.path.join(BASE_DIR, "..", "model_training", "columns.json")
LISTINGS_PATH = os.path.join(BASE_DIR, "listings.json")

# Global variables for model assets
model = None
data_columns = []

def load_saved_artifacts():
    global model, data_columns
    if not os.path.exists(MODEL_PATH) or not os.path.exists(COLUMNS_PATH):
        # We don't raise an error immediately so the server starts, but we flag it
        print("Warning: Model artifacts not found. Please run model_training/train.py first.")
        return False
        
    with open(COLUMNS_PATH, "r") as f:
        data_columns = json.load(f)["data_columns"]
        
    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)
        
    print("Model artifacts loaded successfully!")
    return True

# Call load_saved_artifacts on startup
@app.on_event("startup")
def startup_event():
    load_saved_artifacts()
    # Initialize listings.json if it doesn't exist
    if not os.path.exists(LISTINGS_PATH):
        with open(LISTINGS_PATH, "w") as f:
            json.dump([], f)

# Schemas
class PredictionRequest(BaseModel):
    location: str
    total_sqft: float
    bhk: int
    bath: int

class PredictionResponse(BaseModel):
    predicted_price_lakhs: float
    price_per_sqft: float
    price_range_min: float
    price_range_max: float
    success: bool
    message: str

class HomeListing(BaseModel):
    id: Optional[str] = None
    title: str
    location: str
    bhk: int
    bath: int
    total_sqft: float
    balcony: int
    asking_price_lakhs: float
    predicted_price_lakhs: float
    seller_name: str
    seller_phone: str
    created_at: Optional[str] = None

@app.get("/")
def home():
    return {
        "status": "online",
        "message": "Bengaluru House Price Prediction Server is active",
        "artifacts_loaded": model is not None
    }

@app.get("/get_location_names")
def get_location_names():
    # If columns aren't loaded, return standard locations list or try to load them
    global data_columns
    if not data_columns:
        load_saved_artifacts()
        
    if not data_columns:
        return {"locations": ["whitefield", "hsr layout", "indiranagar", "sarjapur road", "other"]}
        
    # Locations start from index 3 in our columns list
    locations = data_columns[3:]
    # Capitalize locations for clean dropdown UI
    capitalized_locations = [loc.title() for loc in locations]
    # Add 'other' at the end
    capitalized_locations.append("Other")
    return {"locations": capitalized_locations}

@app.post("/predict_home_price", response_model=PredictionResponse)
def predict_home_price(req: PredictionRequest):
    global model, data_columns
    if model is None:
        success = load_saved_artifacts()
        if not success:
            raise HTTPException(status_code=503, detail="Prediction model is not trained/available yet.")
            
    try:
        loc = req.location.lower().strip()
        
        # Build the exact vector X
        # Index of location in dummy columns
        loc_index = -1
        if loc in data_columns:
            loc_index = data_columns.index(loc)
            
        import numpy as np
        x = np.zeros(len(data_columns))
        x[0] = req.total_sqft
        x[1] = req.bhk
        x[2] = req.bath
        
        if loc_index >= 0:
            x[loc_index] = 1.0
            
        # Run prediction
        predicted_price = float(model.predict([x])[0])
        
        # Boundary protection: house price shouldn't be negative
        if predicted_price <= 0:
            # Fallback to a basic estimation if prediction is negative due to out-of-bound inputs
            predicted_price = req.total_sqft * 0.045 + req.bhk * 3.5 + req.bath * 2.0
            
        # Calculate price per sqft (in Rupees, predicted_price is in Lakhs)
        price_per_sqft = (predicted_price * 100000) / req.total_sqft
        
        # Standard error range (approximate +/- 10% standard error)
        price_range_min = max(predicted_price * 0.9, req.total_sqft * 0.03)
        price_range_max = predicted_price * 1.1
        
        return PredictionResponse(
            predicted_price_lakhs=round(predicted_price, 2),
            price_per_sqft=round(price_per_sqft, 2),
            price_range_min=round(price_range_min, 2),
            price_range_max=round(price_range_max, 2),
            success=True,
            message="Prediction generated successfully"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.get("/listings", response_model=List[HomeListing])
def get_listings():
    if not os.path.exists(LISTINGS_PATH):
        return []
    try:
        with open(LISTINGS_PATH, "r") as f:
            return json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read listings: {str(e)}")

@app.post("/list_home")
def list_home(listing: HomeListing):
    if not os.path.exists(LISTINGS_PATH):
        with open(LISTINGS_PATH, "w") as f:
            json.dump([], f)
            
    try:
        with open(LISTINGS_PATH, "r") as f:
            listings = json.load(f)
            
        import uuid
        from datetime import datetime
        
        listing_dict = listing.dict()
        listing_dict["id"] = str(uuid.uuid4())
        listing_dict["created_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        listings.append(listing_dict)
        
        with open(LISTINGS_PATH, "w") as f:
            json.dump(listings, f, indent=4)
            
        return {"success": True, "message": "Home listed successfully!", "listing_id": listing_dict["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save listing: {str(e)}")
