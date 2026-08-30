/**
 * 字母档位徽章（唯一实现）：S/A/B/C/D 药丸。
 * 覆盖六种历史写法：grade-badge / badge-letter / wmetric-grade /
 * six-bar-grade-pill / tier-capsule（rating 专用走 RatingBadge）/ combat-tier-badge。
 * className 由调用方传入以保持各页面现有视觉；suffix 用于「B 级」这类带量词的展示。
 */
export function GradeBadge({
  grade,
  className,
  suffix,
}: {
  grade: string
  className?: string
  suffix?: string
}) {
  return <span className={className}>{grade}{suffix}</span>
}
