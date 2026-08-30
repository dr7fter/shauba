import { motion } from 'framer-motion'
import { useEffect } from 'react'
import type { AttemptHighlight } from '../types'

type KindMeta = {
  title: string
  subtitle: string
  color: string
  particles: boolean
  /** 全屏停留毫秒数，可随时点击跳过 */
  duration: number
}

const KIND_META: Record<AttemptHighlight['kind'], KindMeta> = {
  donk: {
    title: '👑 DONK',
    subtitle: '超神秒杀 · Rating 2.00+ 传说级',
    color: '#FFD700',
    particles: true,
    duration: 4500,
  },
  ace: {
    title: '⚡ ACE',
    subtitle: '高光作答 · Rating 1.80+',
    color: '#4CC38A',
    particles: false,
    duration: 3000,
  },
  s1mple: {
    title: '🔫 S1MPLE PLAY',
    subtitle: '压轴攻坚 · 大场面先生',
    color: '#58A6FF',
    particles: false,
    duration: 3000,
  },
  clutch: {
    title: '🎯 CLUTCH',
    subtitle: '残局翻盘 · 难题半倍基准拿下',
    color: '#E87722',
    particles: false,
    duration: 3000,
  },
  redeem: {
    title: '🔧 REDEEM',
    subtitle: '旧伤愈合 · 错题修复成功',
    color: '#4CC38A',
    particles: false,
    duration: 3000,
  },
  zywoo: {
    title: '🦢 ZYWOO PLAY',
    subtitle: '稳定之神 · 当日 12 连对',
    color: '#C297FF',
    particles: true,
    duration: 4500,
  },
}

/** DONK/ZYWOO 粒子迸射：固定角度扇形展开，确定性动画（无随机抖动） */
const PARTICLE_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]

/**
 * 高光时刻全屏事件（v1.7.0 阶段四）：rating 突破阈值时给一个「事件」而非一个数字。
 * 算法层由后端 detect_highlight 判定；这里只负责仪式感呈现。点击任意处可跳过。
 */
export function HighlightMoment({
  highlight,
  onDone,
}: {
  highlight: AttemptHighlight
  onDone: () => void
}) {
  const meta = KIND_META[highlight.kind] ?? KIND_META.ace

  useEffect(() => {
    const timer = window.setTimeout(onDone, meta.duration)
    return () => window.clearTimeout(timer)
  }, [highlight, meta.duration, onDone])

  return (
    <motion.div
      className="ui-overlay highlight-moment-overlay"
      role="alert"
      aria-label={`高光时刻 ${meta.title}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onDone}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 220,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10, 12, 18, 0.72)',
        backdropFilter: 'blur(6px)',
        cursor: 'pointer',
      }}
    >
      {meta.particles &&
        PARTICLE_ANGLES.map((angle, index) => (
          <motion.span
            key={angle}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{
              opacity: 0,
              x: Math.cos((angle * Math.PI) / 180) * 190,
              y: Math.sin((angle * Math.PI) / 180) * 190,
              scale: 0.2,
            }}
            transition={{ duration: 1.4, delay: index * 0.03, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: meta.color,
              boxShadow: `0 0 12px ${meta.color}`,
            }}
          />
        ))}

      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 14, stiffness: 260 }}
        style={{ position: 'relative', textAlign: 'center' }}
      >
        {/* 金边脉冲环 */}
        <motion.div
          animate={{ scale: [1, 1.18, 1], opacity: [0.55, 0.15, 0.55] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: -46,
            borderRadius: '50%',
            border: `3px solid ${meta.color}`,
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            width: 210,
            height: 210,
            borderRadius: '50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: 'rgba(22, 26, 34, 0.96)',
            border: `2px solid ${meta.color}`,
            boxShadow: `0 0 60px ${meta.color}44, inset 0 0 30px ${meta.color}22`,
          }}
        >
          <strong
            style={{
              fontSize: 30,
              letterSpacing: 1,
              color: meta.color,
              textShadow: `0 0 24px ${meta.color}88`,
            }}
          >
            {meta.title}
          </strong>
          <span
            style={{
              fontSize: 42,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              color: '#F5F3EE',
              lineHeight: 1,
            }}
          >
            {highlight.rating.toFixed(2)}
          </span>
          <span style={{ fontSize: 12.5, color: '#9BA3AF' }}>{meta.subtitle}</span>
        </div>
      </motion.div>

      <span
        style={{
          position: 'absolute',
          bottom: 56,
          fontSize: 12,
          color: '#6B7280',
        }}
      >
        点击任意处继续
      </span>
    </motion.div>
  )
}
