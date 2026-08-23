import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Crosshair,
  FileText,
  Flame,
  Heart,
  HelpCircle,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Sword,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  addToCustomQueue,
  getDailyTrend,
  getEloStatus,
  getPressureGradingReport,
  getRatingDistribution,
  getTacticalDashboardStats,
  getTagClosure,
  getTodayAttemptedQuestions,
  getWeaknessRadar,
  listPressureSessions,
  toggleFavorite,
} from '../api'
import {
  CS_RATING_MAX,
  CS_RATING_MIN,
  averageCsRating,
  csRatingTone,
  deriveGradeCsRating,
  formatElapsed,
  predictedExamScore,
} from '../utils'
import { MathText } from '../components/MathText'
import { QuestionDetail } from '../components/QuestionDetailModal'
import { FriendsLadderView } from '../components/FriendsLadderView'
import { InboxView } from './InboxView'
import type {
  BootstrapData,
  DailyTrendPoint,
  EloStatus,
  GradingReport,
  PressureSession,
  Question,
  RatingDistribution,
  TacticalDashboardData,
  TagClosure,
  TodayAttemptItem,
  WeaknessRadar,
} from '../types'

type DataTab = 'overview' | 'friends' | 'matches' | 'mistakes' | 'inbox'
type ScopeMode = 'ranked' | 'all' | 'solo'

function averageReportRating(report: GradingReport | null): number | null {
  if (!report || report.grades.length === 0) return null
  const averageDuration =
    report.summary.averageDuration ??
    Math.round(
      (report.summary.totalDuration ??
        report.grades.reduce((sum, grade) => sum + Math.max(0, grade.duration || 0), 0)) /
        Math.max(1, report.summary.totalCount || report.grades.length)
    )
  const ratings = report.grades.map((grade) => {
    const outcome =
      grade.verdict === 'partial'
        ? 'partial'
        : grade.verdict === 'uncertain' || grade.result === 'uncertain'
        ? 'uncertain'
        : grade.verdict === 'incorrect' || grade.result === 'wrong' || !grade.correct
        ? 'wrong'
        : 'correct'
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
  data,
  refresh,
  onStartTagPractice,
  onStartRecommendation,
  onStartVariant,
  initialTab,
  notify,
  onOpenPressureReport,
}: {
  data: BootstrapData
  refresh: () => void
  onStartTagPractice: (tagName: string) => void
  onStartRecommendation?: (taskId: string) => Promise<void>
  onStartVariant?: (questionId: number) => void
  initialTab: 'overview' | 'inbox' | 'pressure'
  notify: (text: string) => void
  onOpenPressureReport: (taskId: string) => Promise<boolean>
}) {
  const [tab, setTab] = useState<DataTab>(initialTab === 'inbox' ? 'inbox' : 'overview')
  const [scopeMode, setScopeMode] = useState<ScopeMode>('ranked')
  const [selectedWeaponIdx, setSelectedWeaponIdx] = useState(0)
  const [selectedMapIdx, setSelectedMapIdx] = useState(0)
  const [tacticalData, setTacticalData] = useState<TacticalDashboardData | null>(null)

  const [distribution, setDistribution] = useState<RatingDistribution | null>(null)
  const [elo, setElo] = useState<EloStatus | null>(null)
  const [weakness, setWeakness] = useState<WeaknessRadar | null>(null)
  const [tagClosure, setTagClosure] = useState<TagClosure[]>([])

  const loadTactical = async (scope: ScopeMode) => {
    try {
      const stats = await getTacticalDashboardStats(scope)
      setTacticalData(stats)
    } catch {
      // Keep existing data on error
    }
  }

  useEffect(() => {
    void loadTactical(scopeMode)
  }, [scopeMode])

  useEffect(() => {
    void getRatingDistribution().then(setDistribution).catch(() => undefined)
    void getEloStatus().then(setElo).catch(() => undefined)
    void getTagClosure().then(setTagClosure).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (tab === 'mistakes' && !weakness) void getWeaknessRadar().then(setWeakness).catch(() => undefined)
  }, [tab, weakness])

  const [trend, setTrend] = useState<DailyTrendPoint[]>([])
  const [sessions, setSessions] = useState<PressureSession[]>([])
  const [reports, setReports] = useState<Record<string, GradingReport | null>>({})
  const [loading, setLoading] = useState(false)

  const [todayAttempts, setTodayAttempts] = useState<TodayAttemptItem[]>([])
  const [todayDrawerOpen, setTodayDrawerOpen] = useState(false)
  const [todayFilter, setTodayFilter] = useState<'all' | 'wrong' | 'favorite'>('all')
  const [detailQuestion, setDetailQuestion] = useState<Question | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const loadTodayAttempts = async () => {
    try {
      const items = await getTodayAttemptedQuestions()
      setTodayAttempts(items)
    } catch {
      // Ignore
    }
  }

  const handleToggleFavToday = async (qId: number) => {
    try {
      const nextFav = await toggleFavorite(qId)
      setTodayAttempts((prev) =>
        prev.map((item) =>
          item.questionId === qId
            ? { ...item, question: { ...item.question, favorite: nextFav } }
            : item
        )
      )
      setToastMsg(nextFav ? `⭐ 题目 #${qId} 已加入收藏夹` : `已取消题目 #${qId} 收藏`)
      setTimeout(() => setToastMsg(null), 2000)
    } catch {
      setToastMsg('收藏操作失败，请重试')
      setTimeout(() => setToastMsg(null), 2000)
    }
  }

  const filteredTodayAttempts = useMemo(() => {
    if (todayFilter === 'wrong') {
      return todayAttempts.filter((t) => t.outcome !== 'correct')
    }
    if (todayFilter === 'favorite') {
      return todayAttempts.filter((t) => t.question.favorite)
    }
    return todayAttempts
  }, [todayAttempts, todayFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      const [nextTrend, nextSessions] = await Promise.all([
        getDailyTrend(),
        listPressureSessions(),
        loadTodayAttempts(),
      ])
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
        })
      )
      setReports(Object.fromEntries(reportEntries))
    } catch (error) {
      notify(`加载数据失败：${String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTodayAttempts()
  }, [])

  useEffect(() => {
    setTab(initialTab === 'inbox' ? 'inbox' : 'overview')
  }, [initialTab])

  useEffect(() => {
    if (tab === 'matches') void loadData()
  }, [tab])

  const ratedSessions = useMemo(
    () =>
      sessions
        .map((session) => averageReportRating(reports[session.sessionId]))
        .filter((rating): rating is number => rating !== null),
    [reports, sessions]
  )
  const averageRating = averageCsRating(ratedSessions)
  const wins = sessions.filter((session) => resultFor(reports[session.sessionId], session) === 'win').length
  const completed = sessions.filter((session) => ['graded', 'graded_partial'].includes(session.status)).length
  const winRate = completed ? Math.round((wins / completed) * 100) : null
  const heatmap = trend.slice(-21)

  const sixDimensions = useMemo(() => {
    if (tacticalData && tacticalData.dimensions.length === 6) {
      return tacticalData.dimensions
    }
    const dims = distribution?.dimensions ?? null
    return [
      { key: 'rigor', label: '严谨性', value: dims?.rigor ?? 84 },
      { key: 'computation', label: '计算力', value: dims?.computation ?? 86 },
      { key: 'speed', label: '速度', value: dims?.speed ?? 86 },
      { key: 'modeling', label: '审题建模', value: dims?.modeling ?? 87 },
      { key: 'methodUse', label: '方法使用', value: dims?.methodUse ?? 84 },
      { key: 'strategyInsight', label: '策略洞察力', value: dims?.strategyInsight ?? 84 },
    ]
  }, [tacticalData, distribution])

  const profile = tacticalData?.profile
  const weScore = profile?.weScore ?? 85.2
  const ratingPro = profile?.ratingPro ?? 1.46

  const radarPoint = (index: number, value: number, radius = 70) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / 6
    const x = 120 + Math.cos(angle) * radius * (value / 100)
    const y = 100 + Math.sin(angle) * radius * (value / 100)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }

  const radarShape = sixDimensions.map((item, idx) => radarPoint(idx, item.value)).join(' ')
  const mapSubjects = tacticalData?.mapSubjects ?? []
  const currentMap = mapSubjects[selectedMapIdx] ?? mapSubjects[0] ?? {
    id: 'single_calculus',
    name: '一元微积分与极限',
    mapAlias: '荒漠迷城 (Mirage)',
    totalQuestions: 1325,
    attemptedCount: 159,
    correctCount: 86,
    winRate: 54.1,
    ratingPro: 1.13,
    adr: 108,
    avgKills: 17.2,
    firepower: 96,
    ctWinRate: 58,
    tWinRate: 52,
    masteryGrade: 'B',
  }

  const weapons = tacticalData?.weapons ?? []
  const currentWeapon = weapons[selectedWeaponIdx] ?? weapons[0] ?? {
    id: 'ak47',
    name: 'AK-47',
    alias: '步枪之王',
    methodName: '泰勒展开与等价无穷小',
    killTime: 494,
    killTimeGrade: 'A',
    kills: 86,
    totalAttempts: 159,
    sprayAccuracy: 54.1,
    sprayGrade: 'B',
    headshotRate: 62.4,
    headshotGrade: 'A',
    quickStopRate: 83.5,
    quickStopGrade: 'A',
    avgKills: 6.6,
    avgKillsGrade: 'B',
  }

  const specialtySkills = tacticalData?.specialtySkills ?? [
    { id: 'gunplay', label: '枪法', icon: 'Crosshair', grade: 'A', score: 86, desc: '基础计算与选填定性判断' },
    { id: 'trade', label: '补枪', icon: 'Zap', grade: 'C', score: 55, desc: '错题订正复盘与二刷闭环率' },
    { id: 'entry', label: '突破', icon: 'TrendingUp', grade: 'A', score: 86, desc: '新题快速破局与首刷秒杀率' },
    { id: 'utility', label: '道具', icon: 'ShieldAlert', grade: 'B', score: 84, desc: '公式定理熟练度与秒杀技巧' },
    { id: 'clutch', label: '残局', icon: 'Target', grade: 'S', score: 92, desc: '高分综合解答题攻坚抗压能力' },
    { id: 'sniper', label: '狙击', icon: 'Crosshair', grade: 'S', score: 90, desc: '三星核心难点考题精准突破' },
  ]

  const getSkillIcon = (iconName: string) => {
    switch (iconName) {
      case 'Zap':
        return <Zap size={14} />
      case 'TrendingUp':
        return <TrendingUp size={14} />
      case 'ShieldAlert':
        return <ShieldAlert size={14} />
      case 'Target':
        return <Target size={14} />
      default:
        return <Crosshair size={14} />
    }
  }

  return (
    <div className="insights-view data-view tactical-dashboard-view">
      <div className="insights-tabs data-tabs tactical-nav-tabs">
        <div className="segmented">
          <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>
            <BarChart3 size={16} /> 个人战绩
          </button>
          <button className={tab === 'friends' ? 'active' : ''} onClick={() => setTab('friends')}>
            <Users size={16} /> 天梯好友
          </button>
          <button className={tab === 'matches' ? 'active' : ''} onClick={() => setTab('matches')}>
            <Clock3 size={16} /> 比赛记录
          </button>
          <button className={tab === 'mistakes' ? 'active' : ''} onClick={() => setTab('mistakes')}>
            <XCircle size={16} /> 错题复盘
          </button>
          <button className={tab === 'inbox' ? 'active' : ''} onClick={() => setTab('inbox')}>
            <Sparkles size={16} /> Codex 诊断
            {data.inboxCount > 0 && <span className="nav-badge">{data.inboxCount}</span>}
          </button>
        </div>

        <div className="tactical-top-controls">
          {tab === 'overview' && (
            <div className="scope-segmented">
              <button
                type="button"
                className={scopeMode === 'ranked' ? 'active' : ''}
                onClick={() => setScopeMode('ranked')}
                title="高压模考与排位计时作答"
              >
                天梯排位
              </button>
              <button
                type="button"
                className={scopeMode === 'all' ? 'active' : ''}
                onClick={() => setScopeMode('all')}
                title="全量题库刷题作答统计"
              >
                官匹数据
              </button>
              <button
                type="button"
                className={scopeMode === 'solo' ? 'active' : ''}
                onClick={() => setScopeMode('solo')}
                title="专项突破与错题消灭"
              >
                天梯单挑
              </button>
            </div>
          )}
          {tab === 'overview' && (
            <div className="season-selector-chip" title="周赛季制：每周一 00:00 开启，周日晚 24:00 自动结算">
              <span>赛季：{tacticalData?.currentSeason ?? 'S1'}</span>
              <ChevronDown size={14} />
            </div>
          )}
          <button
            type="button"
            className="tactical-today-drawer-btn"
            onClick={() => setTodayDrawerOpen(true)}
            title="查看今日做过的所有题目，快速收藏与复盘"
          >
            <CheckCircle2 size={14} />
            <span>今日已刷 {todayAttempts.length} 题</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {tab === 'inbox' && onStartRecommendation && onStartVariant ? (
          <motion.div
            key="inbox"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <InboxView
              notify={notify}
              refresh={refresh}
              onStartRecommendation={onStartRecommendation}
              onStartVariant={onStartVariant}
              onOpenPressureReport={onOpenPressureReport}
            />
          </motion.div>
        ) : tab === 'friends' ? (
          <motion.div
            key="friends"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <FriendsLadderView
              tacticalData={tacticalData}
              bootstrapData={data}
              eloStatus={elo}
              notify={notify}
            />
          </motion.div>
        ) : tab === 'overview' ? (
          <motion.div
            key={`overview-${scopeMode}`}
            className="tactical-dashboard-grid"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* 1. 主数据 */}
            <section className="tactical-card combat-card">
              <div className="combat-profile-header">
                <div className="combat-avatar-box">
                  <div className="combat-avatar-glow" />
                  <div className="combat-avatar-img">
                    <span>考研</span>
                  </div>
                </div>
                <div className="combat-user-info">
                  <div className="combat-user-row">
                    <h3 className="combat-username">{profile?.nickname ?? 'dr7fter'}</h3>
                    <span className="combat-power-tag">完美战力 {profile?.combatPower ?? 3558}</span>
                    <span className="combat-exam-tag" title="基于 HLTV Rating 3.0 与防白给率的考研数学一考场预测分">
                      🎯 考场预估 {predictedExamScore(ratingPro, 82)} / 150
                    </span>
                  </div>
                </div>
                <div className="combat-dual-badges">
                  <div className="tactical-rank-badge" title="赛季历史最高段位">
                    <div className="rank-shield">{profile?.peakRankLetter ?? 'A'}</div>
                    <div className="rank-info">
                      <strong>{Math.round(profile?.peakElo ?? elo?.current ?? 1956)}</strong>
                      <span>赛季</span>
                    </div>
                  </div>
                  <div className="tactical-rank-badge current" title="当前实时天梯段位">
                    <div className="rank-shield">{profile?.currentRankLetter ?? 'A'}</div>
                    <div className="rank-info">
                      <strong>{Math.round(profile?.currentElo ?? elo?.current ?? 1956)}</strong>
                      <span>当前</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="combat-meters-and-stats">
                <div className="combat-ring-gauges">
                  <div className="ring-gauge-item">
                    <span className="ring-gauge-title">
                      WE 制胜评价 <TrendingUp size={12} className="trend-icon-up" />
                    </span>
                    <div className="ring-gauge-svg-wrap">
                      <svg width="104" height="104" viewBox="0 0 104 104">
                        <circle cx="52" cy="52" r="42" fill="none" stroke="var(--line)" strokeWidth="8" />
                        <circle
                          cx="52"
                          cy="52"
                          r="42"
                          fill="none"
                          stroke="var(--green)"
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${Math.min(264, Math.max(10, (weScore / 100) * 264))} 264`}
                          transform="rotate(-90 52 52)"
                          className="glowing-ring"
                        />
                      </svg>
                      <div className="ring-gauge-center">
                        <strong>{(weScore / 7.2).toFixed(1)}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="ring-gauge-item">
                    <span className="ring-gauge-title">
                      Rating Pro <TrendingUp size={12} className="trend-icon-up" />
                    </span>
                    <div className="ring-gauge-svg-wrap">
                      <svg width="104" height="104" viewBox="0 0 104 104">
                        <circle cx="52" cy="52" r="42" fill="none" stroke="var(--line)" strokeWidth="8" />
                        <circle
                          cx="52"
                          cy="52"
                          r="42"
                          fill="none"
                          stroke="var(--cyan)"
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={`${Math.min(264, Math.max(10, (ratingPro / 2.0) * 264))} 264`}
                          transform="rotate(-90 52 52)"
                          className="glowing-ring"
                        />
                      </svg>
                      <div className="ring-gauge-center">
                        <strong>{ratingPro.toFixed(2)}</strong>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="combat-metrics-matrix">
                  <div className="matrix-cell">
                    <span>赛季场次</span>
                    <strong>{profile?.matches ?? 0}</strong>
                  </div>
                  <div className="matrix-cell">
                    <span>
                      胜率{' '}
                      {(profile?.winRate ?? 0) >= 50 ? (
                        <TrendingUp size={11} className="trend-icon-up" />
                      ) : (
                        <TrendingDown size={11} className="trend-icon-down" />
                      )}
                    </span>
                    <strong>
                      {profile?.winRate.toFixed(1) ?? '0.0'}
                      <small>%</small>
                    </strong>
                  </div>
                  <div className="matrix-cell">
                    <span>
                      秒杀率 <TrendingDown size={11} className="trend-icon-down" />
                    </span>
                    <strong>
                      {profile?.headshotRate.toFixed(1) ?? '0.0'}
                      <small>%</small>
                    </strong>
                  </div>
                  <div className="matrix-cell">
                    <span>
                      ADR <TrendingUp size={11} className="trend-icon-up" />
                    </span>
                    <strong className="cyan-accent">{profile?.adr ?? 0}</strong>
                  </div>
                  <div className="matrix-cell">
                    <span>
                      K/D <TrendingUp size={11} className="trend-icon-up" />
                    </span>
                    <strong className="cyan-accent">{profile?.kdRatio.toFixed(2) ?? '0.00'}</strong>
                  </div>
                  <div className="matrix-cell">
                    <span>
                      KAST 防白给 <TrendingUp size={11} className="trend-icon-up" />
                    </span>
                    <strong className="cyan-accent">84.5<small>%</small></strong>
                  </div>
                  <div className="matrix-cell">
                    <span>
                      RWS <TrendingUp size={11} className="trend-icon-up" />
                    </span>
                    <strong className="cyan-accent">{profile?.rws.toFixed(2) ?? '0.00'}</strong>
                  </div>
                  <div className="matrix-cell">
                    <span>
                      考场预估分
                    </span>
                    <strong style={{ color: 'var(--green)' }}>{predictedExamScore(ratingPro, 82)}<small style={{ color: 'var(--muted)', fontSize: '11px' }}> /150</small></strong>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. 个人表现 */}
            <section className="tactical-card ability-card">
              <header className="tactical-card-header">
                <div className="ability-title-row">
                  <h3>个人表现</h3>
                  <span title="六维战术能力综合评测与特化专精等级">
                    <HelpCircle size={14} className="help-icon" />
                  </span>
                  <span className="tactical-title-tag">{profile?.title ?? '一锤定音的战场收割者'}</span>
                </div>
                <div className="season-mini-selector" title="当前备考赛季">
                  <span>赛季</span>
                  <ChevronDown size={12} />
                </div>
              </header>

              <div className="ability-layout">
                <div className="ability-skills-col">
                  <div className="firepower-banner">
                    <div className="firepower-label">
                      <Flame size={16} />
                      <span>火力</span>
                    </div>
                    <div className="firepower-bar-wrap">
                      <div className="firepower-bar-fill" style={{ width: `${profile?.firepower ?? 98}%` }} />
                    </div>
                    <strong className="firepower-num">{profile?.firepower ?? 98}</strong>
                  </div>

                  <div className="specialty-skills-grid">
                    {specialtySkills.map((skill) => (
                      <div className="skill-cell" key={skill.id} title={skill.desc}>
                        {getSkillIcon(skill.icon)}
                        <span>{skill.label}</span>
                        <strong className={`grade-badge ${skill.grade.toLowerCase()}`}>{skill.grade} 级</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="six-dimension-wrap">
                  <div className="six-radar-svg-col">
                    <svg viewBox="0 0 240 200" className="six-radar-svg">
                      {[25, 50, 75, 100].map((scale) => (
                        <polygon
                          key={scale}
                          points={sixDimensions.map((_, i) => radarPoint(i, scale)).join(' ')}
                          fill="none"
                          stroke="var(--line)"
                          strokeWidth="1"
                        />
                      ))}
                      {sixDimensions.map((_, i) => (
                        <line
                          key={i}
                          x1="120"
                          y1="100"
                          x2={radarPoint(i, 100).split(',')[0]}
                          y2={radarPoint(i, 100).split(',')[1]}
                          stroke="var(--line)"
                          strokeWidth="1"
                        />
                      ))}
                      <polygon
                        points={radarShape}
                        fill="color-mix(in srgb, var(--green) 22%, transparent)"
                        stroke="var(--green)"
                        strokeWidth="2.2"
                      />
                      {sixDimensions.map((dim, i) => (
                        <circle
                          key={dim.key}
                          cx={radarPoint(i, dim.value).split(',')[0]}
                          cy={radarPoint(i, dim.value).split(',')[1]}
                          r="3"
                          fill="var(--green)"
                        />
                      ))}
                      {sixDimensions.map((dim, i) => {
                        const [tx, ty] = radarPoint(i, 118).split(',')
                        return (
                          <text
                            key={dim.key}
                            x={tx}
                            y={Number(ty) + 4}
                            textAnchor="middle"
                            fontSize="11"
                            fontWeight="600"
                            fill="var(--ink)"
                          >
                            {dim.label}
                          </text>
                        )
                      })}
                    </svg>
                  </div>

                  <div className="six-bars-list">
                    {sixDimensions.map((dim) => (
                      <div className="six-bar-row" key={dim.key}>
                        <span className="six-bar-label">{dim.label}</span>
                        <strong className="six-bar-val">{Math.round(dim.value)}</strong>
                        <div className="six-bar-track">
                          <div className="six-bar-fill" style={{ width: `${Math.min(100, Math.max(8, dim.value))}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* 3. 地图表现 */}
            <section className="tactical-card map-card">
              <header className="tactical-card-header">
                <h3>地图表现</h3>
              </header>

              <div className="map-chart-and-detail">
                <div className="map-vertical-bars">
                  {mapSubjects.map((subj, idx) => (
                    <div
                      key={subj.id}
                      className={`map-bar-col ${selectedMapIdx === idx ? 'selected' : ''}`}
                      onClick={() => setSelectedMapIdx(idx)}
                      title={`${subj.name} · 做题 ${subj.attemptedCount}/${subj.totalQuestions} · 胜率 ${subj.winRate}%`}
                    >
                      <span className="map-bar-count">{subj.attemptedCount}</span>
                      <div className="map-bar-track">
                        <div
                          className="map-bar-fill"
                          style={{
                            height: `${Math.max(8, Math.min(100, subj.winRate || (subj.attemptedCount > 0 ? 15 : 6)))}%`,
                            opacity: subj.attemptedCount > 0 ? 1 : 0.45,
                          }}
                        />
                      </div>
                      <span className="map-bar-rate">
                        {subj.attemptedCount > 0 ? `${subj.winRate.toFixed(0)}%` : '0%'}
                      </span>
                      <div className="map-bar-icon-badge">
                        <span className={`badge-letter ${subj.masteryGrade.toLowerCase()}`}>
                          {subj.masteryGrade}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="map-detail-block">
                  <div className="map-detail-selector">
                    <div className="map-thumbnail-chip" title="切换当前高频考点地图">
                      <Target size={14} />
                      <span>{currentMap.name}</span>
                      <ChevronDown size={14} />
                    </div>
                  </div>

                  <div className="map-stat-row main-stats">
                    <div className="map-main-stat">
                      <span>场次 (已刷/总题)</span>
                      <strong>
                        {currentMap.attemptedCount}
                        <small style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)' }}>
                          {' '}
                          / {currentMap.totalQuestions}
                        </small>
                      </strong>
                    </div>
                    <div className="map-main-stat">
                      <span>胜率</span>
                      <strong>{currentMap.winRate.toFixed(1)}%</strong>
                    </div>
                  </div>

                  <div className="map-metrics-grid">
                    <div className="map-sub-stat">
                      <span>Rating Pro</span>
                      <strong>{currentMap.ratingPro > 0 ? currentMap.ratingPro.toFixed(2) : '—'}</strong>
                    </div>
                    <div className="map-sub-stat">
                      <span>ADR</span>
                      <strong>{currentMap.adr}</strong>
                    </div>
                    <div className="map-sub-stat">
                      <span>场均击杀</span>
                      <strong>{currentMap.avgKills}</strong>
                    </div>
                    <div className="map-sub-stat">
                      <span>火力值</span>
                      <strong>{currentMap.firepower}</strong>
                    </div>
                    <div className="map-sub-stat">
                      <span>CT胜率 (概念题)</span>
                      <strong>{currentMap.ctWinRate}%</strong>
                    </div>
                    <div className="map-sub-stat">
                      <span>T胜率 (计算题)</span>
                      <strong>{currentMap.tWinRate}%</strong>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 4. 武器表现 */}
            <section className="tactical-card weapon-card">
              <header className="tactical-card-header">
                <h3>武器分析</h3>
              </header>

              <div className="weapon-selector-tabs">
                {weapons.map((w, idx) => (
                  <button
                    key={w.id}
                    type="button"
                    className={`weapon-tab-btn ${selectedWeaponIdx === idx ? 'active' : ''}`}
                    onClick={() => setSelectedWeaponIdx(idx)}
                    title={w.methodName}
                  >
                    <div className="weapon-tab-inner">
                      <Sword size={16} />
                      <span>{w.name}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="weapon-detail-view">
                <div className="weapon-hud-display">
                  <div className="weapon-banner-title">
                    <h4>{currentWeapon.name}</h4>
                    <span className="weapon-method-badge">{currentWeapon.methodName}</span>
                  </div>

                  <div className="weapon-metrics-grid">
                    <div className="wmetric-item">
                      <span className="wmetric-title">击杀时间</span>
                      <div className="wmetric-val-row">
                        <strong>
                          {currentWeapon.killTime}
                          <small>MS</small>
                        </strong>
                        <span className={`wmetric-grade ${currentWeapon.killTimeGrade.toLowerCase()}`}>
                          {currentWeapon.killTimeGrade}
                        </span>
                      </div>
                    </div>

                    <div className="wmetric-item">
                      <span className="wmetric-title">击杀数 (正确/总作答)</span>
                      <div className="wmetric-val-row">
                        <strong>
                          {currentWeapon.kills}
                          <small style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)' }}>
                            {' '}
                            / {currentWeapon.totalAttempts}
                          </small>
                        </strong>
                      </div>
                    </div>

                    <div className="wmetric-item">
                      <span className="wmetric-title">扫射精准度</span>
                      <div className="wmetric-val-row">
                        <strong>{currentWeapon.sprayAccuracy.toFixed(1)}%</strong>
                        <span className={`wmetric-grade ${currentWeapon.sprayGrade.toLowerCase()}`}>
                          {currentWeapon.sprayGrade}
                        </span>
                      </div>
                    </div>

                    <div className="wmetric-item">
                      <span className="wmetric-title">爆头率</span>
                      <div className="wmetric-val-row">
                        <strong>{currentWeapon.headshotRate.toFixed(1)}%</strong>
                        <span className={`wmetric-grade ${currentWeapon.headshotGrade.toLowerCase()}`}>
                          {currentWeapon.headshotGrade}
                        </span>
                      </div>
                    </div>

                    <div className="wmetric-item">
                      <span className="wmetric-title">急停成功率</span>
                      <div className="wmetric-val-row">
                        <strong>{currentWeapon.quickStopRate.toFixed(1)}%</strong>
                        <span className={`wmetric-grade ${currentWeapon.quickStopGrade.toLowerCase()}`}>
                          {currentWeapon.quickStopGrade}
                        </span>
                      </div>
                    </div>

                    <div className="wmetric-item">
                      <span className="wmetric-title">场均击杀</span>
                      <div className="wmetric-val-row">
                        <strong>{currentWeapon.avgKills}</strong>
                        <span className={`wmetric-grade ${currentWeapon.avgKillsGrade.toLowerCase()}`}>
                          {currentWeapon.avgKillsGrade}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </motion.div>
        ) : tab === 'mistakes' ? (
          <motion.div key="mistakes" className="matches-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <section className="data-hero-strip">
              <div>
                <span className="eyebrow">MISTAKES · 错题复盘</span>
                <h2>薄弱点档案</h2>
                <p>来自批改诊断的错误类型与薄弱知识聚合，点击标签直接开始专项训练。</p>
              </div>
            </section>
            {(['errorTags', 'weaknessTags'] as const).map((group) => (
              <section key={group} className="rating-heatmap-panel">
                <div className="rating-heatmap-label">
                  <span>{group === 'errorTags' ? '错误类型' : '薄弱知识'}</span>
                  <em>{(weakness?.[group] ?? []).length} 项</em>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {(weakness?.[group] ?? []).map((item) => {
                    const closure = group === 'weaknessTags' ? tagClosure.find((c) => c.tag === item.tag) : undefined
                    const arrow = !closure?.delta ? '' : closure.delta >= 10 ? ' ↑' : closure.delta <= -10 ? ' ↓' : ' →'
                    const arrowColor = !closure?.delta ? 'var(--muted)' : closure.delta >= 10 ? '#258a55' : closure.delta <= -10 ? '#c24135' : 'var(--muted)'
                    return (
                      <button
                        key={item.tag}
                        type="button"
                        className="qtimer-btn"
                        onClick={() => onStartTagPractice(item.tag)}
                        title={
                          closure
                            ? `开始该标签专项训练 · 关联 ${closure.questionCount} 题 · 近7天 ${closure.recentCorrect}/${closure.recentTotal} vs 之前 ${closure.beforeCorrect}/${closure.beforeTotal}`
                            : '开始该标签专项训练'
                        }
                      >
                        {item.tag} × {item.count}
                        {arrow && <span style={{ color: arrowColor, fontWeight: 800 }}>{arrow}</span>}
                      </button>
                    )
                  })}
                  {!(weakness?.[group] ?? []).length && <span style={{ color: 'var(--muted)', fontSize: 13 }}>暂无诊断数据，跑一场批量批改后会在这里聚合。</span>}
                </div>
              </section>
            ))}
          </motion.div>
        ) : (
          <motion.div key="matches" className="matches-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
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
      </AnimatePresence>

      {/* 今日做题战报清单滑出抽屉 */}
      <AnimatePresence>
        {todayDrawerOpen && (
          <motion.div
            className="ui-overlay drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setTodayDrawerOpen(false)}
          >
            <motion.aside
              className="tactical-today-drawer"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="tactical-drawer-header">
                <div>
                  <span className="tactical-kicker-tag">
                    <Clock3 size={13} /> TODAY'S COMBAT LOG · 今日战绩清单
                  </span>
                  <h3>今日作答题目 ({todayAttempts.length})</h3>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setTodayDrawerOpen(false)}
                  title="关闭"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="tactical-drawer-filter">
                <button
                  type="button"
                  className={todayFilter === 'all' ? 'active' : ''}
                  onClick={() => setTodayFilter('all')}
                >
                  全部 ({todayAttempts.length})
                </button>
                <button
                  type="button"
                  className={todayFilter === 'wrong' ? 'active' : ''}
                  onClick={() => setTodayFilter('wrong')}
                >
                  错题 ({todayAttempts.filter((t) => t.outcome !== 'correct').length})
                </button>
                <button
                  type="button"
                  className={todayFilter === 'favorite' ? 'active' : ''}
                  onClick={() => setTodayFilter('favorite')}
                >
                  已收藏 ({todayAttempts.filter((t) => t.question.favorite).length})
                </button>
              </div>

              <div className="tactical-drawer-list">
                {filteredTodayAttempts.length === 0 ? (
                  <div className="tactical-drawer-empty">
                    <p>今天还没有符合条件的作答题目</p>
                  </div>
                ) : (
                  filteredTodayAttempts.map((item) => (
                    <div key={item.attemptId} className="tactical-today-item">
                      <div className="today-item-top">
                        <div className="today-item-title">
                          <button
                            type="button"
                            className="today-qid-btn"
                            onClick={() => setDetailQuestion(item.question)}
                            title="点击查看完整原题与解析"
                          >
                            #{item.questionId}
                          </button>
                          <span className="today-item-cat">
                            {item.question.categoryPath.split(' / ').slice(-2).join(' / ')}
                          </span>
                        </div>
                        <span
                          className={`verdict-pill ${
                            item.outcome === 'correct' ? 'correct' : 'wrong'
                          }`}
                        >
                          {item.outcome === 'correct' ? '正确' : '错误'}
                        </span>
                      </div>

                      <div
                        className="today-item-stem"
                        onClick={() => setDetailQuestion(item.question)}
                        title="点击展开完整题目与选项"
                      >
                        <MathText value={item.question.stem.slice(0, 120)} />
                      </div>

                      <div className="today-item-actions">
                        <span className="today-meta-info">
                          <Clock3 size={11} /> {item.durationSeconds}s · 熟练度 {item.selfRating}/4
                        </span>
                        <div className="today-btns-group">
                          <button
                            type="button"
                            className={`tactical-heart-fav-btn ${
                              item.question.favorite ? 'active' : ''
                            }`}
                            onClick={() => void handleToggleFavToday(item.questionId)}
                            title={item.question.favorite ? '取消收藏' : '收藏此题'}
                          >
                            <Heart
                              size={13}
                              fill={item.question.favorite ? 'currentColor' : 'none'}
                            />
                            <span>{item.question.favorite ? '已收藏' : '收藏'}</span>
                          </button>

                          <button
                            type="button"
                            className="tactical-preview-btn compact"
                            onClick={() => setDetailQuestion(item.question)}
                            title="查看原题与解析"
                          >
                            <BookOpen size={12} />
                            <span>解析</span>
                          </button>

                          {onStartVariant && (
                            <button
                              type="button"
                              className="tactical-variant-btn compact"
                              onClick={() => {
                                setTodayDrawerOpen(false)
                                onStartVariant(item.questionId)
                              }}
                              title="练同考点变式题"
                            >
                              <Sparkles size={11} />
                              <span>练变式</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {toastMsg && (
        <div className="tactical-floating-toast">
          <span>{toastMsg}</span>
        </div>
      )}

      <AnimatePresence>
        {detailQuestion && (
          <QuestionDetail
            question={detailQuestion}
            close={() => setDetailQuestion(null)}
            add={() => void addToCustomQueue(detailQuestion.id)}
            practice={() => {
              setDetailQuestion(null)
              if (onStartVariant) onStartVariant(detailQuestion.id)
            }}
            onChange={(updated) => {
              setDetailQuestion(updated)
              setTodayAttempts((prev) =>
                prev.map((t) => (t.questionId === updated.id ? { ...t, question: updated } : t))
              )
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}


