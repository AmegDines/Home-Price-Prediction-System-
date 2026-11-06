variable "aws_region" {
  description = "Region for the application infrastructure."
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Short prefix used to name AWS resources."
  type        = string
  default     = "bengaluru-home-price"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,24}$", var.project_name))
    error_message = "Use 3-25 lowercase letters, numbers, and hyphens; start with a letter."
  }
}

variable "alert_email" {
  description = "Address for AWS Budget email warnings."
  type        = string
}

variable "monthly_budget_usd" {
  description = "Warning threshold; a budget is not a hard spending cap."
  type        = number
  default     = 25
}

variable "app_instance_type" {
  description = "Select an instance marked eligible in your own account and region."
  type        = string
  default     = "t3.small"
}

variable "root_volume_gib" {
  type    = number
  default = 20
}
