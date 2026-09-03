/**
 * 数学文本的纯文本预处理——从 MathText.tsx 抽出来的无副作用部分。
 *
 * 抽出来的唯一理由：这一层含 `$$` 行间公式的还原逻辑，出过一次
 * 静默降级（占位符用「替换串」还原，$$ 被折叠成 $），影响题库 51.2% 的正解。
 * 留在 .tsx 里就没法进 node --test（组件带 katex CSS import），
 * 放在这里才能写回归测试把它钉死。
 *
 * 约束：本文件不得 import 任何 CSS、React 或组件。
 */

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

export function normalizeLatex(expr: string): string {
  let s = expr.replace(NORMALIZE_CMD_REGEX, '\\$1')
  s = s.replace(/\\\\([{}()_,\.\:])/g, '\\$1')
  s = s.replace(/\\\\,/g, '\\,')
  s = fixCasesAndLinebreaks(s)
  return s.trim()
}

/** 行间/行内公式的分隔正则，MathText 组件与预处理共用 */
export const MATH_PART_REGEX =
  /(\$\$[\s\S]+?\$\$|\$[^$]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g

export function preprocessMathText(text: string): string {
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
  //    必须传函数：String.replace 的「替换串」里 $ 是特殊字符，$$ 会被折叠成 $，
  //    于是 $$...$$ 行间公式被降级成行内公式（题库 51.2% 的正解含 $$）。
  for (const ph of placeholders) {
    s = s.replace(ph.id, () => ph.content)
  }

  return s
}
