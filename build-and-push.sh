#!/bin/bash
# =============================================================================
# build-and-push.sh — Build & Push Containers to AWS ECR
# =============================================================================
set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
TAG="${1:-v1}"
BACKEND_URL="${2:-}"

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
if [ -z "${ACCOUNT_ID}" ]; then
  echo "❌ Error: AWS credentials not detected. Run 'aws configure' first."
  exit 1
fi

REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

if [ -z "${BACKEND_URL}" ]; then
  if [ -d "terraform" ]; then
    APP_IP=$(cd terraform && terraform output -raw app_server_public_ip 2>/dev/null || echo "")
    if [ -n "${APP_IP}" ]; then
      BACKEND_URL="http://${APP_IP}:8000"
    fi
  fi
fi

if [ -z "${BACKEND_URL}" ]; then
  BACKEND_URL="http://localhost:8000"
fi

echo "Registry: ${REGISTRY}"
echo "Frontend targeting Backend API: ${BACKEND_URL}"

# 1. ECR Login
echo "[1/3] Logging into Amazon ECR..."
aws ecr get-login-password --region "${REGION}" | docker login --username AWS --password-stdin "${REGISTRY}"

# 2. Build & Push Backend
echo "[2/3] Building and pushing Backend..."
docker build -t "${REGISTRY}/home-price-backend:${TAG}" -t "${REGISTRY}/home-price-backend:latest" -f server/Dockerfile server/
docker push "${REGISTRY}/home-price-backend:${TAG}"
docker push "${REGISTRY}/home-price-backend:latest"

# 3. Build & Push Frontend
echo "[3/3] Building and pushing Frontend..."
docker build \
  --build-arg NEXT_PUBLIC_API_BASE_URL="${BACKEND_URL}" \
  -t "${REGISTRY}/home-price-frontend:${TAG}" \
  -t "${REGISTRY}/home-price-frontend:latest" \
  -f frontend/Dockerfile frontend/
docker push "${REGISTRY}/home-price-frontend:${TAG}"
docker push "${REGISTRY}/home-price-frontend:latest"

echo "✅ Build & push complete!"
