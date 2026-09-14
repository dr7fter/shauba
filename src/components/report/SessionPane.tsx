import { formatElapsed, gradeOutcomeKey } from '../../utils'
import { timeBaselineFor, type ReportViewModel } from '../../domain/reportViewModel'
import { Icon } from '../ui/Icon'
import type { CategoryTimeBaseline, Question } from '../../types'

const BAR_COLOR = { correct: 'var(--success)', partial: 'var(--warn)', wrong: 'var(--danger)', uncertain: 'var(--muted)' }

const OUTCOME_SHORT = { correct: '对', partial: '半', wrong: '错', uncertain: '?' }
const OUTCOME_TEXT = { correct: 'rp-yes', partial: '', wrong: 'rp-no', uncertain: 'rp-quiet' }

/**
 * 「本场」视图：事后看趋势的地方。
 *
 * 2026-09-15：CS Rating 与六维图整条下线——它们是娱乐性展示，
 * 且每维都要批改 AI 写 evidence，会挤占写解析的注意力。
 * 评分内核照旧吃 AI 回传的 dimensions，只是不再给学员看。
 * 留下的都是能驱动决策的东西：正确率、用时、止损失效、考场预测。
 */
export function SessionPane({
  vm,
  questions,
  timeBaselines,
}: {
  vm: ReportViewModel
  questions: Record<number, Question>
  timeBaselines: Record<string, Pick<CategoryTimeBaseline, 'medianSeconds' | 'sampleCount'>>
}) {
  const { grades, counts, accuracy } = vm
  /* 条形长度按本场最长用时归一：只看相对节奏，不暗示"分数" */
  const maxDuration = grades.reduce((max, grade) => Math.max(max, grade.duration ?? 0), 0)
  const avgDuration = grades.length ? Math.round(vm.totalDuration / grades.length) : 0
  /* 含水量：lucky/detour 独立计数，不动正确率与 ELO 口径（2026-09-04 拍板） */
  const luckyCount = grades.filter((grade) => grade.methodSoundness === 'lucky').length
  const detourCount = grades.filter((grade) => grade.methodSoundness === 'detour').length
  /* 止损线（固定事实：选择 5′ / 大题 8′）——超时不稀奇，越线才要数出来 */
  const stopLossViolations = grades.filter((grade) => {
    const q = questions[grade.questionId]
    const isChoice =
      q?.questionType === 'single_choice' || q?.questionType === 'multiple_choice'
    return (grade.duration ?? 0) > (isChoice ? 300 : 480)
  }).length

  return (
    <div className="rp-view">
      <div className="insight-summary">
        <div>
          <span>正确率</span>
          <strong>{accuracy != null ? `${accuracy}%` : '—'}</strong>
          <small>
            {counts.correct} 对 / {counts.partial} 半 / {counts.wrong} 错
          </small>
        </div>
        <div>
          <span>总用时</span>
          <strong>{formatElapsed(vm.totalDuration * 1000)}</strong>
          <small>
            均 {formatElapsed(avgDuration * 1000)} / 题
            {stopLossViolations > 0 ? (
              <b className="rp-danger"> · 止损失效 {stopLossViolations} 题</b>
            ) : null}
          </small>
        </div>
      </div>

      {luckyCount + detourCount > 0 ? (
        <div className="rp-soundness-note">
          本场对题含水量：碰对 {luckyCount} 题 · 绕路 {detourCount} 题
          <span className="rp-quiet">（独立计数，不影响上方正确率）</span>
        </div>
      ) : null}

      <div className="rp-h">逐题节奏</div>
      {grades.length === 0 ? (
        <div className="empty-state">
          <Icon name="book" size="lg" />
          <span>本场没有已批改的题目。</span>
        </div>
      ) : (
        grades.map((grade, index) => {
          const outcome = gradeOutcomeKey(grade)
          const width =
            maxDuration > 0
              ? Math.min(100, Math.max(4, ((grade.duration ?? 0) / maxDuration) * 100))
              : 0
          /* 用时 vs 基准：样本 ≥3 用个人中位，否则 ≈ 标注回退题型基准 */
          const question = questions[grade.questionId]
          const baseline = timeBaselineFor(question?.categoryPath, question?.questionType, timeBaselines)
          const delta =
            grade.duration > 0 && baseline.seconds > 0 ? grade.duration - baseline.seconds : null
          const baselineHint =
            delta == null
              ? undefined
              : `${baseline.personal ? '对比你在该板块做对题的中位用时' : '样本不足 3 题，对比题型通用基准'}（${formatElapsed(baseline.seconds * 1000)}）`
          const deltaText =
            delta == null
              ? ''
              : `${baseline.personal ? '' : '≈'}${delta >= 0 ? '+' : '-'}${formatElapsed(Math.abs(delta) * 1000)}`
          return (
            <div className="rp-bar-row" key={`rate-${grade.questionId}-${index}`}>
              <span className="rp-w16 rp-quiet">{index + 1}</span>
              <span className="rp-w52">#{grade.questionId}</span>
              <span className="rp-bar">
                <i style={{ width: `${width}%`, background: BAR_COLOR[outcome] }} />
              </span>
              <span className={`rp-w40 ${OUTCOME_TEXT[outcome]}`}>{OUTCOME_SHORT[outcome]}</span>
              <span className="rp-w42 rp-quiet">
                {formatElapsed((grade.duration ?? 0) * 1000)}
              </span>
              <span
                className="rp-w56 rp-quiet"
                style={delta != null && delta > 0 ? { color: 'var(--warn-strong)' } : undefined}
                title={baselineHint}
              >
                {deltaText}
              </span>
            </div>
          )
        })
      )}

      <div className="rp-h">考场预测</div>
      <div className="insight-summary">
        <div>
          <span>数学一预测分</span>
          <strong>{vm.examPrediction != null ? vm.examPrediction : '—'}</strong>
          <small>{vm.examPrediction != null ? '/ 150' : '本组样本不足以估算，不编数字'}</small>
        </div>
      </div>
    </div>
  )
}
