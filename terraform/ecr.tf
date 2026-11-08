# =============================================================================
# terraform/ecr.tf
# Private ECR repositories for backend and frontend Docker images.
# admin-user already has AmazonEC2ContainerRegistryPowerUser for private ECR.
# =============================================================================

# ---------------------------------------------------------------------------
# Private ECR — Backend (FastAPI)
# ---------------------------------------------------------------------------
resource "aws_ecr_repository" "backend" {
  name                 = "${var.app_name}-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.app_name}-backend"
  }
}

# ---------------------------------------------------------------------------
# Private ECR — Frontend (Next.js)
# ---------------------------------------------------------------------------
resource "aws_ecr_repository" "frontend" {
  name                 = "${var.app_name}-frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.app_name}-frontend"
  }
}
