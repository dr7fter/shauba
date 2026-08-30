import type { ReactNode } from 'react'

export type RadarDimension = {
  key: string
  label: string
  value: number
}

type RadarProps = {
  dimensions: RadarDimension[]
  width: number
  height: number
  cx: number
  cy: number
  radius: number
  labelRadius: number
  gridScales?: number[]
  /** 网格环样式：未提供的字段省略属性，由 gridClassName 的 CSS 规则接管 */
  gridStroke?: string
  gridOuterStrokeWidth?: number
  gridInnerStrokeWidth?: number
  gridInnerDash?: string
  gridOuterOpacity?: number
  gridInnerOpacity?: number
  gridClassName?: string
  axisStroke?: string
  axisOpacity?: number
  axisClassName?: string
  shapeFill?: string
  shapeFillOpacity?: number
  shapeStroke?: string
  shapeStrokeWidth?: number
  shapeClassName?: string
  dotVariant?: 'simple' | 'ring'
  dotRadius?: number
  dotColor?: string
  dotSurfaceColor?: string
  dotFill?: string
  dotClassName?: string
  labelAnchorMode?: 'center' | 'smart'
  labelFill?: string
  labelFontSize?: number
  labelFontWeight?: number | string
  labelClassName?: string
  className?: string
  role?: string
  ariaLabel?: string
  title?: string
  children?: ReactNode
}

/**
 * 六维雷达图（唯一实现）：几何（网格环/轴线/标签/形状/顶点）只在此处定义，
 * 视觉由调用方以内联主题或 CSS 类注入。取代 InsightsView 与 GradingReportModal
 * 各自手写、圆心半径网格档位互不相容的两套 SVG。
 */
export function Radar({
  dimensions,
  width,
  height,
  cx,
  cy,
  radius,
  labelRadius,
  gridScales = [25, 50, 75, 100],
  gridStroke,
  gridOuterStrokeWidth = 1.5,
  gridInnerStrokeWidth = 1,
  gridInnerDash,
  gridOuterOpacity,
  gridInnerOpacity,
  gridClassName,
  axisStroke,
  axisOpacity,
  axisClassName,
  shapeFill,
  shapeFillOpacity,
  shapeStroke,
  shapeStrokeWidth,
  shapeClassName,
  dotVariant = 'simple',
  dotRadius = 3.5,
  dotColor,
  dotSurfaceColor,
  dotFill,
  dotClassName,
  labelAnchorMode = 'center',
  labelFill,
  labelFontSize,
  labelFontWeight,
  labelClassName,
  className,
  role,
  ariaLabel,
  title,
  children,
}: RadarProps) {
  const count = dimensions.length
  const point = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count
    return {
      x: cx + Math.cos(angle) * radius * (value / 100),
      y: cy + Math.sin(angle) * radius * (value / 100),
    }
  }
  const outerScale = Math.max(...gridScales)

  const gridProps = (scale: number) => {
    const isOuter = scale === outerScale
    const props: Record<string, unknown> = { className: gridClassName }
    if (gridStroke !== undefined) props.stroke = gridStroke
    if (isOuter) {
      if (gridOuterStrokeWidth !== undefined) props.strokeWidth = gridOuterStrokeWidth
      if (gridOuterOpacity !== undefined) props.opacity = gridOuterOpacity
    } else {
      if (gridInnerStrokeWidth !== undefined) props.strokeWidth = gridInnerStrokeWidth
      if (gridInnerDash !== undefined) props.strokeDasharray = gridInnerDash
      if (gridInnerOpacity !== undefined) props.opacity = gridInnerOpacity
    }
    return props
  }

  const labelFor = (dim: RadarDimension, index: number) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count
    const pt = {
      x: cx + Math.cos(angle) * labelRadius,
      y: cy + Math.sin(angle) * labelRadius,
    }
    let anchor: 'middle' | 'start' | 'end' = 'middle'
    let xOffset = 0
    if (labelAnchorMode === 'smart') {
      const cos = Math.cos(angle)
      anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle'
      xOffset = anchor === 'start' ? 2 : anchor === 'end' ? -2 : 0
    }
    return (
      <text
        key={`${dim.key}-label`}
        x={pt.x + xOffset}
        y={pt.y}
        textAnchor={anchor}
        dominantBaseline={labelAnchorMode === 'smart' ? 'central' : undefined}
        fontSize={labelFontSize}
        fontWeight={labelFontWeight}
        fill={labelFill}
        className={labelClassName}
      >
        {dim.label}
      </text>
    )
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} role={role} aria-label={ariaLabel}>
      {title && <title>{title}</title>}
      {children}
      {gridScales.map((scale) => (
        <polygon
          key={scale}
          points={dimensions.map((_, i) => {
            const pt = point(i, scale)
            return `${pt.x},${pt.y}`
          }).join(' ')}
          fill="none"
          {...gridProps(scale)}
        />
      ))}
      {dimensions.map((_, i) => {
        const end = point(i, 100)
        const axisProps: Record<string, unknown> = { className: axisClassName }
        if (axisStroke !== undefined) axisProps.stroke = axisStroke
        if (axisOpacity !== undefined) axisProps.opacity = axisOpacity
        return (
          <line
            key={`axis-${i}`}
            x1={cx}
            y1={cy}
            x2={end.x}
            y2={end.y}
            strokeWidth={gridInnerStrokeWidth}
            {...axisProps}
          />
        )
      })}
      <polygon
        points={dimensions.map((dim, i) => {
          const pt = point(i, dim.value)
          return `${pt.x},${pt.y}`
        }).join(' ')}
        fill={shapeFill}
        fillOpacity={shapeFillOpacity}
        stroke={shapeStroke}
        strokeWidth={shapeStrokeWidth}
        strokeLinejoin="round"
        className={shapeClassName}
      />
      {dimensions.map((dim, i) => {
        const pt = point(i, dim.value)
        if (dotVariant === 'ring') {
          return (
            <g key={`${dim.key}-dot`}>
              <circle
                cx={pt.x}
                cy={pt.y}
                r={4.5}
                fill={dotSurfaceColor}
                stroke={dotColor}
                strokeWidth={2}
                className={dotClassName}
              />
              <circle cx={pt.x} cy={pt.y} r={2} fill={dotColor} />
            </g>
          )
        }
        return (
          <circle
            key={`${dim.key}-dot`}
            cx={pt.x}
            cy={pt.y}
            r={dotRadius}
            fill={dotFill}
            className={dotClassName}
          />
        )
      })}
      {dimensions.map((dim, i) => labelFor(dim, i))}
    </svg>
  )
}
