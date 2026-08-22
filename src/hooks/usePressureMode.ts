import { useCallback, useEffect, useRef, useState } from 'react'
import {
  abandonPressureSession,
  completePressureSession,
  createCodexBatchTask,
  createPressureSession,
  getQuestion,
  getRecommendations,
  listPressureSessions,
  submitPressureAnswer,
} from '../api'
import { clampAttemptDuration } from '../domain/evidence'
import type { CodexTask, PressureSession, Question, RecommendedQuestion } from '../types'

export interface UsePressureModeOptions {
  queue: RecommendedQuestion[]
  index: number
  setIndex: (index: number) => void
  setSelected: (selected: string[]) => void
  resetActiveTimer: () => void
  setQuestionElapsedSec: (sec: number) => void
  isZenMode: boolean
  onToggleZen: () => void
  notify: (msg: string) => void
  replaceQueue: (next: RecommendedQuestion[]) => void
  onQueueChange: (next: RecommendedQuestion[]) => void
  refresh: () => Promise<void> | void
}

export function usePressureMode({
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
}: UsePressureModeOptions) {
  const [pressureMode, setPressureMode] = useState(false)
  const [pressureSession, setPressureSession] = useState<PressureSession | null>(null)
  const [showPressurePrompt, setShowPressurePrompt] = useState(false)
  const [showPressureResult, setShowPressureResult] = useState(false)
  const [pressureSessionStartTime, setPressureSessionStartTime] = useState(0)
  const [pressureDurations, setPressureDurations] = useState<Record<number, number>>({})
  const [pressureClock, setPressureClock] = useState(Date.now())
  const [batchTask, setBatchTask] = useState<CodexTask | null>(null)

  const pressureRecoveryAttemptedRef = useRef(false)
  const pressureResumeElapsedRef = useRef<number | null>(null)
  const pressureQuestionStartedAtRef = useRef<number>(Date.now())

  // Clock ticker for overall session elapsed time
  useEffect(() => {
    if (!pressureMode || pressureSession?.status !== 'ongoing') return
    const id = window.setInterval(() => setPressureClock(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [pressureMode, pressureSession?.status])

  // Rehydrate an unfinished pressure session after an app restart
  useEffect(() => {
    if (pressureRecoveryAttemptedRef.current || pressureSession) return
    pressureRecoveryAttemptedRef.current = true
    let cancelled = false

    void listPressureSessions()
      .then(async (sessions) => {
        const active = sessions.find(
          (item) => item.status === 'ongoing' && item.questionIds?.length
        )
        if (!active || cancelled || !active.questionIds?.length) return
        const loaded = await Promise.all(
          active.questionIds.map((id) => getQuestion(id).catch(() => null))
        )
        if (cancelled) return
        const questions = loaded.filter((q): q is Question => Boolean(q))
        if (questions.length !== active.questionIds.length) {
          notify('检测到未完成压力模拟，但部分题目无法恢复，请在题库中检查题目')
          return
        }
        const recorded = new Set(active.questions.map((answer) => answer.questionId))
        const durations = Object.fromEntries(
          active.questions.map((answer) => [answer.questionId, answer.duration])
        )
        const lastCheckpoint = active.questions.at(-1)?.submitTime ?? active.startTime
        const resumeElapsed = Math.min(
          1800,
          Math.max(0, Math.floor((Date.now() - lastCheckpoint) / 1000))
        )
        pressureResumeElapsedRef.current = resumeElapsed
        setQuestionElapsedSec(resumeElapsed)
        const restoredQueue = questions.map((question) => ({
          question,
          score: 100,
          reason: '恢复中的压力模拟',
          reasonCode: 'custom' as const,
        }))
        onQueueChange(restoredQueue)
        setPressureSession(active)
        setPressureDurations(durations)
        setPressureSessionStartTime(active.startTime)
        setPressureClock(Date.now())
        setIndex(Math.max(0, restoredQueue.findIndex((item) => !recorded.has(item.question.id))))
        setPressureMode(true)
        if (!isZenMode) onToggleZen()
        notify(`已恢复压力模拟，还剩 ${questions.length - recorded.size} 道题`)
      })
      .catch(() => {
        // Recovery is best-effort
      })

    return () => {
      cancelled = true
    }
  }, [isZenMode, notify, onQueueChange, onToggleZen, pressureSession, setIndex, setQuestionElapsedSec])

  const copyPrompt = useCallback(
    async (targetTask: CodexTask) => {
      await navigator.clipboard.writeText(targetTask.prompt)
      notify('任务说明已复制到剪贴板')
    },
    [notify]
  )

  const startPressureMode = useCallback(async () => {
    if (queue.length < 5) {
      notify('至少需要 5 道题才能开启压力模拟模式')
      return
    }
    setShowPressurePrompt(true)
  }, [queue.length, notify])

  const confirmPressureMode = useCallback(async () => {
    const questionIds = queue.map((q) => q.question.id)
    try {
      const session = await createPressureSession(questionIds)
      setPressureSession(session)
      setPressureDurations({})
      setPressureMode(true)
      setShowPressurePrompt(false)
      setPressureSessionStartTime(session.startTime)
      setPressureClock(Date.now())
      pressureQuestionStartedAtRef.current = Date.now()
      setIndex(0)
      if (!isZenMode) onToggleZen()
      notify('压力模拟模式已开启')
    } catch (error) {
      console.error('启动压力模拟失败:', error)
      notify('启动压力模拟失败')
    }
  }, [queue, isZenMode, onToggleZen, notify, setIndex])

  const submitPressureQuestion = useCallback(
    async (currentQuestion: Question | undefined, questionElapsedSec: number) => {
      if (!currentQuestion || !pressureSession) return

      const duration = clampAttemptDuration(
        Math.floor((Date.now() - pressureQuestionStartedAtRef.current) / 1000) ||
          questionElapsedSec ||
          1
      )

      try {
        await submitPressureAnswer(pressureSession.sessionId, currentQuestion.id, '', duration)
        setPressureDurations((prev) => ({ ...prev, [currentQuestion.id]: duration }))

        if (index < queue.length - 1) {
          setIndex(index + 1)
          setSelected([])
          resetActiveTimer()
          pressureQuestionStartedAtRef.current = Date.now()
          setQuestionElapsedSec(0)
        } else {
          const completed = await completePressureSession(pressureSession.sessionId)
          const finalDurations = { ...pressureDurations, [currentQuestion.id]: duration }
          setPressureSession(completed)
          setPressureMode(false)
          setShowPressureResult(true)
          try {
            const created = await createCodexBatchTask(
              queue.map((item) => item.question.id),
              finalDurations,
              pressureSession.sessionId
            )
            setBatchTask(created)
            await copyPrompt(created)
          } catch (error) {
            console.error('生成整组批改任务失败:', error)
            notify('压力模拟已完成，但整组批改任务生成失败，可在结果窗口重试')
          }
        }
      } catch (error) {
        console.error('提交答案失败:', error)
        notify('提交答案失败')
      }
    },
    [
      pressureSession,
      index,
      queue,
      pressureDurations,
      copyPrompt,
      notify,
      resetActiveTimer,
      setIndex,
      setSelected,
      setQuestionElapsedSec,
    ]
  )

  const retryPressureBatchTask = useCallback(async () => {
    if (!pressureSession || pressureSession.status !== 'awaiting_codex') return
    try {
      const created = await createCodexBatchTask(
        queue.map((item) => item.question.id),
        pressureDurations,
        pressureSession.sessionId
      )
      setBatchTask(created)
      await copyPrompt(created)
      notify('整组 Codex 任务已重新生成并复制')
    } catch (error) {
      console.error('重试生成整组批改任务失败:', error)
      notify('重试失败，请稍后再试')
    }
  }, [pressureSession, queue, pressureDurations, copyPrompt, notify])

  const exitPressureFocus = useCallback(() => {
    if (isZenMode) {
      onToggleZen()
      notify('已退出专注，压力模拟仍在进行，计时会继续保存')
    }
  }, [isZenMode, onToggleZen, notify])

  const abandonPressureMode = useCallback(async () => {
    if (
      !window.confirm(
        '放弃本次压力模拟？已完成题目的用时会保留，但本次不会写入作答记录。'
      )
    )
      return

    try {
      if (pressureSession?.status === 'ongoing') {
        await abandonPressureSession(pressureSession.sessionId)
      }
    } catch (error) {
      console.error('放弃压力模拟失败:', error)
      notify('放弃压力模拟失败，请稍后重试')
      return
    }
    setPressureMode(false)
    setPressureSession(null)
    setShowPressureResult(false)
    if (isZenMode) onToggleZen()
    notify('已放弃本次压力模拟，已保存的用时不会写入作答记录')
  }, [pressureSession, isZenMode, onToggleZen, notify])

  const closePressureResult = useCallback(async () => {
    setShowPressureResult(false)
    setPressureSession(null)
    try {
      const nextRecs = await getRecommendations(12)
      replaceQueue(nextRecs)
    } catch {
      // ignore
    }
    await refresh()
  }, [replaceQueue, refresh])

  return {
    pressureMode,
    pressureSession,
    showPressurePrompt,
    setShowPressurePrompt,
    showPressureResult,
    setShowPressureResult,
    pressureSessionStartTime,
    pressureDurations,
    pressureClock,
    batchTask,
    pressureResumeElapsedRef,
    pressureQuestionStartedAtRef,
    startPressureMode,
    confirmPressureMode,
    submitPressureQuestion,
    retryPressureBatchTask,
    exitPressureFocus,
    abandonPressureMode,
    closePressureResult,
    copyPrompt,
  }
}
