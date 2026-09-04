import type { ReactNode } from 'react'
import { formatElapsed, type GradeOutcome } from '../../utils'
import { Icon, type IconName } from '../ui/Icon'

export type RailRow = {
  index: number
  questionId: number
  outcome: GradeOutcome
  /** 分类路径的末段，例如「一元函数积分学」 */
  categoryShort: string
  durationSec: number
}

const MARK: Record<GradeOutcome, { icon: IconName; cls: string; label: string }> = {
  correct:   { icon: 'check', cls: 'm-ok',  label: '正确' },
  partial:   { icon: 'half',  cls: 'm-mid', label: '部分正确' },
  wrong:     { icon: 'x',     cls: 'm-bad', label: '错误' },
  uncertain: { icon: 'dot',   cls: 'm-mid', label: '待确认' },
}

/**
 * 左侧题目索引（macOS source list 风格）。
 * 只承担「我在哪一题 + 这题什么结果」，不承载任何分析内容。
 */
export function QuestionRail({
  rows,
  activeIndex,
  onSelect,
  footerLeft,
  footerRight,
}: {
  rows: RailRow[]
  activeIndex: number
  onSelect: (index: number) => void
  footerLeft?: ReactNode
  footerRight?: ReactNode
}) {
  return (
    <aside className="rp-side">
      <div className="rp-side-hd">本场题目</div>
      <div className="rp-nav">
        {rows.map((row) => {
          const mark = MARK[row.outcome]
          return (
            <div
              key={`${row.questionId}-${row.index}`}
              className={`rp-row${row.index === activeIndex ? ' rp-on' : ''}`}
              role="button"
              tabIndex={0}
              aria-current={row.index === activeIndex}
              onClick={() => onSelect(row.index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(row.index)
                }
              }}
            >
              <span className="rp-idx">{row.index + 1}</span>
              <span className={`rp-mark ${mark.cls}`} title={mark.label} aria-label={mark.label}>
                <Icon name={mark.icon} />
              </span>
              <span className="rp-main">
                <span className="rp-cat">{row.categoryShort}</span>
                <span className="rp-dur">
                  #{row.questionId} · {formatElapsed(row.durationSec * 1000)}
                </span>
              </span>
            </div>
          )
        })}
      </div>
      <div className="rp-side-ft">
        <span>{footerLeft}</span>
        <span>{footerRight}</span>
      </div>
    </aside>
  )
}
