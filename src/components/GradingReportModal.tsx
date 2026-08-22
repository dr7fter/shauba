import { Activity, ArrowRight, ClipboardCheck, Clock3, HelpCircle, LoaderCircle, RefreshCw, X } from 'lucide-react'
import { CS_RATING_MAX, averageCsRating, csRatingTier, csRatingTone, deriveGradeCsRating, formatElapsed } from '../utils'
import { MathText } from './MathText'
import { EmptyState } from './EmptyState'
import type { GradingReport, PressureSession, Question } from '../types'

export function PressureLearningReportView({
  report,
  session,
  questions,
  loading,
  onRefresh,
  onClose,
}: {
  report: GradingReport
  session: PressureSession | null
  questions: Record<number, Question>
  loading: boolean
  onRefresh: () => void
  onClose: () => void
}) {
  const gradeTone = (grade: GradingReport['grades'][number]) => {
    if (grade.verdict === 'partial')
      return { key: 'partial', label: '部分正确', color: '#A66A17', background: '#FFF5DC' }
    if (grade.verdict === 'uncertain' || grade.result === 'uncertain')
      return { key: 'uncertain', label: '不确定', color: '#6B7280', background: '#F1F3F5' }
    if (grade.verdict === 'incorrect' || grade.result === 'wrong' || !grade.correct)
      return { key: 'wrong', label: '错误', color: '#B54236', background: '#FCE9E7' }
    return { key: 'correct', label: '正确', color: '#267655', background: '#E7F5EE' }
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
    { label: '严谨性', value: dimensionAverage('rigor', (grade) => gradeTone(grade).key === 'correct' ? 100 : gradeTone(grade).key === 'partial' ? 65 : 30) },
    { label: '计算力', value: dimensionAverage('computation', (grade) => Math.max(1, Math.min(4, grade.selfRating ?? 2)) / 4 * 100) },
    { label: '速度', value: dimensionAverage('speed', (grade) => Math.max(45, Math.min(115, (averageDuration / Math.max(1, grade.duration || averageDuration)) * 100))) },
    { label: '审题建模', value: dimensionAverage('modeling', (grade) => grade.betterSolution ? 62 : gradeTone(grade).key === 'correct' ? 92 : 72) },
    { label: '方法使用', value: dimensionAverage('methodUse', (grade) => grade.verdict !== 'uncertain' && grade.result !== 'uncertain' ? 78 : 30) },
    { label: '策略洞察力', value: dimensionAverage('strategyInsight', (grade) => grade.betterSolution ? 88 : gradeTone(grade).key === 'correct' ? 72 : 50) },
  ]
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
      color: '#267655',
      background: '#F0F8F4',
    },
    {
      title: '主要薄弱点',
      icon: '!',
      items: report.summary.weaknesses ?? [],
      color: '#A65C20',
      background: '#FFF7EA',
    },
    {
      title: '下一步训练建议',
      icon: '→',
      items: report.summary.suggestions ?? [],
      color: '#315E9E',
      background: '#EEF4FC',
    },
  ]

  return (
    <div
      className="ui-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 140,
        background: 'var(--bg, #f5f3ee)',
        overflowY: 'auto',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pressure-learning-report-title"
    >
      <div
        className="pressure-report-wrap"
        style={{ width: 'min(1120px, calc(100% - 32px))', margin: '0 auto', padding: '24px 0 48px' }}
      >
        <div className="pressure-report" style={{ minHeight: 'calc(100vh - 48px)' }}>
          <div
            className="report-header"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 20,
              alignItems: 'flex-start',
              background: 'inherit',
              paddingBottom: 16,
            }}
          >
            <div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  color: '#6B7280',
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '.08em',
                }}
              >
                <ClipboardCheck size={16} /> CODEX 纸笔批改
              </span>
              <h2 id="pressure-learning-report-title" style={{ margin: '8px 0 6px' }}>
                压力模拟学习报告
              </h2>
              <div className="report-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <span>{reportDate.toLocaleString('zh-CN')}</span>
                <span>
                  {report.status === 'graded_partial' || ungradedIds.length > 0
                    ? '部分批改报告'
                    : '完整批改报告'}
                </span>
                {report.sourceTaskId && <span>任务 {report.sourceTaskId}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
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

          <section
            aria-label="本次概览"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(180px, 1.2fr) repeat(3, minmax(120px, 1fr))',
              gap: 12,
              margin: '12px 0 20px',
            }}
          >
            <div className="report-score-card" style={{ margin: 0, minHeight: 126 }}>
              <div className="score-circle">
                <div className="score-value">{accuracy}</div>
                <div className="score-label">正确率 %</div>
              </div>
              <div>
                <strong style={{ display: 'block', fontSize: 18 }}>本次概览</strong>
                <span style={{ color: '#6B7280', fontSize: 13 }}>
                  已批改 {grades.length} / 共 {totalCount} 题
                </span>
              </div>
            </div>
            {[
              ['总时长', formatElapsed(totalDuration * 1000), '真实经过时间'],
              ['平均用时', formatElapsed(averageDuration * 1000), '每题平均'],
              ['报告状态', ungradedIds.length > 0 ? '部分完成' : '已完成', ungradedIds.length > 0 ? `${ungradedIds.length} 题未批改` : '已确认并生成'],
            ].map(([label, value, note]) => (
              <div
                key={label}
                style={{
                  border: '1px solid var(--border, #e5e1d8)',
                  borderRadius: 16,
                  padding: 18,
                  background: 'var(--surface, #fff)',
                }}
              >
                <span style={{ color: '#6B7280', fontSize: 13 }}>{label}</span>
                <strong style={{ display: 'block', margin: '10px 0 5px', fontSize: 23 }}>
                  {value}
                </strong>
                <small style={{ color: '#8B8F97' }}>{note}</small>
              </div>
            ))}
          </section>

          <section
            className="score-details"
            aria-label="批改结果分布"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 22 }}
          >
            {[
              ['正确', correctCount, '#267655', '#E7F5EE'],
              ['部分正确', partialCount, '#A66A17', '#FFF5DC'],
              ['错误', wrongCount, '#B54236', '#FCE9E7'],
              ['不确定', uncertainCount, '#6B7280', '#F1F3F5'],
            ].map(([label, value, color, background]) => (
              <div
                key={String(label)}
                style={{
                  padding: '14px 16px',
                  borderRadius: 13,
                  background: String(background),
                  color: String(color),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{label}</span>
                <strong style={{ fontSize: 22 }}>{value}</strong>
              </div>
            ))}
          </section>

          <section className={`report-rating-panel ${ratingTone}`} aria-label="本次作答 rating">
            <div className="report-rating-heading">
              <div>
                <span className="report-kicker"><Activity size={15} /> PERFORMANCE RATING</span>
                <h3>本次作答 rating</h3>
                <p>综合正确性、流畅度自评与相对用时，反映这次作答的整体状态。</p>
              </div>
              <div className="report-rating-total">
                <strong className={`rating-number rating-${ratingTone}`}>{averageRatingScore.toFixed(2)}</strong>
                <b>{ratingTier} 级</b>
              </div>
            </div>
            {grades.length > 0 ? (
              <div className="report-rating-chart" role="list" aria-label="逐题 rating 分布">
                {grades.map((grade, index) => {
                  const score = ratingScores[index] ?? 0
                  return (
                    <div className="report-rating-column" key={`${grade.questionId}-${index}`} role="listitem">
                      <div className={`report-rating-value rating-${csRatingTone(score)}`}>{score}</div>
                      <div className={`report-rating-track rating-${csRatingTone(score)}`}><i style={{ height: `${Math.max(6, score / CS_RATING_MAX * 100)}%` }} /></div>
                      <span>#{grade.questionId}</span>
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
                {ratingDimensions.map((item) => (
                  <div className="report-dimension-row" key={item.label}>
                    <span>{item.label}</span><strong>{item.value}</strong><i><b style={{ width: `${item.value}%` }} /></i>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {ungradedIds.length > 0 && (
            <div className="pressure-tip" style={{ marginBottom: 20 }}>
              <HelpCircle size={16} />
              <span>
                题目 {ungradedIds.map((id) => `#${id}`).join('、')} 没有得到可确认结果，不计入正式正确率和掌握进度。
              </span>
            </div>
          )}

          <section className="report-questions">
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <h3 style={{ margin: 0 }}>逐题批改与诊断</h3>
              <small style={{ color: '#6B7280' }}>正确性与熟练度仍分别记录</small>
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
                return (
                  <article
                    key={`${grade.questionId}-${index}`}
                    className={`report-question-item ${tone.key}`}
                    style={{ borderLeft: `4px solid ${tone.color}`, marginBottom: 14 }}
                  >
                    <div className="report-question-header" style={{ alignItems: 'flex-start' }}>
                      <div>
                        <span className="question-number">
                          第 {index + 1} 题 · #{grade.questionId}
                        </span>
                        {question && (
                          <small style={{ display: 'block', marginTop: 5, color: '#6B7280' }}>
                            {question.categoryPath}
                          </small>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span
                          style={{
                            padding: '5px 10px',
                            borderRadius: 999,
                            color: tone.color,
                            background: tone.background,
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          {tone.label}
                        </span>
                        <span className="question-duration">
                          <Clock3 size={13} /> {formatElapsed(Math.max(0, grade.duration || 0) * 1000)}
                        </span>
                        {grade.selfRating != null && (
                          <span style={{ color: '#6B7280', fontSize: 12 }}>
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
                        <span>最早错误断点</span>
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
                      <div
                        style={{
                          marginTop: 12,
                          padding: 14,
                          borderRadius: 12,
                          background: '#F2F7FC',
                        }}
                      >
                        <strong style={{ display: 'block', marginBottom: 6, color: '#315E9E' }}>
                          更好的解法
                        </strong>
                        <MathText value={grade.betterSolution} />
                      </div>
                    )}
                    {grade.advice && (
                      <p className="advice" style={{ marginTop: 12 }}>
                        <strong>下一步：</strong>
                        <MathText value={grade.advice} />
                      </p>
                    )}
                    {grade.confidence != null && (
                      <small style={{ display: 'block', marginTop: 8, color: '#8B8F97' }}>
                        Codex 诊断置信度 {Math.round(grade.confidence * 100)}%
                      </small>
                    )}
                  </article>
                )
              })
            )}
          </section>

          <section className="report-summary" style={{ marginTop: 24 }}>
            <h3>总体学习结论</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              {summaryGroups.map((group) => (
                <div
                  key={group.title}
                  className="summary-section"
                  style={{ margin: 0, padding: 16, borderRadius: 14, background: group.background }}
                >
                  <h4 style={{ color: group.color }}>
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
                    <p style={{ color: '#7A7F87', margin: 0 }}>本次暂无明确结论</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="report-actions" style={{ justifyContent: 'space-between', marginTop: 28 }}>
            <span style={{ color: '#6B7280', fontSize: 13 }}>
              报告用于复盘展示；正式作答记录仍以收件箱确认结果为准。
            </span>
            <button className="primary-button" onClick={onClose}>
              <ArrowRight size={16} /> 返回刷题
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


