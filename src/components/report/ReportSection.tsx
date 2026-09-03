import type { ReactNode } from 'react'
import { Icon } from '../ui/Icon'

/**
 * 报告的折叠段（macOS disclosure + Codex 的等宽序号）。
 *
 * 折叠状态由父级按「语义键」持有（entry / kill / why / sol / rule），
 * 不按下标持有——不同题目的段数不同，按下标会在切题时串位。
 */
export function ReportSection({
  n,
  title,
  tag,
  open,
  onToggle,
  variant,
  children,
}: {
  n: number
  title: string
  tag?: string | null
  open: boolean
  onToggle: () => void
  /** kill = 断点段，左侧一道红线把这段从其余段落里拎出来 */
  variant?: 'kill'
  children: ReactNode
}) {
  return (
    <section className={`rp-sec${variant === 'kill' ? ' rp-kill' : ''}${open ? ' rp-open' : ''}`}>
      <div
        className="rp-sec-hd"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onToggle()
          }
        }}
      >
        <span className="rp-tri" aria-hidden="true">
          <Icon name="chevron" />
        </span>
        <span className="rp-sec-n">{String(n).padStart(2, '0')}</span>
        <span className="rp-sec-t">{title}</span>
        {tag ? <span className="rp-sec-tag">{tag}</span> : null}
      </div>
      <div className="rp-sec-bd">{children}</div>
    </section>
  )
}
