using './main.bicep'

param projectName = 'bgnavigator'
param env = 'dev'
param location = 'koreacentral'
param dbAdminPassword = readEnvironmentVariable('DB_ADMIN_PASSWORD')
