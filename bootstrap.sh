#!/bin/bash
# =============================================================================
# bootstrap.sh — One-time AWS setup before terraform init
# Run this ONCE from your local machine (not on EC2).
#
# Prerequisites: AWS CLI installed and configured (aws configure)
# =============================================================================
set -euo pipefail

REGION="ap-south-1"
BUCKET="home-price-tfstate-bucket"
KEY_PAIR="demo"

echo "====================================================="
echo "  🚀 Fresh AWS Account Bootstrap"
echo "====================================================="

# 1. Check AWS identity
echo "[1/3] Verifying AWS credentials..."
aws sts get-caller-identity --output table

# 2. Check or create S3 remote state bucket
echo "[2/3] Checking S3 state bucket '${BUCKET}'..."
if ! aws s3api head-bucket --bucket "${BUCKET}" 2>/dev/null; then
  echo "  Creating S3 state bucket '${BUCKET}' in ${REGION}..."
  if [ "${REGION}" == "us-east-1" ]; then
    aws s3api create-bucket --bucket "${BUCKET}"
  else
    aws s3api create-bucket --bucket "${BUCKET}" --region "${REGION}" \
      --create-bucket-configuration LocationConstraint="${REGION}"
  fi
  aws s3api put-bucket-versioning --bucket "${BUCKET}" \
    --versioning-configuration Status=Enabled
  echo "  ✅ S3 state bucket created with versioning."
else
  echo "  ✅ S3 state bucket is ready."
fi

# 3. Check or create EC2 key pair
echo "[3/3] Checking EC2 Key Pair '${KEY_PAIR}'..."
if ! aws ec2 describe-key-pairs --key-names "${KEY_PAIR}" --region "${REGION}" 2>/dev/null; then
  echo "  Creating Key Pair '${KEY_PAIR}'..."
  aws ec2 create-key-pair --key-name "${KEY_PAIR}" --region "${REGION}" \
    --query "KeyMaterial" --output text > "${KEY_PAIR}.pem"
  chmod 400 "${KEY_PAIR}.pem" 2>/dev/null || true
  echo "  ✅ Key Pair '${KEY_PAIR}.pem' saved locally."
else
  echo "  ✅ Key Pair '${KEY_PAIR}' exists."
fi

echo ""
echo "====================================================="
echo "  🎉 Bootstrap Complete! Next steps:"
echo "====================================================="
echo "  1. cd terraform"
echo "  2. terraform init"
echo "  3. terraform apply"
echo "  4. cd .. && ./upload-model-to-s3.sh"
