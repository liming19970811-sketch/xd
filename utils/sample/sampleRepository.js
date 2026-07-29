import { listFactories } from '../service/factoryService.js'
import { callSampleWorkflow } from './sampleTransport.js'

export function getSampleFactoryOptions() {
  return listFactories({ status: 'active' })
    .filter((item) => item.verificationStatus === 'verified')
    .map((item) => ({ factoryId: item.factoryId, name: item.name, shortName: item.shortName || item.name, region: item.region || '' }))
}
export function createSampleDraft(input = {}) { return callSampleWorkflow('create_draft', input) }
export function updateSampleDraft(input = {}) { return callSampleWorkflow('update_draft', input) }
export function listSampleOrders(filters = {}) { return callSampleWorkflow('list', filters) }
export function getSampleOrder(sampleOrderId = '') { return callSampleWorkflow('get', { sampleOrderId }) }
export function submitSampleOrder(sampleOrderId = '') { return callSampleWorkflow('submit', { sampleOrderId }) }
export function acceptSampleOrder(sampleOrderId = '') { return callSampleWorkflow('accept', { sampleOrderId }) }
export function completeSampleRound(input = {}) { return callSampleWorkflow('complete_sample', input) }
export function submitSampleForReview(sampleOrderId = '') { return callSampleWorkflow('submit_review', { sampleOrderId }) }
export function requestSampleChanges(input = {}) { return callSampleWorkflow('request_changes', input) }
export function startSampleResampling(input = {}) { return callSampleWorkflow('start_resampling', input) }
export function resolveSampleIssue(input = {}) { return callSampleWorkflow('resolve_issue', input) }
export function confirmSampleOrder(input = {}) { return callSampleWorkflow('confirm', input) }
export function cancelSampleOrder(input = {}) { return callSampleWorkflow('cancel', input) }
