# =============================================================================
# terraform/outputs.tf
# Values printed after `terraform apply` for use in later steps.
# =============================================================================

output "app_server_public_ip" {
  description = "Public IP of the EC2 instance running k3s + the application."
  value       = aws_instance.app_server.public_ip
}

output "app_server_public_dns" {
  description = "Public DNS name of the app EC2 instance."
  value       = aws_instance.app_server.public_dns
}

output "jenkins_public_ip" {
  description = "Public IP for Jenkins CI/CD."
  value       = var.enable_separate_jenkins ? aws_instance.jenkins_server[0].public_ip : aws_instance.app_server.public_ip
}

output "jenkins_url" {
  description = "Jenkins web UI URL."
  value       = var.enable_separate_jenkins ? "http://${aws_instance.jenkins_server[0].public_ip}:8080" : "http://${aws_instance.app_server.public_ip}:8080"
}

output "frontend_url" {
  description = "URL to open the Next.js frontend in a browser."
  value       = "http://${aws_instance.app_server.public_ip}:${var.frontend_port}"
}

output "backend_api_url" {
  description = "URL of the FastAPI prediction API."
  value       = "http://${aws_instance.app_server.public_ip}:${var.app_port}"
}

output "grafana_url" {
  description = "Grafana dashboard URL (port-forwarded via kubectl or NodePort)."
  value       = "http://${aws_instance.app_server.public_ip}:3100"
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB listings table."
  value       = var.enable_dynamodb ? aws_dynamodb_table.listings[0].name : "sqlite-local-store"
}

output "dynamodb_table_arn" {
  description = "ARN of the DynamoDB listings table."
  value       = var.enable_dynamodb ? aws_dynamodb_table.listings[0].arn : "none"
}

output "ecr_backend_uri" {
  description = "ECR URI for the backend image."
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_frontend_uri" {
  description = "ECR URI for the frontend image."
  value       = aws_ecr_repository.frontend.repository_url
}

output "app_iam_role_arn" {
  description = "IAM role ARN attached to the app EC2 instance profile."
  value       = var.enable_dynamodb ? aws_iam_role.app_ec2_role[0].arn : "none"
}

output "s3_tfstate_bucket" {
  description = "S3 bucket storing Terraform state."
  value       = var.tfstate_bucket
}
