import { memo } from 'react'
import { Flame, ShieldCheck } from 'lucide-react'
import { motion } from 'framer-motion'
import { csRatingAccent } from '../utils'
import { CountUp } from './ui/CountUp'

export interface EloFlashSnapshot {
  delta: number
  current: number
  rankName: string
  rankColor: string
  streak: number
  protectionLeft: number
  calibrated: boolean
  settlements: number
  rating?: number | null
  streakToday?: number
}

/**
 * ELO 结算浮闪。抽自 TodayView 并用 memo 隔离：TodayView 顶层有每秒 tick 的
 * 计时 state，浮闪本体只随结算变化重绘，不再参与每秒整树 diff。
 * 退出动画依赖外层 AnimatePresence 对本组件的 key 追踪（motion 元素在本组件
 * 内部渲染，PresenceContext 向下传播 exit）。
 */
export const EloFlashBanner = memo(function EloFlashBanner({ flash }: { flash: EloFlashSnapshot }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      style={{
        position: 'fixed',
        top: 18,
        right: 18,
        zIndex: 130,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 14px',
        borderRadius: 12,
        background: 'rgba(22, 26, 34, 0.92)',
        color: '#F5F3EE',
        boxShadow: '0 10px 28px rgba(15, 18, 25, 0.35)',
        pointerEvents: 'none',
      }}
    >
      <span style={{ fontSize: 13, color: flash.rankColor, fontWeight: 700 }}>
        {flash.rankName}
      </span>
      <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
        <CountUp value={flash.current} />
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          color: flash.delta >= 0 ? '#4CC38A' : '#E5534B',
        }}
      >
        {flash.delta >= 0 ? `+${Math.round(flash.delta)}` : Math.round(flash.delta)}
      </span>
      {flash.rating != null && (
        <>
          <span style={{ width: 1, height: 16, background: 'rgba(245, 243, 238, 0.25)' }} />
          <span style={{ fontSize: 12, color: '#9BA3AF' }}>Rating</span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              color: '#F5F3EE',
            }}
          >
            <CountUp value={flash.rating} decimals={2} animateOnMount />
          </span>
          {(() => {
            const accent = csRatingAccent(flash.rating)
            if (accent === 'donk') return <span title="DONK 级超神秒杀">👑</span>
            if (accent === 'clutch') return <span title="Clutch 级高光">⚡</span>
            return null
          })()}
        </>
      )}
      {(() => {
        // HEATING 火焰四档（当日连对 3/5/8/12），12 档即 ZYWOO PLAY 稳定之神
        const heat = flash.streakToday ?? 0
        if (heat < 3) return null
        const tier = heat >= 12 ? 4 : heat >= 8 ? 3 : heat >= 5 ? 2 : 1
        const flameColor = heat >= 12 ? '#C297FF' : heat >= 8 ? '#E5534B' : '#E87722'
        const heatTitle = heat >= 12
          ? `当日连对 ${heat} 题 · ZywOo 级稳定输出`
          : `当日连对 ${heat} 题`
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 2,
              fontSize: 12 + tier,
              color: flameColor,
              fontWeight: 700,
            }}
            title={heatTitle}
          >
            <Flame size={13 + tier} />{heat}
          </span>
        )
      })()}
      {flash.streak <= -3 && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12, color: '#6B7280', fontWeight: 700 }} title={`连败 ${-flash.streak} 场`}>
          ❄{-flash.streak}
        </span>
      )}
      {flash.protectionLeft > 0 && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12, color: '#4CC38A' }} title={`晋级保护剩余 ${flash.protectionLeft} 场`}>
          <ShieldCheck size={13} />
        </span>
      )}
      {!flash.calibrated && (
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>定级 {Math.min(flash.settlements, 10)}/10</span>
      )}
    </motion.div>
  )
})
