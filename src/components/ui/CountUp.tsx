import { useEffect, useRef, useState } from 'react'

/**
 * 数字滚动（多巴胺机制 ④）：数值变化用 300-400ms 缓动滚出，而非瞬间跳变。
 * animateOnMount 用于「从 0 揭晓」场景（如高光 rating 揭牌）。
 */
export function CountUp({
  value,
  decimals = 0,
  duration = 420,
  animateOnMount = false,
  className,
  style,
}: {
  value: number
  decimals?: number
  duration?: number
  animateOnMount?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const [display, setDisplay] = useState(animateOnMount ? 0 : value)
  const fromRef = useRef(animateOnMount ? 0 : value)

  useEffect(() => {
    const from = fromRef.current
    if (from === value) return
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (value - from) * eased)
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        fromRef.current = value
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      fromRef.current = value
    }
  }, [value, duration])

  return (
    <span className={className} style={style}>
      {display.toFixed(decimals)}
    </span>
  )
}
