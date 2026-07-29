const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const contractSource = read('utils/pattern/patternTrainingContract.js')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ')
const sandbox = { console, JSON, Object, Array, Set, Map, String, Number, Boolean, RegExp }
vm.runInNewContext(`${contractSource}\nthis.contract = { normalizePatternTrainingInput, normalizePatternTrainingOutput, buildPatternRevisionDiff, evaluatePatternTrainingEligibility, buildPatternAutomaticMetrics, validatePatternBlindReview, evaluatePatternCandidateGates }`, sandbox)
const contract = sandbox.contract

const normalized = contract.normalizePatternTrainingInput({
  inputType: 'garment_photo', garmentCategory: 'shirt', frontImageAssetId: 'asset_front', backImageAssetId: 'asset_back',
  bodyMeasurements: { bust: 88 }, garmentMeasurements: {}, baseSize: 'M', structureOptions: { collar: 'shirt' }
})
assert.strictEqual(normalized.frontImageAssetId, 'asset_front')
assert.strictEqual(normalized.garmentCategory, 'shirt')
assert.strictEqual(normalized.bodyMeasurements.bust, 88)

const diff = contract.buildPatternRevisionDiff(
  { patternPieces: [{ partCode: 'front', quantity: 1 }], sizeSpecs: [{ baseSize: 'M', values: { bust: 90 } }] },
  { patternPieces: [{ partCode: 'front', quantity: 2 }, { partCode: 'back', quantity: 1 }], sizeSpecs: [{ baseSize: 'M', values: { bust: 92 } }] }
)
assert.strictEqual(diff.changeCount, 3)
assert.strictEqual(contract.evaluatePatternTrainingEligibility({ consentStatus: 'granted', reviewStatus: 'approved', patternId: 'p1', versionId: 'v2', hasAiDraft: true, hasHumanRevision: true, sourceKnown: true }).eligible, true)
assert.strictEqual(contract.evaluatePatternTrainingEligibility({ consentStatus: 'withdrawn', reviewStatus: 'approved' }).eligible, false)

const automatic = contract.buildPatternAutomaticMetrics(
  { patternPieces: [{ partCode: 'front' }, { partCode: 'back' }], sizeSpecs: [{ baseSize: 'M', values: { bust: 91, length: 60 } }], constructionNotes: '四线包缝' },
  { patternPieces: [{ partCode: 'front' }, { partCode: 'back' }], sizeSpecs: [{ baseSize: 'M', values: { bust: 90, length: 60 } }], constructionNotes: '四线包缝' }
)
assert.strictEqual(automatic.partF1, 1)
assert.strictEqual(automatic.sizeWithinToleranceRate, 1)
assert.strictEqual(automatic.sizeMeanAbsoluteError, 0.5)
assert.strictEqual(contract.validatePatternBlindReview({ scores: { structureAccuracy: 5, sizeAccuracy: 4, partAccuracy: 5, constructionAccuracy: 4 } }).ok, true)
assert.strictEqual(contract.validatePatternBlindReview({ scores: { structureAccuracy: 5 } }).ok, false)
assert.strictEqual(contract.evaluatePatternCandidateGates({ automatic: { outputCompleteRate: 1, partF1: 0.9, sizeWithinToleranceRate: 0.95 }, humanScores: { structureAccuracy: 4, sizeAccuracy: 4, partAccuracy: 4, constructionAccuracy: 4 } }, { categoryCount: 6, resultCoverage: 1, reviewCoverage: 1 }).passed, true)

const cloud = read('cloudfunctions/pattern_training/index.js')
assert(cloud.includes("status: 'registered_not_trained'"), 'model registration must not claim training')
assert(cloud.includes('trainingExecuted: false'), 'training execution must remain false')
assert(cloud.includes("reviewStatus !== 'approved'"), 'only approved versions are eligible')
assert(cloud.includes("consent.status !== 'granted'"), 'explicit consent is required')
assert(cloud.includes('HUMAN_REVISION_REQUIRED'), 'an independent human revision is required')
assert(cloud.includes('SOURCE_ASSET_REFERENCE_REQUIRED'), 'a stable source asset reference is required')
assert(cloud.includes("authorizationStatus: 'withdrawn'"), 'withdrawal invalidates future sample use')
assert(cloud.includes('ownerUserId'), 'consent is checked against the pattern owner')
assert(cloud.includes("datasetType: 'evaluation'"), 'fixed evaluation datasets are explicit')
assert(cloud.includes('EVALUATION_LINEAGE_CONFLICT') && cloud.includes('TRAINING_LINEAGE_CONFLICT'), 'training and evaluation lineages cannot overlap')
assert(cloud.includes("status: 'awaiting_external_results'"), 'evaluation runs wait for external real outputs')
assert(cloud.includes('recordEvaluationResult') && cloud.includes('automaticMetrics'), 'per-sample results produce deterministic metrics')
assert(cloud.includes('recordBlindReview') && cloud.includes('INDEPENDENT_REVIEWER_REQUIRED'), 'blind reviews require an independent reviewer')
assert(cloud.includes('candidate_not_active') && cloud.includes("deploymentStatus: 'not_deployed'"), 'candidate selection never deploys a model')
assert(!cloud.includes('activate_model:'), 'model activation is not exposed')
assert(!/Math\.min\(9[0246]|readyRate/.test(cloud), 'cloud evaluation must not fabricate metrics')
assert(!/eventInput\.(openId|openid|_openid|userId|role|isAdmin)/.test(cloud), 'client identity is not trusted')

const review = read('cloudfunctions/pattern_review/index.js')
assert(review.includes('enterprise_pattern_revision_diffs'), 'review revisions persist structured diffs')
assert(review.includes('fromVersionId') && review.includes('toVersionId'), 'diff trace links both versions')

const page = read('package-ai/pattern-training-center/pattern-training-center.vue')
const pages = read('pages.json')
assert(page.includes('不代表已经完成模型训练或上线'))
assert(page.includes('固定制版评测集'))
assert(page.includes('打版师盲评'))
assert(page.includes('不会生成假成绩'))
assert(page.includes('已标记候选版本，未部署'))
assert(pages.includes('pattern-training-center/pattern-training-center'))
const sampleList = read('package-ai/sample-order-list/sample-order-list.vue')
const sampleDetail = read('package-ai/sample-order-detail/sample-order-detail.vue')
const enterpriseMenu = read('utils/enterprise-web/enterpriseWebMenu.js')
assert(!sampleList.includes('openProductionList') && sampleList.includes('联系人工打样'), 'factory order center is hidden from sample list')
assert(!sampleDetail.includes('openProduction') && sampleDetail.includes('联系人工打样'), 'automatic production handoff is hidden from sample detail')
assert(!enterpriseMenu.includes("key: 'factories'"), 'factory collaboration is hidden from the enterprise menu')

const localCenter = read('utils/workspace/workspacePatternTrainingCenter.js')
assert(localCenter.includes('never synthesize quality metrics'))
assert(localCenter.includes('training_execution_not_implemented'))

console.log('pattern training data smoke: PASS')
