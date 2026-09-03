import {
  Activity,
  ArrowRight,
  ClipboardCheck,
  Clock3,
  LoaderCircle,
  Sparkles,
} from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { addDailyPlanItem, addToCustomQueue, getQuestion, saveNote, toggleFavorite } from '../api'
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
  buildReportViewModel,
  filterReportEntries,
} from '../domain/reportViewModel'
import { MathText } from './MathText'
import { EmptyState } from './EmptyState'
import { QuestionDetail } from './QuestionDetailModal'
import { Radar } from './ui/Radar'
import { RatingBadge } from './ui/RatingBadge'
import { MetricBar } from './ui/MetricBar'
import type {
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
  const [questionFilter, setQuestionFilter] = useState<'needs-attention' | 'all' | 'correct'>('needs-attention')
  const [ratingEvidenceOpen, setRatingEvidenceOpen] = useState(false)
  const [inspectorTab, setInspectorTab] = useState<'audit' | 'taxonomy' | 'notes'>('audit')
  const [userNotes, setUserNotes] = useState<Record<number, string>>({})
  const [noteSaving, setNoteSaving] = useState<Record<number, boolean>>({})
  const [noteSavedNotice, setNoteSavedNotice] = useState<Record<number, boolean>>({})
  const [planAdded, setPlanAdded] = useState<Record<number, boolean>>({})
  const [viewMode, setViewMode] = useState<'workbench' | 'overview'>('workbench')
  const [railFilter, setRailFilter] = useState<'all' | 'needs-attention'>('needs-attention')

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
    attentionEntries,
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

      if (!isInput && viewMode === 'workbench') {
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
  }, [viewMode, detailQuestion, handleNextQuestion, handlePrevQuestion])

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
  const reportTime = report.confirmedAt ?? report.createdAt
  const reportDate = new Date(reportTime < 1_000_000_000_000 ? reportTime * 1000 : reportTime)
  const visibleEntries = filterReportEntries(grades, questionFilter)

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

  return (
    <div
      className="ui-overlay pressure-report-overlay plan-d-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pressure-learning-report-title"
      onClick={onClose}
    >
      <div
        className={`pressure-report-wrap ${viewMode === 'workbench' ? 'workbench-mode-wrap' : 'overview-mode-wrap'} plan-d-shell`}
        onClick={(e) => e.stopPropagation()}
      >
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
              <button
                type="button"
                className={`tab ${viewMode === 'workbench' ? 'active' : ''}`}
                onClick={() => setViewMode('workbench')}
              >
                步骤推导演盘
              </button>
              <button
                type="button"
                className={`tab ${viewMode === 'overview' ? 'active' : ''}`}
                onClick={() => setViewMode('overview')}
              >
                长卷通览
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
          {viewMode === 'workbench' ? (
            <div className="grid">
              
              {/* ============ LEFT: 成绩卡与题目索引 ============ */}
              <aside className="col">
                <div className="scorecard">
                  <div className="scorekicker">本次训练 · {totalCount} 题</div>
                  <div className="scorenum num">
                    {accuracy != null ? accuracy : 100}
                    <small>%</small>
                  </div>
                  <div className="scoreline">
                    正确率（{correctCount} / {totalCount}）· <span className="mono" style={{ color: 'var(--t3)' }}>均题 {formatElapsed(averageDuration * 1000)}</span>
                  </div>
                  <div className="kastrow">
                    证据覆盖 <b>{evidenceCoverage} / {totalCount}</b> 题具备维度数据
                  </div>
                  <div className="miniStats">
                    <div className="m">
                      <div className="k">对 / 半 / 错</div>
                      <div className="v num">{correctCount} / {partialCount} / {wrongCount}</div>
                    </div>
                    <div className="m">
                      <div className="k">总耗时</div>
                      <div className="v num">{formatElapsed(totalDuration * 1000)}</div>
                    </div>
                    <div className="m">
                      <div className="k">真掌握</div>
                      <div className="v num ok">{correctCount} 题</div>
                    </div>
                    <div className="m">
                      <div className="k">待攻坚</div>
                      <div className="v num bad">{wrongCount + partialCount} 题</div>
                    </div>
                  </div>
                </div>

                <div className="probhd">
                  <span className="title">
                    题目索引<small>J / K</small>
                  </span>
                  <div className="pfilter">
                    <button
                      type="button"
                      className={`f ${railFilter === 'needs-attention' ? 'active' : ''}`}
                      onClick={() => setRailFilter('needs-attention')}
                    >
                      待攻坚 {attentionEntries.length}
                    </button>
                    <button
                      type="button"
                      className={`f ${railFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setRailFilter('all')}
                    >
                      全部 {grades.length}
                    </button>
                  </div>
                </div>

                <div className="problist">
                  {railEntries.map(({ grade, index }) => {
                    const q = questions[grade.questionId]
                    const tone = gradeTone(grade)
                    const isBad = tone.key === 'wrong'
                    const isActive = index === selectedGradeIndex
                    const dur = getQuestionDurationInfo(grade)
                    const catShort = q?.categoryPath?.split('/').pop()?.trim() || '考点'

                    return (
                      <div
                        key={`${grade.questionId}-${index}`}
                        className={`prob ${isBad ? 'is-bad' : ''} ${isActive ? 'active' : ''}`}
                        onClick={() => setSelectedGradeIndex(index)}
                      >
                        <div className="ord">§ {index + 1}</div>
                        <div className="meta">
                          <div className="qid num">#{grade.questionId}</div>
                          <div className="qcat" title={q?.categoryPath || catShort}>{catShort}</div>
                        </div>
                        <div className="qtime num">
                          <b>{formatElapsed(dur.duration * 1000)}</b>
                          <span className={`cm ${isBad ? 'fix' : 'good'}`}>
                            {isBad ? '仍错' : dur.isOvertime ? '超时' : '达标'}
                          </span>
                        </div>
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

                      {/* 真实维度小条 */}
                      <div className="dimstrip">
                        {ratingDimensions.slice(0, 4).map((d) => {
                          const val = d.value != null ? Number(d.value) : 0
                          const pct = Math.min(100, Math.max(0, val * 10))
                          return (
                            <div className="d" key={d.key}>
                              <div className="n">{d.label}</div>
                              <div className="bar"><i style={{ width: `${pct}%` }}></i></div>
                              <div className="v num">
                                <span>{d.value != null ? val.toFixed(1) : '—'}</span>
                                <span className="na">/ 10</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* 朱批：earliestError 最早断点 */}
                      {(activeGrade.earliestError || activeGrade.feedback) && (
                        <div className="redmark">
                          <div className="lbl">
                            <span className="ttl">⚠ 最早断点</span>
                            <span className="src">codex · 批改输出</span>
                          </div>
                          <p>
                            <SafeClampedText value={activeGrade.earliestError || activeGrade.feedback || ''} />
                          </p>
                        </div>
                      )}

                      {/* betterSolution 标准解法折叠 */}
                      {activeGrade.betterSolution && (
                        <details className="fold" open>
                          <summary>标准解法（codex 推荐路径）</summary>
                          <div className="fb">
                            <MathText value={activeGrade.betterSolution} />
                          </div>
                        </details>
                      )}

                      {/* advice 考场专项抢救指令折叠 */}
                      {activeGrade.advice && (
                        <details className="fold">
                          <summary>考场专项抢救指令</summary>
                          <div className="fb">
                            <SafeClampedText value={activeGrade.advice} />
                          </div>
                        </details>
                      )}
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

              {/* ============ RIGHT: 审计与便笺 ============ */}
              <aside className="col">
                <div className="audhd">
                  <div className="colhd" style={{ padding: 0, background: 'transparent', border: 'none' }}>
                    <h2>本题审计</h2>
                    <span className="hint mono">audit</span>
                  </div>
                </div>

                <div className="tabs2">
                  <button
                    type="button"
                    className={inspectorTab === 'audit' ? 'active' : ''}
                    onClick={() => setInspectorTab('audit')}
                  >
                    断点旁注
                  </button>
                  <button
                    type="button"
                    className={inspectorTab === 'taxonomy' ? 'active' : ''}
                    onClick={() => setInspectorTab('taxonomy')}
                  >
                    同源错题
                  </button>
                  <button
                    type="button"
                    className={inspectorTab === 'notes' ? 'active' : ''}
                    onClick={() => setInspectorTab('notes')}
                  >
                    自省便笺
                  </button>
                </div>

                {activeGrade && (
                  <>
                    <div className="audsec">
                      <h3>
                        错误标签 <small>来自 codex 标签</small>
                      </h3>
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

                      <h3 style={{ marginTop: 16 }}>
                        本题扣分明细 <small>基于已采集的 + / -</small>
                      </h3>
                      <div className="audempty">
                        <b>考场切片评分</b><br />
                        {activeTone?.key === 'correct'
                          ? '步骤推导完整严谨，未触发扣分断点。'
                          : '推导过程中触发概念边界或计算失误断点，扣除相应分值。'}
                      </div>

                      <h3 style={{ marginTop: 16 }}>
                        同考点历史作答 <small>{activeQuestion?.categoryPath?.split('/').pop() || '相关题'}</small>
                      </h3>
                      <div className="peerrow">
                        <div className={`b ${activeTone?.key === 'correct' ? 'ok' : ''}`}>
                          #{activeGrade.questionId}
                        </div>
                        <div className="t">
                          <div className="id num">本次 · {formatElapsed((activeDurInfo?.duration || 0) * 1000)}</div>
                          <div className="desc">{activeTone?.label} · {activeSev?.badge || '作答记录'}</div>
                        </div>
                        <div className="cnt">{activeTone?.key === 'correct' ? '真掌握' : '待攻坚'}</div>
                      </div>
                    </div>

                    <div className="audsec" style={{ borderTop: '1px solid var(--line-soft)', background: 'var(--paper)' }}>
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
          ) : (
            /* ---------- 长卷通览模式 ---------- */
            <div className="examination-overview-scroll plan-d-overview">
              <section className="report-hero-card" aria-label="战况精报" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: 20 }}>
                <div className="report-hero-top-row">
                  <div className="report-hero-headline">
                    <span className="report-hero-kicker"><Sparkles size={13} /> 5 秒战况定性 · 数一全真复盘精报</span>
                    <h3 style={{ fontSize: 18, fontWeight: 700, margin: '6px 0', color: 'var(--t1)' }}>
                      <MathText value={verdictText} />
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--t2)' }}>
                      已批改 {gradedCount} / {totalCount} 题 · 正确 {correctCount}，部分 {partialCount}，错误 {wrongCount}
                      {ungradedIds.length > 0 ? ` · 另有 ${ungradedIds.length} 题未获证据` : ''}
                    </p>
                  </div>

                  <div className="report-hero-metrics" aria-label="核心指标">
                    <div className="hero-metric-chip highlight">
                      <span className="chip-num num">{accuracy != null ? `${accuracy}%` : '—'}</span>
                      <span className="chip-label">正确率</span>
                    </div>
                    <div className="hero-metric-chip">
                      <span className="chip-num num" style={{ color: 'var(--ok)' }}>{averageRatingScore != null ? averageRatingScore.toFixed(2) : '—'}</span>
                      <span className="chip-label">{ratingTier ? `${ratingTier} 档` : 'Rating'}</span>
                    </div>
                    <div className="hero-metric-chip">
                      <span className="chip-num num">{formatElapsed(totalDuration * 1000)}</span>
                      <span className="chip-label">均题 {formatElapsed(averageDuration * 1000)}</span>
                    </div>
                    <div className="hero-metric-chip">
                      <span className="chip-num num">{evidenceCoverage}/{gradedCount}</span>
                      <span className="chip-label">{kastRate != null ? `KAST ${kastRate}%` : '证据覆盖'}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* 逐题列表 */}
              <section className="report-questions" style={{ marginTop: 14 }}>
                <div className="report-questions-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 600 }}>逐题步骤诊断与断点复盘</h3>
                  </div>
                  <div className="pfilter">
                    <button
                      type="button"
                      className={`f ${questionFilter === 'needs-attention' ? 'active' : ''}`}
                      onClick={() => setQuestionFilter('needs-attention')}
                    >
                      待攻坚 ({attentionEntries.length})
                    </button>
                    <button
                      type="button"
                      className={`f ${questionFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setQuestionFilter('all')}
                    >
                      全部 ({grades.length})
                    </button>
                    <button
                      type="button"
                      className={`f ${questionFilter === 'correct' ? 'active' : ''}`}
                      onClick={() => setQuestionFilter('correct')}
                    >
                      完全正确 ({correctCount})
                    </button>
                  </div>
                </div>

                <div className="report-question-layout">
                  <div className="report-question-list">
                    {visibleEntries.map(({ grade, index }) => {
                      const question = questions[grade.questionId]
                      const tone = gradeTone(grade)
                      const durInfo = getQuestionDurationInfo(grade)

                      return (
                        <article
                          id={`report-q-${index}`}
                          key={`${grade.questionId}-${index}`}
                          className={`tactical-q-item ${tone.key}`}
                          style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: 14, marginBottom: 10 }}
                        >
                          <header className="report-question-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div>
                              <span style={{ fontWeight: 700, fontSize: 13, marginRight: 8 }}>
                                § {index + 1} · #{grade.questionId}
                              </span>
                              {question && (
                                <span style={{ fontSize: 11.5, color: 'var(--t2)' }}>
                                  {question.categoryPath}
                                </span>
                              )}
                            </div>
                            <div>
                              <span className={`tag ${tone.key === 'correct' ? 'ok' : tone.key === 'partial' ? 'warn' : 'bad'}`} style={{ marginRight: 6 }}>
                                {tone.label}
                              </span>
                              <span className="num" style={{ fontSize: 11.5, color: 'var(--t3)' }}>
                                <Clock3 size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> {formatElapsed(durInfo.duration * 1000)}
                              </span>
                            </div>
                          </header>

                          {question && (
                            <div style={{ fontSize: 13.5, lineHeight: 1.7, background: 'var(--bg)', padding: 10, borderRadius: 6, marginBottom: 8 }}>
                              <MathText value={question.stem} />
                            </div>
                          )}

                          {grade.earliestError && (
                            <div className="redmark" style={{ marginBottom: 6 }}>
                              <div className="lbl"><span className="ttl">⚠ 最早断点</span></div>
                              <p><MathText value={grade.earliestError} /></p>
                            </div>
                          )}

                          {grade.betterSolution && (
                            <details className="fold" style={{ marginBottom: 0 }}>
                              <summary>标准解法</summary>
                              <div className="fb"><MathText value={grade.betterSolution} /></div>
                            </details>
                          )}
                        </article>
                      )
                    })}
                  </div>
                </div>
              </section>

              {/* 底部完成按钮 */}
              <footer style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                <button className="btn primary" style={{ padding: '10px 24px', fontSize: 13 }} onClick={onClose}>
                  <ArrowRight size={14} /> 完成本次考场复盘
                </button>
              </footer>
            </div>
          )}

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
