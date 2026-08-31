import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clampAttemptDuration,
  createPracticeSessionPayload,
  determineAttemptEvidence,
} from '../src/domain/evidence.ts'
import { compareSemver, computeHltvRating, deriveGradeCsRating, predictedExamScore } from '../src/utils.ts'

test('paper objective without a screen selection is not inferred as wrong', () => {
  assert.deepEqual(
    determineAttemptEvidence({
      questionType: 'single_choice',
      selectedOutcome: null,
      selectedAnswerMatches: null,
    }),
    { outcome: 'uncertain', evidenceSource: 'self_report' },
  )
})

test('manual outcome overrides the digital answer suggestion', () => {
  assert.deepEqual(
    determineAttemptEvidence({
      questionType: 'single_choice',
      selectedOutcome: 'partial',
      selectedAnswerMatches: false,
    }),
    { outcome: 'partial', evidenceSource: 'manual_confirmed' },
  )
})

test('subjective fluency never determines correctness', () => {
  assert.deepEqual(
    determineAttemptEvidence({
      questionType: 'subjective',
      selectedOutcome: null,
      selectedAnswerMatches: null,
    }),
    { outcome: 'uncertain', evidenceSource: 'self_report' },
  )
})

test('attempt duration is clamped to the persisted 1..1800 second boundary', () => {
  assert.equal(clampAttemptDuration(0), 1)
  assert.equal(clampAttemptDuration(42.6), 43)
  assert.equal(clampAttemptDuration(3600), 1800)
})

test('session persistence stores IDs and position instead of question snapshots', () => {
  const queue = [
    { question: { id: 155, stem: 'old snapshot' }, score: 10, reason: '到期', reasonCode: 'due' },
    { question: { id: 160, stem: 'old snapshot' }, score: 8, reason: '薄弱', reasonCode: 'weakness' },
  ]
  const payload = createPracticeSessionPayload(queue, 1, 'review')
  assert.deepEqual(payload.questionIds, [155, 160])
  assert.equal(payload.currentIndex, 1)
  assert.equal(payload.attemptMode, 'review')
  assert.equal('queue' in payload, false)
})

test('semver comparison correctly determines upgrade availability', () => {
  assert.equal(compareSemver('1.3.0', '1.3.1'), true)
  assert.equal(compareSemver('1.3.0', '1.4.0'), true)
  assert.equal(compareSemver('1.3.0', '2.0.0'), true)
  assert.equal(compareSemver('v1.3.0', 'v1.3.1'), true)
  assert.equal(compareSemver('1.3.0', '1.3.0'), false)
  assert.equal(compareSemver('1.4.0', '1.3.0'), false)
  assert.equal(compareSemver('1.3.1', '1.3.0'), false)
})

test('predicted exam score maps realistically from rating and kast', () => {
  assert.equal(predictedExamScore(1.0, 75), 90)
  assert.equal(predictedExamScore(1.25, 85), 121)
  assert.equal(predictedExamScore(1.5, 95), 147)
})

test('deriveGradeCsRating trusts explicit rating if provided', () => {
  assert.equal(deriveGradeCsRating({ rating: 1.45, outcome: 'correct' }), 1.45)
  assert.equal(deriveGradeCsRating({ rating: 0.65, outcome: 'wrong' }), 0.65)
})

test('deriveGradeCsRating computes HLTV 3.0 from dimensions matching backend', () => {
  const rating = computeHltvRating({
    outcome: 'correct',
    dimensions: {
      rigor: { score: 80 },
      computation: { score: 85 },
      modeling: { score: 80 },
      methodUse: { score: 85 },
      speed: { score: 90 },
      strategyInsight: { score: 85, techniqueLevel: 4 },
    },
    durationSeconds: 120,
    benchmarkSeconds: 180,
    difficultyMultiplier: 1.05,
  })
  assert.ok(rating > 1.2 && rating <= 2.5, `Rating ${rating} should be in high tier`)
})


