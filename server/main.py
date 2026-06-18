import os
import pickle
import json
import time
import uuid
from datetime import datetime

import numpy as np

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel
from typing import List, Optional

from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
from starlette.responses import Response


app = FastAPI(
    title="Bengaluru House Price Prediction API",
    version="1.0.0"
)


REQUEST_COUNT = Counter(
    "prediction_requests_total",
    "Total prediction requests"
)

LATENCY = Histogram(
    "prediction_latency_seconds",
    "Prediction latency in seconds"
)

ERROR_COUNT = Counter(
    "prediction_errors_total",
    "Total prediction errors"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(
    BASE_DIR,
    "..",
    "model_training",
    "bengaluru_house_prices_model.pkl"
)

COLUMNS_PATH = os.path.join(
    BASE_DIR,
    "..",
    "model_training",
    "columns.json"
)

LISTINGS_PATH = os.path.join(
    BASE_DIR,
    "listings.json"
)


model = None
data_columns = []


def load_saved_artifacts():

    global model, data_columns

    if not os.path.exists(MODEL_PATH) or not os.path.exists(COLUMNS_PATH):

        print(
            "Warning: Model artifacts not found."
        )

        return False


    with open(COLUMNS_PATH, "r") as f:
        data_columns = json.load(f)["data_columns"]


    with open(MODEL_PATH, "rb") as f:
        model = pickle.load(f)


    print("Model artifacts loaded successfully!")

    return True




@app.on_event("startup")
def startup_event():

    load_saved_artifacts()


    if not os.path.exists(LISTINGS_PATH):

        with open(LISTINGS_PATH, "w") as f:
            json.dump([], f)


@app.get("/metrics")
def metrics():

    return Response(
        generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )



@app.get("/health")
def health():

    return {
        "status": "healthy",
        "model_loaded": model is not None
    }



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

        "message":
        "Bengaluru House Price Prediction Server is active",

        "artifacts_loaded":
        model is not None

    }



@app.get("/get_location_names")
def get_location_names():

    global data_columns


    if not data_columns:

        load_saved_artifacts()



    if not data_columns:

        return {

            "locations":
            [
                "whitefield",
                "hsr layout",
                "indiranagar",
                "sarjapur road",
                "other"
            ]

        }



    locations = data_columns[3:]


    locations = [
        loc.title()
        for loc in locations
    ]


    locations.append("Other")


    return {

        "locations": locations

    }





@app.post(
    "/predict_home_price",
    response_model=PredictionResponse
)
def predict_home_price(
        req: PredictionRequest
):

    start_time = time.time()

    REQUEST_COUNT.inc()


    try:

        global model, data_columns



        if model is None:

            success = load_saved_artifacts()

            if not success:

                raise HTTPException(

                    status_code=503,

                    detail=
                    "Prediction model unavailable"

                )



        location = req.location.lower().strip()



        loc_index = -1


        if location in data_columns:

            loc_index = data_columns.index(location)



        x = np.zeros(len(data_columns))


        x[0] = req.total_sqft
        x[1] = req.bhk
        x[2] = req.bath



        if loc_index >= 0:

            x[loc_index] = 1



        prediction = float(
            model.predict([x])[0]
        )



        if prediction <= 0:

            prediction = (

                req.total_sqft * 0.045

                +
                req.bhk * 3.5

                +
                req.bath * 2

            )



        price_sqft = (

            prediction * 100000

        ) / req.total_sqft



        min_price = max(

            prediction * 0.9,

            req.total_sqft * 0.03

        )


        max_price = prediction * 1.1




        LATENCY.observe(
            time.time() - start_time
        )


        return PredictionResponse(

            predicted_price_lakhs=
            round(prediction,2),

            price_per_sqft=
            round(price_sqft,2),

            price_range_min=
            round(min_price,2),

            price_range_max=
            round(max_price,2),

            success=True,

            message=
            "Prediction generated successfully"

        )



    except Exception as e:


        ERROR_COUNT.inc()


        raise HTTPException(

            status_code=500,

            detail=f"Prediction error: {str(e)}"

        )

@app.get(
    "/listings",
    response_model=List[HomeListing]
)
def get_listings():


    if not os.path.exists(LISTINGS_PATH):

        return []



    try:

        with open(LISTINGS_PATH,"r") as f:

            return json.load(f)



    except Exception as e:


        raise HTTPException(

            status_code=500,

            detail=str(e)

        )






@app.post("/list_home")
def list_home(
        listing: HomeListing
):


    try:


        if not os.path.exists(LISTINGS_PATH):

            with open(LISTINGS_PATH,"w") as f:

                json.dump([],f)



        with open(LISTINGS_PATH,"r") as f:

            listings=json.load(f)



        data = listing.dict()


        data["id"] = str(uuid.uuid4())


        data["created_at"] = (
            datetime.now()
            .strftime("%Y-%m-%d %H:%M:%S")
        )



        listings.append(data)



        with open(LISTINGS_PATH,"w") as f:

            json.dump(
                listings,
                f,
                indent=4
            )



        return {

            "success":True,

            "message":
            "Home listed successfully!",

            "listing_id":
            data["id"]

        }

    except Exception as e:


        raise HTTPException(

            status_code=500,

            detail=str(e)

        )
