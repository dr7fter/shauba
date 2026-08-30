import type { ReactNode } from 'react'

/**
 * 环形仪表（唯一实现）：背景圈 + 进度弧 + 中心数值。
 * 覆盖洞察页 WE 制胜评价 / Rating Pro 两处硬编码 SVG。
 * center 接收 ReactNode，由调用方决定数值格式（如 weScore/7.2 保留一位）。
 */
export function Gauge({
  percent,
  progressColor,
  center,
  title,
  size = 104,
  strokeWidth = 8,
  trackColor = 'var(--line)',
  progressClassName,
}: {
  percent: number
  progressColor?: string
  center: ReactNode
  title?: string
  size?: number
  strokeWidth?: number
  trackColor?: string
  progressClassName?: string
}) {
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const safe = Number.isFinite(percent) ? percent : 0
  const dash = Math.min(circumference, Math.max(10, (safe / 100) * circumference))
  return (
    <div className="ring-gauge-svg-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={progressClassName}
        />
      </svg>
      <div className="ring-gauge-center">{center}</div>
    </div>
  )
}
