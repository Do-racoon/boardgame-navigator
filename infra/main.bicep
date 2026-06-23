@description('프로젝트 이름 (리소스 이름 prefix)')
param projectName string = 'bgnavigator'

@description('배포 환경')
@allowed(['dev', 'prod'])
param env string = 'dev'

@description('Azure 리전')
param location string = resourceGroup().location

var tags = { project: projectName, env: env }
var prefix = '${projectName}-${env}'

// ─── Azure Blob Storage (PDF 파일 저장) ──────────────────────────────────────
resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${replace(prefix, '-', '')}storage'
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storage
  name: 'default'
}

resource rulebooksContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'rulebooks'
  properties: { publicAccess: 'None' }
}

// ─── Outputs ──────────────────────────────────────────────────────────────────
// DB는 Supabase 사용 — Azure PostgreSQL 불필요
output storageConnectionString string = 'DefaultEndpointsProtocol=https;AccountName=${storage.name};AccountKey=${storage.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
