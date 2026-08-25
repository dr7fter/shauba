import { useEffect, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Swords, X } from 'lucide-react'
import type { FriendProfile } from '../types'

const DIMENSION_CONFIG: Array<{
  key: keyof FriendProfile['dimensions']
  label: string
  desc: string
}> = [
  { key: 'rigor', label: '严谨性', desc: '定理条件验证与步骤严密性' },
  { key: 'computation', label: '计算力', desc: '极限化简、积分求导与矩阵硬算' },
  { key: 'speed', label: '速度', desc: '作答节奏与单题基准效率' },
  { key: 'modeling', label: '审题建模', desc: '复杂几何题与应用题建模转化' },
  { key: 'methodUse', label: '方法使用', desc: '降维解法、待定系数与秒杀技巧' },
  { key: 'strategyInsight', label: '策略洞察', desc: '考场避坑、防白给与经济决策' },
]

export function FriendVsRadarModal({
  myProfile,
  friend,
  onClose,
}: {
  myProfile: FriendProfile
  friend: FriendProfile
  onClose: () => void
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])
  // SVG Radar Polygon Calculation
  const size = 300
  const center = size / 2
  const radius = 100
  const total = DIMENSION_CONFIG.length

  const getCoordinates = (value: number, index: number) => {
    const angle = (Math.PI * 2 / total) * index - Math.PI / 2
    const r = (Math.max(20, Math.min(100, value)) / 100) * radius
    const x = center + r * Math.cos(angle)
    const y = center + r * Math.sin(angle)
    return { x, y }
  }

  const { myPolygonStr, friendPolygonStr, myWins, friendWins } = useMemo(() => {
    const myPoints = DIMENSION_CONFIG.map((d, i) => getCoordinates(myProfile.dimensions[d.key] ?? 50, i))
    const friendPoints = DIMENSION_CONFIG.map((d, i) => getCoordinates(friend.dimensions[d.key] ?? 50, i))

    let wins = 0
    let fWins = 0
    DIMENSION_CONFIG.forEach((d) => {
      const myVal = myProfile.dimensions[d.key] ?? 50
      const friendVal = friend.dimensions[d.key] ?? 50
      if (myVal > friendVal) wins++
      else if (friendVal > myVal) fWins++
    })

    return {
      myPolygonStr: myPoints.map((p) => `${p.x},${p.y}`).join(' '),
      friendPolygonStr: friendPoints.map((p) => `${p.x},${p.y}`).join(' '),
      myWins: wins,
      friendWins: fWins,
    }
  }, [myProfile.dimensions, friend.dimensions])

  return (
    <AnimatePresence>
      <div className="modal-backdrop" onClick={onClose}>
        <motion.div
          className="modal vs-battle-modal"
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header vs-modal-header">
            <div className="vs-title-wrapper">
              <span className="vs-swords-icon">
                <Swords size={20} />
              </span>
              <div>
                <h2>战力对决 · 1v1 Head-to-Head</h2>
                <p>六维战术能力图谱实时对决</p>
              </div>
            </div>
            <button className="icon-button" onClick={onClose} title="关闭 (Esc)">
              <X size={18} />
            </button>
          </div>

          <div className="vs-modal-body">
            {/* Top VS Match Banner */}
            <div className="vs-players-banner">
              {/* My Card */}
              <div className="vs-player-card my-side">
                <div className="vs-player-avatar-wrapper">
                  <span className="vs-player-avatar">{myProfile.avatar}</span>
                  <span className="vs-side-tag my-tag">YOU (我方)</span>
                </div>
                <strong className="vs-player-name">{myProfile.nickname}</strong>
                <span className="vs-player-school">{myProfile.targetSchool}</span>
                <div className="vs-player-stats-row">
                  <div className="vs-stat-item">
                    <span>天梯分</span>
                    <strong>{myProfile.currentElo}</strong>
                  </div>
                  <div className="vs-stat-item">
                    <span>Rating 3.0</span>
                    <strong className="accent-green">{myProfile.ratingPro.toFixed(2)}</strong>
                  </div>
                  <div className="vs-stat-item">
                    <span>考场预估</span>
                    <strong>{myProfile.predictedExamScore}分</strong>
                  </div>
                </div>
              </div>

              {/* VS Center Badge */}
              <div className="vs-center-badge">
                <div className="vs-circle-emblem">VS</div>
                <div className="vs-score-record">
                  <span className="my-lead-score">{myWins}</span>
                  <span className="vs-colon">:</span>
                  <span className="friend-lead-score">{friendWins}</span>
                </div>
                <span className="vs-lead-label">
                  {myWins > friendWins ? '我方优势' : myWins < friendWins ? '对方优势' : '势均力敌'}
                </span>
              </div>

              {/* Friend Card */}
              <div className="vs-player-card friend-side">
                <div className="vs-player-avatar-wrapper">
                  <span className="vs-player-avatar">{friend.avatar}</span>
                  <span className="vs-side-tag friend-tag">RIVAL (对手)</span>
                </div>
                <strong className="vs-player-name">{friend.nickname}</strong>
                <span className="vs-player-school">{friend.targetSchool}</span>
                <div className="vs-player-stats-row">
                  <div className="vs-stat-item">
                    <span>天梯分</span>
                    <strong>{friend.currentElo}</strong>
                  </div>
                  <div className="vs-stat-item">
                    <span>Rating 3.0</span>
                    <strong className="accent-gold">{friend.ratingPro.toFixed(2)}</strong>
                  </div>
                  <div className="vs-stat-item">
                    <span>考场预估</span>
                    <strong>{friend.predictedExamScore}分</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Radar Comparison Canvas & Dimensions Detail */}
            <div className="vs-content-grid">
              {/* Radar Chart */}
              <div className="vs-radar-card">
                <div className="vs-radar-legend">
                  <span className="legend-item my-legend">
                    <span className="legend-box" /> {myProfile.nickname} (我方)
                  </span>
                  <span className="legend-item friend-legend">
                    <span className="legend-box" /> {friend.nickname} (对手)
                  </span>
                </div>

                <div className="vs-radar-svg-container">
                  <svg width={size} height={size} className="vs-radar-svg">
                    {/* Background Web Rings */}
                    {[0.25, 0.5, 0.75, 1.0].map((level) => {
                      const ringPoints = DIMENSION_CONFIG.map((_, i) =>
                        getCoordinates(level * 100, i)
                      )
                      return (
                        <polygon
                          key={level}
                          points={ringPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                          className="radar-web-ring"
                        />
                      )
                    })}

                    {/* Axis Lines */}
                    {DIMENSION_CONFIG.map((_, i) => {
                      const end = getCoordinates(100, i)
                      return (
                        <line
                          key={i}
                          x1={center}
                          y1={center}
                          x2={end.x}
                          y2={end.y}
                          className="radar-axis-line"
                        />
                      )
                    })}

                    {/* My Polygon */}
                    <polygon points={myPolygonStr} className="radar-polygon my-polygon" />

                    {/* Friend Polygon */}
                    <polygon points={friendPolygonStr} className="radar-polygon friend-polygon" />

                    {/* Dimension Labels */}
                    {DIMENSION_CONFIG.map((d, i) => {
                      const labelPos = getCoordinates(118, i)
                      return (
                        <text
                          key={d.key}
                          x={labelPos.x}
                          y={labelPos.y + 4}
                          textAnchor="middle"
                          className="radar-axis-label"
                        >
                          {d.label}
                        </text>
                      )
                    })}
                  </svg>
                </div>
              </div>

              {/* Dimensions Breakdown Table */}
              <div className="vs-dimensions-list">
                <div className="vs-dim-header">
                  <span>能力维度</span>
                  <span>我方</span>
                  <span>对比</span>
                  <span>对手</span>
                </div>
                {DIMENSION_CONFIG.map((d) => {
                  const myVal = Number(myProfile.dimensions[d.key] ?? 50)
                  const friendVal = Number(friend.dimensions[d.key] ?? 50)
                  const diff = myVal - friendVal
                  const diffStr = Math.abs(diff).toFixed(1)
                  return (
                    <div key={d.key} className="vs-dim-row">
                      <div className="dim-name-cell">
                        <strong>{d.label}</strong>
                        <span>{d.desc}</span>
                      </div>
                      <div className={`dim-val-cell my-val ${diff > 0 ? 'win' : ''}`}>
                        {myVal.toFixed(1)}
                      </div>
                      <div className="dim-diff-cell">
                        {diff > 0.05 ? (
                          <span className="diff-badge win">+{diffStr} 胜</span>
                        ) : diff < -0.05 ? (
                          <span className="diff-badge lose">-{diffStr} 负</span>
                        ) : (
                          <span className="diff-badge draw">平</span>
                        )}
                      </div>
                      <div className={`dim-val-cell friend-val ${diff < -0.05 ? 'win' : ''}`}>
                        {friendVal.toFixed(1)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="modal-footer vs-modal-footer">
            <div className="vs-footer-tip">
              💡 <strong>战术建议：</strong>{' '}
              {myWins >= friendWins
                ? `你在「${DIMENSION_CONFIG.find((d) => myProfile.dimensions[d.key] > friend.dimensions[d.key])?.label || '综合'}」上占据压制优势，保持节奏！`
                : `可在「${DIMENSION_CONFIG.find((d) => myProfile.dimensions[d.key] < friend.dimensions[d.key])?.label || '薄弱项'}」上向 ${friend.nickname} 学习专项秒杀解法！`}
            </div>
            <button className="primary-button compact" onClick={onClose}>
              确定返回
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
