const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
const { normalizePatternSearchRequest, scorePatternCandidate } = require(path.join(ROOT, 'cloudfunctions/pattern_review/patternSearch.js'))

const request = normalizePatternSearchRequest({
  garmentCategory: 'shirt', audience: 'women', style: 'commuter', fitType: 'regular', neckType: 'shirt_collar', sleeveType: 'long',
  lengthType: 'regular', baseSize: 'M', materialProperties: { type: 'cotton', elasticity: 'low', thickness: 'medium' }, usageScene: 'commute', tags: ['基础款']
})
assert.strictEqual(request.scope, 'personal')
assert.strictEqual(request.pageSize, 12)
assert.strictEqual(request.enterpriseId, undefined)

const master = {
  patternMasterId: 'pattern_a', category: 'shirt', reviewStatus: 'approved', approvedVersionId: 'version_a', genderAge: 'women',
  taxonomy: { garmentCategory: 'shirt', audience: 'women', style: 'commuter', fitType: 'regular', neckType: 'shirt_collar', sleeveType: 'long', lengthType: 'regular', materialCompatibility: ['cotton'], usageScene: ['commute'] },
  tags: ['基础款']
}
const version = { versionId: 'version_a', reviewStatus: 'approved', sizeParams: { baseSize: 'M' }, aiDraft: { patternInput: { materialProperties: { type: 'cotton', elasticity: 'low', thickness: 'medium' } } } }
const exact = scorePatternCandidate(request, master, version, [{ baseSize: 'M' }])
assert(exact.score >= 95)
assert(exact.reasons.includes('服装品类一致'))
assert.strictEqual(exact.differences.length, 0)

const different = scorePatternCandidate(request, { ...master, taxonomy: { ...master.taxonomy, fitType: 'loose', neckType: 'round' } }, version, [{ baseSize: 'L' }])
assert(different.score < exact.score)
assert(different.differences.some((item) => item.field === 'fitType'))
assert(different.differences.some((item) => item.field === 'baseSize'))

const cloud = read('cloudfunctions/pattern_review/index.js')
;['search_library', 'library_get', 'derive_approved'].forEach((action) => assert(cloud.includes(action), `missing ${action}`))
assert(cloud.includes('APPROVED_PATTERN_REQUIRED'))
assert(cloud.includes('derivationKeyHash'))
assert(cloud.includes('parentPatternMasterId'))
assert(cloud.includes('lineageRootId'))
assert(cloud.includes("scope: 'personal'"))
assert(cloud.includes("enterpriseId: ctx.enterpriseId"))
assert(!cloud.includes('enterpriseId: data.enterpriseId'))

const repository = read('utils/pattern/patternLibraryRepository.js')
assert(repository.includes('searchApprovedPatternLibrary'))
assert(repository.includes('deriveApprovedPatternLibraryItem'))
assert(repository.includes('getCloudPatternLibraryDetail'))
const page = read('package-ai/pattern-library/pattern-library.vue')
assert(page.includes('智能检索条件'))
assert(page.includes('matchReasons'))
assert(page.includes('主要差异'))
assert(page.includes('deriveApprovedPatternLibraryItem'))

console.log('pattern smart reuse smoke: PASS')
