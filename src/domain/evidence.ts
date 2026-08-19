import type { AttemptOutcome, EvidenceSource, RecommendedQuestion } from '../types'

export function determineAttemptEvidence(input: {
  questionType: string
  selectedOutcome: AttemptOutcome | null
  selectedAnswerMatches: boolean | null
}): { outcome: AttemptOutcome; evidenceSource: EvidenceSource } {
  const { questionType, selectedOutcome, selectedAnswerMatches } = input
  if (questionType !== 'subjective') {
    if (selectedOutcome) {
      return { outcome: selectedOutcome, evidenceSource: 'manual_confirmed' }
    }
    if (selectedAnswerMatches !== null) {
      return {
        outcome: selectedAnswerMatches ? 'correct' : 'wrong',
        evidenceSource: 'digital_answer',
      }
    }
  }
  return {
    outcome: selectedOutcome ?? 'uncertain',
    evidenceSource: selectedOutcome ? 'manual_confirmed' : 'self_report',
  }
}

export function clampAttemptDuration(seconds: number): number {
  return Math.min(1800, Math.max(1, Math.round(seconds)))
}

export function createPracticeSessionPayload(
  queue: RecommendedQuestion[],
  currentIndex: number,
  attemptMode: 'paper' | 'review',
) {
  return {
    questionIds: queue.map((item) => item.question.id),
    reasons: queue.map((item) => item.reason),
    reasonCodes: queue.map((item) => item.reasonCode),
    scores: queue.map((item) => item.score),
    currentIndex: Math.min(Math.max(0, currentIndex), Math.max(0, queue.length - 1)),
    attemptMode,
  }
}
