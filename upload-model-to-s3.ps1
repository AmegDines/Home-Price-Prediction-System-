# =============================================================================
# upload-model-to-s3.ps1
# Uploads local model artefacts to the S3 bucket created by Terraform.
#
# Usage:
#   .\upload-model-to-s3.ps1
#   .\upload-model-to-s3.ps1 -BucketName "my-custom-bucket"
# =============================================================================

param (
    [string]$BucketName = ""
)

$ErrorActionPreference = "Stop"

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  📦 Uploading Model Artefacts to Amazon S3" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# 1. Resolve bucket name
if ([string]::IsNullOrWhiteSpace($BucketName)) {
    Write-Host "Querying Terraform for model S3 bucket name..." -ForegroundColor Yellow
    Push-Location "terraform"
    try {
        $BucketName = (terraform output -raw model_s3_bucket 2>$null)
    } catch {
        $BucketName = ""
    }
    Pop-Location

    if ([string]::IsNullOrWhiteSpace($BucketName)) {
        $AccountId = (aws sts get-caller-identity --query Account --output text 2>$null)
        if (-not [string]::IsNullOrWhiteSpace($AccountId)) {
            $BucketName = "home-price-models-$AccountId"
        }
    }
}

if ([string]::IsNullOrWhiteSpace($BucketName)) {
    Write-Error "Could not determine S3 bucket name. Please pass -BucketName <name> or ensure terraform apply has succeeded."
    exit 1
}

Write-Host "Target S3 Bucket: s3://$BucketName" -ForegroundColor Green

# 2. Check local files
$ModelFiles = @("home_price_model.pkl", "location_encoder.pkl", "metrics.json")
foreach ($file in $ModelFiles) {
    $filePath = Join-Path "server\model" $file
    if (-not (Test-Path $filePath)) {
        if ($file -eq "metrics.json") {
            Write-Host "⚠️ Warning: $filePath not found (optional)." -ForegroundColor Yellow
            continue
        }
        Write-Error "Required model artefact not found: $filePath. Run model training first."
        exit 1
    }
    Write-Host "Uploading $file (size: $([math]::Round((Get-Item $filePath).Length / 1MB, 2)) MB)..." -ForegroundColor Yellow
    aws s3 cp $filePath "s3://$BucketName/$file"
}

Write-Host ""
Write-Host "✅ All model artefacts successfully uploaded to s3://$BucketName!" -ForegroundColor Green
