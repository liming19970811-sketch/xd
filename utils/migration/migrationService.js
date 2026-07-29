import localProvider from '../data-provider/localProvider.js'

const STORAGE_KEYS = Object.freeze({
  enterprises: 'diebiandesign_enterprise_team_v1',
  projects: 'diebiandesign_projects',
  products: 'diebiandesign_product_packages',
  commerce: 'diebiandesign_enterprise_commerce_v1',
  deliveries: 'diebi_workspace_delivery_v1',
  audit: 'diebiandesign_enterprise_audit_logs_v1'
})

function asArray(value, key = '') {
  if (Array.isArray(value)) return value
  if (value && key && Array.isArray(value[key])) return value[key]
  return []
}

function getEnterpriseRecords(value) {
  if (Array.isArray(value)) return value
  if (value && Array.isArray(value.enterprises)) return value.enterprises
  return value && typeof value === 'object' && Object.keys(value).length ? [value] : []
}

function readSnapshot() {
  const enterpriseValue = localProvider.get(STORAGE_KEYS.enterprises, null)
  const commerceValue = localProvider.get(STORAGE_KEYS.commerce, {})
  const deliveryValue = localProvider.get(STORAGE_KEYS.deliveries, [])
  return {
    enterprises: getEnterpriseRecords(enterpriseValue),
    projects: asArray(localProvider.get(STORAGE_KEYS.projects, [])),
    products: asArray(localProvider.get(STORAGE_KEYS.products, [])),
    quotes: asArray(commerceValue, 'quotes'),
    orders: asArray(commerceValue, 'orders'),
    deliveries: asArray(deliveryValue, 'deliveries'),
    audits: asArray(localProvider.get(STORAGE_KEYS.audit, []), 'auditLogs')
  }
}

export function inspectLegacyData() {
  const snapshot = readSnapshot()
  const counts = {
    enterpriseCount: snapshot.enterprises.length,
    memberCount: snapshot.enterprises.reduce((total, item) => total + asArray(item?.members).length, 0),
    projectCount: snapshot.projects.length,
    productCount: snapshot.products.length,
    orderCount: snapshot.orders.length,
    deliveryCount: snapshot.deliveries.length
  }
  return {
    hasLegacyData: Object.values(counts).some((count) => count > 0),
    counts,
    storageKeys: { ...STORAGE_KEYS }
  }
}

export function generateMigrationReport() {
  const inspection = inspectLegacyData()
  return {
    reportId: `migration_report_${Date.now()}`,
    status: inspection.hasLegacyData ? 'ready' : 'empty',
    source: 'local',
    target: 'cloud',
    dryRun: true,
    generatedAt: new Date().toISOString(),
    ...inspection
  }
}

export const checkLegacyData = inspectLegacyData

export function buildCloudMigrationPlan() {
  const snapshot = readSnapshot()
  const unsupportedCounts = {
    productPackageCount: snapshot.products.length,
    quoteCount: snapshot.quotes.length,
    orderCount: snapshot.orders.length,
    deliveryCount: snapshot.deliveries.length,
    auditCount: snapshot.audits.length
  }
  const warnings = ['Cloud Provider Alpha 仅支持企业、成员和项目，计划不会执行任何云写入。']
  const unsupportedTotal = Object.values(unsupportedCounts).reduce((total, count) => total + count, 0)
  if (unsupportedTotal) warnings.push(`有 ${unsupportedTotal} 条暂不支持的数据将被跳过。`)
  const missingTenantCount = [...snapshot.enterprises, ...snapshot.projects]
    .filter((item) => item && !item.enterpriseId).length
  if (missingTenantCount) warnings.push(`有 ${missingTenantCount} 条旧数据缺少 enterpriseId，迁移前需归属默认企业。`)
  return {
    planId: `cloud_migration_plan_${Date.now()}`,
    enterpriseCount: snapshot.enterprises.length,
    memberCount: snapshot.enterprises.reduce((total, item) => total + asArray(item?.members).length, 0),
    projectCount: snapshot.projects.length,
    unsupportedCounts,
    warnings,
    dryRun: true,
    source: 'local',
    target: 'cloud_alpha',
    generatedAt: new Date().toISOString()
  }
}
