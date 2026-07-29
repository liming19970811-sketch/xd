const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const contractSource = read('utils/pattern/patternTrainingContract.js')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ')
const sandbox = { JSON, Object, Array, Set, Map, String, Number, Boolean, RegExp, console }
vm.runInNewContext(`${contractSource}\nthis.api = { buildPatternAutomaticMetrics, validatePatternBlindReview, evaluatePatternCandidateGates }`, sandbox)

const candidate = {
  patternPieces: [{ partCode: 'front' }, { partCode: 'back' }, { partCode: 'sleeve' }],
  sizeSpecs: [{ baseSize: 'M', values: { bust: 91, length: 61, shoulder: 39 } }],
  constructionNotes: '四线包缝，领口包边'
}
const approved = {
  patternPieces: [{ partCode: 'front' }, { partCode: 'back' }, { partCode: 'sleeve' }],
  sizeSpecs: [{ baseSize: 'M', values: { bust: 90, length: 60, shoulder: 39 } }],
  constructionNotes: '四线包缝，领口包边'
}
const metrics = sandbox.api.buildPatternAutomaticMetrics(candidate, approved)
assert.strictEqual(metrics.partF1, 1)
assert.strictEqual(metrics.sizeWithinToleranceRate, 1)
assert.strictEqual(metrics.outputComplete, true)

const review = sandbox.api.validatePatternBlindReview({ scores: { structureAccuracy: 4, sizeAccuracy: 5, partAccuracy: 4, constructionAccuracy: 4 } })
assert.strictEqual(review.ok, true)
assert.strictEqual(sandbox.api.validatePatternBlindReview({ scores: { structureAccuracy: 4 } }).errorCode, 'BLIND_REVIEW_SCORES_REQUIRED')

const gate = sandbox.api.evaluatePatternCandidateGates({ automatic: { ...metrics, outputCompleteRate: 1 }, humanScores: review.review.scores }, { categoryCount: 6, resultCoverage: 1, reviewCoverage: 1 })
assert.strictEqual(gate.passed, true)
assert.strictEqual(sandbox.api.evaluatePatternCandidateGates({ automatic: { ...metrics, outputCompleteRate: 1 }, humanScores: review.review.scores }, { categoryCount: 5, resultCoverage: 1, reviewCoverage: 1 }).passed, false)
assert.strictEqual(sandbox.api.evaluatePatternCandidateGates({ automatic: { ...metrics, outputCompleteRate: 0.9 }, humanScores: review.review.scores }, { categoryCount: 6, resultCoverage: 1, reviewCoverage: 1 }).passed, false)

const cloud = read('cloudfunctions/pattern_training/index.js')
const repository = read('utils/pattern/patternTrainingRepository.js')
const page = read('package-ai/pattern-training-center/pattern-training-center.vue')

;[
  'create_evaluation_dataset',
  'create_evaluation_run',
  'record_evaluation_result',
  'record_blind_review',
  'complete_evaluation_run',
  'select_candidate_model'
].forEach((action) => assert(cloud.includes(action), `missing cloud action: ${action}`))

assert(cloud.includes('lineageRootId'))
assert(cloud.includes("splitRuleVersion: 'pattern-lineage-split-v1'"))
assert(cloud.includes('EVALUATION_CATEGORY_COVERAGE_REQUIRED'))
assert(cloud.includes('SAMPLE_AUTHORIZATION_REQUIRED'))
assert(cloud.includes('INDEPENDENT_REVIEWER_REQUIRED'))
assert(cloud.includes('BLIND_REVIEW_NOT_READY'))
assert(cloud.includes("status: 'awaiting_blind_review'"))
assert(cloud.includes('canReview && !canManage'))
assert(cloud.includes("deploymentStatus: 'not_deployed'"))
assert(!cloud.includes('deploy_candidate_model'))

assert(repository.includes('createPatternEvaluationDataset'))
assert(repository.includes('recordPatternEvaluationResult'))
assert(repository.includes('recordPatternBlindReview'))
assert(page.includes('固定制版评测集'))
assert(page.includes('打版师盲评'))
assert(page.includes('隐藏模型、提示词和解析器信息'))

console.log('pattern model evaluation smoke: PASS')
