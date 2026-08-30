import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Heart,
  HelpCircle,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { addToCustomQueue, getQuestion, toggleFavorite } from '../api'
import {
  CS_RATING_MAX,
  averageCsRating,
  csRatingAccent,
  csRatingTier,
  csRatingTone,
  gradeOutcomeKey,
  gradeToCsRating,
  formatElapsed,
  predictedExamScore,
  type GradeOutcome,
} from '../utils'
import { MathText } from './MathText'
import { EmptyState } from './EmptyState'
import { QuestionDetail } from './QuestionDetailModal'
import { Radar } from './ui/Radar'
import { RatingBadge } from './ui/RatingBadge'
import { MetricBar } from './ui/MetricBar'
import type { GradingReport, PressureSession, Question } from '../types'

// ============ 阶段五：报告阅读体验 ============

type DimKey = 'rigor' | 'computation' | 'modeling' | 'methodUse' | 'speed' | 'strategyInsight'

const DIM_LABELS: Record<DimKey, string> = {
  rigor: '严谨性',
  computation: '计算力',
  modeling: '审题建模',
  methodUse: '方法使用',
  speed: '速度',
  strategyInsight: '策略洞察力',
}

/** 严重度三色（v1.7.0 阶段五）：致命=概念盲区、笔误=瞄准失误、方法=战术绕路 */
type Severity = 'fatal' | 'slip' | 'detour'

const SEVERITY_BY_TAG: Record<string, Severity> = {
  概念盲区: 'fatal',
  概念边界: 'fatal',
  瞄准失误: 'slip',
  计算笔误: 'slip',
  战术绕路: 'detour',
  方法绕路: 'detour',
  方法未掌握: 'detour',
}

const SEVERITY_META: Record<Severity, { label: string; color: string }> = {
  fatal: { label: '致命 · 概念盲区', color: 'var(--danger)' },
  slip: { label: '笔误 · 瞄准失误', color: 'var(--warn)' },
  detour: { label: '方法 · 战术绕路', color: 'var(--cyan)' },
}

function severityOf(grade: GradingReport['grades'][number], fallbackKey: GradeOutcome): Severity {
  const tags = grade.errorTags ?? []
  for (const tag of tags) {
    if (SEVERITY_BY_TAG[tag] === 'fatal') return 'fatal'
  }
  for (const tag of tags) {
    const mapped = SEVERITY_BY_TAG[tag]
    if (mapped) return mapped
  }
  if (fallbackKey === 'wrong') return 'fatal'
  if (fallbackKey === 'partial') return 'slip'
  return 'detour'
}

/** 逐题六维真实证据：score 为 null 的维度不计入（哨兵 S4——不伪造证据） */
function evidenceDims(grade: GradingReport['grades'][number]): {
  key: DimKey
  label: string
  value: number
}[] {
  const dims = grade.dimensions
  if (!dims) return []
  return (Object.keys(DIM_LABELS) as DimKey[])
    .map((key) => ({ key, label: DIM_LABELS[key], value: dims[key]?.score }))
    .filter(
      (d): d is { key: DimKey; label: string; value: number } =>
        typeof d.value === 'number' && Number.isFinite(d.value),
    )
}

/** 逐题重心标签：最高维与最低维差 ≥ 20 时输出模板句（纯前端拼装，不加 AI 调用） */
function focusSentence(grade: GradingReport['grades'][number]): string | null {
  const dims = evidenceDims(grade)
  if (dims.length < 2) return null
  const sorted = [...dims].sort((a, b) => b.value - a.value)
  const top = sorted[0]
  const bottom = sorted[sorted.length - 1]
  if (top.value - bottom.value < 20) return null
  const pair = `${top.key}>${bottom.key}`
  const templates: Record<string, string> = {
    'computation>strategyInsight': '算得动，但没找到路',
    'computation>methodUse': '算得动，但路走错了',
    'modeling>computation': '思路对，算挂了',
    'strategyInsight>computation': '思路对，算挂了',
    'speed>rigor': '手比脑子快',
    'speed>computation': '手比脑子快',
  }
  const verdictText = templates[pair] ?? `强在${top.label}，弱在${bottom.label}`
  return `${DIM_LABELS[top.key]} ${Math.round(top.value)} / ${DIM_LABELS[bottom.key]} ${Math.round(
    bottom.value,
  )} → ${verdictText}`
}

/** 长诊断分层：超过 limit 字默认收起两行，点「展开全文」查看 */
function LongText({ value, limit = 150 }: { value: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false)
  const truncated = value.length > limit && !expanded
  return (
    <div>
      <div style={truncated ? { maxHeight: '3.2em', overflow: 'hidden' } : undefined}>
        <MathText value={value} />
      </div>
      {value.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--cyan)',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 600,
            padding: '2px 0',
          }}
        >
          {expanded ? '收起' : '展开全文'}
        </button>
      )}
    </div>
  )
}

/** 只看错题 / 全部题目 切换按钮样式（阶段五 ②） */
const filterBtnStyle = (active: boolean) => ({
  padding: '4px 12px',
  borderRadius: 16,
  border: '1px solid var(--line)',
  background: active ? 'var(--cyan)' : 'transparent',
  color: active ? 'var(--surface)' : 'var(--muted)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
})

export function PressureLearningReportView({
  report,
  session,
  questions,
  loading,
  onRefresh,
  onClose,
  onStartVariant,
}: {
  report: GradingReport
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
  // 阶段五：逐题折叠与错题过滤
  const [questionFilter, setQuestionFilter] = useState<'all' | 'wrong'>('all')
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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

  const OUTCOME_LABELS: Record<GradeOutcome, string> = {
    correct: '正确',
    partial: '部分正确',
    uncertain: '不确定',
    wrong: '错误',
  }
  const gradeTone = (grade: GradingReport['grades'][number]) => {
    const key = gradeOutcomeKey(grade)
    return { key, label: OUTCOME_LABELS[key] }
  }

  const grades = report.grades ?? []
  const derivedCorrect = grades.filter((grade) => gradeTone(grade).key === 'correct').length
  const derivedPartial = grades.filter((grade) => gradeTone(grade).key === 'partial').length
  const derivedWrong = grades.filter((grade) => gradeTone(grade).key === 'wrong').length
  const derivedUncertain = grades.filter((grade) => gradeTone(grade).key === 'uncertain').length
  const correctCount = report.summary.correctCount ?? derivedCorrect
  const partialCount = report.summary.partialCount ?? derivedPartial
  const wrongCount = report.summary.wrongCount ?? derivedWrong
  const uncertainCount = report.summary.uncertainCount ?? derivedUncertain
  const totalCount = report.summary.totalCount || report.questionIds?.length || grades.length
  const totalDuration =
    report.summary.totalDuration ??
    session?.totalDuration ??
    grades.reduce((sum, grade) => sum + Math.max(0, grade.duration || 0), 0)
  const averageDuration = report.summary.averageDuration ?? Math.round(totalDuration / Math.max(1, totalCount))
  const rawAccuracy = Number.isFinite(report.summary.accuracy) ? report.summary.accuracy : 0
  const accuracy = rawAccuracy <= 1 ? Math.round(rawAccuracy * 100) : Math.round(rawAccuracy)
  const reportTime = report.confirmedAt ?? report.createdAt
  const reportDate = new Date(reportTime < 1_000_000_000_000 ? reportTime * 1000 : reportTime)
  const ungradedIds = report.ungradedQuestionIds ?? []
  const ratingForGrade = (grade: GradingReport['grades'][number]) =>
    gradeToCsRating(grade, averageDuration)
  const ratingScores = grades.map(ratingForGrade)
  const averageRatingScore = averageCsRating(ratingScores) ?? 0
  const ratingTier = csRatingTier(averageRatingScore) ?? 'D'
  const ratingTone = csRatingTone(averageRatingScore)
  // 六维聚合（阶段五口径修正）：只统计真实证据，不再混入 outcome 兜底常量；
  // 证据缺失显示「无证据」而非伪造数值（哨兵 S4）。
  const dimStats = (Object.keys(DIM_LABELS) as DimKey[]).map((key) => {
    const values = grades
      .map((grade) => grade.dimensions?.[key]?.score)
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
    return {
      key,
      label: DIM_LABELS[key],
      value: values.length
        ? Math.round(values.reduce((sum, score) => sum + score, 0) / values.length)
        : null,
      count: values.length,
    }
  })
  const ratingDimensions = dimStats.map((d) => ({ ...d }))
  const evidenceCoverage = grades.filter((grade) => evidenceDims(grade).length > 0).length
  // KAST 仍按内核口径 0.5 严谨 + 0.3 计算 + 0.2 建模；证据全缺退回中性 75（考场预估用）
  const kastRate = (() => {
    const rigor = dimStats.find((d) => d.key === 'rigor')?.value
    const computation = dimStats.find((d) => d.key === 'computation')?.value
    const modeling = dimStats.find((d) => d.key === 'modeling')?.value
    if (rigor == null && computation == null && modeling == null) return null
    return Math.round(0.5 * (rigor ?? 75) + 0.3 * (computation ?? 75) + 0.2 * (modeling ?? 75))
  })()
  const examPrediction = predictedExamScore(averageRatingScore, kastRate ?? 75)

  // 错题重心（改造二 3.2）：只聚合做错/部分正确作答的真实六维证据
  const wrongGrades = grades.filter((grade) => ['wrong', 'partial'].includes(gradeTone(grade).key))
  const wrongDimStats = (Object.keys(DIM_LABELS) as DimKey[]).map((key) => {
    const values = wrongGrades
      .map((grade) => grade.dimensions?.[key]?.score)
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
    return {
      key,
      label: DIM_LABELS[key],
      value: values.length
        ? Math.round(values.reduce((sum, score) => sum + score, 0) / values.length)
        : null,
    }
  })
  const wrongDimsPresent = wrongDimStats.filter(
    (d): d is { key: DimKey; label: string; value: number } => d.value != null,
  )
  const strongestWrongDim =
    wrongDimsPresent.length >= 2 ? [...wrongDimsPresent].sort((a, b) => b.value - a.value)[0] : null
  const weakestWrongDim =
    wrongDimsPresent.length >= 2 ? [...wrongDimsPresent].sort((a, b) => a.value - b.value)[0] : null

  // 结论前置（阶段五 ①）：模板 + 数据拼装，不需要 AI
  const weaknessTally = new Map<string, number>()
  grades.forEach((grade) => {
    if (gradeOutcomeKey(grade) === 'correct') return
    for (const tag of grade.weaknessTags ?? []) {
      weaknessTally.set(tag, (weaknessTally.get(tag) ?? 0) + 1)
    }
  })
  const topWeakness = [...weaknessTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const worstGradeEntry = grades
    .filter((grade) => gradeOutcomeKey(grade) === 'wrong')
    .map((grade) => ({ grade, rating: ratingForGrade(grade) }))
    .sort((a, b) => a.rating - b.rating)[0] ?? null
  const worstGradeIndex = worstGradeEntry ? grades.indexOf(worstGradeEntry.grade) : -1

  // 阶段五 ②③：逐题折叠、只看错题、吸顶目录
  const isGradeExpanded = (grade: GradingReport['grades'][number], index: number) =>
    expandedMap[`${grade.questionId}-${index}`] ?? gradeOutcomeKey(grade) !== 'correct'
  const toggleGradeExpanded = (grade: GradingReport['grades'][number], index: number) => {
    const mapKey = `${grade.questionId}-${index}`
    setExpandedMap((prev) => ({
      ...prev,
      [mapKey]: !(prev[mapKey] ?? gradeOutcomeKey(grade) !== 'correct'),
    }))
  }
  const expandAllGrades = () => {
    setExpandedMap(
      Object.fromEntries(grades.map((grade, index) => [`${grade.questionId}-${index}`, true])),
    )
  }
  const scrollToQuestion = (index: number) => {
    document.getElementById(`report-q-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const visibleEntries = grades
    .map((grade, index) => ({ grade, index }))
    .filter(({ grade }) => questionFilter === 'all' || gradeOutcomeKey(grade) === 'wrong')

  const summaryGroups = [
    {
      title: '做得好的地方',
      icon: '✓',
      items: report.summary.strengths ?? [],
      className: 'strength',
    },
    {
      title: '主要薄弱点',
      icon: '!',
      items: report.summary.weaknesses ?? [],
      className: 'weakness',
    },
    {
      title: '下一步训练建议',
      icon: '→',
      items: report.summary.suggestions ?? [],
      className: 'suggestion',
    },
  ]

  return (
    <div
      className="ui-overlay pressure-report-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pressure-learning-report-title"
      onClick={onClose}
    >
      <div className="pressure-report-wrap" onClick={(e) => e.stopPropagation()}>
        <div className="pressure-report">
          <div className="report-header tactical-report-header">
            <div>
              <span className="report-badge-kicker">
                <ClipboardCheck size={16} /> 战后复盘 · 压力演练报告
              </span>
              <h2 id="pressure-learning-report-title">
                压力模拟学习报告
              </h2>
              <div className="report-meta">
                <span>{reportDate.toLocaleString('zh-CN')}</span>
                <span className="report-meta-tag">
                  {report.status === 'graded_partial' || ungradedIds.length > 0
                    ? '部分批改报告'
                    : '完整批改报告'}
                </span>
                {report.sourceTaskId && <span className="report-meta-task">任务 {report.sourceTaskId}</span>}
              </div>
            </div>
            <div className="report-header-actions">
              <button
                className="secondary-button compact"
                disabled={loading}
                onClick={onRefresh}
              >
                {loading ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} 刷新报告
              </button>
              <button className="icon-button" onClick={onClose} aria-label="关闭学习报告">
                <X size={19} />
              </button>
            </div>
          </div>

          <section className="report-overview-grid" aria-label="本次概览">
            {/* 1. 战术正确率 */}
            <div className="overview-metric-cell highlight-cell">
              <div className="metric-header-row">
                <span className="metric-label">战术正确率</span>
                <span className="metric-badge">胜率</span>
              </div>
              <strong className="metric-val text-green">{accuracy}<small>%</small></strong>
              <small className="metric-note">已批改 {grades.length} / 共 {totalCount} 题</small>
            </div>

            {/* 2. Rating 3.0 与 考场预估分 */}
            <div className="overview-metric-cell">
              <div className="metric-header-row">
                <span className="metric-label">Rating 3.0 & 考场预估</span>
                <span className="combat-tier-badge">{ratingTier} 段</span>
              </div>
              <strong className="metric-val cyan-accent">{averageRatingScore.toFixed(2)}</strong>
              <small className="metric-note text-green">🎯 考场预估 {examPrediction} / 150 分</small>
            </div>

            {/* 3. 总耗时与单题均耗 */}
            <div className="overview-metric-cell">
              <div className="metric-header-row">
                <span className="metric-label">总耗时与节奏</span>
                <Clock3 size={12} className="text-muted" />
              </div>
              <strong className="metric-val">{formatElapsed(totalDuration * 1000)}</strong>
              <small className="metric-note">均题 {formatElapsed(averageDuration * 1000)} / 题</small>
            </div>

            {/* 4. 防白给稳定性 */}
            <div className="overview-metric-cell">
              <div className="metric-header-row">
                <span className="metric-label">KAST 防白给率</span>
                <Sparkles size={12} className="text-cyan" />
              </div>
              <strong className="metric-val">{kastRate}<small>%</small></strong>
              <small className="metric-note">
                {ungradedIds.length > 0 ? `${ungradedIds.length} 题未批改` : '完整批改已生成'}
              </small>
            </div>
          </section>

          <section className="report-stat-pills" aria-label="批改结果分布">
            <div className="report-stat-pill correct">
              <div className="pill-title-wrap">
                <CheckCircle2 size={15} />
                <span>正确 CORRECT</span>
              </div>
              <strong>{correctCount}</strong>
            </div>
            <div className="report-stat-pill partial">
              <div className="pill-title-wrap">
                <Sparkles size={15} />
                <span>部分正确 PARTIAL</span>
              </div>
              <strong>{partialCount}</strong>
            </div>
            <div className="report-stat-pill wrong">
              <div className="pill-title-wrap">
                <X size={15} />
                <span>错误 INCORRECT</span>
              </div>
              <strong>{wrongCount}</strong>
            </div>
            <div className="report-stat-pill uncertain">
              <div className="pill-title-wrap">
                <HelpCircle size={15} />
                <span>不确定 UNCERTAIN</span>
              </div>
              <strong>{uncertainCount}</strong>
            </div>
          </section>

          {/* 阶段五 ①：结论前置——5 秒内知道本场核心问题 */}
          <section
            className="report-verdict-banner"
            aria-label="本场结论"
            style={{
              borderLeft: '3px solid var(--cyan)',
              background: 'color-mix(in srgb, var(--cyan) 7%, var(--surface))',
              borderRadius: 10,
              padding: '12px 16px',
              margin: '0 0 16px',
              fontSize: 13.5,
              lineHeight: 1.8,
            }}
          >
            <strong style={{ display: 'block', marginBottom: 4 }}>
              📌 本场结论{topWeakness ? `：主要卡在「${topWeakness}」` : ''}
            </strong>
            <span style={{ color: 'var(--muted)' }}>
              {totalCount} 题中做错 {wrongCount} 道
              {partialCount > 0 ? `、部分正确 ${partialCount} 道` : ''}，平均 Rating{' '}
              <b style={{ color: 'var(--ink)' }}>{averageRatingScore.toFixed(2)}</b>。
              {strongestWrongDim && weakestWrongDim && strongestWrongDim.key !== weakestWrongDim.key
                ? `错题画像：最强维 ${strongestWrongDim.label} ${strongestWrongDim.value}，最拖后腿 ${weakestWrongDim.label} ${weakestWrongDim.value}。`
                : ''}
              {worstGradeEntry && worstGradeIndex >= 0
                ? `最该先修：第 ${worstGradeIndex + 1} 题（#${worstGradeEntry.grade.questionId}，Rating ${worstGradeEntry.rating.toFixed(2)}）。`
                : wrongCount === 0 && partialCount === 0
                ? '全场做对——去名人堂看看这次能不能上榜。'
                : ''}
            </span>
          </section>

          <section className={`report-rating-panel ${ratingTone}`} aria-label="本次作答 rating">
            <div className="report-rating-heading">
              <div>
                <span className="report-kicker"><Activity size={15} /> 本场 Rating 与六维雷达</span>
                <h3>本次作答 Rating 与六维能力分布</h3>
                <p>基于得分产出(Cast)、突破上限(Clutch)、防白给率(KAST)与节奏效率(Pacing)多维复合评估。</p>
              </div>
              <div className="report-rating-total">
                <div className="rating-num-row">
                  <strong className={`rating-number rating-${ratingTone}`}>{averageRatingScore.toFixed(2)}</strong>
                  <RatingBadge value={averageRatingScore} tier={ratingTier} />
                </div>
                <span className="rating-exam-subtext">🎯 考场预测分 {examPrediction} / 150</span>
              </div>
            </div>
            {grades.length > 0 ? (
              <div className="report-rating-chart" role="list" aria-label="逐题 rating 分布">
                {grades.map((grade, index) => {
                  const score = ratingScores[index] ?? 0
                  const accent = csRatingAccent(score)
                  const isDonk = accent === 'donk'
                  const isClutch = accent === 'clutch'
                  const tone = gradeTone(grade)
                  return (
                    <div className="report-rating-column" key={`${grade.questionId}-${index}`} role="listitem">
                      <div className={`report-rating-value rating-${csRatingTone(score)}`}>
                        {score}
                        {isDonk ? (
                          <span className="donk-spark-tag" title="👑 DONK 级神仙秒杀突破！">👑</span>
                        ) : isClutch ? (
                          <span className="clutch-spark-tag" title="⚡ 高难度突破 / 巧解秒杀">⚡</span>
                        ) : null}
                      </div>
                      <div className={`report-rating-track rating-${csRatingTone(score)}`}>
                        <i style={{ height: `${Math.max(6, (score / CS_RATING_MAX) * 100)}%` }} />
                      </div>
                      <span className={`q-col-id ${tone.key}`}>#{grade.questionId}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="report-rating-empty">暂无可评分的逐题结果</div>
            )}
            <div className="report-rating-dimensions">
              <div className="report-radar-wrap">
                <Radar
                  className="report-radar"
                  dimensions={ratingDimensions.map((d) => ({ key: d.label, label: d.label, value: d.value ?? 0 }))}
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
                    <MetricBar
                      value={item.value ?? 0}
                      trackTag="i"
                      fillTag="b"
                      fillStyle={item.value == null ? { background: 'var(--line)' } : undefined}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 错题重心雷达（改造二 3.2）：只聚合做错/部分正确作答的真实证据 */}
            {wrongDimsPresent.length >= 3 && strongestWrongDim && weakestWrongDim && (
              <div
                style={{
                  display: 'flex',
                  gap: 14,
                  alignItems: 'center',
                  marginTop: 12,
                  padding: '10px 14px',
                  border: '1px dashed var(--line)',
                  borderRadius: 10,
                  flexWrap: 'wrap',
                }}
              >
                <Radar
                  width={170}
                  height={150}
                  cx={85}
                  cy={76}
                  radius={46}
                  labelRadius={58}
                  dimensions={wrongDimsPresent.map((d) => ({ key: d.key, label: d.label, value: d.value }))}
                  gridStroke="var(--line)"
                  gridInnerDash="3 3"
                  axisStroke="var(--line)"
                  axisOpacity={0.6}
                  shapeFill="var(--danger)"
                  shapeFillOpacity={0.2}
                  shapeStroke="var(--danger)"
                  shapeStrokeWidth={2}
                  dotVariant="simple"
                  dotRadius={2.5}
                  dotFill="var(--danger)"
                  labelAnchorMode="smart"
                  labelFill="var(--muted)"
                  labelFontSize={9.5}
                  labelFontWeight={700}
                  role="img"
                  ariaLabel="错题六维重心雷达"
                />
                <div style={{ flex: 1, minWidth: 160, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.9 }}>
                  <strong style={{ display: 'block', color: 'var(--ink)', fontSize: 13 }}>🎯 错题重心</strong>
                  只聚合做错 / 部分正确作答的真实六维证据，不再被做对题稀释。
                  {weakestWrongDim && (
                    <span style={{ display: 'block' }}>
                      最拖后腿：<b style={{ color: 'var(--danger)' }}>{weakestWrongDim.label} {weakestWrongDim.value}</b>
                      {strongestWrongDim.key !== weakestWrongDim.key
                        ? ` · 最强维：${strongestWrongDim.label} ${strongestWrongDim.value}`
                        : ''}
                    </span>
                  )}
                </div>
              </div>
            )}
          </section>

          {ungradedIds.length > 0 && (
            <div className="pressure-tip">
              <HelpCircle size={16} />
              <span>
                题目 {ungradedIds.map((id) => `#${id}`).join('、')} 没有得到可确认结果，不计入正式正确率和掌握进度。
              </span>
            </div>
          )}

          <section className="report-questions">
            <div className="report-questions-title-row">
              <h3>逐题步骤诊断与断点复盘</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button type="button" style={filterBtnStyle(questionFilter === 'all')} onClick={() => setQuestionFilter('all')}>
                  全部题目
                </button>
                <button type="button" style={filterBtnStyle(questionFilter === 'wrong')} onClick={() => setQuestionFilter('wrong')}>
                  只看错题
                </button>
                <button type="button" style={filterBtnStyle(false)} onClick={expandAllGrades}>
                  全部展开
                </button>
              </div>
            </div>
            {grades.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="报告尚无逐题结果"
                text="请刷新报告，或回到收件箱确认 Codex 整组批改。"
              />
            ) : (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {/* 吸顶目录（阶段五 ③）：错题红点 / 有秒杀思路蓝点，点击直达 */}
                <nav
                  aria-label="题目目录"
                  style={{
                    position: 'sticky',
                    top: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    flexShrink: 0,
                  }}
                >
                  {grades.map((grade, index) => {
                    const isWrong = gradeOutcomeKey(grade) === 'wrong'
                    const hasBetter = Boolean(grade.betterSolution)
                    const inView = visibleEntries.some((entry) => entry.index === index)
                    return (
                      <button
                        key={`${grade.questionId}-${index}`}
                        type="button"
                        onClick={() => scrollToQuestion(index)}
                        title={`第 ${index + 1} 题 #${grade.questionId}${isWrong ? ' · 错题' : ''}${hasBetter ? ' · 有秒杀思路' : ''}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          minWidth: 34,
                          padding: '3px 6px',
                          borderRadius: 8,
                          border: '1px solid var(--line)',
                          background: inView ? 'var(--surface)' : 'transparent',
                          color: isWrong ? 'var(--danger)' : 'var(--muted)',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {index + 1}
                        {isWrong && (
                          <i style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)' }} />
                        )}
                        {!isWrong && hasBetter && (
                          <i style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cyan)' }} />
                        )}
                      </button>
                    )
                  })}
                </nav>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {visibleEntries.map(({ grade, index }) => {
                    const tone = gradeTone(grade)
                    const question = questions[grade.questionId]
                    const errorTags = grade.errorTags ?? []
                    const weaknessTags = grade.weaknessTags ?? []
                    const isFav = favoriteMap[grade.questionId] ?? question?.favorite ?? false
                    const expanded = isGradeExpanded(grade, index)
                    const sevMeta = tone.key === 'correct' ? null : SEVERITY_META[severityOf(grade, tone.key)]
                    const focus = focusSentence(grade)
                    return (
                      <article
                        key={`${grade.questionId}-${index}`}
                        id={`report-q-${index}`}
                        className={`report-question-item tactical-q-item ${tone.key}`}
                        style={{ borderLeft: sevMeta ? `3px solid ${sevMeta.color}` : undefined }}
                      >
                        <div className="report-question-header">
                          <div>
                            <button
                              type="button"
                              className="question-number-btn"
                              onClick={() => void handleOpenDetail(grade.questionId)}
                              title="点击查看完整原题、选项与标准解析"
                            >
                              第 {index + 1} 题 · #{grade.questionId}
                            </button>
                            {question && (
                              <small className="question-cat-path">
                                {question.categoryPath}
                              </small>
                            )}
                          </div>
                          <div className="question-status-group">
                            <button
                              type="button"
                              className={`tactical-heart-fav-btn ${isFav ? 'active' : ''}`}
                              onClick={() => void handleToggleFav(grade.questionId)}
                              title={isFav ? '取消收藏此题' : '收藏此题到题本'}
                              aria-label="收藏题目"
                            >
                              <Heart
                                size={14}
                                fill={isFav ? 'currentColor' : 'none'}
                              />
                              <span>{isFav ? '已收藏' : '收藏'}</span>
                            </button>

                            <button
                              type="button"
                              className="tactical-preview-btn"
                              onClick={() => void handleOpenDetail(grade.questionId)}
                              title="查看题目完整原题、解析与笔记"
                            >
                              <BookOpen size={13} />
                              <span>原题解析</span>
                            </button>

                            {onStartVariant && (
                              <button
                                type="button"
                                className="tactical-variant-practice-btn"
                                onClick={() => onStartVariant(grade.questionId)}
                                title="调出此题同考点的 3 道变式题趁热打铁"
                              >
                                <Sparkles size={12} />
                                <span>练变式</span>
                              </button>
                            )}

                            <span className={`verdict-pill ${tone.key}`}>
                              {tone.label}
                            </span>
                            <span className="question-duration">
                              <Clock3 size={13} /> {formatElapsed(Math.max(0, grade.duration || 0) * 1000)}
                            </span>
                            {grade.selfRating != null && (
                              <span className="question-fluency-label">
                                熟练度 {grade.selfRating}/4
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleGradeExpanded(grade, index)}
                              style={{
                                background: 'none',
                                border: '1px solid var(--line)',
                                borderRadius: 8,
                                fontSize: 11,
                                color: 'var(--muted)',
                                cursor: 'pointer',
                                padding: '2px 8px',
                              }}
                            >
                              {expanded ? '收起 ▲' : '展开 ▼'}
                            </button>
                          </div>
                        </div>
                        {expanded ? (
                          <>
                            {question && (
                              <div className="report-question-content">
                                <div className="question-stem">
                                  <MathText value={question.stem} />
                                </div>
                              </div>
                            )}
                            {(grade.userAnswer || grade.correctAnswer) && (
                              <div className="answer-comparison">
                                <span>
                                  你的答案：<strong>{grade.userAnswer || '纸笔作答'}</strong>
                                </span>
                                <span>
                                  参考答案：<strong>{grade.correctAnswer || '见解析'}</strong>
                                </span>
                              </div>
                            )}
                            {focus && (
                              <div
                                style={{
                                  fontSize: 12.5,
                                  color: 'var(--ink)',
                                  background: 'var(--canvas)',
                                  border: '1px dashed var(--line)',
                                  borderRadius: 8,
                                  padding: '6px 10px',
                                }}
                              >
                                🎯 {focus}
                              </div>
                            )}
                            {grade.feedback && (
                              <div className="report-feedback">
                                <span className="feedback-icon">📝</span>
                                <div className="feedback-text">
                                  <LongText value={grade.feedback} />
                                </div>
                              </div>
                            )}
                            {grade.earliestError && (
                              <div className="earliest-error">
                                <strong className="earliest-error-title">⚠️ 最早错误断点</strong>
                                <p>
                                  <LongText value={grade.earliestError} />
                                </p>
                              </div>
                            )}
                            {(errorTags.length > 0 || weaknessTags.length > 0) && (
                              <div className="tag-line">
                                {sevMeta && (
                                  <span style={{ color: sevMeta.color, fontWeight: 700, fontSize: 12 }}>
                                    {sevMeta.label}
                                  </span>
                                )}
                                {errorTags.map((tag) => (
                                  <span className="error-tag" key={`e-${tag}`}>
                                    {tag}
                                  </span>
                                ))}
                                {weaknessTags.map((tag) => (
                                  <span className="weakness-tag" key={`w-${tag}`}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            {grade.betterSolution && (
                              <div className="better-solution-box">
                                <strong>⚡ 考场秒杀思路</strong>
                                <MathText value={grade.betterSolution} />
                              </div>
                            )}
                            {grade.advice && (
                              <div className="advice-box">
                                <strong className="advice-box-title">🎯 专项修复动作</strong>
                                <p>
                                  <LongText value={grade.advice} />
                                </p>
                              </div>
                            )}
                            {grade.confidence != null && (
                              <small className="diagnosis-confidence-note">
                                Codex 诊断置信度 {Math.round(grade.confidence * 100)}%
                              </small>
                            )}
                          </>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {question && (
                              <div
                                style={{
                                  fontSize: 13,
                                  color: 'var(--muted)',
                                  overflow: 'hidden',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                }}
                              >
                                <MathText value={question.stem} />
                              </div>
                            )}
                            {grade.betterSolution ? (
                              <div
                                style={{
                                  fontSize: 12.5,
                                  color: 'var(--cyan)',
                                  overflow: 'hidden',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 1,
                                  WebkitBoxOrient: 'vertical',
                                }}
                              >
                                ⚡ <MathText value={grade.betterSolution} />
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--muted)' }}>做对——展开可查看完整题干与解析入口</span>
                            )}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          <section className="report-summary">
            <h3>总体学习结论与作战建议</h3>
            <div className="report-summary-cards">
              {summaryGroups.map((group) => (
                <div
                  key={group.title}
                  className={`summary-section ${group.className}`}
                >
                  <h4>
                    {group.icon} {group.title}
                  </h4>
                  {group.items.length > 0 ? (
                    <ul>
                      {group.items.map((item, index) => (
                        <li key={`${group.title}-${index}`}>
                          <MathText value={item} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="summary-empty-text">本次暂无明确结论</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="report-actions">
            <span className="report-disclaimer">
              报告用于复盘展示；正式作答记录仍以收件箱确认结果为准。
            </span>
            <button className="primary-button" onClick={onClose}>
              <ArrowRight size={16} /> 返回刷题
            </button>
          </div>
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


