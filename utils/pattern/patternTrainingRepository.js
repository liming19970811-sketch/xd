import { callPatternTraining } from './patternTrainingTransport.js'

export function getPatternTrainingSummary() { return callPatternTraining('summary') }
export function setPatternTrainingConsent(granted) { return callPatternTraining('set_consent', { granted: granted === true }) }
export function createPatternTrainingSample(patternId, versionId) { return callPatternTraining('create_sample', { patternId, versionId }) }
export function createPatternTrainingDataset(input = {}) { return callPatternTraining('create_dataset', input) }
export function createPatternEvaluationDataset(input = {}) { return callPatternTraining('create_evaluation_dataset', input) }
export function registerPatternModel(input = {}) { return callPatternTraining('register_model', input) }
export function recordPatternModelEvaluation(input = {}) { return callPatternTraining('record_evaluation', input) }
export function createPatternEvaluationRun(input = {}) { return callPatternTraining('create_evaluation_run', input) }
export function recordPatternEvaluationResult(input = {}) { return callPatternTraining('record_evaluation_result', input) }
export function recordPatternBlindReview(input = {}) { return callPatternTraining('record_blind_review', input) }
export function completePatternEvaluationRun(evaluationRunId) { return callPatternTraining('complete_evaluation_run', { evaluationRunId }) }
export function selectPatternCandidateModel(evaluationRunId) { return callPatternTraining('select_candidate_model', { evaluationRunId }) }
