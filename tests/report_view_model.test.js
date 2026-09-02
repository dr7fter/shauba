import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildReportViewModel,
  filterReportEntries,
} from '../src/domain/reportViewModel.ts'
import { predictedExamScore } from '../src/utils.ts'

const pressureOrigin = { kind: 'pressure-session', sessionId: 'pressure-1' }
const batchOrigin = { kind: 'codex-batch', taskId: 'SB-20260902-1' }

function grade(questionId, overrides = {}) {
  return {
    questionId,
    correct: true,
    userAnswer: '',
    correctAnswer: '',
    feedback: '',
    duration: 120,
    ...overrides,
  }
}

function report(grades, overrides = {}) {
  return {
    sessionId: 'pressure-1',
    grades,
    summary: {
      correctCount: 0,
      totalCount: grades.length,
      accuracy: 0,
      strengths: [],
      weaknesses: [],
      suggestions: [],
      ...overrides.summary,
    },
    createdAt: 0,
    ...overrides,
  }
}

function fullDimensions(values = {}) {
  return {
    rigor: { score: values.rigor ?? 80 },
    computation: { score: values.computation ?? 90 },
    modeling: { score: values.modeling ?? 70 },
    methodUse: { score: values.methodUse ?? 75 },
    speed: { score: values.speed ?? 85 },
    strategyInsight: { score: values.strategyInsight ?? 65 },
  }
}

test('empty report keeps summary totals but does not invent rating or evidence', () => {
  const model = buildReportViewModel(
    report([], {
      summary: {
        totalCount: 4,
        correctCount: 0,
        accuracy: 0,
      },
      questionIds: [11, 12, 13, 14],
    }),
    {},
    null,
    pressureOrigin,
  )

  assert.equal(model.reportStatus, 'empty')
  assert.equal(model.totalCount, 4)
  assert.equal(model.gradedCount, 0)
  assert.deepEqual(model.counts, { correct: 0, partial: 0, wrong: 0, uncertain: 0 })
  assert.equal(model.accuracy, null)
  assert.equal(model.averageRatingScore, null)
  assert.equal(model.kastRate, null)
  assert.equal(model.examPrediction, null)
  assert.equal(model.hasFullDimensionEvidence, false)
  assert.match(model.verdictText, /没有可用的逐题证据/)
})

test('partial reports derive truthful counts and keep pressure omissions visible', () => {
  const grades = [
    grade(11, { rating: 1.2 }),
    grade(12, { correct: false, verdict: 'partial', rating: 1.0 }),
    grade(13, { correct: false, result: 'wrong', rating: 0.5 }),
    grade(14, { verdict: 'uncertain', rating: 0.8 }),
  ]
  const model = buildReportViewModel(
    report(grades, {
      status: 'graded_partial',
      questionIds: [11, 12, 13, 14, 15],
      ungradedQuestionIds: [15],
      summary: { totalCount: 5, correctCount: 99, accuracy: 0.99 },
    }),
    {},
    null,
    pressureOrigin,
  )

  assert.equal(model.reportStatus, 'partial')
  assert.deepEqual(model.counts, { correct: 1, partial: 1, wrong: 1, uncertain: 1 })
  assert.equal(model.accuracy, 25)
  assert.equal(model.totalCount, 5)
  assert.equal(model.gradedCount, 4)
  assert.deepEqual(model.ungradedIds, [15])
  assert.deepEqual(model.attentionEntries.map(({ index }) => index), [1, 2, 3])
  assert.equal(model.worstGradeEntry.grade.questionId, 13)
  assert.equal(model.priorityEntries.length, 3)
})

test('daily batch reports state that omission coverage is unknown', () => {
  const model = buildReportViewModel(
    report([grade(21, { correct: false, result: 'wrong' })], {
      sourceTaskId: 'SB-20260902-1',
      questionIds: [21],
      ungradedQuestionIds: [],
    }),
    {},
    null,
    batchOrigin,
  )

  assert.equal(model.coverageKnown, false)
  assert.deepEqual(model.ungradedIds, [])
})

test('mixed result filters include partial and uncertain in needs-attention', () => {
  const grades = [
    grade(1),
    grade(2, { correct: false, result: 'wrong' }),
    grade(3, { correct: false, verdict: 'partial' }),
    grade(4, { verdict: 'uncertain' }),
  ]

  assert.deepEqual(filterReportEntries(grades, 'needs-attention').map(({ index }) => index), [1, 2, 3])
  assert.deepEqual(filterReportEntries(grades, 'correct').map(({ index }) => index), [0])
  assert.deepEqual(filterReportEntries(grades, 'uncertain').map(({ index }) => index), [3])
  assert.deepEqual(filterReportEntries(grades, 'all').map(({ index }) => index), [0, 1, 2, 3])
})

test('missing dimensions never become zero and block KAST prediction', () => {
  const model = buildReportViewModel(
    report([grade(31, {
      rating: 1.1,
      dimensions: { rigor: { score: 80 }, computation: { score: null } },
    })]),
    {},
    null,
    pressureOrigin,
  )

  assert.equal(model.evidenceCoverage, 1)
  assert.equal(model.dimStats.find((dimension) => dimension.key === 'rigor').value, 80)
  assert.equal(model.dimStats.find((dimension) => dimension.key === 'computation').value, null)
  assert.equal(model.hasFullDimensionEvidence, false)
  assert.equal(model.kastRate, null)
  assert.equal(model.examPrediction, null)
})

test('complete six-dimension evidence produces KAST and the existing prediction', () => {
  const dimensions = fullDimensions()
  const model = buildReportViewModel(
    report([
      grade(41, { dimensions }),
      grade(42, { dimensions }),
    ]),
    {},
    null,
    pressureOrigin,
  )

  assert.equal(model.evidenceCoverage, 2)
  assert.equal(model.hasFullDimensionEvidence, true)
  assert.equal(model.kastRate, Math.round(0.5 * 80 + 0.3 * 90 + 0.2 * 70))
  assert.equal(model.examPrediction, predictedExamScore(model.averageRatingScore, model.kastRate))
  assert.ok(Number.isFinite(model.averageRatingScore))
})
