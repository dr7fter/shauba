import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCodexBatchQueueSnapshot,
  isCodexBatchRoundChanged,
  reconcileCodexBatchSnapshot,
  withCodexBatchAttemptId,
  withCodexBatchAttemptIdForRound,
  withCodexBatchDuration,
  areSameCodexBatchQuestionIds,
} from '../src/utils/codexBatchTask.ts'

const queue = (...ids) => ids.map((id) => ({ question: { id } }))

test('保留完整题组：当前 queue 缩小或变空时不丢失已提交题', () => {
  const initial = buildCodexBatchQueueSnapshot(queue(101, 102, 103), 101, 37)
  const afterSubmit = reconcileCodexBatchSnapshot(
    initial,
    buildCodexBatchQueueSnapshot(queue(102, 103)),
  )
  const completed = reconcileCodexBatchSnapshot(
    afterSubmit,
    buildCodexBatchQueueSnapshot(queue()),
  )

  assert.deepEqual(afterSubmit?.questionIds, [101, 102, 103])
  assert.deepEqual(completed?.questionIds, [101, 102, 103])
  assert.equal(completed?.durations?.[101], 37)
})

test('出现新题 ID 时重置，不把上轮题混入新题组', () => {
  const initial = buildCodexBatchQueueSnapshot(queue(101, 102, 103))
  const next = reconcileCodexBatchSnapshot(
    initial,
    buildCodexBatchQueueSnapshot(queue(201, 202)),
  )

  assert.deepEqual(next?.questionIds, [201, 202])
  assert.equal(next?.questionIds.includes(101), false)
})

test('题组构建按队列顺序去重，并保留当前题耗时', () => {
  const snapshot = buildCodexBatchQueueSnapshot(queue(7, 7, 8), 8, 1901)

  assert.deepEqual(snapshot.questionIds, [7, 8])
  assert.equal(snapshot.duplicateCount, 1)
  assert.equal(snapshot.durations?.[8], 1800)
})

test('记录已完成题耗时，并可覆盖当前题的实时耗时', () => {
  const snapshot = buildCodexBatchQueueSnapshot(queue(9, 10))
  const withFirstDuration = withCodexBatchDuration(snapshot, 9, 42.4)
  const withUpdatedDuration = withCodexBatchDuration(withFirstDuration, 9, 1901)
  const ignored = withCodexBatchDuration(withUpdatedDuration, 99, 12)

  assert.equal(withFirstDuration.durations?.[9], 42)
  assert.equal(withUpdatedDuration.durations?.[9], 1800)
  assert.deepEqual(ignored, withUpdatedDuration)
})

test('轮次身份变化时即使题号相同也重置快照', () => {
  const first = buildCodexBatchQueueSnapshot(queue(301, 302), undefined, undefined, 'recommendation:A')
  const reordered = buildCodexBatchQueueSnapshot(queue(302, 301), undefined, undefined, 'recommendation:B')
  const next = reconcileCodexBatchSnapshot(first, reordered)

  assert.deepEqual(next?.questionIds, [302, 301])
  assert.equal(next?.roundKey, 'recommendation:B')
  assert.equal(areSameCodexBatchQuestionIds(next?.questionIds ?? [], [302, 301]), true)
  assert.equal(isCodexBatchRoundChanged(first, reordered), true)
})

test('同一轮次内跳题重排仍保留完整题组，避免丢失已完成题', () => {
  const initial = buildCodexBatchQueueSnapshot(
    queue(401, 402, 403),
    undefined,
    undefined,
    'recommendation:same',
  )
  const afterSubmitAndSkip = reconcileCodexBatchSnapshot(
    initial,
    buildCodexBatchQueueSnapshot(
      queue(403, 402),
      undefined,
      undefined,
      'recommendation:same',
    ),
  )

  assert.deepEqual(afterSubmitAndSkip?.questionIds, [401, 402, 403])
})


test('同一题号集合但轮次标识变化时仍判定为新轮次', () => {
  const previous = buildCodexBatchQueueSnapshot(queue(501, 502), undefined, undefined, 'round:1')
  const current = buildCodexBatchQueueSnapshot(queue(502, 501), undefined, undefined, 'round:2')

  assert.equal(isCodexBatchRoundChanged(previous, current), true)
})


test('整组快照只保存真实 attemptId，未作答题保持缺失', () => {
  const snapshot = buildCodexBatchQueueSnapshot(queue(601, 602), undefined, undefined, 'round:attempts')
  const bound = withCodexBatchAttemptId(snapshot, 601, 9001)

  assert.deepEqual(bound.attemptIds, { 601: 9001 })
  assert.equal(bound.attemptIds?.[602], undefined)
  assert.equal(withCodexBatchAttemptId(bound, 999, 9), bound)
  assert.equal(withCodexBatchAttemptId(bound, 601, 0), bound)
})

test('旧异步作答返回不能写入新轮次，即使题号完全相同', () => {
  const oldRound = withCodexBatchAttemptId(
    buildCodexBatchQueueSnapshot(queue(701, 702), undefined, undefined, 'round:old'),
    701,
    7001,
  )
  const newRound = reconcileCodexBatchSnapshot(
    oldRound,
    buildCodexBatchQueueSnapshot(queue(701, 702), undefined, undefined, 'round:new'),
  )
  const afterLateOldResponse = withCodexBatchAttemptIdForRound(
    newRound,
    'round:old',
    701,
    7999,
  )

  assert.equal(newRound?.attemptIds, undefined)
  assert.equal(afterLateOldResponse?.attemptIds, undefined)
  assert.equal(isCodexBatchRoundChanged(oldRound, newRound), true)
})

test('相同 questionId 的新轮次可绑定自己的新 attemptId，不继承旧映射', () => {
  const oldRound = withCodexBatchAttemptId(
    buildCodexBatchQueueSnapshot(queue(801), undefined, undefined, 'round:one'),
    801,
    8101,
  )
  const newRound = reconcileCodexBatchSnapshot(
    oldRound,
    buildCodexBatchQueueSnapshot(queue(801), undefined, undefined, 'round:two'),
  )
  const rebound = withCodexBatchAttemptIdForRound(newRound, 'round:two', 801, 8201)

  assert.deepEqual(oldRound.attemptIds, { 801: 8101 })
  assert.equal(newRound?.attemptIds, undefined)
  assert.deepEqual(rebound?.attemptIds, { 801: 8201 })
})
