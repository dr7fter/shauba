import type { CSSProperties } from 'react'

/**
 * 横向进度条（唯一实现）：轨道 + 填充两层结构。
 * 覆盖四套历史写法（six-bar / firepower / report-dimension-row / progress-track）。
 * trackTag/fillTag 用于兼容既有 CSS 选择器（如 `.report-dimension-row i b`），
 * floor 用于保留某些条目的最小可见宽度（如六维条的 12%）。
 */
export function MetricBar({
  value,
  max = 100,
  floor = 0,
  trackClassName,
  fillClassName,
  trackTag: TrackTag = 'div',
  fillTag: FillTag = 'div',
  fillStyle,
  title,
}: {
  value: number
  max?: number
  floor?: number
  trackClassName?: string
  fillClassName?: string
  trackTag?: 'div' | 'i' | 'span'
  fillTag?: 'div' | 'b' | 'i' | 'span'
  fillStyle?: CSSProperties
  title?: string
}) {
  const safeMax = max > 0 ? max : 100
  const percent = Math.min(100, Math.max(floor, (value / safeMax) * 100))
  return (
    <TrackTag className={trackClassName} title={title}>
      <FillTag className={fillClassName} style={{ width: `${percent}%`, ...fillStyle }} />
    </TrackTag>
  )
}
