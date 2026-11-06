# Bengaluru Home Price Prediction System

A Next.js application and FastAPI service for estimating Bengaluru home prices with a trained scikit-learn model. Seller listings are stored in DynamoDB when `LISTINGS_TABLE` is configured, and in SQLite for local development.

## Project components

- `frontend/`: Next.js and React user interface.
- `server/`: FastAPI prediction API, listing endpoints, and Prometheus metrics.
- `model_training/`: housing data preparation, model training, and evaluation code.
- `server/model/`: local model artifacts used by the API. These files are ignored by Git and must be provided locally before starting the API.

## Run locally with Docker Compose

Install Docker Desktop with its Linux container engine enabled. Model artifacts are intentionally not downloaded from Git; the local copies in `server/model/` must include `home_price_model.pkl`, `location_encoder.pkl`, and `metrics.json` before building the API image.

From PowerShell in the repository root, build the two images and start the app:

```powershell
docker compose up --build
```

Open the frontend at `http://localhost:3000`. The API health endpoint is `http://localhost:8000/api/health`, and the local API docs are at `http://localhost:8000/docs`. Both ports bind only to your computer. Listings use SQLite in a named Docker volume.

Use `docker compose logs -f` to follow logs and `Ctrl+C` to stop the foreground process. To stop while keeping saved listings, run `docker compose down`. To also erase the local listings database, run `docker compose down --volumes`.

If a model file is missing, restore it under `server/model/` before running Compose. The backend image includes the model for local inference, while Git ignores the artifact files.

## Runtime configuration

- `MODEL_DIR`: optional model-artifact directory; defaults to `server/model/`.
- `LISTINGS_TABLE`: DynamoDB table name. Leave it unset for the local SQLite store.
- `AWS_REGION`: AWS region used by the DynamoDB client; defaults to `ap-south-1`.
- `LISTINGS_DB_PATH`: SQLite file location for local development.
- `CORS_ALLOW_ORIGINS`: comma-separated browser origins; local default is `http://localhost:3000`.

For DynamoDB, use an AWS identity with only the required table permissions. Do not put AWS credentials in source files or commit `.env` files.

## Model evaluation

The trained ExtraTrees model uses locality, area, room counts, and locality-derived statistics. Training evaluates on a fixed 20% holdout set and writes artifacts only when holdout R² is at least 0.75. The current evaluation report records R² 0.8005, MAE 23.6960 lakhs, and RMSE 55.3272 lakhs. These scores describe the recorded dataset split; they do not guarantee accuracy for every property or future market conditions.

## GitHub safety before pushing

`.gitignore` excludes raw housing data, pickled models, virtual environments, local secrets, Terraform state, and generated files. The housing CSV and model artifacts have been removed from this checkout's Git index while their local copies are preserved. Confirm that `git ls-files` does not list them before pushing:

```powershell
git ls-files -- model_training/Bengaluru_House_Data.csv model_training/bengaluru_house_prices_model.pkl server/model/home_price_model.pkl server/model/location_encoder.pkl
git status --short
```

The first command should print no file paths. Commit the staged deletions before pushing new changes. If this repository has already been pushed, old commits may still contain those files; create a clean repository without the old history before making it public. No AWS deployment or CI/CD setup is included in this repository at this time.
