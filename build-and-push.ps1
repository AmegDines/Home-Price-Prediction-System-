# =============================================================================
# build-and-push.ps1 — Build & Push Containers to AWS ECR
# =============================================================================

param (
    [string]$Region = "ap-south-1",
    [string]$Tag = "v1",
    [string]$BackendUrl = ""
)

$ErrorActionPreference = "Stop"

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  Build & Push Images to Amazon ECR" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

# 0. Check if Docker daemon is running
Write-Host "Checking Docker daemon status..." -ForegroundColor Yellow
$dockerCheck = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Docker Desktop is not running on your computer!" -ForegroundColor Red
    Write-Host "Please open Docker Desktop from your Start menu and wait until it says 'Engine running'." -ForegroundColor Yellow
    exit 1
}

# 1. Get AWS Account ID
$AccountId = aws sts get-caller-identity --query Account --output text 2>$null
if (-not $AccountId) {
    Write-Error "AWS credentials not detected. Run 'aws configure' first."
    exit 1
}

$Registry = "$AccountId.dkr.ecr.$Region.amazonaws.com"
Write-Host "Registry: $Registry" -ForegroundColor Green

# 2. Get App Server Public IP (if BackendUrl is not specified)
if ([string]::IsNullOrWhiteSpace($BackendUrl)) {
    if (Test-Path "terraform") {
        Push-Location "terraform"
        try {
            $AppIp = (terraform output -raw app_server_public_ip 2>$null)
            if ($AppIp) {
                $BackendUrl = "http://${AppIp}:8000"
            }
        } catch {
            $BackendUrl = "http://localhost:8000"
        }
        Pop-Location
    }
}
if ([string]::IsNullOrWhiteSpace($BackendUrl)) {
    $BackendUrl = "http://localhost:8000"
}
Write-Host "Frontend will point to Backend API: $BackendUrl" -ForegroundColor Yellow

# 3. ECR Login
Write-Host "`n[1/4] Authenticating Docker with ECR..." -ForegroundColor Yellow
$loginPwd = (aws ecr get-login-password --region $Region).Trim()
$loginPwd | docker login --username AWS --password-stdin $Registry
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to authenticate Docker with AWS ECR."
    exit 1
}

# 4. Build & Push Backend
Write-Host "`n[2/4] Building and pushing Backend image ($Tag)..." -ForegroundColor Yellow
docker build -t "$Registry/home-price-backend:$Tag" -t "$Registry/home-price-backend:latest" -f server/Dockerfile server/
if ($LASTEXITCODE -ne 0) { Write-Error "Backend build failed."; exit 1 }

docker push "$Registry/home-price-backend:$Tag"
if ($LASTEXITCODE -ne 0) { Write-Error "Backend push failed."; exit 1 }

docker push "$Registry/home-price-backend:latest"
Write-Host "Backend image pushed successfully." -ForegroundColor Green

# 5. Build & Push Frontend
Write-Host "`n[3/4] Building and pushing Frontend image ($Tag)..." -ForegroundColor Yellow
docker build `
    --build-arg NEXT_PUBLIC_API_BASE_URL="$BackendUrl" `
    -t "$Registry/home-price-frontend:$Tag" `
    -t "$Registry/home-price-frontend:latest" `
    -f frontend/Dockerfile frontend/
if ($LASTEXITCODE -ne 0) { Write-Error "Frontend build failed."; exit 1 }

docker push "$Registry/home-price-frontend:$Tag"
if ($LASTEXITCODE -ne 0) { Write-Error "Frontend push failed."; exit 1 }

docker push "$Registry/home-price-frontend:latest"
Write-Host "Frontend image pushed successfully." -ForegroundColor Green

Write-Host "`n=====================================================" -ForegroundColor Green
Write-Host "  All images successfully pushed to ECR!" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "Backend:  $Registry/home-price-backend:$Tag"
Write-Host "Frontend: $Registry/home-price-frontend:$Tag"
