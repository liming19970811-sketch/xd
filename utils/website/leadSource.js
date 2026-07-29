export const WEBSITE_LEAD_SOURCE_TYPES = {
  ARTICLE: 'article',
  CASE: 'case',
  SERVICE_PLAN: 'service_plan',
  SOLUTION: 'enterprise_solution',
  TRUST: 'trust',
  WEBSITE: 'website'
}

function compactObject(value = {}) {
  return Object.keys(value).reduce((result, key) => {
    const item = value[key]
    if (item !== '' && item !== null && item !== undefined) {
      result[key] = item
    }
    return result
  }, {})
}

function getArray(value) {
  return Array.isArray(value) ? value : []
}

export function buildArticleInterest(article = {}) {
  return compactObject({
    leadSource: 'website_article',
    sourceType: WEBSITE_LEAD_SOURCE_TYPES.ARTICLE,
    sourceId: article.articleId || '',
    interestType: article.category ? `article:${article.category}` : 'article',
    interestSnapshot: compactObject({
      articleId: article.articleId || '',
      title: article.title || '',
      category: article.category || '',
      summary: article.summary || '',
      keywords: getArray(article.keywords),
      seoKeywords: getArray(article.seoKeywords),
      relatedSolutions: getArray(article.relatedSolutions),
      relatedCases: getArray(article.relatedCases)
    })
  })
}

export function buildCaseInterest(caseItem = {}) {
  return compactObject({
    leadSource: 'website_case',
    sourceType: WEBSITE_LEAD_SOURCE_TYPES.CASE,
    sourceId: caseItem.caseId || '',
    interestType: caseItem.category ? `case:${caseItem.category}` : 'case',
    interestSnapshot: compactObject({
      caseId: caseItem.caseId || '',
      title: caseItem.title || '',
      companyName: caseItem.companyName || '',
      category: caseItem.category || '',
      solutions: getArray(caseItem.solutions)
    })
  })
}

export function buildServicePlanInterest(plan = {}) {
  return compactObject({
    leadSource: 'website_service_plan',
    sourceType: WEBSITE_LEAD_SOURCE_TYPES.SERVICE_PLAN,
    sourceId: plan.planId || '',
    interestType: plan.planId ? `service_plan:${plan.planId}` : 'service_plan',
    interestSnapshot: compactObject({
      planId: plan.planId || '',
      name: plan.name || '',
      target: plan.target || '',
      priceText: plan.priceText || '',
      deliveryCycle: plan.deliveryCycle || '',
      services: getArray(plan.services),
      features: getArray(plan.features)
    })
  })
}

export function buildSolutionInterest(solution = {}) {
  return compactObject({
    leadSource: 'website_enterprise_solution',
    sourceType: WEBSITE_LEAD_SOURCE_TYPES.SOLUTION,
    sourceId: solution.id || '',
    interestType: solution.id ? `solution:${solution.id}` : 'enterprise_solution',
    interestSnapshot: compactObject({
      solutionId: solution.id || '',
      name: solution.name || '',
      desc: solution.desc || '',
      capabilityItems: getArray(solution.items),
      scopeValues: getArray(solution.scopeValues)
    })
  })
}

export function buildTrustInterest(item = {}) {
  return compactObject({
    leadSource: 'website_trust',
    sourceType: WEBSITE_LEAD_SOURCE_TYPES.TRUST,
    sourceId: item.trustId || '',
    interestType: item.type ? `trust:${item.type}` : 'trust',
    interestSnapshot: compactObject({
      trustId: item.trustId || '',
      title: item.title || '',
      type: item.type || '',
      description: item.description || ''
    })
  })
}

export function buildWebsiteInterest(form = {}) {
  return compactObject({
    leadSource: form.leadSource || 'website_direct',
    sourceType: form.sourceType || WEBSITE_LEAD_SOURCE_TYPES.WEBSITE,
    sourceId: form.sourceId || form.sourcePage || 'website-demand',
    interestType: form.interestType || form.demandType || 'website',
    interestSnapshot: form.interestSnapshot || {}
  })
}

export function buildLeadSnapshot({ form = {}, interest = {} } = {}) {
  const resolvedInterest = Object.keys(interest || {}).length ? interest : buildWebsiteInterest(form)
  return {
    leadSource: resolvedInterest.leadSource || form.leadSource || 'website_direct',
    sourceType: resolvedInterest.sourceType || form.sourceType || WEBSITE_LEAD_SOURCE_TYPES.WEBSITE,
    sourceId: resolvedInterest.sourceId || form.sourceId || form.sourcePage || 'website-demand',
    interestType: resolvedInterest.interestType || form.interestType || form.demandType || 'website',
    interestSnapshot: resolvedInterest.interestSnapshot || form.interestSnapshot || {},
    sourcePage: form.sourcePage || 'website-demand',
    sourceChannel: form.sourceChannel || 'website',
    demandType: form.demandType || '',
    serviceScope: getArray(form.serviceScope),
    productCategory: form.productCategory || '',
    expectedVolume: form.expectedVolume || '',
    expectedDeliveryTime: form.expectedDeliveryTime || ''
  }
}
