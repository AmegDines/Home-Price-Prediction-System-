FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Fail the image build early if the training stage did not provide the model.
RUN test -s /app/model/home_price_model.pkl \
    && test -s /app/model/location_encoder.pkl \
    && test -s /app/model/metrics.json

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
