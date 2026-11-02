# Bengaluru Nest AI

A Bengaluru home price estimation and seller listing app. The API loads a trained model from `server/model/`; the frontend calls the API for estimates. Listings created in the browser are saved in that browser's local storage.

## Build and run locally

1. Put one or more supported Bengaluru housing CSV files in `model_training/`. The pipeline searches that directory for CSV files; raw datasets are intentionally excluded from Git.
2. Install the Python dependencies from `server/requirements.txt`; install `pytest` if you want to run the checks.
3. Run `python model_training/pipeline.py`. This writes the model, location encoder, and metrics to `server/model/`, and a training metrics copy to `model_training/metrics.json`.
4. Run `docker compose up --build`. The backend image build checks for all three packaged artifacts and fails clearly if training was skipped.
5. Open `http://localhost:3000`; the API is available at `http://localhost:8000/docs`.

## Kubernetes deployment

The CI pipeline trains the model before building the backend image. The image contains the trained model, location encoder, and metrics under `/app/model`; the Deployment uses those image contents directly, so no manually populated model volume is needed. Keep the training, image build, and deployment stages in that order when changing the pipeline.

## Project layout

- `frontend/`: Next.js app and browser-local seller listings
- `server/`: FastAPI prediction service and Docker image
- `model_training/`: CSV cleaning, model selection, and artifact generation
- `k8s/`: Kubernetes Deployments, Services, and autoscaling configuration

## Model evaluation

The current ExtraTrees model uses one-hot locality categories, area and room features, and locality median price and price-per-square-foot priors. Those priors are cross-fitted while training so each row is excluded from the statistics used to predict it. The pipeline reports a fixed 20% holdout score and refuses to write model artifacts when holdout R² is below 0.75. The current dataset run reports R² 0.8005, MAE 23.6960 lakhs, and RMSE 55.3272 lakhs. Metrics are saved in `model_training/metrics.json`.
