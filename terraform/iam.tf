# =============================================================================
# terraform/iam.tf
# IAM Role + Policy for the EC2 app server.
#
# The role is attached to the EC2 instance profile so the app can call
# DynamoDB without any hardcoded AWS credentials in the code or containers.
# This implements the "shared responsibility" principle from Unit V:
#   AWS secures the credential infrastructure; we secure the policy scope.
# =============================================================================

# ---------------------------------------------------------------------------
# Trust policy — allows EC2 service to assume this role
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

# ---------------------------------------------------------------------------
# IAM Role for the application EC2 instance
# ---------------------------------------------------------------------------
resource "aws_iam_role" "app_ec2_role" {
  count              = var.enable_dynamodb ? 1 : 0
  name               = "${var.app_name}-app-ec2-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json

  tags = {
    Name = "${var.app_name}-app-ec2-role"
  }
}

# ---------------------------------------------------------------------------
# Least-privilege policy — only the DynamoDB table this app owns
# (Unit V — IAM best practices: never use AdministratorAccess on app roles)
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "app_dynamodb" {
  count = var.enable_dynamodb ? 1 : 0

  statement {
    sid    = "AllowDynamoDBListingsTable"
    effect = "Allow"

    actions = [
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan",
    ]

    resources = [
      aws_dynamodb_table.listings[0].arn,
      "${aws_dynamodb_table.listings[0].arn}/index/*",
    ]
  }

  # Allow CloudWatch Logs (for app log shipping — Unit V)
  statement {
    sid    = "AllowCloudWatchLogs"
    effect = "Allow"

    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogStreams",
    ]

    resources = ["arn:aws:logs:${var.aws_region}:*:*"]
  }
}

resource "aws_iam_policy" "app_dynamodb" {
  count       = var.enable_dynamodb ? 1 : 0
  name        = "${var.app_name}-app-dynamodb-policy"
  description = "Least-privilege DynamoDB + CloudWatch access for the app EC2 instance"
  policy      = data.aws_iam_policy_document.app_dynamodb[0].json
}

# ---------------------------------------------------------------------------
# Attach the policy to the role
# ---------------------------------------------------------------------------
resource "aws_iam_role_policy_attachment" "app_dynamodb" {
  count      = var.enable_dynamodb ? 1 : 0
  role       = aws_iam_role.app_ec2_role[0].name
  policy_arn = aws_iam_policy.app_dynamodb[0].arn
}

# ---------------------------------------------------------------------------
# ECR read access — allows the EC2 instance to pull images from ECR Public
# ---------------------------------------------------------------------------
resource "aws_iam_role_policy_attachment" "ecr_read" {
  count      = var.enable_dynamodb ? 1 : 0
  role       = aws_iam_role.app_ec2_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}
