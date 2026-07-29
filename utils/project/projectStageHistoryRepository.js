import { getDataProviderName } from '../data-provider/dataProvider.js'
import { getCurrentEnterpriseContext, readLocalStorage, writeLocalStorage } from '../repository/enterpriseRepository.js'
import { filterTenantData, protectTenantCreate, resolveTenantId } from '../tenant/tenantGuard.js'
import { getCurrentEnterpriseId } from '../tenant/tenantContext.js'
import { getProjectStageLabel, normalizeProjectStage } from './projectStage.js'

const STORAGE_KEY = 'project_stage_history'

function nowIso() {
  return new Date().toISOString()
}

function readStore() {
  const value = readLocalStorage(STORAGE_KEY, [])
  return Array.isArray(value) ? value : []
}

function writeStore(records = []) {
  return writeLocalStorage(STORAGE_KEY, records)
}

export function normalizeStageHistory(record = {}, options = {}) {
  const context = options.enterpriseId ? options : getCurrentEnterpriseContext()
  const createdAt = record.createdAt || nowIso()
  const fromStage = normalizeProjectStage(record.fromStage)
  const toStage = normalizeProjectStage(record.toStage)
  return {
    historyId: record.historyId || `stage_history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    enterpriseId: record.enterpriseId || context.enterpriseId || getCurrentEnterpriseId(),
    projectId: String(record.projectId || '').trim(),
    fromStage,
    toStage,
    fromStageLabel: getProjectStageLabel(fromStage),
    toStageLabel: getProjectStageLabel(toStage),
    operatorMemberId: record.operatorMemberId || '',
    operatorName: record.operatorName || '',
    createdAt,
    dataSource: record.dataSource || getDataProviderName()
  }
}

export function listStageHistory(projectId = '') {
  const normalizedProjectId = String(projectId || '').trim()
  return filterTenantData(readStore(), getCurrentEnterpriseId())
    .map((item) => normalizeStageHistory(item))
    .filter((item) => !normalizedProjectId || item.projectId === normalizedProjectId)
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
}

export function createStageHistory(input = {}) {
  const context = getCurrentEnterpriseContext()
  const protectedInput = protectTenantCreate(input, context.enterpriseId)
  if (!protectedInput || !protectedInput.projectId) return null
  const record = normalizeStageHistory(protectedInput, context)
  const records = readStore()
  writeStore([
    record,
    ...records.filter((item) => item.historyId !== record.historyId || resolveTenantId(item) !== context.enterpriseId)
  ])
  return record
}
