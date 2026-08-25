export type ShuabaFeatureFlag =
  | 'learningCenterV1'
  | 'learningEvidenceProjectionV1'
  | 'lowConfidenceGateV1'
  | 'nonPressureBatchGradingV1'
  | 'shadowRecommendationPlanV1'
  | 'rankedOnlyEloV1'
  | 'friendBroadcastsV1'
  | 'aiRecommendationV1'
  | 'recommendationValidatorV1'
  | 'learningGroupV1'

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
  'aiRecommendationV1',
  'recommendationValidatorV1',
  'learningGroupV1',
]

const defaultFeatureFlags: ShuabaFeatureFlags = {
  // v1.5.0 已完成人工验收的正式功能：生产安装包默认开启。
  learningCenterV1: true,
  learningEvidenceProjectionV1: true,
  lowConfidenceGateV1: true,
  nonPressureBatchGradingV1: true,
  shadowRecommendationPlanV1: true,
  // 尚未完成历史迁移与好友广播放量，继续保持关闭。
  rankedOnlyEloV1: false,
  friendBroadcastsV1: false,
  aiRecommendationV1: true,
  recommendationValidatorV1: true,
  learningGroupV1: true,
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
      flags[name] = flags[name] || enabled.has(name)
      return flags
    },
    { ...defaultFeatureFlags },
  )
}

/**
 * Feature flags are intentionally evaluated once at app startup. In production,
 * stable features are enabled by their production defaults. Compile-time flags may
 * additionally expose controlled features; ordinary localStorage remains DEV-only.
 */
export const featureFlags: ShuabaFeatureFlags = Object.freeze(buildFeatureFlags())

export function isFeatureEnabled(flag: ShuabaFeatureFlag): boolean {
  return featureFlags[flag]
}

export function getFeatureFlags(): ShuabaFeatureFlags {
  return { ...featureFlags }
}
