import { memo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

type Props = { value: string; className?: string }

/**
 * 渲染缓存上限。超出后整体清空（简易 LRU）——刷题场景下同一批题干会被反复
 * 重渲染，命中率极高；整体清空比维护完整 LRU 链表更省事，代价可接受。
 */
const RENDER_CACHE_LIMIT = 500
const preprocessCache = new Map<string, string>()
const katexCache = new Map<string, string>()

function cacheGetOrSet(cache: Map<string, string>, key: string, produce: () => string): string {
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const produced = produce()
  if (cache.size >= RENDER_CACHE_LIMIT) cache.clear()
  cache.set(key, produced)
  return produced
}

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
  'begin', 'end', 'cases', 'aligned', 'array', 'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix',
  'operatorname', 'det', 'dim', 'ker', 'diag', 'rank', 'tr', 'trace', 'span',
  'max', 'min', 'sup', 'inf', 'vec', 'hat', 'bar', 'tilde', 'dot', 'ddot', 'prime',
  'Rightarrow', 'Leftarrow', 'Leftrightarrow', 'implies', 'iff', 'rightarrow', 'leftarrow',
  'parallel', 'perp', 'Vert', 'vert'
].join('|')

// Strictly match standalone LaTeX macros or symbols without eating surrounding prose
const NAKED_LATEX_REGEX = new RegExp(
  `(?:\\\\(?:frac|dfrac|cfrac)\\{(?:[^{}]|\\{[^{}]*\\})*\\}\\{(?:[^{}]|\\{[^{}]*\\})*\\}` +
  `|\\\\sqrt(?:\\[[^\\]]*\\])?\\{(?:[^{}]|\\{[^{}]*\\})*\\}` +
  `|\\\\(?:int|iint|iiint|oint|sum|prod|lim)(?:_\\{[^{}]*\\}|_[a-zA-Z0-9\\\\]+)?(?:\\^\\{[^{}]*\\}|\\^[a-zA-Z0-9\\\\]+)?` +
  `|\\\\(?:text|mathrm|mathbf|mathbb|mathcal|operatorname)\\{[^{}]*\\}` +
  `|\\\\(?:${LATEX_COMMANDS}))`,
  'g'
)

const NORMALIZE_CMD_REGEX = new RegExp(
  `\\\\\\\\(${LATEX_COMMANDS})\\b`,
  'g'
)

function fixCasesAndLinebreaks(latex: string): string {
  let s = latex

  // Fix single backslash intended as line break inside multiline environments
  s = s.replace(/(\\begin\{(?:cases|aligned|array|matrix|pmatrix|bmatrix|vmatrix|Vmatrix)\}[\s\S]*?\\end\{(?:cases|aligned|array|matrix|pmatrix|bmatrix|vmatrix|Vmatrix)\})/g, (env) => {
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

  // 2. Collapse linebreaks surrounding isolated math operators or chained symbols
  s = s.replace(/\n\s*([\+\-\=\*\/])\s*\n/g, ' $1 ')
  s = s.replace(/(\\[a-zA-Z]+)\s*\n\s*([0-9a-zA-Z\^\_\{\}\+\-]+)/g, '$1 $2')

  // 3. Protect existing valid delimited blocks ($$...$$, \[...\], $...$, \(...\))
  const placeholders: { id: string; content: string }[] = []
  s = s.replace(/(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g, (match) => {
    const id = `___MATH_PLH_${placeholders.length}___`
    placeholders.push({ id, content: match })
    return id
  })

  // 4. In the remaining text, wrap ONLY precisely recognized naked LaTeX formulas
  s = s.replace(NAKED_LATEX_REGEX, (rawMatch) => {
    const match = rawMatch.trim()
    if (match.length > 0) {
      return `$${match}$`
    }
    return rawMatch
  })

  // 5. Merge adjacent inline math blocks joined by simple operators like `$A$ + $B$` -> `$A + B$`
  s = s.replace(/\$\s*([^\$]+?)\s*\$\s*([\+\-\=\,\;])\s*\$\s*([^\$]+?)\s*\$/g, '$$$1 $2 $3$$')
  s = s.replace(/\$\s*([^\$]+?)\s*\$\s*([\+\-\=\,\;])\s*\$\s*([^\$]+?)\s*\$/g, '$$$1 $2 $3$$')

  // 6. Restore preserved blocks
  for (const ph of placeholders) {
    s = s.replace(ph.id, ph.content)
  }

  return s
}

/**
 * 数学文本渲染。
 *
 * 性能说明：本组件在 TodayView 中同时出现 5 次（题干 / 4 个选项 / 答案 / 解析），
 * 而计时器每 1000ms 触发一次 setQuestionElapsedSec，导致整棵子树每秒重渲染。
 * v1.6.8 之前 `preprocessMathText`（十余次正则）与 `katex.renderToString` 均无缓存，
 * 长题干或含矩阵的题目会持续掉帧。现对两层计算都加缓存，并用 memo 阻断
 * 父组件重渲染传导。
 */
export const MathText = memo(function MathText({ value, className = '' }: Props) {
  if (!value) return null
  const cleanValue = cacheGetOrSet(preprocessCache, value, () => preprocessMathText(value))
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
          const html = cacheGetOrSet(katexCache, `${display ? 'd' : 'i'}:${expression}`, () =>
            katex.renderToString(expression, {
              displayMode: display,
              throwOnError: false,
              strict: false,
            }),
          )
          return (
            <span
              key={index}
              className={display ? 'math-display' : 'math-inline'}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )
        } catch {
          return <span key={index}>{part}</span>
        }
      })}
    </span>
  )
})

