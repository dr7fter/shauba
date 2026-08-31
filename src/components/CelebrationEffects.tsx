import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import { ShieldCheck, Flame, Crown, Sparkles } from 'lucide-react'
import './CelebrationEffects.css'

export type CelebrationEvent =
  | { type: 'item_check'; x?: number; y?: number }
  | { type: 'base_complete' }
  | { type: 'advanced_breakthrough'; title?: string }
  | { type: 'all_clear' }

export function SparkleParticles({ x, y }: { x: number; y: number }) {
  const particles = Array.from({ length: 12 }).map((_, i) => {
    const angle = (i / 12) * Math.PI * 2 + (Math.random() - 0.5) * 0.3
    const distance = 30 + Math.random() * 35
    return {
      id: i,
      tx: Math.cos(angle) * distance,
      ty: Math.sin(angle) * distance,
      size: 4 + Math.random() * 4,
      color: ['#4CC38A', '#FFD700', '#58A6FF', '#C297FF'][i % 4],
    }
  })

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
          animate={{ x: p.tx, y: p.ty, opacity: 0, scale: 1.3 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: p.color,
            boxShadow: `0 0 8px ${p.color}`,
          }}
        />
      ))}
    </div>
  )
}

function ConfettiShower() {
  const confettiPieces = Array.from({ length: 45 }).map((_, i) => ({
    id: i,
    left: `${(i / 45) * 100}%`,
    delay: (i % 8) * 0.08,
    duration: 2.2 + Math.random() * 1.5,
    size: 8 + Math.random() * 8,
    color: ['#FFD700', '#FF6B6B', '#4CC38A', '#58A6FF', '#C297FF', '#FFA500'][i % 6],
    rotation: Math.random() * 360,
  }))

  return (
    <div className="confetti-container">
      {confettiPieces.map((p) => (
        <motion.div
          key={p.id}
          className="confetti-piece"
          initial={{ y: -40, opacity: 1, rotate: p.rotation }}
          animate={{
            y: window.innerHeight + 60,
            opacity: [1, 1, 0.8, 0],
            rotate: p.rotation + 720,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'linear',
          }}
          style={{
            left: p.left,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
          }}
        />
      ))}
    </div>
  )
}

export function CelebrationEffects({
  event,
  onDismiss,
}: {
  event: CelebrationEvent | null
  onDismiss: () => void
}) {
  const [clickPos, setClickPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!event) return
    if (event.type === 'item_check' && event.x !== undefined && event.y !== undefined) {
      setClickPos({ x: event.x, y: event.y })
      const timer = setTimeout(() => {
        setClickPos(null)
        onDismiss()
      }, 600)
      return () => clearTimeout(timer)
    }

    const duration =
      event.type === 'all_clear'
        ? 4500
        : event.type === 'base_complete'
        ? 3500
        : event.type === 'advanced_breakthrough'
        ? 3000
        : 800

    const timer = setTimeout(onDismiss, duration)
    return () => clearTimeout(timer)
  }, [event, onDismiss])

  return (
    <>
      {clickPos && <SparkleParticles x={clickPos.x} y={clickPos.y} />}

      <AnimatePresence>
        {event && event.type !== 'item_check' && (
          <motion.div
            className="celebration-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDismiss}
          >
            {event.type === 'base_complete' && (
              <>
                <ConfettiShower />
                <motion.div
                  className="celebration-card celebration-base"
                  initial={{ scale: 0.7, y: 30, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={{ type: 'spring', damping: 22, stiffness: 280 }}
                >
                  <div className="celebration-icon-glow base-glow">
                    <ShieldCheck size={52} className="glow-icon base-icon" />
                  </div>
                  <span className="celebration-badge base-badge">🛡️ 今日底线达成</span>
                  <h2 className="celebration-title">基础计划全部清盘！</h2>
                  <p className="celebration-desc">
                    今日考研数学基本盘已稳固锁定，坚守底线是通往 130+ 的最坚实基石！
                  </p>
                  <button className="celebration-skip-btn" onClick={onDismiss}>
                    <Sparkles size={15} /> 收到，继续冲刺进阶
                  </button>
                </motion.div>
              </>
            )}

            {event.type === 'advanced_breakthrough' && (
              <motion.div
                className="celebration-card celebration-advanced"
                initial={{ scale: 0.8, y: -20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              >
                <div className="celebration-icon-glow advanced-glow">
                  <Flame size={54} className="glow-icon advanced-icon" />
                </div>
                <span className="celebration-badge advanced-badge">🔥 极限战力突破</span>
                <h2 className="celebration-title">进阶挑战攻克！</h2>
                <p className="celebration-desc">
                  {event.title || '斩获高光压轴题，突破认知天花板！'}
                </p>
                <button className="celebration-skip-btn adv-btn" onClick={onDismiss}>
                  太棒了！
                </button>
              </motion.div>
            )}

            {event.type === 'all_clear' && (
              <>
                <ConfettiShower />
                <motion.div
                  className="celebration-card celebration-allclear"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.85, opacity: 0 }}
                  transition={{ type: 'spring', damping: 18, stiffness: 240 }}
                >
                  <div className="celebration-icon-glow allclear-glow">
                    <Crown size={60} className="glow-icon allclear-icon" />
                  </div>
                  <span className="celebration-badge allclear-badge">👑 ALL CLEAR · 完美大满贯</span>
                  <h2 className="celebration-title grand-title">今日作战计划 100% 达成！</h2>
                  <p className="celebration-desc">
                    从基础基本盘到底线难题全线拉满，今日战力已达巅峰状态！
                  </p>
                  <div className="allclear-stars">
                    {'★★★★★'.split('').map((s, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + i * 0.1 }}
                      >
                        {s}
                      </motion.span>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}