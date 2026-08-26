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
  getRankDescription,
} from '../utils'
import { MathText } from '../components/MathText'
import { QuestionDetail } from '../components/QuestionDetailModal'
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

type DataTab = 'overview' | 'matches' | 'mistakes' | 'inbox'
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
  // 过滤取消待批改的数据，仅保留已结算完成的胜负场次
  const validSessions = useMemo(() => {
    return sessions.filter((session) => {
      const report = reports[session.sessionId] ?? null
      const result = resultFor(report, session)
      return result === 'win' || result === 'loss' || ['graded', 'graded_partial'].includes(session.status)
    })
  }, [sessions, reports])

  const wins = validSessions.filter((session) => resultFor(reports[session.sessionId], session) === 'win').length
  const completed = validSessions.length
  const winRate = completed ? Math.round((wins / completed) * 100) : null
  const heatmap = trend.slice(-21)

  const [radarMode, setRadarMode] = useState<'base' | 'impact'>('base')

  const sixDimensions = useMemo(() => {
    if (tacticalData && tacticalData.dimensions.length === 6) {
      return tacticalData.dimensions.map((d) => ({
        key: d.key,
        label: d.label,
        enLabel: d.key.toUpperCase(),
        value: d.value,
        desc: '考研数学一基础学科六维硬实力',
      }))
    }
    const dims = distribution?.dimensions ?? null
    return [
      { key: 'rigor', label: '严谨性', enLabel: 'RIGOR', value: dims?.rigor ?? 64, desc: '证明严密性与定理边界' },
      { key: 'computation', label: '计算力', enLabel: 'COMPUTE', value: dims?.computation ?? 65, desc: '符号运算与积分代数硬实力' },
      { key: 'speed', label: '敏捷度', enLabel: 'SPEED', value: dims?.speed ?? 62, desc: '秒杀与解题时间经济效率' },
      { key: 'modeling', label: '审题建模', enLabel: 'MODEL', value: dims?.modeling ?? 64, desc: '题目结构洞察与等价转化' },
      { key: 'methodUse', label: '方法熟练', enLabel: 'METHOD', value: dims?.methodUse ?? 63, desc: '典型考法题型解法迁移' },
      { key: 'strategyInsight', label: '策略洞察', enLabel: 'INSIGHT', value: dims?.strategyInsight ?? 62, desc: '宏观题意把控与防出题陷阱' },
    ]
  }, [tacticalData, distribution])

  const profile = tacticalData?.profile
  const weScore = profile?.weScore ?? 68.5
  const ratingPro = profile?.ratingPro ?? 1.15

  // HLTV 2.0 战术与 Impact 影响力高维评估数据（敏感度增强，拉开长短板区分度）
  const impactDimensions = useMemo(() => {
    const baseFire = profile?.firepower ?? 60
    const baseRating = profile?.ratingPro ?? 1.05
    const winRate = profile?.winRate ?? 55
    const baseRigor = sixDimensions.find((d) => d.key === 'rigor')?.value ?? 60
    const baseSpeed = sixDimensions.find((d) => d.key === 'speed')?.value ?? 60
    const baseInsight = sixDimensions.find((d) => d.key === 'strategyInsight')?.value ?? 60
    const baseComputation = sixDimensions.find((d) => d.key === 'computation')?.value ?? 60
    const baseMethod = sixDimensions.find((d) => d.key === 'methodUse')?.value ?? 60

    // 扩张函数：让长板突破 85~95，短板沉降至 30~50，打破平庸均值
    const spread = (val: number, multiplier = 1.48) => {
      const center = 58
      return Math.min(98, Math.max(20, Math.round(center + (val - center) * multiplier)))
    }

    const calcImpact = spread((baseRating - 0.70) * 72 + (baseFire - 50) * 0.5 + 20, 1.55)
    const calcEntry = spread(baseInsight * 0.65 + baseSpeed * 0.55 - 12, 1.42)
    const calcClutch = spread(baseRigor * 0.75 + baseComputation * 0.55 - 18, 1.48)
    const calcUtility = spread(baseSpeed * 0.75 + baseMethod * 0.55 - 18, 1.52)
    const calcKast = spread(winRate * 0.60 + (baseRigor + baseComputation) * 0.35 - 5, 1.38)
    const calcOpening = spread(baseFire * 0.65 + baseInsight * 0.50 - 10, 1.42)

    return [
      { key: 'impact', label: '影响力', enLabel: 'IMPACT', value: calcImpact, desc: 'HLTV 2.0 核心决胜拉动权重，压轴题与关键局统治力' },
      { key: 'entry', label: '破局突破', enLabel: 'ENTRY', value: calcEntry, desc: '陌生压轴难题第一破题步的洞察突击效率' },
      { key: 'clutch', label: '残局攻坚', enLabel: 'CLUTCH', value: calcClutch, desc: '多步骤复杂证明与长计算的锁分硬实力' },
      { key: 'utility', label: '巧解秒杀', enLabel: 'UTILITY', value: calcUtility, desc: 'King 变换、待定系数、特征方程等极简秒杀技巧' },
      { key: 'kast', label: '防白给率', enLabel: 'KAST', value: calcKast, desc: '每题有效拿分率，步步有据杜绝低级计算笔误' },
      { key: 'opening', label: '首战对决', enLabel: 'OPENING', value: calcOpening, desc: '第一考点对抗与选填首发秒杀拿分率' },
    ]
  }, [profile, sixDimensions])

  const currentRadarDimensions = radarMode === 'base' ? sixDimensions : impactDimensions

  const getRadarCoords = (index: number, value: number, radius = 75, cx = 155, cy = 130) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / 6
    const x = cx + Math.cos(angle) * radius * (value / 100)
    const y = cy + Math.sin(angle) * radius * (value / 100)
    return { x, y, str: `${x.toFixed(1)},${y.toFixed(1)}` }
  }
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
    firepower: 68,
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
    killTimeGrade: 'B',
    kills: 86,
    totalAttempts: 159,
    sprayAccuracy: 54.1,
    sprayGrade: 'C',
    headshotRate: 62.4,
    headshotGrade: 'C',
    quickStopRate: 83.5,
    quickStopGrade: 'A',
    avgKills: 6.6,
    avgKillsGrade: 'B',
  }

  const specialtySkills = tacticalData?.specialtySkills ?? [
    { id: 'gunplay', label: '枪法', icon: 'Crosshair', grade: 'B', score: 72, desc: '基础计算与选填定性判断' },
    { id: 'trade', label: '补枪', icon: 'Zap', grade: 'C', score: 58, desc: '错题订正复盘与二刷闭环率' },
    { id: 'entry', label: '突破', icon: 'TrendingUp', grade: 'B', score: 70, desc: '新题快速破局与首刷秒杀率' },
    { id: 'utility', label: '道具', icon: 'ShieldAlert', grade: 'B', score: 68, desc: '公式定理熟练度与秒杀技巧' },
    { id: 'clutch', label: '残局', icon: 'Target', grade: 'A', score: 82, desc: '高分综合解答题攻坚抗压能力' },
    { id: 'sniper', label: '狙击', icon: 'Crosshair', grade: 'A', score: 84, desc: '三星核心难点考题精准突破' },
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
                  <div
                    className="tactical-rank-badge rank-tooltip-target"
                    title={getRankDescription(profile?.peakElo ?? elo?.current ?? 1400)}
                  >
                    <div className="rank-shield">{profile?.peakRankLetter ?? 'A'}</div>
                    <div className="rank-info">
                      <strong>{Math.round(profile?.peakElo ?? elo?.current ?? 1400)}</strong>
                      <span>赛季</span>
                    </div>
                  </div>
                  <div
                    className="tactical-rank-badge current rank-tooltip-target"
                    title={getRankDescription(profile?.currentElo ?? elo?.current ?? 1400)}
                  >
                    <div className="rank-shield">{profile?.currentRankLetter ?? 'A'}</div>
                    <div className="rank-info">
                      <strong>{Math.round(profile?.currentElo ?? elo?.current ?? 1400)}</strong>
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

            {/* 2. 个人表现与战术雷达 */}
            <section className="tactical-card ability-card">
              <header className="tactical-card-header">
                <div className="ability-title-row">
                  <h3>能力评估与战术雷达</h3>
                  <span title="六维战术能力综合评测与特化专精等级">
                    <HelpCircle size={14} className="help-icon" />
                  </span>
                  <span className="tactical-title-tag">{profile?.title ?? '一锤定音的战场收割者'}</span>
                </div>
                <div className="radar-mode-segmented">
                  <button
                    type="button"
                    className={radarMode === 'base' ? 'active' : ''}
                    onClick={() => setRadarMode('base')}
                    title="考研数学一基础学科六维硬实力评级"
                  >
                    📐 基础六维
                  </button>
                  <button
                    type="button"
                    className={radarMode === 'impact' ? 'active' : ''}
                    onClick={() => setRadarMode('impact')}
                    title="HLTV 2.0 考场高压进阶战术与 Impact 影响力雷达"
                  >
                    ⚡ 战术 Impact
                  </button>
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
                    <svg viewBox="0 0 250 220" className="six-radar-svg">
                      <defs>
                        <radialGradient id="baseRadarGlow" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="var(--success)" stopOpacity="0.45" />
                          <stop offset="100%" stopColor="var(--success)" stopOpacity="0.08" />
                        </radialGradient>
                        <radialGradient id="impactRadarGlow" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="var(--warn)" stopOpacity="0.45" />
                          <stop offset="100%" stopColor="var(--warn)" stopOpacity="0.08" />
                        </radialGradient>
                      </defs>

                      {/* 背景同心多边形网格 */}
                      {[0.25, 0.5, 0.75, 1.0].map((scale) => (
                        <polygon
                          key={scale}
                          points={currentRadarDimensions.map((_, i) => getRadarCoords(i, scale * 100, 58, 125, 110).str).join(' ')}
                          fill="none"
                          stroke="var(--line)"
                          strokeWidth={scale === 1.0 ? '1.5' : '1'}
                          strokeDasharray={scale === 1.0 ? 'none' : '3 3'}
                          opacity={scale === 1.0 ? 0.9 : 0.6}
                        />
                      ))}

                      {/* 坐标轴辐射线 */}
                      {currentRadarDimensions.map((_, i) => {
                        const endPt = getRadarCoords(i, 100, 58, 125, 110)
                        return (
                          <line
                            key={i}
                            x1="125"
                            y1="110"
                            x2={endPt.x}
                            y2={endPt.y}
                            stroke="var(--line)"
                            strokeWidth="1"
                            opacity={0.65}
                          />
                        )
                      })}

                      {/* 动态能力雷达多边形 */}
                      <polygon
                        points={currentRadarDimensions.map((item, idx) => getRadarCoords(idx, item.value, 58, 125, 110).str).join(' ')}
                        fill={radarMode === 'base' ? 'url(#baseRadarGlow)' : 'url(#impactRadarGlow)'}
                        stroke={radarMode === 'base' ? 'var(--success)' : 'var(--warn)'}
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />

                      {/* 顶点数据指示光点 */}
                      {currentRadarDimensions.map((dim, i) => {
                        const pt = getRadarCoords(i, dim.value, 58, 125, 110)
                        const color = radarMode === 'base' ? 'var(--success)' : 'var(--warn)'
                        return (
                          <g key={dim.key}>
                            <circle cx={pt.x} cy={pt.y} r="4.5" fill="var(--surface)" stroke={color} strokeWidth="2" />
                            <circle cx={pt.x} cy={pt.y} r="2" fill={color} />
                          </g>
                        )
                      })}

                      {/* 顶点文本标签 */}
                      {currentRadarDimensions.map((dim, i) => {
                        const pt = getRadarCoords(i, 100, 82, 125, 110)
                        const isTop = i === 0
                        const isBottom = i === 3
                        const isRight = i === 1 || i === 2
                        const anchor = isTop || isBottom ? 'middle' : isRight ? 'start' : 'end'
                        const xOffset = isTop || isBottom ? 0 : isRight ? 2 : -2
                        return (
                          <text
                            key={dim.key}
                            x={pt.x + xOffset}
                            y={pt.y}
                            textAnchor={anchor}
                            dominantBaseline="central"
                            fontSize="11"
                            fontWeight="800"
                            fill="var(--ink)"
                          >
                            {dim.label}
                          </text>
                        )
                      })}
                    </svg>
                  </div>

                  <div className="six-bars-list">
                    {currentRadarDimensions.map((dim) => {
                      const val = Math.round(dim.value)
                      const grade = val >= 85 ? 'S' : val >= 75 ? 'A' : val >= 62 ? 'B' : val >= 48 ? 'C' : 'D'
                      const gradeClass = grade.toLowerCase()
                      return (
                        <div className="six-bar-card-row" key={dim.key} title={dim.desc}>
                          <div className="six-bar-meta">
                            <span className="six-bar-name">{dim.label}</span>
                            <span className="six-bar-code">{dim.enLabel}</span>
                          </div>
                          <div className="six-bar-progress-container">
                            <div
                              className={`six-bar-fill-bar ${radarMode === 'base' ? 'base-theme' : 'impact-theme'}`}
                              style={{ width: `${Math.min(100, Math.max(12, val))}%` }}
                            />
                          </div>
                          <div className="six-bar-score-group">
                            <strong className="six-bar-score-num">{val}</strong>
                            <span className={`six-bar-grade-pill grade-${gradeClass}`}>{grade}</span>
                          </div>
                        </div>
                      )
                    })}
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
                  <p>共 {validSessions.length} 场已批改对决 · 胜率 {winRate === null ? '等待首场' : `${winRate}%`}</p>
                </div>
                <span className="match-filter">全部已结算⌄</span>
              </header>
              {validSessions.length === 0 ? (
                <div className="empty-state match-empty">
                  <BarChart3 size={32} />
                  <h3>暂无已批改对决记录</h3>
                  <p>完成高压演练并经 Codex 批改结算后，这里会像 CS 历史战绩一样记录你的真实表现。</p>
                </div>
              ) : (
                <div className="match-table" role="table" aria-label="历史测试记录">
                  <div className="match-table-head" role="row">
                    <span>时间</span><span>测试类型</span><span>题组</span><span>题数</span><span>正确率</span><span>结果</span><span>用时</span><span>Rating</span><span>报告</span>
                  </div>
                  {validSessions.map((session) => {
                    const report = reports[session.sessionId] ?? null
                    const result = resultFor(report, session)
                    const rating = averageReportRating(report)
                    const accuracy = accuracyPercent(report)
                    const questionCount = session.questionIds?.length ?? session.questions?.length ?? 0
                    const isClickable = Boolean(report) || ['graded', 'graded_partial'].includes(session.status)
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
                        <MathText value={item.question.stem} />
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


