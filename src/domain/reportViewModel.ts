import type {
  GradingReport,
  GradingReportOrigin,
  PressureSession,
  Question,
  QuestionGrade,
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
