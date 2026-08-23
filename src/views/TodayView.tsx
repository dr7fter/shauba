import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  BookMarked,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FolderSearch,
  Flame,
  Heart,
  HelpCircle,
  History,
  Layers,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Minus,
  Pause,
  PenLine,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Target,
  TimerReset,
  X,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  clearPracticeSession,
  createCodexTask,
  getDailyLog,
  getEloStatus,
  getRecommendations,
  getSessionScoreboard,
  recordAttempt,
  saveNote,
  savePracticeSession,
  setCurrentChapter,
  setFocusBranches,
  toggleFavorite,
  undoLastAttempt,
} from '../api'
import { playCorrectSound } from '../data/audio'
import {
  clampAttemptDuration,
  determineAttemptEvidence,
} from '../domain/evidence'
import {
  csRankForElo,
  formatElapsed,
  formatTimer,
  getPaceEvaluation,
  localToday,
  normalizeAnswer,
} from '../utils'
import { MathText } from '../components/MathText'
import { QuestionImages } from '../components/QuestionImages'
import { SessionScoreboardModal } from '../components/SessionScoreboardModal'
import { useBlitzMode } from '../hooks/useBlitzMode'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { usePressureMode } from '../hooks/usePressureMode'
import type { BlitzExamResult } from '../data/motivation'
import type {
  AttemptMode,
  AttemptOutcome,
  BootstrapData,
  CodexTask,
  ErrorBreakpoint,
  Question,
  RecommendedQuestion,
  SessionScoreboard,
  View,
} from '../types'

export const reasonLabels: Record<string, string> = {
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

export const ratingOptions = [
  { value: 1, label: '1 · 没思路', hint: '概念边界不清 / 盲区' },
  { value: 2, label: '2 · 没做完', hint: '方向对但卡在推导计算' },
  { value: 3, label: '3 · 稍有迟疑', hint: '解题完整 / 略有犹豫' },
  { value: 4, label: '4 · 流畅秒杀', hint: '一眼看透 / 一气呵成' },
]

export const BREAKPOINTS: ErrorBreakpoint[] = [
  { id: 'concept', label: '概念边界', desc: '定义/定理前提条件不清晰' },
  { id: 'strategy', label: '策略选择', desc: '解题方向/突破口选用错误' },
  { id: 'calc', label: '推导计算', desc: '符号/代数/积分求导计算失误' },
  { id: 'condition', label: '条件遗漏', desc: '忽略隐式前提/正负号/区间' },
  { id: 'check', label: '审题偏差', desc: '看错题目问法/变量含义' },
]

export function TodayView({
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
  onBlitzFinish,
  onOpenPressureReport,
  pressureReportLoading,
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
  onBlitzFinish: (res: BlitzExamResult) => void
  onOpenPressureReport: (sessionId: string) => Promise<boolean>
  pressureReportLoading: boolean
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
  const [lastSubmitted, setLastSubmitted] = useState<{
    questionId: number
    index: number
    reasonCode: string
    correct?: boolean
  } | null>(null)
  const [task, setTask] = useState<CodexTask | null>(null)
  const [mobileQueueOpen, setMobileQueueOpen] = useState(false)
  const submittingRef = useRef(false)
  const undoAppliedRef = useRef(false)
  const [sessionTotalCount, setSessionTotalCount] = useState(0)
  const [sessionCorrectCount, setSessionCorrectCount] = useState(0)
  const [showAchievementCard, setShowAchievementCard] = useState(false)
  const [eloFlash, setEloFlash] = useState<{
    delta: number
    current: number
    rankName: string
    rankColor: string
    streak: number
    protectionLeft: number
    calibrated: boolean
    settlements: number
  } | null>(null)
  const [scoreboard, setScoreboard] = useState<SessionScoreboard | null>(null)
  const [achievementData, setAchievementData] = useState<{
    correct: boolean
    duration: number
    todayProgress: { done: number; target: number }
    correctCount: number
    totalCount: number
    yesterdayDone?: number
    milestone?: number
  } | null>(null)
  const [yesterdayCount, setYesterdayCount] = useState<number | null>(null)

  // Active on-screen timer (caps at 1800 seconds = 30 minutes)
  const activeDurationMsRef = useRef<number>(0)
  const lastActiveTickRef = useRef<number>(Date.now())
  const isTabVisibleRef = useRef<boolean>(
    typeof document !== 'undefined' ? document.visibilityState === 'visible' : true
  )

  // Per-question dedicated timer window state
  const [questionElapsedSec, setQuestionElapsedSec] = useState(0)
  const [isQuestionTimerPaused, setIsQuestionTimerPaused] = useState(false)
  // 未按下「开始作答」前不计时，避免进入 app / 换题就自动走表
  const [isQuestionTimerStarted, setIsQuestionTimerStarted] = useState(false)
  const [settledDuration, setSettledDuration] = useState<number | null>(null)

  const resetActiveTimer = useCallback(() => {
    activeDurationMsRef.current = 0
    lastActiveTickRef.current = Date.now()
  }, [])

  const startQuestionTimer = useCallback(() => {
    lastActiveTickRef.current = Date.now()
    setIsQuestionTimerStarted(true)
    setIsQuestionTimerPaused(false)
  }, [])

  const replaceQueue = useCallback(
    (next: RecommendedQuestion[]) => onQueueChange(next),
    [onQueueChange]
  )

  // Hook 1: Blitz Mode
  const { isBlitzMode, handleBlitzAttempt } = useBlitzMode({
    queue,
    index,
    onBlitzFinish,
  })

  // Hook 2: Pressure Simulation Mode
  const {
    pressureMode,
    isPressurePaused,
    pressureSession,
    showPressurePrompt,
    setShowPressurePrompt,
    showPressureResult,
    pressureSessionStartTime,
    pressureClock,
    batchTask,
    pressureResumeElapsedRef,
    pressureQuestionStartedAtRef,
    startPressureMode,
    confirmPressureMode,
    togglePressurePause,
    submitPressureQuestion,
    retryPressureBatchTask,
    exitPressureFocus,
    abandonPressureMode,
    closePressureResult,
    copyPrompt,
  } = usePressureMode({
    queue,
    index,
    setIndex,
    setSelected,
    resetActiveTimer,
    setQuestionElapsedSec,
    isZenMode,
    onToggleZen,
    notify,
    replaceQueue,
    onQueueChange,
    refresh,
  })

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

  const benchmarkSec = useMemo(() => {
    if (!current) return 600
    switch (current.questionType) {
      case 'single_choice':
        return 180
      case 'multiple_choice':
        return 240
      default:
        return 600
    }
  }, [current])

  const benchmarkLabel = useMemo(() => {
    if (!current) return '解答/证明 10分'
    switch (current.questionType) {
      case 'single_choice':
        return '单选 3分'
      case 'multiple_choice':
        return '多选 4分'
      default:
        return '解答/证明 10分'
    }
  }, [current])

  useEffect(() => {
    if (pressureMode) {
      if (isPressurePaused) return
      const updatePressureClock = () => {
        const elapsed = Math.floor((Date.now() - pressureQuestionStartedAtRef.current) / 1000)
        setQuestionElapsedSec(Math.min(1800, Math.max(0, elapsed)))
      }
      updatePressureClock()
      const id = window.setInterval(updatePressureClock, 1000)
      return () => window.clearInterval(id)
    }
    // 高压/闪击是用户主动开局，自动计时；日常刷题需要先按「开始作答」
    if (
      revealed ||
      isQuestionTimerPaused ||
      (!isQuestionTimerStarted && !isBlitzMode)
    ) {
      return
    }
    const id = window.setInterval(() => {
      if (isTabVisibleRef.current) {
        setQuestionElapsedSec((prev) => Math.min(1800, prev + 1))
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [revealed, isQuestionTimerStarted, isQuestionTimerPaused, pressureMode, isPressurePaused, isBlitzMode, currentQuestionId, pressureQuestionStartedAtRef])

  // Keyboard shortcut for Pressure Mode Pause (P / Space)
  useEffect(() => {
    if (!pressureMode) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      if (tag === 'input' || tag === 'textarea') return
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        togglePressurePause()
      } else if (isPressurePaused && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        togglePressurePause()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pressureMode, isPressurePaused, togglePressurePause])

  useEffect(() => {
    onActiveQuestionChange(current ?? null)
  }, [current, onActiveQuestionChange])

  useEffect(() => {
    if (undoAppliedRef.current) {
      undoAppliedRef.current = false
    }
    resetActiveTimer()
    const resumedElapsed = pressureResumeElapsedRef.current
    pressureResumeElapsedRef.current = null
    const initialElapsed = resumedElapsed ?? 0
    pressureQuestionStartedAtRef.current = Date.now() - initialElapsed * 1000
    setQuestionElapsedSec(initialElapsed)
    setIsQuestionTimerPaused(false)
    setIsQuestionTimerStarted(false)
    setSettledDuration(null)
    setSelected([])
    setRevealed(false)
    setOutcome(null)
    setRating(null)
    setBreakpointTag(null)
    setRepairNote('')
    setRepairNoteSaved(false)
    setTask(null)
  }, [currentQuestionId, resetActiveTimer, pressureQuestionStartedAtRef, pressureResumeElapsedRef])

  useEffect(() => {
    const fetchYesterdayData = async () => {
      try {
        const log = await getDailyLog()
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayKey = localToday(yesterday)
        setYesterdayCount(log.days.find((day) => day.date === yesterdayKey)?.count ?? 0)
      } catch {
        setYesterdayCount(null)
      }
    }
    void fetchYesterdayData()
  }, [])

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

  const isSelectedMatch =
    current && current.questionType !== 'subjective' && revealed && selected.length > 0
      ? normalizeAnswer(selected.join('')) === normalizeAnswer(current.correctAnswer)
      : null

  const goalProblemsProgress =
    data.dailyMode === 'minutes'
      ? null
      : Math.min(100, (data.todayDone / data.dailyProblemTarget) * 100)
  const goalMinutesProgress =
    data.dailyMode === 'problems'
      ? null
      : Math.min(100, (data.todayMinutes / data.dailyMinuteTarget) * 100)
  const queueTitle =
    attemptMode === 'review'
      ? '错题复习队列'
      : activeBatch
      ? 'AI 题组'
      : data.currentFocusCategoryIds && data.currentFocusCategoryIds.length > 0
      ? '专项训练队列'
      : data.currentChapterName
      ? '本章队列'
      : '智能队列'
  const contextStep = !revealed ? 1 : rating === null ? 3 : 4

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

      if (repairNote.trim() && !repairNoteSaved) {
        void saveNote(current.id, repairNote.trim())
      }

      if (isTabVisibleRef.current) {
        const now = Date.now()
        const delta = Math.max(0, now - lastActiveTickRef.current)
        activeDurationMsRef.current = Math.min(1800000, activeDurationMsRef.current + delta)
        lastActiveTickRef.current = now
      }
      const rawSeconds =
        settledDuration ??
        clampAttemptDuration(
          questionElapsedSec || Math.round(activeDurationMsRef.current / 1000)
        )
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

      if (correct) playCorrectSound()

      // CS-Premier 风格结算反馈：每题都是一场比赛
      if (finalOutcome !== 'uncertain') {
        void getEloStatus()
          .then((status) => {
            if (status.lastDelta === null) return
            const rank = csRankForElo(status.current)
            setEloFlash({
              delta: status.lastDelta,
              current: status.current,
              rankName: rank.name,
              rankColor: rank.color,
              streak: status.streak,
              protectionLeft: status.protectionLeft,
              calibrated: status.calibrated,
              settlements: status.settlements,
            })
            window.setTimeout(() => setEloFlash(null), 4000)
          })
          .catch(() => undefined)
      }

      handleBlitzAttempt(correct, current.id)

      if (!isBlitzMode) {
        const nextSessionTotal = sessionTotalCount + 1
        const nextSessionCorrect = sessionCorrectCount + (correct ? 1 : 0)
        setSessionTotalCount(nextSessionTotal)
        setSessionCorrectCount(nextSessionCorrect)
        const newTodayDone = data.todayDone + 1

        let milestone: number | undefined
        const milestones = [5, 10, 20, 30, 50]
        for (const m of milestones) {
          if (data.todayDone < m && newTodayDone >= m) {
            milestone = m
            break
          }
        }

        const achievementPayload = {
          correct,
          duration: durationSeconds,
          todayProgress: { done: newTodayDone, target: data.dailyProblemTarget },
          correctCount: nextSessionCorrect,
          totalCount: nextSessionTotal,
          yesterdayDone: yesterdayCount ?? undefined,
          milestone,
        }
        setAchievementData(achievementPayload)
        setShowAchievementCard(true)

        setTimeout(
          () => {
            setShowAchievementCard(false)
          },
          milestone ? 4000 : 3000
        )
      }

      const remaining = queue.filter((item) => item.question.id !== current.id)
      replaceQueue(remaining)
      if (remaining.length) {
        setIndex(Math.min(index, remaining.length - 1))
      } else if (!isBlitzMode && finalOutcome !== 'uncertain') {
        // 一组打完弹出 CS 风格赛后战绩面板
        void getSessionScoreboard(null)
          .then((sb) => {
            if (sb.totalCount > 0) setScoreboard(sb)
          })
          .catch(() => undefined)
      }
      setLastSubmitted({
        questionId: current.id,
        index,
        reasonCode: queue[index].reasonCode,
        correct,
      })
      void refresh()
    } finally {
      submittingRef.current = false
    }
  }

  const undo = async () => {
    if (!lastSubmitted) {
      notify('还没有可以撤销的提交')
      return
    }
    try {
      const restored = await undoLastAttempt(lastSubmitted.questionId)
      const reitem: RecommendedQuestion = {
        question: restored,
        score: queue[index]?.score ?? 100,
        reason: `${reasonLabels[lastSubmitted.reasonCode] ?? '智能推荐'} · 刚才撤销，重新评定`,
        reasonCode: lastSubmitted.reasonCode as any,
      }
      const position = Math.min(lastSubmitted.index, queue.length)
      const next = [...queue]
      next.splice(position, 0, reitem)
      replaceQueue(next)
      undoAppliedRef.current = true
      setSessionTotalCount((prev) => Math.max(0, prev - 1))
      if (lastSubmitted.correct) {
        setSessionCorrectCount((prev) => Math.max(0, prev - 1))
      }
      resetActiveTimer()
      setIndex(position)
      setRevealed(true)
      setRating(null)
      setOutcome(null)
      setSelected([])
      setLastSubmitted(null)
      notify('已撤销刚才的提交，可以重新评定')
      void refresh()
    } catch (error) {
      notify(`撤销失败：${String(error)}`)
    }
  }

  const skip = useCallback(() => {
    if (!queue.length) return
    const skipped = queue[index]
    const rest = queue.filter((item) => item.question.id !== skipped.question.id)
    const next = [...rest, skipped]
    replaceQueue(next)
    resetActiveTimer()
    setQuestionElapsedSec(0)
    setIsQuestionTimerPaused(false)
    setSettledDuration(null)
    setSelected([])
    setRating(null)
    setOutcome(null)
    setRevealed(false)
    setTask(null)
    notify('已跳过本题，稍后它会回到队列末尾')
  }, [queue, index, replaceQueue, resetActiveTimer, notify])

  const reveal = useCallback(() => {
    if (!revealed) {
      // 未按开始就翻答案时，退回到本题在场时间，避免 1 秒极速假象
      const finalSec = clampAttemptDuration(
        questionElapsedSec || Math.round(activeDurationMsRef.current / 1000) || 1
      )
      setSettledDuration(finalSec)
      setRevealed(true)
      if (selected.length > 0 && current && current.questionType !== 'subjective') {
        const match =
          normalizeAnswer(selected.join('')) === normalizeAnswer(current.correctAnswer)
        setOutcome(match ? 'correct' : 'wrong')
      }
    }
  }, [revealed, questionElapsedSec, current, selected])

  const chooseRating = useCallback(
    (value: number) => {
      if (revealed) {
        setRating(value)
        if (!outcome && current && current.questionType !== 'subjective' && isSelectedMatch !== null) {
          setOutcome(isSelectedMatch ? 'correct' : 'wrong')
        }
      }
    },
    [revealed, outcome, current, isSelectedMatch]
  )

  const activateWithKeyboard = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    action: () => void
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      action()
    }
  }

  const submitIfReady = useCallback(() => {
    if (revealed && rating !== null && current) void submit()
  }, [revealed, rating, current])

  const previousQuestion = useCallback(() => {
    if (index > 0) setIndex(index - 1)
  }, [index])

  const nextQuestion = useCallback(() => {
    if (index < queue.length - 1) setIndex(index + 1)
  }, [index, queue.length])

  // Hook 3: Single-key shortcuts
  useKeyboardShortcuts({
    reveal,
    submitIfReady,
    chooseRating,
    toggleOption: (opt: string) => {
      if (!current || current.questionType === 'subjective') return
      setSelected((prev) =>
        current.questionType === 'multiple_choice'
          ? prev.includes(opt)
            ? prev.filter((x) => x !== opt)
            : [...prev, opt].sort()
          : [opt]
      )
    },
    skip,
    startVariant: () => {
      if (current) onStartVariant(current.id)
    },
    previousQuestion,
    nextQuestion,
    revealed,
  })

  const createTask = async () => {
    if (!current) return
    try {
      const created = await createCodexTask(current.id)
      setTask(created)
      await copyPrompt(created)
      notify('已生成并复制 Codex 任务说明；拍下草稿在 Codex 中粘贴即可')
    } catch (error) {
      notify(`生成 Codex 任务失败：${String(error)}`)
    }
  }

  if (!current) {
    if (isBlitzMode) {
      return (
        <div className="queue-completion-wrap">
          <div className="queue-completion-card">
            <div className="completion-badge blitz">
              <Zap size={28} />
            </div>
            <h2>⚡ 15分钟真题闪击战已完成！</h2>
            <p>本轮闪击战作答与成绩已记录完毕。你可以选择再战一组，或返回日常智能推荐。</p>
            <div className="completion-actions">
              <button className="primary-button" onClick={onStartBlitz}>
                <Zap size={16} /> 再来一组闪击战
              </button>
              <button
                className="secondary-button"
                onClick={async () => {
                  const next = await getRecommendations(12)
                  replaceQueue(next)
                  setIndex(0)
                }}
              >
                <RotateCcw size={16} /> 返回今日智能队列
              </button>
            </div>
          </div>
        </div>
      )
    }
    if (
      data.currentChapterName ||
      (data.currentFocusCategoryIds && data.currentFocusCategoryIds.length > 0)
    ) {
      const focusName = data.currentChapterName
        ? `章节首轮 · ${data.currentChapterName}`
        : `专项多分支 (${data.currentFocusCategoryIds?.length ?? 0} 个考点)`
      return (
        <div className="queue-completion-wrap">
          <div className="queue-completion-card">
            <div className="completion-badge focus">
              <Target size={28} />
            </div>
            <h2>🎯 专项训练已完成！</h2>
            <p>
              你已完成 <b>{focusName}</b> 队列中的所有考点真题。可以继续加练本考点，或退出专项返回日常队列。
            </p>
            <div className="completion-actions">
              <button
                className="primary-button"
                onClick={async () => {
                  void refresh()
                  notify('已刷新专项题目')
                }}
              >
                <RotateCcw size={16} /> 刷新本考点继续加练
              </button>
              <button
                className="secondary-button"
                onClick={async () => {
                  await setCurrentChapter(null)
                  await setFocusBranches([])
                  const next = await getRecommendations(12)
                  replaceQueue(next)
                  void refresh()
                  notify('已退出专项，回到今日智能推荐队列')
                }}
              >
                退出专项回到今日推荐
              </button>
              <button className="secondary-button quiet" onClick={() => setView('library')}>
                选择其他考点
              </button>
            </div>
          </div>
        </div>
      )
    }
    if (attemptMode === 'review') {
      return (
        <div className="queue-completion-wrap">
          <div className="queue-completion-card">
            <div className="completion-badge review">
              <TimerReset size={28} />
            </div>
            <h2>✨ 今日错题复习全部通过！</h2>
            <p>你已经攻克了今天所有的到期错题，复习间隔已自动后延。</p>
            <div className="completion-actions">
              <button
                className="primary-button"
                onClick={() => {
                  onQueueChange(data.recommendations)
                  setIndex(0)
                  setView('today')
                }}
              >
                <Zap size={16} /> 开始今日智能练习
              </button>
              <button className="secondary-button" onClick={() => setView('library')}>
                <BookOpen size={16} /> 浏览全部题库
              </button>
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="queue-completion-wrap">
        <div className="queue-completion-card">
          <div className="completion-badge normal">
            <Check size={28} />
          </div>
          <h2>🎉 今日推荐队列已完成！</h2>
          <p>
            今日已完成 <strong>{data.todayDone}</strong> 题{' '}
            {data.dailyProblemTarget > 0 && `(目标 ${data.dailyProblemTarget} 题)`} · 累计{' '}
            <strong>{data.todayMinutes}</strong> 分钟
          </p>
          <div className="completion-actions">
            <button
              className="primary-button"
              onClick={async () => {
                const next = await getRecommendations(12)
                replaceQueue(next)
                setIndex(0)
                notify('已载入新一组智能推荐题目')
              }}
            >
              <Sparkles size={16} /> 继续加练一组 (12 题)
            </button>
            <button className="secondary-button" onClick={() => setView('review')}>
              <History size={16} /> 查看今日作答回顾
            </button>
            <button
              className="secondary-button quiet"
              onClick={() => setView('library')}
            >
              <FolderSearch size={16} /> 题库自由选题
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="today-layout">
      <section className="queue-panel">
        <div className="progress-head">
          <span>
            <b>今日进度</b>
            <small>完成后自动承接下一题</small>
          </span>
          <strong>
            {data.dailyMode === 'minutes'
              ? `${data.todayMinutes}/${data.dailyMinuteTarget} 分钟`
              : data.dailyMode === 'both'
              ? `${data.todayDone}/${data.dailyProblemTarget} 题 · ${data.todayMinutes}/${data.dailyMinuteTarget} 分`
              : `${data.todayDone}/${data.dailyProblemTarget} 题`}
          </strong>
        </div>
        <div className="progress-track">
          <motion.div
            animate={{ width: `${goalProblemsProgress ?? goalMinutesProgress ?? 0}%` }}
          />
        </div>
        {data.dailyMode === 'both' && (
          <div className="progress-track secondary">
            <motion.div animate={{ width: `${goalMinutesProgress ?? 0}%` }} />
          </div>
        )}
        {data.dailyMode === 'both' && (
          <div className="progress-caption dual">
            <span>
              <i /> {Math.round(goalProblemsProgress ?? 0)}% 题数
            </span>
            <span>
              <i /> {Math.round(goalMinutesProgress ?? 0)}% 分钟
            </span>
          </div>
        )}
        {data.todayDone > 0 && (
          <button
            className="today-done-pill"
            onClick={() => setView('review')}
            title="查看今日已做题目的卡片与 Codex 点评"
          >
            <History size={13} />
            <span>
              今日已做 <b>{data.todayDone}</b> 题（查看回顾）
            </span>
          </button>
        )}
        <div className="queue-quick-actions">
          <button
            className="blitz-mode-start-btn"
            onClick={onStartBlitz}
            title="开启 15 分钟 4 道真题高压模拟考"
          >
            <Zap size={14} /> 15分钟真题闪击战
          </button>
          <button
            className="pressure-mode-start-btn"
            onClick={startPressureMode}
            title="真实考试模拟：不显示答案，全部完成后由 Codex 批改"
          >
            <Target size={14} /> 压力模拟
          </button>
          <button
            className={`zen-toggle-mini-btn ${isZenMode ? 'active' : ''}`}
            onClick={onToggleZen}
            title="切换沉浸专注模式 (Alt+Z)"
          >
            {isZenMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isZenMode ? '退出专注' : '专注模式'}</span>
          </button>
        </div>
        {activeBatch ? (
          <div className="ai-plan-banner">
            <Sparkles size={15} />
            <span>
              <b>{activeBatch.title}</b>
              <small>
                AI 题组 · 剩余 {activeBatch.remainingCount}/{activeBatch.totalCount} 题
              </small>
            </span>
          </div>
        ) : data.currentFocusCategoryIds && data.currentFocusCategoryIds.length > 0 ? (
          <div className="chapter-mode">
            <Target size={15} />
            <span>
              <b>专项多分支训练</b>
              <small>已选 {data.currentFocusCategoryIds.length} 个考点</small>
            </span>
          </div>
        ) : data.currentChapterName ? (
          <div className="chapter-mode">
            <Target size={15} />
            <span>
              <b>{data.currentChapterName}</b>
              <small>章节首轮</small>
            </span>
          </div>
        ) : null}
        <div className="queue-title">
          <span>
            <b>{queueTitle}</b>
            <small>连续刷题 · 按顺序推进</small>
          </span>
          <strong>
            {queue.length}
            <small>剩余</small>
          </strong>
        </div>
        <div className="queue-list">
          {queue.map((item, i) => (
            <button
              key={item.question.id}
              className={i === index ? 'queue-item active' : 'queue-item'}
              onClick={() => setIndex(i)}
              aria-current={i === index ? 'step' : undefined}
            >
              <span className="queue-number">{String(i + 1).padStart(2, '0')}</span>
              <span className="queue-item-copy">
                <b>{item.question.categoryPath.split(' / ').slice(-2).join(' · ')}</b>
                <small>
                  #{item.question.id} · {reasonLabels[item.reasonCode] ?? '智能推荐'}
                </small>
              </span>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
        <button className="quiet-command" onClick={() => setView('library')}>
          <FolderSearch size={16} /> 手动找题
        </button>
      </section>

      <section className="question-workspace">
        <div className="question-meta">
          <button
            className="mobile-queue-trigger"
            onClick={() => setMobileQueueOpen(true)}
            aria-label="打开当前训练队列"
          >
            <Layers size={15} /> 队列 {queue.length}
          </button>
          {isZenMode && (
            <button
              className="zen-meta-exit-btn"
              onClick={onToggleZen}
              title="退出沉浸专注模式 (Alt+Z)"
              aria-label="退出沉浸专注模式"
            >
              <Minimize2 size={14} />
              <span>退出专注</span>
            </button>
          )}
          <span className={`reason-chip ${queue[index].reasonCode}`}>
            {reasonLabels[queue[index].reasonCode] ?? '智能推荐'}
          </span>
          <span>{current.source}</span>
          <span>
            难度 {'●'.repeat(current.difficulty)}
            {'○'.repeat(Math.max(0, 3 - current.difficulty))}
          </span>
          <button
            className={current.favorite ? 'favorite active' : 'favorite'}
            title="收藏"
            aria-label={current.favorite ? '取消收藏' : '收藏本题'}
            onClick={async () => {
              const nextFav = await toggleFavorite(current.id)
              const updated = queue.map((item, i) =>
                i === index
                  ? { ...item, question: { ...item.question, favorite: nextFav } }
                  : item
              )
              replaceQueue(updated)
            }}
          >
            <Heart size={18} fill={current.favorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        <AnimatePresence>
          {mobileQueueOpen && (
            <motion.div
              className="ui-overlay mobile-practice-queue-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileQueueOpen(false)}
            >
              <motion.aside
                className="ui-drawer mobile-practice-queue"
                initial={{ x: -320 }}
                animate={{ x: 0 }}
                exit={{ x: -320 }}
                onClick={(event) => event.stopPropagation()}
                aria-label="当前训练队列"
              >
                <header>
                  <div>
                    <strong>当前训练队列</strong>
                    <span>{queue.length} 道待完成</span>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => setMobileQueueOpen(false)}
                    aria-label="关闭当前训练队列"
                  >
                    <X size={18} />
                  </button>
                </header>
                <div className="mobile-practice-queue-list">
                  {queue.map((item, itemIndex) => (
                    <button
                      key={item.question.id}
                      className={itemIndex === index ? 'active' : ''}
                      onClick={() => {
                        setIndex(itemIndex)
                        setMobileQueueOpen(false)
                      }}
                    >
                      <span>{String(itemIndex + 1).padStart(2, '0')}</span>
                      <div>
                        <b>{item.question.categoryPath.split(' / ').slice(-2).join(' · ')}</b>
                        <small>
                          #{item.question.id} ·{' '}
                          {reasonLabels[item.reasonCode] ?? item.reason}
                        </small>
                      </div>
                      <ChevronRight size={15} />
                    </button>
                  ))}
                </div>
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="recommend-reason practice-context-bar">
          <div className="practice-context-copy">
            <Sparkles size={15} />
            <span>
              <b>{attemptMode === 'review' ? '复习模式' : '连续训练'}</b>
              <small>{queue[index].reason}</small>
            </span>
          </div>
          <div className="practice-context-progress">
            <strong>{index + 1}</strong>
            <span>/ {queue.length} 题</span>
            <i>·</i>
            <span>
              {contextStep === 1
                ? '先在纸上完成'
                : contextStep === 3
                ? '已看答案，待自评'
                : '已自评，记录后进入下一题'}
            </span>
          </div>
        </div>
        <article className="question-content">
          <div className="question-index">
            第 {index + 1} 题 <span>#{current.id}</span>
          </div>

          {/* Per-Question Dedicated Timer */}
          <div
            className={`question-timer-widget ${
              revealed
                ? 'settled'
                : pressureMode
                ? isPressurePaused
                  ? 'paused'
                  : 'running'
                : !isQuestionTimerStarted && !isBlitzMode
                ? 'idle'
                : isQuestionTimerPaused
                ? 'paused'
                : 'running'
            }`}
          >
            <div className="question-timer-main">
              <div className="question-timer-digits-row">
                <Clock3
                  size={15}
                  className={
                    !revealed &&
                    ((pressureMode && !isPressurePaused) ||
                      (isQuestionTimerStarted && !isQuestionTimerPaused))
                      ? 'ticking'
                      : ''
                  }
                />
                <span className="question-timer-digits">
                  {formatTimer(
                    revealed && settledDuration !== null ? settledDuration : questionElapsedSec
                  )}
                </span>
                <span className="question-timer-bench">
                  / 建议基准 {formatTimer(benchmarkSec)} ({benchmarkLabel})
                </span>
                {pressureMode && isPressurePaused && (
                  <span className="pressure-paused-pill">已暂停</span>
                )}
              </div>

              {pressureMode ? (
                <div className="question-timer-actions">
                  <button
                    type="button"
                    className={`qtimer-btn ${isPressurePaused ? 'qtimer-paused-active' : ''}`}
                    onClick={togglePressurePause}
                    title={isPressurePaused ? '恢复高压模考计时 (P / 空格)' : '暂停高压模考计时 (P)'}
                    aria-label={isPressurePaused ? '恢复高压模考计时' : '暂停高压模考计时'}
                  >
                    {isPressurePaused ? <Play size={12} /> : <Pause size={12} />}
                    <span>{isPressurePaused ? '继续作答' : '暂停模考'}</span>
                  </button>
                </div>
              ) : !revealed ? (
                <div className="question-timer-actions">
                  {!isQuestionTimerStarted && !isBlitzMode ? (
                    <button
                      type="button"
                      className="qtimer-btn qtimer-start"
                      onClick={startQuestionTimer}
                      title="开始作答并计时"
                      aria-label="开始作答并计时"
                    >
                      <Play size={13} />
                      <span>开始作答</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="qtimer-btn"
                        onClick={() => setIsQuestionTimerPaused((p) => !p)}
                        title={isQuestionTimerPaused ? '继续本题计时' : '暂停本题计时'}
                        aria-label={isQuestionTimerPaused ? '继续本题计时' : '暂停本题计时'}
                      >
                        {isQuestionTimerPaused ? <Play size={12} /> : <Pause size={12} />}
                        <span>{isQuestionTimerPaused ? '继续' : '暂停'}</span>
                      </button>
                      <button
                        type="button"
                        className="qtimer-btn"
                        onClick={() => {
                          setQuestionElapsedSec(0)
                          setIsQuestionTimerPaused(false)
                          setSettledDuration(null)
                        }}
                        title="重置本题计时"
                        aria-label="重置本题计时"
                      >
                        <RotateCcw size={12} />
                        <span>重置</span>
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="question-timer-settled">
                  {(() => {
                    const sec = settledDuration ?? questionElapsedSec
                    const pace = getPaceEvaluation(sec, benchmarkSec)
                    return (
                      <span className={`pace-pill ${pace.level}`} title={pace.desc}>
                        {pace.label}
                      </span>
                    )
                  })()}
                </div>
              )}
            </div>

            <div className="question-timer-track">
              <div
                className={`question-timer-bar ${
                  (revealed && settledDuration !== null ? settledDuration : questionElapsedSec) >
                  benchmarkSec * 1.5
                    ? 'overtime'
                    : (revealed && settledDuration !== null
                        ? settledDuration
                        : questionElapsedSec) > benchmarkSec
                    ? 'warning'
                    : 'normal'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(
                      ((revealed && settledDuration !== null
                        ? settledDuration
                        : questionElapsedSec) /
                        benchmarkSec) *
                        100
                    )
                  )}%`,
                }}
              />
            </div>
          </div>

          <MathText value={current.stem} className="question-stem" />
          {current.imagePaths.length > 0 && <QuestionImages paths={current.imagePaths} />}
          {current.options.length > 0 ? (
            <div className="options-list">
              {current.options.map((option) => {
                const correctOption =
                  revealed && current.questionType !== 'subjective'
                    ? normalizeAnswer(current.correctAnswer).includes(
                        normalizeAnswer(option.label)
                      )
                    : false
                const wronglyPicked =
                  revealed && current.questionType !== 'subjective'
                    ? selected.includes(option.label) && !correctOption
                    : false
                const className = `option${
                  selected.includes(option.label) ? ' selected' : ''
                }${
                  revealed && current.questionType !== 'subjective' && correctOption
                    ? ' correct'
                    : ''
                }${revealed && wronglyPicked ? ' wrong' : ''}`
                return (
                  <button
                    key={option.id}
                    className={className}
                    onClick={() =>
                      setSelected(
                        current.questionType === 'multiple_choice'
                          ? selected.includes(option.label)
                            ? selected.filter((x) => x !== option.label)
                            : [...selected, option.label].sort()
                          : [option.label]
                      )
                    }
                  >
                    <span className="option-indicator">{option.label}</span>
                    <MathText value={option.contentMd} />
                  </button>
                )
              })}
            </div>
          ) : (
            current.questionType !== 'subjective' && (
              <div className="missing-options">
                这道选择题的选项未能读取，请在题库中打开题号 #{current.id} 后反馈。
              </div>
            )
          )}
          {isSelectedMatch !== null && (
            <div className={isSelectedMatch ? 'judgement correct' : 'judgement wrong'}>
              {isSelectedMatch ? (
                <>
                  <Check size={15} /> 屏幕选择与参考答案一致
                </>
              ) : (
                <>
                  <X size={15} /> 屏幕选择与参考答案不一致，正确答案已在下方标绿
                </>
              )}
            </div>
          )}

          {/* Frosted Tactical Pause Overlay */}
          {pressureMode && isPressurePaused && (
            <div className="pressure-pause-overlay">
              <div className="pressure-pause-card">
                <div className="pause-icon-pulse">
                  <Pause size={28} />
                </div>
                <h3>高压演练 · 战术暂停中</h3>
                <p>做题计时与模考总用时已全面冻结，随时可恢复作答</p>
                <div className="pause-stats-summary">
                  <span>当前进度：第 <b>{index + 1}</b> / {queue.length} 题</span>
                  <span>本题已用时：<b>{formatTimer(questionElapsedSec)}</b></span>
                </div>
                <button className="primary-button large" onClick={togglePressurePause}>
                  <Play size={16} /> 继续作答 (按 P 或 空格)
                </button>
              </div>
            </div>
          )}
        </article>
        <div className="question-footer">
          <span>
            <Clock3 size={15} />{' '}
            {pressureMode
              ? isPressurePaused
                ? '高压模考已暂停 · 计时已冻结'
                : '压力模拟中 · 完成后直接下一题'
              : '在纸上完成后，再查看答案和自评'}
          </span>
          <div className="footer-actions">
            {pressureMode ? (
              <>
                <button
                  className={`secondary-button quiet ${isPressurePaused ? 'accent-warn' : ''}`}
                  onClick={togglePressurePause}
                  title={isPressurePaused ? '恢复高压模考计时 (P / 空格)' : '暂停高压模考计时 (P)'}
                >
                  {isPressurePaused ? <Play size={15} /> : <Pause size={15} />}
                  {isPressurePaused ? '继续作答' : '暂停模考'}
                </button>
                <button
                  className="secondary-button quiet"
                  onClick={exitPressureFocus}
                  title="退出沉浸专注，但压力模拟和计时继续"
                >
                  <Minimize2 size={15} /> 退出专注
                </button>
                <button
                  className="secondary-button quiet"
                  onClick={abandonPressureMode}
                  title="放弃本次压力模拟，会话用时保留但不写入作答记录"
                >
                  <X size={15} /> 放弃本次模拟
                </button>
              </>
            ) : (
              <>
                <button
                  className="secondary-button quiet"
                  onClick={onOpenFormula}
                  title="查看当前题目考点公式 (Alt+F)"
                >
                  <BookMarked size={14} /> 本题公式速查
                </button>
                <button
                  className="secondary-button quiet"
                  onClick={skip}
                  title="把本题移到队列末尾，稍后再做 (S)"
                >
                  <SkipForward size={15} /> 跳过这题 <kbd>S</kbd>
                </button>
                {!revealed && (
                  <button className="secondary-button" onClick={reveal}>
                    查看答案 <kbd>␣</kbd>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        <section className="answer-panel answer-panel-inline">
          <div className="answer-head">
            <div>
              <span>作答与分析</span>
              <small>
                {pressureMode
                  ? isPressurePaused
                    ? '压力模拟 · 已暂停'
                    : '压力模拟 · 全部完成后批改'
                  : '纸笔优先 · 独立判定与自评'}
              </small>
            </div>
            <div className="answer-head-right">
              {!pressureMode && (
                <div className="practice-stepper" aria-label="当前作答步骤">
                  {['作答', '看答案', '自评', '记录'].map((label, stepIndex) => (
                    <span
                      key={label}
                      className={
                        contextStep === stepIndex + 1
                          ? 'active'
                          : contextStep > stepIndex + 1
                          ? 'done'
                          : ''
                      }
                    >
                      <i>{contextStep > stepIndex + 1 ? '✓' : stepIndex + 1}</i>
                      {label}
                    </span>
                  ))}
                </div>
              )}
              <span className="autosave">
                <span /> 自动保存
              </span>
            </div>
          </div>
          {pressureMode ? (
            <div className="paper-mode">
              <div className="pressure-mode-info">
                <div className="pressure-stats">
                  <div className="pressure-stat">
                    <span>进度</span>
                    <strong>
                      {index + 1} / {queue.length}
                    </strong>
                  </div>
                  <div className="pressure-stat">
                    <span>剩余</span>
                    <strong>{queue.length - index - 1} 题</strong>
                  </div>
                  <div className="pressure-stat">
                    <span>总用时</span>
                    <strong>
                      {formatElapsed(Math.max(0, pressureClock - pressureSessionStartTime))}
                      {isPressurePaused ? <small className="paused-badge"> (暂停中)</small> : null}
                    </strong>
                  </div>
                </div>
                <p>💡 压力模拟模式：完成所有题目后统一批改</p>
              </div>
              <button
                className="primary-button"
                onClick={() => void submitPressureQuestion(current, questionElapsedSec)}
              >
                {index < queue.length - 1 ? '下一题' : '完成并提交批改'}{' '}
                <ArrowRight size={17} />
              </button>
            </div>
          ) : !revealed ? (
            <div className="paper-mode">
              <div className="paper-illustration">
                <div className="paper-lines" />
                <Check size={28} />
              </div>
              <h3>先在纸上完整作答</h3>
              <p>保留你的真实推理过程，完成后再对答案。需要深挖时，把草稿交给 Codex。</p>
              <button className="primary-button" onClick={reveal}>
                <Check size={17} /> 我已完成（空格）
              </button>
              <button className="secondary-button full" onClick={createTask}>
                <BrainCircuit size={17} /> 请 Codex 批改草稿
              </button>
              {task && (
                <div className="codex-task">
                  <div>
                    <span>任务已生成</span>
                    <strong>{task.taskId}</strong>
                  </div>
                  <p>
                    手机拍下草稿，在 Codex 中发送图片和这段任务说明。结果会自动进入 AI 批改。
                  </p>
                  <button onClick={() => copyPrompt(task)}>
                    <Send size={15} /> 复制任务说明
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="review-mode">
              <div className="answer-card-group">
                <div className="answer-block-card">
                  <div className="answer-card-header">
                    <Check size={16} />
                    <span>参考答案</span>
                  </div>
                  <div className="answer-card-body">
                    <MathText value={current.correctAnswer} />
                  </div>
                </div>
                <div className="explanation-block-card">
                  <div className="explanation-card-header">
                    <BookOpen size={16} />
                    <span>详细解析与分步推导</span>
                  </div>
                  <div className="explanation-card-body">
                    <MathText value={current.explanation} />
                  </div>
                </div>
              </div>

              {/* 1. Outcome Selector */}
              <div className="outcome-block">
                <div className="block-title-row">
                  <span className="block-step-num">1</span>
                  <span className="block-title">实际判定结果</span>
                </div>
                <div className="outcome-grid">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    className={`outcome-card ${
                      outcome === 'correct' ? 'active correct' : ''
                    }`}
                    onClick={() => setOutcome('correct')}
                    onKeyDown={(event) =>
                      activateWithKeyboard(event, () => setOutcome('correct'))
                    }
                  >
                    <div className="outcome-icon-wrap correct">
                      <Check size={15} />
                    </div>
                    <div className="outcome-text">
                      <strong>做对</strong>
                      <small>完全吻合</small>
                    </div>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    className={`outcome-card ${
                      outcome === 'partial' ? 'active partial' : ''
                    }`}
                    onClick={() => setOutcome('partial')}
                    onKeyDown={(event) =>
                      activateWithKeyboard(event, () => setOutcome('partial'))
                    }
                  >
                    <div className="outcome-icon-wrap partial">
                      <Minus size={15} />
                    </div>
                    <div className="outcome-text">
                      <strong>部分正确</strong>
                      <small>步骤有分</small>
                    </div>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    className={`outcome-card ${outcome === 'wrong' ? 'active wrong' : ''}`}
                    onClick={() => setOutcome('wrong')}
                    onKeyDown={(event) =>
                      activateWithKeyboard(event, () => setOutcome('wrong'))
                    }
                  >
                    <div className="outcome-icon-wrap wrong">
                      <X size={15} />
                    </div>
                    <div className="outcome-text">
                      <strong>做错</strong>
                      <small>思路/结果偏差</small>
                    </div>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    className={`outcome-card ${
                      outcome === 'uncertain' ? 'active uncertain' : ''
                    }`}
                    onClick={() => setOutcome('uncertain')}
                    onKeyDown={(event) =>
                      activateWithKeyboard(event, () => setOutcome('uncertain'))
                    }
                  >
                    <div className="outcome-icon-wrap uncertain">
                      <HelpCircle size={15} />
                    </div>
                    <div className="outcome-text">
                      <strong>无法判断</strong>
                      <small>需进一步核对</small>
                    </div>
                  </motion.button>
                </div>
              </div>

              {/* 2. Fluency Rating */}
              <div className="rating-block">
                <div className="block-title-row">
                  <span className="block-step-num">2</span>
                  <span className="block-title">解题流畅度自评</span>
                  <span className="block-hint">
                    按键盘数字键 <kbd>1</kbd> ~ <kbd>4</kbd> 极速选择
                  </span>
                </div>
                <div className="rating-grid">
                  {ratingOptions.map((item) => {
                    const num = item.value
                    const icon =
                      num === 1 ? '🚫' : num === 2 ? '⚠️' : num === 3 ? '⏱️' : '⚡'
                    const titleText = item.label.replace(/^\d\s*·\s*/, '')
                    return (
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        key={item.value}
                        type="button"
                        className={`rating-card rate-${num} ${
                          rating === item.value ? 'active' : ''
                        }`}
                        onClick={() => chooseRating(item.value)}
                      >
                        <div className="rating-card-head">
                          <kbd className="rating-kbd">{num}</kbd>
                          <span className="rating-icon">{icon}</span>
                          <b className="rating-label">{titleText}</b>
                        </div>
                        <small className="rating-hint">{item.hint}</small>
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              {/* 3. Minimal Actionable Repair Card */}
              {(outcome === 'wrong' ||
                outcome === 'partial' ||
                (rating !== null && rating <= 2)) && (
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
                        className={`breakpoint-chip ${
                          breakpointTag === bp.label ? 'active' : ''
                        }`}
                        onClick={() =>
                          setBreakpointTag(
                            breakpointTag === bp.label ? null : bp.label
                          )
                        }
                        title={bp.desc}
                      >
                        {bp.label}
                      </button>
                    ))}
                  </div>

                  <span className="repair-section-label">
                    核心心得 / 关键恒等式提炼（保存至题目笔记）：
                  </span>
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
                            void saveNote(current.id, repairNote.trim()).then(() =>
                              setRepairNoteSaved(true)
                            )
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="repair-save-btn"
                      onClick={() => {
                        if (repairNote.trim()) {
                          void saveNote(current.id, repairNote.trim()).then(() =>
                            setRepairNoteSaved(true)
                          )
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
                      title="调出该考点的 3 道同类变式题立即加练 (V)"
                    >
                      <Sparkles size={14} /> 🚀 立即攻坚 3 道同类变式题 <kbd>V</kbd>
                    </button>
                    <span className="repair-schedule-hint">
                      <TimerReset size={13} />{' '}
                      {rating === 1 ? '已排入明日复习' : '已排入 3 天后复习'}
                    </span>
                  </div>
                </div>
              )}

              <div className="review-actions">
                <button
                  className="primary-button continue-button"
                  disabled={rating === null}
                  onClick={submit}
                  onKeyDown={(event) =>
                    activateWithKeyboard(event, () => {
                      void submit()
                    })
                  }
                >
                  记录并继续 · {queue.length > 1 ? '下一题' : '完成本轮'}{' '}
                  <ChevronRight size={17} />
                  <kbd>↵</kbd>
                </button>
                <button
                  className="variant-practice-btn prominent"
                  onClick={() => onStartVariant(current.id)}
                  title="调出此题同考点的 3 道变式题 (V)"
                >
                  <Sparkles size={14} /> 攻坚 3 道同类变式题 <kbd>V</kbd>
                </button>
                <button
                  className="secondary-button quiet"
                  onClick={undo}
                  title="撤销刚才的提交，重新评定"
                >
                  <RotateCcw size={15} /> 撤销上次提交
                </button>
              </div>
              <motion.button
                whileHover={{ scale: 1.006 }}
                whileTap={{ scale: 0.985 }}
                type="button"
                className="codex-draft-hero-btn"
                onClick={createTask}
                title="一键生成并复制本题 Codex 批改任务"
              >
                <div className="codex-hero-icon-wrap">
                  <Sparkles size={17} />
                </div>
                <div className="codex-hero-text">
                  <strong>拍照让 Codex 深度批改草稿</strong>
                  <span>定位最早错误断点 · 诊断做题节奏 · 给出秒杀最优解</span>
                </div>
                <ChevronRight size={16} className="codex-hero-arrow" />
              </motion.button>
              {task && (
                <button className="copy-task" onClick={() => copyPrompt(task)}>
                  <Send size={15} /> 复制 {task.taskId} 任务说明
                </button>
              )}
            </div>
          )}
        </section>
      </section>

      {/* 答题后成就卡片 */}
      <AnimatePresence>
        <AnimatePresence>
          {eloFlash && (
            <motion.div
              key="elo-flash"
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                position: 'fixed',
                top: 18,
                right: 18,
                zIndex: 130,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 14px',
                borderRadius: 12,
                background: 'rgba(22, 26, 34, 0.92)',
                color: '#F5F3EE',
                boxShadow: '0 10px 28px rgba(15, 18, 25, 0.35)',
                pointerEvents: 'none',
              }}
            >
              <span style={{ fontSize: 13, color: eloFlash.rankColor, fontWeight: 700 }}>
                {eloFlash.rankName}
              </span>
              <span style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(eloFlash.current)}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  fontVariantNumeric: 'tabular-nums',
                  color: eloFlash.delta >= 0 ? '#4CC38A' : '#E5534B',
                }}
              >
                {eloFlash.delta >= 0 ? `+${Math.round(eloFlash.delta)}` : Math.round(eloFlash.delta)}
              </span>
              {eloFlash.streak >= 3 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12, color: '#E87722', fontWeight: 700 }} title={`连胜 ${eloFlash.streak} 场`}>
                  <Flame size={13} />{eloFlash.streak}
                </span>
              )}
              {eloFlash.streak <= -3 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12, color: '#6B7280', fontWeight: 700 }} title={`连败 ${-eloFlash.streak} 场`}>
                  ❄{-eloFlash.streak}
                </span>
              )}
              {eloFlash.protectionLeft > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 12, color: '#4CC38A' }} title={`晋级保护剩余 ${eloFlash.protectionLeft} 场`}>
                  <ShieldCheck size={13} />
                </span>
              )}
              {!eloFlash.calibrated && (
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>定级 {Math.min(eloFlash.settlements, 10)}/10</span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {scoreboard && <SessionScoreboardModal scoreboard={scoreboard} onClose={() => setScoreboard(null)} />}
        {showAchievementCard && achievementData && (
          <motion.div
            className="achievement-card-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAchievementCard(false)}
          >
            <motion.div
              className={`achievement-card ${
                achievementData.milestone ? 'milestone-celebrate' : ''
              }`}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`achievement-icon ${
                  achievementData.correct ? 'correct' : 'wrong'
                }`}
              >
                {achievementData.correct ? <Check size={32} /> : <X size={32} />}
              </div>
              <h3>{achievementData.correct ? '✅ 正确！' : '❌ 错误'}</h3>
              <p className="achievement-time">
                用时 {formatTimer(achievementData.duration)}
              </p>

              {achievementData.milestone && (
                <div className="milestone-banner">
                  🎉 达成里程碑：完成 {achievementData.milestone} 题！
                </div>
              )}

              <div className="achievement-stats">
                <div className="achievement-stat">
                  <span className="stat-label">今日进度</span>
                  <div className="stat-value stat-animate">
                    <strong>{achievementData.todayProgress.done}</strong>
                    <small>/ {achievementData.todayProgress.target} 题</small>
                  </div>
                  {achievementData.yesterdayDone !== undefined &&
                    achievementData.todayProgress.done >
                      achievementData.yesterdayDone && (
                      <div className="data-growth positive">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M6 2L6 10M6 2L3 5M6 2L9 5"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        比昨天多{' '}
                        {achievementData.todayProgress.done -
                          achievementData.yesterdayDone}{' '}
                        题
                      </div>
                    )}
                  {achievementData.yesterdayDone !== undefined &&
                    achievementData.todayProgress.done ===
                      achievementData.yesterdayDone && (
                      <div className="data-growth">持平昨天</div>
                    )}
                  {achievementData.yesterdayDone !== undefined &&
                    achievementData.todayProgress.done <
                      achievementData.yesterdayDone && (
                      <div className="data-growth negative">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M6 10L6 2M6 10L3 7M6 10L9 7"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        比昨天少{' '}
                        {achievementData.yesterdayDone -
                          achievementData.todayProgress.done}{' '}
                        题
                      </div>
                    )}
                  {!achievementData.yesterdayDone &&
                    achievementData.yesterdayDone !== 0 && (
                      <div className="stat-badge">
                        {achievementData.todayProgress.done >=
                        achievementData.todayProgress.target
                          ? '🎉 已完成目标'
                          : `还差 ${
                              achievementData.todayProgress.target -
                              achievementData.todayProgress.done
                            } 题`}
                      </div>
                    )}
                </div>

                <div className="achievement-stat">
                  <span className="stat-label">本轮正确率</span>
                  <div className="stat-value">
                    <strong>
                      {Math.round(
                        (achievementData.correctCount / achievementData.totalCount) * 100
                      )}
                      %
                    </strong>
                    <small>
                      ({achievementData.correctCount}/{achievementData.totalCount})
                    </small>
                  </div>
                </div>
              </div>

              <div className="achievement-actions">
                <button
                  className="achievement-continue"
                  onClick={() => setShowAchievementCard(false)}
                >
                  继续刷题 <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 压力模拟确认对话框 */}
      {showPressurePrompt && (
        <div className="ui-overlay modal-backdrop" style={{ zIndex: 100 }}>
          <div
            className="ui-modal modal-card pressure-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pressure-confirm-title"
            aria-describedby="pressure-confirm-description"
          >
            <div className="pressure-confirm-head">
              <div className="pressure-confirm-heading">
                <span className="pressure-confirm-icon" aria-hidden="true">
                  <Target size={20} />
                </span>
                <div>
                  <span className="pressure-confirm-eyebrow">纸笔整组模拟</span>
                  <h3 id="pressure-confirm-title">开始压力模拟</h3>
                </div>
              </div>
              <button
                className="icon-button pressure-confirm-close"
                onClick={() => setShowPressurePrompt(false)}
                aria-label="取消"
              >
                <X size={18} />
              </button>
            </div>
            <div className="pressure-confirm-content">
              <p
                className="pressure-confirm-lead"
                id="pressure-confirm-description"
              >
                开始后自动进入专注模式。请在纸上连续完成整组题目，结束后再交给 Codex
                统一批改。
              </p>
              <ul className="pressure-features" aria-label="模拟规则">
                <li>
                  <span className="pressure-feature-icon rule" aria-hidden="true">
                    <PenLine size={16} />
                  </span>
                  <span>
                    <strong>过程不打断</strong>
                    <small>不显示答案、解析，也不进行中途自评</small>
                  </span>
                </li>
                <li>
                  <span className="pressure-feature-icon review" aria-hidden="true">
                    <ClipboardCheck size={16} />
                  </span>
                  <span>
                    <strong>完成后统一批改</strong>
                    <small>草稿交给 Codex，确认后才计入作答记录</small>
                  </span>
                </li>
              </ul>
              <div className="pressure-info">
                <div className="pressure-info-item">
                  <span>本次题目</span>
                  <strong>
                    {queue.length}
                    <em> 题</em>
                  </strong>
                </div>
                <div className="pressure-info-item">
                  <span>预计用时</span>
                  <strong>
                    {Math.floor(queue.length * 3.5)}–{Math.floor(queue.length * 5)}
                    <em> 分钟</em>
                  </strong>
                </div>
              </div>
              <p className="pressure-tip">
                <ShieldCheck size={15} aria-hidden="true" />{' '}
                可以随时退出专注视图；本次模拟与计时会持续保存。
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="secondary-button"
                onClick={() => setShowPressurePrompt(false)}
              >
                取消
              </button>
              <button
                className="primary-button pressure-confirm-start"
                onClick={confirmPressureMode}
              >
                <Target size={16} /> 开始模拟
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 压力模拟批改结果对话框 */}
      {showPressureResult && (
        <div className="ui-overlay modal-backdrop" style={{ zIndex: 100 }}>
          <div
            className="ui-modal modal-card pressure-result-modal"
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-head">
              <h3>压力模拟已完成！</h3>
              <button
                className="icon-button"
                onClick={() => void closePressureResult()}
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <div className="pressure-result-content">
              <div className="pressure-stats-summary">
                <div className="pressure-stat-item">
                  <span>完成题数</span>
                  <strong>{queue.length} 题</strong>
                </div>
                <div className="pressure-stat-item">
                  <span>总用时</span>
                  <strong>
                    {formatElapsed(Math.max(0, pressureClock - pressureSessionStartTime))}
                  </strong>
                </div>
                <div className="pressure-stat-item">
                  <span>平均用时</span>
                  <strong>
                    {formatElapsed(
                      Math.round(
                        Math.max(0, pressureClock - pressureSessionStartTime) /
                          Math.max(1, queue.length)
                      )
                    )}
                    /题
                  </strong>
                </div>
              </div>
              <p className="pressure-instruction">
                整组草稿交给 Codex，结果会自动进入刷吧收件箱；确认后才计入作答记录。
              </p>
              {batchTask ? (
                <div className="pressure-prompt-box">
                  <pre>{batchTask.prompt}</pre>
                </div>
              ) : (
                <>
                  <p className="pressure-instruction">整组批改任务尚未生成。</p>
                  <button
                    className="secondary-button full"
                    onClick={() => void retryPressureBatchTask()}
                  >
                    重新生成 Codex 任务
                  </button>
                </>
              )}
              {batchTask && (
                <button
                  className="secondary-button full"
                  onClick={() => copyPrompt(batchTask)}
                >
                  📋 复制整组 Codex 任务
                </button>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="secondary-button"
                onClick={() => void closePressureResult()}
              >
                稍后处理
              </button>
              <button
                className="secondary-button"
                disabled={pressureReportLoading || !pressureSession}
                onClick={() =>
                  pressureSession &&
                  void onOpenPressureReport(pressureSession.sessionId)
                }
              >
                {pressureReportLoading ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <BarChart3 size={15} />
                )}{' '}
                查看 / 刷新学习报告
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  void closePressureResult()
                  notify(
                    '批改结果请在刷吧收件箱中确认；确认后可直接打开学习报告'
                  )
                }}
              >
                稍后在收件箱确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
