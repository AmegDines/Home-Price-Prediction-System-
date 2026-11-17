#!/bin/bash
# =============================================================================
# upload-model-to-s3.sh
# Uploads local model artefacts to the S3 bucket created by Terraform.
# =============================================================================
set -euo pipefail

BUCKET="${1:-}"

if [ -z "${BUCKET}" ]; then
  if [ -d "terraform" ]; then
    BUCKET=$(cd terraform && terraform output -raw model_s3_bucket 2>/dev/null || echo "")
  fi
  if [ -z "${BUCKET}" ]; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
    if [ -n "${ACCOUNT_ID}" ]; then
      BUCKET="home-price-models-${ACCOUNT_ID}"
    fi
  fi
fi

if [ -z "${BUCKET}" ]; then
  echo "❌ Error: Could not determine S3 bucket name. Pass it as an argument: ./upload-model-to-s3.sh <bucket-name>"
  exit 1
fi

echo "Target S3 Bucket: s3://${BUCKET}"

for file in "home_price_model.pkl" "location_encoder.pkl" "metrics.json"; do
  file_path="server/model/${file}"
  if [ -f "${file_path}" ]; then
    echo "Uploading ${file}..."
    aws s3 cp "${file_path}" "s3://${BUCKET}/${file}"
  else
    if [ "${file}" == "metrics.json" ]; then
      echo "⚠️ Optional ${file} not found, skipping."
    else
      echo "❌ Required file ${file_path} missing!"
      exit 1
    fi
  fi
done

echo "✅ All model artefacts successfully uploaded to s3://${BUCKET}!"
