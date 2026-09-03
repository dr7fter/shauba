import { memo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { MATH_PART_REGEX, normalizeLatex, preprocessMathText } from './mathTextCore'

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
  const parts = cleanValue.split(MATH_PART_REGEX).filter(Boolean)
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

