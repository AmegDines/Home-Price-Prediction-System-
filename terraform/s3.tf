# =============================================================================
# terraform/s3.tf
# S3 bucket for Terraform remote state — already created via AWS CLI.
#
# The bucket "home-price-tfstate-bucket" was created before terraform init
# using the AWS CLI. This file uses a data source to reference it without
# attempting to re-create it.
#
# NOTE: The DynamoDB lock table is NOT needed because we use
#       use_lockfile = true in main.tf (Terraform >= 1.10 native locking).
# =============================================================================

# Reference the existing state bucket (created via AWS CLI before terraform init)
data "aws_s3_bucket" "tfstate" {
  bucket = var.tfstate_bucket
}
