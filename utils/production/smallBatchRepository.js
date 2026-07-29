import { callSmallBatchProduction } from './smallBatchTransport.js'

export function createSmallBatchDraft(input = {}) { return callSmallBatchProduction('create_draft', input) }
export function listSmallBatchOrders(filters = {}) { return callSmallBatchProduction('list', filters) }
export function getSmallBatchOrder(productionOrderId = '') { return callSmallBatchProduction('get', { productionOrderId }) }
export function sendSmallBatchInquiry(input = {}) { return callSmallBatchProduction('send_inquiry', input) }
export function submitSmallBatchQuote(input = {}) { return callSmallBatchProduction('submit_quote', input) }
export function confirmSmallBatchQuote(productionOrderId = '') { return callSmallBatchProduction('confirm_quote', { productionOrderId }) }
export function startSmallBatchMaterial(productionOrderId = '') { return callSmallBatchProduction('start_material', { productionOrderId }) }
export function confirmSmallBatchMaterial(input = {}) { return callSmallBatchProduction('confirm_material', input) }
export function scheduleSmallBatchProduction(input = {}) { return callSmallBatchProduction('schedule_production', input) }
export function startSmallBatchProduction(input = {}) { return callSmallBatchProduction('start_production', input) }
export function recordSmallBatchProgress(input = {}) { return callSmallBatchProduction('record_progress', input) }
export function submitSmallBatchQuality(input = {}) { return callSmallBatchProduction('submit_quality', input) }
export function recordSmallBatchQuality(input = {}) { return callSmallBatchProduction('quality_result', input) }
export function submitSmallBatchDelivery(input = {}) { return callSmallBatchProduction('submit_delivery', input) }
export function completeSmallBatchOrder(input = {}) { return callSmallBatchProduction('complete', input) }
export function cancelSmallBatchOrder(input = {}) { return callSmallBatchProduction('cancel', input) }
