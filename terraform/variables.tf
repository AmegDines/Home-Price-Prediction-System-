# =============================================================================
# terraform/variables.tf
# All input variables with descriptions and defaults.
# =============================================================================

variable "aws_region" {
  description = "AWS region to deploy resources into."
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Deployment environment label (dev / staging / prod)."
  type        = string
  default     = "dev"
}

variable "app_name" {
  description = "Short application identifier used in resource names."
  type        = string
  default     = "home-price"
}

# ---------------------------------------------------------------------------
# EC2 — application server (k3s + app pods)
# t3.small stays within free-tier 750 hrs/month
# ---------------------------------------------------------------------------
variable "enable_separate_jenkins" {
  description = "Whether to provision a separate EC2 instance for Jenkins. Set to false to run Jenkins on the app server (saves AWS Free Tier hours)."
  type        = bool
  default     = false
}

variable "app_instance_type" {
  description = "EC2 instance type for the k3s application server."
  type        = string
  default     = "t3.small"
}

variable "jenkins_instance_type" {
  description = "EC2 instance type for the Jenkins CI/CD server."
  type        = string
  default     = "t3.small"
}

variable "ami_id" {
  description = "Amazon Machine Image ID — Ubuntu 22.04 LTS (ap-south-1)."
  type        = string
  default     = "ami-0f58b397bc5c1f2e8"   # Ubuntu 22.04 LTS ap-south-1 (HVM, SSD)
}

variable "key_pair_name" {
  description = "Name of an existing EC2 Key Pair for SSH access."
  type        = string
  default     = "demo"   # uses your existing demo.pem key pair
}

variable "enable_dynamodb" {
  description = "Enable DynamoDB table and IAM instance profile. Requires IAM/DynamoDB write permissions on AWS account."
  type        = bool
  default     = false
}

# ---------------------------------------------------------------------------
# DynamoDB — listings table (Provisioned mode to stay in free tier)
# Free tier: 25 RCU + 25 WCU + 25 GB storage (Always Free)
# ---------------------------------------------------------------------------
variable "dynamodb_read_capacity" {
  description = "Provisioned read capacity units for the DynamoDB listings table."
  type        = number
  default     = 5   # well within 25 free-tier RCU
}

variable "dynamodb_write_capacity" {
  description = "Provisioned write capacity units for the DynamoDB listings table."
  type        = number
  default     = 5   # well within 25 free-tier WCU
}

# ---------------------------------------------------------------------------
# S3 — Terraform remote state bucket (created before terraform init)
# ---------------------------------------------------------------------------
variable "tfstate_bucket" {
  description = "S3 bucket name that holds Terraform remote state."
  type        = string
  default     = "home-price-tfstate-bucket"
}

# ---------------------------------------------------------------------------
# ECR Public — container image repository alias
# ---------------------------------------------------------------------------
variable "ecr_public_alias" {
  description = "ECR Public namespace alias (shown in pull commands)."
  type        = string
  default     = "home-price"
}

# ---------------------------------------------------------------------------
# Networking
# ---------------------------------------------------------------------------
variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH into EC2 instances. Restrict in production."
  type        = string
  default     = "0.0.0.0/0"   # tighten to your IP e.g. 203.0.113.5/32
}

variable "app_port" {
  description = "Port the FastAPI backend listens on inside the container."
  type        = number
  default     = 8000
}

variable "frontend_port" {
  description = "Port the Next.js frontend listens on inside the container."
  type        = number
  default     = 3000
}
