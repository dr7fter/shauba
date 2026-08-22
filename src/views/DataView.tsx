import { motion } from 'framer-motion'
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  Inbox,
  LoaderCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getDailyTrend, getEloStatus, getPressureGradingReport, getRatingDistribution, listPressureSessions } from '../api'
import { CS_RATING_MAX, CS_RATING_MIN, averageCsRating, csRankForElo, csRatingTone, deriveGradeCsRating, formatElapsed } from '../utils'
import type { BootstrapData, DailyTrendPoint, EloStatus, GradingReport, PressureSession, RatingDistribution } from '../types'
import { InboxView } from './InboxView'

/** 职业选手风格的单维评级：与报告页 S/A/B/C/D 一致 */
function dimensionGrade(value: number | null): string {
  if (value === null) return '—'
  if (value >= 90) return 'S'
  if (value >= 75) return 'A'
  if (value >= 60) return 'B'
  if (value >= 45) return 'C'
  return 'D'
}


function averageReportRating(report: GradingReport | null): number | null {
  if (!report || report.grades.length === 0) return null
  const averageDuration = report.summary.averageDuration ?? Math.round((report.summary.totalDuration ?? report.grades.reduce((sum, grade) => sum + Math.max(0, grade.duration || 0), 0)) / Math.max(1, report.summary.totalCount || report.grades.length))
  const ratings = report.grades.map((grade) => {
    const outcome = grade.verdict === 'partial' ? 'partial' : grade.verdict === 'uncertain' || grade.result === 'uncertain' ? 'uncertain' : grade.verdict === 'incorrect' || grade.result === 'wrong' || !grade.correct ? 'wrong' : 'correct'
    return deriveGradeCsRating({
      rating: grade.rating,
      outcome,
      selfRating: grade.selfRating,
      duration: grade.duration,
      averageDuration,
      difficultyMultiplier: grade.difficultyMultiplier,
    })
  })
  return averageCsRating(ratings)
}
function accuracyPercent(report: GradingReport | null): number | null {
  if (!report) return null
  const value = report.summary.accuracy
  return Math.round(value <= 1 ? value * 100 : value)
}

function formatMatchTime(value: number): string {
  const date = new Date(value < 1_000_000_000_000 ? value * 1000 : value)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function resultFor(report: GradingReport | null, session: PressureSession): 'win' | 'loss' | 'pending' {
  if (!report || session.status === 'awaiting_codex' || session.status === 'ongoing') return 'pending'
  return (accuracyPercent(report) ?? 0) >= 60 ? 'win' : 'loss'
}

export function InsightsView({
  data: _data,
  refresh: _refresh,
  notify,
  onOpenPressureReport,
  onStartVariant,
  onJumpToReview,
}: {
  data: BootstrapData
  refresh: () => void
  notify: (text: string) => void
  onOpenPressureReport: (taskId: string) => Promise<boolean>
  onStartVariant?: (questionId: number) => void
  onJumpToReview?: () => void
}) {
  const [activeTab, setActiveTab] = useState<'insights' | 'inbox'>('insights')
  const [distribution, setDistribution] = useState<RatingDistribution | null>(null)
  const [elo, setElo] = useState<EloStatus | null>(null)

  useEffect(() => {
    void getRatingDistribution().then(setDistribution).catch(() => undefined)
    void getEloStatus().then(setElo).catch(() => undefined)
  }, [])
  const [trend, setTrend] = useState<DailyTrendPoint[]>([])
  const [sessions, setSessions] = useState<PressureSession[]>([])
  const [reports, setReports] = useState<Record<string, GradingReport | null>>({})
  const [loading, setLoading] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [nextTrend, nextSessions] = await Promise.all([getDailyTrend(), listPressureSessions()])
      setTrend(nextTrend)
      setSessions(nextSessions)
      const reportEntries = await Promise.all(
        nextSessions.map(async (session) => {
          if (!['graded', 'graded_partial'].includes(session.status)) return [session.sessionId, null] as const
          try {
            return [session.sessionId, await getPressureGradingReport(session.sessionId)] as const
          } catch {
            return [session.sessionId, null] as const
          }
        }),
      )
      setReports(Object.fromEntries(reportEntries))
    } catch (error) {
      notify(`加载数据失败：${String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const ratedSessions = useMemo(
    () => sessions.map((session) => averageReportRating(reports[session.sessionId])).filter((rating): rating is number => rating !== null),
    [reports, sessions],
  )
  const averageRating = averageCsRating(ratedSessions)
  const wins = sessions.filter((session) => resultFor(reports[session.sessionId], session) === 'win').length
  const completed = sessions.filter((session) => ['graded', 'graded_partial'].includes(session.status)).length
  const winRate = completed ? Math.round((wins / completed) * 100) : null
  const heatmap = trend.slice(-21)
  const rank = csRankForElo(elo?.current ?? 10000)
  const dimValues = distribution?.dimensions
    ? [distribution.dimensions.rigor, distribution.dimensions.computation, distribution.dimensions.modeling, distribution.dimensions.methodUse, distribution.dimensions.speed, distribution.dimensions.strategyInsight].filter((v): v is number => v !== null)
    : []
  const weScore = dimValues.length ? dimValues.reduce((sum, v) => sum + v, 0) / dimValues.length : null

  return (
    <div className="insights-view data-view">
      <div className="data-view-tabs">
        <button
          className={activeTab === 'insights' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('insights')}
        >
          <BarChart3 size={16} />
          <span>数据分析</span>
        </button>
        <button
          className={activeTab === 'inbox' ? 'tab-button active' : 'tab-button'}
          onClick={() => setActiveTab('inbox')}
        >
          <Inbox size={16} />
          <span>Codex 收件箱</span>
          {_data.inboxCount > 0 && <span className="badge">{_data.inboxCount}</span>}
        </button>
      </div>

      {activeTab === 'inbox' ? (
        <InboxView
          notify={notify}
          refresh={_refresh}
          onStartRecommendation={async () => {
            notify('推荐功能暂未实现')
          }}
          onStartVariant={(questionId) => {
            if (onStartVariant) {
              onStartVariant(questionId)
            } else {
              notify(`变式题功能：题目 #${questionId}`)
            }
          }}
          onOpenPressureReport={async (taskId: string) => {
            const success = await onOpenPressureReport(taskId)
            if (success && onJumpToReview) {
              onJumpToReview()
            }
            return success
          }}
        />
      ) : (
        <motion.div className="data-view-scroll" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <section className="data-hero-strip">
              <div>
                <span className="eyebrow">PLAYER CARD · 学习赛季</span>
                <h2>个人数据</h2>
                <p>你的天梯档案：段位、ELO、WE 评分与六维能力，来自近 90 天的所有作答与批改。</p>
              </div>
            </section>

            <section className="rating-heatmap-panel" aria-label="玩家卡片">
              <div className="dw-banner">
                <div className="dw-rank-emblem" style={{ color: rank.color, borderColor: rank.color, background: `color-mix(in srgb, ${rank.color} 14%, var(--surface))`, boxShadow: `0 6px 20px color-mix(in srgb, ${rank.color} 35%, transparent)` }}>
                  {rank.letter}
                </div>
                <div>
                  <div className="dw-rank-tag" style={{ color: rank.color }}>
                    {rank.name} 段{elo && !elo.calibrated ? ` · 定级中 ${Math.min(elo.settlements, 10)}/10` : ''}
                  </div>
                  <div className="dw-score-num">{Math.round(elo?.current ?? 1400)}</div>
                  {rank.next !== null ? (
                    <>
                      <div className="dw-rank-next">
                        距 {csRankForElo(rank.next).name} 段还有 {Math.max(0, Math.ceil(rank.next - (elo?.current ?? 1400)))} 分
                      </div>
                      <div className="dw-progress">
                        <i style={{ width: `${Math.min(100, Math.max(4, (((elo?.current ?? 1400) - rank.min) / (rank.next - rank.min)) * 100))}%`, background: `linear-gradient(90deg, color-mix(in srgb, ${rank.color} 55%, transparent), ${rank.color})` }} />
                      </div>
                    </>
                  ) : (
                    <div className="dw-rank-next">已达最高段位 · 保持状态</div>
                  )}
                </div>
                <div className="dw-rings">
                  {[
                    { value: weScore ?? 0, max: 100, color: '#315E9E', display: weScore === null ? '—' : String(Math.round(weScore)), label: 'WE 制胜评分' },
                    { value: distribution?.mean ?? 0, max: 2, color: '#258a55', display: distribution?.mean?.toFixed(2) ?? '—', label: 'RATING 均值' },
                  ].map((ring) => (
                    <svg key={ring.label} width="92" height="92" viewBox="0 0 92 92">
                      <circle cx="46" cy="46" r="37" fill="none" stroke="var(--line)" strokeWidth="9" />
                      <circle cx="46" cy="46" r="37" fill="none" stroke={ring.color} strokeWidth="9" strokeLinecap="round"
                        strokeDasharray={`${Math.min(1, ring.value / ring.max) * 232.5} 232.5`} transform="rotate(-90 46 46)"
                        style={{ filter: `drop-shadow(0 0 5px color-mix(in srgb, ${ring.color} 45%, transparent))` }} />
                      <text className="dw-ring-num" x="46" y="45" textAnchor="middle">{ring.display}</text>
                      <text className="dw-ring-label" x="46" y="60" textAnchor="middle">{ring.label}</text>
                    </svg>
                  ))}
                </div>
              </div>
              {elo && elo.history.length > 1 && (() => {
                const ratings = elo.history.map((point) => point.rating)
                const viewMin = Math.min(...ratings) - 40
                const viewMax = Math.max(...ratings) + 40
                const span = Math.max(1, viewMax - viewMin)
                const width = 100
                const height = 130
                const coords = elo.history.map((point, i) => [
                  (i / Math.max(1, elo.history.length - 1)) * width,
                  height - ((point.rating - viewMin) / span) * (height - 18) - 6,
                ] as const)
                const last = coords[coords.length - 1]
                const bands = [1000, 1201, 1401, 1601, 1801, 2001, 2201, 2401].filter((b) => b > viewMin && b < viewMax)
                const bandNames: Record<number, string> = { 1000: 'D+', 1201: 'C', 1401: 'C+', 1601: 'B', 1801: 'B+', 2001: 'A', 2201: 'A+', 2401: 'S' }
                return (
                  <div style={{ marginTop: 14 }}>
                    <div className="rating-heatmap-label"><span>ELO 走势（日粒度）</span><em>{elo.history.length} 天 · 悬停查看当日分数</em></div>
                    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: 130, display: 'block' }}>
                      <defs>
                        <linearGradient id="dwTrendFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#315E9E" stopOpacity="0.28" />
                          <stop offset="100%" stopColor="#315E9E" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {bands.map((band) => {
                        const y = height - ((band - viewMin) / span) * (height - 18) - 6
                        return <line key={band} x1="0" y1={y} x2={width} y2={y} stroke="var(--line)" strokeWidth="0.4" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
                      })}
                      <polygon points={`0,${height} ${coords.map(([x, y]) => `${x},${y}`).join(' ')} ${width},${height}`} fill="url(#dwTrendFill)" />
                      <polyline points={coords.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke="#315E9E" strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
                      <circle cx={last[0]} cy={last[1]} r="2.4" fill="#315E9E" className="dw-spark-dot" />
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                      <span>{elo.history[0]?.date}</span>
                      {bands.map((band) => (
                        <span key={`label-${band}`} style={{ color: 'var(--muted)' }}>{bandNames[band]} {band}</span>
                      ))}
                      <span>{elo.history[elo.history.length - 1]?.date}</span>
                    </div>
                  </div>
                )
              })()}
              <div className="dw-stats">
                {[
                  { label: '场次', value: String(distribution?.count ?? 0), tone: '' },
                  { label: '≥1.3 占比', value: `${distribution?.above130 ?? 0}%`, tone: '' },
                  { label: 'P95', value: distribution?.p95?.toFixed(2) ?? '—', tone: '' },
                  { label: 'σ 波动', value: distribution?.sd?.toFixed(2) ?? '—', tone: '' },
                  { label: '结算数', value: String(elo?.settlements ?? 0), tone: '' },
                  { label: '上局变动', value: !elo || elo.lastDelta === null ? '—' : `${elo.lastDelta >= 0 ? '+' : ''}${Math.round(elo.lastDelta)}`, tone: (elo?.lastDelta ?? 0) >= 0 ? '#258a55' : '#c24135' },
                ].map((cell) => (
                  <div className="dw-stat" key={cell.label}>
                    <b style={cell.tone ? { color: cell.tone } : undefined}>{cell.value}</b>
                    <span>{cell.label}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rating-heatmap-panel" aria-label="六维能力雷达">
              <div className="rating-heatmap-label"><span>六维能力</span><em>{distribution?.dimensions ? `基于 ${distribution.dimensions.sample} 次六维批改` : '跑一场批量批改即可点亮'}</em></div>
              {(() => {
                const dims = distribution?.dimensions ?? null
                const values = dims ? [dims.rigor, dims.computation, dims.modeling, dims.methodUse, dims.speed, dims.strategyInsight] : null
                const labels = ['严谨', '计算', '建模', '方法', '速度', '洞察']
                const point = (i: number, v: number, radius = 74) => `${130 + Math.cos(-Math.PI / 2 + (Math.PI * 2 * i) / 6) * radius * (v / 100)},${102 + Math.sin(-Math.PI / 2 + (Math.PI * 2 * i) / 6) * radius * (v / 100)}`
                return (
                  <div className="dw-radar-wrap">
                    <svg viewBox="0 0 260 212" style={{ width: 272, maxWidth: '100%' }}>
                      {[25, 50, 75, 100].map((scale) => (
                        <polygon key={scale} points={labels.map((_, i) => point(i, scale)).join(' ')} fill="none" stroke="var(--line)" strokeWidth="1" />
                      ))}
                      {labels.map((label, i) => (
                        <line key={label} x1={point(i, 0).split(',')[0]} y1={point(i, 0).split(',')[1]} x2={point(i, 100).split(',')[0]} y2={point(i, 100).split(',')[1]} stroke="var(--line)" strokeWidth="1" />
                      ))}
                      <polygon points={(values ?? [0, 0, 0, 0, 0, 0]).map((v, i) => point(i, v ?? 0)).join(' ')} fill="rgba(49,94,158,0.22)" stroke="#315E9E" strokeWidth="2" />
                      {(values ?? [0, 0, 0, 0, 0, 0]).map((v, i) => (
                        <circle key={i} cx={point(i, v ?? 0).split(',')[0]} cy={point(i, v ?? 0).split(',')[1]} r="2.6" fill="#315E9E" />
                      ))}
                      {labels.map((label, i) => (
                        <text key={label} x={point(i, 100, 92).split(',')[0]} y={point(i, 100, 92).split(',')[1]} textAnchor="middle" fontSize="11" fill="var(--muted)">{label}</text>
                      ))}
                    </svg>
                    <div style={{ display: 'grid', gap: 7 }}>
                      {['严谨性', '计算力', '审题建模', '方法使用', '速度', '策略洞察'].map((label, i) => {
                        const value = values?.[i] ?? null
                        const grade = dimensionGrade(value)
                        const gradeColor = grade === 'S' ? '#D9A62E' : grade === 'A' ? '#258a55' : grade === 'B' ? '#151515' : '#c24135'
                        return (
                          <div className="dw-dim-row" key={label}>
                            <span>{label}</span>
                            <b>{value === null ? '—' : value.toFixed(1)}</b>
                            <span className="dw-grade" style={{ color: gradeColor, border: `1px solid ${gradeColor}66`, background: `${gradeColor}1A` }}>{grade}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </section>

            <section className="rating-heatmap-panel" aria-label="Rating 分布审计">
              <div className="rating-heatmap-label">
                <span>近 90 天 rating 分布</span>
                <strong>{distribution && distribution.mean !== null ? `均值 ${distribution.mean.toFixed(2)} · σ ${distribution.sd?.toFixed(2) ?? '—'}` : '—'}</strong>
                <em>{distribution && distribution.count > 0 ? `${distribution.count} 次作答 · ≥1.3 占 ${distribution.above130}%` : '等待评分数据'}</em>
              </div>
              {distribution && distribution.count > 0 && (
                <>
                  <div className="dw-hist">
                    {distribution.buckets.map((bucket) => {
                      const max = Math.max(...distribution.buckets.map((b) => b.count), 1)
                      const color = bucket.floor + 0.05 >= 0.98 && bucket.floor < 1.07 ? '#151515' : bucket.floor + 0.05 >= 1.07 ? '#258a55' : '#c24135'
                      return <i key={bucket.floor} title={`${bucket.floor.toFixed(1)}–${(bucket.floor + 0.1).toFixed(1)}：${bucket.count} 次`} style={{ height: `${Math.max(3, (bucket.count / max) * 100)}%`, background: `linear-gradient(180deg, ${color}, ${color}AA)` }} />
                    })}
                  </div>
                  <div className="dw-hist-axis"><span>0.0</span><span>0.5</span><span>1.0</span><span>1.5</span><span>2.0</span></div>
                </>
              )}
              {distribution?.drift && <p className="dw-drift">⚠ 均值偏离 1.00 超过 ±0.08，评分体系可能漂移，考虑校准提示词锚点或 ELO 期望。</p>}
            </section>

            <section className="data-hero-strip">
              <div>
                <span className="eyebrow">RECENT MATCHES · 学习赛季</span>
                <h2>历史战绩</h2>
                <p>每一次测试都是一场比赛。点击记录，查看完整批改报告与六维 rating。</p>
              </div>
              <button className="secondary-button compact" onClick={() => void loadData()} disabled={loading}>
                {loading ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />} 刷新
              </button>
            </section>

            <section className="rating-heatmap-panel" aria-label="近期 rating 走势">
              <div className="rating-heatmap-label">
                <span>近 21 天</span>
                <strong className={`rating-number rating-${csRatingTone(averageRating)}`}>{averageRating === null ? '—' : averageRating.toFixed(2)}</strong>
                <em>{winRate === null ? '等待首场测试' : `${winRate}% 胜率`}</em>
              </div>
              <div className="rating-heatmap-grid">
                {heatmap.map((point) => {
                  const rating = point.rating === null ? null : Math.max(CS_RATING_MIN, Math.min(CS_RATING_MAX, point.rating))
                  const tone = csRatingTone(rating)
                  return (
                    <span key={point.date} className={`rating-heatmap-cell ${tone}`} title={`${point.date} · ${rating === null ? '暂无 rating' : `rating ${rating.toFixed(2)}`}`}>
                      {rating !== null && <i />}
                    </span>
                  )
                })}
                {Array.from({ length: Math.max(0, 21 - heatmap.length) }).map((_, index) => <span key={`empty-${index}`} className="rating-heatmap-cell empty" />)}
              </div>
              <div className="rating-heatmap-legend"><span><i className="low" />低于 0.98</span><span><i className="average" />0.98–1.07</span><span><i className="high" />高于 1.07</span></div>
            </section>

            <section className="match-history-panel">
              <header className="match-history-header">
                <div>
                  <h3>历史战绩</h3>
                  <p>共 {sessions.length} 场测试 · 已完成 {completed} 场</p>
                </div>
                <span className="match-filter">全部模式⌄</span>
              </header>
              {sessions.length === 0 ? (
                <div className="empty-state match-empty">
                  <BarChart3 size={32} />
                  <h3>还没有测试记录</h3>
                  <p>完成一次高压演练后，这里会像 CS 历史战绩一样记录你的表现。</p>
                </div>
              ) : (
                <div className="match-table" role="table" aria-label="历史测试记录">
                  <div className="match-table-head" role="row">
                    <span>时间</span><span>测试类型</span><span>题组</span><span>题数</span><span>正确率</span><span>结果</span><span>用时</span><span>Rating</span><span>报告</span>
                  </div>
                  {sessions.map((session) => {
                    const report = reports[session.sessionId] ?? null
                    const result = resultFor(report, session)
                    const rating = averageReportRating(report)
                    const accuracy = accuracyPercent(report)
                    const questionCount = session.questionIds?.length ?? session.questions?.length ?? 0
                    const isClickable = Boolean(report) || ['awaiting_codex', 'graded', 'graded_partial'].includes(session.status)
                    return (
                      <button
                        type="button"
                        key={session.sessionId}
                        className={`match-table-row ${isClickable ? 'clickable' : ''}`}
                        onClick={() => isClickable && void onOpenPressureReport(session.sessionId)}
                        disabled={!isClickable}
                      >
                        <span className="match-time">{formatMatchTime(session.startTime)}</span>
                        <span className="match-type">高压演练 <small>· 数学一</small></span>
                        <span>{questionCount ? `${questionCount} 题训练` : '纸笔测试'}</span>
                        <span>{questionCount || '—'}</span>
                        <span>{accuracy === null ? '—' : `${accuracy}%`}</span>
                        <span><b className={`match-result ${result}`}>{result === 'win' ? <CheckCircle2 size={13} /> : result === 'loss' ? <XCircle size={13} /> : <Clock3 size={13} />}{result === 'win' ? '胜' : result === 'loss' ? '负' : '待批改'}</b></span>
                        <span>{session.totalDuration ? formatElapsed(session.totalDuration * 1000) : '—'}</span>
                        <span className={`match-rating rating-${csRatingTone(rating)}`}>{rating === null ? '—' : rating.toFixed(2)}</span>
                        <span className="match-report-link">{isClickable ? <><FileText size={14} /><ArrowUpRight size={13} /></> : '—'}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </section>
      </motion.div>
      )}
    </div>
  )
}

