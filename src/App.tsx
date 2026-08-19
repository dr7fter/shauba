import { AnimatePresence, motion } from 'framer-motion'
import {
  Archive, BarChart3, BookMarked, BookOpen, BrainCircuit, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Flame, FolderSearch, Heart,
  HelpCircle, History, Inbox, Layers, LibraryBig, ListPlus, LoaderCircle, Maximize2, Minimize2, Minus, Pause, Play, RefreshCw, RotateCcw, ScrollText, Search, Send, Settings, SkipForward,
  Sparkles, Target, ThumbsDown, ThumbsUp, TimerReset, Trash2, X, Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { localToday } from './utils'
import {
  addToCustomQueue, bootstrap, clearCustomQueue, confirmInbox, createCodexBatchTask, createCodexTask, dismissRecommendationBatch, exportRecords, getCategories, getCustomQueue, getDailyTrend, getFailedInbox, getFocusQueue, getInbox, getInsights, getMasteryMap, getMasteryNodes, getQuestion, getRecommendations, getReviewHistory, getReviewPlan, getReviewQueue, getStreak, getTaskPrompt, getVariantQueue, getWeaknessRadar,
  imageDataUrl, recordAttempt, refreshInbox, removeFromCustomQueue, saveGoal, saveNote, saveReviewIntervals, searchQuestionPage, setCurrentChapter, setFocusBranches, toggleFavorite, undoLastAttempt,
  startRecommendationBatch,
  getDailyLog,
  listDatabaseBackups,
  restoreDatabaseBackup,
  getRewardEvents,
  savePracticeSession,
  loadPracticeSession,
  clearPracticeSession,
} from './api'
import { MathText } from './components/MathText'
import { FormulaDrawer } from './components/FormulaDrawer'
import { GameCenterModal } from './components/GameCenterModal'
import { DailyContractModal } from './components/DailyContractModal'
import { BattleReportModal } from './components/BattleReportModal'
import { BlitzExamModal } from './components/BlitzExamModal'
import { computeGamification, isAudioMuted, playCorrectSound, playLevelUpSound, setAudioMuted } from './data/gamification'
import { getExamCountdown, getDailyContract, checkContractStatus, updateHallOfFame, gradeBlitzExam } from './data/motivation'
import type { BlitzExamResult } from './data/motivation'
import { clampAttemptDuration, determineAttemptEvidence } from './domain/evidence'
import type { AttemptOutcome, BackupInfo, BootstrapData, CategoryNode, CodexTask, DailyLog, DailyTrendPoint, ErrorBreakpoint, FailedInboxItem, InboxItem, InsightPoint, MasteryChapter, MasteryNode, PracticeSessionState, Question, QuestionPage, RecommendedQuestion, ReviewHistory, ReviewPlan, RewardEvent, WeaknessRadar } from './types'

type View = 'today' | 'library' | 'review' | 'insights' | 'settings'
type AttemptMode = 'paper' | 'review'

const navItems: Array<{ id: View; label: string; icon: typeof BookOpen }> = [
  { id: 'today', label: '今日', icon: Zap },
  { id: 'library', label: '题库', icon: LibraryBig },
  { id: 'review', label: '复盘', icon: TimerReset },
  { id: 'insights', label: '进展', icon: BarChart3 },
]

const reasonLabels: Record<string, string> = {
  due: '到期复习',
  weakness: '薄弱修复',
  diagnosis: 'AI 诊断',
  explore: '范围覆盖',
  fit: '难度匹配',
  codex: 'Codex 推荐',
  chapter: '章节首轮',
  focus_branch: '专项多分支',
  custom: '自定义队列',
  blitz: '⚡ 闪击战',
  boss: '🐉 魔王讨伐',
  variant_practice: '变式攻坚',
  yesterday_wrong: '昨日错题重测',
  retest: '错题重测',
}

const ratingOptions = [
  { value: 1, label: '1 · 没思路', hint: '概念边界不清 / 盲区' },
  { value: 2, label: '2 · 没做完', hint: '方向对但卡在推导计算' },
  { value: 3, label: '3 · 稍有迟疑', hint: '解题完整 / 略有犹豫' },
  { value: 4, label: '4 · 流畅秒杀', hint: '一眼看透 / 一气呵成' },
]

const BREAKPOINTS: ErrorBreakpoint[] = [
  { id: 'concept', label: '概念边界', desc: '定义/定理前提条件不清晰' },
  { id: 'strategy', label: '策略选择', desc: '解题方向/突破口选用错误' },
  { id: 'calc', label: '推导计算', desc: '符号/代数/积分求导计算失误' },
  { id: 'condition', label: '条件遗漏', desc: '忽略隐式前提/正负号/区间' },
  { id: 'check', label: '审题偏差', desc: '看错题目问法/变量含义' },
]


function App() {
  const [data, setData] = useState<BootstrapData | null>(null)
  const [view, setView] = useState<View>('today')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [practiceQueue, setPracticeQueue] = useState<RecommendedQuestion[] | null>(null)
  const [practiceStartIndex, setPracticeStartIndex] = useState(0)
  const [practiceSessionRevision, setPracticeSessionRevision] = useState(0)
  const [attemptMode, setAttemptMode] = useState<AttemptMode>('paper')
  const [libraryStatus, setLibraryStatus] = useState('all')
  const [formulaDrawerOpen, setFormulaDrawerOpen] = useState(false)
  const [gameCenterOpen, setGameCenterOpen] = useState(false)
  const [contractModalOpen, setContractModalOpen] = useState(false)
  const [battleReportModalOpen, setBattleReportModalOpen] = useState(false)
  const [blitzModalOpen, setBlitzModalOpen] = useState(false)
  const [blitzResult, setBlitzResult] = useState<BlitzExamResult | null>(null)
  const [isZenMode, setIsZenMode] = useState(false)
  const [sessionToRestore, setSessionToRestore] = useState<PracticeSessionState | null>(null)
  const [showSessionQueueList, setShowSessionQueueList] = useState(false)
  const [theme, setTheme] = useState<'light' | 'warm' | 'dark' | 'system'>(() => {
    try {
      return (localStorage.getItem('shuaba_theme') as any) || 'system'
    } catch {
      return 'system'
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
  const [isPureMode, setIsPureMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('shuaba_pure_mode') === 'true'
    } catch {
      return false
    }
  })
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null)
  const [masteryChapters, setMasteryChapters] = useState<MasteryChapter[]>([])
  const [rewardEvents, setRewardEvents] = useState<RewardEvent[]>([])
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null)
  const [insightsInitialTab, setInsightsInitialTab] = useState<'overview' | 'inbox'>('overview')

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
    } else {
      root.setAttribute('data-theme', theme)
    }
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

  const togglePureMode = useCallback(() => {
    setIsPureMode((prev) => {
      const next = !prev
      try {
        localStorage.setItem('shuaba_pure_mode', String(next))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (view !== 'today') setPracticeStartIndex(0)
  }, [view])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [boot, log, map, rewards] = await Promise.all([bootstrap(), getDailyLog(), getMasteryMap(), getRewardEvents()])
      setData(boot)
      setDailyLog(log)
      setMasteryChapters(map)
      setRewardEvents(rewards)
    }
    catch (error) { setNotice(`加载失败：${String(error)}`) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    void loadPracticeSession()
      .then((session) => {
        if (session?.queue.length) setSessionToRestore(session)
      })
      .catch(() => {})
  }, [])

  const gamificationStats = useMemo(() => {
    return computeGamification(dailyLog?.items ?? [], masteryChapters, 0, rewardEvents)
  }, [dailyLog, masteryChapters, rewardEvents])

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
    } catch (error) { setNotice(`无法加载复习队列：${String(error)}`) }
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
      const page = await searchQuestionPage({ query: tagName, categoryId: null, status: 'all', scope: 'all', page: 1, pageSize: 3 })
      if (page.items.length > 0) {
        setPracticeQueue(page.items.map((q) => ({ question: q, score: 90, reason: `定向攻坚 · ${tagName}`, reasonCode: 'weakness' })))
        setAttemptMode('paper')
        setView('today')
        setNotice(`已调出「${tagName}」3 道针对性攻坚题，进入今日训练`)
      } else {
        setNotice(`题库中暂未搜索到直接匹配「${tagName}」的题目，建议在题库中选择对应章节`)
      }
    } catch (error) {
      setNotice(`发起针对性练习失败：${String(error)}`)
    }
  }, [])

  // Global shortcuts: Alt+F (formula), Alt+D (contract), Alt+B (report), Alt+Z (zen), Alt+P (pure mode)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault()
        setFormulaDrawerOpen((prev) => !prev)
      } else if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault()
        setContractModalOpen((prev) => !prev)
      } else if (e.altKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault()
        setBattleReportModalOpen((prev) => !prev)
      } else if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        setIsZenMode((prev) => !prev)
      } else if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        togglePureMode()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [togglePureMode])

  const startBossBattle = useCallback(async (chapterName: string) => {
    try {
      const page = await searchQuestionPage({ query: chapterName, categoryId: null, status: 'all', scope: 'all', page: 1, pageSize: 5 })
      if (page.items.length) {
        setPracticeQueue(page.items.map((q) => ({ question: q, score: 100, reason: `魔王讨伐战 · ${chapterName}`, reasonCode: 'boss' })))
        setAttemptMode('paper')
        setView('today')
        setNotice(`⚔️ 已开启「魔王 · ${chapterName}」讨伐关卡 (5题攻坚)`)
      } else {
        setNotice('该魔王关卡暂无对应题目')
      }
    } catch (e) {
      setNotice(`无法开启魔王战：${String(e)}`)
    }
  }, [])

  const startBlitzExam = useCallback(() => {
    const pool = data?.recommendations ?? []
    const blitzQuestions = pool.slice(0, 4)
    if (blitzQuestions.length < 2) {
      setNotice('当前题量不足以开启 15 分钟闪击战')
      return
    }
    setPracticeQueue(blitzQuestions.map((item) => ({ ...item, reason: '15分钟真题闪击战', reasonCode: 'blitz' })))
    setAttemptMode('paper')
    setView('today')
    setNotice('⚡ 15 分钟真题闪击战已开始！计时进行中...')
  }, [data])

  const handleBlitzFinish = useCallback((result: BlitzExamResult) => {
    setBlitzResult(result)
    setBlitzModalOpen(true)
  }, [])

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])
  useEffect(() => {
    let lastPending = data?.inboxCount ?? -1
    const timer = setInterval(async () => {
      try {
        const summary = await refreshInbox()
        if (summary.pendingCount > lastPending && lastPending >= 0) {
          setNotice(`收件箱收到 ${summary.pendingCount - lastPending} 份新的 Codex 回传，可以在 AI 批改页查看`)
          void refresh()
        }
        lastPending = summary.pendingCount
      } catch { /* poll quietly, next tick will retry */ }
    }, 20000)
    return () => clearInterval(timer)
  }, [data?.inboxCount, refresh])

  if (loading && !data) return <LoadingScreen />

  return (
    <div className={`app-shell ${isZenMode ? 'zen-mode' : ''} ${isPureMode ? 'pure-mode' : ''}`}>
      <Sidebar view={view} setView={setView} />
      <main className="main-area">
        <Topbar
          view={view}
          data={data}
          onRefresh={refresh}
          onOpenFormula={() => setFormulaDrawerOpen(true)}
          onOpenGameCenter={() => setGameCenterOpen(true)}
          onOpenContract={() => setContractModalOpen(true)}
          onOpenBattleReport={() => setBattleReportModalOpen(true)}
          onToggleZen={() => setIsZenMode((z) => !z)}
          isZenMode={isZenMode}
          isPureMode={isPureMode}
          onTogglePureMode={togglePureMode}
          gamificationStats={gamificationStats}
          rewardEvents={rewardEvents}
        />
        <AnimatePresence mode="wait">
          <motion.div key={view} className="view-stage" initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.18 }}>
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
                isPureMode={isPureMode}
                onBlitzFinish={handleBlitzFinish}
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
                  setPracticeQueue(questions.map((question) => ({ question, score: 100, reason, reasonCode: 'custom' })))
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
            {view === 'review' && (
              <ReviewView
                due={data?.dueCount ?? 0}
                inboxCount={data?.inboxCount ?? 0}
                intervals={data?.reviewIntervals ?? [1, 3, 7, 15]}
                notify={setNotice}
                onStart={startReview}
                onOpenWrongBook={() => {
                  setLibraryStatus('wrong')
                  setView('library')
                }}
                onPractice={(question) => {
                  setPracticeQueue([{ question, score: 100, reason: '从错题页重新练习', reasonCode: 'due' }])
                  setAttemptMode('review')
                  setView('today')
                  setNotice(`已打开错题 #${question.id}`)
                }}
                onPracticeBatch={(questions, reason) => {
                  setPracticeQueue(questions.map((q) => ({ question: q, score: 100, reason, reasonCode: 'due' })))
                  setAttemptMode('review')
                  setView('today')
                  setNotice(`已调出 ${questions.length} 道错题开始专项攻坚`)
                }}
                onStartVariant={startVariantPractice}
                onOpenInbox={() => { setInsightsInitialTab('inbox'); setView('insights') }}
              />
            )}
            {data && view === 'insights' && (
              <InsightsView
                data={data}
                refresh={refresh}
                onStart={() => { setPracticeQueue(null); setAttemptMode('paper'); setView('today') }}
                onStartReview={startReview}
                onStartTagPractice={startTagPractice}
                onStartRecommendation={startRecommendedBatch}
                onStartVariant={startVariantPractice}
                initialTab={insightsInitialTab}
                notify={setNotice}
              />
            )}
            {data && view === 'settings' && (
              <SettingsView
                data={data}
                refresh={refresh}
                isPureMode={isPureMode}
                onTogglePureMode={togglePureMode}
                theme={theme}
                onThemeChange={setTheme}
                fontScale={fontScale}
                onFontScaleChange={setFontScale}
                reducedMotion={reducedMotion}
                onReducedMotionChange={setReducedMotion}
                notify={setNotice}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <FormulaDrawer open={formulaDrawerOpen} onClose={() => setFormulaDrawerOpen(false)} currentQuestion={activeQuestion} currentCategoryPath={activeQuestion?.categoryPath} />
      <GameCenterModal
        open={gameCenterOpen}
        onClose={() => setGameCenterOpen(false)}
        stats={gamificationStats}
        rewardEvents={rewardEvents}
        onRewardClaimed={() => { void refresh() }}
        chapters={masteryChapters}
        onStartBoss={startBossBattle}
      />
      <DailyContractModal
        open={contractModalOpen}
        onClose={() => setContractModalOpen(false)}
        todayDone={data?.todayDone ?? 0}
        todayMinutes={data?.todayMinutes ?? 0}
        targetProblemCount={data?.dailyProblemTarget}
        targetMinutesCount={data?.dailyMinuteTarget}
        dailyMode={data?.dailyMode}
        rewardEvents={rewardEvents}
        onClaimExp={(_exp) => {
          playLevelUpSound()
          void refresh()
        }}
        notify={setNotice}
      />
      {data && (
        <BattleReportModal
          open={battleReportModalOpen}
          onClose={() => setBattleReportModalOpen(false)}
          data={data}
          stats={gamificationStats}
          todayReviewCount={dailyLog?.items.filter((item) => item.mode === 'review').length ?? 0}
          notify={setNotice}
        />
      )}
      <BlitzExamModal
        open={blitzModalOpen}
        onClose={() => setBlitzModalOpen(false)}
        result={blitzResult}
        onRestart={startBlitzExam}
      />
      {sessionToRestore && (
        <div className="modal-backdrop" style={{ zIndex: 100 }}>
          <div className="modal-card session-restore-modal" role="dialog" aria-modal="true" aria-labelledby="restore-session-title">
            <div className="modal-head">
              <h3 id="restore-session-title">发现未完成的刷题会话</h3>
              <button className="icon-button" onClick={() => setSessionToRestore(null)} aria-label="暂不处理">
                <X size={18} />
              </button>
            </div>
            <p className="session-restore-desc">
              检测到上次离开时有 <strong>{sessionToRestore.queue.length}</strong> 道题目尚未提交（{sessionToRestore.attemptMode === 'review' ? '复习模式' : '极速刷题'}）。是否恢复继续作答？
            </p>
            {showSessionQueueList && (
              <div className="session-queue-preview">
                <div className="session-queue-preview-head">待恢复题目清单 ({sessionToRestore.queue.length} 题)</div>
                <div className="session-queue-list">
                  {sessionToRestore.queue.map((item, i) => (
                    <div className="session-queue-item" key={item.question.id}>
                      <span className="queue-idx">#{i + 1}</span>
                      <span className="queue-id">[{item.question.id}]</span>
                      <span className="queue-stem">{item.question.stem.slice(0, 45)}...</span>
                      <span className="queue-cat">{item.question.categoryPath.split(' / ').slice(-1)[0]}</span>
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
                  setNotice(`已为你恢复未完成练习（剩余 ${sessionToRestore.queue.length} 题）`)
                }}
              >
                <Play size={16} /> 继续作答
              </button>
              <button
                className="secondary-button"
                onClick={() => setShowSessionQueueList(!showSessionQueueList)}
              >
                <ListPlus size={16} /> {showSessionQueueList ? '收起题目清单' : '查看题目清单'}
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
      <AnimatePresence>{notice && <Toast text={notice} close={() => setNotice('')} />}</AnimatePresence>
    </div>
  )
}

function LoadingScreen() {
  return <div className="loading-screen"><div className="brand-mark">刷</div><LoaderCircle className="spin" size={22} /><span>正在整理数一题库</span></div>
}

function Sidebar({ view, setView }: { view: View; setView: (v: View) => void }) {
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
        {navItems.map(({ id, label, icon: Icon }) => (
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
      <div className="sidebar-foot" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          className={view === 'settings' ? 'nav-item active' : 'nav-item'}
          style={{ width: '100%', border: 0 }}
          onClick={() => setView('settings')}
          aria-label="打开设置"
        >
          <Settings size={18} strokeWidth={1.8} />
          <span>设置</span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 6px' }}>
          <span className="status-dot" />
          <div>
            <strong>题库已就绪</strong>
            <small>数据仅保存在本机</small>
          </div>
        </div>
      </div>
    </aside>
  )
}

function Topbar({
  view,
  data,
  onRefresh,
  onOpenFormula,
  onOpenGameCenter,
  onOpenContract,
  onOpenBattleReport,
  onToggleZen,
  isZenMode,
  isPureMode,
  onTogglePureMode,
  gamificationStats,
  rewardEvents,
}: {
  view: View
  data: BootstrapData | null
  onRefresh: () => void
  onOpenFormula: () => void
  onOpenGameCenter: () => void
  onOpenContract: () => void
  onOpenBattleReport: () => void
  onToggleZen: () => void
  isZenMode: boolean
  isPureMode: boolean
  onTogglePureMode: () => void
  gamificationStats: ReturnType<typeof computeGamification>
  rewardEvents: RewardEvent[]
}) {
  const current = navItems.find((item) => item.id === view)
  const [now, setNow] = useState(() => Date.now())
  const [timerRunning, setTimerRunning] = useState(false)
  const [elapsedBeforePause, setElapsedBeforePause] = useState(0)
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null)
  const countdown = getExamCountdown()
  const contract = checkContractStatus(
    getDailyContract(data?.dailyProblemTarget, data?.dailyMinuteTarget),
    data?.todayDone ?? 0,
    data?.todayMinutes ?? 0,
    data?.dailyMode
  )
  contract.claimedReward = rewardEvents.some((event) => event.eventId === `contract-${contract.date}`)

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const elapsedMs = elapsedBeforePause + (timerRunning && timerStartedAt !== null ? now - timerStartedAt : 0)
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
  return (
    <header className="topbar">
      <div>
        <h1>{current?.label}</h1>
      </div>
      <div className="topbar-meta">
        <button
          className={`topbar-pure-btn ${isPureMode ? 'active' : ''}`}
          onClick={onTogglePureMode}
          title="切换纯净专注模式 (Alt+P) - 纯净模式下隐藏战力与游戏化反馈，专注纸笔刷题"
          aria-label="切换纯净专注模式"
        >
          <Sparkles size={14} />
          <span>{isPureMode ? '纯净模式' : 'RPG 战力'}</span>
          {isPureMode && <span className="pure-mode-pill">ON</span>}
        </button>
        {!isPureMode && (
          <>
            <button className="topbar-game-btn" onClick={onOpenGameCenter} title="打开考研数一战力与成就中心" aria-label="打开考研数一战力与成就中心">
              <span className="game-badge-icon">{gamificationStats.levelInfo.rankBadge}</span>
              <span className="game-badge-lvl">Lv.{gamificationStats.levelInfo.level}</span>
              <span className="game-badge-title">{gamificationStats.levelInfo.title.split(' · ')[1] || gamificationStats.levelInfo.title}</span>
              <span className="game-badge-exp">{gamificationStats.totalExp} EXP</span>
            </button>
            <button className={`topbar-dday-btn ${contract.isCompleted ? (contract.claimedReward ? 'done' : 'claimable') : ''}`} onClick={onOpenContract} title="查看/签署今日心流作战契约 (Alt+D)" aria-label="查看或签署今日心流作战契约">
              <Target size={14} />
              <span>{countdown.isConfigured ? <>距初试 <strong>{countdown.days}</strong> 天</> : '考研倒计时(未设置)'}</span>
              {contract.isCompleted ? (
                contract.claimedReward ? (
                  <span className="dday-contract-tag done">✓ 契约达成</span>
                ) : (
                  <span className="dday-contract-tag claimable">🎯 +60 EXP</span>
                )
              ) : (
                <span className="dday-contract-tag">契约</span>
              )}
            </button>
            <button className="topbar-report-btn" onClick={onOpenBattleReport} title="生成今日数一修炼简报海报 (Alt+B)" aria-label="生成今日数一修炼简报">
              <ScrollText size={14} />
              <span>战报</span>
              <kbd>Alt+B</kbd>
            </button>
          </>
        )}
        <button className={`topbar-zen-btn ${isZenMode ? 'active' : ''}`} onClick={onToggleZen} title="切换沉浸专注模式 (Alt+Z)" aria-label="切换沉浸专注模式">
          {isZenMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          <span>{isZenMode ? '退出专注' : '专注'}</span>
          <kbd>Alt+Z</kbd>
        </button>
        <button className="topbar-formula-btn" onClick={onOpenFormula} title="考研数学一公式定理速查 (Alt+F)" aria-label="考研数学一公式定理速查">
          <BookMarked size={15} />
          <span>公式速查</span>
          <kbd>Alt+F</kbd>
        </button>
        <div className={timerRunning ? 'focus-timer running' : 'focus-timer'}>
          <Clock3 size={15} />
          <strong>{formatElapsed(elapsedMs)}</strong>
          <button className="timer-control" onClick={toggleTimer} title={timerRunning ? '暂停本次计时' : '开始本次计时'} aria-label={timerRunning ? '暂停本次计时' : '开始本次计时'}>
            {timerRunning ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button className="timer-control" onClick={resetTimer} title="清零本次计时" aria-label="清零本次计时">
            <RotateCcw size={14} />
          </button>
        </div>
        <button className="icon-button" onClick={onRefresh} title="刷新数据" aria-label="刷新数据">
          <RefreshCw size={17} />
        </button>
      </div>
    </header>
  )
}

function formatElapsed(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function TodayView({
  data,
  initialQueue,
  initialIndex,
  attemptMode,
  onQueueChange,
  refresh,
  setView,
  notify,
  onStartVariant,
  onActiveQuestionChange,
  onOpenFormula,
  onStartBlitz,
  onToggleZen,
  isZenMode,
  isPureMode,
  onBlitzFinish,
}: {
  data: BootstrapData
  initialQueue: RecommendedQuestion[] | null
  initialIndex: number
  attemptMode: AttemptMode
  onQueueChange: (q: RecommendedQuestion[]) => void
  refresh: () => void
  setView: (v: View) => void
  notify: (s: string) => void
  onStartVariant: (questionId: number) => void
  onActiveQuestionChange: (q: Question | null) => void
  onOpenFormula: () => void
  onStartBlitz: () => void
  onToggleZen: () => void
  isZenMode: boolean
  isPureMode: boolean
  onBlitzFinish: (res: BlitzExamResult) => void
}) {
  const queue = initialQueue ?? data.recommendations
  const [index, setIndex] = useState(initialIndex)
  const [selected, setSelected] = useState<string[]>([])
  const [revealed, setRevealed] = useState(false)
  const [outcome, setOutcome] = useState<AttemptOutcome | null>(null)
  const [rating, setRating] = useState<number | null>(null)
  const [breakpointTag, setBreakpointTag] = useState<string | null>(null)
  const [repairNote, setRepairNote] = useState<string>('')
  const [repairNoteSaved, setRepairNoteSaved] = useState<boolean>(false)
  const [revealAt, setRevealAt] = useState<number | null>(null)
  const [lastSubmitted, setLastSubmitted] = useState<{ questionId: number; index: number; reasonCode: string } | null>(null)
  const [task, setTask] = useState<CodexTask | null>(null)
  const [batchTask, setBatchTask] = useState<CodexTask | null>(null)
  const [mobileQueueOpen, setMobileQueueOpen] = useState(false)
  const [combo, setCombo] = useState(0)
  const [expToast, setExpToast] = useState<string | null>(null)
  const [blitzCorrect, setBlitzCorrect] = useState(0)
  const [blitzStartTime, setBlitzStartTime] = useState(() => Date.now())
  const blitzTotalRef = useRef(queue.length)
  const submittingRef = useRef(false)
  const undoAppliedRef = useRef(false)

  // Active on-screen timer (caps at 1800 seconds = 30 minutes)
  const activeDurationMsRef = useRef<number>(0)
  const lastActiveTickRef = useRef<number>(Date.now())
  const isTabVisibleRef = useRef<boolean>(typeof document !== 'undefined' ? document.visibilityState === 'visible' : true)

  const resetActiveTimer = useCallback(() => {
    activeDurationMsRef.current = 0
    lastActiveTickRef.current = Date.now()
  }, [])

  useEffect(() => {
    const handleVisibility = () => {
      const visible = document.visibilityState === 'visible'
      if (visible) {
        lastActiveTickRef.current = Date.now()
      } else {
        if (isTabVisibleRef.current) {
          const now = Date.now()
          const delta = Math.max(0, now - lastActiveTickRef.current)
          activeDurationMsRef.current = Math.min(1800000, activeDurationMsRef.current + delta)
        }
      }
      isTabVisibleRef.current = visible
    }

    const intervalId = setInterval(() => {
      if (isTabVisibleRef.current) {
        const now = Date.now()
        const delta = Math.max(0, now - lastActiveTickRef.current)
        lastActiveTickRef.current = now
        activeDurationMsRef.current = Math.min(1800000, activeDurationMsRef.current + delta)
      }
    }, 1000)

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)
    window.addEventListener('blur', handleVisibility)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
      window.removeEventListener('blur', handleVisibility)
    }
  }, [])

  const current = queue[index]?.question
  const currentQuestionId = current?.id
  const activeBatch = data.activeRecommendation
  const isBlitzMode = queue[0]?.reasonCode === 'blitz'

  useEffect(() => {
    onActiveQuestionChange(current ?? null)
  }, [current, onActiveQuestionChange])

  useEffect(() => {
    if (isBlitzMode) {
      blitzTotalRef.current = queue.length
      if (index === 0) {
        setBlitzStartTime(Date.now())
        setBlitzCorrect(0)
      }
    }
  }, [isBlitzMode, queue.length, index])

  useEffect(() => {
    if (undoAppliedRef.current) {
      undoAppliedRef.current = false
    }
    resetActiveTimer()
    setRevealAt(null)
    setSelected([])
    setRevealed(false)
    setOutcome(null)
    setRating(null)
    setBreakpointTag(null)
    setRepairNote('')
    setRepairNoteSaved(false)
    setTask(null)
  }, [currentQuestionId, resetActiveTimer])

  useEffect(() => {
    if (queue && queue.length > 0) {
      void savePracticeSession(queue, index, attemptMode)
    } else {
      void clearPracticeSession()
    }
  }, [queue, index, attemptMode])

  useEffect(() => {
    if (index >= queue.length) setIndex(Math.max(0, queue.length - 1))
  }, [index, queue.length])

  const replaceQueue = (next: RecommendedQuestion[]) => onQueueChange(next)

  const isSelectedMatch = current && current.questionType !== 'subjective' && revealed && selected.length > 0
    ? normalizeAnswer(selected.join('')) === normalizeAnswer(current.correctAnswer)
    : null

  const goalProblemsProgress = data.dailyMode === 'minutes' ? null : Math.min(100, data.todayDone / data.dailyProblemTarget * 100)
  const goalMinutesProgress = data.dailyMode === 'problems' ? null : Math.min(100, data.todayMinutes / data.dailyMinuteTarget * 100)

  const submit = async () => {
    if (!current || rating === null || submittingRef.current) return
    submittingRef.current = true
    try {
      const answer = selected.join('')
      const evidence = determineAttemptEvidence({
        questionType: current.questionType,
        selectedOutcome: outcome,
        selectedAnswerMatches: isSelectedMatch,
      })
      const finalOutcome = evidence.outcome
      const evidenceSource = evidence.evidenceSource
      const correct = finalOutcome === 'correct'
      
      // Auto save repair note if entered
      if (repairNote.trim() && !repairNoteSaved) {
        void saveNote(current.id, repairNote.trim())
      }

      // Flush latest active time slice and cap at 1800s
      if (isTabVisibleRef.current) {
        const now = Date.now()
        const delta = Math.max(0, now - lastActiveTickRef.current)
        activeDurationMsRef.current = Math.min(1800000, activeDurationMsRef.current + delta)
        lastActiveTickRef.current = now
      }
      const rawSeconds = Math.round(activeDurationMsRef.current / 1000)
      const durationSeconds = clampAttemptDuration(rawSeconds)

      await recordAttempt({
        questionId: current.id,
        durationSeconds,
        result: finalOutcome,
        selfRating: rating,
        selectedAnswer: answer,
        mode: attemptMode,
        outcome: finalOutcome,
        evidenceSource,
        fluencyRating: rating,
        confidence: 1.0,
      })
      
      // Update Hall of Fame
      updateHallOfFame({
        fastestChoiceSeconds: current.questionType !== 'subjective' && correct ? durationSeconds : undefined,
        maxComboStreak: correct ? combo + 1 : combo,
        maxDailyProblems: data.todayDone + 1,
        maxDailyMinutes: data.todayMinutes,
      })

      // Calculate gained EXP & Combo
      const isYesterdayWrong = queue[index]?.reasonCode === 'yesterday_wrong'
      let gainedExp = 20
      if (correct) {
        gainedExp += 15
        if (isYesterdayWrong) gainedExp += 15
        if (rating === 3) gainedExp += 10
        if (rating === 4) gainedExp += 20
        if (attemptMode === 'review') gainedExp += 25
        if (!isPureMode) {
          setCombo((c) => {
            const next = c + 1
            if (next >= 3) playLevelUpSound()
            else playCorrectSound()
            return next
          })
          setExpToast(isYesterdayWrong ? `🎯 昨日错题攻坚成功! +${gainedExp} EXP 🔥` : `+${gainedExp} EXP ${combo + 1 >= 2 ? `🔥 ${combo + 1} 连击!` : '🎯 命中!'}`)
        }
      } else {
        if (!isPureMode) {
          setCombo(0)
          setExpToast(`+${gainedExp} EXP`)
        }
      }
      if (!isPureMode) {
        setTimeout(() => setExpToast(null), 2400)
      }

      if (isBlitzMode) {
        const nextCorrect = correct ? blitzCorrect + 1 : blitzCorrect
        setBlitzCorrect(nextCorrect)
        const remainingAfter = queue.filter((item) => item.question.id !== current.id)
        if (remainingAfter.length === 0) {
          const totalSpent = Math.max(10, Math.round((Date.now() - blitzStartTime) / 1000))
          const totalProblems = blitzTotalRef.current || queue.length || 4
          const graded = gradeBlitzExam(totalProblems, nextCorrect, totalSpent, 900)
          onBlitzFinish(graded)
        }
      }

      const isAiBatchItem = queue[index]?.reasonCode === 'codex'
      notify(attemptMode === 'review' ? '复习已记录，复习历史已更新' : isAiBatchItem ? '本题已记录，AI 题组进度已更新' : '本题已记录，已从今日队列移除')
      const remaining = queue.filter((item) => item.question.id !== current.id)
      replaceQueue(remaining)
      if (remaining.length) {
        setIndex(Math.min(index, remaining.length - 1))
      }
      setLastSubmitted({ questionId: current.id, index, reasonCode: queue[index].reasonCode })
      void refresh()
    } finally {
      submittingRef.current = false
    }
  }

  const undo = async () => {
    if (!lastSubmitted) { notify('还没有可以撤销的提交'); return }
    try {
      const restored = await undoLastAttempt(lastSubmitted.questionId)
      const reitem: RecommendedQuestion = { question: restored, score: queue[index]?.score ?? 100, reason: `${reasonLabels[lastSubmitted.reasonCode] ?? '智能推荐'} · 刚才撤销，重新评定`, reasonCode: lastSubmitted.reasonCode }
      const position = Math.min(lastSubmitted.index, queue.length)
      const next = [...queue]
      next.splice(position, 0, reitem)
      replaceQueue(next)
      undoAppliedRef.current = true
      resetActiveTimer()
      setIndex(position)
      setRevealed(true)
      setRating(null)
      setOutcome(null)
      setSelected([])
      setRevealAt(null)
      setLastSubmitted(null)
      notify('已撤销刚才的提交，可以重新评定')
      void refresh()
    } catch (error) {
      notify(`撤销失败：${String(error)}`)
    }
  }

  const skip = async () => {
    if (!queue.length) return
    const skipped = queue[index]
    const rest = queue.filter((item) => item.question.id !== skipped.question.id)
    const next = [...rest, skipped]
    replaceQueue(next)
    resetActiveTimer()
    setSelected([])
    setRating(null)
    setOutcome(null)
    setRevealed(false)
    setRevealAt(null)
    setTask(null)
    notify('已跳过本题，稍后它会回到队列末尾')
  }

  const reveal = () => {
    if (!revealed) {
      setRevealAt(Date.now())
      setRevealed(true)
      if (selected.length > 0 && current && current.questionType !== 'subjective') {
        const match = normalizeAnswer(selected.join('')) === normalizeAnswer(current.correctAnswer)
        setOutcome(match ? 'correct' : 'wrong')
      }
    }
  }
  const chooseRating = (value: number) => {
    if (revealed) {
      setRating(value)
      if (!outcome && current && current.questionType !== 'subjective' && isSelectedMatch !== null) {
        setOutcome(isSelectedMatch ? 'correct' : 'wrong')
      }
    }
  }
  const activateWithKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      action()
    }
  }
  const submitIfReady = () => { if (revealed && rating !== null && current) void submit() }
  const previousQuestion = () => { if (index > 0) setIndex(index - 1) }
  const nextQuestion = () => { if (index < queue.length - 1) setIndex(index + 1) }

  // Use ref to keep latest handlers without rebuilding keydown listener on every render
  const actionsRef = useRef({
    reveal,
    submitIfReady,
    chooseRating,
    previousQuestion,
    nextQuestion,
    revealed,
  })
  useEffect(() => {
    actionsRef.current = {
      reveal,
      submitIfReady,
      chooseRating,
      previousQuestion,
      nextQuestion,
      revealed,
    }
  })

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        if (!actionsRef.current.revealed) actionsRef.current.reveal()
        else actionsRef.current.submitIfReady()
      } else if (event.key >= '1' && event.key <= '4') {
        event.preventDefault()
        actionsRef.current.chooseRating(Number(event.key))
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        actionsRef.current.previousQuestion()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        actionsRef.current.nextQuestion()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const createTask = async () => {
    if (!current) return
    try {
      const created = await createCodexTask(current.id)
      setTask(created)
      await copyPrompt(created)
      notify('已生成并复制 Codex 任务说明；拍下草稿在 Codex 中粘贴即可')
    } catch (error) { notify(`生成 Codex 任务失败：${String(error)}`) }
  }

  const createBatchTask = async () => {
    if (!queue.length) return
    try {
      const created = await createCodexBatchTask(queue.map((item) => item.question.id))
      setBatchTask(created)
      await copyPrompt(created)
      notify(`已生成包含 ${created.questionCount} 道题的整组任务，说明已复制`)
    } catch (error) { notify(`生成整组 Codex 任务失败：${String(error)}`) }
  }

  const copyPrompt = async (targetTask: CodexTask) => {
    await navigator.clipboard.writeText(targetTask.prompt)
    notify('任务说明已复制到剪贴板')
  }

  if (!current) {
    if (isBlitzMode) {
      return (
        <div className="queue-completion-wrap">
          <div className="queue-completion-card">
            <div className="completion-badge blitz"><Zap size={28} /></div>
            <h2>⚡ 15分钟真题闪击战已完成！</h2>
            <p>本轮闪击战作答与成绩已记录完毕。你可以选择再战一组，或返回日常智能推荐。</p>
            <div className="completion-actions">
              <button className="primary-button" onClick={onStartBlitz}><Zap size={16} /> 再来一组闪击战</button>
              <button className="secondary-button" onClick={async () => {
                const next = await getRecommendations(12)
                replaceQueue(next)
                setIndex(0)
              }}><RotateCcw size={16} /> 返回今日智能队列</button>
            </div>
          </div>
        </div>
      )
    }
    if (data.currentChapterName || (data.currentFocusCategoryIds && data.currentFocusCategoryIds.length > 0)) {
      const focusName = data.currentChapterName ? `章节首轮 · ${data.currentChapterName}` : `专项多分支 (${data.currentFocusCategoryIds?.length ?? 0} 个考点)`
      return (
        <div className="queue-completion-wrap">
          <div className="queue-completion-card">
            <div className="completion-badge focus"><Target size={28} /></div>
            <h2>🎯 专项训练已完成！</h2>
            <p>你已完成 <b>{focusName}</b> 队列中的所有考点真题。可以继续加练本考点，或退出专项返回日常队列。</p>
            <div className="completion-actions">
              <button className="primary-button" onClick={async () => {
                void refresh()
                notify('已刷新专项题目')
              }}><RotateCcw size={16} /> 刷新本考点继续加练</button>
              <button className="secondary-button" onClick={async () => {
                await setCurrentChapter(null)
                await setFocusBranches([])
                const next = await getRecommendations(12)
                replaceQueue(next)
                void refresh()
                notify('已退出专项，回到今日智能推荐队列')
              }}>退出专项回到今日推荐</button>
              <button className="secondary-button quiet" onClick={() => setView('library')}>选择其他考点</button>
            </div>
          </div>
        </div>
      )
    }
    if (attemptMode === 'review') {
      return (
        <div className="queue-completion-wrap">
          <div className="queue-completion-card">
            <div className="completion-badge review"><TimerReset size={28} /></div>
            <h2>✨ 今日错题复习全部通过！</h2>
            <p>
              你已经攻克了今天所有的到期错题，复习间隔已自动后延。
            </p>
            <div className="completion-actions">
              <button className="primary-button" onClick={() => {
                onQueueChange(data.recommendations)
                setIndex(0)
                setView('today')
              }}><Zap size={16} /> 开始今日智能练习</button>
              <button className="secondary-button" onClick={() => setView('library')}><BookOpen size={16} /> 浏览全部题库</button>
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="queue-completion-wrap">
        <div className="queue-completion-card">
          <div className="completion-badge normal"><Check size={28} /></div>
          <h2>🎉 今日推荐队列已完成！</h2>
          <p>
            今日已完成 <strong>{data.todayDone}</strong> 题 {data.dailyProblemTarget > 0 && `(目标 ${data.dailyProblemTarget} 题)`} · 累计 <strong>{data.todayMinutes}</strong> 分钟
          </p>
          <div className="completion-actions">
            <button className="primary-button" onClick={async () => {
              const next = await getRecommendations(12)
              replaceQueue(next)
              setIndex(0)
              notify('已载入新一组智能推荐题目')
            }}><Sparkles size={16} /> 继续加练一组 (12 题)</button>
            <button className="secondary-button" onClick={() => setView('review')}><History size={16} /> 查看今日作答回顾</button>
            <button className="secondary-button quiet" onClick={() => setView('library')}><FolderSearch size={16} /> 题库自由选题</button>
          </div>
        </div>
      </div>
    )
  }

  return <div className="today-layout">
    <section className="queue-panel">
      <div className="progress-head"><span>今日进度</span><strong>{data.dailyMode === 'minutes' ? `${data.todayMinutes}/${data.dailyMinuteTarget} 分钟` : data.dailyMode === 'both' ? `${data.todayDone}/${data.dailyProblemTarget} 题 · ${data.todayMinutes}/${data.dailyMinuteTarget} 分` : `${data.todayDone}/${data.dailyProblemTarget} 题`}</strong></div>
      <div className="progress-track"><motion.div animate={{ width: `${goalProblemsProgress ?? goalMinutesProgress ?? 0}%` }} /></div>
      {data.dailyMode === 'both' && <div className="progress-track secondary"><motion.div animate={{ width: `${goalMinutesProgress ?? 0}%` }} /></div>}
      {data.dailyMode === 'both' && <div className="progress-caption dual"><span><i /> {Math.round(goalProblemsProgress ?? 0)}% 题数</span><span><i /> {Math.round(goalMinutesProgress ?? 0)}% 分钟</span></div>}
      {data.todayDone > 0 && <button className="today-done-pill" onClick={() => setView('review')} title="查看今日已做题目的卡片与 Codex 点评"><History size={13} /><span>今日已做 <b>{data.todayDone}</b> 题（查看回顾）</span></button>}
      <div className="queue-quick-actions">
        <button className="blitz-mode-start-btn" onClick={onStartBlitz} title="开启 15 分钟 4 道真题高压模拟考">
          <Zap size={14} /> 15分钟真题闪击战
        </button>
        <button className={`zen-toggle-mini-btn ${isZenMode ? 'active' : ''}`} onClick={onToggleZen} title="切换沉浸专注模式 (Alt+Z)">
          {isZenMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          <span>{isZenMode ? '退出专注' : '专注模式'}</span>
        </button>
      </div>
      {activeBatch ? <div className="ai-plan-banner"><Sparkles size={15} /><span><b>{activeBatch.title}</b><small>AI 题组 · 剩余 {activeBatch.remainingCount}/{activeBatch.totalCount} 题</small></span></div> : (data.currentFocusCategoryIds && data.currentFocusCategoryIds.length > 0) ? <div className="chapter-mode"><Target size={15} /><span><b>专项多分支训练</b><small>已选 {data.currentFocusCategoryIds.length} 个考点</small></span></div> : data.currentChapterName ? <div className="chapter-mode"><Target size={15} /><span><b>{data.currentChapterName}</b><small>章节首轮</small></span></div> : null}
      <div className="queue-title"><span>{attemptMode === 'review' ? '错题复习队列' : activeBatch ? 'AI 推荐题组' : (data.currentFocusCategoryIds && data.currentFocusCategoryIds.length > 0) ? '专项训练队列' : data.currentChapterName ? '本章队列' : '智能队列'}</span><small>{queue.length} 题</small></div>
      <div className="queue-list">
        {queue.map((item, i) => <button key={item.question.id} className={i === index ? 'queue-item active' : 'queue-item'} onClick={() => setIndex(i)}>
          <span className="queue-number">{String(i + 1).padStart(2, '0')}</span><span><b>{item.question.categoryPath.split(' / ').slice(-2).join(' · ')}</b><small>{reasonLabels[item.reasonCode] ?? '智能推荐'}</small></span><ChevronRight size={15} />
        </button>)}
      </div>
      <button className="quiet-command" onClick={() => setView('library')}><FolderSearch size={16} /> 手动找题</button>
      {attemptMode !== 'review' && <><button className="quiet-command" onClick={createBatchTask}><Layers size={16} /> 让 Codex 一次性批改整组草稿（{queue.length} 道）</button>
      {batchTask && <div className="codex-task"><div><span>整组任务已生成</span><strong>{batchTask.taskId}</strong><b>{batchTask.questionCount} 道题</b></div><p>按题目顺序拍下全部草稿，在 Codex 中发送图片和这段任务说明；草稿张数少于题目数时，Codex 只批改上传的部分。结果会自动进入 AI 批改。</p><button onClick={() => copyPrompt(batchTask)}><Send size={15} /> 复制任务说明</button></div>}</>}
    </section>

    <section className="question-workspace">
      <div className="question-meta">
        <button className="mobile-queue-trigger" onClick={() => setMobileQueueOpen(true)} aria-label="打开当前训练队列">
          <Layers size={15} /> 队列 {queue.length}
        </button>
        <span className={`reason-chip ${queue[index].reasonCode}`}>{reasonLabels[queue[index].reasonCode] ?? '智能推荐'}</span>
        <span>{current.source}</span>
        <span>难度 {'●'.repeat(current.difficulty)}{'○'.repeat(Math.max(0, 3-current.difficulty))}</span>
        {combo >= 2 && !isPureMode && (
          <span className="today-combo-chip">
            <Flame size={13} /> {combo} 连胜!
          </span>
        )}
        {expToast && !isPureMode && (
          <span className="today-floating-exp">
            {expToast}
          </span>
        )}
        <button
          className={current.favorite ? 'favorite active' : 'favorite'}
          title="收藏"
          aria-label={current.favorite ? '取消收藏' : '收藏本题'}
          onClick={async () => {
            const nextFav = await toggleFavorite(current.id)
            const updated = queue.map((item, i) =>
              i === index ? { ...item, question: { ...item.question, favorite: nextFav } } : item
            )
            replaceQueue(updated)
          }}
        >
          <Heart size={18} fill={current.favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <AnimatePresence>
        {mobileQueueOpen && (
          <motion.div className="mobile-practice-queue-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileQueueOpen(false)}>
            <motion.aside className="mobile-practice-queue" initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} onClick={(event) => event.stopPropagation()} aria-label="当前训练队列">
              <header>
                <div><strong>当前训练队列</strong><span>{queue.length} 道待完成</span></div>
                <button className="icon-button" onClick={() => setMobileQueueOpen(false)} aria-label="关闭当前训练队列"><X size={18} /></button>
              </header>
              <div className="mobile-practice-queue-list">
                {queue.map((item, itemIndex) => (
                  <button key={item.question.id} className={itemIndex === index ? 'active' : ''} onClick={() => { setIndex(itemIndex); setMobileQueueOpen(false) }}>
                    <span>{String(itemIndex + 1).padStart(2, '0')}</span>
                    <div><b>{item.question.categoryPath.split(' / ').slice(-2).join(' · ')}</b><small>#{item.question.id} · {reasonLabels[item.reasonCode] ?? item.reason}</small></div>
                    <ChevronRight size={15} />
                  </button>
                ))}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="recommend-reason"><Sparkles size={15} /> {queue[index].reason}</div>
      <article className="question-content">
        <div className="question-index">第 {index + 1} 题 <span>#{current.id}</span></div>
        <MathText value={current.stem} className="question-stem" />
        {current.imagePaths.length > 0 && <QuestionImages paths={current.imagePaths} />}
        {current.options.length > 0 ? <div className="options-list">{current.options.map((option) => {
          const correctOption = revealed && current.questionType !== 'subjective' ? normalizeAnswer(current.correctAnswer).includes(normalizeAnswer(option.label)) : false
          const wronglyPicked = revealed && current.questionType !== 'subjective' ? selected.includes(option.label) && !correctOption : false
          const className = `option${selected.includes(option.label) ? ' selected' : ''}${revealed && current.questionType !== 'subjective' && correctOption ? ' correct' : ''}${revealed && wronglyPicked ? ' wrong' : ''}`
          return <button key={option.id} className={className} onClick={() => setSelected(current.questionType === 'multiple_choice' ? (selected.includes(option.label) ? selected.filter(x => x !== option.label) : [...selected, option.label].sort()) : [option.label])}><span>{option.label}</span><MathText value={option.contentMd} /></button>
        })}</div> : current.questionType !== 'subjective' && <div className="missing-options">这道选择题的选项未能读取，请在题库中打开题号 #{current.id} 后反馈。</div>}
        {isSelectedMatch !== null && (
          <div className={isSelectedMatch ? 'judgement correct' : 'judgement wrong'}>
            {isSelectedMatch ? <><Check size={15} /> 屏幕选择与参考答案一致</> : <><X size={15} /> 屏幕选择与参考答案不一致，正确答案已在下方标绿</>}
          </div>
        )}
      </article>
      <div className="question-footer"><span><Clock3 size={15} /> 在纸上完成后，再查看答案和自评</span><div className="footer-actions"><button className="secondary-button quiet" onClick={onOpenFormula} title="查看当前题目考点公式 (Alt+F)"><BookMarked size={14} /> 本题公式速查</button><button className="secondary-button quiet" onClick={skip} title="把本题移到队列末尾，稍后再做"><SkipForward size={15} /> 跳过这题</button>{!revealed && <button className="secondary-button" onClick={() => { setRevealed(true); if (revealAt === null) setRevealAt(Date.now()) }}>查看答案 <kbd>␣</kbd></button>}</div></div>
    <section className="answer-panel answer-panel-inline">
      <div className="answer-head"><div><span>作答与分析</span><small>纸笔优先 · 独立判定与自评</small></div><span className="autosave"><span /> 自动保存</span></div>
      {!revealed ? <div className="paper-mode">
        <div className="paper-illustration"><div className="paper-lines" /><Check size={28} /></div>
        <h3>先在纸上完整作答</h3><p>保留你的真实推理过程，完成后再对答案。需要深挖时，把草稿交给 Codex。</p>
        <button className="primary-button" onClick={reveal}><Check size={17} /> 我已完成（空格）</button>
        <button className="secondary-button full" onClick={createTask}><BrainCircuit size={17} /> 请 Codex 批改草稿</button>
        {task && <div className="codex-task"><div><span>任务已生成</span><strong>{task.taskId}</strong></div><p>手机拍下草稿，在 Codex 中发送图片和这段任务说明。结果会自动进入 AI 批改。</p><button onClick={() => copyPrompt(task)}><Send size={15} /> 复制任务说明</button></div>}
      </div> : <div className="review-mode">
        <div className="answer-block"><span>参考答案</span><MathText value={current.correctAnswer} /></div>
        <div className="explanation-block"><span>解析</span><MathText value={current.explanation} /></div>

        {/* 1. Outcome Selector (做对/部分/做错/不确定 独立判定) */}
        <div className="outcome-block">
          <span>1. 实际判定结果：</span>
          <div className="outcome-grid">
            <button
              type="button"
              className={`outcome-btn ${outcome === 'correct' ? 'active correct' : ''}`}
              onClick={() => setOutcome('correct')}
              onKeyDown={(event) => activateWithKeyboard(event, () => setOutcome('correct'))}
            >
              <Check size={14} /> 做对
            </button>
            <button
              type="button"
              className={`outcome-btn ${outcome === 'partial' ? 'active partial' : ''}`}
              onClick={() => setOutcome('partial')}
              onKeyDown={(event) => activateWithKeyboard(event, () => setOutcome('partial'))}
            >
              <Minus size={14} /> 部分正确
            </button>
            <button
              type="button"
              className={`outcome-btn ${outcome === 'wrong' ? 'active wrong' : ''}`}
              onClick={() => setOutcome('wrong')}
              onKeyDown={(event) => activateWithKeyboard(event, () => setOutcome('wrong'))}
            >
              <X size={14} /> 做错
            </button>
            <button
              type="button"
              className={`outcome-btn ${outcome === 'uncertain' ? 'active uncertain' : ''}`}
              onClick={() => setOutcome('uncertain')}
              onKeyDown={(event) => activateWithKeyboard(event, () => setOutcome('uncertain'))}
            >
              <HelpCircle size={14} /> 无法判断
            </button>
          </div>
        </div>

        {/* 2. Fluency Rating */}
        <div className="rating-block">
          <span>2. 解题流畅度自评：<i>按 1-4 键快速选择</i></span>
          <div className="rating-grid">
            {ratingOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                className={rating === item.value ? 'rating active' : 'rating'}
                onClick={() => chooseRating(item.value)}
              >
                <b>{item.label}</b>
                <small>{item.hint}</small>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Minimal Actionable Repair Card (错题/部分/自评<=2 时呈现) */}
        {(outcome === 'wrong' || outcome === 'partial' || (rating !== null && rating <= 2)) && (
          <div className="minimal-repair-card">
            <div className="repair-header">
              <div className="repair-title">
                <Sparkles size={16} /> 💡 最小修复与断点归因
              </div>
              <span className="repair-badge">错题深度攻坚</span>
            </div>

            <span className="repair-section-label">最早断点归因（点击标记）：</span>
            <div className="breakpoint-chips">
              {BREAKPOINTS.map((bp) => (
                <button
                  key={bp.id}
                  type="button"
                  className={`breakpoint-chip ${breakpointTag === bp.label ? 'active' : ''}`}
                  onClick={() => setBreakpointTag(breakpointTag === bp.label ? null : bp.label)}
                  title={bp.desc}
                >
                  {bp.label}
                </button>
              ))}
            </div>

            <span className="repair-section-label">核心心得 / 关键恒等式提炼（保存至题目笔记）：</span>
            <div className="repair-note-box">
              <input
                type="text"
                className="repair-note-input"
                placeholder="1句话记录我为什么错 / 下次做题警示…"
                value={repairNote}
                onChange={(e) => {
                  setRepairNote(e.target.value)
                  setRepairNoteSaved(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (repairNote.trim()) {
                      void saveNote(current.id, repairNote.trim()).then(() => setRepairNoteSaved(true))
                    }
                  }
                }}
              />
              <button
                type="button"
                className="repair-save-btn"
                onClick={() => {
                  if (repairNote.trim()) {
                    void saveNote(current.id, repairNote.trim()).then(() => setRepairNoteSaved(true))
                  }
                }}
              >
                {repairNoteSaved ? '✓ 已保存' : '保存心得'}
              </button>
            </div>

            <div className="repair-actions-row">
              <button
                type="button"
                className="variant-attack-btn"
                onClick={() => onStartVariant(current.id)}
                title="调出该考点的 3 道同类变式题立即加练"
              >
                <Sparkles size={14} /> 🚀 立即攻坚 3 道同类变式题
              </button>
              <span className="repair-schedule-hint">
                <TimerReset size={13} /> {rating === 1 ? '已排入明日复习' : '已排入 3 天后复习'}
              </span>
            </div>
          </div>
        )}

        <div className="review-actions">
          <button className="primary-button" disabled={rating === null} onClick={submit} onKeyDown={(event) => activateWithKeyboard(event, () => { void submit() })}>记录并继续 <ChevronRight size={17} /><kbd>↵</kbd></button>
          <button className="variant-practice-btn prominent" onClick={() => onStartVariant(current.id)} title="调出此题同考点的 3 道变式题"><Sparkles size={14} /> 攻坚 3 道同类变式题</button>
          <button className="secondary-button quiet" onClick={undo} title="撤销刚才的提交，重新评定"><RotateCcw size={15} /> 撤销上次提交</button>
        </div>
        <button className="text-button prominent-draft-btn" onClick={createTask} title="一键生成并复制本题 Codex 批改任务"><BrainCircuit size={16} /> 拍照让 Codex 深度批改草稿</button>
        {task && <button className="copy-task" onClick={() => copyPrompt(task)}><Send size={15} /> 复制 {task.taskId} 任务说明</button>}
      </div>}
    </section>
    </section>
  </div>
}

function normalizeAnswer(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, '').split('').sort().join('')
}

function QuestionImages({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([])
  useEffect(() => { void Promise.all(paths.map(imageDataUrl)).then(setUrls) }, [paths])
  return <div className="question-images">{urls.map((url, i) => <img key={paths[i]} src={url} alt={`题目附图 ${i + 1}`} />)}</div>
}

function LibraryView({
  data,
  initialStatus,
  queueCount,
  refresh,
  notify,
  onPractice,
  onPracticeFocus,
}: {
  data: BootstrapData
  initialStatus: string
  queueCount: number
  refresh: () => void
  notify: (text: string) => void
  onPractice: (questions: Question[], reason: string) => void
  onPracticeFocus?: (queue?: RecommendedQuestion[]) => void
}) {
  const [tab, setTab] = useState<'browse' | 'focus'>('browse')
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [status, setStatus] = useState(initialStatus)
  const [scope, setScope] = useState('complete')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set([223]))
  const [result, setResult] = useState<QuestionPage>({ items: [], total: 0, page: 1, pageSize: 50, pageCount: 0 })
  const [busy, setBusy] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [queueOpen, setQueueOpen] = useState(false)
  const [customQueue, setCustomQueue] = useState<Question[]>([])

  useEffect(() => { void getCategories().then(setCategories) }, [])
  useEffect(() => { setStatus(initialStatus) }, [initialStatus])
  useEffect(() => { setPage(1) }, [query, categoryId, status, scope, pageSize])
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusy(true)
      void searchQuestionPage({ query, categoryId, status, scope, page, pageSize }).then(setResult).finally(() => setBusy(false))
    }, 160)
    return () => clearTimeout(timer)
  }, [query, categoryId, status, scope, page, pageSize])

  const children = (parentId: number | null) => categories.filter((item) => item.parentId === parentId)
  const renderNode = (node: CategoryNode) => {
    const nested = children(node.id)
    const isOpen = expanded.has(node.id)
    return <div className="category-branch" key={node.id}>
      <div className={categoryId === node.id ? 'category-row active' : 'category-row'} style={{ paddingLeft: `${10 + node.depth * 13}px` }}>
        <button className="tree-toggle" disabled={nested.length === 0} title={isOpen ? '收起' : '展开'} onClick={() => setExpanded((old) => { const next = new Set(old); if (isOpen) next.delete(node.id); else next.add(node.id); return next })}>{nested.length > 0 ? (isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>) : <span />}</button>
        <button className="category-select" onClick={() => setCategoryId(node.id)}><span>{node.name}</span><b>{node.questionCount}</b></button>
      </div>
      {isOpen && nested.map(renderNode)}
    </div>
  }

  const currentCategory = categories.find((item) => item.id === categoryId)
  const openQueue = async () => { setCustomQueue(await getCustomQueue()); setQueueOpen(true) }
  const addQuestion = async (question: Question) => { const count = await addToCustomQueue(question.id); notify(count === queueCount ? '这道题已经在队列里' : '已加入自定义训练队列'); await refresh() }
  const removeQuestion = async (questionId: number) => { await removeFromCustomQueue(questionId); setCustomQueue(await getCustomQueue()); await refresh() }
  const clearQueue = async () => { await clearCustomQueue(); setCustomQueue([]); await refresh(); notify('自定义队列已清空') }

  return (
    <div className="library-view">
      <div className="library-toolbar">
        <div className="segmented" style={{ marginRight: '8px' }}>
          <button className={tab === 'browse' ? 'active' : ''} onClick={() => setTab('browse')}>
            题库检索
          </button>
          <button className={tab === 'focus' ? 'active' : ''} onClick={() => setTab('focus')}>
            专项多考点攻坚
          </button>
        </div>
        {tab === 'browse' && (
          <>
            <div className="search-box"><Search size={18}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索题干、来源、年份或题号"/></div>
            <div className="segmented scope-tabs">{[['complete','完整'],['core','核心'],['truth','真题']].map(([value,label]) => <button key={value} className={scope === value ? 'active' : ''} onClick={() => setScope(value)}>{label}</button>)}</div>
            <div className="segmented">{[['all','全部'],['unseen','未做'],['wrong','错题'],['favorite','收藏'],['noted','有笔记']].map(([value,label]) => <button key={value} className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>{label}</button>)}</div>
            <button className="queue-button" onClick={openQueue}><ListPlus size={17}/><span>训练队列</span><b>{queueCount}</b></button>
          </>
        )}
      </div>

      {tab === 'focus' ? (
        <FocusView data={data} refresh={refresh} onStart={onPracticeFocus ?? (() => {})} notify={notify} />
      ) : (
        <div className="library-layout">
          <aside className="category-panel">
            <div className="category-head"><div><b>题目分类</b><span>大观园完整目录</span></div><button className={categoryId === null ? 'active' : ''} onClick={() => setCategoryId(null)}>全部</button></div>
            <div className="category-tree">{children(null).map(renderNode)}</div>
          </aside>
          <section className="library-results">
            <div className="library-summary"><div><b>{currentCategory?.name ?? '全部题目'}</b><span>{busy ? '正在筛选' : `共 ${result.total.toLocaleString()} 道`}</span></div><label>每页<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{[50,100,200].map((size) => <option key={size}>{size}</option>)}</select></label></div>
            <div className="question-table"><div className="table-head"><span>题目</span><span>分类</span><span>状态</span><span/></div>{result.items.map((question) => <div className="table-row" key={question.id}><button className="question-row-main" onClick={() => setSelectedQuestion(question)}><b>#{question.id}</b><MathText value={question.stem}/><small>{question.source}</small></button><span>{question.categoryPath.split(' / ').slice(-2).join(' / ')}</span><span className="state-cell">{question.attempts === 0 ? '未做' : question.accuracy === 1 ? '已掌握' : '需复习'}</span><button className="row-add" title="加入训练队列" onClick={() => addQuestion(question)}><ListPlus size={17}/></button></div>)}</div>
            {!busy && result.items.length === 0 && <EmptyState icon={Search} title="没有匹配的题目" text="换一个分类或清除筛选条件。"/>}
            <Pagination page={result.page} pageCount={result.pageCount} onChange={setPage}/>
          </section>
        </div>
      )}
      <AnimatePresence>{selectedQuestion && <QuestionDetail question={selectedQuestion} close={() => setSelectedQuestion(null)} add={() => addQuestion(selectedQuestion)} practice={() => onPractice([selectedQuestion], '从题库选择的单题训练')} onChange={(updated) => setSelectedQuestion(updated)} />}</AnimatePresence>
      <AnimatePresence>{queueOpen && <QueueDrawer questions={customQueue} close={() => setQueueOpen(false)} remove={removeQuestion} clear={clearQueue} start={() => { if (customQueue.length) { setQueueOpen(false); onPractice(customQueue, '自定义训练队列') } }} />}</AnimatePresence>
    </div>
  )
}

function QuestionDetail({ question, close, add, practice, onChange }: { question: Question; close: () => void; add: () => void; practice: () => void; onChange?: (question: Question) => void }) {
  const [revealAnswer, setRevealAnswer] = useState(false)
  const [note, setNote] = useState(question.note ?? '')
  const saveNoteNow = async () => { await saveNote(question.id, note.trim()); onChange?.({ ...question, note: note.trim() }); }
  return <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={close}><motion.section className="question-detail" initial={{opacity:0,y:16,scale:.985}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:10}} onClick={(event) => event.stopPropagation()}><header><div><span>题目 #{question.id}</span><h2>{question.categoryPath.split(' / ').slice(-2).join(' / ')}</h2></div><button className="icon-button" title="关闭" onClick={close}><X size={18}/></button></header><div className="detail-meta"><span>{question.source}</span><span>难度 {'●'.repeat(question.difficulty)}{'○'.repeat(Math.max(0,3-question.difficulty))}</span><span>{question.attempts ? `${question.attempts} 次作答` : '尚未作答'}</span></div><article><MathText className="question-stem" value={question.stem}/>{question.imagePaths.length > 0 && <QuestionImages paths={question.imagePaths}/>} {question.options.length > 0 && <div className="detail-options">{question.options.map((option) => <div key={option.id} className={revealAnswer && question.questionType !== 'subjective' && normalizeAnswer(question.correctAnswer).includes(option.label) ? 'detail-option correct' : ''}><b>{option.label}</b><MathText value={option.contentMd}/></div>)}</div>}
      {revealAnswer && <><div className="detail-answer"><span>参考答案</span><MathText value={question.correctAnswer}/></div><div className="detail-explanation"><span>解析</span><MathText value={question.explanation}/></div></>}
      <div className="detail-note">
        <div className="detail-note-head"><span>我的批注</span><button className="text-button compact" onClick={saveNoteNow}><Check size={14}/> 保存批注</button></div>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="记录这道题的踩坑点、关键步骤或值得回看的线索…（保存在本机）" />
      </div>
    </article><footer><button className="secondary-button" onClick={() => setRevealAnswer((flag) => !flag)}><BookOpen size={17}/> {revealAnswer ? '隐藏答案解析' : '显示答案解析'}</button><button className="secondary-button" onClick={add}><ListPlus size={17}/> 加入队列</button><button className="primary-button" onClick={practice}><Play size={17}/> 练习此题</button></footer></motion.section></motion.div>
}

function QueueDrawer({ questions, close, remove, clear, start }: { questions: Question[]; close: () => void; remove: (id: number) => void; clear: () => void; start: () => void }) {
  return <motion.div className="drawer-backdrop" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={close}><motion.aside className="queue-drawer" initial={{x:420}} animate={{x:0}} exit={{x:420}} transition={{type:'spring',damping:30,stiffness:320}} onClick={(event) => event.stopPropagation()}><header><div><h2>自定义训练队列</h2><span>{questions.length} 道题 · 按加入顺序练习</span></div><button className="icon-button" title="关闭" onClick={close}><X size={18}/></button></header><div className="drawer-list">{questions.map((question,index) => <div className="drawer-item" key={question.id}><span>{String(index+1).padStart(2,'0')}</span><div><b>{question.categoryPath.split(' / ').slice(-2).join(' / ')}</b><MathText value={question.stem}/><small>#{question.id} · {question.source}</small></div><button title="移出队列" onClick={() => remove(question.id)}><Trash2 size={16}/></button></div>)}{questions.length === 0 && <EmptyState icon={ListPlus} title="队列还是空的" text="从题库加入今天想练的题。"/>}</div><footer><button className="text-button danger" disabled={!questions.length} onClick={clear}><Trash2 size={16}/> 清空</button><button className="primary-button" disabled={!questions.length} onClick={start}><Play size={17}/> 开始训练</button></footer></motion.aside></motion.div>
}

function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  if (pageCount <= 1) return null
  const pages = Array.from(new Set([1, page - 1, page, page + 1, pageCount].filter((value) => value >= 1 && value <= pageCount))).sort((a,b) => a-b)
  return <div className="pagination"><button title="上一页" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={16}/></button>{pages.map((value,index) => <span key={value}>{index > 0 && value - pages[index - 1] > 1 && <i>...</i>}<button className={value === page ? 'active' : ''} onClick={() => onChange(value)}>{value}</button></span>)}<button title="下一页" disabled={page >= pageCount} onClick={() => onChange(page + 1)}><ChevronRight size={16}/></button></div>
}

type SectionWithChildren = {
  section: MasteryNode
  children: MasteryNode[]
}

function FocusView({ data, refresh, onStart, notify }: { data: BootstrapData; refresh: () => void; onStart: (queue?: RecommendedQuestion[]) => void; notify: (text: string) => void }) {
  const [chapters, setChapters] = useState<MasteryChapter[]>([])
  const [nodes, setNodes] = useState<MasteryNode[]>([])
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(data.currentFocusCategoryIds ?? []))
  const [limit, setLimit] = useState(15)
  const [loading, setLoading] = useState(false)

  // Load once on mount
  useEffect(() => {
    void Promise.all([getMasteryMap(), getMasteryNodes()]).then(([c, n]) => {
      setChapters(c)
      setNodes(n)
    })
  }, [])

  // Sync initial focus category IDs if they change from external bootstrap
  useEffect(() => {
    if (data.currentFocusCategoryIds && data.currentFocusCategoryIds.length > 0) {
      setSelectedIds(new Set(data.currentFocusCategoryIds))
    }
  }, [data.currentFocusCategoryIds])

  // Build high-performance lookup tree: Chapter -> Sections -> Sub-branches
  const chapterTree = useMemo(() => {
    const tree = new Map<number, SectionWithChildren[]>()
    const nodesByChapter = new Map<number, MasteryNode[]>()
    for (const node of nodes) {
      const list = nodesByChapter.get(node.chapterId) ?? []
      list.push(node)
      nodesByChapter.set(node.chapterId, list)
    }

    for (const chapter of chapters) {
      const chNodes = nodesByChapter.get(chapter.id) ?? []
      const depth2Nodes = chNodes.filter((n) => n.depth === 2)
      const secList: SectionWithChildren[] = []

      if (depth2Nodes.length > 0) {
        for (const sec of depth2Nodes) {
          const children = chNodes.filter((n) => n.parentId === sec.id && n.depth === 3)
          secList.push({ section: sec, children })
        }
      } else {
        const depth3Nodes = chNodes.filter((n) => n.depth >= 2)
        for (const leaf of depth3Nodes) {
          secList.push({ section: leaf, children: [] })
        }
      }
      tree.set(chapter.id, secList)
    }
    return tree
  }, [chapters, nodes])

  const bySubject = useMemo(() => {
    const map = new Map<string, MasteryChapter[]>()
    for (const chapter of chapters) {
      const subject = chapter.rootName || '其他'
      map.set(subject, [...(map.get(subject) ?? []), chapter])
    }
    return map
  }, [chapters])

  const orderedSubjects = useMemo(() => {
    const subjectOrder = ['高等数学', '线性代数', '概率统计']
    return [...bySubject.keys()].sort((a, b) => {
      const ia = subjectOrder.indexOf(a); const ib = subjectOrder.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
  }, [bySubject])

  const toggleExpand = (chapterId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedChapters((prev) => {
      const next = new Set(prev)
      if (next.has(chapterId)) next.delete(chapterId)
      else next.add(chapterId)
      return next
    })
  }

  const toggleNode = (nodeId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const toggleSection = (sec: SectionWithChildren, e: React.MouseEvent) => {
    e.stopPropagation()
    const targetIds = sec.children.length > 0 ? sec.children.map((c) => c.id) : [sec.section.id]
    const isAllSelected = targetIds.every((id) => selectedIds.has(id))

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (isAllSelected) {
        targetIds.forEach((id) => next.delete(id))
        next.delete(sec.section.id)
      } else {
        targetIds.forEach((id) => next.add(id))
        next.add(sec.section.id)
      }
      return next
    })
  }

  const toggleChapterAll = (chapterId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const sections = chapterTree.get(chapterId) ?? []
    const allIds: number[] = []
    for (const sec of sections) {
      if (sec.children.length > 0) {
        sec.children.forEach((c) => allIds.push(c.id))
      }
      allIds.push(sec.section.id)
    }
    const isAllSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (isAllSelected) {
        allIds.forEach((id) => next.delete(id))
        next.delete(chapterId)
      } else {
        allIds.forEach((id) => next.add(id))
        next.add(chapterId)
      }
      return next
    })
  }

  const chooseWholeChapter = async (chapter: MasteryChapter) => {
    try {
      await setCurrentChapter(chapter.id)
      await refresh()
      notify(`已进入「${chapter.name}」首轮`)
      onStart()
    } catch (err) {
      notify(`无法进入章节：${String(err)}`)
    }
  }

  const startMultiBranchPractice = async (selectedLimit = limit) => {
    const ids = Array.from(selectedIds)
    if (!ids.length) {
      notify('请先至少勾选一个子分支考点')
      return
    }
    setLoading(true)
    try {
      await setFocusBranches(ids)
      const queue = await getFocusQueue(ids, selectedLimit)
      if (!queue.length) {
        notify('所选子分支今天已全部做完，请选择其他考点或调整题数')
        return
      }
      await refresh()
      notify(`已进入专项多分支训练，共 ${queue.length} 道题`)
      onStart(queue)
    } catch (err) {
      notify(`开始专项训练失败：${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const clearAllFocus = async () => {
    setSelectedIds(new Set())
    await setFocusBranches([])
    await setCurrentChapter(null)
    await refresh()
    notify('已退出专项训练，恢复全库推荐')
  }

  // Aggregate selected stats using useMemo
  const stats = useMemo(() => {
    const selectedNodes = nodes.filter((n) => selectedIds.has(n.id))
    const totalQuestions = selectedNodes.reduce((sum, n) => sum + n.total, 0)
    const unattemptedQuestions = selectedNodes.reduce((sum, n) => sum + Math.max(0, n.total - n.attempted), 0)
    const weakQuestions = selectedNodes.reduce((sum, n) => sum + n.weakCount, 0)
    const dueQuestions = selectedNodes.reduce((sum, n) => sum + n.dueCount, 0)
    return { totalQuestions, unattemptedQuestions, weakQuestions, dueQuestions }
  }, [selectedIds, nodes])

  const activeFocusCount = data.currentFocusCategoryIds?.length ?? 0

  return (
    <div className="focus-view">
      <div className="section-intro">
        <span>数一 · 专项攻坚</span>
        <h2>逐级展开子考点与多分支组合训练</h2>
        <p>按大章节展开「考点大类」与「细分子分支」（如反函数求导、高阶导、切法线、渐近线等），自由勾选组合，定向突破。</p>
      </div>

      {(data.currentChapterName || activeFocusCount > 0) && (
        <div className="active-chapter-bar">
          <Target size={20} />
          <div>
            <span>当前活跃专项</span>
            <b>{data.currentChapterName ? `章节首轮 · ${data.currentChapterName}` : `多子分支专项 · 已选 ${activeFocusCount} 个考点`}</b>
          </div>
          <button className="primary-button compact" onClick={() => onStart()}>
            <Zap size={16} /> 继续训练
          </button>
          <button className="secondary-button compact" onClick={clearAllFocus}>
            退出专项
          </button>
        </div>
      )}

      {orderedSubjects.map((subject) => (
        <div key={subject} className="focus-subject">
          <div className="focus-subject-title">{subject}</div>
          <div className="chapter-list">
            {bySubject.get(subject)!.map((chapter, index) => {
              const sections = chapterTree.get(chapter.id) ?? []
              const isExpanded = expandedChapters.has(chapter.id)
              const isChapterActive = data.currentChapterId === chapter.id

              // Count total selectable subbranches in chapter
              const allChapterSubIds: number[] = []
              for (const sec of sections) {
                if (sec.children.length > 0) {
                  sec.children.forEach((c) => allChapterSubIds.push(c.id))
                } else {
                  allChapterSubIds.push(sec.section.id)
                }
              }
              const chapterSelectedCount = allChapterSubIds.filter((id) => selectedIds.has(id)).length
              const isAllChapterSelected = allChapterSubIds.length > 0 && chapterSelectedCount === allChapterSubIds.length

              return (
                <div key={chapter.id} className="focus-chapter-block">
                  <div className={isChapterActive ? 'chapter-row current' : 'chapter-row'}>
                    <button
                      type="button"
                      className={`focus-checkbox ${isAllChapterSelected ? 'checked' : chapterSelectedCount > 0 ? 'indeterminate' : ''}`}
                      onClick={(e) => toggleChapterAll(chapter.id, e)}
                      title="勾选/取消勾选该章节全部考点"
                    >
                      {isAllChapterSelected ? <Check size={14} /> : chapterSelectedCount > 0 ? <span className="minus-bar" /> : null}
                    </button>
                    <span className="chapter-index">{String(index + 1).padStart(2, '0')}</span>
                    <div className="chapter-info" onClick={() => chooseWholeChapter(chapter)}>
                      <b>{chapter.name}</b>
                      <small>
                        {chapter.attempted}/{chapter.total} 已覆盖 · {chapter.evidence}
                        {chapterSelectedCount > 0 && <span className="selected-tag">已选 {chapterSelectedCount}/{allChapterSubIds.length} 子分支</span>}
                      </small>
                    </div>
                    <div className="mini-progress">
                      <i style={{ width: `${chapter.coverage * 100}%` }} />
                    </div>
                    <strong>{Math.round(chapter.coverage * 100)}%</strong>
                    {sections.length > 0 && (
                      <button
                        type="button"
                        className={`expand-toggle-btn ${isExpanded ? 'expanded' : ''}`}
                        onClick={(e) => toggleExpand(chapter.id, e)}
                        title={isExpanded ? '收起子考点' : '展开子考点'}
                      >
                        <small>{sections.length} 个考点组 · {allChapterSubIds.length} 个子分支</small>
                        <ChevronDown size={16} />
                      </button>
                    )}
                  </div>

                  {isExpanded && sections.length > 0 && (
                    <div className="focus-sections-container">
                      {sections.map((sec) => {
                        const targetSubIds = sec.children.length > 0 ? sec.children.map((c) => c.id) : [sec.section.id]
                        const secSelectedCount = targetSubIds.filter((id) => selectedIds.has(id)).length
                        const isSecAll = targetSubIds.length > 0 && secSelectedCount === targetSubIds.length

                        return (
                          <div key={sec.section.id} className="focus-section-group">
                            <div className="focus-section-header" onClick={(e) => toggleSection(sec, e)}>
                              <button
                                type="button"
                                className={`focus-checkbox small ${isSecAll ? 'checked' : secSelectedCount > 0 ? 'indeterminate' : ''}`}
                                onClick={(e) => toggleSection(sec, e)}
                                title="勾选该分类全部子分支"
                              >
                                {isSecAll ? <Check size={12} /> : secSelectedCount > 0 ? <span className="minus-bar" /> : null}
                              </button>
                              <span className="focus-section-title">{sec.section.name}</span>
                              <span className="focus-section-meta">
                                {sec.section.attempted}/{sec.section.total} 题已做 · {secSelectedCount}/{targetSubIds.length} 已选
                              </span>
                            </div>

                            <div className="sub-branch-grid">
                              {(sec.children.length > 0 ? sec.children : [sec.section]).map((node) => {
                                const isSelected = selectedIds.has(node.id)
                                const state = masteryState(node)
                                return (
                                  <div
                                    key={node.id}
                                    className={`sub-branch-card ${isSelected ? 'selected' : ''} ${state}`}
                                    onClick={(e) => toggleNode(node.id, e)}
                                  >
                                    <div className="sub-branch-head">
                                      <span className={`focus-checkbox small ${isSelected ? 'checked' : ''}`}>
                                        {isSelected && <Check size={11} />}
                                      </span>
                                      <b title={node.name}>{node.name}</b>
                                      <span className={`mastery-chip ${state}`}>
                                        {state === 'strong' ? '熟练' : state === 'steady' ? '稳健' : state === 'weak' ? '薄弱' : state === 'insufficient' ? '题少' : '未做'}
                                      </span>
                                    </div>
                                    <div className="sub-branch-stats">
                                      <span>题量: <b>{node.attempted}/{node.total}</b></span>
                                      {node.weakCount > 0 && <span className="stat-weak">薄弱: <b>{node.weakCount}</b></span>}
                                      {node.dueCount > 0 && <span className="stat-due">待复习: <b>{node.dueCount}</b></span>}
                                      {node.masteryScore !== null && <span>掌握: <b>{Math.round(node.masteryScore)}分</b></span>}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {selectedIds.size > 0 && (
        <motion.div
          className="focus-action-bar"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
        >
          <div className="focus-action-info">
            <Sparkles size={18} />
            <div>
              <strong>已选 {selectedIds.size} 个子分支考点 · 预计 {stats.totalQuestions} 道题</strong>
              <span>包含 {stats.unattemptedQuestions} 未做 · {stats.weakQuestions} 薄弱 · {stats.dueQuestions} 待复习</span>
            </div>
          </div>
          <div className="focus-action-controls">
            <div className="limit-selector">
              <span>题数:</span>
              {[10, 15, 20, 30].map((num) => (
                <button
                  key={num}
                  className={limit === num ? 'active' : ''}
                  onClick={() => setLimit(num)}
                >
                  {num}
                </button>
              ))}
            </div>
            <button className="text-button compact" onClick={() => setSelectedIds(new Set())}>
              <Trash2 size={14} /> 清空
            </button>
            <button
              className="primary-button"
              disabled={loading}
              onClick={() => void startMultiBranchPractice()}
            >
              <Play size={16} /> 开始专项训练（{limit} 题）
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}

function ReviewView({
  due,
  inboxCount,
  intervals,
  notify,
  onStart,
  onOpenWrongBook,
  onPractice,
  onPracticeBatch,
  onStartVariant,
  onOpenInbox,
}: {
  due: number
  inboxCount: number
  intervals: number[]
  notify: (text: string) => void
  onStart: () => Promise<void>
  onOpenWrongBook: () => void
  onPractice: (question: Question) => void
  onPracticeBatch: (questions: Question[], reason: string) => void
  onStartVariant: (questionId: number) => void
  onOpenInbox: () => void
}) {
  const [history, setHistory] = useState<ReviewHistory | null>(null)
  const [plan, setPlan] = useState<ReviewPlan | null>(null)
  const [mode, setMode] = useState<'plan' | 'daily_log' | 'history'>('plan')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [selectedChapter, setSelectedChapter] = useState<string>('all')
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [batchLoading, setBatchLoading] = useState(false)

  const load = useCallback(() => {
    void Promise.all([getReviewHistory(), getReviewPlan()]).then(([nextHistory, nextPlan]) => {
      setHistory(nextHistory)
      setPlan(nextPlan)
      setSelectedDate((current) => current || nextPlan.days[0]?.date || '')
    })
  }, [])

  useEffect(load, [load])

  const days = mode === 'plan' ? plan?.days ?? [] : history?.days ?? []
  const selectedDay = days.find((day) => day.date === selectedDate)

  const planItems = plan?.items.filter((item) => item.scheduledDate === selectedDate) ?? []
  const historyItems = history?.items.filter((item) => item.attemptedAt.slice(0, 10) === selectedDate) ?? []
  const rawItems = mode === 'plan' ? planItems : historyItems

  // Extract available chapters from rawItems
  const availableChapters = useMemo(() => {
    const map = new Map<string, number>()
    for (const it of rawItems) {
      const parts = it.categoryPath.split(' / ')
      const subj = parts[0]
      if (selectedSubject !== 'all' && subj !== selectedSubject) continue
      const chap = parts.length > 2 ? `${parts[1]} · ${parts[2]}` : parts[1] || parts[0]
      map.set(chap, (map.get(chap) || 0) + 1)
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }))
  }, [rawItems, selectedSubject])

  // Filter items by selectedSubject and selectedChapter
  const filteredItems = useMemo(() => {
    return rawItems.filter((it) => {
      const parts = it.categoryPath.split(' / ')
      const subj = parts[0]
      const chap = parts.length > 2 ? `${parts[1]} · ${parts[2]}` : parts[1] || parts[0]

      if (selectedSubject !== 'all' && subj !== selectedSubject) return false
      if (selectedChapter !== 'all' && chap !== selectedChapter) return false
      return true
    })
  }, [rawItems, selectedSubject, selectedChapter])
  const scheduledRepairs = plan?.items.length ?? 0
  const conqueredRetests = history?.items.filter((item) => item.result === 'correct').length ?? 0

  const startFilteredBatch = async () => {
    if (!filteredItems.length) return
    setBatchLoading(true)
    try {
      const qids = filteredItems.map((it) => it.questionId)
      const fullQuestions = await Promise.all(qids.map((id) => getQuestion(id)))
      const label = selectedChapter !== 'all' ? selectedChapter : selectedSubject !== 'all' ? selectedSubject : '错题复习'
      onPracticeBatch(fullQuestions, `错题专项攻坚：${label}`)
    } catch (e) {
      notify(`加载题目失败：${String(e)}`)
    } finally {
      setBatchLoading(false)
    }
  }

  const daySummary = (day: { count: number; correctCount?: number }) =>
    mode === 'plan' ? (day.count ? '计划复习' : '暂无安排') : day.count ? `${day.correctCount ?? 0}/${day.count} 正确` : '暂无复习'

  const selectMode = (next: 'plan' | 'daily_log' | 'history') => {
    setMode(next)
    if (next === 'plan') {
      setSelectedDate(plan?.days[0]?.date ?? '')
    } else if (next === 'history') {
      setSelectedDate(history?.days[history.days.length - 1]?.date ?? '')
    }
    setSelectedSubject('all')
    setSelectedChapter('all')
  }

  const openQuestion = async (questionId: number) => {
    try {
      setSelectedQuestion(await getQuestion(questionId))
    } catch (error) {
      notify(`无法读取题目：${String(error)}`)
    }
  }

  return (
    <div className="review-view">
      <section className="review-lifecycle" aria-label="诊断修复时间线">
        <button className={inboxCount ? 'needs-action' : ''} onClick={onOpenInbox}><span>AI 待确认</span><strong>{inboxCount}</strong><small>{inboxCount ? '去核对诊断' : '当前已清空'}</small></button>
        <button onClick={() => selectMode('plan')}><span>修复排期</span><strong>{scheduledRepairs}</strong><small>查看未来 7 天</small></button>
        <button className={due ? 'needs-action' : ''} onClick={() => void onStart()}><span>到期重测</span><strong>{due}</strong><small>{due ? '现在开始' : '今日无欠债'}</small></button>
        <button onClick={() => selectMode('history')}><span>已攻克</span><strong>{conqueredRetests}</strong><small>查看重测证据</small></button>
      </section>
      <div className="review-hero">
        <div>
          <span>复习队列</span>
          <strong>{due}</strong>
          <small>道题今天到期</small>
        </div>
        <div className="review-copy">
          <h2>先修复，再拓展</h2>
          <p>按艾宾浩斯曲线分梯队回炉，支持按学科章节靶向筛选、攻坚错题或直接调出同类变式题。</p>
          <div className="review-copy-actions">
            <button className="primary-button" onClick={() => void onStart()}>
              <TimerReset size={17} /> 开始今日全部复习 ({due}题)
            </button>
            <button className="secondary-button" onClick={onOpenWrongBook}>
              <FolderSearch size={17} /> 查看全部错题库
            </button>
          </div>
        </div>
      </div>

      <section className="review-history">
        <div className="review-history-head">
          <div>
            <span>{mode === 'plan' ? '未来 7 天排期' : mode === 'daily_log' ? '每日作答回顾' : '最近 7 天完成'}</span>
            <h3>{mode === 'plan' ? '艾宾浩斯复习计划' : mode === 'daily_log' ? '每日做题回顾与 Codex 点评' : '复习完成记录'}</h3>
          </div>
          <div className="review-history-actions">
            <div className="segmented review-switch">
              <button className={mode === 'plan' ? 'active' : ''} onClick={() => selectMode('plan')}>
                未来计划
              </button>
              <button className={mode === 'daily_log' ? 'active' : ''} onClick={() => selectMode('daily_log')}>
                每日回顾
              </button>
              <button className={mode === 'history' ? 'active' : ''} onClick={() => selectMode('history')}>
                近期完成
              </button>
            </div>
            <button className="icon-button" title="刷新复习记录" aria-label="刷新复习记录" onClick={load}>
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {mode === 'daily_log' ? (
          <HistoryView notify={notify} onStartVariant={onStartVariant} />
        ) : !history || !plan ? (
          <div className="inbox-loading">
            <LoaderCircle className="spin" size={20} /> 正在读取复习记录
          </div>
        ) : (
          <>
            <div className="review-days">
              {days.map((day) => (
                <button
                  key={day.date}
                  className={day.date === selectedDate ? 'review-day active' : 'review-day'}
                  onClick={() => {
                    setSelectedDate(day.date)
                    setSelectedSubject('all')
                    setSelectedChapter('all')
                  }}
                >
                  <span>{day.date.slice(5).replace('-', '/')}</span>
                  <strong>{day.count}</strong>
                  <small>{daySummary(day)}</small>
                </button>
              ))}
            </div>

            <div className="review-detail">
              <div className="review-detail-header-row">
                <div>
                  <span>{selectedDay?.date ?? '选择日期'}</span>
                  <h3>
                    {filteredItems.length} 道{mode === 'plan' ? '排期错题' : '已复习题'}
                  </h3>
                </div>

                {filteredItems.length > 0 && mode === 'plan' && (
                  <button
                    className="review-chapter-batch-btn"
                    onClick={startFilteredBatch}
                    disabled={batchLoading}
                  >
                    <Zap size={14} />
                    <span>
                      {batchLoading
                        ? '正在加载...'
                        : selectedChapter !== 'all'
                        ? `仅攻坚「${selectedChapter}」(${filteredItems.length}题)`
                        : selectedSubject !== 'all'
                        ? `仅攻坚「${selectedSubject}」(${filteredItems.length}题)`
                        : `开始攻坚此列表 (${filteredItems.length}题)`}
                    </span>
                  </button>
                )}
              </div>

              {/* Subject & Chapter Filter Chips */}
              {rawItems.length > 0 && (
                <div className="review-filter-section">
                  <div className="review-subject-tabs">
                    <button
                      className={`review-subj-btn ${selectedSubject === 'all' ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedSubject('all')
                        setSelectedChapter('all')
                      }}
                    >
                      全部学科 ({rawItems.length})
                    </button>
                    <button
                      className={`review-subj-btn gaoshu ${selectedSubject === '高等数学' ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedSubject('高等数学')
                        setSelectedChapter('all')
                      }}
                    >
                      高等数学 ({rawItems.filter((i) => i.categoryPath.startsWith('高等数学')).length})
                    </button>
                    <button
                      className={`review-subj-btn xiandai ${selectedSubject === '线性代数' ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedSubject('线性代数')
                        setSelectedChapter('all')
                      }}
                    >
                      线性代数 ({rawItems.filter((i) => i.categoryPath.startsWith('线性代数')).length})
                    </button>
                    <button
                      className={`review-subj-btn gailv ${selectedSubject === '概率统计' ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedSubject('概率统计')
                        setSelectedChapter('all')
                      }}
                    >
                      概率统计 ({rawItems.filter((i) => i.categoryPath.startsWith('概率统计')).length})
                    </button>
                  </div>

                  {availableChapters.length > 1 && (
                    <div className="review-chapter-chips">
                      <button
                        className={`chapter-chip ${selectedChapter === 'all' ? 'active' : ''}`}
                        onClick={() => setSelectedChapter('all')}
                      >
                        全部细分章节
                      </button>
                      {availableChapters.map((chap) => (
                        <button
                          key={chap.name}
                          className={`chapter-chip ${selectedChapter === chap.name ? 'active' : ''}`}
                          onClick={() => setSelectedChapter(chap.name)}
                        >
                          {chap.name} ({chap.count})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {filteredItems.length ? (
                <div className="review-item-list">
                  {mode === 'plan'
                    ? (filteredItems as typeof planItems).map((item) => {
                        const subj = item.categoryPath.split(' / ')[0] || '数学'
                        return (
                          <div className="review-slayer-card" key={item.questionId}>
                            <button
                              className="review-slayer-main"
                              onClick={() => void openQuestion(item.questionId)}
                            >
                              <div className="review-slayer-meta">
                                <span className={`subject-badge ${subj}`}>{subj}</span>
                                <b>#{item.questionId}</b>
                                <span className="category-tag">
                                  {item.categoryPath.split(' / ').slice(-2).join(' / ')}
                                </span>
                                <span className="rating-badge-small">
                                  上次评 {item.selfRating}/4 ({ratingOptions.find((r) => r.value === item.selfRating)?.label || '薄弱'})
                                </span>
                              </div>
                              <div className="review-slayer-stem">
                                <MathText value={item.stem} />
                              </div>
                              <div className="review-slayer-sub">
                                <small>{item.source} · 计划复习 {item.nextReview}</small>
                              </div>
                            </button>

                            <div className="review-slayer-actions">
                              <button
                                className="slayer-action-btn practice"
                                onClick={async () => {
                                  try {
                                    const q = await getQuestion(item.questionId)
                                    onPractice(q)
                                  } catch (e) {
                                    notify(`无法打开题目：${String(e)}`)
                                  }
                                }}
                                title="直接开始练习本题"
                              >
                                <Play size={13} /> 单题练习
                              </button>
                              <button
                                className="slayer-action-btn variant"
                                onClick={() => onStartVariant(item.questionId)}
                                title="调出此题同考点的 3 道变式题"
                              >
                                <Sparkles size={13} /> 攻坚3道变式题
                              </button>
                            </div>
                          </div>
                        )
                      })
                    : (filteredItems as typeof historyItems).map((item) => {
                        const result = outcomeChip(item.result)
                        return <div className="review-slayer-card" key={item.attemptId}>
                          <button
                            className="review-slayer-main"
                            onClick={() => void openQuestion(item.questionId)}
                          >
                            <div className="review-slayer-meta">
                              <span className={`result-dot ${result.tone}`}>
                                {result.label}
                              </span>
                              <b>#{item.questionId}</b>
                              <span className="category-tag">
                                {item.categoryPath.split(' / ').slice(-2).join(' / ')}
                              </span>
                              <span className="rating-badge-small">自评 {item.selfRating}/4</span>
                            </div>
                            <div className="review-slayer-stem">
                              <MathText value={item.stem} />
                            </div>
                            <div className="review-slayer-sub">
                              <small>
                                {item.source} · {new Date(item.attemptedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                                {result.note ? ` · ${result.note}` : ''}
                              </small>
                            </div>
                          </button>

                          <div className="review-slayer-actions">
                            <button
                              className="slayer-action-btn variant"
                              onClick={() => onStartVariant(item.questionId)}
                              title="调出此题同考点的 3 道变式题"
                            >
                              <Sparkles size={13} /> 练同类变式题
                            </button>
                          </div>
                        </div>
                      })}
                </div>
              ) : (
                <div className="review-empty">
                  {mode === 'plan' ? '当前筛选下没有排期复习题目。' : '当前筛选下还没有复习记录。'}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <div className="review-rules">
        <div>
          <span>01</span>
          <b>不会 (1分)</b>
          <p>{intervals[0] ?? 1} 天后再次出现</p>
        </div>
        <div>
          <span>02</span>
          <b>模糊 (2分)</b>
          <p>{intervals[1] ?? 3} 天后回看</p>
        </div>
        <div>
          <span>03</span>
          <b>会做 (3分)</b>
          <p>{intervals[2] ?? 7} 天后抽查</p>
        </div>
        <div>
          <span>04</span>
          <b>熟练 (4分)</b>
          <p>{intervals[3] ?? 15} 天后确认</p>
        </div>
      </div>

      <AnimatePresence>
        {selectedQuestion && (
          <QuestionDetail
            question={selectedQuestion}
            close={() => setSelectedQuestion(null)}
            add={() => {
              void addToCustomQueue(selectedQuestion.id)
                .then(() => notify(`已将错题 #${selectedQuestion.id} 加入训练队列`))
                .catch((error) => notify(`无法加入训练队列：${String(error)}`))
            }}
            practice={() => {
              onPractice(selectedQuestion)
              setSelectedQuestion(null)
            }}
            onChange={setSelectedQuestion}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function verdictChip(verdict: string | null): { label: string; tone: string } {
  if (verdict === 'correct') return { label: '正确', tone: 'correct' }
  if (verdict === 'partial') return { label: '部分正确', tone: 'uncertain' }
  if (verdict === 'incorrect' || verdict === 'wrong') return { label: '有误', tone: 'wrong' }
  if (verdict === 'uncertain') return { label: '不确定', tone: 'uncertain' }
  return { label: '已批改', tone: 'correct' }
}

function outcomeChip(outcome: AttemptOutcome): { label: string; symbol: string; tone: string; note?: string } {
  if (outcome === 'correct') return { label: '对', symbol: '✓', tone: 'correct' }
  if (outcome === 'partial') return { label: '部分', symbol: '半', tone: 'partial' }
  if (outcome === 'uncertain') return { label: '不确定', symbol: '?', tone: 'uncertain', note: '未计入正确率与掌握进度' }
  return { label: '错', symbol: '✗', tone: 'wrong' }
}

function HistoryView({ notify, onStartVariant }: { notify: (text: string) => void; onStartVariant: (questionId: number) => void }) {
  const [log, setLog] = useState<DailyLog | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [openingQuestionId, setOpeningQuestionId] = useState<number | null>(null)
  const load = useCallback(() => {
    void getDailyLog().then((next) => {
      setLog(next)
      setSelectedDate((current) => current || next.days[next.days.length - 1]?.date || '')
    })
  }, [])
  useEffect(load, [load])
  const days = log?.days ?? []
  const items = log?.items.filter((item) => item.attemptedAt.slice(0, 10) === selectedDate) ?? []
  const selectedDay = days.find((day) => day.date === selectedDate)
  const openQuestion = async (questionId: number) => {
    setOpeningQuestionId(questionId)
    try { setSelectedQuestion(await getQuestion(questionId)) }
    catch (error) { notify(`无法读取题目：${String(error)}`) }
    finally { setOpeningQuestionId(null) }
  }
  const openLabel = (questionId: number) => openingQuestionId === questionId ? '正在打开题目' : '点击查看完整题目'

  const todayIso = localToday()
  const todayStats = days.find((d) => d.date === todayIso)
  const outcomeStats = (date: string) => {
    const dayItems = log?.items.filter((item) => item.attemptedAt.slice(0, 10) === date) ?? []
    const scored = dayItems.filter((item) => item.result !== 'uncertain')
    return {
      scored: scored.length,
      correct: scored.filter((item) => item.result === 'correct').length,
      uncertain: dayItems.length - scored.length,
    }
  }
  const todayOutcomeStats = outcomeStats(todayIso)
  const todayAccuracy = todayOutcomeStats.scored > 0 ? Math.round(todayOutcomeStats.correct / todayOutcomeStats.scored * 100) : null

  return <div className="history-view">
    <section className="review-history">
      <div className="review-history-head">
        <div><span>过去每一天</span><h3>每日回顾</h3></div>
        <div className="review-history-actions"><button className="icon-button" title="刷新历史记录" aria-label="刷新历史记录" onClick={load}><RefreshCw size={16}/></button></div>
      </div>

      {todayStats && (
        <div className="history-today-summary">
          <Sparkles size={16} />
          <div>
            <strong>今日战报：已完成 {todayStats.count} 道题</strong>
            <span>{todayAccuracy === null ? '暂无可评分作答' : `正确率 ${todayAccuracy}%`} · 不确定结果不计入正确率与掌握进度</span>
          </div>
        </div>
      )}

      {!log ? <div className="inbox-loading"><LoaderCircle className="spin" size={20}/> 正在读取历史记录</div> : days.length === 0 ? <EmptyState icon={History} title="还没有历史记录" text="完成第一道题后，这里会按天展示你的作答卡片和 Codex 点评。" /> : <><div className="review-days">{days.map((day) => { const stats = outcomeStats(day.date); return <button key={day.date} className={day.date === selectedDate ? 'review-day active' : 'review-day'} onClick={() => setSelectedDate(day.date)}><span>{day.date.slice(5).replace('-', '/')}</span><strong>{day.count}</strong><small>{stats.correct}/{stats.scored} 正确{stats.uncertain ? ` · ${stats.uncertain} 不确定` : ''}</small></button> })}</div>
      <div className="review-detail"><div><div><span>{selectedDate.slice(5).replace('-', '/')}</span><h3>{selectedDay?.count ?? 0} 道题</h3></div><small>{selectedDay?.count ? '已按最新作答时间排序置顶；点击卡片查看完整题目与 Codex 点评' : '当天还没有作答记录'}</small></div></div>
      <div className="history-card-list">{items.map((item) => { const aiChip = verdictChip(item.aiVerdict); const result = outcomeChip(item.result); return <article className="history-card" key={`${item.attemptedAt}-${item.questionId}`}>
        <button className="history-card-main" onClick={() => void openQuestion(item.questionId)}>
          <div className="history-card-meta"><span className={`result-dot ${result.tone}`}>{result.symbol}</span><b>#{item.questionId}</b><span>{item.categoryPath.split(' / ').slice(-2).join(' / ')}</span><ChevronRight size={16}/></div>
          <MathText value={item.stem} />
          <div className="history-card-sub-row">
            <small className="history-card-sub">{item.source} · 自评 {item.selfRating}/4 · {new Date(item.attemptedAt).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}{result.note ? ` · ${result.note}` : ''}</small>
            <div className="history-card-actions">
              <span className="variant-practice-btn" onClick={(e) => { e.stopPropagation(); onStartVariant(item.questionId) }} title="调出此题同考点的 3 道变式题">
                <Sparkles size={12} /> 练同类变式题
              </span>
            </div>
          </div>
          <span className="sr-only">{openLabel(item.questionId)}</span>
        </button>
        <div className={item.aiConfirmedAt ? 'history-ai-panel' : 'history-ai-empty'}>
          {item.aiConfirmedAt ? <><div className="history-ai-head"><Sparkles size={14}/><b>Codex 点评</b><i className={`batch-verdict ${aiChip.tone}`}>{aiChip.label}</i>{item.aiConfidence !== null && <small>置信度 {Math.round(item.aiConfidence * 100)}%</small>}</div>
            {item.aiSummary && <p>{item.aiSummary}</p>}
            {item.aiEarliestError && <div className="earliest-error"><span>最早断点</span><p>{item.aiEarliestError}</p></div>}
            {(item.aiErrorTags.length > 0 || item.aiWeaknessTags.length > 0) && <div className="tag-line">{item.aiErrorTags.map((tag) => <span className="error-tag" key={tag}>{tag}</span>)}{item.aiWeaknessTags.map((tag) => <span className="weakness-tag" key={tag}>{tag}</span>)}</div>}
            {item.aiAdvice && <p className="advice">下一步：{item.aiAdvice}</p>}
          </> : <p>这道题当时没有提交 Codex 批改，所以没有 AI 点评。</p>}
        </div>
      </article> })}</div>
      </>}
    </section>
    <AnimatePresence>{selectedQuestion && <QuestionDetail question={selectedQuestion} close={() => setSelectedQuestion(null)} add={() => { void addToCustomQueue(selectedQuestion.id).then(() => notify(`已将错题 #${selectedQuestion.id} 加入训练队列`)).catch((error) => notify(`无法加入训练队列：${String(error)}`)) }} practice={() => setSelectedQuestion(null)} onChange={setSelectedQuestion} />}</AnimatePresence>
  </div>
}

function recommendationStatusLabel(item: InboxItem) {
  if (item.recommendationBatchStatus === 'pending') return '待开始'
  if (item.recommendationBatchStatus === 'active') return '训练中'
  if (item.recommendationBatchStatus === 'paused') return '已暂停'
  if (item.recommendationBatchStatus === 'completed') return '已完成'
  if (item.recommendationBatchStatus === 'dismissed') return '未采用'
  return item.status === 'dismissed' ? '未采用' : item.status === 'confirmed' ? '已开始' : '待开始'
}

function InboxView({ notify, onStartRecommendation, onStartVariant }: { notify: (s: string) => void; onStartRecommendation: (taskId: string) => Promise<void>; onStartVariant: (questionId: number) => void }) {
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [failedItems, setFailedItems] = useState<FailedInboxItem[]>([])
  const [copiedTask, setCopiedTask] = useState<string | null>(null)
  const load = useCallback(() => { setLoading(true); void Promise.all([getInbox(), getFailedInbox()]).then(([inbox, failed]) => { setItems(inbox); setFailedItems(failed) }).finally(() => setLoading(false)) }, [])
  useEffect(load, [load])
  const copyTaskPrompt = async (item: InboxItem) => {
    const prompt = await getTaskPrompt(item.taskId)
    if (!prompt) { notify('没有找到这份回传对应的任务说明，请回到练习页重新生成'); return }
    await navigator.clipboard.writeText(prompt)
    setCopiedTask(item.taskId)
    notify('任务说明已复制，可以发送给 Codex')
    setTimeout(() => setCopiedTask(null), 2000)
  }
  const decide = async (id: number, apply: boolean, kind: string) => {
    await confirmInbox(id, apply)
    notify(apply ? (kind === 'paper' ? '整卷结果已写入训练记录' : kind === 'batch' ? '整组批改结果已写入训练记录，并更新薄弱画像' : '诊断已进入推荐画像，并会影响后续荐题') : '已忽略本次诊断')
    load()
  }
  const start = async (item: InboxItem) => { try { await onStartRecommendation(item.taskId) } catch { /* The parent already presents the error. */ } }
  const dismiss = async (item: InboxItem) => {
    try {
      await dismissRecommendationBatch(item.taskId)
      notify('这组 AI 推荐题已暂不采用')
      load()
    } catch (error) { notify(`无法取消 AI 题组：${String(error)}`) }
  }
  return <div className="inbox-view"><div className="inbox-toolbar"><div><h2>Codex 回传</h2><p>AI 推荐先在这里确认；开始后会作为一组题进入今日训练。收件箱每 20 秒自动扫描一次，无需手动刷新。</p></div><button className="secondary-button" onClick={load}><RefreshCw size={16}/> 扫描收件箱</button></div>
    {failedItems.length > 0 && <div className="failed-inbox-banner"><X size={15}/><div><b>{failedItems.length} 份回传解析失败</b><p>文件已被移到收件箱的 failed/ 目录，不会丢失。常见原因是 JSON 结构不符，请检查后手动重发。</p></div><details><summary>查看失败原因</summary><ul>{failedItems.map((item) => <li key={item.fileName}><code>{item.fileName}</code><span>{item.error}</span></li>)}</ul></details></div>}
    {loading ? <div className="inbox-loading"><LoaderCircle className="spin" size={20} /> 正在扫描本地收件箱</div> : items.length === 0 ? <EmptyState icon={Inbox} title="收件箱是空的" text="从练习页生成批改任务，再把草稿发给 Codex。" /> : <div className="inbox-list">{items.map((item) => {
    const isRecommendation = item.kind === 'recommendation'
    const recommendationStatus = recommendationStatusLabel(item)
    const canStart = isRecommendation && item.recommendationBatchStatus === 'pending'
    return <article className={`inbox-entry ${item.status}`} key={item.id}><div className="entry-rail"><BrainCircuit size={19}/><span/></div><div className="entry-main"><div className="entry-meta"><span>{item.taskId}</span><span>{isRecommendation ? `AI 题组 · ${item.recommendationQuestionCount ?? 0} 道` : item.kind === 'paper' ? '整卷回传' : item.kind === 'batch' ? `整组批改 · ${item.batchAttempts?.length ?? 0} 道` : `置信度 ${Math.round(item.confidence*100)}%`}</span><time>{new Date(item.createdAt).toLocaleString('zh-CN')}</time></div><h3>{item.paperTitle ? `${item.paperTitle} · ${item.summary}` : item.summary}</h3>{isRecommendation && <div className="ai-plan-card"><Sparkles size={17}/><div><strong>{recommendationStatus}</strong><span>{item.recommendationQuestionCount ?? 0} 道题将按 Codex 给出的顺序训练</span></div></div>}{item.kind === 'paper' && <div className="paper-import-summary"><strong>{item.paperAttempts?.length ?? 0} 道题识别完成</strong><span>确认后会按每道题写入正确性、自评和复习日期</span></div>}{item.kind === 'batch' && <div className="paper-import-summary"><strong>{item.batchAttempts?.length ?? 0} 道题批改完成</strong><span>只包含上传了草稿的题；确认后按每道题写入正确性、自评和薄弱诊断</span><ul className="batch-result-list">{(item.batchAttempts ?? []).map((attempt) => <li key={attempt.questionId}><b>#{attempt.questionId}</b><i className={`batch-verdict ${attempt.result}`}>{attempt.result === 'correct' ? '正确' : attempt.result === 'wrong' ? '出错' : '不确定'}</i><span>{attempt.summary}</span><button className="variant-practice-btn" onClick={() => onStartVariant(attempt.questionId)} title="调出此题同考点的 3 道变式题"><Sparkles size={11}/> 练变式题</button></li>)}</ul></div>}{item.earliestError && <div className="earliest-error"><span>最早断点</span><p>{item.earliestError}</p></div>}<div className="tag-line">{item.errorTags.map(t => <span className="error-tag" key={t}>{t}</span>)}{item.weaknessTags.map(t => <span className="weakness-tag" key={t}>{t}</span>)}</div>{item.advice && <p className="advice">下一步：{item.advice}</p>}{isRecommendation && canStart ? <div className="entry-actions"><button onClick={() => start(item)}><Play size={16}/> 开始这组题</button><button onClick={() => dismiss(item)}><ThumbsDown size={16}/> 暂不采用</button></div> : !isRecommendation && item.status === 'pending' ? <div className="entry-actions"><button onClick={() => decide(item.id,true,item.kind)}><ThumbsUp size={16}/> {item.kind === 'paper' ? '确认并写入整卷' : item.kind === 'batch' ? '确认并写入整组' : '诊断准确，写入画像'}</button><button onClick={() => decide(item.id,false,item.kind)}><ThumbsDown size={16}/> 不采用</button><button onClick={() => copyTaskPrompt(item)}>{copiedTask === item.taskId ? <><Check size={15}/> 已复制</> : <><Send size={15}/> 重新复制任务说明</>}</button></div> : item.status === 'confirmed' && item.kind === 'analysis' && item.questionId ? <div className="entry-actions"><span className="resolved"><Check size={15}/> 已写入画像</span><button onClick={() => onStartVariant(item.questionId!)}><Sparkles size={16}/> 现在修复</button></div> : <div className="resolved"><Check size={15}/> {isRecommendation ? recommendationStatus : item.status === 'confirmed' ? (item.kind === 'paper' ? '整卷已写入记录' : '已写入画像') : '已忽略'}</div>}</div></article>
  })}</div>}</div>
}

function InsightsView({
  data,
  refresh,
  onStart,
  onStartReview,
  onStartTagPractice,
  onStartRecommendation,
  onStartVariant,
  initialTab,
  notify,
}: {
  data: BootstrapData
  refresh: () => void
  onStart: () => void
  onStartReview: () => void
  onStartTagPractice: (tagName: string) => void
  onStartRecommendation?: (taskId: string) => Promise<void>
  onStartVariant?: (questionId: number) => void
  initialTab: 'overview' | 'inbox'
  notify: (text: string) => void
}) {
  const [tab, setTab] = useState<'overview' | 'inbox'>(initialTab)
  const [chapters, setChapters] = useState<MasteryChapter[]>([])
  const [nodes, setNodes] = useState<MasteryNode[]>([])
  const [trend, setTrend] = useState<DailyTrendPoint[]>([])
  const [subjectStats, setSubjectStats] = useState<InsightPoint[]>([])
  const [streak, setStreak] = useState<{ currentStreak: number; bestStreak: number } | null>(null)
  const [radar, setRadar] = useState<WeaknessRadar | null>(null)
  const [mode, setMode] = useState<'treemap' | 'chapters'>('treemap')
  const [selectedNode, setSelectedNode] = useState<MasteryNode | null>(null)
  const [weekly, setWeekly] = useState<string | null>(null)
  const [weeklyBusy, setWeeklyBusy] = useState(false)

  const buildWeekly = async () => {
    if (trend.length === 0) return
    setWeeklyBusy(true)
    try {
      const plan = await getReviewPlan()
      const week = trend.slice(-7)
      const total = week.reduce((sum, day) => sum + day.attempts, 0)
      const correctTotal = week.reduce((sum, day) => sum + day.correct, 0)
      const accuracy = total > 0 ? Math.round(correctTotal / total * 100) : 0
      const activeDays = week.filter((day) => day.attempts > 0).length
      const shortDate = (date: string) => date.slice(5).replace('-', '/')
      const weaknessTop = radar?.weaknessTags.slice(0, 5) ?? []
      const errorTop = radar?.errorTags.slice(0, 3) ?? []
      const advice: string[] = []
      if (data.dueCount > 0) advice.push(`当前还有 ${data.dueCount} 道到期复习，建议每天先清复习再开新题。`)
      if (weaknessTop[0]) advice.push(`重点攻克薄弱点「${weaknessTop[0].tag}」，可在题库按知识点定向加练。`)
      if (total > 0 && accuracy < 60) advice.push('正确率低于 60%，建议减少每日新题量，先把解析与错因吃透。')
      if (total < data.dailyProblemTarget * 7 * 0.6) advice.push('完成量未达目标六成，建议调低每日目标或固定刷题时段。')
      if (advice.length === 0) advice.push('保持当前节奏，稳定推进即可。')
      const lines = [
        `# 刷吧学习周报（${shortDate(week[0]?.date ?? '')} ~ ${shortDate(week[week.length - 1]?.date ?? '')}）`,
        '',
        '## 总览',
        `- 共完成 ${total} 道，做对 ${correctTotal} 道，正确率 ${accuracy}%`,
        `- 活跃 ${activeDays}/7 天 · 连续学习 ${streak?.currentStreak ?? 0} 天（最长 ${streak?.bestStreak ?? 0} 天）`,
        '',
        '## 每日明细',
        ...week.map((day) => `- ${shortDate(day.date)}：${day.attempts} 道 · 对 ${day.correct} 道`),
        '',
        '## 薄弱点（Codex 批改标注）',
        weaknessTop.length > 0 ? weaknessTop.map((tag) => `- ${tag.tag}：出现 ${tag.count} 次，近 7 天 ${tag.recentCount} 次`).join('\n') : '- 暂无批改数据，发草稿给 Codex 后自动汇总',
        '',
        '## 常见错误类型',
        errorTop.length > 0 ? errorTop.map((tag) => `- ${tag.tag}：出现 ${tag.count} 次`).join('\n') : '- 暂无批改数据',
        '',
        '## 复习展望',
        `- 当前到期复习 ${data.dueCount} 道`,
        `- 未来 7 天预计到期：${plan.days.map((day) => `${shortDate(day.date)} ${day.count} 道`).join('、')}`,
        '',
        '## 下周建议',
        ...advice.map((item) => `- ${item}`),
      ]
      setWeekly(lines.join('\n'))
    } catch (error) {
      notify(`周报生成失败：${String(error)}`)
    } finally {
      setWeeklyBusy(false)
    }
  }

  const copyWeekly = async () => {
    if (!weekly) return
    await navigator.clipboard.writeText(weekly)
    notify('周报已复制，可粘贴到笔记中')
  }

  useEffect(() => {
    void Promise.all([getMasteryMap(), getMasteryNodes(), getDailyTrend(), getInsights(), getStreak()])
      .then(([chapterData, nodeData, trendData, subjectData, streakData]) => {
        setChapters(chapterData)
        setNodes(nodeData)
        setTrend(trendData)
        setSubjectStats(subjectData)
        setStreak(streakData)
      })
    void getWeaknessRadar().then(setRadar).catch(() => setRadar(null))
  }, [])

  const start = async (chapter: MasteryChapter) => {
    await setCurrentChapter(chapter.id)
    await refresh()
    notify(`已进入「${chapter.name}」首轮`)
    onStart()
  }

  const scoredChapters = useMemo(() => chapters.filter((chapter) => chapter.masteryScore !== null), [chapters])
  const averageMastery = useMemo(() => scoredChapters.length ? scoredChapters.reduce((sum, chapter) => sum + (chapter.masteryScore ?? 0), 0) / scoredChapters.length : 0, [scoredChapters])
  const maxTrend = useMemo(() => Math.max(1, ...trend.map((day) => day.attempts)), [trend])

  return (
    <div className="insights-view">
      <div style={{ marginBottom: '16px' }}>
        <div className="segmented">
          <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>
            全景洞察与盲点图谱
          </button>
          <button className={tab === 'inbox' ? 'active' : ''} onClick={() => setTab('inbox')}>
            Codex 批改与诊断回传 {data.inboxCount > 0 && <span className="nav-badge">{data.inboxCount}</span>}
          </button>
        </div>
      </div>

      {tab === 'inbox' && onStartRecommendation && onStartVariant ? (
        <InboxView notify={notify} onStartRecommendation={onStartRecommendation} onStartVariant={onStartVariant} />
      ) : (
        <>
          <div className="insight-summary">
            <div><span>近 14 天完成量</span><strong>{trend.reduce((sum, day) => sum + day.attempts, 0)}</strong><small>道 · 正确 {trend.reduce((sum, day) => sum + day.correct, 0)} 道</small></div>
            <div><span>连续学习</span><strong>{streak?.currentStreak ?? 0}</strong><small>天 · 最长 {streak?.bestStreak ?? 0} 天</small></div>
            <div><span>今日进度</span><strong>{data.todayDone}/{data.dailyProblemTarget}</strong><small>题 · {data.todayMinutes}/{data.dailyMinuteTarget} 分钟</small></div>
          </div>

    {/* 行动指引卡片 */}
    <div className="insight-action-card">
      <div className="insight-action-header">
        <Sparkles size={16} />
        <h4>今日行动指引与薄弱突破</h4>
      </div>
      <div className="insight-action-grid">
        {data.dueCount > 0 ? (
          <div className="insight-action-item">
            <div className="action-item-info">
              <strong>1. 优先清空到期复习</strong>
              <p>当前有 {data.dueCount} 道错题已到达记忆临界点，先复习再开新题</p>
              <div className="action-evidence"><span>依据：到期日</span><span>置信度：高</span><span>预计 {Math.max(5, data.dueCount * 4)} 分钟</span></div>
            </div>
            <button className="primary-button compact" onClick={onStartReview}>
              <TimerReset size={14} /> 立即清债 ({data.dueCount} 题)
            </button>
          </div>
        ) : (
          <div className="insight-action-item">
            <div className="action-item-info">
              <strong>1. 到期错题已清空</strong>
              <p>今日复习无欠债，建议继续推进今日推荐或新章节</p>
              <div className="action-evidence"><span>依据：复习队列为空</span><span>置信度：高</span><span>预计 20 分钟</span></div>
            </div>
            <button className="secondary-button compact" onClick={onStart}>
              <Zap size={14} /> 继续今日训练
            </button>
          </div>
        )}

        {radar && radar.weaknessTags.length > 0 && (
          <div className="insight-action-item">
            <div className="action-item-info">
              <strong>2. 攻坚薄弱知识「{radar.weaknessTags[0].tag}」</strong>
              <p>近期出现 {radar.weaknessTags[0].count} 次，建议调出 3 道真题巩固定理与技巧</p>
              <div className="action-evidence"><span>依据：{radar.weaknessTags[0].count} 条诊断</span><span>置信度：中</span><span>预计 18 分钟</span></div>
            </div>
            <button className="primary-button compact" onClick={() => onStartTagPractice(radar.weaknessTags[0].tag)}>
              <Sparkles size={14} /> 定向攻坚 3 题
            </button>
          </div>
        )}

        {radar && radar.errorTags.length > 0 && (
          <div className="insight-action-item">
            <div className="action-item-info">
              <strong>3. 修正高频错误「{radar.errorTags[0].tag}」</strong>
              <p>Codex 诊断提示该类偏差出现 {radar.errorTags[0].count} 次，加强条件审题与推导规范</p>
              <div className="action-evidence"><span>依据：已确认 Codex 标签</span><span>置信度：中</span><span>预计 15 分钟</span></div>
            </div>
            <button className="secondary-button compact" onClick={() => onStartTagPractice(radar.errorTags[0].tag)}>
              <Target size={14} /> 针对练习
            </button>
          </div>
        )}
      </div>
    </div>

    <section className="trend-card">
      <header><div><h3>每日完成量趋势</h3><p>柱高代表当天完成题数，绿色部分表示其中做对的题目。</p></div></header>
      <div className="trend-chart">{trend.map((day) => <div className="trend-col" key={day.date} title={`${day.date}\n完成 ${day.attempts} 道 · 正确 ${day.correct} 道`}><div className="trend-bar"><i style={{ height: `${Math.max(4, day.correct / maxTrend * 100)}%` }} /><b style={{ height: `${day.attempts / maxTrend * 100}%` }} /></div><span>{day.date.slice(5).replace('-', '/')}</span></div>)}</div>
    </section>
    <section className="subject-card">
      <header><h3>各科目统计</h3><p>作答数量、正确率与自评均分（按题目分类第一篇聚合）。</p></header>
      <div className="subject-list">{subjectStats.length === 0 ? <div className="empty-mini">还没有足够数据，完成几道题后再来看。</div> : subjectStats.map((item) => <div className="subject-row" key={item.name}><b>{item.name}</b><span>{item.attempts} 次作答</span><span>正确率 <strong>{Math.round(item.accuracy * 100)}%</strong></span><span>自评 <strong>{item.averageRating.toFixed(1)}</strong></span></div>)}</div>
    </section>
    {radar && <section className="radar-card">
      <header><div><h3>错因雷达</h3><p>最近 14 天 Codex 标注的错误类型与薄弱知识点，数字越大代表越常出现。</p></div></header>
      <div className="radar-columns">
        <div className="radar-group">
          <h4>错误类型</h4>
          {radar.errorTags.length === 0 ? <div className="empty-mini">还没有 Codex 批改数据</div> : radar.errorTags.slice(0, 8).map((stat) => (
            <div className="radar-row" key={stat.tag}>
              <span>{stat.tag}</span>
              <b>{stat.count}</b>
              <small>近 7 天 {stat.recentCount}</small>
              <button className="radar-tag-action" onClick={() => onStartTagPractice(stat.tag)} title={`调出「${stat.tag}」3 道针对练习题`}>攻坚</button>
            </div>
          ))}
        </div>
        <div className="radar-group">
          <h4>薄弱知识点</h4>
          {radar.weaknessTags.length === 0 ? <div className="empty-mini">还没有 Codex 批改数据</div> : radar.weaknessTags.slice(0, 8).map((stat) => (
            <div className="radar-row" key={stat.tag}>
              <span>{stat.tag}</span>
              <b>{stat.count}</b>
              <small>近 7 天 {stat.recentCount}</small>
              <button className="radar-tag-action" onClick={() => onStartTagPractice(stat.tag)} title={`调出「${stat.tag}」3 道针对练习题`}>攻坚</button>
            </div>
          ))}
        </div>
      </div>
      <div className="weakness-trend">
        <h4>薄弱知识点趋势（近 14 天）</h4>
        {radar.weaknessTags.slice(0, 4).map((tag) => {
          const max = Math.max(1, ...radar.trend.flatMap((point) => point.weaknessTags.filter((item) => item.tag === tag.tag).map((item) => item.count)))
          return <div className="trend-line" key={tag.tag}><span>{tag.tag}</span><div className="mini-bars">{radar.trend.map((point) => { const count = point.weaknessTags.find((item) => item.tag === tag.tag)?.count ?? 0; return <i key={point.date} style={{ height: `${Math.max(4, count / max * 100)}%` }} title={`${point.date}：${count}`} /> })}</div></div>
        })}
      </div>
    </section>}
    <section className="radar-card weekly-card">
      <header>
        <div><h3>学习周报</h3><p>汇总近 7 天的完成量、正确率、薄弱点与复习日程，生成可复制的 Markdown 周报。</p></div>
        <button className="primary-button compact" disabled={weeklyBusy || trend.length === 0} onClick={() => void buildWeekly()}>{weeklyBusy ? '生成中…' : '生成本周周报'}</button>
      </header>
      {weekly && <div className="weekly-report"><pre>{weekly}</pre><div className="weekly-actions"><button className="primary-button compact" onClick={() => void copyWeekly()}>复制周报</button></div></div>}
    </section>
    <div className="mastery-heading">
      <div><span>数一三科 · 掌握度地图</span><h2>从章节走进每个细小板块</h2><p>颜色代表当前掌握状态，面积只反映该板块的题量；掌握分会随近期表现和遗忘程度动态变化。</p></div>
      <div className="mastery-heading-actions">
        <div className="segmented mastery-switch"><button className={mode === 'treemap' ? 'active' : ''} onClick={() => setMode('treemap')}>矩形树图</button><button className={mode === 'chapters' ? 'active' : ''} onClick={() => setMode('chapters')}>章节视图</button></div>
        <div className="coverage-total"><strong>{scoredChapters.length ? Math.round(averageMastery) : '--'}</strong><span>综合掌握度</span><small>{scoredChapters.length ? `${scoredChapters.length} 个章节已评分` : '暂无足够数据'}</small></div>
      </div>
    </div>
    {mode === 'treemap' ? <MasteryTreemap chapters={chapters} nodes={nodes} select={setSelectedNode} /> : <div className="mastery-grid">{chapters.map((chapter, index) => {
      const state = chapter.attempted === 0 ? 'unseen' : chapter.masteryScore === null ? 'insufficient' : chapter.masteryScore >= 75 ? 'strong' : chapter.masteryScore >= 50 ? 'steady' : 'weak'
      const score = chapter.masteryScore === null ? null : Math.round(chapter.masteryScore)
      return <button key={chapter.id} className={`mastery-tile ${state} ${data.currentChapterId === chapter.id ? 'current' : ''}`} onClick={() => start(chapter)}>
        <div className="tile-head"><span>{chapter.rootName} · {String(index + 1).padStart(2, '0')}</span>{data.currentChapterId === chapter.id && <b>当前</b>}</div>
        <h3>{chapter.name}</h3><div className="tile-score">{score === null ? <strong>{chapter.attempted === 0 ? '未开始' : '数据不足'}</strong> : <><strong>{score}</strong><small>掌握分</small></>}</div>
        <div className="tile-progress"><i style={{ width: `${score ?? 0}%` }} /></div>
        <div className="tile-stats"><span>样本 <b>{Math.round(chapter.coverage * 100)}%</b></span><span>正确 <b>{chapter.accuracy === null ? '--' : `${Math.round(chapter.accuracy * 100)}%`}</b></span><span>自评 <b>{chapter.rating === null ? '--' : chapter.rating.toFixed(1)}</b></span></div>
        <div className="tile-evidence"><b>{chapter.evidenceLevel}</b><span>{chapter.attemptCount} 次可评分作答 · 来源 {chapter.evidenceSources.join('、') || '暂无'}</span></div>
        <div className="tile-alerts"><span>{chapter.dueCount} 到期</span><span>{chapter.weakCount} 薄弱</span><ChevronRight size={17} /></div>
      </button>
    })}</div>}
    {selectedNode && <div className="mastery-selection"><div><span>当前板块</span><b>{selectedNode.path.split(' / ').slice(1).join(' / ')}</b></div><div><span>证据等级</span><b>{selectedNode.evidenceLevel}</b></div><div><span>样本量</span><b>{selectedNode.attemptCount} 次 / {selectedNode.attempted} 题</b></div><div><span>证据来源</span><b>{selectedNode.evidenceSources.join('、') || '暂无'}</b></div><div><span>间隔重测</span><b>{selectedNode.retestCorrectCount} 次做对</b></div><div><span>正确率</span><b>{selectedNode.accuracy === null ? '--' : `${Math.round(selectedNode.accuracy * 100)}%`}</b></div><div><span>掌握分</span><b>{selectedNode.masteryScore === null ? '数据不足' : Math.round(selectedNode.masteryScore)}</b></div><button className="icon-button" title="关闭" aria-label="关闭掌握证据详情" onClick={() => setSelectedNode(null)}><X size={16} /></button></div>}
    <div className="mastery-legend"><span><i className="unseen" />未开始</span><span><i className="insufficient" />数据不足</span><span><i className="weak" />需要加强</span><span><i className="steady" />逐步稳定</span><span><i className="strong" />掌握良好</span></div>
    </>
  )}
  </div>
  )
}

function masteryState(node: MasteryNode) { return node.attempted === 0 ? 'unseen' : node.masteryScore === null ? 'insufficient' : node.masteryScore >= 75 ? 'strong' : node.masteryScore >= 50 ? 'steady' : 'weak' }

function MasteryTreemap({ chapters, nodes, select }: { chapters: MasteryChapter[]; nodes: MasteryNode[]; select: (node: MasteryNode) => void }) {
  const nodesByChapter = useMemo(() => {
    const map = new Map<number, MasteryNode[]>()
    for (const node of nodes) {
      const list = map.get(node.chapterId) ?? []
      list.push(node)
      map.set(node.chapterId, list)
    }
    return map
  }, [nodes])

  return <div className="treemap-board">{chapters.map((chapter) => {
    const chNodes = nodesByChapter.get(chapter.id) ?? []
    const depth3Nodes = chNodes.filter((n) => n.depth === 3)
    const visibleNodes = depth3Nodes.length > 0 ? depth3Nodes : chNodes.filter((n) => n.depth === 2)
    return <section className="treemap-chapter" key={chapter.id} style={{ flexGrow: Math.max(1, chapter.total) }}><header><b>{chapter.name}</b><span>{chapter.masteryScore === null ? (chapter.attempted ? '数据不足' : '未做') : Math.round(chapter.masteryScore)}</span></header><div className="treemap-cells">{visibleNodes.map((node) => <button key={node.id} className={`treemap-cell ${masteryState(node)}`} style={{ flexGrow: Math.max(1, node.total), flexBasis: `${Math.max(54, Math.sqrt(node.total) * 13)}px` }} title={`${node.path}\n样本 ${node.attempted}/${node.total}`} onClick={() => select(node)}><b>{node.name}</b><span>{node.masteryScore === null ? (node.attempted ? '数据不足' : '未做') : `${Math.round(node.masteryScore)}`}</span></button>)}</div></section>
  })}</div>
}

function SettingsView({
  data,
  refresh,
  isPureMode,
  onTogglePureMode,
  theme,
  onThemeChange,
  fontScale,
  onFontScaleChange,
  reducedMotion,
  onReducedMotionChange,
  notify,
}: {
  data: BootstrapData
  refresh: () => void
  isPureMode: boolean
  onTogglePureMode: () => void
  theme: 'light' | 'warm' | 'dark' | 'system'
  onThemeChange: (t: 'light' | 'warm' | 'dark' | 'system') => void
  fontScale: 'standard' | 'medium' | 'large'
  onFontScaleChange: (f: 'standard' | 'medium' | 'large') => void
  reducedMotion: boolean
  onReducedMotionChange: (r: boolean) => void
  notify: (s: string) => void
}) {
  const [mode, setMode] = useState(data.dailyMode)
  const [problems, setProblems] = useState(data.dailyProblemTarget)
  const [minutes, setMinutes] = useState(data.dailyMinuteTarget)
  const [intervals, setIntervals] = useState(data.reviewIntervals.length === 4 ? data.reviewIntervals : [1, 3, 7, 15])
  const [customExamDate, setCustomExamDate] = useState(() => {
    try {
      return localStorage.getItem('shuaba_target_exam_date') || ''
    } catch {
      return ''
    }
  })
  const [exporting, setExporting] = useState(false)
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [loadingBackups, setLoadingBackups] = useState(false)
  const [restoringPath, setRestoringPath] = useState<string | null>(null)
  const [audioMuted, setAudioMutedState] = useState(() => isAudioMuted())

  const loadBackups = useCallback(async () => {
    setLoadingBackups(true)
    try {
      const list = await listDatabaseBackups()
      setBackups(list)
    } catch {
      // ignore
    } finally {
      setLoadingBackups(false)
    }
  }, [])

  useEffect(() => {
    void loadBackups()
  }, [loadBackups])

  const submit = async () => {
    await saveGoal({ dailyMode: mode, dailyProblemTarget: problems, dailyMinuteTarget: minutes })
    try {
      if (customExamDate) {
        localStorage.setItem('shuaba_target_exam_date', customExamDate)
      } else {
        localStorage.removeItem('shuaba_target_exam_date')
      }
    } catch {
      // ignore
    }
    notify('训练目标与偏好已保存')
    refresh()
  }

  const saveIntervals = async () => {
    await saveReviewIntervals(intervals)
    notify('复习间隔已保存')
    refresh()
  }

  const exportNow = async () => {
    setExporting(true)
    try {
      const result = await exportRecords()
      notify(`备份完成：${result.dbPath}`)
      void loadBackups()
    } catch (error) {
      notify(`备份失败：${String(error)}`)
    } finally {
      setExporting(false)
    }
  }

  const handleRestore = async (backup: BackupInfo) => {
    if (!window.confirm(`确认恢复至备份「${backup.fileName}」？\n\n系统会在恢复前自动创建一份当前状态的安全快照，如需回退随时可用。`)) {
      return
    }
    setRestoringPath(backup.path)
    try {
      const res = await restoreDatabaseBackup(backup.path)
      notify(`数据库已成功恢复！安全快照位于：${res.preRestoreBackupPath}`)
      refresh()
      void loadBackups()
    } catch (e) {
      notify(`恢复失败：${String(e)}`)
    } finally {
      setRestoringPath(null)
    }
  }

  return (
    <div className="settings-view">
      <section>
        <div>
          <h2>模式与视觉偏好</h2>
          <p>纯净模式专为深度纸笔做题设计，隐藏战力等级、经验飞字与契约；RPG 模式保留升级闯关与连胜激励。</p>
        </div>
        <div className="setting-control">
          <label>主界面模式</label>
          <div className="segmented wide">
            <button className={!isPureMode ? 'active' : ''} onClick={() => { if (isPureMode) onTogglePureMode() }}>
              RPG 战力冒险
            </button>
            <button className={isPureMode ? 'active' : ''} onClick={() => { if (!isPureMode) onTogglePureMode() }}>
              纯净专注刷题 (快捷键 Alt+P)
            </button>
          </div>
        </div>

        <div className="setting-control" style={{ marginTop: '16px' }}>
          <label>主题色彩</label>
          <div className="segmented wide">
            {[
              ['system', '跟随系统'],
              ['light', '清爽浅色'],
              ['warm', '暖纸护眼'],
              ['dark', '暗色深沉'],
            ].map(([t, l]) => (
              <button key={t} className={theme === t ? 'active' : ''} onClick={() => onThemeChange(t as any)}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="setting-control" style={{ marginTop: '16px' }}>
          <label>字号缩放</label>
          <div className="segmented wide">
            {[
              ['standard', '标准 (100%)'],
              ['medium', '适中 (110%)'],
              ['large', '大号 (120%)'],
            ].map(([f, l]) => (
              <button key={f} className={fontScale === f ? 'active' : ''} onClick={() => onFontScaleChange(f as any)}>
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="setting-control" style={{ marginTop: '16px' }}>
          <label>减弱动态动效</label>
          <div className="segmented wide">
            <button className={!reducedMotion ? 'active' : ''} onClick={() => onReducedMotionChange(false)}>
              开启平滑过渡动效
            </button>
            <button className={reducedMotion ? 'active' : ''} onClick={() => onReducedMotionChange(true)}>
              减弱动效 (极致低延迟)
            </button>
          </div>
        </div>

        <div className="setting-control" style={{ marginTop: '16px' }}>
          <label>答题反馈音效</label>
          <div className="segmented wide">
            <button className={!audioMuted ? 'active' : ''} onClick={() => { setAudioMuted(false); setAudioMutedState(false) }}>
              开启音效
            </button>
            <button className={audioMuted ? 'active' : ''} onClick={() => { setAudioMuted(true); setAudioMutedState(true) }}>
              关闭音效
            </button>
          </div>
        </div>
      </section>

      <section>
        <div>
          <h2>考研目标与倒计时</h2>
          <p>初试倒计时在未配置时不会虚构天数；你可以随时自定义指定目标考试日期。</p>
        </div>
        <div className="numeric-settings">
          <label>
            自定义考研初试日期
            <input
              type="date"
              value={customExamDate}
              onChange={(e) => setCustomExamDate(e.target.value)}
              placeholder="留空则提示未设置"
            />
          </label>
          {customExamDate && (
            <button
              className="secondary-button compact"
              style={{ alignSelf: 'flex-end', marginBottom: '4px' }}
              onClick={() => {
                setCustomExamDate('')
                try { localStorage.removeItem('shuaba_target_exam_date') } catch {}
                notify('已清除自定义考研日期')
              }}
            >
              清除考研日
            </button>
          )}
        </div>
      </section>

      <section>
        <div>
          <h2>每日训练目标 (SQLite 同步源)</h2>
          <p>题数和时长可以同时启用，作为今日心流契约与每日进度的唯一基准真相。</p>
        </div>
        <div className="setting-control">
          <label>目标模式</label>
          <div className="segmented wide">
            {[
              ['problems', '固定题数'],
              ['minutes', '固定时长'],
              ['both', '两种都看'],
            ].map(([v, l]) => (
              <button key={v} className={mode === v ? 'active' : ''} onClick={() => setMode(v as typeof mode)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="numeric-settings">
          <label>
            每日题数
            <input type="number" min="1" max="200" value={problems} onChange={(e) => setProblems(Number(e.target.value))} />
          </label>
          <label>
            每日分钟
            <input type="number" min="5" max="600" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
          </label>
        </div>
        <button className="primary-button compact" onClick={submit}>
          保存目标与偏好
        </button>
      </section>

      <section>
        <div>
          <h2>复习间隔</h2>
          <p>四档自评对应的下次复习天数。冲刺阶段可以压缩到更短节奏。</p>
        </div>
        <div className="numeric-settings four">
          <label>
            不会
            <input
              type="number"
              min="1"
              max="180"
              value={intervals[0]}
              onChange={(e) => setIntervals([Number(e.target.value), intervals[1], intervals[2], intervals[3]])}
            />
          </label>
          <label>
            模糊
            <input
              type="number"
              min="1"
              max="180"
              value={intervals[1]}
              onChange={(e) => setIntervals([intervals[0], Number(e.target.value), intervals[2], intervals[3]])}
            />
          </label>
          <label>
            会做
            <input
              type="number"
              min="1"
              max="180"
              value={intervals[2]}
              onChange={(e) => setIntervals([intervals[0], intervals[1], Number(e.target.value), intervals[3]])}
            />
          </label>
          <label>
            熟练
            <input
              type="number"
              min="1"
              max="180"
              value={intervals[3]}
              onChange={(e) => setIntervals([intervals[0], intervals[1], intervals[2], Number(e.target.value)])}
            />
          </label>
        </div>
        <button className="primary-button compact" onClick={saveIntervals}>
          保存间隔
        </button>
      </section>

      <section>
        <div>
          <h2>本地数据、滚动备份与恢复</h2>
          <p>大观园题库源只读；学习记录保存在本机 SQLite 数据库中。启动时自动创建滚动备份，恢复时自动生成安全快照。</p>
        </div>
        <dl>
          <dt>大观园题库</dt>
          <dd>{data.libraryDir}</dd>
          <dt>学习数据库</dt>
          <dd>{data.dataDir}</dd>
          <dt>Codex 收件箱</dt>
          <dd>{data.inboxDir}</dd>
          <dt>异常时长隔离</dt>
          <dd>已过滤 {data.excludedDurationCount ?? 0} 条异常时长记录（不计入今日/总时长）</dd>
          <dt>数据库奖励账本</dt>
          <dd>已持久化 {data.rewardEventsCount ?? 0} 条奖励事件（保证幂等与真实性）</dd>
        </dl>
        <div className="setting-actions" style={{ marginBottom: '16px' }}>
          <button className="primary-button compact" disabled={exporting} onClick={exportNow}>
            {exporting ? <LoaderCircle className="spin" size={15} /> : <Archive size={15} />} 手动导出备份（数据库 + JSON v0.7.0）
          </button>
          <span>备份文件保存在 {data.dataDir}\backups</span>
        </div>

        {loadingBackups ? (
          <div><LoaderCircle className="spin" size={16} /> 正在检索备份...</div>
        ) : backups.length > 0 ? (
          <div style={{ overflowX: 'auto', marginTop: '12px' }}>
            <table className="backup-table">
              <thead>
                <tr>
                  <th>备份文件</th>
                  <th>类型</th>
                  <th>创建时间</th>
                  <th>大小</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {backups.slice(0, 10).map((b) => (
                  <tr key={b.path}>
                    <td><code>{b.fileName}</code></td>
                    <td>{b.backupType === 'rolling' ? '滚动自动备份' : b.backupType === 'pre_restore' ? '恢复前安全快照' : '手动导出'}</td>
                    <td>{b.createdAt.slice(0, 19).replace('T', ' ')}</td>
                    <td>{Math.round(b.sizeBytes / 1024)} KB</td>
                    <td>
                      <button
                        className="backup-restore-btn"
                        disabled={restoringPath === b.path}
                        onClick={() => void handleRestore(b)}
                      >
                        {restoringPath === b.path ? '正在恢复...' : '恢复此版本'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>暂无可用备份文件</p>
        )}
      </section>

      <section>
        <div>
          <h2>隐私与 AI</h2>
          <p>刷题、推荐和复习完全离线。只有你主动把草稿发给 Codex 时，图片才会进入对应的 Codex 任务。</p>
        </div>
        <div className="privacy-line">
          <span className="status-dot" />
          <span>本地优先离线可用模式已启用</span>
        </div>
      </section>
    </div>
  )
}

function EmptyState({ icon: Icon, title, text }: { icon: typeof Inbox; title: string; text: string }) { return <div className="empty-state"><Icon size={28}/><h3>{title}</h3><p>{text}</p></div> }
function Toast({ text, close }: { text: string; close: () => void }) { useEffect(()=>{const t=setTimeout(close,3500);return()=>clearTimeout(t)},[close]); return <motion.div className="toast" initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}}><Check size={16}/><span>{text}</span><button onClick={close} aria-label="关闭提示"><X size={15}/></button></motion.div> }

export default App
