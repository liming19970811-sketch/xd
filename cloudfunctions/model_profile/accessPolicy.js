function canAccessModelProfile(profile = {}, actor = {}, mode = 'read') {
  if (!profile.modelProfileId || !['active', 'archived'].includes(profile.status)) return false
  if (profile.scope === 'personal') return Boolean(actor.openId && profile.ownerId === actor.openId)
  if (profile.scope !== 'enterprise' || !actor.enterpriseId || profile.enterpriseId !== actor.enterpriseId || actor.memberStatus !== 'active') return false
  if (mode === 'read') return true
  return ['admin', 'designer', 'operator'].includes(String(actor.role || ''))
}

module.exports = { canAccessModelProfile }

