/**
 * Formats a Date object to local YYYY-MM-DD string according to the local timezone.
 * Avoids the UTC-offset mismatch from Date#toISOString() (which is off by 8 hours in UTC+8).
 */
export function localToday(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Formats seconds into a human-readable string (e.g., "3分20秒" or "45秒").
 */
export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  if (mins === 0) return `${secs}秒`
  if (secs === 0) return `${mins}分钟`
  return `${mins}分${secs}秒`
}

/**
 * Formats milliseconds to HH:MM:SS string.
 */
export function formatElapsed(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * Normalizes multi-choice / objective answers into sorted capital letters (e.g. "a, c" -> "AC").
 */
export function normalizeAnswer(value: string): string {
  return value.toUpperCase().replace(/[^A-Z]/g, '').split('').sort().join('')
}

/**
 * Returns chip label, symbol and tone for an attempt outcome.
 */
export function outcomeChip(outcome: 'correct' | 'partial' | 'wrong' | 'uncertain'): {
  label: string
  symbol: string
  tone: string
  note?: string
} {
  if (outcome === 'correct') return { label: '对', symbol: '✓', tone: 'correct' }
  if (outcome === 'partial') return { label: '部分', symbol: '半', tone: 'partial' }
  if (outcome === 'uncertain')
    return { label: '不确定', symbol: '?', tone: 'uncertain', note: '未计入正确率与掌握进度' }
  return { label: '错', symbol: '✗', tone: 'wrong' }
}

/**
 * Formats seconds into MM:SS string for question timers.
 */
export function formatTimer(totalSeconds: number): string {
  const m = Math.floor(Math.max(0, totalSeconds) / 60)
  const s = Math.floor(Math.max(0, totalSeconds) % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Evaluates pacing compared to the benchmark duration.
 */
export function getPaceEvaluation(
  sec: number,
  bench: number
): { level: 'fast' | 'normal' | 'slow' | 'overtime'; label: string; desc: string } {
  if (sec <= bench * 0.5) return { level: 'fast', label: '⚡ 极速秒杀', desc: '思路清晰，神速拿下！' }
  if (sec <= bench) return { level: 'normal', label: '✓ 节奏标准', desc: '处于数一考场推荐节奏内。' }
  if (sec <= bench * 1.5) return { level: 'slow', label: '⏱ 稍有迟疑', desc: '耗时稍多，注意化简与步骤精炼。' }
  return {
    level: 'overtime',
    label: '⚠️ 耗时偏长',
    desc: '可能存在方法绕路或复杂硬算，需复盘最优解法。',
  }
}

/**
 * CS-like rating scale used in reports. The centre remains 1.00 while the
 * compact 0.00–2.00 range is deliberately difficult at both tails. In
 * particular, the upper half uses a quadratic curve: 1.50 is already an
 * exceptional result and 2.00 is reserved for near-perfect, difficult work.
 */
export const CS_RATING_MIN = 0
export const CS_RATING_MAX = 2
export const CS_RATING_AVERAGE = 1

export const DIFFICULTY_MULTIPLIER_MIN = 0.94
export const DIFFICULTY_MULTIPLIER_MAX = 1.10

function clampDifficultyMultiplier(value: number): number {
  return Math.max(DIFFICULTY_MULTIPLIER_MIN, Math.min(DIFFICULTY_MULTIPLIER_MAX, value))
}

export type CsRatingTone = 'low' | 'average' | 'high' | 'empty'
export type CsRatingTier = 'S' | 'A' | 'B' | 'C' | 'D'

export function clampCsRating(value: number): number {
  return Number(Math.max(CS_RATING_MIN, Math.min(CS_RATING_MAX, value)).toFixed(2))
}

export function csRatingTier(value: number | null | undefined): CsRatingTier | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value >= 1.6) return 'S'
  if (value >= 1.3) return 'A'
  if (value >= 0.9) return 'B'
  if (value >= 0.6) return 'C'
  return 'D'
}

/** 红绿黑三色分界，与洞察页图例一致：低于 0.98 红、0.98–1.07 黑、高于 1.07 绿。 */
export function csRatingTone(value: number | null | undefined): CsRatingTone {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'empty'
  if (value < 0.98) return 'low'
  if (value > 1.07) return 'high'
  return 'average'
}

export function deriveGradeCsRating(input: {
  rating?: number | null
  outcome: 'correct' | 'partial' | 'wrong' | 'uncertain'
  selfRating?: number | null
  duration?: number | null
  averageDuration?: number | null
  difficultyMultiplier?: number | null
}): number {
  const outcomeScore = input.outcome === 'correct' ? 92 : input.outcome === 'partial' ? 62 : input.outcome === 'uncertain' ? 35 : 20
  const fluencyScore = (Math.max(1, Math.min(4, input.selfRating ?? 2)) / 4) * 100
  const duration = Math.max(1, input.duration || input.averageDuration || 1)
  const averageDuration = Math.max(1, input.averageDuration || duration)
  const speedScore = Math.max(45, Math.min(115, (averageDuration / duration) * 100))
  const performanceScore = outcomeScore * 0.55 + fluencyScore * 0.25 + speedScore * 0.2
  const difficultyMultiplier = clampDifficultyMultiplier(input.difficultyMultiplier ?? 1)

  // Codex 评分直接采信（与 Rust 内核 services/rating.rs 策略一致）：
  // 分布守门由提示词锚点 rubric 与 0-2 范围校验完成，特征值仅用于
  // 无 AI 评分时的合成，不再对草稿评分二次压分。
  if (typeof input.rating === 'number' && Number.isFinite(input.rating)) {
    return clampCsRating(input.rating)
  }
  return ratingCurve(performanceScore, difficultyMultiplier)
}

function ratingCurve(performanceScore: number, difficultyMultiplier = 1): number {
  const score = Math.max(0, Math.min(100, performanceScore))
  const baseRating = score <= 60
    ? 0.25 + (score / 60) * 0.75
    : 1 + Math.pow((score - 60) / 40, 4) * 0.82
  return clampCsRating(baseRating * clampDifficultyMultiplier(difficultyMultiplier))
}

export function averageCsRating(values: number[]): number | null {
  if (!values.length) return null
  return clampCsRating(values.reduce((sum, value) => sum + value, 0) / values.length)
}

export function toCsRating(performanceScore: number, difficulty = 3): number {
  const rawMultiplier = 0.9 + (Math.max(1, Math.min(5, difficulty)) - 1) * 0.075
  return ratingCurve(performanceScore, clampDifficultyMultiplier(rawMultiplier))
}

/** Estimate a CS-like rating from legacy daily aggregates without inventing AI dimensions. */
export function estimateDailyCsRating(
  attempts: number,
  correct: number,
  fluencyRating: number | null,
): number | null {
  if (attempts <= 0 || fluencyRating === null) return null
  const accuracyScore = Math.max(0, Math.min(100, (correct / attempts) * 100))
  const fluencyScore = (Math.max(1, Math.min(4, fluencyRating)) / 4) * 100
  return toCsRating(accuracyScore * 0.62 + fluencyScore * 0.38, 3)
}

export type CsRank = {
  key: string
  name: string
  letter: string
  min: number
  color: string
  next: number | null
}

/** 完美平台天梯段位：D→S 九段，每 200 分一段，S 为最高段。 */
const WANMEI_RANKS: Array<Omit<CsRank, 'next'>> = [
  { key: 'd', name: 'D', letter: 'D', min: 0, color: '#8A94A0' },
  { key: 'd+', name: 'D+', letter: 'D+', min: 1000, color: '#8A94A0' },
  { key: 'c', name: 'C', letter: 'C', min: 1201, color: '#3FA66A' },
  { key: 'c+', name: 'C+', letter: 'C+', min: 1401, color: '#3FA66A' },
  { key: 'b', name: 'B', letter: 'B', min: 1601, color: '#315E9E' },
  { key: 'b+', name: 'B+', letter: 'B+', min: 1801, color: '#315E9E' },
  { key: 'a', name: 'A', letter: 'A', min: 2001, color: '#7C5CD6' },
  { key: 'a+', name: 'A+', letter: 'A+', min: 2201, color: '#7C5CD6' },
  { key: 's', name: 'S', letter: 'S', min: 2401, color: '#D9A62E' },
]

export function csRankForElo(rating: number): CsRank {
  let index = 0
  WANMEI_RANKS.forEach((candidate, i) => {
    if (rating >= candidate.min) index = i
  })
  const next = WANMEI_RANKS[index + 1]?.min ?? null
  return { ...WANMEI_RANKS[index], next }
}

/**
 * Returns verdict label and tone for AI grading diagnosis.
 */
export function verdictChip(verdict: string | null): { label: string; tone: string } {
  if (verdict === 'correct') return { label: '正确', tone: 'correct' }
  if (verdict === 'partial') return { label: '部分正确', tone: 'uncertain' }
  if (verdict === 'incorrect' || verdict === 'wrong') return { label: '有误', tone: 'wrong' }
  if (verdict === 'uncertain') return { label: '不确定', tone: 'uncertain' }
  return { label: '已批改', tone: 'correct' }
}

/**
 * 考场 150 分预测分映射计算器 (基于 HLTV Rating 3.0 与 KAST 稳定性)
 */
export function predictedExamScore(rating: number, kast = 75): number {
  const k = Math.max(30, Math.min(100, kast)) / 100
  const r = Math.max(0, Math.min(2.0, rating))
  const exponent = -2.75 * (r - 1.05)
  const logistic = 1 / (1 + Math.exp(exponent))
  const score = 150 * logistic * Math.pow(k, 0.18)
  return Math.round(Math.max(0, Math.min(150, score)))
}

