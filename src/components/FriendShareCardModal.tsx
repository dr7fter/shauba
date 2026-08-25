import { useEffect, useState, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, Share2, X } from 'lucide-react'
import type { FriendProfile } from '../types'
import { csRankForElo } from '../utils'

const DIMENSION_CONFIG: Array<{
  key: keyof FriendProfile['dimensions']
  label: string
}> = [
  { key: 'rigor', label: '严谨性' },
  { key: 'computation', label: '计算力' },
  { key: 'speed', label: '速度' },
  { key: 'modeling', label: '审题建模' },
  { key: 'methodUse', label: '方法使用' },
  { key: 'strategyInsight', label: '策略洞察' },
]

export function FriendShareCardModal({
  profile,
  onClose,
}: {
  profile: FriendProfile
  onClose: () => void
}) {
  const [copiedText, setCopiedText] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const rank = csRankForElo(profile.currentElo)

  // Radar chart calculation
  const size = 200
  const center = size / 2
  const radius = 70
  const total = DIMENSION_CONFIG.length

  const getCoordinates = (value: number, index: number) => {
    const angle = ((Math.PI * 2) / total) * index - Math.PI / 2
    const r = (Math.max(20, Math.min(100, value)) / 100) * radius
    const x = center + r * Math.cos(angle)
    const y = center + r * Math.sin(angle)
    return { x, y }
  }

  const polygonStr = useMemo(() => {
    const points = DIMENSION_CONFIG.map((d, i) =>
      getCoordinates(profile.dimensions[d.key] ?? 50, i)
    )
    return points.map((p) => `${p.x},${p.y}`).join(' ')
  }, [profile.dimensions])

  const handleCopyText = async () => {
    const text = `🏆【刷吧 · 考研数一战术卡】
👤 昵称：${profile.nickname}
🎯 目标：${profile.targetSchool}
🏅 段位：${rank.letter} 段（ELO ${profile.currentElo}）
⚡ Rating 3.0：${profile.ratingPro.toFixed(2)} | 考场预估分：${profile.predictedExamScore} 分
🔥 今日刷题：${profile.todayProblems} 题
🔑 战友好友码：${profile.friendCode}
—— 来自 刷吧 数一纸笔优先训练`

    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(true)
      setTimeout(() => setCopiedText(false), 2000)
    } catch {
      // fallback
    }
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(profile.friendCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch {
      // fallback
    }
  }

  return (
    <AnimatePresence>
      <div className="modal-backdrop" onClick={onClose}>
        <motion.div
          className="modal share-card-modal"
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <div className="share-title-row">
              <Share2 size={20} className="accent-gold" />
              <div>
                <h2>战术名片分享</h2>
                <p>分享你的考研数一战力与六维雷达</p>
              </div>
            </div>
            <button className="icon-button" onClick={onClose} title="关闭 (Esc)">
              <X size={18} />
            </button>
          </div>

          <div className="share-card-modal-body">
            {/* Visual Tactical Card */}
            <div ref={cardRef} className="tactical-share-card">
              <div className="card-top-glow" />
              <div className="card-header-bar">
                <div className="card-user-info">
                  <span className="card-avatar">{profile.avatar}</span>
                  <div>
                    <h3 className="card-nickname">{profile.nickname}</h3>
                    <span className="card-school">{profile.targetSchool}</span>
                  </div>
                </div>
                <div className="card-rank-badge-wrap">
                  <span className="card-rank-letter">{rank.letter}</span>
                  <span className="card-rank-title">段位</span>
                </div>
              </div>

              <div className="card-stats-row">
                <div className="card-stat-box">
                  <span className="card-stat-label">天梯 ELO</span>
                  <span className="card-stat-val accent-gold">{profile.currentElo}</span>
                </div>
                <div className="card-stat-box">
                  <span className="card-stat-label">Rating 3.0</span>
                  <span className="card-stat-val accent-green">{profile.ratingPro.toFixed(2)}</span>
                </div>
                <div className="card-stat-box">
                  <span className="card-stat-label">考场预估分</span>
                  <span className="card-stat-val accent-cyan">{profile.predictedExamScore}</span>
                </div>
                <div className="card-stat-box">
                  <span className="card-stat-label">今日题量</span>
                  <span className="card-stat-val">{profile.todayProblems}</span>
                </div>
              </div>

              {/* Radar Chart */}
              <div className="card-radar-section">
                <div className="card-radar-canvas">
                  <svg width={size} height={size} className="card-radar-svg">
                    {[0.33, 0.66, 1.0].map((level) => {
                      const ringPoints = DIMENSION_CONFIG.map((_, i) =>
                        getCoordinates(level * 100, i)
                      )
                      return (
                        <polygon
                          key={level}
                          points={ringPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                          className="card-radar-ring"
                        />
                      )
                    })}
                    {DIMENSION_CONFIG.map((_, i) => {
                      const end = getCoordinates(100, i)
                      return (
                        <line
                          key={i}
                          x1={center}
                          y1={center}
                          x2={end.x}
                          y2={end.y}
                          className="card-radar-axis"
                        />
                      )
                    })}
                    <polygon points={polygonStr} className="card-radar-poly" />
                    {DIMENSION_CONFIG.map((d, i) => {
                      const labelPos = getCoordinates(120, i)
                      return (
                        <text
                          key={d.key}
                          x={labelPos.x}
                          y={labelPos.y + 3}
                          textAnchor="middle"
                          className="card-radar-label"
                        >
                          {d.label}
                        </text>
                      )
                    })}
                  </svg>
                </div>
              </div>

              {/* Bottom Footer with Friend Code */}
              <div className="card-footer-bar">
                <div className="card-code-block">
                  <span className="card-code-label">战友专属好友码</span>
                  <strong className="card-code-val">{profile.friendCode}</strong>
                </div>
                <span className="card-brand-tag">刷吧 · 数一专用</span>
              </div>
            </div>
          </div>

          <div className="modal-footer share-modal-footer">
            <button className="secondary-button" onClick={handleCopyCode}>
              {copiedCode ? <Check size={14} className="accent-green" /> : <Copy size={14} />}
              {copiedCode ? '已复制好友码' : '复制专属好友码'}
            </button>
            <button className="primary-button" onClick={handleCopyText}>
              {copiedText ? <Check size={14} /> : <Share2 size={14} />}
              {copiedText ? '已复制战绩简报' : '复制战力简报文本'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
