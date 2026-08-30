import { csRatingAccent, csRatingTier, type CsRatingTier } from '../../utils'

/**
 * CS rating 档位徽章（唯一实现）：≥2.00 👑 DONK、其余按 csRatingTier 档位展示。
 * 此前档位判定散落在报告弹窗内联（≥2.0/≥1.35 硬编码），现在统一走 csRatingAccent。
 */
export function RatingBadge({
  value,
  tier,
  className = 'tier-capsule',
}: {
  value: number
  tier?: CsRatingTier | null
  className?: string
}) {
  const accent = csRatingAccent(value)
  const resolvedTier = tier ?? csRatingTier(value) ?? 'D'
  return (
    <b className={`${className} ${accent === 'donk' ? 'donk-tier' : ''}`.trim()}>
      {accent === 'donk' ? '👑 DONK' : `${resolvedTier} 级`}
    </b>
  )
}
