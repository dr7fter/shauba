import { motion } from 'framer-motion'
import { useState } from 'react'
import type { AttemptHighlight } from '../types'

const KIND_NAME: Record<AttemptHighlight['kind'], string> = {
  donk: 'DONK 超神秒杀',
  ace: 'ACE 高光作答',
  s1mple: 'S1MPLE 压轴攻坚',
  clutch: 'CLUTCH 残局翻盘',
  redeem: 'REDEEM 旧伤愈合',
  zywoo: 'ZYWOO 稳定神迹',
}

/**
 * 批改揭晓卡（多巴胺机制 ①·变比率强化）：报告打开前先亲手翻卡揭晓名场面。
 * 高光藏在中间一张；点任意卡全部翻开，翻到即接全屏高光时刻。
 */
export function RevealCards({
  highlight,
  onDone,
}: {
  highlight: AttemptHighlight
  onDone: () => void
}) {
  const [flipped, setFlipped] = useState(false)
  const prizeIndex = 1

  const flip = () => {
    if (flipped) return
    setFlipped(true)
    window.setTimeout(onDone, 1800)
  }

  return (
    <div
      onClick={flip}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 230,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        background: 'rgba(10, 12, 18, 0.84)',
        backdropFilter: 'blur(6px)',
        cursor: 'pointer',
      }}
    >
      <strong style={{ color: '#F5F3EE', fontSize: 18, letterSpacing: 0.5 }}>
        这组批改里，藏着一次「{KIND_NAME[highlight.kind]}」
      </strong>
      <div style={{ display: 'flex', gap: 14 }}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ duration: 0.6, delay: i * 0.14, ease: 'easeOut' }}
            style={{ width: 112, height: 152, position: 'relative', transformStyle: 'preserve-3d' }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backfaceVisibility: 'hidden',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #2A3040, #1A1E28)',
                border: '1px solid #3A4150',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 36,
                color: '#8B949E',
              }}
            >
              ?
            </div>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                borderRadius: 12,
                border: `2px solid ${i === prizeIndex ? '#FFD700' : '#3A4150'}`,
                background: i === prizeIndex ? 'rgba(255, 215, 0, 0.12)' : 'rgba(22, 26, 34, 0.92)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              {i === prizeIndex ? (
                <>
                  <span style={{ fontSize: 30 }}>🏆</span>
                  <span style={{ color: '#FFD700', fontWeight: 800, fontSize: 12.5 }}>
                    {KIND_NAME[highlight.kind]}
                  </span>
                  <span style={{ color: '#F5F3EE', fontSize: 21, fontWeight: 800 }}>
                    {highlight.rating.toFixed(2)}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 22, color: '#6B7280' }}>{flipped ? '·' : '?'}</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
      <span style={{ color: '#6B7280', fontSize: 12 }}>
        {flipped ? '' : '点开任意一张，揭晓今天的名场面'}
      </span>
    </div>
  )
}
