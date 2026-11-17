# =============================================================================
# bootstrap.ps1 — One-time AWS setup for Windows before terraform init
# Run this ONCE from your local machine (PowerShell).
#
# Prerequisites: AWS CLI installed and configured (aws configure)
# =============================================================================

$ErrorActionPreference = "Stop"

$Region = "ap-south-1"
$Bucket = "home-price-tfstate-bucket"
$KeyPair = "demo"

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  🚀 Fresh AWS Account Bootstrap" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# 1. Verify AWS Identity
Write-Host "[1/3] Verifying AWS credentials..." -ForegroundColor Yellow
try {
    $Identity = aws sts get-caller-identity --output json | ConvertFrom-Json
    Write-Host "  Authenticated as ARN: $($Identity.Arn)" -ForegroundColor Green
    Write-Host "  Account ID: $($Identity.Account)" -ForegroundColor Green
} catch {
    Write-Error "AWS CLI is not configured or credentials expired. Run 'aws configure' first."
    exit 1
}

# 2. Verify or Create S3 Remote State Bucket
Write-Host "[2/3] Checking S3 state bucket '$Bucket'..." -ForegroundColor Yellow
$bucketExists = aws s3api head-bucket --bucket $Bucket 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Bucket '$Bucket' does not exist yet. Creating it in $Region..." -ForegroundColor Yellow
    if ($Region -eq "us-east-1") {
        aws s3api create-bucket --bucket $Bucket
    } else {
        aws s3api create-bucket --bucket $Bucket --region $Region --create-bucket-configuration LocationConstraint=$Region
    }
    aws s3api put-bucket-versioning --bucket $Bucket --versioning-configuration Status=Enabled
    aws s3api put-bucket-encryption --bucket $Bucket --server-side-encryption-configuration '{\"Rules\":[{\"ApplyServerSideEncryptionByDefault\":{\"SSEAlgorithm\":\"AES256\"}}]}'
    Write-Host "  ✅ S3 state bucket '$Bucket' created with encryption and versioning." -ForegroundColor Green
} else {
    Write-Host "  ✅ S3 state bucket '$Bucket' is ready." -ForegroundColor Green
}

# 3. Verify or Create EC2 Key Pair
Write-Host "[3/3] Checking EC2 Key Pair '$KeyPair'..." -ForegroundColor Yellow
$keyExists = aws ec2 describe-key-pairs --key-names $KeyPair --region $Region 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Key pair '$KeyPair' not found. Creating '$KeyPair.pem' in current folder..." -ForegroundColor Yellow
    $keyMaterial = aws ec2 create-key-pair --key-name $KeyPair --query "KeyMaterial" --output text --region $Region
    $keyMaterial | Out-File -FilePath "$KeyPair.pem" -Encoding ascii
    Write-Host "  ✅ Key pair '$KeyPair.pem' created and saved locally." -ForegroundColor Green
} else {
    Write-Host "  ✅ Key pair '$KeyPair' exists in region $Region." -ForegroundColor Green
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "  🎉 Bootstrap Complete! Next steps:" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "  1. cd terraform"
Write-Host "  2. terraform init"
Write-Host "  3. terraform apply"
Write-Host "  4. cd .. && .\upload-model-to-s3.ps1"
