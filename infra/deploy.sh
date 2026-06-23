#!/usr/bin/env bash
# Azure Blob Storage 프로비저닝 스크립트
# DB는 Supabase 사용 (supabase.com에서 프로젝트 생성 후 DATABASE_URL 복사)
#
# 실행 전: az login && az account set --subscription <ID>
# 실행: bash infra/deploy.sh

set -euo pipefail

PROJECT="bgnavigator"
ENV="dev"
LOCATION="koreacentral"
RG="${PROJECT}-${ENV}-rg"

echo "▶ 리소스 그룹 생성: ${RG}"
az group create --name "${RG}" --location "${LOCATION}" --output none

echo "▶ Blob Storage 배포 중..."
DEPLOY_OUTPUT=$(az deployment group create \
  --resource-group "${RG}" \
  --template-file infra/main.bicep \
  --parameters projectName="${PROJECT}" env="${ENV}" location="${LOCATION}" \
  --output json)

STORAGE_CONN=$(echo "${DEPLOY_OUTPUT}" | jq -r '.properties.outputs.storageConnectionString.value')

echo ""
echo "✅ 완료. apps/api/.env에 아래 값을 추가하세요:"
echo ""
echo "AZURE_BLOB_CONNECTION_STRING=${STORAGE_CONN}"
echo "AZURE_BLOB_CONTAINER_NAME=rulebooks"
