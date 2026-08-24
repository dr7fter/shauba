export type ShuabaFeatureFlag =
  | 'learningCenterV1'
  | 'learningEvidenceProjectionV1'
  | 'lowConfidenceGateV1'
  | 'nonPressureBatchGradingV1'
  | 'shadowRecommendationPlanV1'
  | 'rankedOnlyEloV1'
  | 'friendBroadcastsV1'

export type ShuabaFeatureFlags = Record<ShuabaFeatureFlag, boolean>

export const FEATURE_FLAG_STORAGE_KEY = 'shuaba_feature_flags_v1'

const FEATURE_FLAG_NAMES: ShuabaFeatureFlag[] = [
  'learningCenterV1',
  'learningEvidenceProjectionV1',
  'lowConfidenceGateV1',
  'nonPressureBatchGradingV1',
  'shadowRecommendationPlanV1',
  'rankedOnlyEloV1',
  'friendBroadcastsV1',
]

const defaultFeatureFlags: ShuabaFeatureFlags = {
  learningCenterV1: false,
  learningEvidenceProjectionV1: false,
  lowConfidenceGateV1: false,
  nonPressureBatchGradingV1: false,
  shadowRecommendationPlanV1: false,
  rankedOnlyEloV1: false,
  friendBroadcastsV1: false,
}

function parseFeatureFlagList(value: string | null | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
}

function getCompileTimeFlags(): Set<string> {
  return parseFeatureFlagList(import.meta.env.VITE_SHUABA_FEATURE_FLAGS)
}

function getDevelopmentStorageFlags(): Set<string> {
  if (!import.meta.env.DEV) return new Set()
  try {
    return parseFeatureFlagList(window.localStorage.getItem(FEATURE_FLAG_STORAGE_KEY))
  } catch {
    return new Set()
  }
}

function buildFeatureFlags(): ShuabaFeatureFlags {
  const enabled = new Set([...getCompileTimeFlags(), ...getDevelopmentStorageFlags()])
  return FEATURE_FLAG_NAMES.reduce<ShuabaFeatureFlags>(
    (flags, name) => {
      flags[name] = enabled.has(name)
      return flags
    },
    { ...defaultFeatureFlags },
  )
}

/**
 * Feature flags are intentionally evaluated once at app startup. In production,
 * only the compile-time VITE_SHUABA_FEATURE_FLAGS value is accepted; ordinary
 * localStorage cannot silently enable an unfinished feature.
 */
export const featureFlags: ShuabaFeatureFlags = Object.freeze(buildFeatureFlags())

export function isFeatureEnabled(flag: ShuabaFeatureFlag): boolean {
  return featureFlags[flag]
}

export function getFeatureFlags(): ShuabaFeatureFlags {
  return { ...featureFlags }
}
