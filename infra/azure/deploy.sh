#!/usr/bin/env bash
# First-time and repeat deployment of the Azure MVP.
#   1. terraform apply        - creates everything; the app runs a placeholder image on the very first run
#   2. az acr build           - builds the platform image inside Azure Container Registry (no local Docker needed)
#   3. terraform apply -var image=...  - points the app at the new image with its full configuration
# Requirements: az CLI (logged in), terraform >= 1.6, terraform.tfvars in this folder.
set -euo pipefail
cd "$(dirname "$0")"
TAG="${TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"

terraform init -input=false
if ! terraform state list 2>/dev/null | grep -q azurerm_container_registry.main; then
  echo "==> First run: provisioning infrastructure"
  terraform apply -input=false -auto-approve
fi

REGISTRY="$(terraform output -raw registry)"
IMAGE="${REGISTRY}/audit-platform:${TAG}"

echo "==> Building ${IMAGE} in Azure Container Registry"
az acr build --registry "${REGISTRY%%.*}" --image "audit-platform:${TAG}" ../..

echo "==> Deploying ${IMAGE}"
terraform apply -input=false -auto-approve -var "image=${IMAGE}"

echo "==> Ready: $(terraform output -raw app_url)"
