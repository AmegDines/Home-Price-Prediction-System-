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
Write-Host "  Uploading Model Artefacts to Amazon S3" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# 1. Resolve bucket name
if ([string]::IsNullOrWhiteSpace($BucketName)) {
    Write-Host "Querying Terraform for model S3 bucket name..." -ForegroundColor Yellow
    if (Test-Path "terraform") {
        Push-Location "terraform"
        try {
            $BucketName = (terraform output -raw model_s3_bucket 2>$null)
            if ($LASTEXITCODE -ne 0) {
                $BucketName = ""
            }
        } catch {
            $BucketName = ""
        }
        Pop-Location
    }

    if ([string]::IsNullOrWhiteSpace($BucketName)) {
        $AccountId = (aws sts get-caller-identity --query Account --output text 2>$null)
        if (-not [string]::IsNullOrWhiteSpace($AccountId)) {
            $BucketName = "home-price-models-$AccountId"
        }
    }
}

if ([string]::IsNullOrWhiteSpace($BucketName)) {
    Write-Error "Could not determine S3 bucket name. Please pass -BucketName 'bucket-name' or ensure terraform apply has completed."
    exit 1
}

Write-Host "Target S3 Bucket: s3://$BucketName" -ForegroundColor Green

# 2. Check local files
$ModelFiles = @("home_price_model.pkl", "location_encoder.pkl", "metrics.json")
foreach ($file in $ModelFiles) {
    $filePath = Join-Path "server\model" $file
    if (-not (Test-Path $filePath)) {
        if ($file -eq "metrics.json") {
            Write-Host "[WARN] $filePath not found (optional)." -ForegroundColor Yellow
            continue
        }
        Write-Error "Required model artefact not found: $filePath. Run model training first."
        exit 1
    }
    $fileItem = Get-Item $filePath
    $fileSizeMB = [math]::Round($fileItem.Length / 1MB, 2)
    Write-Host "Uploading $file (size: $fileSizeMB MB)..." -ForegroundColor Yellow
    aws s3 cp $filePath "s3://$BucketName/$file"
}

Write-Host ""
Write-Host "SUCCESS: All model artefacts uploaded to s3://$BucketName" -ForegroundColor Green
