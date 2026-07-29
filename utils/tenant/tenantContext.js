import { getCurrentEnterprise, setCurrentContext } from '../auth/authRepository.js'

export const DEFAULT_ENTERPRISE_ID = 'default_enterprise'

export function getCurrentEnterpriseId() {
  return getCurrentEnterprise().enterpriseId || DEFAULT_ENTERPRISE_ID
}

export function setCurrentEnterpriseId(enterpriseId = '') {
  const id = String(enterpriseId || '').trim()
  if (!id) return getCurrentEnterpriseId()
  const current = getCurrentEnterprise()
  setCurrentContext({ enterprise: { ...current, enterpriseId: id } })
  return id
}

