# =============================================================================
# terraform/main.tf
# Root module — provider configuration and remote state backend.
#
# Remote state: stored in S3 bucket (created separately via bootstrap script
# or manually before first `terraform init`).
# State locking: DynamoDB table "terraform-lock".
# =============================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # ---------------------------------------------------------------------------
  # Remote backend — S3 bucket stores state, use_lockfile replaces
  # the deprecated dynamodb_table parameter (Terraform >= 1.10)
  # ---------------------------------------------------------------------------
  backend "s3" {
    bucket       = "home-price-tfstate-bucket"
    key          = "home-price/terraform.tfstate"
    region       = "ap-south-1"
    encrypt      = true
    use_lockfile = true   # replaces deprecated dynamodb_table
  }
}

# ---------------------------------------------------------------------------
# AWS provider — region is a variable so we can override per environment
# ---------------------------------------------------------------------------
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "home-price-prediction"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
