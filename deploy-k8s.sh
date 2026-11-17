#!/bin/bash
set -euo pipefail

echo "====================================================="
echo "  🚀 Bengaluru Home Price Prediction - Full K8s Deploy"
echo "====================================================="

REGION="${AWS_REGION:-ap-south-1}"
export AWS_DEFAULT_REGION="${REGION}"
export AWS_REGION="${REGION}"

# Ensure kubeconfig permissions for k3s
if [ -f /etc/rancher/k3s/k3s.yaml ]; then
  sudo chmod 644 /etc/rancher/k3s/k3s.yaml 2>/dev/null || true
  export KUBECONFIG="${KUBECONFIG:-/etc/rancher/k3s/k3s.yaml}"
elif [ -f "$HOME/.kube/config" ]; then
  export KUBECONFIG="$HOME/.kube/config"
fi

# 1. Try STS with explicit region
ACCOUNT_ID=$(aws sts get-caller-identity --region "${REGION}" --query Account --output text 2>/dev/null || true)

# 2. Try EC2 Metadata Service (IMDSv2)
if [ -z "${ACCOUNT_ID}" ] || [ "${ACCOUNT_ID}" == "None" ]; then
  IMDS_TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 60" 2>/dev/null || true)
  if [ -n "${IMDS_TOKEN}" ]; then
    ACCOUNT_ID=$(curl -s -H "X-aws-ec2-metadata-token: $IMDS_TOKEN" http://169.254.169.254/latest/dynamic/instance-identity/document 2>/dev/null | grep -Po '"accountId"\s*:\s*"\K[^"]+' || true)
  fi
fi

# 3. Fallback to AWS_ACCOUNT_ID env var or default account ID
if [ -z "${ACCOUNT_ID}" ] || [ "${ACCOUNT_ID}" == "None" ]; then
  ACCOUNT_ID="${AWS_ACCOUNT_ID:-111169963700}"
fi

REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
NAMESPACE="home-price"
REPLICAS="${REPLICAS:-1}"

# Look up Model S3 bucket
MODEL_BUCKET=$(aws s3api list-buckets --region "${REGION}" --query "Buckets[?starts_with(Name, 'home-price-models-')].Name" --output text 2>/dev/null | awk '{print $1}' || true)
if [ -z "${MODEL_BUCKET}" ] || [ "${MODEL_BUCKET}" == "None" ]; then
  MODEL_BUCKET="home-price-models-${ACCOUNT_ID}"
fi
echo "Using AWS Account: ${ACCOUNT_ID} in ${REGION}"
echo "Using Model S3 Bucket: ${MODEL_BUCKET}"

# 1. Create namespace
echo "[1/6] Setting up namespace '${NAMESPACE}'..."
kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -

# 2. Authenticate to private ECR and create imagePullSecret
echo "[2/6] Generating ECR pull credentials..."
TOKEN=$(aws ecr get-login-password --region "${REGION}")

kubectl delete secret ecr-secret -n "${NAMESPACE}" --ignore-not-found
kubectl create secret docker-registry ecr-secret \
  --namespace="${NAMESPACE}" \
  --docker-server="${REGISTRY}" \
  --docker-username=AWS \
  --docker-password="${TOKEN}"

kubectl patch serviceaccount default -n "${NAMESPACE}" \
  -p '{"imagePullSecrets": [{"name": "ecr-secret"}]}'

# 3. Create Backend Secret
echo "[3/6] Configuring application secrets..."
kubectl apply -n "${NAMESPACE}" -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: backend-secret
type: Opaque
stringData:
  LISTINGS_TABLE: "home-price-listings"
  AWS_REGION: "${REGION}"
  MODEL_S3_BUCKET: "${MODEL_BUCKET}"
  CORS_ALLOW_ORIGINS: "*"
EOF

# 4. Deploy Backend (FastAPI)
echo "[4/6] Deploying Backend (FastAPI)..."
kubectl apply -n "${NAMESPACE}" -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: home-price-backend
  labels:
    app: home-price-backend
spec:
  replicas: ${REPLICAS}
  selector:
    matchLabels:
      app: home-price-backend
  template:
    metadata:
      labels:
        app: home-price-backend
    spec:
      containers:
        - name: backend
          image: ${REGISTRY}/home-price-backend:v1
          imagePullPolicy: Always
          ports:
            - containerPort: 8000
          envFrom:
            - secretRef:
                name: backend-secret
          readinessProbe:
            httpGet:
              path: /api/health
              port: 8000
            initialDelaySeconds: 15
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: home-price-backend
spec:
  type: NodePort
  selector:
    app: home-price-backend
  ports:
    - port: 8000
      targetPort: 8000
      nodePort: 30800
EOF

# 5. Deploy Frontend (Next.js)
echo "[5/6] Deploying Frontend (Next.js)..."
kubectl apply -n "${NAMESPACE}" -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: home-price-frontend
  labels:
    app: home-price-frontend
spec:
  replicas: ${REPLICAS}
  selector:
    matchLabels:
      app: home-price-frontend
  template:
    metadata:
      labels:
        app: home-price-frontend
    spec:
      containers:
        - name: frontend
          image: ${REGISTRY}/home-price-frontend:v1
          imagePullPolicy: Always
          ports:
            - containerPort: 3000
          readinessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 20
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: home-price-frontend
spec:
  type: NodePort
  selector:
    app: home-price-frontend
  ports:
    - port: 3000
      targetPort: 3000
      nodePort: 30300
EOF

# 6. Wait for rollout and smoke test
echo "[6/6] Waiting for rollout to complete..."
kubectl rollout status deployment/home-price-backend -n "${NAMESPACE}" --timeout=180s
kubectl rollout status deployment/home-price-frontend -n "${NAMESPACE}" --timeout=180s

echo ""
echo "====================================================="
echo "  🎉 DEPLOYMENT COMPLETE & LIVE!"
echo "====================================================="
kubectl get pods -n "${NAMESPACE}"
echo ""
echo "Access your app:"
echo "  Frontend: http://$(curl -s ifconfig.me):30300"
echo "  Backend:  http://$(curl -s ifconfig.me):30800/docs"
