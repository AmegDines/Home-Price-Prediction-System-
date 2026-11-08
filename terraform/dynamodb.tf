# =============================================================================
# terraform/dynamodb.tf
# DynamoDB table for seller listings.
#
# IMPORTANT: Billing mode is PROVISIONED (not PAY_PER_REQUEST) to stay within
# the AWS Always Free tier limits:
#   - 25 Read Capacity Units (RCU) / month
#   - 25 Write Capacity Units (WCU) / month
#   - 25 GB storage / month
#
# We provision only 5 RCU + 5 WCU — well under the free limit.
# =============================================================================

resource "aws_dynamodb_table" "listings" {
  count        = var.enable_dynamodb ? 1 : 0
  name         = "${var.app_name}-listings"
  billing_mode = "PROVISIONED"

  # Free tier: 25 RCU + 25 WCU. We use 5 each — plenty for the project.
  read_capacity  = var.dynamodb_read_capacity   # default: 5
  write_capacity = var.dynamodb_write_capacity  # default: 5

  # Primary key — matches the listing_id field written by main.py
  hash_key = "listing_id"

  attribute {
    name = "listing_id"
    type = "S"   # String
  }

  # Optional: GSI to query listings by location
  global_secondary_index {
    name            = "location-index"
    hash_key        = "location"
    projection_type = "ALL"
    read_capacity   = 5
    write_capacity  = 5
  }

  attribute {
    name = "location"
    type = "S"
  }

  # Encrypt at rest using AWS-owned KMS key (no extra cost)
  server_side_encryption {
    enabled = true
  }

  # Point-in-time recovery (free for DynamoDB)
  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name = "${var.app_name}-listings"
  }
}
