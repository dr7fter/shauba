import katex from 'katex'
import 'katex/dist/katex.min.css'

type Props = { value: string; className?: string }

export function MathText({ value, className = '' }: Props) {
  const cleanValue = value ? value.replace(/!\[.*?\]\(asset:\/\/.*?\)/g, '').trim() : ''
  const parts = cleanValue.split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$)/g).filter(Boolean)
  return (
    <span className={`math-text ${className}`}>
      {parts.map((part, index) => {
        const display = part.startsWith('$$')
        const inline = !display && part.startsWith('$')
        if (!display && !inline) return <span key={index}>{part}</span>
        const expression = display ? part.slice(2, -2) : part.slice(1, -1)
        try {
          return <span key={index} className={display ? 'math-display' : 'math-inline'} dangerouslySetInnerHTML={{ __html: katex.renderToString(expression, { displayMode: display, throwOnError: false, strict: false }) }} />
        } catch {
          return <span key={index}>{part}</span>
        }
      })}
    </span>
  )
}
