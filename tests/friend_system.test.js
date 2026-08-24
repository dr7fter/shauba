import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculatePresenceState,
  createFriendInvitation,
  dedupeIdentitiesConnected,
  importFriendInvitation,
  normalizeFriendCode,
  sanitizeGradingReportToPublic,
} from '../src/data/friendPublicData.ts'

test('friend code normalization correctly standardizes codes', () => {
  assert.equal(normalizeFriendCode(' sb-9527 '), 'SB-9527')
  assert.equal(normalizeFriendCode('dr7fter'), 'DR7FTER')
  assert.equal(normalizeFriendCode('A'), null) // too short
  assert.equal(normalizeFriendCode('invalid code with spaces!'), null)
})

test('presence state accurately calculates from heartbeat intervals', () => {
  const nowIso = new Date().toISOString()
  const pOnline = calculatePresenceState({ state: 'online', heartbeatAt: nowIso, expiresAt: nowIso }, nowIso)
  assert.equal(pOnline.state, 'online')
  assert.equal(pOnline.heartbeatText, '刚刚活跃')

  const twoMinAgo = new Date(Date.now() - 120 * 1000).toISOString()
  const pIdle = calculatePresenceState({ state: 'online', heartbeatAt: twoMinAgo, expiresAt: twoMinAgo }, twoMinAgo)
  assert.equal(pIdle.state, 'idle')
  assert.equal(pIdle.heartbeatText, '2 分钟前心跳')

  const tenMinAgo = new Date(Date.now() - 600 * 1000).toISOString()
  const pOffline = calculatePresenceState({ state: 'online', heartbeatAt: tenMinAgo, expiresAt: tenMinAgo }, tenMinAgo)
  assert.equal(pOffline.state, 'offline')
  assert.equal(pOffline.heartbeatText, '10 分钟前心跳')

  const eightDaysAgo = new Date(Date.now() - 8 * 86400 * 1000).toISOString()
  const pStale = calculatePresenceState({ state: 'online', heartbeatAt: eightDaysAgo, expiresAt: eightDaysAgo }, eightDaysAgo)
  assert.equal(pStale.state, 'offline')
  assert.equal(pStale.text, '数据已过期 (7天前)')
})

test('connected component deduplication merges aliased identities and keeps best profile', () => {
  const list = [
    { friendCode: 'SB-OLD', profileId: 'pid-123', lastSyncedAt: '2026-08-20T10:00:00Z', lastSnapshotExportedAt: '2026-08-20T09:00:00Z' },
    { friendCode: 'SB-NEW', profileId: 'pid-123', lastSyncedAt: '2026-08-24T12:00:00Z', lastSnapshotExportedAt: '2026-08-24T11:00:00Z' },
    { friendCode: 'SB-OTHER', profileId: 'pid-999', lastSyncedAt: '2026-08-24T10:00:00Z', lastSnapshotExportedAt: '2026-08-24T09:00:00Z' },
  ]

  const deduped = dedupeIdentitiesConnected(list)
  assert.equal(deduped.length, 2)
  const merged = deduped.find((x) => x.profileId === 'pid-123')
  assert.ok(merged)
  assert.equal(merged.friendCode, 'SB-NEW')
})

test('sanitizeGradingReportToPublic removes private data and structures public diagnosis', () => {
  const dummyReport = {
    summary: {
      overallSummary: '整组掌握较好，部分计算有笔误',
      averageRating: 1.22,
      totalDuration: 480,
      tacticalAdvice: '加强 King 变换对称性练习',
    },
    grades: [
      {
        questionId: 101,
        verdict: 'correct',
        earliestError: null,
        errorTags: [],
        weaknessTags: ['King变换'],
        advice: '保持熟练度',
        betterSolution: null,
      },
      {
        questionId: 102,
        verdict: 'incorrect',
        earliestError: '第 3 行通分符号看错：$\\frac{1}{x-1}$ 应为 $-\\frac{1}{x-1}$',
        errorTags: ['瞄准失误'],
        weaknessTags: ['有理分式积分'],
        advice: '核对负号',
        betterSolution: '利用待定系数秒杀',
      },
    ],
  }

  const pub = sanitizeGradingReportToPublic(dummyReport, 'm-12345')
  assert.equal(pub.publicMatchId, 'm-12345')
  assert.equal(pub.accuracy, 50)
  assert.equal(pub.rating, 1.22)
  assert.equal(pub.durationSeconds, 480)
  assert.equal(pub.questionSummaries.length, 2)
  assert.equal(pub.questionSummaries[0].result, 'correct')
  assert.equal(pub.questionSummaries[1].result, 'incorrect')
  assert.equal(pub.questionSummaries[1].earliestError, '第 3 行通分符号看错：$\\frac{1}{x-1}$ 应为 $-\\frac{1}{x-1}$')
  assert.ok(pub.weaknesses.includes('有理分式积分'))
})

test('friend invitation generates and imports cleanly', () => {
  const config = {
    endpoint: 'https://dav.jianguoyun.com/dav/',
    username: 'user@example.com',
    appPassword: 'secretpassword',
    folder: 'shuaba-test-folder',
  }

  const invitationJson = createFriendInvitation(config)
  assert.ok(invitationJson.includes('shuaba-friend-invitation'))
  assert.ok(!invitationJson.includes('secretpassword')) // password MUST NOT be exported in invitation

  const parsed = importFriendInvitation(invitationJson)
  assert.equal(parsed.success, true)
  assert.equal(parsed.config?.folder, 'shuaba-test-folder')
  assert.equal(parsed.config?.endpoint, 'https://dav.jianguoyun.com/dav/')
})
