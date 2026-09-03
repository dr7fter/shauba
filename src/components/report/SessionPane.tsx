import { CS_RATING_MAX, csRatingAccent, formatElapsed, gradeOutcomeKey } from '../../utils'
import type { ReportViewModel } from '../../domain/reportViewModel'

const BAR_COLOR = { correct: 'var(--success)', partial: 'var(--warn)', wrong: 'var(--danger)', uncertain: 'var(--muted)' }

/**
 * 「本场」视图：事后看趋势的地方。
 *
 * 雷达图、逐题 rating、考场预测全部搬到这里——它们不参与复盘当下的决策，
 * 放在主屏只会抢走注意力。
 */
export function SessionPane({ vm }: { vm: ReportViewModel }) {
  const { grades, ratingScores, counts, accuracy, averageRatingScore, ratingDimensions } = vm
  const avgDuration = grades.length ? Math.round(vm.totalDuration / grades.length) : 0

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
          <span>平均 Rating</span>
          <strong>
            {averageRatingScore != null ? averageRatingScore.toFixed(2) : '—'}
          </strong>
          <small>
            证据覆盖 {vm.evidenceCoverage}/{vm.gradedCount}
          </small>
        </div>
        <div>
          <span>总用时</span>
          <strong>{formatElapsed(vm.totalDuration * 1000)}</strong>
          <small>均 {formatElapsed(avgDuration * 1000)} / 题</small>
        </div>
      </div>

      <div className="rp-h">逐题 Rating</div>
      {grades.length === 0 ? (
        <div className="empty-state">本场没有已批改的题目。</div>
      ) : (
        grades.map((grade, index) => {
          const score = ratingScores[index]
          const outcome = gradeOutcomeKey(grade)
          const accent = csRatingAccent(score)
          const width = score != null ? Math.min(100, Math.max(4, (score / CS_RATING_MAX) * 100)) : 0
          return (
            <div className="rp-bar-row" key={`rate-${grade.questionId}-${index}`}>
              <span className="rp-w16 rp-quiet">{index + 1}</span>
              <span className="rp-w52">#{grade.questionId}</span>
              <span className="rp-bar">
                <i style={{ width: `${width}%`, background: BAR_COLOR[outcome] }} />
              </span>
              <span className="rp-w40">{score != null ? score.toFixed(2) : '—'}</span>
              <span className="rp-w42 rp-quiet">
                {formatElapsed((grade.duration ?? 0) * 1000)}
              </span>
              {accent === 'donk' ? <span title="高光突破">👑</span> : null}
            </div>
          )
        })
      )}

      <div className="rp-h">六维特征</div>
      {ratingDimensions.map((dim) => (
        <div className="rp-bar-row" key={`dim-${dim.key}`}>
          <span className="rp-w72">{dim.label}</span>
          <span className="rp-bar">
            <i style={{ width: `${dim.value ?? 0}%` }} />
          </span>
          <span className="rp-w30">{dim.value != null ? dim.value : '—'}</span>
          <span className="rp-w56 rp-quiet">{dim.count} 题证据</span>
        </div>
      ))}

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
