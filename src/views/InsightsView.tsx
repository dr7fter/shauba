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
  getHighlightMoments,
  getPeriodOverview,
  getProgressComparisons,
  getSeasonLadder,
  getPressureGradingReport,
  getQuestion,
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
  gradeFromPercent,
  gradeToCsRating,
  formatElapsed,
  predictedExamScore,
  getRankDescription,
} from '../utils'
import { MathText } from '../components/MathText'
import { QuestionDetail } from '../components/QuestionDetailModal'
import { Gauge } from '../components/ui/Gauge'
import { GradeBadge } from '../components/ui/GradeBadge'
import { MetricBar } from '../components/ui/MetricBar'
import { Radar } from '../components/ui/Radar'
import { RatingBadge } from '../components/ui/RatingBadge'
import { InboxView } from './InboxView'
import type {
  BootstrapData,
  DailyTrendPoint,
  EloStatus,
  GradingReport,
  HighlightMoment,
  PeriodOverview,
  ProgressComparison,
  SeasonLadder,
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

/** 考研初试目标日（后续可移至设置页配置） */
const EXAM_DATE = '2026-12-19'

/** 折线点串生成（赛季天梯用） */
function seasonLine(points: { date: string; rating: number }[]) {
  if (points.length < 2) return null
  const vals = points.map((p) => p.rating)
  const min = Math.min(...vals)
  const span = Math.max(...vals) - min || 1
  const pts = points
    .map(
      (p, i) =>
        `${((i / (points.length - 1)) * 600).toFixed(1)},${(110 - ((p.rating - min) / span) * 92 - 10).toFixed(1)}`,
    )
    .join(' ')
  const delta = Math.round((points[points.length - 1].rating - points[0].rating) * 100) / 100
  return { pts, delta, first: points[0], last: points[points.length - 1] }
}

/** 周期档位切换按钮样式（阶段六 ①） */
const periodBtnStyle = (active: boolean) => ({
  padding: '4px 12px',
  borderRadius: 16,
  border: '1px solid var(--line)',
  background: active ? 'var(--cyan)' : 'transparent',
  color: active ? 'var(--surface)' : 'var(--muted)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
})

function averageReportRating(report: GradingReport | null): number | null {
  if (!report || report.grades.length === 0) return null
  const averageDuration =
    report.summary.averageDuration ??
    Math.round(
      (report.summary.totalDuration ??
        report.grades.reduce((sum, grade) => sum + Math.max(0, grade.duration || 0), 0)) /
        Math.max(1, report.summary.totalCount || report.grades.length)
    )
  return averageCsRating(report.grades.map((grade) => gradeToCsRating(grade, averageDuration)))
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
    // 名人堂与趋势战报由下方 tab effect 首挂加载（避免双拉）
  }, [])

  useEffect(() => {
    if (tab === 'mistakes' && !weakness) void getWeaknessRadar().then(setWeakness).catch(() => undefined)
  }, [tab, weakness])

  // 阶段六自检修复：趋势战报/名人堂不再是一次性进场快照——
  // 每次切回个人战绩 tab 都重拉，做完题过来看的就是新数据
  useEffect(() => {
    if (tab === 'overview') {
      void getPeriodOverview(periodDays).then(setPeriodOverview).catch(() => undefined)
      void getHighlightMoments(20).then(setHighlights).catch(() => undefined)
      void getSeasonLadder().then(setSeasonLadder).catch(() => undefined)
      void getProgressComparisons().then(setComparisons).catch(() => undefined)
    }
    // periodDays 变化由其专属 effect 负责，此处只在切 tab 时触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const [trend, setTrend] = useState<DailyTrendPoint[]>([])
  const [sessions, setSessions] = useState<PressureSession[]>([])
  const [reports, setReports] = useState<Record<string, GradingReport | null>>({})
  const [loading, setLoading] = useState(false)

  const [todayAttempts, setTodayAttempts] = useState<TodayAttemptItem[]>([])
  const [todayDrawerOpen, setTodayDrawerOpen] = useState(false)
  const [todayFilter, setTodayFilter] = useState<'all' | 'wrong' | 'favorite'>('all')
  const [detailQuestion, setDetailQuestion] = useState<Question | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<HighlightMoment[]>([])
  const [expandedHighlightId, setExpandedHighlightId] = useState<number | null>(null)
  // 阶段六：时间维度（null = 全部）
  const [seasonLadder, setSeasonLadder] = useState<SeasonLadder | null>(null)
  const [comparisons, setComparisons] = useState<ProgressComparison[]>([])
  const [seasonMode, setSeasonMode] = useState<'week' | 'all' | 'seasons'>('week')
  const [periodDays, setPeriodDays] = useState<number | null>(7)
  const [periodOverview, setPeriodOverview] = useState<PeriodOverview | null>(null)

  useEffect(() => {
    void getPeriodOverview(periodDays).then(setPeriodOverview).catch(() => undefined)
  }, [periodDays])

  const handleOpenHighlightDetail = async (questionId: number) => {
    try {
      const fetched = await getQuestion(questionId)
      setDetailQuestion(fetched)
    } catch {
      setToastMsg(`无法加载题目 #${questionId} 详情`)
      setTimeout(() => setToastMsg(null), 2000)
    }
  }

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

  // 阶段六 ②：叙事层——一句自动生成的判断（纯模板拼装）
  const periodLabel = periodDays === 7 ? '近 7 天' : periodDays === 30 ? '近 30 天' : '全部历史'
  const periodNarrative = useMemo(() => {
    if (!periodOverview) return '加载中…'
    const { current, previous, coveragePercent } = periodOverview
    if (current.attempted === 0) return `${periodLabel}还没有作答记录——去今日训练开一局。`
    const accDelta =
      previous.attempted > 0 ? Math.round((current.accuracy - previous.accuracy) * 10) / 10 : null
    const accText =
      accDelta == null ? '' : `（${accDelta >= 0 ? '↑' : '↓'}${Math.abs(accDelta)}pp vs 上一周期）`
    return (
      [
        `${periodLabel}完成 ${current.attempted} 题，正确率 ${current.accuracy}%${accText}`,
        current.bestStreak >= 3 ? `最长连对 ${current.bestStreak} 题` : null,
        `题库已点亮 ${coveragePercent}%`,
      ]
        .filter(Boolean)
        .join('；') + '。'
    )
  }, [periodOverview, periodLabel])

  const periodMetrics = useMemo(() => {
    if (!periodOverview) return []
    const { current, previous } = periodOverview
    const fmtDelta = (cur: number, prev: number, unit: string, digits = 0) => {
      if (previous.attempted === 0) return null
      const factor = 10 ** digits
      const delta = Math.round((cur - prev) * factor) / factor
      return `${delta >= 0 ? '↑' : '↓'}${Math.abs(delta)}${unit}`
    }
    return [
      {
        label: '题量',
        value: `${current.attempted}`,
        delta: fmtDelta(current.attempted, previous.attempted, ''),
      },
      {
        label: '正确率',
        value: `${current.accuracy}%`,
        delta: fmtDelta(current.accuracy, previous.accuracy, 'pp', 1),
      },
      {
        label: '平均 Rating',
        value: current.avgRating?.toFixed(2) ?? '—',
        delta:
          current.avgRating != null && previous.avgRating != null
            ? fmtDelta(current.avgRating, previous.avgRating, '', 2)
            : null,
      },
      {
        label: '最长连对',
        value: `${current.bestStreak}`,
        delta: fmtDelta(current.bestStreak, previous.bestStreak, ''),
      },
    ]
  }, [periodOverview])

  // 阶段六 ④：成就墙（确定性派生，未解锁灰色剪影 + 条件）
  const achievements = useMemo(() => {
    const o = periodOverview
    const streakDays = o?.longestActiveStreakDays ?? 0
    const examScore = predictedExamScore(profile?.ratingPro ?? 1.0, 75)
    return [
      { icon: '🔥', name: '七日不辍', desc: '连续打卡 ≥7 天', unlocked: streakDays >= 7, note: `纪录 ${streakDays} 天` },
      { icon: '🏆', name: '半月至尊', desc: '连续打卡 ≥17 天', unlocked: streakDays >= 17, note: `纪录 ${streakDays} 天` },
      { icon: '👑', name: '首个 DONK', desc: '单题 Rating ≥2.00', unlocked: o?.firstDonkAt != null, note: o?.firstDonkAt ?? '未达成' },
      { icon: '⚡', name: '单日狂飙', desc: '单日完成 ≥20 题', unlocked: (o?.bestDayCount ?? 0) >= 20, note: `纪录 ${o?.bestDayCount ?? 0} 题` },
      { icon: '🔧', name: '修复工匠', desc: '修复 ≥10 道旧错题', unlocked: (o?.redeemedCount ?? 0) >= 10, note: `已修复 ${o?.redeemedCount ?? 0} 题` },
      { icon: '🗺️', name: '点亮 5%', desc: '题库覆盖 ≥5%', unlocked: (o?.coveragePercent ?? 0) >= 5, note: `当前 ${o?.coveragePercent ?? 0}%` },
      { icon: '🎯', name: '预估 110+', desc: '考场预估 ≥110 分', unlocked: examScore >= 110, note: `当前 ${examScore}` },
    ]
  }, [periodOverview, profile])
  const daysLeft = Math.max(0, Math.ceil((new Date(EXAM_DATE).getTime() - Date.now()) / 86400000))

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
                    <Gauge
                      percent={weScore}
                      progressColor="var(--green)"
                      progressClassName="glowing-ring"
                      title="WE 制胜评价"
                      center={<strong>{(weScore / 7.2).toFixed(1)}</strong>}
                    />
                  </div>

                  <div className="ring-gauge-item">
                    <span className="ring-gauge-title">
                      Rating Pro <TrendingUp size={12} className="trend-icon-up" />
                    </span>
                    <Gauge
                      percent={(ratingPro / 2.0) * 100}
                      progressColor="var(--cyan)"
                      progressClassName="glowing-ring"
                      title="Rating Pro"
                      center={<strong>{ratingPro.toFixed(2)}</strong>}
                    />
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
                    <strong className="cyan-accent">{(profile?.kastRate ?? 0).toFixed(1)}<small>%</small></strong>
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

            {/* 1.5 趋势战报（阶段六 ①②③：时间维度 + 叙事 + 目标进度） */}
            <section className="tactical-card period-card" style={{ gridColumn: '1 / -1' }}>
              <header className="tactical-card-header">
                <h3>趋势战报</h3>
                <div style={{ display: 'flex', gap: 6 }}>
                  {([7, 30, null] as const).map((days) => (
                    <button
                      key={String(days)}
                      type="button"
                      style={periodBtnStyle(periodDays === days)}
                      onClick={() => setPeriodDays(days)}
                    >
                      {days === 7 ? '近 7 天' : days === 30 ? '近 30 天' : '全部'}
                    </button>
                  ))}
                </div>
              </header>
              <p style={{ fontSize: 13.5, lineHeight: 1.9, margin: '0 0 12px', color: 'var(--ink)' }}>
                {periodNarrative}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {periodMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', background: 'var(--canvas)' }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{metric.label}</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <strong style={{ fontSize: 22, fontWeight: 800 }}>{metric.value}</strong>
                      {metric.delta && (
                        <small
                          style={{
                            color: metric.delta.startsWith('↑') ? 'var(--success)' : 'var(--danger)',
                            fontWeight: 700,
                          }}
                        >
                          {metric.delta}
                        </small>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 22, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="ring-gauge-item">
                  <span className="ring-gauge-title">今日题量</span>
                  <Gauge
                    percent={Math.min(100, (todayAttempts.length / Math.max(1, data.dailyProblemTarget)) * 100)}
                    progressColor="var(--success)"
                    progressClassName="glowing-ring"
                    title="今日题量进度"
                    center={
                      <strong>
                        {todayAttempts.length}
                        <small style={{ fontSize: 11, color: 'var(--muted)' }}>/{data.dailyProblemTarget}</small>
                      </strong>
                    }
                  />
                </div>
                <div className="ring-gauge-item">
                  <span className="ring-gauge-title">本期正确率</span>
                  <Gauge
                    percent={periodOverview?.current.accuracy ?? 0}
                    progressColor="var(--cyan)"
                    progressClassName="glowing-ring"
                    title="本期正确率"
                    center={<strong>{periodOverview?.current.accuracy ?? 0}<small style={{ fontSize: 11, color: 'var(--muted)' }}>%</small></strong>}
                  />
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>距考研初试（{EXAM_DATE}）</span>
                  <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.15 }}>
                    {daysLeft}
                    <small style={{ fontSize: 13, color: 'var(--muted)' }}> 天</small>
                  </div>
                </div>
              </div>
            </section>

            {/* 1.6 赛季天梯 · 进步对照（v1.8） */}
            <section className="tactical-card season-card" style={{ gridColumn: '1 / -1' }}>
              <header className="tactical-card-header">
                <h3>赛季天梯 · 进步对照</h3>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['week', 'all', 'seasons'] as const).map((mode) => (
                    <button key={mode} type="button" style={periodBtnStyle(seasonMode === mode)} onClick={() => setSeasonMode(mode)}>
                      {mode === 'week' ? '本周' : mode === 'all' ? '全部' : '各赛季'}
                    </button>
                  ))}
                </div>
              </header>
              {(() => {
                if (!seasonLadder) {
                  return <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>加载中…</p>
                }
                if (seasonMode === 'seasons') {
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {seasonLadder.seasons.length === 0 && (
                        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>还没有赛季结算记录</p>
                      )}
                      {seasonLadder.seasons.map((season) => (
                        <div key={season.weekStart} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 13, borderBottom: '1px solid var(--line)', paddingBottom: 6 }}>
                          <span style={{ color: 'var(--muted)', minWidth: 92 }}>周 {season.weekStart}</span>
                          <span>{season.startRating.toFixed(0)} → {season.endRating.toFixed(0)}</span>
                          <b style={{ color: season.delta >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 800 }}>
                            {season.delta >= 0 ? '+' : ''}{season.delta.toFixed(2)}
                          </b>
                          <small style={{ color: 'var(--muted)' }}>{season.settlements} 次结算</small>
                        </div>
                      ))}
                    </div>
                  )
                }
                const points = seasonMode === 'week' ? seasonLadder.weekPoints : seasonLadder.allPoints.slice(-120)
                const line = seasonLine(points)
                if (!line) {
                  return (
                    <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                      {seasonMode === 'week' ? '本周还没有结算记录——做第一题就会点亮曲线。' : '还没有足够的结算记录'}
                    </p>
                  )
                }
                return (
                  <div>
                    <svg viewBox="0 0 600 120" style={{ width: '100%', height: 120 }} role="img" aria-label="rating 曲线">
                      <polyline points={line.pts} fill="none" stroke="var(--cyan)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, color: 'var(--muted)' }}>
                      <span>{line.first.date} · {line.first.rating.toFixed(0)}</span>
                      <b style={{ color: line.delta >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: 15 }}>
                        {line.delta >= 0 ? '+' : ''}{line.delta.toFixed(2)} 分
                      </b>
                      <span>{line.last.date} · {line.last.rating.toFixed(0)}</span>
                    </div>
                  </div>
                )
              })()}
              {comparisons.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--line)' }}>
                  <strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>📈 进步对照 · 你确实在变强</strong>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {comparisons.map((c) => (
                      <div key={c.questionId} style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                        <span style={{ color: 'var(--ink)', fontWeight: 700 }}>#{c.questionId}</span>{' '}
                        {c.wrongDuration}s → <b style={{ color: 'var(--success)' }}>{c.correctDuration}s</b>
                        {' '}（快 {(c.wrongDuration / c.correctDuration).toFixed(1)}×）· {c.fixedAt} 修复
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  战术 Impact 为合成指标（基础六维推导），v2.0 将替换为真实聚合
                </span>
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
                        <GradeBadge grade={skill.grade} className={`grade-badge ${skill.grade.toLowerCase()}`} suffix=" 级" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="six-dimension-wrap">
                  <div className="six-radar-svg-col">
                    <Radar
                      className="six-radar-svg"
                      dimensions={currentRadarDimensions.map((d) => ({ key: d.key, label: d.label, value: d.value }))}
                      width={250}
                      height={220}
                      cx={125}
                      cy={110}
                      radius={58}
                      labelRadius={82}
                      gridStroke="var(--line)"
                      gridOuterOpacity={0.9}
                      gridInnerOpacity={0.6}
                      gridInnerDash="3 3"
                      axisStroke="var(--line)"
                      axisOpacity={0.65}
                      shapeFill={radarMode === 'base' ? 'url(#baseRadarGlow)' : 'url(#impactRadarGlow)'}
                      shapeStroke={radarMode === 'base' ? 'var(--success)' : 'var(--warn)'}
                      shapeStrokeWidth={2.5}
                      dotVariant="ring"
                      dotColor={radarMode === 'base' ? 'var(--success)' : 'var(--warn)'}
                      dotSurfaceColor="var(--surface)"
                      labelAnchorMode="smart"
                      labelFill="var(--ink)"
                      labelFontSize={11}
                      labelFontWeight={800}
                      role="img"
                      ariaLabel="六维战术能力雷达图"
                    >
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
                    </Radar>
                  </div>

                  <div className="six-bars-list">
                    {currentRadarDimensions.map((dim) => {
                      const val = Math.round(dim.value)
                      const grade = gradeFromPercent(val)
                      return (
                        <div className="six-bar-card-row" key={dim.key} title={dim.desc}>
                          <div className="six-bar-meta">
                            <span className="six-bar-name">{dim.label}</span>
                            <span className="six-bar-code">{dim.enLabel}</span>
                          </div>
                          <MetricBar
                            value={val}
                            floor={12}
                            trackClassName="six-bar-progress-container"
                            fillClassName={`six-bar-fill-bar ${radarMode === 'base' ? 'base-theme' : 'impact-theme'}`}
                          />
                          <div className="six-bar-score-group">
                            <strong className="six-bar-score-num">{val}</strong>
                            <GradeBadge grade={grade} className={`six-bar-grade-pill grade-${grade.toLowerCase()}`} />
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
                {periodOverview && (
                  <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                    疆域覆盖 {periodOverview.coveragePercent}% · 已点亮{' '}
                    {Math.round((periodOverview.coveragePercent / 100) * periodOverview.questionCount)}
                    /{periodOverview.questionCount} 题
                  </span>
                )}
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
                        <GradeBadge grade={subj.masteryGrade} className={`badge-letter ${subj.masteryGrade.toLowerCase()}`} />
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
                        <GradeBadge grade={currentWeapon.killTimeGrade} className={`wmetric-grade ${currentWeapon.killTimeGrade.toLowerCase()}`} />
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
                        <GradeBadge grade={currentWeapon.sprayGrade} className={`wmetric-grade ${currentWeapon.sprayGrade.toLowerCase()}`} />
                      </div>
                    </div>

                    <div className="wmetric-item">
                      <span className="wmetric-title">爆头率</span>
                      <div className="wmetric-val-row">
                        <strong>{currentWeapon.headshotRate.toFixed(1)}%</strong>
                        <GradeBadge grade={currentWeapon.headshotGrade} className={`wmetric-grade ${currentWeapon.headshotGrade.toLowerCase()}`} />
                      </div>
                    </div>

                    <div className="wmetric-item">
                      <span className="wmetric-title">急停成功率</span>
                      <div className="wmetric-val-row">
                        <strong>{currentWeapon.quickStopRate.toFixed(1)}%</strong>
                        <GradeBadge grade={currentWeapon.quickStopGrade} className={`wmetric-grade ${currentWeapon.quickStopGrade.toLowerCase()}`} />
                      </div>
                    </div>

                    <div className="wmetric-item">
                      <span className="wmetric-title">场均击杀</span>
                      <div className="wmetric-val-row">
                        <strong>{currentWeapon.avgKills}</strong>
                        <GradeBadge grade={currentWeapon.avgKillsGrade} className={`wmetric-grade ${currentWeapon.avgKillsGrade.toLowerCase()}`} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 5. 高光时刻 · 名人堂（阶段四） */}
            <section className="tactical-card highlight-hall-card" style={{ gridColumn: '1 / -1' }}>
              <header className="tactical-card-header">
                <h3>高光时刻 · 名人堂</h3>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  历史作答按 Rating 取 Top 20，点击展开回看六维证据
                </span>
              </header>
              {highlights.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
                  还没有高光时刻——打出 Rating 1.8+ 的作答（⚡ACE / 👑DONK）会自动入堂。
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {highlights.map((item, index) => {
                    const expanded = expandedHighlightId === item.attemptId
                    const dims = [
                      { key: 'rigor', label: '严谨', value: item.rigor },
                      { key: 'comp', label: '计算', value: item.computation },
                      { key: 'speed', label: '速度', value: item.speed },
                      { key: 'model', label: '建模', value: item.modeling },
                      { key: 'method', label: '方法', value: item.methodUse },
                      { key: 'insight', label: '洞察', value: item.strategyInsight },
                    ].filter((d): d is { key: string; label: string; value: number } => typeof d.value === 'number')
                    return (
                      <div
                        key={item.attemptId}
                        style={{ border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedHighlightId(expanded ? null : item.attemptId)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            width: '100%',
                            padding: '10px 14px',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            color: 'var(--ink)',
                          }}
                        >
                          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, minWidth: 26 }}>
                            #{index + 1}
                          </span>
                          <RatingBadge value={item.rating} />
                          <span
                            style={{
                              flex: 1,
                              fontSize: 13,
                              overflow: 'hidden',
                              display: '-webkit-box',
                              WebkitLineClamp: 1,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            <MathText value={item.stem} />
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                            {formatElapsed(item.durationSeconds * 1000)} · {item.attemptedAt}
                          </span>
                        </button>
                        {expanded && (
                          <div
                            style={{
                              display: 'flex',
                              gap: 16,
                              padding: '10px 14px 12px',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              borderTop: '1px solid var(--line)',
                            }}
                          >
                            {dims.length >= 3 ? (
                              <Radar
                                width={200}
                                height={175}
                                cx={100}
                                cy={88}
                                radius={52}
                                labelRadius={66}
                                dimensions={dims.map((d) => ({ key: d.key, label: d.label, value: d.value }))}
                                gridStroke="var(--line)"
                                gridInnerDash="3 3"
                                axisStroke="var(--line)"
                                axisOpacity={0.65}
                                shapeFill="var(--success)"
                                shapeFillOpacity={0.22}
                                shapeStroke="var(--success)"
                                shapeStrokeWidth={2}
                                dotVariant="simple"
                                dotRadius={3}
                                dotFill="var(--success)"
                                labelAnchorMode="smart"
                                labelFill="var(--ink)"
                                labelFontSize={10}
                                labelFontWeight={700}
                                role="img"
                                ariaLabel={`#${item.questionId} 六维证据`}
                              />
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                该作答无六维证据（六维独立性量规上线后的批改会带完整证据）
                              </span>
                            )}
                            <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{item.categoryPath}</span>
                              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                用时 {formatElapsed(item.durationSeconds * 1000)} / 基准{' '}
                                {formatElapsed(item.benchmarkSeconds * 1000)}
                                {item.difficultyMultiplier != null
                                  ? ` · 难度系数 ${item.difficultyMultiplier.toFixed(2)}`
                                  : ''}
                                {item.techniqueLevel != null ? ` · 技巧等级 ${item.techniqueLevel}` : ''}
                              </span>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  type="button"
                                  className="tactical-preview-btn compact"
                                  onClick={() => void handleOpenHighlightDetail(item.questionId)}
                                >
                                  <BookOpen size={12} />
                                  <span>原题解析</span>
                                </button>
                                {onStartVariant && (
                                  <button
                                    type="button"
                                    className="tactical-variant-btn compact"
                                    onClick={() => onStartVariant(item.questionId)}
                                  >
                                    <Sparkles size={11} />
                                    <span>练变式</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* 6. 成就墙（阶段六 ④）：确定性派生，未解锁灰色剪影 + 条件 */}
            <section className="tactical-card achievements-card" style={{ gridColumn: '1 / -1' }}>
              <header className="tactical-card-header">
                <h3>成就墙</h3>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {achievements.filter((a) => a.unlocked).length}/{achievements.length} 已解锁
                </span>
              </header>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
                {achievements.map((achievement) => (
                  <div
                    key={achievement.name}
                    title={achievement.desc}
                    style={{
                      border: `1px solid ${achievement.unlocked ? 'var(--success)' : 'var(--line)'}`,
                      borderRadius: 10,
                      padding: '10px 12px',
                      opacity: achievement.unlocked ? 1 : 0.55,
                      background: achievement.unlocked
                        ? 'color-mix(in srgb, var(--success) 7%, var(--surface))'
                        : 'transparent',
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{achievement.icon}</span>
                    <div style={{ fontSize: 13, fontWeight: 700, color: achievement.unlocked ? 'var(--ink)' : 'var(--muted)' }}>
                      {achievement.name}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{achievement.desc}</div>
                    <div style={{ fontSize: 11, color: achievement.unlocked ? 'var(--success)' : 'var(--muted)' }}>
                      {achievement.unlocked ? `已解锁 · ${achievement.note}` : achievement.note}
                    </div>
                  </div>
                ))}
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


