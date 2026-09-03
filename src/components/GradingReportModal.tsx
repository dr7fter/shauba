import {
  Activity,
  ArrowRight,
  ClipboardCheck,
  LoaderCircle,
  Sparkles,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import {
  addDailyPlanItem,
  addToCustomQueue,
  getQuestion,
  getQuestionAttemptHistory,
  saveNote,
  toggleFavorite,
} from '../api'
import {
  CS_RATING_MAX,
  benchmarkSeconds,
  csRatingAccent,
  csRatingTone,
  formatElapsed,
  gradeOutcomeKey,
  type GradeOutcome,
} from '../utils'
import {
  baselineDimensionValues,
  breakpointHeadline,
  buildBreakpointGroups,
  buildGradeFlow,
  buildReportViewModel,
  dimensionInsight,
  gradeDimensionRows,
  type BreakpointSeverity,
} from '../domain/reportViewModel'
import { MathText } from './MathText'
import { EmptyState } from './EmptyState'
import { QuestionDetail } from './QuestionDetailModal'
import { Radar } from './ui/Radar'
import { RatingBadge } from './ui/RatingBadge'
import { MetricBar } from './ui/MetricBar'
import type {
  AttemptHistoryEntry,
  DailyPlanItem,
  GradingReport,
  GradingReportOrigin,
  PressureSession,
  Question,
  QuestionGrade,
} from '../types'

// ============ 方案 D · 现状改版（贴合今日界面淡绿宣纸底色） ============

const OUTCOME_LABELS: Record<GradeOutcome, string> = {
  correct: '完全正确',
  partial: '部分正确',
  wrong: '错误',
  uncertain: '待确认',
}

type Severity = 'fatal' | 'slip' | 'detour'

const SEVERITY_BY_TAG: Record<string, Severity> = {
  概念盲区: 'fatal',
  概念边界: 'fatal',
  充要混淆: 'fatal',
  定理记错: 'fatal',
  瞄准失误: 'slip',
  计算笔误: 'slip',
  负号抄错: 'slip',
  战术绕路: 'detour',
  方法绕路: 'detour',
  方法未掌握: 'detour',
  设数硬算: 'detour',
}

const SEVERITY_META: Record<Severity, { label: string; color: string; badge: string }> = {
  fatal: { label: 'Level 1 概念盲区', color: '#b91c1c', badge: '⚠ 概念边界缺失' },
  slip: { label: 'Level 3 精度失误', color: '#d97706', badge: '⚠ 计算精度失误' },
  detour: { label: 'Level 2 战术绕路', color: '#2f8561', badge: '⚠ 路径待纠偏' },
}

function severityOf(grade: GradingReport['grades'][number], fallbackKey: GradeOutcome): Severity {
  const tags = grade.errorTags ?? []
  for (const tag of tags) {
    const s = SEVERITY_BY_TAG[tag]
    if (s) return s
  }
  if (fallbackKey === 'wrong') return 'fatal'
  if (fallbackKey === 'partial') return 'detour'
  return 'slip'
}

function gradeTone(grade: GradingReport['grades'][number]): {
  key: GradeOutcome
  label: string
} {
  const key = gradeOutcomeKey(grade)
  return { key, label: OUTCOME_LABELS[key] }
}

function SafeClampedText({ value, defaultClamped = true }: { value: string; defaultClamped?: boolean }) {
  const [clamped, setClamped] = useState(defaultClamped)
  const isLong = value.length > 140

  if (!isLong) {
    return <MathText value={value} />
  }

  return (
    <div className="safe-clamped-text-container">
      <div className={clamped ? 'text-clamped-lines' : ''}>
        <MathText value={value} />
      </div>
      <button
        type="button"
        className="text-toggle-btn"
        onClick={() => setClamped((v) => !v)}
      >
        {clamped ? '展开全文 ▾' : '收起全文 ▴'}
      </button>
    </div>
  )
}

function getTomorrowDateString(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** L1 致命 / L2 战术 / L3 精度——只在断点清单与档案里用，不参与评分 */
const SEVERITY_LABEL: Record<BreakpointSeverity, string> = {
  L1: 'L1 致命',
  L2: 'L2 战术',
  L3: 'L3 精度',
}

function outcomeMark(raw?: string | null): { text: string; cls: string } {
  const s = (raw ?? '').toLowerCase()
  if (s === 'correct') return { text: '对', cls: 'ok' }
  if (s === 'partial') return { text: '半', cls: 'mid' }
  if (s === 'wrong' || s === 'incorrect') return { text: '错', cls: 'bad' }
  return { text: '·', cls: '' }
}

export function PressureLearningReportView({
  report,
  reportOrigin,
  session,
  questions,
  loading,
  onRefresh,
  onClose,
  onStartVariant,
}: {
  report: GradingReport
  reportOrigin: GradingReportOrigin
  session: PressureSession | null
  questions: Record<number, Question>
  loading: boolean
  onRefresh: () => void
  onClose: () => void
  onStartVariant?: (questionId: number) => void
}) {
  const [detailQuestion, setDetailQuestion] = useState<Question | null>(null)
  const [favoriteMap, setFavoriteMap] = useState<Record<number, boolean>>({})
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [ratingEvidenceOpen, setRatingEvidenceOpen] = useState(false)
  const [userNotes, setUserNotes] = useState<Record<number, string>>({})
  const [noteSaving, setNoteSaving] = useState<Record<number, boolean>>({})
  const [noteSavedNotice, setNoteSavedNotice] = useState<Record<number, boolean>>({})
  const [planAdded, setPlanAdded] = useState<Record<number, boolean>>({})
  const [railFilter, setRailFilter] = useState<'all' | 'needs-attention'>('needs-attention')
  const [attemptHistory, setAttemptHistory] = useState<AttemptHistoryEntry[]>([])
  /** 第 04 步「正确入口」的呈现方式：推导式 / E2 左右对照式 */
  const [solutionView, setSolutionView] = useState<'derive' | 'fork'>('fork')
  /** 正确入口默认遮罩，逼自己先推一遍，避免"看懂了 = 会了" */
  const [solutionRevealed, setSolutionRevealed] = useState(false)
  const [copyPanelOpen, setCopyPanelOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  /** 游戏化开场：先进场看战况数据，进入后只剩纯学习报告 */
  const [introOpen, setIntroOpen] = useState(true)
  const [introPaused, setIntroPaused] = useState(false)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const viewModel = useMemo(
    () =>
      buildReportViewModel(
        report,
        questions,
        session,
        reportOrigin,
      ),
    [report, questions, session, reportOrigin]
  )

  const {
    reportStatus,
    grades,
    ratingScores,
    counts,
    accuracy,
    averageRatingScore,
    ratingTier,
    ratingTone,
    totalDuration,
    averageDuration,
    ratingDimensions,
    hasFullDimensionEvidence,
    evidenceCoverage,
    gradedCount,
    totalCount,
    ungradedIds,
    kastRate,
    examPrediction,
    worstGradeEntry,
    verdictText,
  } = viewModel

  const [selectedGradeIndex, setSelectedGradeIndex] = useState<number>(() => worstGradeEntry?.index ?? 0)
  const initializedReportKeyRef = useRef<string | null>(null)

  const worstIndex = worstGradeEntry?.index
  useEffect(() => {
    const reportKey = `${report.confirmedAt ?? report.createdAt ?? report.sourceTaskId}_${grades.length}`
    if (initializedReportKeyRef.current !== reportKey) {
      initializedReportKeyRef.current = reportKey
      if (typeof worstIndex === 'number') {
        setSelectedGradeIndex(worstIndex)
      } else if (grades.length > 0) {
        setSelectedGradeIndex(0)
      }
    }
  }, [report, grades.length, worstIndex])

  useEffect(() => {
    const initialNotes: Record<number, string> = {}
    for (const [idStr, q] of Object.entries(questions)) {
      if (q?.note) {
        initialNotes[Number(idStr)] = q.note
      }
    }
    setUserNotes((prev) => ({ ...initialNotes, ...prev }))
  }, [questions])

  const getQuestionDurationInfo = useCallback(
    (grade: QuestionGrade) => {
      const q = questions[grade.questionId]
      const sessionAns = session?.questions?.find((item) => item.questionId === grade.questionId)
      const durSec =
        typeof grade.duration === 'number' && grade.duration > 0
          ? grade.duration
          : sessionAns?.duration ?? 0
      const bench = benchmarkSeconds(q?.questionType)
      const isOvertime = durSec > bench * 1.2
      const overtimeSec = durSec > bench ? durSec - bench : 0
      return {
        duration: durSec,
        benchmark: bench,
        isOvertime,
        overtimeSec,
      }
    },
    [questions, session]
  )

  const railEntries = useMemo(() => {
    return grades
      .map((grade, index) => ({ grade, index }))
      .filter(({ grade }) => {
        const outcome = gradeOutcomeKey(grade)
        if (railFilter === 'needs-attention') {
          return outcome !== 'correct'
        }
        return true
      })
  }, [grades, railFilter])

  useEffect(() => {
    if (railEntries.length > 0) {
      const isCurrentInRail = railEntries.some((e) => e.index === selectedGradeIndex)
      if (!isCurrentInRail) {
        setSelectedGradeIndex(railEntries[0].index)
      }
    }
  }, [railFilter, railEntries, selectedGradeIndex])

  const handleNextQuestion = useCallback(() => {
    if (railEntries.length === 0) return
    const currentRailIdx = railEntries.findIndex((e) => e.index === selectedGradeIndex)
    const nextRailIdx = currentRailIdx === -1 ? 0 : (currentRailIdx + 1) % railEntries.length
    setSelectedGradeIndex(railEntries[nextRailIdx].index)
  }, [railEntries, selectedGradeIndex])

  const handlePrevQuestion = useCallback(() => {
    if (railEntries.length === 0) return
    const currentRailIdx = railEntries.findIndex((e) => e.index === selectedGradeIndex)
    const prevRailIdx =
      currentRailIdx === -1
        ? 0
        : (currentRailIdx - 1 + railEntries.length) % railEntries.length
    setSelectedGradeIndex(railEntries[prevRailIdx].index)
  }, [railEntries, selectedGradeIndex])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || (target as any).isContentEditable)

      if (event.key === 'Escape') {
        event.preventDefault()
        if (detailQuestion) {
          setDetailQuestion(null)
          return
        }
        onCloseRef.current()
        return
      }

      if (!isInput) {
        if (event.key === 'j' || event.key === 'ArrowDown') {
          event.preventDefault()
          handleNextQuestion()
        } else if (event.key === 'k' || event.key === 'ArrowUp') {
          event.preventDefault()
          handlePrevQuestion()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [detailQuestion, handleNextQuestion, handlePrevQuestion])

  const handleToggleFav = async (qId: number) => {
    try {
      const nextFav = await toggleFavorite(qId)
      setFavoriteMap((prev) => ({ ...prev, [qId]: nextFav }))
      setToastMsg(nextFav ? `⭐ 题目 #${qId} 已加入收藏夹` : `已取消题目 #${qId} 收藏`)
      setTimeout(() => setToastMsg(null), 2200)
    } catch {
      setToastMsg('收藏操作失败，请重试')
      setTimeout(() => setToastMsg(null), 2200)
    }
  }

  const handleOpenDetail = async (qId: number) => {
    const existing = questions[qId]
    if (existing) {
      setDetailQuestion(existing)
      return
    }
    try {
      const fetched = await getQuestion(qId)
      setDetailQuestion(fetched)
    } catch {
      setToastMsg(`无法加载题目 #${qId} 详情`)
      setTimeout(() => setToastMsg(null), 2000)
    }
  }

  const handleSaveQuestionNote = async (questionId: number, note: string) => {
    setNoteSaving((prev) => ({ ...prev, [questionId]: true }))
    try {
      await saveNote(questionId, note)
      setUserNotes((prev) => ({ ...prev, [questionId]: note }))
      setNoteSavedNotice((prev) => ({ ...prev, [questionId]: true }))
      setToastMsg(`✍️ 题目 #${questionId} 考场自省已保存！`)
      setTimeout(() => {
        setNoteSavedNotice((prev) => ({ ...prev, [questionId]: false }))
        setToastMsg(null)
      }, 2500)
    } catch (err) {
      setToastMsg(`保存笔记失败: ${String(err)}`)
    } finally {
      setNoteSaving((prev) => ({ ...prev, [questionId]: false }))
    }
  }

  const handleAddToDailyPlan = async (grade: QuestionGrade) => {
    try {
      const tomorrowStr = getTomorrowDateString()
      const q = questions[grade.questionId]
      const catName = q?.categoryPath?.split('/').pop()?.trim() || '错题'

      const planItem: DailyPlanItem = {
        id: `b_${tomorrowStr}_${Date.now()}_${grade.questionId}`,
        planDate: tomorrowStr,
        tier: 'base',
        title: `复查 #${grade.questionId} (${catName})`,
        targetType: 'question_ids',
        targetCount: 1,
        categoryPath: q?.categoryPath ?? null,
        questionIds: [grade.questionId],
        completed: false,
        sortOrder: 0,
      }

      await addDailyPlanItem(planItem)
      setPlanAdded((prev) => ({ ...prev, [grade.questionId]: true }))
      setToastMsg(`📋 题目 #${grade.questionId} 已排入明日基础复查计划！`)
      setTimeout(() => setToastMsg(null), 2500)
    } catch (err) {
      setToastMsg(`排入计划失败: ${String(err)}`)
    }
  }

  const { correct: correctCount, partial: partialCount, wrong: wrongCount } = counts

  /** 开场高光：只统计真实产生的评级，一次都没触发就是 0，不编造 */
  const highlightCounts = {
    donk: ratingScores.filter((score) => score != null && csRatingAccent(score) === 'donk').length,
    clutch: ratingScores.filter((score) => score != null && csRatingAccent(score) === 'clutch').length,
  }

  useEffect(() => {
    if (!introOpen || introPaused) return
    const timer = window.setTimeout(() => setIntroOpen(false), 5000)
    return () => window.clearTimeout(timer)
  }, [introOpen, introPaused])

  const replayIntro = useCallback(() => {
    setIntroPaused(false)
    setIntroOpen(true)
  }, [])
  const reportTime = report.confirmedAt ?? report.createdAt
  const reportDate = new Date(reportTime < 1_000_000_000_000 ? reportTime * 1000 : reportTime)

  const activeEntry = grades[selectedGradeIndex]
    ? { grade: grades[selectedGradeIndex], index: selectedGradeIndex }
    : railEntries[0] || (grades[0] ? { grade: grades[0], index: 0 } : null)

  const activeGrade = activeEntry?.grade
  const activeIndex = activeEntry?.index ?? 0
  const activeQuestion = activeGrade ? questions[activeGrade.questionId] : undefined
  const activeTone = activeGrade ? gradeTone(activeGrade) : null
  const activeSev =
    activeGrade && activeTone && activeTone.key !== 'correct'
      ? SEVERITY_META[severityOf(activeGrade, activeTone.key)]
      : null
  const activeDurInfo = activeGrade ? getQuestionDurationInfo(activeGrade) : null
  const activeIsAdded = activeGrade ? planAdded[activeGrade.questionId] : false
  const activeIsFav = activeGrade ? (favoriteMap[activeGrade.questionId] ?? activeQuestion?.favorite ?? false) : false
  const activeIsSavingNote = activeGrade ? noteSaving[activeGrade.questionId] : false
  const activeIsNoteSaved = activeGrade ? noteSavedNotice[activeGrade.questionId] : false

  // 考点科目分布概括 (e.g. 高数 5 / 线代 3)
  const subjectDistribution = useMemo(() => {
    let gaoshu = 0
    let xiandai = 0
    let gailv = 0
    for (const g of grades) {
      const p = questions[g.questionId]?.categoryPath || ''
      if (p.includes('高等数学') || p.includes('一元') || p.includes('多元') || p.includes('微分') || p.includes('积分')) {
        gaoshu++
      } else if (p.includes('线性代数') || p.includes('矩阵') || p.includes('向量') || p.includes('方程组')) {
        xiandai++
      } else if (p.includes('概率') || p.includes('数理统计')) {
        gailv++
      } else {
        gaoshu++
      }
    }
    const parts = []
    if (gaoshu > 0) parts.push(`高数 ${gaoshu}`)
    if (xiandai > 0) parts.push(`线代 ${xiandai}`)
    if (gailv > 0) parts.push(`概率 ${gailv}`)
    return parts.join(' / ') || '高数'
  }, [grades, questions])

  // ---- E1 断点工单派生数据 ----
  const gradeQuestionIds = useMemo(() => grades.map((grade) => grade.questionId), [grades])

  useEffect(() => {
    let cancelled = false
    if (gradeQuestionIds.length === 0) {
      setAttemptHistory([])
      return
    }
    getQuestionAttemptHistory(gradeQuestionIds)
      .then((rows) => {
        if (!cancelled) setAttemptHistory(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setAttemptHistory([])
      })
    return () => {
      cancelled = true
    }
  }, [gradeQuestionIds])

  const breakpointGroups = useMemo(
    () => buildBreakpointGroups(grades, attemptHistory),
    [grades, attemptHistory],
  )
  const headline = useMemo(() => breakpointHeadline(breakpointGroups), [breakpointGroups])
  const baselineDims = useMemo(() => baselineDimensionValues(grades), [grades])
  const relapseCount = breakpointGroups.filter((group) => group.state === 'relapse').length

  const activeFlow = activeGrade ? buildGradeFlow(activeGrade) : null
  const activeDimRows = activeGrade ? gradeDimensionRows(activeGrade, baselineDims) : []
  const activeInsight = activeDimRows.length > 0 ? dimensionInsight(activeDimRows) : null
  const activeHistory = useMemo(
    () => (activeGrade ? attemptHistory.filter((row) => row.questionId === activeGrade.questionId) : []),
    [attemptHistory, activeGrade],
  )
  // activeHistory 按时间倒序，末条即首次作答
  const firstDuration = activeHistory.length > 1 ? activeHistory[activeHistory.length - 1].durationSeconds : null
  const compression =
    firstDuration && firstDuration > 0 && activeGrade && activeGrade.duration > 0
      ? Math.round((activeGrade.duration / firstDuration) * 100)
      : null

  /**
   * 验收判据的三道闸。只认真实数据：
   * 没有重做记录就是 pending，绝不因为"看起来懂了"记成 pass。
   */
  const gateRows = useMemo(() => {
    const rows: { key: string; label: string; value: string; state: 'pass' | 'fail' | 'pending' }[] = []
    if (activeGrade) {
      rows.push({
        key: 'result',
        label: '本次结果正确',
        value: activeTone?.label ?? '—',
        state: activeTone?.key === 'correct' ? 'pass' : 'fail',
      })
    }
    rows.push({
      key: 'speed',
      label: '用时压到首次 1/3',
      value: compression != null ? `${compression}%` : '无重做记录',
      state: compression == null ? 'pending' : compression <= 33 ? 'pass' : 'fail',
    })
    rows.push({
      key: 'rule',
      label: '否定式规则能默写',
      value: activeFlow?.rule?.negation ? '待你自测' : '无规则',
      state: 'pending',
    })
    return rows
  }, [activeGrade, activeTone, compression, activeFlow])

  const gatePassed = gateRows.filter((row) => row.state === 'pass').length
  const gateProgress = gateRows.length > 0 ? Math.round((gatePassed / gateRows.length) * 100) : 0

  const buildAiPrompt = useCallback(() => {
    if (!activeGrade) return ''
    const question = questions[activeGrade.questionId]
    const lines: string[] = []
    lines.push(`【刷吧 · 求详解】#${activeGrade.questionId}`)
    lines.push(`考点：${question?.categoryPath ?? '未分类'}`)
    if (activeFlow?.errorCode || activeFlow?.title) {
      lines.push(`断点：${[activeFlow?.errorCode, activeFlow?.title].filter(Boolean).join(' ')}`)
    }
    lines.push(`判定：${activeTone?.label ?? ''}${activeHistory.length > 1 ? ` · 第 ${activeHistory.length} 次作答` : ''}`)
    lines.push('')
    if (question?.stem) {
      lines.push('【题目】')
      lines.push(question.stem)
      lines.push('')
    }
    if (activeFlow?.myEntry) {
      lines.push('【我当时的入口】')
      lines.push(activeFlow.myEntry)
      lines.push('')
    }
    if (activeFlow?.killLine) {
      lines.push('【批改判定的断点】')
      lines.push(activeFlow.killLine)
      lines.push('')
    }
    if (activeGrade.betterSolution) {
      lines.push('【我已看过的解法】← 这段已看过，请不要重复讲')
      lines.push(activeGrade.betterSolution)
      lines.push('')
    }
    lines.push('【我还卡在哪】')
    lines.push(activeFlow?.whyDeadEnd ?? '我知道答案怎么来的，但考场上看到这类结构仍会走回老路。')
    lines.push('我需要的是「识别规则」，不是计算过程。')
    lines.push('')
    lines.push('【请你这样帮我】')
    lines.push('1. 讲清认知根源：为什么我选的入口是死路（讲原理，不列步骤）')
    lines.push('2. 给一条可背诵的否定式识别规则：看到什么特征 → 禁止做什么')
    lines.push('3. 举 2 个只有入口不同、其余几乎一样的对照题让我练眼')
    lines.push('4. 我会在本题上持续追问，请保留上述全部上下文')
    return lines.join('\n')
  }, [activeGrade, activeFlow, activeTone, activeHistory, questions])

  const handleCopyAi = useCallback(async () => {
    const text = buildAiPrompt()
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setToastMsg('⧉ 追问上下文已复制，直接粘贴给 AI')
      setTimeout(() => {
        setCopied(false)
        setToastMsg(null)
      }, 2400)
    } catch {
      setCopyPanelOpen(true)
      setToastMsg('剪贴板不可用，请手动复制下方文本')
      setTimeout(() => setToastMsg(null), 2400)
    }
  }, [buildAiPrompt])

  return (
    <div
      className="ui-overlay pressure-report-overlay plan-d-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pressure-learning-report-title"
      onClick={onClose}
    >
      <div
        className="pressure-report-wrap workbench-mode-wrap plan-d-shell"
        onClick={(e) => e.stopPropagation()}
      >
        <AnimatePresence>
          {introOpen && (
            <motion.div
              className="gi-overlay"
              role="dialog"
              aria-label="本场战报"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.26 } }}
              transition={{ duration: 0.22 }}
              onMouseEnter={() => setIntroPaused(true)}
              onMouseLeave={() => setIntroPaused(false)}
            >
              <motion.div
                className="gi-card"
                initial={{ y: 18, scale: 0.97 }}
                animate={{ y: 0, scale: 1 }}
                exit={{ y: -10, scale: 0.98, transition: { duration: 0.24 } }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              >
                <div className="gi-kicker">
                  <Sparkles size={13} /> 本场战报 · 数一全真复盘
                </div>
                <h2 className="gi-verdict">
                  <MathText value={verdictText} />
                </h2>

                <div className="gi-score-row">
                  <div className="gi-score-main">
                    <span className="gi-score-num">
                      {accuracy != null ? accuracy : '—'}
                      <i>%</i>
                    </span>
                    <span className="gi-score-label">正确率</span>
                  </div>
                  <div className={`gi-tier tone-${ratingTone ?? 'neutral'}`}>
                    <span className="gi-tier-name">{ratingTier ?? '暂无段位'}</span>
                    <span className="gi-tier-rating">
                      Rating {averageRatingScore != null ? averageRatingScore.toFixed(2) : '—'}
                    </span>
                  </div>
                </div>

                <div className="gi-chips" aria-label="核心指标">
                  <span className="gi-chip">
                    <b className="num">{correctCount}</b>
                    <em>正确</em>
                  </span>
                  <span className="gi-chip warn">
                    <b className="num">{partialCount}</b>
                    <em>部分</em>
                  </span>
                  <span className="gi-chip bad">
                    <b className="num">{wrongCount}</b>
                    <em>错误</em>
                  </span>
                  <span className="gi-chip">
                    <b className="num">{kastRate != null ? `${kastRate}%` : '—'}</b>
                    <em>KAST</em>
                  </span>
                  <span className="gi-chip">
                    <b className="num">{formatElapsed(totalDuration * 1000)}</b>
                    <em>总耗时</em>
                  </span>
                  <span className="gi-chip">
                    <b className="num">{evidenceCoverage}/{gradedCount}</b>
                    <em>六维证据</em>
                  </span>
                </div>

                {highlightCounts.donk + highlightCounts.clutch > 0 && (
                  <div className="gi-highlights">
                    {highlightCounts.donk > 0 && (
                      <span className="gi-high donk">👑 DONK 级秒杀 × {highlightCounts.donk}</span>
                    )}
                    {highlightCounts.clutch > 0 && (
                      <span className="gi-high clutch">⚡ 高难度突破 × {highlightCounts.clutch}</span>
                    )}
                  </div>
                )}

                {ungradedIds.length > 0 && (
                  <p className="gi-note">
                    另有 {ungradedIds.length} 题未获批改证据，未计入正确率
                  </p>
                )}

                <div className="gi-foot">
                  <button
                    type="button"
                    className="gi-enter"
                    onClick={() => setIntroOpen(false)}
                  >
                    进入复盘
                    <ArrowRight size={15} />
                  </button>
                  <span className="gi-hint">
                    {introPaused ? '已暂停，移开鼠标继续倒计时' : '5 秒后自动进入 · 悬停可暂停'}
                  </span>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="wrap">
          
          {/* ---------- 顶栏 Topbar ---------- */}
          <div className="topbar">
            <div>
              <span className="brand">
                <b>刷吧</b>数一全真诊断
              </span>
              <span className="meta mono">
                {report.sourceTaskId || report.confirmedAt || 'SSB-BATCH'} · {reportDate.toISOString().slice(0, 10)} · {totalCount} 题 · {subjectDistribution}
              </span>
            </div>
            <div className="tabs">
              <span className="tab active">步骤推导演盘</span>
              <button
                type="button"
                className="tab gi-replay-tab"
                title="重看本场开场数据"
                onClick={replayIntro}
              >
                重看开场
              </button>
            </div>
            <div className="right">
              <button
                type="button"
                className="iconbtn"
                title="六维证据"
                onClick={() => setRatingEvidenceOpen((o) => !o)}
              >
                六维
              </button>
              <button
                type="button"
                className="iconbtn"
                title="刷新诊断结果"
                disabled={loading}
                onClick={onRefresh}
              >
                {loading ? <LoaderCircle className="spin" size={13} /> : '↻'}
              </button>
              <button
                type="button"
                className="iconbtn"
                title="关闭"
                onClick={onClose}
                aria-label="关闭报告"
              >
                ✕
              </button>
            </div>
          </div>

          {/* 本轮结论：先说清"要修什么"，正确率退到右侧指标 */}
          {headline && (
            <div className="bp-verdict">
              <div className="bp-verdict-main">
                <div className="bp-kick">本轮结论 · 先读这一条</div>
                <h2>{headline}</h2>
                <p>
                  共 {breakpointGroups.length} 个断点
                  {relapseCount > 0 ? ` · 其中 ${relapseCount} 个是复发` : ''}
                  {breakpointGroups.some((group) => !group.errorCode)
                    ? ' · 有断点尚未编码，批改回传时可补 errorCode'
                    : ''}
                </p>
              </div>
              <div className="bp-verdict-stats">
                <div>
                  <span className="k">断点</span>
                  <span className="v num bad">{breakpointGroups.length}</span>
                </div>
                <div>
                  <span className="k">复发</span>
                  <span className="v num bad">{relapseCount}</span>
                </div>
                <div>
                  <span className="k">真掌握</span>
                  <span className="v num ok">{correctCount}</span>
                </div>
                <div>
                  <span className="k">对 / 半 / 错</span>
                  <span className="v num">
                    {correctCount} / {partialCount} / {wrongCount}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 六维证据抽屉 */}
          {ratingEvidenceOpen && (
            <section className="report-rating-panel report-evidence-panel ivy-evidence-panel" aria-label="评分证据" style={{ marginBottom: 12 }}>
              <div className="report-rating-heading">
                <div>
                  <span className="report-kicker"><Activity size={14} /> 评分证据 · {reportStatus === 'complete' ? '完整' : '有限'}</span>
                  <h3>六维战力特征与考场预测</h3>
                  <p>仅展示已有结构化行为证据；缺失维度不会被粗暴当作 0 分。</p>
                </div>
                <div className="report-rating-total">
                  <div className="rating-num-row">
                    <strong className={`rating-number rating-${ratingTone}`}>{averageRatingScore != null ? averageRatingScore.toFixed(2) : '—'}</strong>
                    {averageRatingScore != null && <RatingBadge value={averageRatingScore} tier={ratingTier} />}
                  </div>
                  <span className="rating-exam-subtext">🎯 考场预测分 {examPrediction != null ? `${examPrediction} / 150` : '本组不足以估算'}</span>
                </div>
              </div>
              {grades.length > 0 ? (
                <div className="report-rating-chart" role="list" aria-label="逐题 rating 分布">
                  {grades.map((grade, index) => {
                    const score = ratingScores[index]
                    const accent = csRatingAccent(score)
                    const isDonk = accent === 'donk'
                    const isClutch = accent === 'clutch'
                    const tone = gradeTone(grade)
                    return (
                      <div className="report-rating-column" key={`${grade.questionId}-${index}`} role="listitem">
                        <div className={`report-rating-value rating-${csRatingTone(score)}`}>
                          {score != null ? score : '—'}
                          {isDonk ? (
                            <span className="donk-spark-tag" title="👑 DONK 级秒杀突破！">👑</span>
                          ) : isClutch ? (
                            <span className="clutch-spark-tag" title="⚡ 高难度突破">⚡</span>
                          ) : null}
                        </div>
                        <div className="report-rating-track">
                          <div
                            className={`report-rating-fill tone-${accent}`}
                            style={{ height: `${Math.min(100, Math.max(8, ((score ?? 0) / CS_RATING_MAX) * 100))}%` }}
                          />
                        </div>
                        <button
                          type="button"
                          className="report-rating-target-button"
                          onClick={() => {
                            setSelectedGradeIndex(index)
                          }}
                        >
                          <span className={`rating-q-badge verdict-${tone.key}`}>{index + 1}</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="report-rating-empty">暂无单题 Rating 数据</div>
              )}

              {/* 六维雷达 */}
              <div className="report-rating-dimensions">
                <div className="report-radar-wrap">
                  {hasFullDimensionEvidence ? (
                    <Radar
                      className="report-radar"
                      dimensions={ratingDimensions.map((d) => ({ key: d.key, label: d.label, value: d.value as number }))}
                      width={280}
                      height={220}
                      cx={140}
                      cy={104}
                      radius={78}
                      labelRadius={93.6}
                      labelAnchorMode="center"
                      gridClassName="report-radar-grid"
                      axisClassName="report-radar-axis"
                      shapeClassName="report-radar-shape"
                      dotVariant="simple"
                      dotRadius={3.5}
                      dotClassName="report-radar-dot"
                      labelClassName="report-radar-label"
                      role="img"
                      ariaLabel="本次作答六维 rating 雷达图"
                      title="本次作答六维 rating"
                    />
                  ) : (
                    <div className="report-evidence-state">
                      <strong>六维雷达暂不绘制</strong>
                      <span>当前仅有 {evidenceCoverage}/{gradedCount} 题具备结构化维度证据。</span>
                    </div>
                  )}
                </div>
                <div className="report-dimension-list">
                  <div className="dimension-kast-banner">
                    <span>🛡️ KAST 防白给指数（六维证据 {evidenceCoverage}/{grades.length} 题）</span>
                    <strong>{kastRate != null ? `${kastRate}%` : '—'}</strong>
                  </div>
                  {ratingDimensions.map((item) => (
                    <div className="report-dimension-row" key={item.key}>
                      <span>{item.label}</span>
                      <strong>{item.value != null ? item.value : '无证据'}</strong>
                      {item.value != null ? (
                        <MetricBar value={item.value} trackTag="i" fillTag="b" />
                      ) : (
                        <span className="report-dimension-no-evidence">未采集</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* ---------- 双模态主区域 ---------- */}
          {
            <div className="grid">
              
              {/* ============ LEFT: 成绩卡与题目索引 ============ */}
              <aside className="col">
                <div className="bp-summary">
                  <div className="bp-ring">
                    <b className="num">{breakpointGroups.length}</b>
                  </div>
                  <div className="bp-summary-txt">
                    <div className="a">本轮断点</div>
                    <div className="b">
                      {relapseCount > 0 ? `${relapseCount} 个复发 · ` : ''}
                      {breakpointGroups.filter((group) => !group.errorCode).length > 0
                        ? `${breakpointGroups.filter((group) => !group.errorCode).length} 个未编码`
                        : '全部已编码'}
                      <br />
                      总耗时 {formatElapsed(totalDuration * 1000)} · 均题 {formatElapsed(averageDuration * 1000)}
                    </div>
                  </div>
                </div>

                <div className="bp-hd">
                  <h2>断点清单</h2>
                  <span className="hint mono">J / K</span>
                </div>

                <div className="bp-list">
                  {breakpointGroups.map((group) => {
                    const isActive = group.indices.includes(selectedGradeIndex)
                    return (
                      <div
                        key={group.key}
                        className={`bp-item ${isActive ? 'on' : ''}`}
                        onClick={() => setSelectedGradeIndex(group.indices[0])}
                      >
                        <div className="bp-r1">
                          {group.errorCode ? (
                            <span className="bp-code">{group.errorCode}</span>
                          ) : (
                            <span className="bp-code none">未编码</span>
                          )}
                          {group.severity ? (
                            <span className={`bp-lv ${group.severity.toLowerCase()}`}>{group.severity}</span>
                          ) : null}
                          <span className={`bp-st ${group.state === 'relapse' ? 'relapse' : 'new'}`}>
                            {group.state === 'relapse' ? '复发' : '新增'}
                          </span>
                        </div>
                        <div className="bp-nm">{group.title}</div>
                        <div className="bp-qs">
                          {group.questionIds.map((id) => `#${id}`).join(' · ')}
                          {group.historyTotal > 1
                            ? ` · 历史 ${group.historyWrong}/${group.historyTotal} 错`
                            : ''}
                        </div>
                      </div>
                    )
                  })}
                  {breakpointGroups.length === 0 && (
                    <div className="bp-empty">本轮没有需要修复的断点，全部通过。</div>
                  )}
                </div>

                <div className="bp-split">
                  <span>全部 {grades.length} 题</span>
                  <button
                    type="button"
                    className="bp-toggle"
                    onClick={() => setRailFilter(railFilter === 'all' ? 'needs-attention' : 'all')}
                  >
                    {railFilter === 'all' ? '只看待攻坚' : '显示全部'}
                  </button>
                </div>

                <div className="bp-mini-list">
                  {railEntries.map(({ grade, index }) => {
                    const q = questions[grade.questionId]
                    const tone = gradeTone(grade)
                    const isBad = tone.key === 'wrong'
                    const isActive = index === selectedGradeIndex
                    const dur = getQuestionDurationInfo(grade)

                    return (
                      <div
                        key={`mini-${grade.questionId}-${index}`}
                        className={`bp-mini ${isActive ? 'on' : ''}`}
                        onClick={() => setSelectedGradeIndex(index)}
                      >
                        <i className={`d ${isBad ? 'bad' : 'ok'}`} />
                        <span className="qid num">#{grade.questionId}</span>
                        <span className="cat">{q?.categoryPath?.split('/').pop()?.trim() || '考点'}</span>
                        <span className="t num">{formatElapsed(dur.duration * 1000)}</span>
                      </div>
                    )
                  })}
                </div>
              </aside>

              {/* ============ MIDDLE: 题目详情 ============ */}
              <main className="col">
                {activeGrade ? (
                  <>
                    <div className="qhd">
                      <div className="kicker">
                        <span className="pid">#{activeGrade.questionId}</span>
                        <span className="cat">{activeQuestion?.categoryPath || '高等数学 / 综合大题'}</span>
                      </div>
                      <div className="qtitle">
                        第 {activeIndex + 1} 题 · {activeQuestion?.categoryPath?.split('/').pop()?.trim() || '综合考点'}
                      </div>
                      <div className="qmeta">
                        <span className={`tag ${activeTone?.key === 'correct' ? 'ok' : activeTone?.key === 'partial' ? 'warn' : 'bad'}`}>
                          {activeTone?.label}
                        </span>
                        {activeTone?.key !== 'correct' && (
                          <span className="tag fix">
                            {activeSev?.badge || '⚠ 路径待纠偏'}
                          </span>
                        )}
                        <span className="tag plain">difficulty {activeQuestion?.difficulty || 2}</span>
                        <span className="tag plain num">
                          本次 {formatElapsed((activeDurInfo?.duration || 0) * 1000)} · 预算 {formatElapsed((activeDurInfo?.benchmark || 180) * 1000)}
                        </span>
                      </div>
                    </div>

                    <div className="qbody">
                      {/* 真实题干 */}
                      {activeQuestion && (
                        <div className="stem">
                          <MathText value={activeQuestion.stem} />
                        </div>
                      )}

                      {/* 本题维度 vs 本组基线：取 grade.dimensions，不再用全组均值冒充单题 */}
                      {activeDimRows.some((row) => row.value != null) && (
                        <div className="bp-dims">
                          <div className="bp-dims-hd">
                            <span>本题 / 本组基线</span>
                            {activeInsight ? <b>{activeInsight}</b> : null}
                          </div>
                          <div className="bp-dims-grid">
                            {activeDimRows.map((row) => (
                              <div className="bp-dim" key={row.key}>
                                <div className="bp-dim-top">
                                  <span className="lb">{row.label}</span>
                                  <span
                                    className={`vv ${
                                      row.delta != null && row.delta < 0
                                        ? 'down'
                                        : row.delta != null && row.delta > 0
                                          ? 'up'
                                          : ''
                                    }`}
                                  >
                                    {row.value != null ? Math.round(row.value) : '—'}
                                    {row.delta != null && row.delta !== 0
                                      ? ` (${row.delta > 0 ? '+' : ''}${row.delta})`
                                      : ''}
                                  </span>
                                </div>
                                <div className="bp-dim-bar">
                                  <i className="base" style={{ width: `${row.base ?? 0}%` }} />
                                  <i
                                    className={`cur ${row.delta != null && row.delta < 0 ? 'down' : ''}`}
                                    style={{ width: `${row.value ?? 0}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="bp-flow">
                        {/* 01 你当时的入口 */}
                        {activeFlow?.myEntry ? (
                          <section className="bp-step">
                            <div className="bp-step-n" data-n="01" />
                            <div className="bp-step-body">
                              <div className="bp-step-t">
                                你当时的入口
                                {compression != null && activeDurInfo ? (
                                  <span className="bp-cmp">
                                    首次 {formatElapsed((firstDuration ?? 0) * 1000)} → 本次{' '}
                                    <b>{formatElapsed(activeDurInfo.duration * 1000)}</b>（{compression}%）
                                  </span>
                                ) : null}
                              </div>
                              <div className="bp-mine">
                                <MathText value={activeFlow.myEntry} />
                              </div>
                            </div>
                          </section>
                        ) : null}

                        {/* 02 断点一句话 */}
                        {activeFlow?.killLine ? (
                          <section className="bp-step kill">
                            <div className="bp-step-n" data-n="02" />
                            <div className="bp-step-body">
                              <div className="bp-step-t">断点 · 一句话</div>
                              <div className="bp-kill">
                                <SafeClampedText value={activeFlow.killLine} />
                                {activeGrade && typeof activeGrade.confidence === 'number' ? (
                                  <div className="bp-src mono">
                                    codex 批改 · 置信 {Math.round(activeGrade.confidence * 100)}%
                                    {activeFlow.errorCode ? ` · ${activeFlow.errorCode}` : ''}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </section>
                        ) : null}

                        {/* 03 为什么这条是死路 */}
                        {activeFlow?.whyDeadEnd ? (
                          <section className="bp-step">
                            <div className="bp-step-n" data-n="03" />
                            <div className="bp-step-body">
                              <div className="bp-step-t">为什么这条是死路 · 讲原理，不讲步骤</div>
                              <div className="bp-why">
                                <SafeClampedText value={activeFlow.whyDeadEnd} />
                              </div>
                            </div>
                          </section>
                        ) : null}

                        {/* 04 正确入口：路径对照 / 推导 双视图 + 延迟揭示 */}
                        {activeFlow?.fork?.standardPath || activeGrade?.betterSolution ? (
                          <section className="bp-step">
                            <div className="bp-step-n" data-n="04" />
                            <div className="bp-step-body">
                              <div className="bp-step-t">
                                正确入口
                                <span className="bp-viewswitch">
                                  <button
                                    type="button"
                                    className={solutionView === 'fork' ? 'on' : ''}
                                    onClick={() => setSolutionView('fork')}
                                  >
                                    路径对照
                                  </button>
                                  <button
                                    type="button"
                                    className={solutionView === 'derive' ? 'on' : ''}
                                    onClick={() => setSolutionView('derive')}
                                  >
                                    推导
                                  </button>
                                </span>
                              </div>

                              <div className={`bp-soln ${solutionRevealed ? 'unlocked' : 'locked'}`}>
                                {solutionView === 'fork' ? (
                                  <div className="bp-fork">
                                    <div className="bp-fork-hd">
                                      <span className="mine">我的路径</span>
                                      <span className="gap" />
                                      <span className="std">标准路径</span>
                                    </div>
                                    <div className="bp-fork-row fork">
                                      <div className="cell">
                                        <span className="sn">
                                          第 {activeFlow?.fork?.step ?? 1} 步 ·{' '}
                                          {activeFlow?.fork?.label ?? '路径选择'}
                                        </span>
                                        <span className="kill">
                                          {activeFlow?.fork?.myPath ? (
                                            <MathText value={activeFlow.fork.myPath} />
                                          ) : (
                                            '未记录'
                                          )}
                                        </span>
                                      </div>
                                      <div className="mid">
                                        <span className="dot">⤬</span>
                                      </div>
                                      <div className="cell">
                                        <span className="sn">正解入口</span>
                                        <MathText
                                          value={
                                            activeFlow?.fork?.standardPath ||
                                            activeGrade?.betterSolution ||
                                            ''
                                          }
                                        />
                                      </div>
                                    </div>
                                    {activeFlow?.fork?.consequence ? (
                                      <div className="bp-fork-cons">
                                        走错之后：{activeFlow.fork.consequence}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <div className="bp-derive">
                                    <MathText
                                      value={
                                        activeGrade?.betterSolution ||
                                        activeFlow?.fork?.standardPath ||
                                        ''
                                      }
                                    />
                                  </div>
                                )}

                                {!solutionRevealed ? (
                                  <div className="bp-veil">
                                    <div className="vt">先回想这一步该做什么，推不出来再展开。</div>
                                    <div className="vb">
                                      <button
                                        type="button"
                                        className="mini pri"
                                        onClick={() => setSolutionRevealed(true)}
                                      >
                                        我推过了，看解法
                                      </button>
                                      <button
                                        type="button"
                                        className="mini"
                                        onClick={() => setSolutionRevealed(true)}
                                      >
                                        直接看
                                      </button>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </section>
                        ) : null}

                        {/* 05 否定式识别规则 */}
                        {activeFlow?.rule ? (
                          <section className="bp-step rule">
                            <div className="bp-step-n" data-n="05" />
                            <div className="bp-step-body">
                              <div className="bp-step-t">
                                识别规则 · 动笔前 30 秒口述<span className="bp-say">否定式在前</span>
                              </div>
                              <div className="bp-rule">
                                {activeFlow.rule.negation ? (
                                  <div className="bp-rule-row">
                                    <span className="s no">禁止</span>
                                    <div className="txt">
                                      <MathText value={activeFlow.rule.negation} />
                                    </div>
                                  </div>
                                ) : null}
                                {activeFlow.rule.positive ? (
                                  <div className="bp-rule-row">
                                    <span className="s yes">该做</span>
                                    <div className="txt">
                                      <MathText value={activeFlow.rule.positive} />
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </section>
                        ) : null}

                        {/* 06 明日动作 */}
                        {activeFlow?.nextAction ? (
                          <section className="bp-step act">
                            <div className="bp-step-n" data-n="06" />
                            <div className="bp-step-body">
                              <div className="bp-step-t">明日动作</div>
                              <label className="bp-todo">
                                <input type="checkbox" />
                                <div>
                                  <div className="t1">
                                    <SafeClampedText value={activeFlow.nextAction} />
                                  </div>
                                  <div className="t2">
                                    {activeFlow.acceptance
                                      ? `验收：${activeFlow.acceptance}`
                                      : '完成后回到左栏断点清单复查'}
                                  </div>
                                </div>
                              </label>
                            </div>
                          </section>
                        ) : null}
                      </div>
                    </div>

                    {/* 底部行动条 */}
                    <div className="footact">
                      <div className="pgnav">
                        <kbd>J</kbd> 下一题 · <kbd>K</kbd> 上一题
                      </div>
                      <div className="btns">
                        {onStartVariant && (
                          <button
                            type="button"
                            className="btn"
                            onClick={() => onStartVariant(activeGrade.questionId)}
                          >
                            加练同考点
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn"
                          onClick={() => void handleOpenDetail(activeGrade.questionId)}
                        >
                          原题原卷
                        </button>
                        <button
                          type="button"
                          className={`btn ${activeIsFav ? 'active' : ''}`}
                          onClick={() => void handleToggleFav(activeGrade.questionId)}
                        >
                          {activeIsFav ? '⭐ 已收藏' : '收藏'}
                        </button>
                        <button
                          type="button"
                          className="btn primary"
                          disabled={activeIsAdded}
                          onClick={() => void handleAddToDailyPlan(activeGrade)}
                        >
                          {activeIsAdded ? '已排入复习' : '排入明日复习'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyState icon={ClipboardCheck} title="暂无选中的题目" text="请从左侧选择题目开始复盘。" />
                )}
              </main>

              {/* ============ RIGHT: 断点档案 ============ */}
              <aside className="col">
                <div className="audhd">
                  <div className="colhd" style={{ padding: 0, background: 'transparent', border: 'none' }}>
                    <h2>断点档案</h2>
                    <span className="hint mono">dossier</span>
                  </div>
                </div>

                {activeGrade && (
                  <>
                    {/* --- 断点编码条 --- */}
                    <div className="bp-dos">
                      <div className="bp-codebar">
                        <span className={`bp-code ${activeFlow?.errorCode ? '' : 'none'}`}>
                          {activeFlow?.errorCode ?? '未编码'}
                        </span>
                        <div className="bp-codebar-t">
                          <b>{activeFlow?.title ?? '未命名断点'}</b>
                          <small>
                            {activeFlow?.severity ? SEVERITY_LABEL[activeFlow.severity] : '未分级'}
                            {activeHistory.length > 1
                              ? ` · 第 ${activeHistory.length} 次作答`
                              : ' · 首次作答'}
                            {activeFlow?.errorCode ? null : ' · 旧报告无诊断块'}
                          </small>
                        </div>
                      </div>

                      <div className="errorchips">
                        {activeGrade.errorTags && activeGrade.errorTags.length > 0 ? (
                          activeGrade.errorTags.map((tag) => (
                            <span className="chip" key={`err-${tag}`}>{tag}</span>
                          ))
                        ) : (
                          <span className="chip" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>
                            步骤规范
                          </span>
                        )}
                        {activeGrade.weaknessTags?.map((w) => (
                          <span className="chip weak" key={`weak-${w}`}>{w}</span>
                        ))}
                      </div>
                    </div>

                    {/* --- 修复时间线（真实作答记录，缺数据就是缺，不编） --- */}
                    <div className="bp-sec">
                      <h3>
                        修复时间线 <small>来自历史作答</small>
                      </h3>
                      {activeHistory.length > 0 ? (
                        <div className="bp-tl">
                          {(() => {
                            const maxDur = Math.max(
                              1,
                              ...activeHistory.map((row) => row.durationSeconds || 0),
                            )
                            return activeHistory.map((row, i) => {
                              const mark = outcomeMark(row.verdict ?? row.outcome)
                              return (
                                <div className="bp-tl-row" key={`tl-${row.attemptedAt}-${i}`}>
                                  <div className="bp-tl-d">
                                    <span className="num">{row.attemptedAt.slice(5, 10)}</span>
                                    <span className={`bp-tl-m ${mark.cls}`}>{mark.text}</span>
                                  </div>
                                  <div className="bp-tl-bar">
                                    <i
                                      className={mark.cls}
                                      style={{
                                        width: `${Math.max(
                                          6,
                                          Math.round(((row.durationSeconds || 0) / maxDur) * 100),
                                        )}%`,
                                      }}
                                    />
                                    <span className="num">{formatElapsed((row.durationSeconds || 0) * 1000)}</span>
                                  </div>
                                </div>
                              )
                            })
                          })()}
                          {firstDuration != null && compression != null && activeGrade.duration > 0 && (
                            <div className="bp-tl-note">
                              用时压缩到首次的 <b className="num">{compression}%</b>
                              {compression <= 33 ? ' · 已达「真掌握」门槛' : ' · 未达 1/3，仍算没自动化'}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bp-empty">本题暂无历史作答记录，这是第一次。</div>
                      )}
                    </div>

                    {/* --- 验收判据 --- */}
                    <div className="bp-sec">
                      <h3>
                        验收判据 <small>下次怎么算真会</small>
                      </h3>
                      <div className="bp-gate-txt">
                        {activeFlow?.acceptance ?? (
                          <>
                            合上报告，独立重做本题：不翻解法、不用提示，
                            用时压到首次的 1/3 以内且结果正确——才算这条断点闭合。
                          </>
                        )}
                      </div>
                      <div className="bp-gate">
                        {gateRows.map((row) => (
                          <div className={`bp-gate-row ${row.state}`} key={`gate-${row.key}`}>
                            <span className="bp-gate-i">
                              {row.state === 'pass' ? '✓' : row.state === 'fail' ? '✕' : '○'}
                            </span>
                            <span className="bp-gate-l">{row.label}</span>
                            <span className="bp-gate-v num">{row.value}</span>
                          </div>
                        ))}
                      </div>
                      <div className="bp-gate-bar">
                        <i style={{ width: `${gateProgress}%` }} />
                      </div>
                      <div className="bp-gate-foot">
                        {gatePassed} / {gateRows.length} 项达成
                        {gatePassed === gateRows.length ? ' · 可申请封盘' : ' · 不得封盘'}
                      </div>
                    </div>

                    {/* --- 复制给 AI --- */}
                    <div className="bp-sec">
                      <h3>
                        继续追问 <small>把上下文整包带走</small>
                      </h3>
                      <button
                        type="button"
                        className={`bp-ai-btn ${copied ? 'done' : ''}`}
                        onClick={() => void handleCopyAi()}
                      >
                        {copied ? '✓ 已复制' : '⧉ 复制追问上下文'}
                      </button>
                      <div className="bp-ai-hint">
                        含题面 / 我的入口 / 断点 / 已看过的解法（标注勿重复讲）/ 我要的识别规则
                      </div>
                      {copyPanelOpen && (
                        <textarea
                          className="bp-ai-txt"
                          readOnly
                          value={buildAiPrompt()}
                          onFocus={(e) => e.currentTarget.select()}
                        />
                      )}
                    </div>

                    {/* --- 考场亲笔自省（保留原有写入题本的能力） --- */}
                    <div className="bp-sec">
                      <h3>
                        考场亲笔自省 <small>支持 LaTeX</small>
                      </h3>
                      <div className="notepad">
                        <div className="ttl">
                          <span>✎ 便笺（自动按题号归档）</span>
                          <span className="mono kdb">
                            {activeIsNoteSaved ? '已保存 ✓' : '⌘+S'}
                          </span>
                        </div>
                        <textarea
                          placeholder="写下你考场上的真实反应：识别到了什么 → 卡在哪 → 下次怎么拦。&#10;&#10;明日复习前先读这条。"
                          value={userNotes[activeGrade.questionId] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value
                            setUserNotes((prev) => ({ ...prev, [activeGrade.questionId]: val }))
                          }}
                          onBlur={() => {
                            void handleSaveQuestionNote(activeGrade.questionId, userNotes[activeGrade.questionId] ?? '')
                          }}
                        />
                        <div className="meta">
                          <span>
                            {userNotes[activeGrade.questionId] ? '已存到题本' : '暂无草稿'}
                          </span>
                          <span className={`save ${activeIsNoteSaved ? 'show' : ''}`}>
                            {activeIsSavingNote ? '保存中…' : '已自动同步到题本'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </aside>

            </div>
          }

        </div>
      </div>

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
              onStartVariant?.(detailQuestion.id)
            }}
            onChange={(updated) => {
              setDetailQuestion(updated)
              setFavoriteMap((prev) => ({ ...prev, [updated.id]: updated.favorite }))
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
