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
export const CS_RATING_MAX = 2.5
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

export type CsRatingAccent = 'donk' | 'clutch'

/**
 * rating 的高光档位（唯一口径）：≥2.00 DONK、≥1.35 Clutch。
 * 此前报告弹窗与 utils 各自硬编码，改档位要改两处——现在只改这里。
 */
export function csRatingAccent(value: number | null | undefined): CsRatingAccent | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value >= 2.0) return 'donk'
  if (value >= 1.35) return 'clutch'
  return null
}

/**
 * 0-100 百分制维度的档位（六维条、能力条共用阈值）。
 * 此前散落在 InsightsView 内联，改档要找半天——现在只改这里。
 */
export function gradeFromPercent(value: number): CsRatingTier {
  if (value >= 85) return 'S'
  if (value >= 75) return 'A'
  if (value >= 62) return 'B'
  if (value >= 48) return 'C'
  return 'D'
}

import type { RatingDimensions } from './types'

export type GradeOutcome = 'correct' | 'partial' | 'uncertain' | 'wrong'

export type GradeLike = {
  rating?: number | null
  verdict?: string | null
  result?: string | null
  correct?: boolean
  selfRating?: number | null
  duration?: number | null
  difficultyMultiplier?: number | null
  dimensions?: RatingDimensions | null
  questionType?: string | null
}

/**
 * 考研数一各题型基准耗时（单选3分 / 多选4分 / 填空5分 / 解答10分）。
 * 与 Rust 内核 services::rating::benchmark_seconds 保持严格一致。
 */
export function benchmarkSeconds(questionType?: string | null): number {
  switch (questionType) {
    case 'single_choice':
      return 180
    case 'multiple_choice':
      return 240
    case 'fill_in':
      return 300
    default:
      return 600
  }
}

const HLTV3_W_CAST = 0.38
const HLTV3_W_IMPACT = 0.22
const HLTV3_W_KAST = 0.20
const HLTV3_W_PACING = 0.20
const HLTV3_INTERCEPT = 0.26
const HLTV3_SLOPE = 0.0125
const PACING_NEUTRAL = 85.0
const PACING_MIN = 45.0
const PACING_MAX = 135.0
const PACING_AI_WEIGHT = 0.45
const PACING_TIME_WEIGHT = 0.55
const PACING_RUSH_CAP_ON_WRONG = 85.0
const SOFT_DIFF_FLOOR = 0.92
const SOFT_DIFF_CEIL = 1.10
const SOFT_DIFF_CAP = 1.24
const SOFT_DIFF_SLOPE = 0.45
const DONK_PACING_THRESHOLD = 118.0
const PACING_MIN_PLAUSIBLE_SECONDS = 5.0
const PACING_MAX_PLAUSIBLE_SECONDS = 1800.0

function softDiff(difficulty: number): number {
  let compressed = difficulty
  if (difficulty < SOFT_DIFF_FLOOR) {
    compressed = SOFT_DIFF_FLOOR + (difficulty - SOFT_DIFF_FLOOR) * SOFT_DIFF_SLOPE
  } else if (difficulty > SOFT_DIFF_CEIL) {
    compressed = SOFT_DIFF_CEIL + (difficulty - SOFT_DIFF_CEIL) * SOFT_DIFF_SLOPE
  }
  return Math.min(compressed, SOFT_DIFF_CAP)
}

function hasDimensionEvidence(dims?: RatingDimensions | null): boolean {
  if (!dims) return false
  return Boolean(
    (dims.rigor?.score != null && Number.isFinite(dims.rigor.score)) ||
    (dims.computation?.score != null && Number.isFinite(dims.computation.score)) ||
    (dims.modeling?.score != null && Number.isFinite(dims.modeling.score)) ||
    (dims.methodUse?.score != null && Number.isFinite(dims.methodUse.score)) ||
    (dims.speed?.score != null && Number.isFinite(dims.speed.score)) ||
    (dims.strategyInsight?.score != null && Number.isFinite(dims.strategyInsight.score))
  )
}

/**
 * 前后端完全一致的 HLTV Rating 3.0 复合评分合成（对齐 rating.rs hltv_rating）。
 */
export function computeHltvRating(input: {
  outcome: 'correct' | 'partial' | 'wrong' | 'uncertain'
  dimensions: RatingDimensions
  durationSeconds: number
  benchmarkSeconds?: number | null
  difficultyMultiplier?: number | null
}): number {
  const diff = softDiff(input.difficultyMultiplier ?? 1.0)
  const dims = input.dimensions

  // 1. Cast
  const compHint = dims.computation?.score ?? 50.0
  let cast = 10.0
  if (input.outcome === 'correct') {
    cast = 100.0
  } else if (input.outcome === 'partial') {
    cast = 38.0 + (compHint / 100.0) * 12.0
  } else if (input.outcome === 'uncertain') {
    cast = 30.0
  }

  // 2. Impact
  const strategy = dims.strategyInsight?.score ?? (input.outcome === 'correct' ? 65.0 : input.outcome === 'partial' ? 45.0 : input.outcome === 'uncertain' ? 30.0 : 18.0)
  const method = dims.methodUse?.score ?? (input.outcome === 'correct' ? 65.0 : input.outcome === 'partial' ? 45.0 : input.outcome === 'uncertain' ? 30.0 : 18.0)
  let impact = 0.60 * strategy + 0.40 * method
  const tech = dims.strategyInsight?.techniqueLevel ?? 0
  if (tech >= 4) {
    impact += 6.0
  }
  if (diff >= 1.06 && input.outcome !== 'wrong') {
    impact += 6.0
  }
  impact = Math.max(0, Math.min(100, impact))

  // 3. KAST
  const rigor = dims.rigor?.score ?? (input.outcome === 'correct' ? 75.0 : input.outcome === 'partial' ? 48.0 : input.outcome === 'uncertain' ? 35.0 : 25.0)
  const computation = dims.computation?.score ?? (input.outcome === 'correct' ? 75.0 : input.outcome === 'partial' ? 48.0 : input.outcome === 'uncertain' ? 35.0 : 25.0)
  const modeling = dims.modeling?.score ?? (input.outcome === 'correct' ? 75.0 : input.outcome === 'partial' ? 48.0 : input.outcome === 'uncertain' ? 35.0 : 25.0)
  const kast = Math.max(0, Math.min(100, 0.50 * rigor + 0.30 * computation + 0.20 * modeling))

  // 4. Pacing
  const duration = Math.max(1, input.durationSeconds)
  const bench = Math.max(1, input.benchmarkSeconds ?? 600)
  const timingPlausible = duration >= PACING_MIN_PLAUSIBLE_SECONDS && duration <= PACING_MAX_PLAUSIBLE_SECONDS
  const pTime = timingPlausible ? Math.max(PACING_MIN, Math.min(PACING_MAX, (bench / duration) * PACING_NEUTRAL)) : PACING_NEUTRAL
  let pacing = pTime
  if (typeof dims.speed?.score === 'number' && Number.isFinite(dims.speed.score)) {
    const pAi = PACING_MIN + (Math.max(0, Math.min(100, dims.speed.score)) / 100.0) * (PACING_MAX - PACING_MIN)
    pacing = PACING_AI_WEIGHT * pAi + PACING_TIME_WEIGHT * pTime
  }
  if (input.outcome === 'wrong') {
    pacing = Math.min(pacing, PACING_RUSH_CAP_ON_WRONG)
  }

  // 5. EcoDrag
  let ecoDrag = 0.0
  if (input.outcome === 'wrong') {
    if (timingPlausible && duration > bench * 1.2) {
      ecoDrag = Math.max(0.0, Math.min(1.5, (duration / bench) - 1.0)) * 24.0
    } else {
      ecoDrag = 8.0
    }
  }

  const composite = HLTV3_W_CAST * cast + HLTV3_W_IMPACT * impact + HLTV3_W_KAST * kast + HLTV3_W_PACING * pacing - ecoDrag
  const baseRaw = HLTV3_INTERCEPT + HLTV3_SLOPE * composite
  let rating = baseRaw * diff
  if (input.outcome === 'correct' && baseRaw > 1.40 && pacing >= DONK_PACING_THRESHOLD) {
    const burst = Math.pow(baseRaw - 1.40, 0.82) * 1.55
    rating = (1.40 + burst) * diff
  }

  return clampCsRating(rating)
}

/**
 * 从批改结果推导结果键（洞察页与报告弹窗此前各写一份，语义必须完全一致）。
 */
export function gradeOutcomeKey(grade: GradeLike): GradeOutcome {
  if (grade.verdict === 'partial') return 'partial'
  if (grade.verdict === 'uncertain' || grade.result === 'uncertain') return 'uncertain'
  if (grade.verdict === 'incorrect' || grade.result === 'wrong' || !grade.correct) return 'wrong'
  return 'correct'
}

/**
 * 单条批改结果 → CS rating（洞察页 averageReportRating 与报告弹窗 ratingForGrade 的合并实现）。
 */
export function gradeToCsRating(grade: GradeLike, benchmarkOrAverageSec?: number | null): number {
  return deriveGradeCsRating({
    rating: grade.rating,
    outcome: gradeOutcomeKey(grade),
    selfRating: grade.selfRating,
    duration: grade.duration,
    averageDuration: benchmarkOrAverageSec ?? null,
    benchmarkSeconds: benchmarkOrAverageSec ?? null,
    difficultyMultiplier: grade.difficultyMultiplier,
    dimensions: grade.dimensions,
  })
}

export function deriveGradeCsRating(input: {
  rating?: number | null
  outcome: 'correct' | 'partial' | 'wrong' | 'uncertain'
  selfRating?: number | null
  duration?: number | null
  averageDuration?: number | null
  difficultyMultiplier?: number | null
  dimensions?: RatingDimensions | null
  benchmarkSeconds?: number | null
}): number {
  // 评分回退链（前后端与 AGENTS.md 契约严格一致）：六维 HLTV 3.0 合成 > Codex rating > 特征曲线

  // 1. 六维 HLTV 3.0 合成（任一维非空即走此链，由确定性内核当裁判）
  if (hasDimensionEvidence(input.dimensions)) {
    return computeHltvRating({
      outcome: input.outcome,
      dimensions: input.dimensions!,
      durationSeconds: input.duration || input.benchmarkSeconds || input.averageDuration || 600,
      benchmarkSeconds: input.benchmarkSeconds || input.averageDuration || 600,
      difficultyMultiplier: input.difficultyMultiplier,
    })
  }

  // 2. 如果无六维证据，采信 Codex 指定 rating
  if (typeof input.rating === 'number' && Number.isFinite(input.rating) && input.rating >= CS_RATING_MIN && input.rating <= CS_RATING_MAX) {
    return clampCsRating(input.rating)
  }

  // 3. 特征曲线兜底
  const outcomeScore = input.outcome === 'correct' ? 92 : input.outcome === 'partial' ? 62 : input.outcome === 'uncertain' ? 35 : 20
  const fluencyScore = (Math.max(1, Math.min(4, input.selfRating ?? 2)) / 4) * 100
  const duration = Math.max(1, input.duration || input.benchmarkSeconds || input.averageDuration || 1)
  const bench = Math.max(1, input.benchmarkSeconds || input.averageDuration || duration)
  const speedScore = Math.max(45, Math.min(115, (bench / duration) * 100))
  const performanceScore = outcomeScore * 0.55 + fluencyScore * 0.25 + speedScore * 0.2
  const difficultyMultiplier = clampDifficultyMultiplier(input.difficultyMultiplier ?? 1)

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

export const RANK_EXPLANATION_TEXT = `🏆 刷吧 · 数一天梯段位表 (ELO)
───────────────────────────
👑 S   ≥ 2401  (巅峰大师 · 考研领跑)
⭐ A+  2201 - 2400  (顶尖名校 · 核心攻坚)
⭐ A   2001 - 2200  (高分卓越 · 规范严密)
🔷 B+  1801 - 2000  (实力进阶 · 解法熟练)
🔷 B   1601 - 1800  (稳扎稳打 · 基础扎实)
🔶 C+  1401 - 1600  (初战告捷 · 初始基准 1400)
🔶 C   1201 - 1400  (初窥门径)
⚪ D+  1000 - 1200  (起步阶段)
⚠️ D   < 1000       (基础待巩固)
───────────────────────────
* 结算机制：每场模考/刷题由确定性内核实时结算 ELO；连续 3 场同向触发 1.15x 动量，升段享有 3 场负分保护。`

export function getRankDescription(elo: number): string {
  const current = csRankForElo(elo)
  const nextTarget = current.next ? `距离下个段位还差 ${current.next - Math.round(elo)} 分` : '已达到巅峰段位 S'
  return `当前段位：${current.name} (ELO ${Math.round(elo)})\n${nextTarget}\n\n${RANK_EXPLANATION_TEXT}`
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
  const k = Math.max(40, Math.min(100, kast)) / 100
  const r = Math.max(0, Math.min(CS_RATING_MAX, rating))
  
  let base = 0
  if (r <= 0.80) {
    base = (r / 0.80) * 65.0
  } else if (r <= 1.20) {
    base = 65.0 + ((r - 0.80) / 0.40) * 50.0 // 0.80 -> 65, 1.00 -> 90, 1.17 -> 111.3, 1.20 -> 115
  } else if (r <= 1.50) {
    base = 115.0 + ((r - 1.20) / 0.30) * 28.0 // 1.20 -> 115, 1.35 -> 129, 1.50 -> 143
  } else {
    base = 143.0 + Math.min(1.0, (r - 1.50) / 0.20) * 7.0 // 1.50 -> 143, 1.70+ -> 150
  }
  
  const stability = Math.pow(k / 0.75, 0.12)
  const finalScore = Math.round(base * stability)
  return Math.max(0, Math.min(150, finalScore))
}

export function compareSemver(current: string, latest: string): boolean {
  const parse = (v: string) =>
    v
      .trim()
      .replace(/^v/, '')
      .split('.')
      .map((n) => parseInt(n, 10) || 0)
  const c = parse(current)
  const l = parse(latest)
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cv = c[i] ?? 0
    const lv = l[i] ?? 0
    if (lv > cv) return true
    if (lv < cv) return false
  }
  return false
}

export function rankLetterForElo(elo: number): string {
  return csRankForElo(elo).letter
}


