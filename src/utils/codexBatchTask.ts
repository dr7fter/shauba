import type { RecommendedQuestion } from '../types'

export type CodexBatchQueueSnapshot = {
  questionIds: number[]
  durations?: Record<number, number>
  /** Immutable local attempt rows created during this exact non-pressure round. */
  attemptIds?: Record<number, number>
  duplicateCount: number
  roundKey?: string
}

/**
 * Build the ordered, validated request sent to the existing batch-task API.
 * The backend remains the source of truth for question existence and prompt creation.
 */
export function buildCodexBatchQueueSnapshot(
  queue: RecommendedQuestion[],
  activeQuestionId?: number,
  activeDurationSeconds?: number,
  roundKey?: string,
): CodexBatchQueueSnapshot {
  const seen = new Set<number>()
  const questionIds: number[] = []
  let duplicateCount = 0

  for (const item of queue) {
    const questionId = item.question.id
    if (!Number.isInteger(questionId) || questionId <= 0) continue
    if (seen.has(questionId)) {
      duplicateCount += 1
      continue
    }
    seen.add(questionId)
    questionIds.push(questionId)
  }

  const durations: Record<number, number> = {}
  if (
    activeQuestionId !== undefined &&
    seen.has(activeQuestionId) &&
    Number.isFinite(activeDurationSeconds) &&
    (activeDurationSeconds ?? 0) > 0
  ) {
    durations[activeQuestionId] = Math.min(
      1800,
      Math.max(1, Math.round(activeDurationSeconds ?? 0)),
    )
  }

  return {
    questionIds,
    durations: Object.keys(durations).length > 0 ? durations : undefined,
    duplicateCount,
    roundKey,
  }
}

export function reconcileCodexBatchSnapshot(
  previous: CodexBatchQueueSnapshot | null,
  current: CodexBatchQueueSnapshot,
): CodexBatchQueueSnapshot | null {
  // Empty queue means the current round has just been completed. Keep the full snapshot.
  if (current.questionIds.length === 0) return previous

  // A source/mode/generation identity change is a new round even when question IDs repeat.
  if (previous?.roundKey && current.roundKey && previous.roundKey !== current.roundKey) {
    return current
  }

  // First non-empty queue becomes the current round's complete snapshot.
  if (!previous || previous.questionIds.length === 0) return current

  const previousSet = new Set(previous.questionIds)
  const containsNewQuestion = current.questionIds.some(
    (questionId) => !previousSet.has(questionId),
  )

  // Any new ID means the parent loaded a different round. Never merge rounds.
  if (containsNewQuestion) return current

  // Submitting, skipping, undoing or favoriting can shrink/reorder the live queue.
  // Keep the original complete round; explicit new rounds change roundKey/generation.
  return previous
}

/**
 * Decide whether a non-pressure queue should be treated as a new batch.
 * A same-round skip/reorder is intentionally not a new batch; callers can
 * provide a new roundKey when the parent loads another round with the same IDs.
 */
export function isCodexBatchRoundChanged(
  previous: CodexBatchQueueSnapshot | null,
  current: CodexBatchQueueSnapshot,
): boolean {
  if (!previous || current.questionIds.length === 0) return false
  if (previous.roundKey !== current.roundKey) return true

  return current.questionIds.some(
    (questionId) => !previous.questionIds.includes(questionId),
  )
}

export function withCodexBatchDuration(
  snapshot: CodexBatchQueueSnapshot,
  questionId: number,
  durationSeconds: number,
): CodexBatchQueueSnapshot {
  if (!snapshot.questionIds.includes(questionId) || !Number.isFinite(durationSeconds)) {
    return snapshot
  }

  const duration = Math.min(1800, Math.max(1, Math.round(durationSeconds)))
  return {
    ...snapshot,
    durations: {
      ...(snapshot.durations ?? {}),
      [questionId]: duration,
    },
  }
}

/**
 * Store a real local attempt id for a question in this exact snapshot.  The helper
 * deliberately does not infer ids from question numbers or timestamps.
 */
export function withCodexBatchAttemptId(
  snapshot: CodexBatchQueueSnapshot,
  questionId: number,
  attemptId: number,
): CodexBatchQueueSnapshot {
  if (
    !snapshot.questionIds.includes(questionId) ||
    !Number.isInteger(attemptId) ||
    attemptId <= 0
  ) {
    return snapshot
  }

  return {
    ...snapshot,
    attemptIds: {
      ...(snapshot.attemptIds ?? {}),
      [questionId]: attemptId,
    },
  }
}

/** Remove only the binding whose local attempt was explicitly undone; keep the round. */
export function withoutCodexBatchAttemptId(
  snapshot: CodexBatchQueueSnapshot,
  questionId: number,
): CodexBatchQueueSnapshot {
  if (!snapshot.attemptIds || !(questionId in snapshot.attemptIds)) return snapshot

  const { [questionId]: _removed, ...attemptIds } = snapshot.attemptIds
  return {
    ...snapshot,
    attemptIds: Object.keys(attemptIds).length > 0 ? attemptIds : undefined,
  }
}

/**
 * Apply an asynchronous record-attempt result only if it still belongs to the
 * same immutable round. This prevents a late response from an old round from
 * contaminating a newly loaded queue that happens to reuse the same question id.
 */
export function withCodexBatchAttemptIdForRound(
  snapshot: CodexBatchQueueSnapshot | null,
  expectedRoundKey: string | undefined,
  questionId: number,
  attemptId: number,
): CodexBatchQueueSnapshot | null {
  if (!snapshot || snapshot.roundKey !== expectedRoundKey) return snapshot
  return withCodexBatchAttemptId(snapshot, questionId, attemptId)
}

export function areSameCodexBatchQuestionIds(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((questionId, index) => questionId === right[index])
}

export function formatCodexBatchCount(questionCount: number): string {
  return questionCount === 1 ? '1 题（单题整组格式）' : `${questionCount} 题`
}
