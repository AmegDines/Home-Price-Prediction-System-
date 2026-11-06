output "cloudfront_url" {
  description = "HTTPS address for the future app deployment."
  value       = "https://${aws_cloudfront_distribution.app.domain_name}"
}

output "app_instance_id" {
  value = aws_instance.app.id
}

output "app_instance_public_ip" {
  description = "Origin IP. Security group accepts HTTP only from CloudFront origin-facing addresses."
  value       = aws_eip.app.public_ip
}

output "private_artifact_bucket" {
  value = aws_s3_bucket.artifacts.id
}

output "private_ecr_repository" {
  value = aws_ecr_repository.app.repository_url
}

output "listings_table" {
  value = aws_dynamodb_table.listings.name
}
