import type {
  BlockedFriendIdentity,
  FriendDimensions,
  FriendInvitationPayload,
  FriendPresence,
  FriendPresenceState,
  FriendPublicMatch,
  FriendPublicReport,
  FriendPublicReportQuestion,
  FriendSyncConfig,
  GradingReport,
} from '../types'

export const STORAGE_KEY_BLOCKED_IDENTITIES = 'shuaba_friend_blocked_identities_v1'
export const STORAGE_KEY_MY_MATCHES = 'shuaba_my_public_matches_v1'
export const STORAGE_KEY_MY_REPORTS = 'shuaba_my_public_reports_v1'
export const STORAGE_KEY_FRIEND_REPORTS_CACHE = 'shuaba_friend_public_reports_cache_v1'
export const STORAGE_KEY_FRIEND_MATCHES_CACHE = 'shuaba_friend_public_matches_cache_v1'

export function normalizeFriendCode(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const code = input.trim().toUpperCase()
  return /^[A-Z0-9_-]{2,64}$/.test(code) ? code : null
}

const MAX_MATCHES = 10
const MAX_REPORTS = 10

function readStorage(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch {
    // ignore
  }
}

function parseJson<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function getBlockedIdentities(): BlockedFriendIdentity[] {
  const raw = readStorage(STORAGE_KEY_BLOCKED_IDENTITIES)
  const parsed = parseJson<unknown>(raw)
  if (!Array.isArray(parsed)) return []
  const result: BlockedFriendIdentity[] = []
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const profileId = typeof record.profileId === 'string' ? record.profileId.trim() : undefined
    const friendCodes = Array.isArray(record.friendCodes)
      ? record.friendCodes.filter((c): c is string => typeof c === 'string').map((c) => c.trim().toUpperCase())
      : []
    const blockedAt = typeof record.blockedAt === 'string' ? record.blockedAt : new Date().toISOString()
    const reason = typeof record.reason === 'string' ? record.reason : undefined
    result.push({ profileId, friendCodes, blockedAt, reason })
  }
  return result
}

export function saveBlockedIdentities(list: BlockedFriendIdentity[]): void {
  writeStorage(STORAGE_KEY_BLOCKED_IDENTITIES, list)
}

export function isIdentityBlocked(code: string, profileId?: string): boolean {
  const cleanCode = code.trim().toUpperCase()
  const cleanProfileId = profileId?.trim()
  const blocked = getBlockedIdentities()
  for (const item of blocked) {
    if (cleanProfileId && item.profileId === cleanProfileId) return true
    if (item.friendCodes.some((c) => c === cleanCode)) return true
  }
  return false
}

export function addBlockedIdentity(profileId: string | undefined, friendCodes: string[], reason?: string): void {
  const cleanCodes = friendCodes.map((c) => c.trim().toUpperCase()).filter((c) => c.length > 0)
  const cleanProfileId = profileId?.trim()
  const current = getBlockedIdentities()
  const existsIndex = current.findIndex((item) => (cleanProfileId && item.profileId === cleanProfileId) || item.friendCodes.some((c) => cleanCodes.includes(c)))

  const entry: BlockedFriendIdentity = {
    profileId: cleanProfileId,
    friendCodes: existsIndex >= 0 ? Array.from(new Set([...current[existsIndex].friendCodes, ...cleanCodes])) : cleanCodes,
    blockedAt: new Date().toISOString(),
    reason: reason || '用户手动删除并屏蔽',
  }

  if (existsIndex >= 0) {
    current[existsIndex] = entry
  } else {
    current.push(entry)
  }
  saveBlockedIdentities(current)
}

export function unblockIdentity(codeOrId: string, profileId?: string): void {
  const clean = codeOrId.trim().toUpperCase()
  const cleanPid = profileId?.trim().toUpperCase()
  const current = getBlockedIdentities()
  const filtered = current.filter((item) => {
    if (cleanPid && item.profileId && item.profileId.toUpperCase() === cleanPid) return false
    if (item.profileId && item.profileId.toUpperCase() === clean) return false
    if (item.friendCodes.some((c) => c.toUpperCase() === clean)) return false
    if (cleanPid && item.friendCodes.some((c) => c.toUpperCase() === cleanPid)) return false
    return true
  })
  saveBlockedIdentities(filtered)
}

export function clearAllBlockedIdentities(): void {
  saveBlockedIdentities([])
}

// ============ 本机公开比赛与公开报告 ============

export function getMyPublicMatches(): FriendPublicMatch[] {
  const raw = readStorage(STORAGE_KEY_MY_MATCHES)
  const parsed = parseJson<unknown>(raw)
  if (!Array.isArray(parsed)) return []
  return parsed.slice(0, MAX_MATCHES) as FriendPublicMatch[]
}

export function saveMyPublicMatches(matches: FriendPublicMatch[]): void {
  writeStorage(STORAGE_KEY_MY_MATCHES, matches.slice(0, MAX_MATCHES))
}

export function getMyPublicReports(): FriendPublicReport[] {
  const raw = readStorage(STORAGE_KEY_MY_REPORTS)
  const parsed = parseJson<unknown>(raw)
  if (!Array.isArray(parsed)) return []
  return parsed.slice(0, MAX_REPORTS) as FriendPublicReport[]
}

export function saveMyPublicReports(reports: FriendPublicReport[]): void {
  writeStorage(STORAGE_KEY_MY_REPORTS, reports.slice(0, MAX_REPORTS))
}

export function recordMyPublicMatch(match: FriendPublicMatch, report?: FriendPublicReport): void {
  const existingMatches = getMyPublicMatches()
  const dedupedMatches = [match, ...existingMatches.filter((m) => m.publicMatchId !== match.publicMatchId)].slice(0, MAX_MATCHES)
  saveMyPublicMatches(dedupedMatches)

  if (report) {
    const existingReports = getMyPublicReports()
    const dedupedReports = [report, ...existingReports.filter((r) => r.reportId !== report.reportId)].slice(0, MAX_REPORTS)
    saveMyPublicReports(dedupedReports)
  }
}

// ============ 好友报告与比赛缓存 ============

export function getFriendCachedMatches(primaryKey: string, secondaryKey?: string): FriendPublicMatch[] {
  const raw = readStorage(STORAGE_KEY_FRIEND_MATCHES_CACHE)
  const parsed = parseJson<Record<string, FriendPublicMatch[]>>(raw)
  if (!parsed) return []
  if (parsed[primaryKey]?.length) return parsed[primaryKey]
  if (secondaryKey && parsed[secondaryKey]?.length) return parsed[secondaryKey]
  return []
}

export function saveFriendCachedMatches(primaryKey: string, matches: FriendPublicMatch[], secondaryKey?: string): void {
  const raw = readStorage(STORAGE_KEY_FRIEND_MATCHES_CACHE)
  const map = parseJson<Record<string, FriendPublicMatch[]>>(raw) || {}
  const sliced = matches.slice(0, MAX_MATCHES)
  map[primaryKey] = sliced
  if (secondaryKey && secondaryKey !== primaryKey) {
    map[secondaryKey] = sliced
  }
  writeStorage(STORAGE_KEY_FRIEND_MATCHES_CACHE, map)
}

export function getFriendCachedReports(primaryKey: string, secondaryKey?: string): FriendPublicReport[] {
  const raw = readStorage(STORAGE_KEY_FRIEND_REPORTS_CACHE)
  const parsed = parseJson<Record<string, FriendPublicReport[]>>(raw)
  if (!parsed) return []
  if (parsed[primaryKey]?.length) return parsed[primaryKey]
  if (secondaryKey && parsed[secondaryKey]?.length) return parsed[secondaryKey]
  return []
}

export function saveFriendCachedReports(primaryKey: string, reports: FriendPublicReport[], secondaryKey?: string): void {
  const raw = readStorage(STORAGE_KEY_FRIEND_REPORTS_CACHE)
  const map = parseJson<Record<string, FriendPublicReport[]>>(raw) || {}
  const sliced = reports.slice(0, MAX_REPORTS)
  map[primaryKey] = sliced
  if (secondaryKey && secondaryKey !== primaryKey) {
    map[secondaryKey] = sliced
  }
  writeStorage(STORAGE_KEY_FRIEND_REPORTS_CACHE, map)
}

export function getPublicReportById(primaryKey: string, reportId: string, secondaryKey?: string): FriendPublicReport | null {
  const myReports = getMyPublicReports()
  const myMatch = myReports.find((r) => r.reportId === reportId)
  if (myMatch) return myMatch
  const cached = getFriendCachedReports(primaryKey, secondaryKey)
  return cached.find((r) => r.reportId === reportId) || null
}

// ============ 报告脱敏转换 (Sanitize) ============

/** 将本机 GradingReport 严格脱敏为 FriendPublicReport，不带草稿、题库答案或私有路径 */
export function sanitizeGradingReportToPublic(
  report: GradingReport,
  publicMatchId: string,
  dimensions?: FriendDimensions,
): FriendPublicReport {
  const questionSummaries: FriendPublicReportQuestion[] = (report.grades || []).map((grade, idx) => ({
    index: idx + 1,
    result: grade.verdict === 'correct' ? 'correct' : grade.verdict === 'partial' ? 'partial' : grade.verdict === 'uncertain' ? 'uncertain' : 'incorrect',
    earliestError: grade.earliestError || null,
    errorTags: grade.errorTags || [],
    weaknessTags: grade.weaknessTags || [],
    advice: grade.advice || null,
    betterSolution: grade.betterSolution || null,
  }))

  const allStrengths = new Set<string>()
  const allWeaknesses = new Set<string>()
  const allErrorTags = new Set<string>()
  const allWeaknessTags = new Set<string>()

  for (const g of report.grades || []) {
    if (g.verdict === 'correct' && g.weaknessTags) {
      g.weaknessTags.forEach((t) => allStrengths.add(t))
    }
    if (g.verdict !== 'correct' && g.weaknessTags) {
      g.weaknessTags.forEach((t) => allWeaknesses.add(t))
    }
    if (g.errorTags) g.errorTags.forEach((t) => allErrorTags.add(t))
    if (g.weaknessTags) g.weaknessTags.forEach((t) => allWeaknessTags.add(t))
  }

  const correctCount = (report.grades || []).filter((g) => g.verdict === 'correct').length
  const totalCount = Math.max(1, (report.grades || []).length)
  const accuracy = report.summary?.accuracy ?? Math.round((correctCount / totalCount) * 100)
  const explicitAvgRating = (report as unknown as { summary?: { averageRating?: number } })?.summary?.averageRating
  const avgRating = typeof explicitAvgRating === 'number' && Number.isFinite(explicitAvgRating)
    ? explicitAvgRating
    : (report.grades || []).reduce((sum, g) => sum + (g.rating ?? 1.0), 0) / totalCount

  const overallSummary = (report as unknown as { summary?: { overallSummary?: string } })?.summary?.overallSummary
    || report.summary?.suggestions?.join('；')
    || '完成了一组高压演练，状态良好。'

  const tacticalAdvice = (report as unknown as { summary?: { tacticalAdvice?: string } })?.summary?.tacticalAdvice
    || (report.summary?.suggestions && report.summary.suggestions[0])
    || null

  return {
    reportId: `rep-${publicMatchId}`,
    publicMatchId,
    createdAt: new Date().toISOString(),
    summary: overallSummary,
    rating: Number.isFinite(avgRating) ? Number(avgRating.toFixed(2)) : 1.15,
    accuracy,
    durationSeconds: report.summary?.totalDuration || 600,
    dimensions,
    strengths: Array.from(allStrengths).slice(0, 6),
    weaknesses: Array.from(allWeaknesses).slice(0, 6),
    errorTags: Array.from(allErrorTags).slice(0, 8),
    weaknessTags: Array.from(allWeaknessTags).slice(0, 8),
    advice: tacticalAdvice,
    betterSolution: null,
    questionSummaries,
  }
}

// ============ 近实时 Presence 状态计算 ============

export function getMyPresence(currentMatchId?: string | null, activityDesc?: string | null): FriendPresence {
  const now = new Date()
  const heartbeatAt = now.toISOString()
  const expiresAt = new Date(now.getTime() + 180 * 1000).toISOString()
  return {
    state: currentMatchId ? 'in_match' : 'online',
    currentActivity: activityDesc || (currentMatchId ? '正在进行战术高压冲刺' : '在线：正在研读战术数据大屏'),
    currentMatchId: currentMatchId || null,
    heartbeatAt,
    expiresAt,
  }
}

export function calculatePresenceState(
  presence?: FriendPresence,
  lastSyncedAt?: string,
  lastActiveAt?: string,
): { state: FriendPresenceState; text: string; heartbeatText: string } {
  if (!presence && !lastSyncedAt && !lastActiveAt) {
    return { state: 'unknown', text: '状态未知', heartbeatText: '暂无同步记录' }
  }

  const nowMs = Date.now()
  const heartbeatIso = presence?.heartbeatAt || lastActiveAt || lastSyncedAt
  if (!heartbeatIso) {
    return { state: 'unknown', text: '状态未知', heartbeatText: '暂无心跳' }
  }

  const heartbeatMs = Date.parse(heartbeatIso)
  if (Number.isNaN(heartbeatMs)) {
    return { state: 'unknown', text: '状态未知', heartbeatText: '时间格式无效' }
  }

  const diffSec = Math.max(0, Math.floor((nowMs - heartbeatMs) / 1000))
  const diffDays = Math.floor(diffSec / 86400)

  let heartbeatText = ''
  if (diffSec < 60) {
    heartbeatText = '刚刚活跃'
  } else if (diffSec < 3600) {
    heartbeatText = `${Math.floor(diffSec / 60)} 分钟前心跳`
  } else if (diffSec < 86400) {
    heartbeatText = `${Math.floor(diffSec / 3600)} 小时前活跃`
  } else {
    heartbeatText = `${diffDays} 天前活跃`
  }

  if (diffDays >= 7) {
    return { state: 'offline', text: '数据已过期 (7天前)', heartbeatText }
  }

  if (diffSec <= 90) {
    if (presence?.currentMatchId || presence?.state === 'in_match') {
      return { state: 'in_match', text: presence.currentActivity || '正在刷题', heartbeatText }
    }
    return { state: 'online', text: presence?.currentActivity || '在线', heartbeatText }
  }

  if (diffSec <= 300) {
    return { state: 'idle', text: '刚刚活跃 / 离开', heartbeatText }
  }

  return { state: 'offline', text: '离线', heartbeatText }
}

// ============ 传递连通分量身份去重 (Identity Connected Component) ============

export function dedupeIdentitiesConnected<T extends { friendCode: string; profileId?: string; lastSyncedAt?: string; lastSnapshotExportedAt?: string }>(
  items: T[],
): T[] {
  if (items.length <= 1) return items

  // 并查集构建连通分量
  const parent = new Map<number, number>()
  function find(i: number): number {
    if (!parent.has(i)) parent.set(i, i)
    if (parent.get(i) === i) return i
    const root = find(parent.get(i)!)
    parent.set(i, root)
    return root
  }
  function union(i: number, j: number) {
    const rootI = find(i)
    const rootJ = find(j)
    if (rootI !== rootJ) parent.set(rootI, rootJ)
  }

  // 按照 code 和 profileId 关联
  const codeMap = new Map<string, number>()
  const profileIdMap = new Map<string, number>()

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    const code = item.friendCode.trim().toUpperCase()
    if (codeMap.has(code)) {
      union(i, codeMap.get(code)!)
    } else {
      codeMap.set(code, i)
    }

    if (item.profileId && !item.profileId.startsWith('legacy-')) {
      const pid = item.profileId.trim()
      if (profileIdMap.has(pid)) {
        union(i, profileIdMap.get(pid)!)
      } else {
        profileIdMap.set(pid, i)
      }
    }
  }

  // 聚类
  const groups = new Map<number, T[]>()
  for (let i = 0; i < items.length; i += 1) {
    const root = find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(items[i])
  }

  // 每个聚类内选出最优代表
  const result: T[] = []
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0])
      continue
    }

    group.sort((a, b) => {
      const aReal = a.profileId && !a.profileId.startsWith('legacy-') ? 1 : 0
      const bReal = b.profileId && !b.profileId.startsWith('legacy-') ? 1 : 0
      if (aReal !== bReal) return bReal - aReal

      const aSync = a.lastSyncedAt || ''
      const bSync = b.lastSyncedAt || ''
      if (aSync !== bSync) return bSync.localeCompare(aSync)

      const aExp = a.lastSnapshotExportedAt || ''
      const bExp = b.lastSnapshotExportedAt || ''
      if (aExp !== bExp) return bExp.localeCompare(aExp)

      return 0
    })

    result.push(group[0])
  }

  return result
}

// ============ 好友邀请机制 (减少配置摩擦) ============

export function createFriendInvitation(
  config: FriendSyncConfig,
  myProfile?: { friendCode: string; profileId: string; nickname: string; avatar: string },
): string {
  const code = myProfile?.friendCode || 'SB-USER'
  const pid = myProfile?.profileId || 'pid-self'
  const nick = myProfile?.nickname || 'dr7fter'
  const av = myProfile?.avatar || '🚀'

  const invitation: FriendInvitationPayload = {
    schemaVersion: 1,
    kind: 'shuaba-friend-invitation',
    endpoint: config.endpoint,
    folder: config.folder,
    friendCode: code,
    profileId: pid,
    nickname: nick,
    avatar: av,
    createdAt: new Date().toISOString(),
  }
  return JSON.stringify(invitation, null, 2)
}

export function importFriendInvitation(raw: string): {
  success: boolean
  message: string
  config?: Partial<FriendSyncConfig>
  friendCode?: string
} {
  const parsed = parseJson<Partial<FriendInvitationPayload>>(raw)
  if (
    !parsed ||
    parsed.schemaVersion !== 1 ||
    parsed.kind !== 'shuaba-friend-invitation' ||
    typeof parsed.friendCode !== 'string' ||
    typeof parsed.endpoint !== 'string'
  ) {
    return { success: false, message: '这不是有效的刷吧好友邀请码/文件' }
  }

  const friendCode = normalizeFriendCode(parsed.friendCode)
  if (!friendCode) return { success: false, message: '邀请文件中的好友码格式不正确' }

  // 主动导入好友邀请时，自动解除屏蔽
  unblockIdentity(friendCode, parsed.profileId)

  const config: Partial<FriendSyncConfig> = {
    endpoint: parsed.endpoint.trim(),
    folder: parsed.folder ? parsed.folder.trim() : 'shuaba-friends',
  }

  return {
    success: true,
    message: `已成功导入「${parsed.nickname || friendCode}」的邀请并解除屏蔽！已自动填充 WebDAV 路径与好友码，只需填写您自己的坚果云应用密码即可开始同步。`,
    config,
    friendCode,
  }
}
