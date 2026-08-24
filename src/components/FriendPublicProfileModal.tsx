import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  Calendar,
  FileText,
  Flame,
  Radio,
  Swords,
  Trash2,
  X,
} from 'lucide-react'
import type {
  FriendActivity,
  FriendPresence,
  FriendProfile,
  FriendPublicMatch,
  FriendPublicReport,
} from '../types'
import {
  calculatePresenceState,
  getFriendCachedMatches,
  getPublicReportById,
} from '../data/friendPublicData'
import { FriendPublicReportModal } from './FriendPublicReportModal'
import { getRankDescription } from '../utils'

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s}s`
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    const m = d.getMonth() + 1
    const day = d.getDate()
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${m}月${day}日 ${hh}:${mm}`
  } catch {
    return iso
  }
}

const RADAR_CONFIG = {
  center: { x: 125, y: 110 },
  maxR: 75,
  angles: [0, 60, 120, 180, 240, 300].map((deg) => (deg - 90) * (Math.PI / 180)),
  labels: ['严谨性', '计算力', '作答速度', '建模转化', '方法运用', '应试策略'],
}

export function FriendPublicProfileModal({
  friend,
  activities,
  presence,
  onClose,
  onOpenVsRadar,
  onRemoveFriend,
}: {
  friend: FriendProfile | null
  activities: FriendActivity[]
  presence?: FriendPresence
  onClose: () => void
  onOpenVsRadar: (friend: FriendProfile) => void
  onRemoveFriend: (friendId: string) => void
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'matches' | 'activities'>('overview')
  const [selectedReport, setSelectedReport] = useState<FriendPublicReport | null>(null)

  const { polygonPoints, gridCircles, dataPoints, labelPoints, dimValues, friendMatches, friendActivities, presenceInfo } = useMemo(() => {
    const pInfo = calculatePresenceState(presence, friend?.lastSyncedAt, friend?.lastActiveAt)

    if (!friend) {
      return {
        polygonPoints: '',
        gridCircles: [],
        dataPoints: [],
        labelPoints: [],
        dimValues: [],
        friendMatches: [],
        friendActivities: [],
        presenceInfo: pInfo,
      }
    }

    const fKey = friend.profileId || friend.friendCode
    const fMatches = getFriendCachedMatches(fKey, friend.friendCode)
    const fActivities = activities.filter((a) => a.friendCode === friend.friendCode)

    const dims = friend.dimensions
    const dValues = [
      dims.rigor || 60,
      dims.computation || 60,
      dims.speed || 60,
      dims.modeling || 60,
      dims.methodUse || 60,
      dims.strategyInsight || 60,
    ]

    const { center, maxR, angles, labels } = RADAR_CONFIG

    const pPoints = dValues
      .map((val, i) => {
        const r = (val / 100) * maxR
        const x = center.x + r * Math.cos(angles[i])
        const y = center.y + r * Math.sin(angles[i])
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')

    const gCircles = [0.25, 0.5, 0.75, 1.0].map((frac) => {
      return angles
        .map((ang) => {
          const r = frac * maxR
          const x = center.x + r * Math.cos(ang)
          const y = center.y + r * Math.sin(ang)
          return `${x.toFixed(1)},${y.toFixed(1)}`
        })
        .join(' ')
    })

    const dPoints = dValues.map((val, i) => {
      const r = (val / 100) * maxR
      return {
        x: center.x + r * Math.cos(angles[i]),
        y: center.y + r * Math.sin(angles[i]),
      }
    })

    const lPoints = labels.map((label, i) => {
      const r = maxR + 18
      return {
        label,
        x: center.x + r * Math.cos(angles[i]),
        y: center.y + r * Math.sin(angles[i]) + 4,
      }
    })

    return {
      polygonPoints: pPoints,
      gridCircles: gCircles,
      dataPoints: dPoints,
      labelPoints: lPoints,
      dimValues: dValues,
      friendMatches: fMatches,
      friendActivities: fActivities,
      presenceInfo: pInfo,
    }
  }, [friend, presence, activities])

  if (!friend) return null

  const handleOpenReport = (match: FriendPublicMatch) => {
    if (!match.reportId) return
    const fKey = friend.profileId || friend.friendCode
    const rep = getPublicReportById(fKey, match.reportId, friend.friendCode)
    if (rep) {
      setSelectedReport(rep)
    }
  }

  return (
    <>
      <AnimatePresence>
        <div className="modal-backdrop" onClick={onClose}>
          <motion.div
            className="modal friend-public-profile-modal"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="modal-header friend-profile-header">
              <div className="friend-profile-hero">
                <div className="hero-avatar-wrap">
                  <span className="hero-avatar">{friend.avatar || '🚀'}</span>
                  <span className={`hero-status-dot ${presenceInfo.state}`} />
                </div>
                <div className="hero-info">
                  <div className="hero-name-row">
                    <h2 className="hero-nickname">{friend.nickname}</h2>
                    <span
                      className="hero-rank-badge rank-tooltip-target"
                      title={getRankDescription(friend.currentElo)}
                    >
                      {friend.rankLetter}
                    </span>
                    <span className="hero-code-tag">#{friend.friendCode}</span>
                  </div>
                  <p className="hero-title">{friend.title}</p>
                  <p className="hero-school">🎯 {friend.targetSchool}</p>
                </div>
              </div>

              <div className="friend-profile-header-actions">
                <button className="icon-button" onClick={onClose} title="关闭 (Esc)">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Presence Bar */}
            <div className="presence-banner-bar">
              <div className="presence-live-status">
                <Radio
                  size={14}
                  className={`presence-icon ${presenceInfo.state === 'online' || presenceInfo.state === 'in_match' ? 'pulse' : ''}`}
                />
                <strong className="presence-text">{presenceInfo.text}</strong>
                <span className="presence-heartbeat">({presenceInfo.heartbeatText})</span>
              </div>
              {friend.seasonName && (
                <span className="presence-season-tag">当前处于 {friend.seasonName} 赛季</span>
              )}
            </div>

            {/* Tabs */}
            <div className="profile-tabs-nav">
              <button
                className={`profile-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <Activity size={15} />
                <span>综合战力</span>
              </button>
              <button
                className={`profile-tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
                onClick={() => setActiveTab('matches')}
              >
                <Swords size={15} />
                <span>最近比赛 ({friendMatches.length})</span>
              </button>
              <button
                className={`profile-tab-btn ${activeTab === 'activities' ? 'active' : ''}`}
                onClick={() => setActiveTab('activities')}
              >
                <Flame size={15} />
                <span>近期动态 ({friendActivities.length})</span>
              </button>
            </div>

            {/* Body Content */}
            <div className="modal-body friend-profile-body">
              {activeTab === 'overview' && (
                <div className="profile-tab-overview">
                  {/* Top Stats */}
                  <div className="overview-stats-grid">
                    <div className="overview-stat-card">
                      <span className="stat-label">天梯积分 ELO</span>
                      <strong className="stat-value elo">{Math.round(friend.currentElo)}</strong>
                      <span className="stat-sub">最高 {Math.round(friend.peakElo)}</span>
                    </div>

                    <div className="overview-stat-card">
                      <span className="stat-label">HLTV Rating</span>
                      <strong className="stat-value rating">{friend.ratingPro.toFixed(2)}</strong>
                      <span className="stat-sub">预测 {friend.predictedExamScore} 分</span>
                    </div>

                    <div className="overview-stat-card">
                      <span className="stat-label">今日刷题</span>
                      <strong className="stat-value">{friend.todayProblems} 题</strong>
                      <span className="stat-sub">总场次 {friend.totalMatches}</span>
                    </div>

                    <div className="overview-stat-card">
                      <span className="stat-label">历史胜率</span>
                      <strong className="stat-value">{friend.winRate.toFixed(1)}%</strong>
                      <span className="stat-sub">
                        今日净胜 {friend.eloChangeToday ? (friend.eloChangeToday > 0 ? `+${friend.eloChangeToday}` : friend.eloChangeToday) : '0'} 分
                      </span>
                    </div>
                  </div>

                  {/* Radar & Dimensions */}
                  <div className="overview-radar-section">
                    <div className="radar-chart-container">
                      <svg viewBox="0 0 250 220" className="friend-radar-svg">
                        <defs>
                          <radialGradient id="friendRadarGlow" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.45" />
                            <stop offset="100%" stopColor="#059669" stopOpacity="0.12" />
                          </radialGradient>
                        </defs>

                        {/* Grid lines */}
                        {gridCircles.map((pts, i) => (
                          <polygon
                            key={i}
                            points={pts}
                            fill="none"
                            stroke="rgba(255,255,255,0.08)"
                            strokeWidth="1"
                          />
                        ))}

                        {/* Spokes */}
                        {RADAR_CONFIG.angles.map((ang, i) => (
                          <line
                            key={i}
                            x1={RADAR_CONFIG.center.x}
                            y1={RADAR_CONFIG.center.y}
                            x2={RADAR_CONFIG.center.x + RADAR_CONFIG.maxR * Math.cos(ang)}
                            y2={RADAR_CONFIG.center.y + RADAR_CONFIG.maxR * Math.sin(ang)}
                            stroke="rgba(255,255,255,0.08)"
                            strokeWidth="1"
                          />
                        ))}

                        {/* Polygon Data */}
                        <polygon
                          points={polygonPoints}
                          fill="url(#friendRadarGlow)"
                          stroke="#10b981"
                          strokeWidth="2"
                        />

                        {/* Data Points */}
                        {dataPoints.map((pt, i) => (
                          <circle
                            key={i}
                            cx={pt.x}
                            cy={pt.y}
                            r="3.5"
                            fill="#10b981"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                        ))}

                        {/* Labels */}
                        {labelPoints.map((item, i) => (
                          <text
                            key={i}
                            x={item.x}
                            y={item.y}
                            textAnchor="middle"
                            fill="rgba(255,255,255,0.7)"
                            fontSize="11"
                          >
                            {item.label}
                          </text>
                        ))}
                      </svg>
                    </div>

                    <div className="dimension-bars-list">
                      {RADAR_CONFIG.labels.map((lbl, idx) => {
                        const val = dimValues[idx]
                        return (
                          <div key={lbl} className="dim-bar-row">
                            <span className="dim-name">{lbl}</span>
                            <div className="dim-track">
                              <div
                                className="dim-fill"
                                style={{ width: `${Math.min(100, Math.max(10, val))}%` }}
                              />
                            </div>
                            <span className="dim-num">{Math.round(val)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'matches' && (
                <div className="profile-tab-matches">
                  {friendMatches.length === 0 ? (
                    <div className="empty-tab-box">
                      <Calendar size={32} />
                      <p>好友暂无公开比赛记录</p>
                      <small>当好友完成高压演练或试卷后，战报将在此展示</small>
                    </div>
                  ) : (
                    <div className="matches-list-wrap">
                      {friendMatches.map((m) => (
                        <div key={m.publicMatchId} className="friend-match-card">
                          <div className="match-card-header">
                            <div className="match-mode-info">
                              <span className={`match-result-pill ${m.result}`}>
                                {m.result === 'win' ? '大胜' : m.result === 'loss' ? '战损' : '完成'}
                              </span>
                              <strong className="match-title">
                                {m.title || (m.mode === 'pressure' ? '高压演练' : '真题试卷')}
                              </strong>
                              <span className="friend-match-time">{formatDate(m.finishedAt)}</span>
                            </div>

                            {m.reportAvailable && m.reportId && (
                              <button
                                className="secondary-button compact report-btn"
                                onClick={() => handleOpenReport(m)}
                              >
                                <FileText size={13} />
                                <span>阅读公开报告</span>
                              </button>
                            )}
                          </div>

                          <div className="match-metrics-row">
                            <div className="match-metric">
                              <span className="m-lbl">题目数</span>
                              <span className="m-val">{m.questionCount} 题</span>
                            </div>
                            <div className="match-metric">
                              <span className="m-lbl">正确率</span>
                              <span className="m-val">{m.accuracy}%</span>
                            </div>
                            <div className="match-metric">
                              <span className="m-lbl">用时</span>
                              <span className="m-val">{formatSeconds(m.durationSeconds)}</span>
                            </div>
                            <div className="match-metric">
                              <span className="m-lbl">Rating</span>
                              <span className="m-val rating">{m.rating.toFixed(2)}</span>
                            </div>
                            {m.eloDelta !== undefined && (
                              <div className="match-metric">
                                <span className="m-lbl">天梯变动</span>
                                <span
                                  className={`m-val elo-delta ${m.eloDelta >= 0 ? 'pos' : 'neg'}`}
                                >
                                  {m.eloDelta >= 0 ? `+${m.eloDelta}` : m.eloDelta}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'activities' && (
                <div className="profile-tab-activities">
                  {friendActivities.length === 0 ? (
                    <div className="empty-tab-box">
                      <Flame size={32} />
                      <p>好友暂无近期动态</p>
                      <small>完成刷题、连胜突破、升段时将生成动态</small>
                    </div>
                  ) : (
                    <div className="activities-timeline">
                      {friendActivities.map((act) => (
                        <div key={act.id} className="timeline-item">
                          <div className="timeline-marker">
                            <Flame size={14} />
                          </div>
                          <div className="timeline-content">
                            <div className="act-header">
                              <strong className="act-title">{act.title}</strong>
                              <span className="act-time">{formatDate(act.timestamp)}</span>
                            </div>
                            <p className="act-desc">{act.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="modal-footer friend-profile-footer">
              <div className="footer-left">
                <button
                  className="danger-button compact"
                  onClick={() => {
                    if (window.confirm(`确定删除好友「${friend.nickname}」吗？删除后将自动屏蔽其数据同步。`)) {
                      onRemoveFriend(friend.id)
                      onClose()
                    }
                  }}
                  title="删除好友并屏蔽同步"
                >
                  <Trash2 size={14} />
                  <span>删除好友</span>
                </button>
              </div>

              <div className="footer-right">
                <button
                  className="secondary-button compact"
                  onClick={() => {
                    onOpenVsRadar(friend)
                    onClose()
                  }}
                >
                  <Swords size={14} />
                  <span>1v1 战力对决</span>
                </button>
                <button className="primary-button compact" onClick={onClose}>
                  完成
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Render Public Report Modal if selected */}
      {selectedReport && (
        <FriendPublicReportModal
          report={selectedReport}
          friendNickname={friend.nickname}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </>
  )
}
