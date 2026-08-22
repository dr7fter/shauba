import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number
  pageCount: number
  onChange: (page: number) => void
}) {
  if (pageCount <= 1) return null
  const pages = Array.from(
    new Set([1, page - 1, page, page + 1, pageCount].filter((value) => value >= 1 && value <= pageCount))
  ).sort((a, b) => a - b)

  return (
    <div className="pagination">
      <button title="上一页" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronLeft size={16} />
      </button>
      {pages.map((value, index) => (
        <span key={value}>
          {index > 0 && value - pages[index - 1] > 1 && <i>...</i>}
          <button className={value === page ? 'active' : ''} onClick={() => onChange(value)}>
            {value}
          </button>
        </span>
      ))}
      <button title="下一页" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
