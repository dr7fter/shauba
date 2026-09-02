import {
  Activity,
  ArrowRight,
  BookOpen,
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
  csRatingAccent,
  csRatingTone,
  formatElapsed,
  gradeOutcomeKey,
  type GradeOutcome,
} from '../utils'
import {
  buildReportViewModel,
  filterReportEntries,
  reportFocusSentence,
  type ReportDimKey,
} from '../domain/reportViewModel'
import { MathText } from './MathText'
import { EmptyState } from './EmptyState'
import { QuestionDetail } from './QuestionDetailModal'
import { Radar } from './ui/Radar'
import { RatingBadge } from './ui/RatingBadge'
import { MetricBar } from './ui/MetricBar'
import type { GradingReport, GradingReportOrigin, PressureSession, Question } from '../types'

// ============ 阶段五：报告阅读体验 ============

/** 迷你雷达用短标签（170px 宽度下全称会挤爆） */
const DIM_SHORT_LABELS: Record<ReportDimKey, string> = {
  rigor: '严谨',
  computation: '计算',
  modeling: '建模',
  methodUse: '方法',
  speed: '速度',
  strategyInsight: '洞察',
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
  // 阶段五：逐题折叠与错题过滤
  const [questionFilter, setQuestionFilter] = useState<'needs-attention' | 'all' | 'correct' | 'uncertain'>('needs-attention')
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({})
  const [ratingEvidenceOpen, setRatingEvidenceOpen] = useState(false)
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
  const viewModel = buildReportViewModel(report, questions, session, reportOrigin)
  const {
    counts,
    totalCount,
    gradedCount,
    totalDuration,
    averageDuration,
    accuracy,
    ungradedIds,
    ratingScores,
    averageRatingScore,
    ratingTier,
    ratingTone,
    ratingDimensions,
    evidenceCoverage,
    hasFullDimensionEvidence,
    reportStatus,
    coverageKnown,
    kastRate,
    examPrediction,
    wrongDimsPresent,
    strongestWrongDim,
    weakestWrongDim,
    attentionEntries,
    worstGradeEntry,
    verdictText,
    priorityEntries,
  } = viewModel
  const { correct: correctCount, partial: partialCount, wrong: wrongCount, uncertain: uncertainCount } = counts
  const reportTime = report.confirmedAt ?? report.createdAt
  const reportDate = new Date(reportTime < 1_000_000_000_000 ? reportTime * 1000 : reportTime)
  const visibleEntries = filterReportEntries(grades, questionFilter)
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
  const collapseAllGrades = () => {
    setExpandedMap(
      Object.fromEntries(grades.map((grade, index) => [`${grade.questionId}-${index}`, false])),
    )
  }
  const scrollToQuestion = (index: number) => {
    document.getElementById(`report-q-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

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

  const reportLabel = reportOrigin.kind === 'codex-batch' ? '日常整组批改报告' : '高压演练报告'
  const reportKicker = reportOrigin.kind === 'codex-batch' ? '整组批改 · 学习报告' : '战后复盘 · 高压演练报告'

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
                <ClipboardCheck size={16} /> {reportKicker}
              </span>
              <h2 id="pressure-learning-report-title">
                {reportLabel}
              </h2>
              <div className="report-meta">
                <span>{reportDate.toLocaleString('zh-CN')}</span>
                <span className="report-meta-tag">
                  {reportStatus === 'empty'
                    ? '暂无逐题证据'
                    : reportStatus === 'partial'
                      ? '部分批改报告'
                      : reportStatus === 'evidence-insufficient'
                        ? '证据不完整报告'
                        : coverageKnown
                          ? '完整批改报告'
                          : '已回传题目报告'}
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

          <section className="report-verdict-banner report-conclusion-card" aria-label="本场结论">
            <div className="report-conclusion-main">
              <span className="report-section-kicker">5 秒结论</span>
              <h3>
                <MathText value={verdictText} />
              </h3>
              <p>
                {gradedCount} / {totalCount} 题已有逐题证据；错误 {wrongCount}，部分正确 {partialCount}，待确认 {uncertainCount}。
                {ungradedIds.length > 0
                  ? ` 另有 ${ungradedIds.length} 题未获得证据。`
                  : !coverageKnown
                    ? ' 本次日常整组报告未提供原始题组，无法判断是否漏批。'
                    : ''}
              </p>
            </div>
            <div className="report-conclusion-focus">
              <span>最该先修</span>
              {worstGradeEntry ? (
                <button type="button" onClick={() => scrollToQuestion(worstGradeEntry.index)}>
                  第 {worstGradeEntry.index + 1} 题 · #{worstGradeEntry.grade.questionId}
                </button>
              ) : (
                <strong>暂无待处理题</strong>
              )}
              <small>
                {worstGradeEntry?.grade.earliestError ? (
                  <MathText value={worstGradeEntry.grade.earliestError} />
                ) : (
                  '先用复测确认这组表现是否稳定。'
                )}
              </small>
            </div>
            {worstGradeEntry && onStartVariant && (
              <button className="primary-button report-conclusion-action" type="button" onClick={() => onStartVariant(worstGradeEntry.grade.questionId)}>
                <Sparkles size={15} /> 先练这道题的同考点加练
              </button>
            )}
          </section>

          <section className="report-overview-grid report-metric-strip" aria-label="本次核心指标">
            <div className="overview-metric-cell highlight-cell">
              <span className="metric-label">正确率</span>
              <strong className="metric-val text-green">{accuracy != null ? `${accuracy}%` : '暂无'}</strong>
              <small className="metric-note">以已批改题为分母</small>
            </div>
            <div className="overview-metric-cell">
              <span className="metric-label">平均 Rating</span>
              <strong className="metric-val cyan-accent">{averageRatingScore != null ? averageRatingScore.toFixed(2) : '暂无'}</strong>
              <small className="metric-note">{ratingTier ? `${ratingTier} 档` : '无可评分结果'}</small>
            </div>
            <div className="overview-metric-cell">
              <span className="metric-label">作答节奏</span>
              <strong className="metric-val">{formatElapsed(totalDuration * 1000)}</strong>
              <small className="metric-note">均题 {formatElapsed(averageDuration * 1000)}</small>
            </div>
            <div className="overview-metric-cell">
              <span className="metric-label">证据覆盖</span>
              <strong className="metric-val">{evidenceCoverage}/{gradedCount}</strong>
              <small className="metric-note">{kastRate != null ? `KAST ${kastRate}%` : 'KAST：本组不足以估算'}</small>
            </div>
          </section>

          <section className="report-priority-panel" aria-label="优先修复清单">
            <div className="report-section-heading">
              <div>
                <span className="report-section-kicker">下一步动作</span>
                <h3>优先修复清单</h3>
              </div>
              <small>先修最早断点，再用不同结构题复测</small>
            </div>
            {priorityEntries.length > 0 ? (
              <div className="report-priority-list">
                {priorityEntries.map(({ grade, index }) => {
                  const tone = gradeTone(grade)
                  const sev = SEVERITY_META[severityOf(grade, tone.key)]
                  return (
                    <div className="report-priority-item" key={`${grade.questionId}-${index}`}>
                      <button type="button" className="report-priority-q" onClick={() => scrollToQuestion(index)}>
                        #{grade.questionId}
                      </button>
                      <span className={`verdict-pill ${tone.key}`}>{tone.label}</span>
                      <div className="report-priority-copy">
                        <strong>
                          {grade.earliestError ? (
                            <MathText value={grade.earliestError} />
                          ) : (
                            '尚未定位最早错误，先补齐作答证据。'
                          )}
                        </strong>
                        <span>
                          {grade.advice ? (
                            <MathText value={grade.advice} />
                          ) : grade.weaknessTags?.[0] ? (
                            <MathText value={grade.weaknessTags[0]} />
                          ) : (
                            sev.label
                          )}
                        </span>
                      </div>
                      {onStartVariant && (
                        <button type="button" className="tactical-variant-practice-btn" onClick={() => onStartVariant(grade.questionId)}>
                          <Sparkles size={12} /> 同考点加练
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="report-priority-empty">暂无需要立即修复的逐题结果；请安排一次延迟复测，确认不是偶然正确。</p>
            )}
          </section>

          {/* 评分证据之后不再重复输出本场结论；首屏结论已前置到上方。 */}
          <section className="report-rating-panel report-evidence-panel" aria-label="评分证据">
            <button type="button" className="report-evidence-toggle" onClick={() => setRatingEvidenceOpen((open) => !open)} aria-expanded={ratingEvidenceOpen}>
              <span><Activity size={15} /> 评分证据</span>
              <span>{ratingEvidenceOpen ? '收起 ▲' : '展开查看 Rating 与六维证据 ▼'}</span>
            </button>
            {ratingEvidenceOpen && (
              <>
            <div className="report-rating-heading">
              <div>
                <span className="report-kicker"><Activity size={15} /> 评分证据 · {reportStatus === 'complete' ? '完整' : '有限'}</span>
                <h3>评分证据</h3>
                <p>仅展示已有结构化证据；缺失维度不会被当作 0 分。</p>
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
                          <span className="donk-spark-tag" title="👑 DONK 级神仙秒杀突破！">👑</span>
                        ) : isClutch ? (
                          <span className="clutch-spark-tag" title="⚡ 高难度突破 / 巧解秒杀">⚡</span>
                        ) : null}
                      </div>
                      <div className={`report-rating-track rating-${csRatingTone(score)}`}>
                        <i style={{ height: `${Math.max(6, ((score ?? 0) / CS_RATING_MAX) * 100)}%` }} />
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
                <span style={{ display: 'block', textAlign: 'center', fontSize: 11, color: 'var(--muted)' }}>
                  全组均值（做对+做错一起平均）
                </span>
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
                  dimensions={wrongDimsPresent.map((d) => ({
                    key: d.key,
                    label: DIM_SHORT_LABELS[d.key],
                    value: d.value,
                  }))}
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
              </>
            )}
          </section>

          {ungradedIds.length > 0 ? (
            <div className="pressure-tip">
              <HelpCircle size={16} />
              <span>
                题目 {ungradedIds.map((id) => `#${id}`).join('、')} 没有得到可确认结果，不计入正式正确率和掌握进度。
              </span>
            </div>
          ) : !coverageKnown ? (
            <div className="pressure-tip">
              <HelpCircle size={16} />
              <span>这是日常整组批改的已回传题目报告；当前未提供原始题组，无法判断是否存在漏批题。</span>
            </div>
          ) : null}

          <section className="report-questions">
            <div className="report-questions-title-row">
              <div>
                <h3>逐题步骤诊断与断点复盘</h3>
                <small>默认显示需要处理的题：错误、部分正确和待确认</small>
              </div>
              <div className="report-question-controls">
                <button type="button" style={filterBtnStyle(questionFilter === 'needs-attention')} onClick={() => setQuestionFilter('needs-attention')}>
                  需要处理 {attentionEntries.length}
                </button>
                <button type="button" style={filterBtnStyle(questionFilter === 'all')} onClick={() => setQuestionFilter('all')}>
                  全部 {grades.length}
                </button>
                <button type="button" style={filterBtnStyle(questionFilter === 'correct')} onClick={() => setQuestionFilter('correct')}>
                  正确 {correctCount}
                </button>
                <button type="button" style={filterBtnStyle(questionFilter === 'uncertain')} onClick={() => setQuestionFilter('uncertain')}>
                  待确认 {uncertainCount}
                </button>
                <button type="button" style={filterBtnStyle(false)} onClick={expandAllGrades}>
                  全部展开
                </button>
                <button type="button" style={filterBtnStyle(false)} onClick={collapseAllGrades}>
                  全部收起
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
              <div className="report-question-layout">
                {/* 吸顶目录（阶段五 ③）：错题红点 / 有秒杀思路蓝点，点击直达 */}
                <nav className="report-question-nav" aria-label="题目目录">
                  {visibleEntries.map(({ grade, index }) => {
                    const isWrong = gradeOutcomeKey(grade) === 'wrong'
                    const hasBetter = Boolean(grade.betterSolution)
                    const inView = visibleEntries.some((entry) => entry.index === index)
                    return (
                      <button
                        key={`${grade.questionId}-${index}`}
                        type="button"
                        className={`report-question-nav-button ${isWrong ? 'is-wrong' : ''} ${inView ? '' : 'is-hidden'}`}
                        onClick={() => scrollToQuestion(index)}
                        title={`第 ${index + 1} 题 #${grade.questionId}${isWrong ? ' · 错题' : ''}${hasBetter ? ' · 有秒杀思路' : ''}`}
                      >
                        {index + 1}
                        {isWrong && <i className="is-wrong" />}
                        {!isWrong && hasBetter && <i className="is-better" />}
                      </button>
                    )
                  })}
                </nav>
                <div className="report-question-list">
                  {visibleEntries.map(({ grade, index }) => {
                    const tone = gradeTone(grade)
                    const question = questions[grade.questionId]
                    const errorTags = grade.errorTags ?? []
                    const weaknessTags = grade.weaknessTags ?? []
                    const isFav = favoriteMap[grade.questionId] ?? question?.favorite ?? false
                    const expanded = isGradeExpanded(grade, index)
                    const sevMeta = tone.key === 'correct' ? null : SEVERITY_META[severityOf(grade, tone.key)]
                    const focus = reportFocusSentence(grade)
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
                                title="调出此题同考点的加练题；结构关系未单独验证"
                              >
                                <Sparkles size={12} />
                                <span>同考点加练</span>
                              </button>
                            )}

                            <span className={`verdict-pill ${tone.key}`}>
                              {tone.label}
                            </span>
                            <span
                              style={{
                                fontSize: 11.5,
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: 'var(--canvas)',
                                border: '1px solid var(--line)',
                                display: 'inline-flex',
                                alignItems: 'center',
                              }}
                              className={`rating-${csRatingTone(ratingScores[index])}`}
                            >
                              Rating {ratingScores[index] != null ? ratingScores[index].toFixed(2) : '—'}
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
                            {grade.userAnswer || grade.correctAnswer ? (
                              <div className="answer-comparison">
                                <span>
                                  你的答案：<strong><MathText value={grade.userAnswer || '暂无结构化答案证据'} /></strong>
                                </span>
                                <span>
                                  参考答案：<strong><MathText value={grade.correctAnswer || '暂无参考答案证据'} /></strong>
                                </span>
                              </div>
                            ) : (
                              <div className="answer-comparison answer-comparison-empty">暂无结构化答案证据，以下诊断仅基于回传摘要。</div>
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
                                🎯 <MathText value={focus} />
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
                                    <MathText value={tag} />
                                  </span>
                                ))}
                                {weaknessTags.map((tag) => (
                                  <span className="weakness-tag" key={`w-${tag}`}>
                                    <MathText value={tag} />
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
                            {grade.earliestError ? (
                              <div
                                style={{
                                  fontSize: 12.5,
                                  color: 'var(--danger)',
                                  overflow: 'hidden',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 1,
                                  WebkitBoxOrient: 'vertical',
                                }}
                              >
                                ⚠️ <MathText value={grade.earliestError} />
                              </div>
                            ) : grade.betterSolution ? (
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
                              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                                {gradeOutcomeKey(grade) === 'correct'
                                  ? '做对——展开可查看完整题干与解析入口'
                                  : '展开可查看完整步骤诊断与断点复盘'}
                              </span>
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


