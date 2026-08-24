import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3,
  BookMarked,
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Command,
  Compass,
  GraduationCap,
  HelpCircle,
  LibraryBig,
  ListPlus,
  LoaderCircle,
  Maximize2,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Settings,
  Target,
  TimerReset,
  Trash2,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  addToCustomQueue,
  bootstrap,
  checkAppUpdate,
  clearPracticeSession,
  getAppVersion,
  getMasteryMap,
  getPressureGradingReport,
  getQuestion,
  getRecommendations,
  getReviewQueue,
  getStreak,
  getVariantQueue,
  listPressureSessions,
  loadPracticeSession,
  refreshInbox,
  searchQuestionPage,
  startRecommendationBatch,
} from './api'
import { BlitzExamModal } from './components/BlitzExamModal'
import { FormulaDrawer } from './components/FormulaDrawer'
import { FriendsLadderView } from './components/FriendsLadderView'
import { PressureLearningReportView } from './components/GradingReportModal'
import { KeyboardHelpModal } from './components/KeyboardHelpModal'
import { formatElapsed } from './utils'
import type { BlitzExamResult } from './data/motivation'
import { recordMyPublicMatch, sanitizeGradingReportToPublic } from './data/friendPublicData'
import { addFriendActivity, getSavedMyCustomProfile, triggerBackgroundSync } from './data/friendsService'
import { isFeatureEnabled } from './data/featureFlags'
import type {
  AttemptMode,
  BootstrapData,
  FriendPublicMatch,
  GradingReport,
  MasteryChapter,
  PracticeSessionState,
  PressureSession,
  Question,
  RecommendedQuestion,
  View,
} from './types'
import { InsightsView } from './views/InsightsView'
import { LearningCenterView } from './views/LearningCenterView'
import { LibraryView } from './views/LibraryView'
import { MasteryMapView } from './views/MasteryMapView'
import { ReviewMapView } from './views/ReviewView'
import { SettingsView } from './views/SettingsView'
import { TodayView } from './views/TodayView'

const navItems: Array<{ id: View; label: string; icon: typeof BookOpen }> = [
  { id: 'learning', label: '学习中心', icon: GraduationCap },
  { id: 'today', label: '今日', icon: Zap },
  { id: 'insights', label: '数据', icon: BarChart3 },
  { id: 'friends', label: '好友', icon: Users },
  { id: 'review', label: '复盘', icon: TimerReset },
  { id: 'mastery', label: '地图', icon: Compass },
  { id: 'library', label: '题库', icon: LibraryBig },
]

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="brand-mark">刷</div>
      <LoaderCircle className="spin" size={22} />
      <span>正在整理数一题库</span>
    </div>
  )
}

function Sidebar({
  view,
  setView,
  appVersion,
  learningCenterEnabled,
}: {
  view: View
  setView: (v: View) => void
  appVersion: string
  learningCenterEnabled: boolean
}) {
  const versionLabel = appVersion
    ? appVersion.startsWith('v')
      ? appVersion
      : `v${appVersion}`
    : '开发版'
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">刷</div>
        <div>
          <strong>刷吧</strong>
          <span>数学一 · 本地题库</span>
        </div>
      </div>
      <nav>
        {navItems.filter(({ id }) => id !== 'learning' || learningCenterEnabled).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={view === id ? 'nav-item active' : 'nav-item'}
            onClick={() => setView(id)}
            aria-label={`切换到${label}`}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <button
          className={view === 'settings' ? 'nav-item active' : 'nav-item'}
          onClick={() => setView('settings')}
          aria-label="打开设置与在线更新"
        >
          <Settings size={18} strokeWidth={1.8} />
          <span>设置</span>
          <span className="sidebar-version-tag">{versionLabel}</span>
        </button>
        <div
          className="status-info"
          onClick={() => setView('settings')}
          style={{ cursor: 'pointer' }}
          title="点击查看版本与在线更新"
        >
          <span className="status-dot" />
          <div>
            <strong>题库已就绪 · {versionLabel}</strong>
            <small>数据仅保存在本机</small>
          </div>
        </div>
      </div>
    </aside>
  )
}

type CommandAction = {
  id: string
  label: string
  hint?: string
  icon: typeof BookOpen
  run: () => void
}

function CommandMenu({
  open,
  onClose,
  actions,
}: {
  open: boolean
  onClose: () => void
  actions: CommandAction[]
}) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
    }
  }, [open])
  if (!open) return null
  const filtered = actions.filter((a) =>
    a.label.toLowerCase().includes(query.trim().toLowerCase())
  )
  const pick = (a: CommandAction) => {
    onClose()
    a.run()
  }
  return (
    <div className="ui-overlay command-menu-overlay" onClick={onClose}>
      <div
        className="command-menu-panel"
        role="dialog"
        aria-modal="true"
        aria-label="命令菜单"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          className="command-menu-input"
          autoFocus
          placeholder="输入命令：跳转视图 / 公式速查 / 闪击战 / 专注模式…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setCursor(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose()
            else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setCursor((c) => Math.min(c + 1, filtered.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setCursor((c) => Math.max(c - 1, 0))
            } else if (e.key === 'Enter' && filtered[cursor]) pick(filtered[cursor])
          }}
        />
        <div className="command-menu-list">
          {filtered.length === 0 && <div className="command-menu-empty">没有匹配的命令</div>}
          {filtered.map((a, i) => (
            <button
              key={a.id}
              className={i === cursor ? 'command-menu-item active' : 'command-menu-item'}
              onMouseEnter={() => setCursor(i)}
              onClick={() => pick(a)}
            >
              <a.icon size={16} /> {a.label}
              {a.hint ? <kbd>{a.hint}</kbd> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Topbar({
  view,
  onRefresh,
  onOpenCommand,
  onOpenHelp,
  data,
  streak,
}: {
  view: View
  onRefresh: () => void
  onOpenCommand: () => void
  onOpenHelp: () => void
  data?: BootstrapData
  streak?: { currentStreak: number; bestStreak: number } | null
}) {
  const current = navItems.find((item) => item.id === view)
  const [now, setNow] = useState(() => Date.now())
  const [timerRunning, setTimerRunning] = useState(false)
  const [elapsedBeforePause, setElapsedBeforePause] = useState(0)
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null)
  const [dashboardExpanded, setDashboardExpanded] = useState(false)
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const elapsedMs =
    elapsedBeforePause +
    (timerRunning && timerStartedAt !== null ? now - timerStartedAt : 0)
  const toggleTimer = () => {
    if (timerRunning) {
      setElapsedBeforePause(elapsedMs)
      setTimerStartedAt(null)
      setTimerRunning(false)
    } else {
      setTimerStartedAt(Date.now())
      setTimerRunning(true)
    }
  }
  const resetTimer = () => {
    setElapsedBeforePause(0)
    setTimerStartedAt(timerRunning ? Date.now() : null)
  }

  const todayProgress = data
    ? {
        done: data.todayDone,
        target: data.dailyProblemTarget,
        minutes: data.todayMinutes,
        minuteTarget: data.dailyMinuteTarget,
        streak: streak?.currentStreak ?? 0,
        percentage:
          data.dailyProblemTarget > 0
            ? Math.round((data.todayDone / data.dailyProblemTarget) * 100)
            : 0,
      }
    : null

  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1>{current?.label ?? '设置'}</h1>
      </div>
      <div className="topbar-meta">
        {data && todayProgress && (
          <button
            className={`today-dashboard-trigger ${dashboardExpanded ? 'expanded' : ''}`}
            onClick={() => setDashboardExpanded(!dashboardExpanded)}
            title="查看今日进度详情"
          >
            <Target size={16} />
            <span className="dashboard-compact">
              <strong>{todayProgress.done}</strong>
              <small>/{todayProgress.target}</small>
            </span>
            <ChevronDown size={14} className="dashboard-chevron" />
          </button>
        )}
        <button
          className="topbar-command-btn"
          onClick={onOpenCommand}
          title="命令菜单 (Ctrl+K)"
          aria-label="打开命令菜单"
        >
          <Command size={15} />
          <span>命令</span>
        </button>
        <div className={timerRunning ? 'focus-timer running' : 'focus-timer'}>
          <Clock3 size={15} />
          <strong>{formatElapsed(elapsedMs)}</strong>
          <button
            className="timer-control"
            onClick={toggleTimer}
            title={timerRunning ? '暂停本次计时' : '开始本次计时'}
            aria-label={timerRunning ? '暂停本次计时' : '开始本次计时'}
          >
            {timerRunning ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            className="timer-control"
            onClick={resetTimer}
            title="清零本次计时"
            aria-label="清零本次计时"
          >
            <RotateCcw size={14} />
          </button>
        </div>
        <button
          className="icon-button"
          onClick={onOpenHelp}
          title="快捷键帮助 (? / F1)"
          aria-label="打开快捷键帮助指南"
        >
          <HelpCircle size={17} />
        </button>
        <button
          className="icon-button"
          onClick={onRefresh}
          title="刷新数据"
          aria-label="刷新数据"
        >
          <RefreshCw size={17} />
        </button>
      </div>

      {dashboardExpanded && data && todayProgress && (
        <div className="today-dashboard-panel">
          <div className="dashboard-stat">
            <span className="stat-label">今日完成</span>
            <div className="stat-value">
              <strong>{todayProgress.done}</strong>
              <small>/ {todayProgress.target} 题</small>
            </div>
            <div className="stat-progress">
              <div
                className="stat-progress-bar"
                style={{ width: `${Math.min(todayProgress.percentage, 100)}%` }}
              />
            </div>
          </div>
          <div className="dashboard-stat">
            <span className="stat-label">用时</span>
            <div className="stat-value">
              <strong>{todayProgress.minutes}</strong>
              <small>/ {todayProgress.minuteTarget} 分</small>
            </div>
          </div>
          <div className="dashboard-stat">
            <span className="stat-label">连续刷题</span>
            <div className="stat-value">
              <strong>{todayProgress.streak}</strong>
              <small>天 🔥</small>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

function Toast({ text, close }: { text: string; close: () => void }) {
  useEffect(() => {
    const t = setTimeout(close, 3500)
    return () => clearTimeout(t)
  }, [close])
  return (
    <motion.div
      className="toast"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
    >
      <Check size={16} />
      <span>{text}</span>
      <button onClick={close} aria-label="关闭提示">
        <X size={15} />
      </button>
    </motion.div>
  )
}

export default function App() {
  const [data, setData] = useState<BootstrapData | null>(null)
  const [streak, setStreak] = useState<{ currentStreak: number; bestStreak: number } | null>(
    null
  )
  const [view, setView] = useState<View>('today')
  const learningCenterEnabled = isFeatureEnabled('learningCenterV1')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [practiceQueue, setPracticeQueue] = useState<RecommendedQuestion[] | null>(null)
  const [practiceStartIndex, setPracticeStartIndex] = useState(0)
  const [practiceSessionRevision, setPracticeSessionRevision] = useState(0)
  const [attemptMode, setAttemptMode] = useState<AttemptMode>('paper')
  const [libraryStatus, setLibraryStatus] = useState('all')
  const [formulaDrawerOpen, setFormulaDrawerOpen] = useState(false)
  const [commandMenuOpen, setCommandMenuOpen] = useState(false)
  const [blitzModalOpen, setBlitzModalOpen] = useState(false)
  const [blitzResult, setBlitzResult] = useState<BlitzExamResult | null>(null)
  const [isZenMode, setIsZenMode] = useState(false)
  const [sessionToRestore, setSessionToRestore] = useState<PracticeSessionState | null>(null)
  const [showSessionQueueList, setShowSessionQueueList] = useState(false)
  const [theme, setTheme] = useState<'light' | 'warm'>(() => {
    try {
      const saved = localStorage.getItem('shuaba_theme') as any
      return saved === 'warm' ? 'warm' : 'light'
    } catch {
      return 'light'
    }
  })
  const [fontScale, setFontScale] = useState<'standard' | 'medium' | 'large'>(() => {
    try {
      return (localStorage.getItem('shuaba_font_scale') as any) || 'standard'
    } catch {
      return 'standard'
    }
  })
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    try {
      return localStorage.getItem('shuaba_reduced_motion') === 'true'
    } catch {
      return false
    }
  })
  const [masteryChapters, setMasteryChapters] = useState<MasteryChapter[]>([])
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null)
  const [insightsInitialTab, setInsightsInitialTab] = useState<'overview' | 'inbox'>(
    'overview'
  )
  const [pressureReport, setPressureReport] = useState<GradingReport | null>(null)
  const [pressureReportSession, setPressureReportSession] =
    useState<PressureSession | null>(null)
  const [pressureReportQuestions, setPressureReportQuestions] = useState<
    Record<number, Question>
  >({})
  const [pressureReportOpen, setPressureReportOpen] = useState(false)
  const [pressureReportLoading, setPressureReportLoading] = useState(false)
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('shuaba_theme', theme)
    } catch {}
  }, [theme])

  useEffect(() => {
    document.documentElement.setAttribute('data-font-scale', fontScale)
    try {
      localStorage.setItem('shuaba_font_scale', fontScale)
    } catch {}
  }, [fontScale])

  useEffect(() => {
    document.documentElement.setAttribute('data-reduced-motion', String(reducedMotion))
    try {
      localStorage.setItem('shuaba_reduced_motion', String(reducedMotion))
    } catch {}
  }, [reducedMotion])

  useEffect(() => {
    if (view !== 'today') setPracticeStartIndex(0)
  }, [view])

  // 全局坚果云后台数据静默同步与实时快照发布
  useEffect(() => {
    let timer: number | undefined
    const doAutoSync = () => {
      if (document.visibilityState === 'visible') {
        void triggerBackgroundSync('auto_interval')
      }
    }
    const initTimer = window.setTimeout(doAutoSync, 3000)
    timer = window.setInterval(doAutoSync, 60_000)
    document.addEventListener('visibilitychange', doAutoSync)
    return () => {
      window.clearTimeout(initTimer)
      if (timer) window.clearInterval(timer)
      document.removeEventListener('visibilitychange', doAutoSync)
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [boot, map, streakData] = await Promise.all([
        bootstrap(),
        getMasteryMap(),
        getStreak(),
      ])
      setData(boot)
      setMasteryChapters(map)
      setStreak(streakData)
    } catch (error) {
      setNotice(`加载失败：${String(error)}`)
    } finally {
      setLoading(false)
    }
  }, [])

  // 启动静默检查一次更新，有新版只做轻提示不打扰
  const updateCheckedRef = useRef(false)
  useEffect(() => {
    if (updateCheckedRef.current) return
    updateCheckedRef.current = true
    void checkAppUpdate()
      .then((update) => {
        if (update) {
          setNotice(`发现新版本 v${update.version}，到 设置 → 版本与在线更新 一键升级`)
        }
      })
      .catch(() => undefined)
  }, [])

  const [appVersion, setAppVersion] = useState<string>('开发版')

  useEffect(() => {
    void getAppVersion().then(setAppVersion).catch(() => undefined)
  }, [])

  const openPressureReport = useCallback(
    async ({ sessionId, taskId }: { sessionId?: string; taskId?: string }) => {
      setPressureReportLoading(true)
      try {
        const sessions = await listPressureSessions()
        const session = sessionId
          ? sessions.find((item) => item.sessionId === sessionId)
          : taskId
          ? sessions.find((item) => item.taskId === taskId)
          : sessions.find(
              (item) => item.status === 'graded' || item.status === 'graded_partial'
            )
        if (!session) {
          setNotice('没有找到这次压力模拟，暂时无法打开学习报告')
          return false
        }
        const report = await getPressureGradingReport(session.sessionId)
        if (!report) {
          setNotice('学习报告还未生成。请先在 Codex 收件箱确认整组批改，再刷新报告')
          return false
        }
        const questionIds = Array.from(
          new Set([
            ...(report.questionIds ?? []),
            ...report.grades.map((grade) => grade.questionId),
            ...(session.questionIds ?? []),
          ])
        )
        const loaded = await Promise.all(
          questionIds.map(async (questionId) => {
            try {
              return await getQuestion(questionId)
            } catch {
              return null
            }
          })
        )
        setPressureReportQuestions(
          Object.fromEntries(
            loaded
              .filter((question): question is Question => Boolean(question))
              .map((question) => [question.id, question])
          )
        )
        setPressureReportSession(session)
        setPressureReport(report)
        setPressureReportOpen(true)

        // 自动同步脱敏公开战报到本地公开快照缓存
        try {
          const publicMatchId = session.sessionId || `match-${Date.now()}`
          const sanitizedReport = sanitizeGradingReportToPublic(report, publicMatchId)
          const correctCount = (report.grades || []).filter((g) => g.verdict === 'correct').length
          const questionCount = Math.max(1, (report.grades || []).length)
          const accuracy = report.summary?.accuracy ?? Math.round((correctCount / questionCount) * 100)
          const avgRating = (report.grades || []).reduce((sum, g) => sum + (g.rating ?? 1.0), 0) / questionCount
          const myCustom = getSavedMyCustomProfile()
          const match: FriendPublicMatch = {
            publicMatchId,
            startedAt: new Date(session.startTime || Date.now() - 600000).toISOString(),
            finishedAt: new Date(session.endTime || Date.now()).toISOString(),
            mode: session.mode || 'pressure',
            title: '高压演练',
            questionCount,
            correctCount,
            accuracy,
            durationSeconds: session.totalDuration || report.summary?.totalDuration || 600,
            rating: Number.isFinite(avgRating) ? Number(avgRating.toFixed(2)) : 1.15,
            result: accuracy >= 80 ? 'win' : accuracy <= 40 ? 'loss' : 'mixed',
            reportId: sanitizedReport.reportId,
            reportAvailable: true,
          }
          recordMyPublicMatch(match, sanitizedReport)
          addFriendActivity({
            id: `act-${publicMatchId}`,
            friendCode: myCustom.friendCode,
            nickname: myCustom.nickname,
            avatar: myCustom.avatar,
            type: 'exam_finish',
            title: `完成了高压演练 (${questionCount}题 · ${accuracy}% 正确率)`,
            content: report.summary?.suggestions?.join('；') || '完成了一组战术高压演练，状态良好。',
            timestamp: new Date().toISOString(),
          })
          void triggerBackgroundSync('match_graded')
        } catch {
          // ignore
        }

        return true
      } catch (error) {
        setNotice(`无法加载学习报告：${String(error)}`)
        return false
      } finally {
        setPressureReportLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    void loadPracticeSession()
      .then((session) => {
        if (session?.queue.length) setSessionToRestore(session)
      })
      .catch(() => {})
  }, [])

  const startRecommendedBatch = useCallback(async (taskId: string) => {
    try {
      await startRecommendationBatch(taskId)
      const [queue, nextData] = await Promise.all([getRecommendations(50), bootstrap()])
      setPracticeQueue(queue)
      setAttemptMode('paper')
      setData(nextData)
      setView('today')
      setNotice('已开始 AI 题组，已进入今日训练')
    } catch (error) {
      setNotice(`无法开始 AI 题组：${String(error)}`)
      throw error
    }
  }, [])

  const startReview = useCallback(async () => {
    try {
      const queue = await getReviewQueue(50)
      if (!queue.length) {
        setNotice('今天没有待复习题，先完成新的训练或明天再来')
        return
      }
      setPracticeQueue(queue)
      setAttemptMode('review')
      setView('today')
      setNotice(`已进入错题复习，共 ${queue.length} 道`)
    } catch (error) {
      setNotice(`无法加载复习队列：${String(error)}`)
    }
  }, [])

  const startVariantPractice = useCallback(async (questionId: number) => {
    try {
      const queue = await getVariantQueue(questionId, 3)
      if (!queue.length) {
        setNotice('该考点下的同类题今天均已完成或没有更多变式题')
        return
      }
      setPracticeQueue(queue)
      setAttemptMode('paper')
      setView('today')
      setNotice(`已调出该考点 3 道同类变式题，开始攻坚训练`)
    } catch (error) {
      setNotice(`加载变式题失败：${String(error)}`)
    }
  }, [])

  const startTagPractice = useCallback(async (tagName: string) => {
    try {
      const page = await searchQuestionPage({
        query: tagName,
        categoryId: null,
        status: 'all',
        scope: 'all',
        page: 1,
        pageSize: 3,
      })
      if (page.items.length > 0) {
        setPracticeQueue(
          page.items.map((q) => ({
            question: q,
            score: 90,
            reason: `定向攻坚 · ${tagName}`,
            reasonCode: 'weakness',
          }))
        )
        setAttemptMode('paper')
        setView('today')
        setNotice(`已调出「${tagName}」3 道针对性攻坚题，进入今日训练`)
      } else {
        setNotice(
          `题库中暂未搜索到直接匹配「${tagName}」的题目，建议在题库中选择对应章节`
        )
      }
    } catch (error) {
      setNotice(`发起针对性练习失败：${String(error)}`)
    }
  }, [])

  // Global shortcuts: Ctrl+K (command), Alt+F (formula), Alt+Z (zen), ?/F1 (help), Esc (close)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        Boolean(target?.isContentEditable)

      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setCommandMenuOpen((prev) => !prev)
        return
      }
      if (e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        setFormulaDrawerOpen((prev) => !prev)
        return
      }
      if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        setIsZenMode((prev) => !prev)
        return
      }
      if (!isInput && (e.key === '?' || e.key === 'F1')) {
        e.preventDefault()
        setKeyboardHelpOpen((prev) => !prev)
        return
      }
      if (e.key === 'Escape') {
        if (keyboardHelpOpen) {
          e.preventDefault()
          setKeyboardHelpOpen(false)
          return
        }
        if (commandMenuOpen) {
          e.preventDefault()
          setCommandMenuOpen(false)
          return
        }
        if (formulaDrawerOpen) {
          e.preventDefault()
          setFormulaDrawerOpen(false)
          return
        }
        if (blitzModalOpen) {
          e.preventDefault()
          setBlitzModalOpen(false)
          return
        }
        if (sessionToRestore) {
          e.preventDefault()
          setSessionToRestore(null)
          return
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [keyboardHelpOpen, commandMenuOpen, formulaDrawerOpen, blitzModalOpen, sessionToRestore])

  const startBlitzExam = useCallback(() => {
    const pool = data?.recommendations ?? []
    const blitzQuestions = pool.slice(0, 4)
    if (blitzQuestions.length < 2) {
      setNotice('当前题量不足以开启 15 分钟闪击战')
      return
    }
    setPracticeQueue(
      blitzQuestions.map((item) => ({
        ...item,
        reason: '15分钟真题闪击战',
        reasonCode: 'blitz',
      }))
    )
    setAttemptMode('paper')
    setView('today')
    setNotice('⚡ 15 分钟真题闪击战已开始！计时进行中...')
  }, [data])

  const handleBlitzFinish = useCallback((result: BlitzExamResult) => {
    setBlitzResult(result)
    setBlitzModalOpen(true)
  }, [])

  const commandActions = useMemo<CommandAction[]>(
    () => [
      ...(learningCenterEnabled
        ? [{
            id: 'view-learning',
            label: '跳转到学习中心',
            hint: '视图',
            icon: GraduationCap,
            run: () => setView('learning'),
          }]
        : []),
      {
        id: 'view-today',
        label: '跳转到今日训练',
        hint: '视图',
        icon: Zap,
        run: () => setView('today'),
      },
      {
        id: 'view-library',
        label: '跳转到题库',
        hint: '视图',
        icon: LibraryBig,
        run: () => setView('library'),
      },
      {
        id: 'view-review',
        label: '跳转到复盘',
        hint: '视图',
        icon: TimerReset,
        run: () => setView('review'),
      },
      {
        id: 'view-mastery',
        label: '跳转到掌握度地图',
        hint: '视图',
        icon: Compass,
        run: () => setView('mastery'),
      },
      {
        id: 'view-insights',
        label: '跳转到数据',
        hint: '视图',
        icon: BarChart3,
        run: () => setView('insights'),
      },
      {
        id: 'view-friends',
        label: '查看好友数据',
        hint: '视图',
        icon: Users,
        run: () => setView('friends'),
      },
      {
        id: 'view-settings',
        label: '跳转到设置',
        hint: '视图',
        icon: Settings,
        run: () => setView('settings'),
      },
      {
        id: 'formula',
        label: '公式速查',
        hint: 'Alt+F',
        icon: BookMarked,
        run: () => setFormulaDrawerOpen(true),
      },
      {
        id: 'keyboard-help',
        label: '键盘快捷键指南',
        hint: '?',
        icon: HelpCircle,
        run: () => setKeyboardHelpOpen(true),
      },
      {
        id: 'blitz',
        label: '开始 15 分钟真题闪击战',
        hint: '训练',
        icon: Zap,
        run: () => startBlitzExam(),
      },
      {
        id: 'zen',
        label: isZenMode ? '退出沉浸专注模式' : '进入沉浸专注模式',
        hint: 'Alt+Z',
        icon: Maximize2,
        run: () => setIsZenMode((z) => !z),
      },
      { id: 'refresh', label: '刷新数据', icon: RefreshCw, run: () => refresh() },
    ],
    [isZenMode, learningCenterEnabled, refresh, startBlitzExam]
  )

  useEffect(() => {
    void refresh()
  }, [refresh])
  useEffect(() => {
    const onFocus = () => {
      void refresh()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])
  useEffect(() => {
    let lastPending = data?.inboxCount ?? -1
    const timer = setInterval(async () => {
      try {
        const summary = await refreshInbox()
        if (summary.pendingCount > lastPending && lastPending >= 0) {
          setNotice(
            `收件箱收到 ${
              summary.pendingCount - lastPending
            } 份新的 Codex 回传，可以在 AI 批改页查看`
          )
          void refresh()
        }
        lastPending = summary.pendingCount
      } catch {
        /* poll quietly, next tick will retry */
      }
    }, 20000)
    return () => clearInterval(timer)
  }, [data?.inboxCount, refresh])

  if (loading && !data) return <LoadingScreen />

  return (
    <div className={`app-shell ${isZenMode ? 'zen-mode' : ''}`}>
      <Sidebar
        view={view}
        setView={setView}
        appVersion={appVersion}
        learningCenterEnabled={learningCenterEnabled}
      />
      <main className="main-area">
        <Topbar
          view={view}
          onRefresh={refresh}
          onOpenCommand={() => setCommandMenuOpen(true)}
          onOpenHelp={() => setKeyboardHelpOpen(true)}
          data={data ?? undefined}
          streak={streak}
        />
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            className="view-stage"
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.18 }}
          >
            {learningCenterEnabled && view === 'learning' && (
              <LearningCenterView
                onNotify={setNotice}
                onNavigate={(target) => {
                  switch (target.type) {
                    case 'today':
                      setView('today')
                      break
                    case 'review':
                      setView('review')
                      break
                    case 'mastery':
                      setView('mastery')
                      break
                    case 'insights':
                      setView('insights')
                      break
                    case 'friends':
                      setView('friends')
                      break
                    case 'report':
                      void openPressureReport({ sessionId: target.sessionId })
                      break
                    case 'pressure':
                      setView('today')
                      setNotice('压力模拟请从今日训练进入；学习中心不会替你创建会话。')
                      break
                    case 'batch_grade':
                      setView('today')
                      setNotice('整组批改入口仍由今日训练中的功能开关控制。')
                      break
                  }
                }}
              />
            )}
            {data && view === 'today' && (
              <TodayView
                key={practiceSessionRevision}
                data={data}
                initialQueue={practiceQueue}
                initialIndex={practiceStartIndex}
                attemptMode={attemptMode}
                onQueueChange={setPracticeQueue}
                refresh={refresh}
                setView={setView}
                notify={setNotice}
                onStartVariant={startVariantPractice}
                onActiveQuestionChange={setActiveQuestion}
                onOpenFormula={() => setFormulaDrawerOpen(true)}
                onStartBlitz={startBlitzExam}
                onToggleZen={() => setIsZenMode((z) => !z)}
                isZenMode={isZenMode}
                onBlitzFinish={handleBlitzFinish}
                onOpenPressureReport={(sessionId) => openPressureReport({ sessionId })}
                pressureReportLoading={pressureReportLoading}
              />
            )}
            {view === 'library' && data && (
              <LibraryView
                data={data}
                initialStatus={libraryStatus}
                queueCount={data?.customQueueCount ?? 0}
                refresh={refresh}
                notify={setNotice}
                onPractice={(questions, reason) => {
                  setPracticeQueue(
                    questions.map((question) => ({
                      question,
                      score: 100,
                      reason,
                      reasonCode: 'custom',
                    }))
                  )
                  setAttemptMode('paper')
                  setView('today')
                }}
                onPracticeFocus={(queue) => {
                  setPracticeQueue(queue ?? null)
                  setAttemptMode('paper')
                  setView('today')
                }}
              />
            )}
            {data && view === 'review' && (
              <ReviewMapView
                due={data.dueCount}
                inboxCount={data.inboxCount}
                intervals={data.reviewIntervals}
                chapters={masteryChapters}
                notify={setNotice}
                onStart={startReview}
                onOpenWrongBook={() => {
                  setLibraryStatus('wrong')
                  setView('library')
                }}
                onPractice={(question) => {
                  setPracticeQueue([
                    {
                      question,
                      score: 100,
                      reason: '从复盘地图重新练习',
                      reasonCode: 'due',
                    },
                  ])
                  setAttemptMode('review')
                  setView('today')
                  setNotice(`已打开题目 #${question.id}`)
                }}
                onPracticeBatch={(questions, reason) => {
                  setPracticeQueue(
                    questions.map((q) => ({
                      question: q,
                      score: 100,
                      reason,
                      reasonCode: 'due',
                    }))
                  )
                  setAttemptMode('review')
                  setView('today')
                  setNotice(`已调出 ${questions.length} 道错题开始专项攻坚`)
                }}
                onStartVariant={startVariantPractice}
                onOpenInbox={() => {
                  setInsightsInitialTab('inbox')
                  setView('insights')
                }}
              />
            )}
            {data && view === 'mastery' && (
              <MasteryMapView
                notify={setNotice}
                onPractice={(question) => {
                  setPracticeQueue([
                    {
                      question,
                      score: 100,
                      reason: '从掌握度地图调出练习',
                      reasonCode: 'custom',
                    },
                  ])
                  setAttemptMode('paper')
                  setView('today')
                  setNotice(`已调出题目 #${question.id}`)
                }}
                onPracticeBatch={(questions, reason) => {
                  setPracticeQueue(
                    questions.map((q) => ({
                      question: q,
                      score: 100,
                      reason,
                      reasonCode: 'custom',
                    }))
                  )
                  setAttemptMode('paper')
                  setView('today')
                  setNotice(`已调出 ${questions.length} 道题目开始专项攻坚`)
                }}
                onStartVariant={startVariantPractice}
                onAddToQueue={async (questionId) => {
                  try {
                    await addToCustomQueue(questionId)
                    await refresh()
                    setNotice(`已加入训练队列 #${questionId}`)
                  } catch (e) {
                    setNotice(`加入队列失败: ${String(e)}`)
                  }
                }}
              />
            )}
            {data && view === 'friends' && (
              <FriendsLadderView
                tacticalData={null}
                bootstrapData={data}
                eloStatus={null}
                notify={setNotice}
              />
            )}
            {data && view === 'insights' && (
              <InsightsView
                data={data}
                refresh={refresh}
                onStartTagPractice={startTagPractice}
                onStartRecommendation={startRecommendedBatch}
                onStartVariant={startVariantPractice}
                initialTab={insightsInitialTab}
                notify={setNotice}
                onOpenPressureReport={(id) =>
                  openPressureReport(id.startsWith('SB-') ? { taskId: id } : { sessionId: id })
                }
              />
            )}
            {data && view === 'settings' && (
              <SettingsView
                data={data}
                refresh={refresh}
                theme={theme}
                onThemeChange={setTheme}
                fontScale={fontScale}
                onFontScaleChange={setFontScale}
                reducedMotion={reducedMotion}
                onReducedMotionChange={setReducedMotion}
                notify={setNotice}
                onOpenHelp={() => setKeyboardHelpOpen(true)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <CommandMenu
        open={commandMenuOpen}
        onClose={() => setCommandMenuOpen(false)}
        actions={commandActions}
      />
      <FormulaDrawer
        open={formulaDrawerOpen}
        onClose={() => setFormulaDrawerOpen(false)}
        currentQuestion={activeQuestion}
        currentCategoryPath={activeQuestion?.categoryPath}
      />
      <BlitzExamModal
        open={blitzModalOpen}
        onClose={() => setBlitzModalOpen(false)}
        result={blitzResult}
        onRestart={startBlitzExam}
      />
      <KeyboardHelpModal
        open={keyboardHelpOpen}
        onClose={() => setKeyboardHelpOpen(false)}
      />

      {pressureReportOpen && pressureReport && (
        <PressureLearningReportView
          report={pressureReport}
          session={pressureReportSession}
          questions={pressureReportQuestions}
          loading={pressureReportLoading}
          onRefresh={() =>
            void openPressureReport({ sessionId: pressureReport.sessionId })
          }
          onClose={() => setPressureReportOpen(false)}
          onStartVariant={(questionId) => {
            setPressureReportOpen(false)
            void startVariantPractice(questionId)
          }}
        />
      )}

      {sessionToRestore && (
        <div className="ui-overlay modal-backdrop" style={{ zIndex: 100 }}>
          <div
            className="ui-modal modal-card session-restore-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-session-title"
          >
            <div className="modal-head">
              <h3 id="restore-session-title">发现未完成的刷题会话</h3>
              <button
                className="icon-button"
                onClick={() => setSessionToRestore(null)}
                aria-label="暂不处理"
              >
                <X size={18} />
              </button>
            </div>
            <p className="session-restore-desc">
              检测到上次离开时有 <strong>{sessionToRestore.queue.length}</strong>{' '}
              道题目尚未提交（
              {sessionToRestore.attemptMode === 'review' ? '复习模式' : '极速刷题'}
              ）。是否恢复继续作答？
            </p>
            {showSessionQueueList && (
              <div className="session-queue-preview">
                <div className="session-queue-preview-head">
                  待恢复题目清单 ({sessionToRestore.queue.length} 题)
                </div>
                <div className="session-queue-list">
                  {sessionToRestore.queue.map((item, i) => (
                    <div className="session-queue-item" key={item.question.id}>
                      <span className="queue-idx">#{i + 1}</span>
                      <span className="queue-id">[{item.question.id}]</span>
                      <span className="queue-stem">
                        {item.question.stem.slice(0, 45)}...
                      </span>
                      <span className="queue-cat">
                        {item.question.categoryPath.split(' / ').slice(-1)[0]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="session-restore-actions">
              <button
                className="primary-button"
                onClick={() => {
                  setPracticeQueue(sessionToRestore.queue)
                  setPracticeStartIndex(sessionToRestore.currentIndex)
                  setPracticeSessionRevision((revision) => revision + 1)
                  setAttemptMode(sessionToRestore.attemptMode)
                  setSessionToRestore(null)
                  setView('today')
                  setNotice(
                    `已为你恢复未完成练习（剩余 ${sessionToRestore.queue.length} 题）`
                  )
                }}
              >
                <Play size={16} /> 继续作答
              </button>
              <button
                className="secondary-button"
                onClick={() => setShowSessionQueueList(!showSessionQueueList)}
              >
                <ListPlus size={16} />{' '}
                {showSessionQueueList ? '收起题目清单' : '查看题目清单'}
              </button>
              <button
                className="danger-button"
                onClick={() => {
                  void clearPracticeSession()
                  setSessionToRestore(null)
                  setNotice('已放弃并清空未完成会话')
                }}
              >
                <Trash2 size={16} /> 放弃并清空
              </button>
            </div>
          </div>
        </div>
      )}
      <AnimatePresence>
        {notice && <Toast text={notice} close={() => setNotice('')} />}
      </AnimatePresence>
    </div>
  )
}
