# Build and push the SageMaker MME inference container to your ECR.
# Run from the layer3-behavioral-fraud/ directory:
#   .\scripts\build_push_ecr.ps1

$ErrorActionPreference = "Stop"

$ACCOUNT  = "940278683083"
$REGION   = "ap-southeast-1"
$REPO     = "layer3/sklearn"
$TAG      = "latest"
$ECR_URI  = "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/${REPO}:${TAG}"
$AWS      = "C:\Program Files\Amazon\AWSCLIV2\aws.exe"

Write-Host "==> Ensuring ECR repository exists..."
& $AWS ecr describe-repositories --repository-names $REPO --region $REGION 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "    Repository not found, creating $REPO ..."
    & $AWS ecr create-repository --repository-name $REPO --region $REGION
}

Write-Host "==> Authenticating Docker to ECR..."
& $AWS ecr get-login-password --region $REGION | `
    docker login --username AWS --password-stdin "$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"

Write-Host "==> Building image..."
docker build -t "layer3-sklearn:$TAG" -f scripts/Dockerfile.inference scripts/
if ($LASTEXITCODE -ne 0) { Write-Error "docker build failed"; exit 1 }

Write-Host "==> Tagging image as $ECR_URI ..."
docker tag "layer3-sklearn:$TAG" $ECR_URI
if ($LASTEXITCODE -ne 0) { Write-Error "docker tag failed"; exit 1 }

Write-Host "==> Pushing to ECR..."
docker push $ECR_URI
if ($LASTEXITCODE -ne 0) { Write-Error "docker push failed"; exit 1 }

Write-Host ""
Write-Host "Done. Image pushed to: $ECR_URI"
Write-Host "Next step: python -m scripts.deploy_endpoint"
