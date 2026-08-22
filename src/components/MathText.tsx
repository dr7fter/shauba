import katex from 'katex'
import 'katex/dist/katex.min.css'

type Props = { value: string; className?: string }

const LATEX_COMMANDS = [
  'frac', 'dfrac', 'cfrac', 'int', 'iint', 'iiint', 'oint', 'sqrt', 'sum', 'prod', 'lim',
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'arccot',
  'ln', 'log', 'exp', 'mathrm', 'mathbf', 'mathbb', 'mathcal', 'pm', 'mp', 'times',
  'div', 'cdot', 'le', 'ge', 'leq', 'geq', 'neq', 'approx', 'equiv', 'forall', 'exists',
  'in', 'notin', 'subset', 'subseteq', 'cap', 'cup', 'to', 'infty', 'alpha', 'beta',
  'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa',
  'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma', 'tau', 'upsilon', 'phi', 'varphi',
  'chi', 'psi', 'omega', 'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma',
  'Upsilon', 'Phi', 'Psi', 'Omega', 'partial', 'nabla', 'circ', 'degree', 'lfloor',
  'rfloor', 'lceil', 'rceil', 'left', 'right', 'quad', 'qquad', 'text', 'overline', 'underline',
  'begin', 'end', 'cases', 'aligned', 'array', 'matrix', 'pmatrix', 'bmatrix'
].join('|')

const NAKED_LATEX_REGEX = new RegExp(
  `(?:\\\\(?:${LATEX_COMMANDS})\\b[^\\u4e00-\\u9fa5\\n\\$]+)`,
  'g'
)

const NORMALIZE_CMD_REGEX = new RegExp(
  `\\\\\\\\(${LATEX_COMMANDS})\\b`,
  'g'
)

function fixCasesAndLinebreaks(latex: string): string {
  let s = latex

  // Fix single backslash intended as line break inside multiline environments
  s = s.replace(/(\\begin\{(?:cases|aligned|array|matrix|pmatrix|bmatrix)\}[\s\S]*?\\end\{(?:cases|aligned|array|matrix|pmatrix|bmatrix)\})/g, (env) => {
    return env
      .replace(/([^\\])\\(?=[a-zA-Z]\s*=|[a-zA-Z]\s*&|[a-zA-Z]\s*\\le|[a-zA-Z]\s*\\ge|\d+\s*&)/g, '$1\\\\ ')
      .replace(/([^\\])\\(?!\\|[a-zA-Z]+)([\s]*[a-zA-Z0-9_\(\)\+\-\=])/g, '$1\\\\ $2')
  })

  // Also handle \left\{ x = ... \ y = ... \right.
  s = s.replace(/(\\left\s*\\\{[\s\S]*?\\right\s*\.)/g, (env) => {
    return env.replace(/([^\\])\\(?=[a-zA-Z]\s*=)/g, '$1\\\\ ')
  })

  // Standalone { x = ... \ y = ... }
  s = s.replace(/(\{[\s\S]*?\})/g, (block) => {
    if (block.includes('\\begin') || block.includes('\\frac')) return block
    return block.replace(/([^\\])\\(?=[a-zA-Z]\s*=)/g, '$1\\\\ ')
  })

  return s
}

function normalizeLatex(expr: string): string {
  let s = expr.replace(NORMALIZE_CMD_REGEX, '\\$1')
  s = s.replace(/\\\\([{}()_,\.\:])/g, '\\$1')
  s = s.replace(/\\\\,/g, '\\,')
  s = fixCasesAndLinebreaks(s)
  return s.trim()
}

function preprocessMathText(text: string): string {
  if (!text) return ''
  let s = text.replace(/!\[.*?\]\(asset:\/\/.*?\)/g, '').trim()

  // 1. Normalize multiple backslashes only on known commands
  s = s.replace(NORMALIZE_CMD_REGEX, '\\$1')
  s = s.replace(/\\\\([{}()_,\.\:])/g, '\\$1')
  s = s.replace(/\\\\,/g, '\\,')

  // 2. Protect existing valid delimited blocks ($$...$$, \[...\], $...$, \(...\))
  const placeholders: { id: string; content: string }[] = []
  s = s.replace(/(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g, (match) => {
    const id = `___MATH_PLH_${placeholders.length}___`
    placeholders.push({ id, content: match })
    return id
  })

  // 3. In the remaining text, wrap naked LaTeX expressions
  s = s.replace(NAKED_LATEX_REGEX, (rawMatch) => {
    let match = rawMatch.trim()
    // Strip trailing Chinese / full-width punctuation
    match = match.replace(/[，。；？！：）、“”‘’（【】\s]+$/, '').trim()
    // Strip trailing or leading single $ if mismatched
    match = match.replace(/\$$/, '').trim()
    if (match.startsWith('$')) match = match.slice(1).trim()
    if (match.length > 0) {
      return `$${match}$`
    }
    return rawMatch
  })

  // 4. Restore preserved blocks
  for (const ph of placeholders) {
    s = s.replace(ph.id, ph.content)
  }

  return s
}

export function MathText({ value, className = '' }: Props) {
  const cleanValue = preprocessMathText(value)
  const parts = cleanValue.split(/(\$\$[\s\S]+?\$\$|\$[^$]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g).filter(Boolean)
  return (
    <span className={`math-text ${className}`}>
      {parts.map((part, index) => {
        const display = part.startsWith('$$') || part.startsWith('\\[')
        const inline = !display && (part.startsWith('$') || part.startsWith('\\('))
        if (!display && !inline) return <span key={index}>{part}</span>
        const rawExpression = display
          ? (part.startsWith('$$') ? part.slice(2, -2) : part.slice(2, -2))
          : (part.startsWith('$') ? part.slice(1, -1) : part.slice(2, -2))
        const expression = normalizeLatex(rawExpression)
        try {
          return (
            <span
              key={index}
              className={display ? 'math-display' : 'math-inline'}
              dangerouslySetInnerHTML={{
                __html: katex.renderToString(expression, {
                  displayMode: display,
                  throwOnError: false,
                  strict: false,
                }),
              }}
            />
          )
        } catch {
          return <span key={index}>{part}</span>
        }
      })}
    </span>
  )
}
