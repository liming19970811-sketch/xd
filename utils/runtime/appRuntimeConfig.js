// Compatibility entry. All runtime access, selection and submission policy lives in featureRuntimePolicy.
export {
  APP_STAGES,
  CAPABILITY_STATUSES,
  TEST_EXECUTION_MODES,
  buildTestTaskMetadata,
  canAccessFeature,
  canSelectExperimentalOption,
  canSubmitRealTask,
  getAppStage,
  getDisabledReason,
  getFeatureRuntimeBackendState,
  getFeatureRuntimePolicy,
  getRuntimeGenerationConfig,
  isDevelopment,
  isInternalDebugMode,
  isInternalTestAccount,
  isInternalTester,
  isProduction,
  isTesting,
  refreshFeatureRuntimeBackendState,
  resolveCapabilityStatus,
  setInternalRuntimeConfig
} from './featureRuntimePolicy'
