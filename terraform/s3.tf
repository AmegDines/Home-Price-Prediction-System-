# =============================================================================
# terraform/s3.tf
# S3 buckets:
#   1. Remote state bucket (referenced via data source)
#   2. Model artefacts bucket (stores .pkl and encoder for FastAPI inference)
# =============================================================================

data "aws_caller_identity" "current" {}

# Reference the existing state bucket (created before terraform init)
data "aws_s3_bucket" "tfstate" {
  bucket = var.tfstate_bucket
}

# ---------------------------------------------------------------------------
# S3 Bucket for ML Model Artefacts (home_price_model.pkl, location_encoder.pkl)
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "model_bucket" {
  bucket        = var.model_bucket_name != "" ? var.model_bucket_name : "${var.app_name}-models-${data.aws_caller_identity.current.account_id}"
  force_destroy = true

  tags = {
    Name        = "${var.app_name}-model-artefacts"
    Environment = var.environment
  }
}

resource "aws_s3_bucket_versioning" "model_bucket" {
  bucket = aws_s3_bucket.model_bucket.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "model_bucket" {
  bucket = aws_s3_bucket.model_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
