import type {
  AttemptHistoryEntry,
  GradingReport,
  GradingReportOrigin,
  PressureSession,
  Question,
  QuestionGrade,
  QuestionLearningMeta,
} from '../types'
import {
  averageCsRating,
  benchmarkSeconds,
  csRatingTier,
  csRatingTone,
  deriveGradeCsRating,
  gradeOutcomeKey,
  predictedExamScore,
  type CsRatingTier,
  type CsRatingTone,
} from '../utils.ts'

export type ReportDimKey =
  | 'rigor'
  | 'computation'
  | 'modeling'
  | 'methodUse'
  | 'speed'
  | 'strategyInsight'

export const REPORT_DIM_LABELS: Record<ReportDimKey, string> = {
  rigor: '严谨性',
  computation: '计算力',
  modeling: '审题建模',
  methodUse: '方法使用',
  speed: '速度',
  strategyInsight: '策略洞察力',
}

export type ReportDimensionStat = {
  key: ReportDimKey
  label: string
  value: number | null
  count: number
}

export type ReportEntry = {
  grade: QuestionGrade
  index: number
}

export type ReportPriorityEntry = ReportEntry & {
  rating: number
}

export type ReportStatus = 'complete' | 'partial' | 'evidence-insufficient' | 'empty'

export type ReportViewModel = {
  grades: QuestionGrade[]
  counts: {
    correct: number
    partial: number
    wrong: number
    uncertain: number
  }
  totalCount: number
  gradedCount: number
  totalDuration: number
  averageDuration: number
  accuracy: number | null
  ungradedIds: number[]
  ratingScores: number[]
  averageRatingScore: number | null
  ratingTier: CsRatingTier | null
  ratingTone: CsRatingTone
  dimStats: ReportDimensionStat[]
  ratingDimensions: ReportDimensionStat[]
  evidenceCoverage: number
  hasFullDimensionEvidence: boolean
  reportStatus: ReportStatus
  coverageKnown: boolean
  kastRate: number | null
  examPrediction: number | null
  wrongDimStats: Array<Omit<ReportDimensionStat, 'count'>>
  wrongDimsPresent: Array<{ key: ReportDimKey; label: string; value: number }>
  strongestWrongDim: { key: ReportDimKey; label: string; value: number } | null
  weakestWrongDim: { key: ReportDimKey; label: string; value: number } | null
  topWeakness: string | null
  attentionEntries: ReportEntry[]
  worstGradeEntry: ReportPriorityEntry | null
  verdictText: string
  priorityEntries: ReportEntry[]
}

function finiteNonNegative(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
}

function evidenceDims(grade: QuestionGrade): Array<{ key: ReportDimKey; label: string; value: number }> {
  const dims = grade.dimensions
  if (!dims) return []
  return (Object.keys(REPORT_DIM_LABELS) as ReportDimKey[])
    .map((key) => ({ key, label: REPORT_DIM_LABELS[key], value: dims[key]?.score }))
    .filter(
      (dimension): dimension is { key: ReportDimKey; label: string; value: number } =>
        typeof dimension.value === 'number' && Number.isFinite(dimension.value),
    )
}

export function reportEvidenceDims(grade: QuestionGrade) {
  return evidenceDims(grade)
}

export function reportFocusSentence(grade: QuestionGrade): string | null {
  const dims = evidenceDims(grade)
  if (dims.length < 2) return null
  const sorted = [...dims].sort((a, b) => b.value - a.value)
  const top = sorted[0]
  const bottom = sorted[sorted.length - 1]
  if (top.value - bottom.value < 20) return null
  const pair = `${top.key}>${bottom.key}`
  const templates: Record<string, string> = {
    'computation>strategyInsight': '算得动，但没找到路',
    'computation>methodUse': '算得动，但路走错了',
    'modeling>computation': '思路对，算挂了',
    'strategyInsight>computation': '思路对，算挂了',
    'speed>rigor': '手比脑子快',
    'speed>computation': '手比脑子快',
  }
  const verdictText = templates[pair] ?? `强在${top.label}，弱在${bottom.label}`
  return `${top.label} ${Math.round(top.value)} / ${bottom.label} ${Math.round(bottom.value)} → ${verdictText}`
}

function aggregateDimensions(grades: QuestionGrade[]): ReportDimensionStat[] {
  return (Object.keys(REPORT_DIM_LABELS) as ReportDimKey[]).map((key) => {
    const values = grades
      .map((grade) => grade.dimensions?.[key]?.score)
      .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
    return {
      key,
      label: REPORT_DIM_LABELS[key],
      value: values.length
        ? Math.round(values.reduce((sum, score) => sum + score, 0) / values.length)
        : null,
      count: values.length,
    }
  })
}

function ratingForGrade(
  grade: QuestionGrade,
  questions: Record<number, Question>,
  averageDuration: number,
): number {
  const question = questions[grade.questionId]
  const bench = question ? benchmarkSeconds(question.questionType) : averageDuration
  const diffMultiplier = question?.difficulty
    ? 0.9 + (Math.max(1, Math.min(5, question.difficulty)) - 1) * 0.075
    : grade.difficultyMultiplier
  return deriveGradeCsRating({
    rating: grade.rating,
    outcome: gradeOutcomeKey(grade),
    selfRating: grade.selfRating,
    duration: grade.duration,
    averageDuration,
    benchmarkSeconds: bench,
    difficultyMultiplier: diffMultiplier,
    dimensions: grade.dimensions,
  })
}

function countOutcomes(grades: QuestionGrade[]) {
  const counts = { correct: 0, partial: 0, wrong: 0, uncertain: 0 }
  for (const grade of grades) counts[gradeOutcomeKey(grade)] += 1
  return counts
}

export function filterReportEntries(
  grades: QuestionGrade[],
  filter: 'needs-attention' | 'all' | 'correct' | 'uncertain',
): ReportEntry[] {
  return grades
    .map((grade, index) => ({ grade, index }))
    .filter(({ grade }) => {
      const outcome = gradeOutcomeKey(grade)
      if (filter === 'needs-attention') return outcome !== 'correct'
      if (filter === 'correct') return outcome === 'correct'
      if (filter === 'uncertain') return outcome === 'uncertain'
      return true
    })
}

export function buildReportViewModel(
  report: GradingReport,
  questions: Record<number, Question>,
  session: PressureSession | null,
  reportOrigin: GradingReportOrigin,
): ReportViewModel {
  const grades = Array.isArray(report.grades) ? report.grades : []
  const summary = report.summary ?? ({} as GradingReport['summary'])
  const derivedCounts = countOutcomes(grades)
  const counts = grades.length > 0
    ? derivedCounts
    : {
        correct: Math.round(finiteNonNegative(summary.correctCount)),
        partial: Math.round(finiteNonNegative(summary.partialCount)),
        wrong: Math.round(finiteNonNegative(summary.wrongCount)),
        uncertain: Math.round(finiteNonNegative(summary.uncertainCount)),
      }
  const gradedCount = grades.length
  const totalCount = Math.max(
    gradedCount,
    Math.round(finiteNonNegative(summary.totalCount)),
    Array.isArray(report.questionIds) ? report.questionIds.length : 0,
  )
  const derivedDuration = grades.reduce((sum, grade) => sum + finiteNonNegative(grade.duration), 0)
  const totalDuration = Math.round(
    finiteNonNegative(summary.totalDuration, finiteNonNegative(session?.totalDuration, derivedDuration)),
  )
  const averageDuration = Math.round(
    finiteNonNegative(
      summary.averageDuration,
      totalCount > 0 ? totalDuration / totalCount : 0,
    ),
  )
  const accuracy = gradedCount > 0
    ? Math.round((counts.correct / gradedCount) * 100)
    : null
  const ungradedIds = [...new Set(
    (Array.isArray(report.ungradedQuestionIds) ? report.ungradedQuestionIds : [])
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id)),
  )]
  const ratingScores = grades.map((grade) => ratingForGrade(grade, questions, averageDuration))
  const averageRatingScore = averageCsRating(ratingScores)
  const ratingTier = csRatingTier(averageRatingScore)
  const ratingTone = csRatingTone(averageRatingScore)
  const dimStats = aggregateDimensions(grades)
  const ratingDimensions = dimStats.map((dimension) => ({ ...dimension }))
  const evidenceCoverage = grades.filter((grade) => evidenceDims(grade).length > 0).length
  const hasFullDimensionEvidence = grades.length > 0 && ratingDimensions.every((dimension) => dimension.value != null)
  const reportStatus: ReportStatus = grades.length === 0
    ? 'empty'
    : ungradedIds.length > 0 || report.status === 'graded_partial'
      ? 'partial'
      : evidenceCoverage < grades.length
        ? 'evidence-insufficient'
        : 'complete'
  const rigor = dimStats.find((dimension) => dimension.key === 'rigor')?.value
  const computation = dimStats.find((dimension) => dimension.key === 'computation')?.value
  const modeling = dimStats.find((dimension) => dimension.key === 'modeling')?.value
  const kastRate = rigor == null || computation == null || modeling == null
    ? null
    : Math.round(0.5 * rigor + 0.3 * computation + 0.2 * modeling)
  const examPrediction = averageRatingScore != null && kastRate != null
    ? predictedExamScore(averageRatingScore, kastRate)
    : null
  const wrongGrades = grades.filter((grade) => ['wrong', 'partial'].includes(gradeOutcomeKey(grade)))
  const wrongDimStats = aggregateDimensions(wrongGrades).map(({ key, label, value }) => ({ key, label, value }))
  const wrongDimsPresent = wrongDimStats.filter(
    (dimension): dimension is { key: ReportDimKey; label: string; value: number } => dimension.value != null,
  )
  const strongestWrongDim = wrongDimsPresent.length >= 2
    ? [...wrongDimsPresent].sort((a, b) => b.value - a.value)[0]
    : null
  const weakestWrongDim = wrongDimsPresent.length >= 2
    ? [...wrongDimsPresent].sort((a, b) => a.value - b.value)[0]
    : null
  const weaknessTally = new Map<string, number>()
  for (const grade of grades) {
    if (gradeOutcomeKey(grade) === 'correct') continue
    for (const tag of grade.weaknessTags ?? []) {
      weaknessTally.set(tag, (weaknessTally.get(tag) ?? 0) + 1)
    }
  }
  const topWeakness = [...weaknessTally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const attentionEntries = filterReportEntries(grades, 'needs-attention')
  const wrongEntries = attentionEntries
    .filter(({ grade }) => gradeOutcomeKey(grade) === 'wrong')
    .map(({ grade, index }) => ({ grade, index, rating: ratingScores[index] }))
    .sort((a, b) => a.rating - b.rating || a.index - b.index)
  const worstGradeEntry = wrongEntries[0] ?? (attentionEntries[0]
    ? {
        grade: attentionEntries[0].grade,
        index: attentionEntries[0].index,
        rating: ratingScores[attentionEntries[0].index],
      }
    : null)
  const verdictText = reportStatus === 'empty'
    ? '这次还没有可用的逐题证据，请先完成批改或刷新报告。'
    : topWeakness
      ? `主要问题集中在「${topWeakness}」`
      : attentionEntries.length > 0
        ? '先处理标记为错误、部分正确或待确认的题目，再安排复测。'
        : '本组暂未发现需要立即修复的结果，继续保持并用复测验证稳定性。'

  return {
    grades,
    counts,
    totalCount,
    gradedCount,
    totalDuration,
    averageDuration,
    accuracy,
    ungradedIds,
    ratingScores,
    averageRatingScore,
    ratingTier,
    ratingTone,
    dimStats,
    ratingDimensions,
    evidenceCoverage,
    hasFullDimensionEvidence,
    reportStatus,
    coverageKnown: reportOrigin.kind === 'pressure-session',
    kastRate,
    examPrediction,
    wrongDimStats,
    wrongDimsPresent,
    strongestWrongDim,
    weakestWrongDim,
    topWeakness,
    attentionEntries,
    worstGradeEntry,
    verdictText,
    priorityEntries: attentionEntries.slice(0, 3),
  }
}

// ============ E1 断点工单 · 派生层 ============

export type BreakpointSeverity = 'L1' | 'L2' | 'L3'

/**
 * 单题的认知动线内容。
 * 契约：diagnosis 缺什么就给 null，由 UI 决定该段是否渲染——绝不拿题干或结论编造内容。
 */
export type GradeFlow = {
  errorCode: string | null
  title: string | null
  severity: BreakpointSeverity | null
  /** 断点一句话：最早断点，来自 earliestError */
  killLine: string | null
  /** 学员落笔时的第一个动作 */
  myEntry: string | null
  /** 为什么这条路径走不通（讲原理） */
  whyDeadEnd: string | null
  rule: { negation: string; positive: string } | null
  fork: {
    step: number
    label: string
    myPath: string | null
    standardPath: string | null
    consequence: string | null
  } | null
  acceptance: string | null
  nextAction: string | null
}

const FATAL_TAGS = ['概念盲区', '概念边界', '充要混淆', '定理记错']
const SLIP_TAGS = ['瞄准失误', '计算笔误', '负号抄错']

function inferSeverity(grade: QuestionGrade): BreakpointSeverity | null {
  const tags = grade.errorTags ?? []
  if (tags.some((tag) => FATAL_TAGS.includes(tag))) return 'L1'
  if (tags.some((tag) => SLIP_TAGS.includes(tag))) return 'L3'
  return tags.length > 0 ? 'L2' : null
}

export function buildGradeFlow(grade: QuestionGrade): GradeFlow {
  const diagnosis = grade.diagnosis ?? null
  const killLine = grade.earliestError || grade.feedback || null
  const rawRule = diagnosis?.rule
  const rule: { negation: string; positive: string } | null =
    rawRule && (rawRule.negation || rawRule.positive)
      ? { negation: rawRule.negation ?? '', positive: rawRule.positive ?? '' }
      : null

  // 老报告没有 fork 时，用已有的 earliestError / betterSolution 重排成左右对照，
  // 只是换个呈现方式，不新增任何内容。
  const rawFork = diagnosis?.fork
  const fork = rawFork
    ? {
        step: rawFork.step ?? 1,
        label: rawFork.label ?? '路径选择',
        myPath: rawFork.myPath ?? null,
        standardPath: rawFork.standardPath ?? grade.betterSolution ?? null,
        consequence: rawFork.consequence ?? null,
      }
    : killLine || grade.betterSolution
      ? {
          step: 1,
          label: '路径选择',
          myPath: killLine,
          standardPath: grade.betterSolution ?? null,
          consequence: null,
        }
      : null

  return {
    errorCode: diagnosis?.errorCode ?? null,
    title: diagnosis?.title ?? grade.errorTags?.[0] ?? grade.weaknessTags?.[0] ?? null,
    severity: diagnosis?.severity ?? inferSeverity(grade),
    killLine,
    myEntry: diagnosis?.myEntry ?? null,
    whyDeadEnd: diagnosis?.whyDeadEnd ?? null,
    rule,
    fork,
    acceptance: diagnosis?.acceptance ?? null,
    nextAction: diagnosis?.nextAction ?? grade.advice ?? null,
  }
}

export type BreakpointGroup = {
  key: string
  errorCode: string | null
  title: string
  severity: BreakpointSeverity | null
  acceptance: string | null
  questionIds: number[]
  indices: number[]
  /** relapse：历史错 ≥2 次，或同一断点在本组出现 ≥2 次 */
  state: 'relapse' | 'new'
  historyWrong: number
  historyTotal: number
}

export function buildBreakpointGroups(
  grades: QuestionGrade[],
  history: AttemptHistoryEntry[] = [],
): BreakpointGroup[] {
  const wrongHistory = new Map<number, { total: number; wrong: number }>()
  for (const entry of history) {
    const current = wrongHistory.get(entry.questionId) ?? { total: 0, wrong: 0 }
    current.total += 1
    const outcome = (entry.verdict ?? entry.outcome ?? '').toLowerCase()
    if (outcome === 'wrong' || outcome === 'incorrect') current.wrong += 1
    wrongHistory.set(entry.questionId, current)
  }

  const groups = new Map<string, BreakpointGroup>()
  grades.forEach((grade, index) => {
    if (gradeOutcomeKey(grade) === 'correct') return
    const flow = buildGradeFlow(grade)
    const key = flow.errorCode
      ? `code:${flow.errorCode}`
      : flow.title
        ? `tag:${flow.title}`
        : `q:${grade.questionId}`
    const historyStat = wrongHistory.get(grade.questionId) ?? { total: 0, wrong: 0 }
    const existing = groups.get(key)
    if (existing) {
      existing.questionIds.push(grade.questionId)
      existing.indices.push(index)
      existing.historyWrong += historyStat.wrong
      existing.historyTotal += historyStat.total
      existing.state =
        existing.state === 'relapse' || historyStat.wrong >= 2 || existing.indices.length >= 2
          ? 'relapse'
          : 'new'
      if (!existing.acceptance && flow.acceptance) existing.acceptance = flow.acceptance
      return
    }
    groups.set(key, {
      key,
      errorCode: flow.errorCode,
      title: flow.title ?? `题目 #${grade.questionId}`,
      severity: flow.severity,
      acceptance: flow.acceptance,
      questionIds: [grade.questionId],
      indices: [index],
      state: historyStat.wrong >= 2 ? 'relapse' : 'new',
      historyWrong: historyStat.wrong,
      historyTotal: historyStat.total,
    })
  })

  return [...groups.values()].sort((a, b) => {
    if (a.state !== b.state) return a.state === 'relapse' ? -1 : 1
    return b.questionIds.length - a.questionIds.length || a.indices[0] - b.indices[0]
  })
}

/** 顶部结论句：把"错 N 题"翻译成"死在同一个动作上" */
export function breakpointHeadline(groups: BreakpointGroup[]): string | null {
  if (groups.length === 0) return null
  const biggest = [...groups].sort((a, b) => b.questionIds.length - a.questionIds.length)[0]
  const totalWrong = groups.reduce((sum, group) => sum + group.questionIds.length, 0)
  if (biggest.questionIds.length >= 2) {
    return `${totalWrong} 道题里，有 ${biggest.questionIds.length} 题死在同一个动作：${biggest.title}。`
  }
  if (biggest.state === 'relapse') {
    return `本轮唯一的复发断点是「${biggest.title}」——这次不是不会，是入口又选错了。`
  }
  return `本轮 ${totalWrong} 个断点，最该先修的是「${biggest.title}」。`
}

export function baselineDimensionValues(
  grades: QuestionGrade[],
): Record<ReportDimKey, number | null> {
  const stats = aggregateDimensions(grades)
  return stats.reduce(
    (acc, stat) => {
      acc[stat.key] = stat.value
      return acc
    },
    {} as Record<ReportDimKey, number | null>,
  )
}

export type GradeDimensionRow = {
  key: ReportDimKey
  label: string
  value: number | null
  base: number | null
  delta: number | null
}

/**
 * 单题维度 vs 本组基线。
 * 注意：现状报告里那四条维度条误用了全组均值（每题数字相同），这里改为取 grade.dimensions。
 */
export function gradeDimensionRows(
  grade: QuestionGrade,
  baseline: Record<ReportDimKey, number | null>,
): GradeDimensionRow[] {
  const dims = grade.dimensions
  return (Object.keys(REPORT_DIM_LABELS) as ReportDimKey[]).map((key) => {
    const value = typeof dims?.[key]?.score === 'number' ? dims[key]!.score! : null
    const base = baseline[key] ?? null
    return {
      key,
      label: REPORT_DIM_LABELS[key],
      value,
      base,
      delta: value != null && base != null ? Math.round(value - base) : null,
    }
  })
}

/** 维度对照的一句话洞察：只在极差足够大时给出，避免噪声 */
export function dimensionInsight(rows: GradeDimensionRow[]): string | null {
  const scored = rows.filter(
    (row): row is GradeDimensionRow & { value: number } => typeof row.value === 'number',
  )
  if (scored.length < 2) return null
  const sorted = [...scored].sort((a, b) => b.value - a.value)
  const top = sorted[0]
  const bottom = sorted[sorted.length - 1]
  if (top.value - bottom.value < 25) return null
  const pair = `${top.key}>${bottom.key}`
  const templates: Record<string, string> = {
    'speed>strategyInsight': '节奏偏急：直觉推导掩盖了审题盲区',
    'speed>methodUse': '盲目抢快：解法调用与题干结构脱节',
    'computation>strategyInsight': '运算充分，但解法路径绕远',
    'computation>methodUse': '运算扎实，但方法模型未对齐',
    'modeling>computation': '方向正确，但末端计算失准',
    'strategyInsight>computation': '思路清晰，但关键演算脱漏',
  }
  return templates[pair] ?? `${top.label} ${Math.round(top.value)} 远高于 ${bottom.label} ${Math.round(bottom.value)}`
}

// ============ WP6 总诊断与价值排序（2026-09-04）============

/** 病因类的中文标签与图标基调（扩展色，与严重度/对错正交） */
export const ERROR_CLASS_CHIP_META: Record<
  string,
  { label: string; icon: 'crosshair' | 'book' | 'route'; tone: 'cyan' | 'violet' | 'gold' }
> = {
  aiming: { label: '瞄准失误', icon: 'crosshair', tone: 'cyan' },
  concept: { label: '概念盲区', icon: 'book', tone: 'violet' },
  tactics: { label: '战术绕路', icon: 'route', tone: 'gold' },
}

/** 药方词表的中文标签（与 review_tasks.next_action 一一对应） */
export const NEXT_ACTION_LABELS: Record<string, string> = {
  practice_variant: '变式练',
  review_concept: '回看概念',
  quick_retry: '快速重做',
  timed_retry: '限时重做',
  manual_check: '人工确认',
}

export type SessionDigest = {
  /** 分布行（必给）：「8 题：对 5 / 半 1 / 错 2 · 2 题超时」 */
  distribution: string
  overtimeCount: number
  /** 聚类行：断点级结论优先，其次病因类众数；凑不出来就是 null（不硬编） */
  clusterLine: string | null
  /** 一件事：最大断点组中 severity 最高题的否定式规则；没有就 null */
  oneThingLine: string | null
}

const SEVERITY_ORDER: Record<BreakpointSeverity, number> = { L1: 0, L2: 1, L3: 2 }

function severityRank(severity: BreakpointSeverity | null): number {
  return severity != null ? SEVERITY_ORDER[severity] : 3
}

/**
 * 顶部总诊断三行。纪律：整份报告只强调一件事——
 * 聚类与一件事任一行凑不出可靠内容就留空，绝不用「各题都不错」凑数。
 */
export function buildSessionDigest(
  grades: QuestionGrade[],
  groups: BreakpointGroup[],
  metas: Record<number, QuestionLearningMeta>,
  questions: Record<number, Question>,
): SessionDigest {
  const counts = countOutcomes(grades)
  const overtimeCount = grades.filter((grade) => {
    const bench = benchmarkSeconds(questions[grade.questionId]?.questionType)
    return bench > 0 && grade.duration > bench
  }).length
  const parts = [`${grades.length} 题：对 ${counts.correct}`]
  if (counts.partial > 0) parts.push(`半 ${counts.partial}`)
  parts.push(`错 ${counts.wrong}`)
  if (counts.uncertain > 0) parts.push(`待确认 ${counts.uncertain}`)
  const distribution =
    parts.join(' / ') + (overtimeCount > 0 ? ` · ${overtimeCount} 题超时` : '')

  // 聚类行：病因类众数（"4 道里 3 道是计算"这层洞察）为主，断点级结论拼在后面
  const headline = breakpointHeadline(groups)
  const tally = new Map<string, number>()
  for (const grade of grades) {
    const outcome = gradeOutcomeKey(grade)
    if (outcome !== 'wrong' && outcome !== 'partial') continue
    const chip = ERROR_CLASS_CHIP_META[metas[grade.questionId]?.errorClass ?? '']
    if (chip) tally.set(chip.label, (tally.get(chip.label) ?? 0) + 1)
  }
  const topClass = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]
  let clusterLine: string | null
  if (topClass && topClass[1] >= 2) {
    clusterLine =
      `病因聚类：${topClass[0]} × ${topClass[1]} 题` +
      (headline ? `；${headline}` : '——今晚真正要修的是这一类，不是某一题')
  } else {
    clusterLine = headline
  }

  // 一件事：最大断点组（已按 relapse > new、成员数排序）中 severity 最高题的否定式规则
  let oneThingLine: string | null = null
  const topGroup = groups[0]
  if (topGroup) {
    const ruled = topGroup.indices
      .map((index) => buildGradeFlow(grades[index]))
      .filter((flow) => flow.rule?.negation)
      .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    const rule = ruled[0]?.rule?.negation
    if (rule) oneThingLine = `📌 本次只带走一件：${rule}`
  }

  return { distribution, overtimeCount, clusterLine, oneThingLine }
}

/**
 * 侧栏价值排序（WP6）：错 > 半 > 待确认 > 对；同级 severity L1 > L2 > L3；
 * 同 code/标题的聚类代表题优先；原始顺序兜底。
 * 只用本批次数据，不依赖历史异步到达——排序在页面加载后保持稳定。
 */
export function sortIndicesByValue(grades: QuestionGrade[]): number[] {
  const clusterKeyOf = (grade: QuestionGrade): string | null => {
    const flow = buildGradeFlow(grade)
    return flow.errorCode ? `code:${flow.errorCode}` : flow.title ? `tag:${flow.title}` : null
  }
  const tally = new Map<string, number>()
  for (const grade of grades) {
    if (gradeOutcomeKey(grade) === 'correct') continue
    const key = clusterKeyOf(grade)
    if (key) tally.set(key, (tally.get(key) ?? 0) + 1)
  }
  const outcomeRank = { wrong: 0, partial: 1, uncertain: 2, correct: 3 } as const
  return grades
    .map((grade, index) => ({ grade, index }))
    .sort((a, b) => {
      const byOutcome =
        outcomeRank[gradeOutcomeKey(a.grade)] - outcomeRank[gradeOutcomeKey(b.grade)]
      if (byOutcome !== 0) return byOutcome
      const bySeverity =
        severityRank(buildGradeFlow(a.grade).severity) -
        severityRank(buildGradeFlow(b.grade).severity)
      if (bySeverity !== 0) return bySeverity
      const keyA = clusterKeyOf(a.grade)
      const keyB = clusterKeyOf(b.grade)
      const clusterA = keyA != null && (tally.get(keyA) ?? 0) >= 2 ? 0 : 1
      const clusterB = keyB != null && (tally.get(keyB) ?? 0) >= 2 ? 0 : 1
      if (clusterA !== clusterB) return clusterA - clusterB
      return a.index - b.index
    })
    .map((entry) => entry.index)
}
