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
import { useState } from 'react'
import { addToCustomQueue, getQuestion, toggleFavorite } from '../api'
import {
  CS_RATING_MAX,
  averageCsRating,
  csRatingTier,
  csRatingTone,
  deriveGradeCsRating,
  formatElapsed,
  predictedExamScore,
} from '../utils'
import { MathText } from './MathText'
import { EmptyState } from './EmptyState'
import { QuestionDetail } from './QuestionDetailModal'
import type { GradingReport, PressureSession, Question } from '../types'

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

  const gradeTone = (grade: GradingReport['grades'][number]) => {
    if (grade.verdict === 'partial')
      return { key: 'partial', label: '部分正确' }
    if (grade.verdict === 'uncertain' || grade.result === 'uncertain')
      return { key: 'uncertain', label: '不确定' }
    if (grade.verdict === 'incorrect' || grade.result === 'wrong' || !grade.correct)
      return { key: 'wrong', label: '错误' }
    return { key: 'correct', label: '正确' }
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
  const ratingForGrade = (grade: GradingReport['grades'][number]) => {
    const tone = gradeTone(grade).key
    const outcome = tone === 'correct' ? 'correct' : tone === 'partial' ? 'partial' : tone === 'uncertain' ? 'uncertain' : 'wrong'
    return deriveGradeCsRating({
      rating: grade.rating,
      outcome,
      selfRating: grade.selfRating,
      duration: grade.duration,
      averageDuration,
      difficultyMultiplier: grade.difficultyMultiplier,
    })
  }
  const ratingScores = grades.map(ratingForGrade)
  const averageRatingScore = averageCsRating(ratingScores) ?? 0
  const ratingTier = csRatingTier(averageRatingScore) ?? 'D'
  const ratingTone = csRatingTone(averageRatingScore)
  const dimensionAverage = (key: 'rigor' | 'computation' | 'modeling' | 'methodUse' | 'speed' | 'strategyInsight', fallback: (grade: GradingReport['grades'][number]) => number) => {
    const observed = grades
      .map((grade) => grade.dimensions?.[key]?.score)
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
    return observed.length
      ? Math.round(observed.reduce((sum, score) => sum + score, 0) / observed.length)
      : grades.length ? Math.round(grades.reduce((sum, grade) => sum + fallback(grade), 0) / grades.length) : 0
  }
  const ratingDimensions = [
    { label: '严谨性', value: dimensionAverage('rigor', (grade) => (gradeTone(grade).key === 'correct' ? 75 : gradeTone(grade).key === 'partial' ? 60 : 55)) },
    { label: '计算力', value: dimensionAverage('computation', (grade) => Math.max(1, Math.min(4, grade.selfRating ?? 2)) / 4 * 100) },
    { label: '速度', value: dimensionAverage('speed', (grade) => Math.max(45, Math.min(115, (averageDuration / Math.max(1, grade.duration || averageDuration)) * 100))) },
    { label: '审题建模', value: dimensionAverage('modeling', (grade) => (gradeTone(grade).key === 'correct' ? 60 : gradeTone(grade).key === 'partial' ? 50 : 40)) },
    { label: '方法使用', value: dimensionAverage('methodUse', (grade) => (gradeTone(grade).key === 'correct' ? 60 : gradeTone(grade).key === 'partial' ? 50 : 40)) },
    { label: '策略洞察力', value: dimensionAverage('strategyInsight', (grade) => (grade.betterSolution ? 72 : gradeTone(grade).key === 'correct' ? 60 : 50)) },
  ]
  const kastRate = Math.round(
    0.50 * ratingDimensions[0].value +
    0.30 * ratingDimensions[1].value +
    0.20 * ratingDimensions[3].value
  )
  const examPrediction = predictedExamScore(averageRatingScore, kastRate)

  const radarPoint = (index: number, value: number, radius = 78) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / ratingDimensions.length
    return `${140 + Math.cos(angle) * radius * value / 100},${104 + Math.sin(angle) * radius * value / 100}`
  }
  const radarGrid = (scale: number) => ratingDimensions.map((_, index) => radarPoint(index, scale)).join(' ')
  const radarShape = ratingDimensions.map((item, index) => radarPoint(index, item.value)).join(' ')
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
    >
      <div className="pressure-report-wrap">
        <div className="pressure-report">
          <div className="report-header tactical-report-header">
            <div>
              <span className="report-badge-kicker">
                <ClipboardCheck size={16} /> TACTICAL AFTER-ACTION REPORT · 压力演练复盘
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

          <section className={`report-rating-panel ${ratingTone}`} aria-label="本次作答 rating">
            <div className="report-rating-heading">
              <div>
                <span className="report-kicker"><Activity size={15} /> TACTICAL RATING 3.0 & RADAR</span>
                <h3>本次作答 Rating 与六维能力分布</h3>
                <p>基于得分产出(Cast)、突破上限(Clutch)、防白给率(KAST)与节奏效率(Pacing)多维复合评估。</p>
              </div>
              <div className="report-rating-total">
                <div className="rating-num-row">
                  <strong className={`rating-number rating-${ratingTone}`}>{averageRatingScore.toFixed(2)}</strong>
                  <b className={`tier-capsule ${averageRatingScore >= 2.0 ? 'donk-tier' : ''}`}>
                    {averageRatingScore >= 2.0 ? '👑 DONK' : `${ratingTier} 级`}
                  </b>
                </div>
                <span className="rating-exam-subtext">🎯 考场预测分 {examPrediction} / 150</span>
              </div>
            </div>
            {grades.length > 0 ? (
              <div className="report-rating-chart" role="list" aria-label="逐题 rating 分布">
                {grades.map((grade, index) => {
                  const score = ratingScores[index] ?? 0
                  const isDonk = score >= 2.0
                  const isClutch = score >= 1.35 && !isDonk
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
                <svg className="report-radar" viewBox="0 0 280 220" role="img" aria-label="本次作答六维 rating 雷达图">
                  <title>本次作答六维 rating</title>
                  {[25, 50, 75, 100].map((scale) => <polygon key={scale} points={radarGrid(scale)} className="report-radar-grid" />)}
                  {ratingDimensions.map((item, index) => (
                    <g key={item.label}>
                      <line x1="140" y1="104" x2={radarPoint(index, 100).split(',')[0]} y2={radarPoint(index, 100).split(',')[1]} className="report-radar-axis" />
                      <text x={radarPoint(index, 120).split(',')[0]} y={radarPoint(index, 120).split(',')[1]} className="report-radar-label" textAnchor="middle">{item.label}</text>
                    </g>
                  ))}
                  <polygon points={radarShape} className="report-radar-shape" />
                  {ratingDimensions.map((item, index) => <circle key={`${item.label}-dot`} cx={radarPoint(index, item.value).split(',')[0]} cy={radarPoint(index, item.value).split(',')[1]} r="3.5" className="report-radar-dot" />)}
                </svg>
              </div>
              <div className="report-dimension-list">
                <div className="dimension-kast-banner">
                  <span>🛡️ KAST 防白给指数</span>
                  <strong>{kastRate}%</strong>
                </div>
                {ratingDimensions.map((item) => (
                  <div className="report-dimension-row" key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <i><b style={{ width: `${item.value}%` }} /></i>
                  </div>
                ))}
              </div>
            </div>
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
              <h3>逐题步骤诊断与断点复盘 (STEP-BY-STEP BREAKDOWN)</h3>
              <small>点击题号或“原题解析”查看完整官方解析 · 可随时一键收藏</small>
            </div>
            {grades.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="报告尚无逐题结果"
                text="请刷新报告，或回到收件箱确认 Codex 整组批改。"
              />
            ) : (
              grades.map((grade, index) => {
                const tone = gradeTone(grade)
                const question = questions[grade.questionId]
                const errorTags = grade.errorTags ?? []
                const weaknessTags = grade.weaknessTags ?? []
                const isFav = favoriteMap[grade.questionId] ?? question?.favorite ?? false
                return (
                  <article
                    key={`${grade.questionId}-${index}`}
                    className={`report-question-item tactical-q-item ${tone.key}`}
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
                      </div>
                    </div>
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
                    {grade.feedback && (
                      <div className="report-feedback">
                        <span className="feedback-icon">📝</span>
                        <div className="feedback-text">
                          <MathText value={grade.feedback} />
                        </div>
                      </div>
                    )}
                    {grade.earliestError && (
                      <div className="earliest-error">
                        <strong className="earliest-error-title">⚠️ 最早错误断点定位 (BREAKPOINT)</strong>
                        <p>
                          <MathText value={grade.earliestError} />
                        </p>
                      </div>
                    )}
                    {(errorTags.length > 0 || weaknessTags.length > 0) && (
                      <div className="tag-line">
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
                        <strong>⚡ 考场更优秒杀解法 (SPEED-KILL SOLUTION)</strong>
                        <MathText value={grade.betterSolution} />
                      </div>
                    )}
                    {grade.advice && (
                      <div className="advice-box">
                        <strong className="advice-box-title">🎯 专项修复执行动作 (ACTION)</strong>
                        <p>
                          <MathText value={grade.advice} />
                        </p>
                      </div>
                    )}
                    {grade.confidence != null && (
                      <small className="diagnosis-confidence-note">
                        Codex 诊断置信度 {Math.round(grade.confidence * 100)}%
                      </small>
                    )}
                  </article>
                )
              })
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


