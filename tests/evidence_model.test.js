import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clampAttemptDuration,
  createPracticeSessionPayload,
  determineAttemptEvidence,
} from '../src/domain/evidence.ts'

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
