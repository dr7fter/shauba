import type {
  BootstrapData,
  EloStatus,
  FriendActivity,
  FriendDimensions,
  FriendPresence,
  FriendProfile,
  FriendPublicActivity,
  FriendPublicMatch,
  FriendPublicReport,
  FriendPublicReportQuestion,
  FriendShareSnapshotV2,
  FriendSyncConfig,
  FriendSyncResult,
  FriendSyncState,
  FriendSyncStatus,
  FriendsSystemData,
  TacticalDashboardData,
} from '../types'
import {
  bootstrap,
  getEloStatus,
  getTacticalDashboardStats,
  pullFriendSnapshots,
  publishFriendSnapshot,
  setUserProfile,
} from '../api'
import { predictedExamScore, rankLetterForElo } from '../utils'
import {
  addBlockedIdentity,
  clearAllBlockedIdentities,
  createFriendInvitation,
  getBlockedIdentities,
  dedupeIdentitiesConnected,
  getMyPresence,
  getMyPublicMatches,
  getMyPublicReports,
  importFriendInvitation,
  isIdentityBlocked,
  normalizeFriendCode,
  saveFriendCachedMatches,
  saveFriendCachedReports,
  unblockIdentity,
} from './friendPublicData'

export function isSyncConfigReady(config: FriendSyncConfig | null | undefined): config is FriendSyncConfig {
  return Boolean(
    config &&
      config.endpoint &&
      config.username &&
      config.appPassword &&
      config.folder &&
      config.endpoint.trim().length > 0 &&
      config.username.trim().length > 0 &&
      config.appPassword.trim().length > 0 &&
      config.folder.trim().length > 0
  )
}

export {
  clearAllBlockedIdentities,
  createFriendInvitation,
  getBlockedIdentities,
  importFriendInvitation,
  isIdentityBlocked,
  normalizeFriendCode,
  unblockIdentity,
}

const STORAGE_KEY_FRIENDS = 'shuaba_friends_roster_v2'
const STORAGE_KEY_MY_PROFILE = 'shuaba_my_profile_v2'
const STORAGE_KEY_ACTIVITIES = 'shuaba_friends_activities_v2'
const STORAGE_KEY_FRIEND_CODES = 'shuaba_friend_codes_v2'
const STORAGE_KEY_SYNC_CONFIG = 'shuaba_friend_sync_config_v2'
const STORAGE_KEY_SYNC_STATE = 'shuaba_friend_sync_state_v1'
const STORAGE_KEY_PROFILE_ID = 'shuaba_friend_profile_id_v1'
const STORAGE_KEY_MY_REVISION = 'shuaba_my_snapshot_revision_v1'

const LEGACY_STORAGE_KEY_FRIENDS = 'shuaba_friends_roster_v1'
const LEGACY_STORAGE_KEY_MY_PROFILE = 'shuaba_my_profile_v1'
const LEGACY_STORAGE_KEY_ACTIVITIES = 'shuaba_friends_activities_v1'
const LEGACY_STORAGE_KEY_FRIEND_CODES = 'shuaba_friend_codes_v1'
const LEGACY_STORAGE_KEY_SYNC_CONFIG = 'shuaba_friend_sync_config_v1'

const MAX_SNAPSHOT_BYTES = 256 * 1024
const DIMENSION_KEYS = ['rigor', 'computation', 'speed', 'modeling', 'methodUse', 'strategyInsight'] as const
const DEFAULT_FRIENDS: FriendProfile[] = []
const DEFAULT_ACTIVITIES: FriendActivity[] = []

type RecordValue = Record<string, unknown>
type SavedMyProfile = { profileId: string; nickname: string; friendCode: string; targetSchool: string; avatar: string }

type ParsedSnapshot = {
  profile: FriendProfile
  exportedAt: string
  hash: string
  revision: number
  presence?: FriendPresence
  activities?: FriendPublicActivity[]
  matches?: FriendPublicMatch[]
  reports?: FriendPublicReport[]
}
type ParseResult = { ok: true; value: ParsedSnapshot } | { ok: false; message: string; friendCode?: string }

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readStorage(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value))
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

function readMigrated(current: string, legacy: string) {
  const raw = readStorage(current)
  return raw !== null ? { raw, legacy: false } : { raw: readStorage(legacy), legacy: true }
}

function bytes(value: string) {
  try {
    return new TextEncoder().encode(value).byteLength
  } catch {
    return value.length * 2
  }
}

function finite(value: unknown, min: number, max: number, integer = false): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value))
}

function clamp(value: unknown, fallback: number, min: number, max: number, integer = false) {
  return finite(value, min, max, integer) ? (integer ? Math.round(value) : value) : fallback
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 64 && value.trim() !== '' && !Number.isNaN(Date.parse(value))
}

function bounded(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max
}

function hashString(value: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, '0')}`
}

function newId(prefix: string) {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`
  } catch {
    // fallback
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function validProfileId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)
}

function legacyProfileId(code: string) {
  return `legacy-${hashString(code).slice(-8)}`
}

function status(value: unknown): FriendProfile['status'] {
  return value === 'online' || value === 'in_match' || value === 'offline' ? value : 'offline'
}

function syncStatus(value: unknown, fallback: FriendSyncStatus): FriendSyncStatus {
  return value === 'pending' || value === 'synced' || value === 'unchanged' || value === 'failed' || value === 'invalid'
    ? value
    : fallback
}

function dimensions(value: unknown, fallback = 50): FriendDimensions | null {
  if (!isRecord(value)) return null
  const result = {} as FriendDimensions
  for (const key of DIMENSION_KEYS) {
    if (finite(value[key], 0, 100)) result[key] = value[key]
    else if (fallback >= 0 && fallback <= 100) result[key] = fallback
    else return null
  }
  return result
}

function publicSource(profile: FriendProfile): RecordValue {
  const code = normalizeFriendCode(profile.friendCode) ?? profile.friendCode.trim().toUpperCase()
  return {
    profileId: profile.profileId ?? legacyProfileId(code),
    friendCode: code,
    nickname: profile.nickname,
    avatar: profile.avatar,
    title: profile.title,
    targetSchool: profile.targetSchool,
    currentElo: profile.currentElo,
    peakElo: profile.peakElo,
    rankLetter: profile.rankLetter,
    ratingPro: profile.ratingPro,
    predictedExamScore: profile.predictedExamScore,
    todayProblems: profile.todayProblems,
    totalMatches: profile.totalMatches,
    winRate: profile.winRate,
    status: profile.status,
    currentActivity: profile.currentActivity ?? null,
    lastActiveAt: profile.lastActiveAt,
    eloChangeToday: profile.eloChangeToday ?? null,
    seasonName: profile.seasonName ?? null,
    dimensions: { ...profile.dimensions },
  }
}

function profileHash(profile: FriendProfile) {
  return hashString(JSON.stringify(publicSource(profile)))
}

function publicProfile(profile: FriendProfile): FriendProfile {
  const code = normalizeFriendCode(profile.friendCode) ?? profile.friendCode.trim().toUpperCase()
  const profileId = validProfileId(profile.profileId) ? profile.profileId : legacyProfileId(code)
  return {
    id: profile.isSelf ? 'my-self-profile' : `friend-${profileId}`,
    profileId,
    friendCode: code,
    nickname: profile.nickname.trim(),
    avatar: profile.avatar,
    title: profile.title,
    targetSchool: profile.targetSchool,
    currentElo: profile.currentElo,
    peakElo: profile.peakElo,
    rankLetter: profile.rankLetter,
    ratingPro: profile.ratingPro,
    predictedExamScore: profile.predictedExamScore,
    todayProblems: profile.todayProblems,
    totalMatches: profile.totalMatches,
    winRate: profile.winRate,
    status: profile.status,
    currentActivity: profile.currentActivity,
    lastActiveAt: profile.lastActiveAt,
    dimensions: { ...profile.dimensions },
    isSelf: profile.isSelf,
    eloChangeToday: profile.eloChangeToday,
    seasonName: profile.seasonName,
  }
}

function randomFriendCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  return `SB-${letters[Math.floor(Math.random() * letters.length)]}${Math.floor(1000 + Math.random() * 9000)}`
}

export function getSavedMyCustomProfile(): SavedMyProfile {
  const { raw, legacy } = readMigrated(STORAGE_KEY_MY_PROFILE, LEGACY_STORAGE_KEY_MY_PROFILE)
  const parsed = parseJson<RecordValue>(raw) ?? {}
  const storedCode = normalizeFriendCode(parsed.friendCode)
  const friendCode = !storedCode || storedCode === 'SHUABA-9527' ? randomFriendCode() : storedCode
  const storedId = validProfileId(parsed.profileId) ? parsed.profileId : parseJson<string>(readStorage(STORAGE_KEY_PROFILE_ID))
  const profileId = validProfileId(storedId) ? storedId : newId('profile')
  const profile: SavedMyProfile = {
    profileId,
    nickname: bounded(parsed.nickname, 1, 64) ? parsed.nickname.trim() : 'dr7fter',
    friendCode,
    targetSchool: typeof parsed.targetSchool === 'string' ? parsed.targetSchool.trim().slice(0, 128) : '考研数学一 · 目标985',
    avatar: typeof parsed.avatar === 'string' && parsed.avatar.trim() ? parsed.avatar.trim().slice(0, 16) : '🚀',
  }
  if (legacy || raw !== JSON.stringify(profile)) writeStorage(STORAGE_KEY_MY_PROFILE, profile)
  writeStorage(STORAGE_KEY_PROFILE_ID, profileId)
  return profile
}

export function saveMyCustomProfile(custom: { nickname: string; friendCode?: string; targetSchool: string; avatar: string }) {
  const existing = getSavedMyCustomProfile()
  const code = custom.friendCode === undefined ? existing.friendCode : normalizeFriendCode(custom.friendCode) ?? existing.friendCode
  const profile: SavedMyProfile = {
    profileId: existing.profileId,
    nickname: custom.nickname.trim().slice(0, 64) || existing.nickname,
    friendCode: code,
    targetSchool: custom.targetSchool.trim().slice(0, 128),
    avatar: custom.avatar.trim().slice(0, 16) || existing.avatar,
  }
  writeStorage(STORAGE_KEY_MY_PROFILE, profile)
  void setUserProfile({ nickname: profile.nickname, friendCode: profile.friendCode, targetSchool: profile.targetSchool, avatar: profile.avatar })
}

function getMyRevision(): number {
  const val = parseJson<number>(readStorage(STORAGE_KEY_MY_REVISION))
  return typeof val === 'number' && Number.isFinite(val) ? val : 1
}

function incrementMyRevision(): number {
  const next = getMyRevision() + 1
  writeStorage(STORAGE_KEY_MY_REVISION, next)
  return next
}

function normalizeLocalFriend(value: unknown): FriendProfile | null {
  if (!isRecord(value)) return null
  const friendCode = normalizeFriendCode(value.friendCode)
  if (!friendCode || !bounded(value.nickname, 1, 64)) return null
  const profileId = validProfileId(value.profileId) ? value.profileId : legacyProfileId(friendCode)
  const currentElo = clamp(value.currentElo, 1400, 0, 5000)
  const dims = dimensions(value.dimensions)
  if (!dims) return null
  return {
    id: `friend-${profileId}`,
    profileId,
    friendCode,
    nickname: value.nickname.trim().slice(0, 64),
    avatar: typeof value.avatar === 'string' && value.avatar.trim() ? value.avatar.trim().slice(0, 16) : '🙂',
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim().slice(0, 64) : '刷吧研友',
    targetSchool: typeof value.targetSchool === 'string' ? value.targetSchool.trim().slice(0, 128) : '暂未填写目标院校',
    currentElo,
    peakElo: clamp(value.peakElo, currentElo, 0, 5000),
    rankLetter: typeof value.rankLetter === 'string' ? value.rankLetter.trim().slice(0, 32) : rankLetterForElo(currentElo),
    ratingPro: clamp(value.ratingPro, 1, 0, 2.5),
    predictedExamScore: clamp(value.predictedExamScore, 0, 0, 150),
    todayProblems: clamp(value.todayProblems, 0, 0, 100000, true),
    totalMatches: clamp(value.totalMatches, 0, 0, 1000000, true),
    winRate: clamp(value.winRate, 0, 0, 100),
    status: status(value.status),
    currentActivity: typeof value.currentActivity === 'string' ? value.currentActivity.trim().slice(0, 256) : undefined,
    lastActiveAt: validDate(value.lastActiveAt) ? value.lastActiveAt : new Date(0).toISOString(),
    dimensions: dims,
    isSelf: false,
    eloChangeToday: typeof value.eloChangeToday === 'number' ? clamp(value.eloChangeToday, 0, -5000, 5000) : undefined,
    seasonName: typeof value.seasonName === 'string' ? value.seasonName.trim().slice(0, 64) : undefined,
    syncStatus: syncStatus(value.syncStatus, 'synced'),
    lastSyncedAt: validDate(value.lastSyncedAt) ? value.lastSyncedAt : undefined,
    lastSnapshotHash: typeof value.lastSnapshotHash === 'string' ? value.lastSnapshotHash.slice(0, 64) : undefined,
    lastSnapshotExportedAt: validDate(value.lastSnapshotExportedAt) ? value.lastSnapshotExportedAt : undefined,
    lastSyncError: typeof value.lastSyncError === 'string' ? value.lastSyncError.slice(0, 256) : undefined,
  }
}

export function getSavedFriends(): FriendProfile[] {
  const { raw, legacy } = readMigrated(STORAGE_KEY_FRIENDS, LEGACY_STORAGE_KEY_FRIENDS)
  const parsed = parseJson<unknown>(raw)
  const normalized = Array.isArray(parsed) ? parsed.map(normalizeLocalFriend).filter((item): item is FriendProfile => item !== null) : []
  const own = getSavedMyCustomProfile()
  const deduped = dedupeIdentitiesConnected(normalized)
  const friends = deduped.filter((friend) => friend.friendCode !== own.friendCode && friend.profileId !== own.profileId && !isIdentityBlocked(friend.friendCode, friend.profileId))
  if (legacy || raw !== JSON.stringify(friends)) writeStorage(STORAGE_KEY_FRIENDS, friends)
  return friends.length ? friends : DEFAULT_FRIENDS
}

export function saveFriends(friends: FriendProfile[]) {
  const own = getSavedMyCustomProfile()
  const normalized = friends
    .map(normalizeLocalFriend)
    .filter((item): item is FriendProfile => item !== null)
    .filter((friend) => friend.friendCode !== own.friendCode && friend.profileId !== own.profileId && !isIdentityBlocked(friend.friendCode, friend.profileId))
  const deduped = dedupeIdentitiesConnected(normalized)
  writeStorage(STORAGE_KEY_FRIENDS, deduped)
}

export function getSavedFriendCodes(): string[] {
  const { raw, legacy } = readMigrated(STORAGE_KEY_FRIEND_CODES, LEGACY_STORAGE_KEY_FRIEND_CODES)
  const parsed = parseJson<unknown>(raw)
  const stored = Array.isArray(parsed) ? parsed.map(normalizeFriendCode).filter((item): item is string => item !== null) : []
  const friends = getSavedFriends().map((friend) => friend.friendCode)
  const own = getSavedMyCustomProfile().friendCode
  const codes = [...new Set([...stored, ...friends])].filter((code) => code !== own && !isIdentityBlocked(code))
  if (legacy || raw !== JSON.stringify(codes)) writeStorage(STORAGE_KEY_FRIEND_CODES, codes)
  return codes
}

function saveSyncStates(states: FriendSyncState[]) {
  writeStorage(STORAGE_KEY_SYNC_STATE, states)
}

function normalizeSyncState(value: unknown): FriendSyncState | null {
  if (!isRecord(value)) return null
  const friendCode = normalizeFriendCode(value.friendCode)
  if (!friendCode) return null
  return {
    friendCode,
    profileId: validProfileId(value.profileId) ? value.profileId : undefined,
    status: syncStatus(value.status, 'pending'),
    lastAttemptAt: validDate(value.lastAttemptAt) ? value.lastAttemptAt : undefined,
    lastSyncedAt: validDate(value.lastSyncedAt) ? value.lastSyncedAt : undefined,
    lastSnapshotHash: typeof value.lastSnapshotHash === 'string' ? value.lastSnapshotHash.slice(0, 64) : undefined,
    lastSnapshotExportedAt: validDate(value.lastSnapshotExportedAt) ? value.lastSnapshotExportedAt : undefined,
    lastError: typeof value.lastError === 'string' ? value.lastError.slice(0, 256) : undefined,
  }
}

export function getSavedFriendSyncStates(): FriendSyncState[] {
  const parsed = parseJson<unknown>(readStorage(STORAGE_KEY_SYNC_STATE))
  const map = new Map<string, FriendSyncState>()
  if (Array.isArray(parsed)) {
    for (const value of parsed) {
      const state = normalizeSyncState(value)
      if (state && !isIdentityBlocked(state.friendCode, state.profileId)) map.set(state.friendCode, state)
    }
  }
  for (const friend of getSavedFriends()) {
    if (!map.has(friend.friendCode)) {
      map.set(friend.friendCode, {
        friendCode: friend.friendCode,
        profileId: friend.profileId,
        status: friend.syncStatus ?? 'synced',
        lastSyncedAt: friend.lastSyncedAt,
        lastSnapshotHash: friend.lastSnapshotHash,
        lastSnapshotExportedAt: friend.lastSnapshotExportedAt,
        lastError: friend.lastSyncError,
      })
    }
  }
  for (const code of getSavedFriendCodes()) {
    if (!map.has(code)) map.set(code, { friendCode: code, status: 'pending' })
  }
  const result = [...map.values()]
  if (JSON.stringify(parsed) !== JSON.stringify(result)) saveSyncStates(result)
  return result
}

function updateSyncState(patch: Partial<FriendSyncState> & Pick<FriendSyncState, 'friendCode'>) {
  const code = normalizeFriendCode(patch.friendCode)
  if (!code) return
  const states = getSavedFriendSyncStates()
  const index = states.findIndex((state) => state.friendCode === code || (patch.profileId !== undefined && state.profileId === patch.profileId))
  const previous = index >= 0 ? states[index] : { friendCode: code, status: 'pending' as const }
  const next = { ...previous, ...patch, friendCode: code }
  if (index >= 0) states[index] = next
  else states.unshift(next)
  saveSyncStates(states)
}

function removeSyncState(codeInput: string) {
  const code = normalizeFriendCode(codeInput)
  if (code) saveSyncStates(getSavedFriendSyncStates().filter((state) => state.friendCode !== code))
}

function syncErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.trim().slice(0, 256) || '好友同步失败'
}

function markFriendSyncStatus(codeInput: string, nextStatus: FriendSyncStatus, attemptedAt: string, lastError?: string) {
  const code = normalizeFriendCode(codeInput)
  if (!code) return
  const friends = getSavedFriends()
  const existing = friends.find((friend) => friend.friendCode === code)
  if (existing) {
    saveFriends(friends.map((friend) => (friend.friendCode === code ? { ...friend, syncStatus: nextStatus, lastSyncError: lastError } : friend)))
  }
  updateSyncState({
    friendCode: code,
    profileId: existing?.profileId,
    status: nextStatus,
    lastAttemptAt: attemptedAt,
    lastError,
  })
}

export function addFriendCode(codeInput: string): { success: boolean; message: string } {
  const code = normalizeFriendCode(codeInput)
  const own = getSavedMyCustomProfile().friendCode
  if (!code) return { success: false, message: '好友码格式不正确' }
  if (code === own) return { success: false, message: '不能添加自己' }

  const wasBlocked = isIdentityBlocked(code)
  if (wasBlocked) {
    unblockIdentity(code)
  }

  const codes = getSavedFriendCodes()
  if (!codes.includes(code)) writeStorage(STORAGE_KEY_FRIEND_CODES, [code, ...codes])
  const existing = getSavedFriends().find((friend) => friend.friendCode === code)
  updateSyncState({
    friendCode: code,
    profileId: existing?.profileId,
    status: existing?.syncStatus ?? 'pending',
    lastSyncedAt: existing?.lastSyncedAt,
    lastSnapshotHash: existing?.lastSnapshotHash,
    lastSnapshotExportedAt: existing?.lastSnapshotExportedAt,
  })
  return {
    success: true,
    message: wasBlocked
      ? `已解除对好友「${code}」的屏蔽并重新添加关注`
      : `已记录好友码 ${code}，等待好友首次发布数据`,
  }
}

export function getSavedFriendSyncConfig(): FriendSyncConfig | null {
  const { raw, legacy } = readMigrated(STORAGE_KEY_SYNC_CONFIG, LEGACY_STORAGE_KEY_SYNC_CONFIG)
  const parsed = parseJson<Partial<FriendSyncConfig>>(raw)
  if (!parsed || typeof parsed.endpoint !== 'string' || typeof parsed.username !== 'string' || typeof parsed.appPassword !== 'string' || typeof parsed.folder !== 'string') return null
  const config = { endpoint: parsed.endpoint.trim(), username: parsed.username.trim(), appPassword: parsed.appPassword, folder: parsed.folder.trim() }
  if (legacy || raw !== JSON.stringify(config)) writeStorage(STORAGE_KEY_SYNC_CONFIG, config)
  return config
}

export function saveFriendSyncConfig(config: FriendSyncConfig) {
  writeStorage(STORAGE_KEY_SYNC_CONFIG, {
    endpoint: config.endpoint.trim(),
    username: config.username.trim(),
    appPassword: config.appPassword,
    folder: config.folder.trim(),
  })
}

export async function publishMyFriendSnapshot(profile: FriendProfile, config: FriendSyncConfig): Promise<string> {
  const current = publicProfile({ ...profile, profileId: profile.profileId ?? getSavedMyCustomProfile().profileId })
  return publishFriendSnapshot(config, current.friendCode, createFriendShareSnapshot(current))
}

let backgroundSyncInProgress = false

export async function triggerBackgroundSync(reason?: string): Promise<void> {
  const config = getSavedFriendSyncConfig()
  if (!isSyncConfigReady(config)) return
  if (backgroundSyncInProgress) return
  backgroundSyncInProgress = true
  try {
    const [tacticalData, bootData, eloStatus] = await Promise.all([
      getTacticalDashboardStats().catch(() => null),
      bootstrap().catch(() => null),
      getEloStatus().catch(() => null),
    ])
    const profile = buildMyFriendProfile(tacticalData, bootData, eloStatus)
    await publishMyFriendSnapshot(profile, config)
    await syncFriendSnapshots(config)
  } catch (err) {
    console.debug(`Background sync (${reason || 'unspecified'}) error:`, err)
  } finally {
    backgroundSyncInProgress = false
  }
}

export async function syncFriendSnapshots(config: FriendSyncConfig): Promise<FriendSyncResult> {
  const requestedCodes = getSavedFriendCodes()
  if (!requestedCodes.length) {
    return { updated: 0, checked: 0, unchanged: 0, pending: 0, invalid: 0, unrecognizedFiles: 0, failedFiles: [] }
  }
  const attemptedAt = new Date().toISOString()
  for (const code of requestedCodes) updateSyncState({ friendCode: code, lastAttemptAt: attemptedAt })

  let remote: Awaited<ReturnType<typeof pullFriendSnapshots>>
  try {
    remote = await pullFriendSnapshots(config, requestedCodes)
  } catch (error) {
    const lastError = syncErrorMessage(error)
    for (const code of requestedCodes) markFriendSyncStatus(code, 'failed', attemptedAt, lastError)
    throw error
  }

  let updated = 0
  let unchanged = 0
  let invalid = 0
  let unrecognizedFiles = 0
  const failedFiles: string[] = []
  const seen = new Set<string>()
  const remoteCodes = new Set<string>()

  const existingFriends = getSavedFriends()
  const knownProfileIds = new Set(existingFriends.map((f) => f.profileId).filter(Boolean))
  const knownCodesSet = new Set(requestedCodes)

  for (const item of remote) {
    const sourceCode = fileCode(item.fileName)
    if (sourceCode && isIdentityBlocked(sourceCode)) {
      continue
    }

    // 先做白名单预判与解析
    const parsed = parseFriendSnapshot(item.payload)
    if (!parsed.ok) {
      if (sourceCode && knownCodesSet.has(sourceCode)) {
        invalid += 1
        failedFiles.push(item.fileName)
        updateSyncState({ friendCode: sourceCode, status: 'invalid', lastError: parsed.message, lastAttemptAt: attemptedAt })
      }
      continue
    }

    const { profile } = parsed.value
    if (isIdentityBlocked(profile.friendCode, profile.profileId)) {
      continue
    }

    // 白名单判定规则：
    // 1. friendCode 在主动添加列表中 -> 允许
    // 2. profileId 是已知已有好友（好友改码） -> 允许
    // 3. 否则 -> 陌生文件，直接忽略，不导入！
    const isCodeKnown = knownCodesSet.has(profile.friendCode) || (sourceCode !== null && knownCodesSet.has(sourceCode))
    const isProfileKnown = profile.profileId ? knownProfileIds.has(profile.profileId) : false

    if (!isCodeKnown && !isProfileKnown) {
      unrecognizedFiles += 1
      continue
    }

    if (sourceCode) remoteCodes.add(sourceCode)
    const result = addFriendSnapshot(item.payload, { sourceFileName: item.fileName })
    if (!result.success) {
      invalid += 1
      failedFiles.push(item.fileName)
      continue
    }
    if (result.friend?.friendCode) {
      seen.add(result.friend.friendCode)
      remoteCodes.add(result.friend.friendCode)
    }
    if (result.changed) updated += 1
    else unchanged += 1
  }

  const missingCodes = requestedCodes.filter((code) => !remoteCodes.has(code) && !seen.has(code))
  const friends = getSavedFriends()
  for (const code of missingCodes) {
    const existing = friends.find((friend) => friend.friendCode === code)
    markFriendSyncStatus(code, 'pending', attemptedAt, existing ? '本次同步未找到远端好友数据，已保留本地上次数据' : '等待好友首次发布数据')
  }
  return {
    updated,
    checked: Math.max(requestedCodes.length, remote.length),
    unchanged,
    pending: missingCodes.length,
    invalid,
    unrecognizedFiles,
    failedFiles,
  }
}

const STORAGE_KEY_MY_ACTIVITIES = 'shuaba_my_activities_v2'
const STORAGE_KEY_FRIEND_ACTIVITIES = 'shuaba_friend_activities_v2'

function parseActivitiesArray(raw: string | null): FriendActivity[] {
  const parsed = parseJson<unknown>(raw)
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter(isRecord)
    .map(
      (item): FriendActivity => ({
        id: typeof item.id === 'string' ? item.id : newId('activity'),
        friendCode: normalizeFriendCode(item.friendCode) ?? '',
        nickname: typeof item.nickname === 'string' ? item.nickname.trim().slice(0, 64) : '好友',
        avatar: typeof item.avatar === 'string' ? item.avatar.slice(0, 16) : '🙂',
        type:
          item.type === 'rank_up' || item.type === 'donk_burst' || item.type === 'exam_finish' || item.type === 'daily_streak'
            ? item.type
            : 'daily_streak',
        title: typeof item.title === 'string' ? item.title.slice(0, 128) : '',
        content: typeof item.content === 'string' ? item.content.slice(0, 256) : '',
        timestamp: typeof item.timestamp === 'string' && validDate(item.timestamp) ? item.timestamp : new Date(0).toISOString(),
      }),
    )
    .filter((item) => item.friendCode !== '')
}

export function getMySavedActivities(): FriendActivity[] {
  const raw = readStorage(STORAGE_KEY_MY_ACTIVITIES)
  if (raw) return parseActivitiesArray(raw)
  // Backfill from legacy global activities if my activity storage is empty
  const legacyRaw = readMigrated(STORAGE_KEY_ACTIVITIES, LEGACY_STORAGE_KEY_ACTIVITIES).raw
  const legacyList = parseActivitiesArray(legacyRaw)
  const ownCode = getSavedMyCustomProfile().friendCode
  const myLegacy = legacyList.filter((a) => a.friendCode === ownCode)
  if (myLegacy.length) writeStorage(STORAGE_KEY_MY_ACTIVITIES, myLegacy)
  return myLegacy
}

export function getFriendSavedActivities(): FriendActivity[] {
  const raw = readStorage(STORAGE_KEY_FRIEND_ACTIVITIES)
  if (raw) return parseActivitiesArray(raw)
  // Backfill from legacy global activities
  const legacyRaw = readMigrated(STORAGE_KEY_ACTIVITIES, LEGACY_STORAGE_KEY_ACTIVITIES).raw
  const legacyList = parseActivitiesArray(legacyRaw)
  const ownCode = getSavedMyCustomProfile().friendCode
  const friendLegacy = legacyList.filter((a) => a.friendCode !== ownCode)
  if (friendLegacy.length) writeStorage(STORAGE_KEY_FRIEND_ACTIVITIES, friendLegacy)
  return friendLegacy
}

export function getSavedActivities(): FriendActivity[] {
  const my = getMySavedActivities()
  const friends = getFriendSavedActivities()
  const merged = [...my, ...friends]
  merged.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
  return merged.length ? merged.slice(0, 50) : DEFAULT_ACTIVITIES
}

export function saveMyActivities(activities: FriendActivity[]): void {
  writeStorage(STORAGE_KEY_MY_ACTIVITIES, activities.slice(0, 50))
}

export function saveFriendActivities(activities: FriendActivity[]): void {
  writeStorage(STORAGE_KEY_FRIEND_ACTIVITIES, activities.slice(0, 50))
}

export function addMyActivity(act: FriendActivity): void {
  const current = getMySavedActivities()
  if (current.some((a) => a.id === act.id)) return
  saveMyActivities([act, ...current].slice(0, 50))
}

export function addFriendActivity(act: FriendActivity): void {
  const ownCode = getSavedMyCustomProfile().friendCode
  if (act.friendCode === ownCode || !act.friendCode) {
    addMyActivity({ ...act, friendCode: ownCode })
    return
  }
  const current = getFriendSavedActivities()
  if (current.some((a) => a.id === act.id)) return
  saveFriendActivities([act, ...current].slice(0, 50))
}

export function buildMyFriendProfile(
  tacticalData: TacticalDashboardData | null,
  bootstrapData: BootstrapData | null,
  eloStatus: EloStatus | null,
): FriendProfile {
  const custom = getSavedMyCustomProfile()
  const elo = Math.round(eloStatus?.current ?? tacticalData?.profile.currentElo ?? 1600)
  const peakElo = Math.round(tacticalData?.profile.peakElo ?? elo)
  const ratingPro = tacticalData?.profile.ratingPro ?? 1.17
  const dims: Record<string, number> = { rigor: 64, computation: 65, speed: 62, modeling: 64, methodUse: 63, strategyInsight: 62 }
  if (tacticalData?.dimensions) {
    for (const item of tacticalData.dimensions) {
      if (item.key in dims) dims[item.key] = clamp(item.value, dims[item.key], 0, 100)
    }
  }
  return {
    id: 'my-self-profile',
    profileId: custom.profileId,
    friendCode: custom.friendCode,
    nickname: custom.nickname || tacticalData?.profile.nickname || 'dr7fter',
    avatar: custom.avatar || '🚀',
    title: tacticalData?.profile.title || '一锤定音的战场收割者',
    targetSchool: custom.targetSchool || '考研数学一 · 目标985',
    currentElo: elo,
    peakElo,
    rankLetter: tacticalData?.profile.currentRankLetter ?? rankLetterForElo(elo),
    ratingPro,
    predictedExamScore: predictedExamScore(ratingPro, 85),
    todayProblems: bootstrapData?.todayDone ?? 8,
    totalMatches: tacticalData?.profile.matches ?? 42,
    winRate: tacticalData?.profile.winRate ?? 55,
    status: getMyPresence().state,
    currentActivity: getMyPresence().currentActivity,
    lastActiveAt: getMyPresence().heartbeatAt,
    eloChangeToday: Math.round(eloStatus?.lastDelta ?? 12),
    isSelf: true,
    seasonName: tacticalData?.currentSeason || 'S2',
    dimensions: {
      rigor: dims.rigor,
      computation: dims.computation,
      speed: dims.speed,
      modeling: dims.modeling,
      methodUse: dims.methodUse,
      strategyInsight: dims.strategyInsight,
    },
  }
}

export function loadFriendsSystemData(
  tacticalData: TacticalDashboardData | null,
  bootstrapData: BootstrapData | null,
  eloStatus: EloStatus | null,
): FriendsSystemData {
  return {
    myProfile: buildMyFriendProfile(tacticalData, bootstrapData, eloStatus),
    friends: getSavedFriends(),
    activities: getSavedActivities(),
  }
}

export function createFriendShareSnapshot(profile: FriendProfile): string {
  const exportedAt = new Date().toISOString()
  const presence = getMyPresence()
  const current = publicProfile({
    ...profile,
    isSelf: false,
    status: presence.state,
    currentActivity: presence.currentActivity,
    lastActiveAt: presence.heartbeatAt,
  })
  const revision = incrementMyRevision()
  const myMatches = getMyPublicMatches().slice(0, 10)
  const myReports = getMyPublicReports().slice(0, 10)
  const myActivities: FriendPublicActivity[] = getMySavedActivities().slice(0, 20).map((a) => ({
    id: a.id,
    profileId: current.profileId || current.friendCode,
    friendCode: current.friendCode,
    type: a.type,
    title: a.title,
    content: a.content,
    timestamp: a.timestamp,
  }))

  const snapshot: FriendShareSnapshotV2 = {
    schemaVersion: 2,
    kind: 'shuaba-friend-public',
    snapshotId: `${current.profileId}-${hashString(exportedAt).slice(-8)}`,
    profileId: current.profileId || current.friendCode,
    friendCode: current.friendCode,
    revision,
    exportedAt,
    profile: current,
    presence,
    activities: myActivities,
    matches: myMatches,
    reports: myReports,
  }
  return JSON.stringify(snapshot, null, 2)
}

function parseFriendSnapshot(raw: string): ParseResult {
  if (bytes(raw) > MAX_SNAPSHOT_BYTES) return { ok: false, message: '好友卡片过大，已拒绝导入（上限 256 KB）' }
  const parsed = parseJson<unknown>(raw)
  if (!isRecord(parsed) || !validDate(parsed.exportedAt) || !isRecord(parsed.profile)) {
    return { ok: false, message: '这不是有效的刷吧好友卡片' }
  }

  const schemaVersion = parsed.schemaVersion
  if (schemaVersion !== 1 && schemaVersion !== 2) {
    return { ok: false, message: '不支持的好友卡片协议版本' }
  }

  const exportedAt = typeof parsed.exportedAt === 'string' && validDate(parsed.exportedAt) ? parsed.exportedAt : new Date().toISOString()

  const source = parsed.profile
  const friendCode = normalizeFriendCode(source.friendCode)
  if (!friendCode) return { ok: false, message: '好友码格式不正确' }
  if (!bounded(source.nickname, 1, 32)) return { ok: false, message: '好友昵称格式不正确' }
  if (!finite(source.currentElo, 0, 5000)) return { ok: false, message: '好友 ELO 数据超出有效范围', friendCode }
  if (source.profileId !== undefined && !validProfileId(source.profileId)) return { ok: false, message: '好友身份标识格式不正确', friendCode }
  const dims = dimensions(source.dimensions, -1)
  if (!dims) return { ok: false, message: '好友六维数据不完整或超出 0-100 范围', friendCode }

  const peakElo = source.peakElo === undefined ? source.currentElo : source.peakElo
  const ratingPro = source.ratingPro === undefined ? 1 : source.ratingPro
  const predicted = source.predictedExamScore === undefined ? 0 : source.predictedExamScore
  const today = source.todayProblems === undefined ? 0 : source.todayProblems
  const matches = source.totalMatches === undefined ? 0 : source.totalMatches
  const winRate = source.winRate === undefined ? 0 : source.winRate
  if (!finite(peakElo, 0, 5000) || !finite(ratingPro, 0, 2.5) || !finite(predicted, 0, 150)) {
    return { ok: false, message: '好友统计数据超出有效范围', friendCode }
  }
  if (!finite(today, 0, 100000, true) || !finite(matches, 0, 1000000, true) || !finite(winRate, 0, 100)) {
    return { ok: false, message: '好友刷题统计数据不正确', friendCode }
  }

  const profile: FriendProfile = {
    id: `friend-${source.profileId ?? legacyProfileId(friendCode)}`,
    profileId: validProfileId(source.profileId) ? source.profileId : legacyProfileId(friendCode),
    friendCode,
    nickname: source.nickname.trim(),
    avatar: typeof source.avatar === 'string' && source.avatar.trim() ? source.avatar.trim() : '🙂',
    title: typeof source.title === 'string' && source.title.trim() ? source.title.trim() : '刷吧研友',
    targetSchool: typeof source.targetSchool === 'string' ? source.targetSchool.trim().slice(0, 128) : '暂未填写目标院校',
    currentElo: source.currentElo,
    peakElo,
    rankLetter: typeof source.rankLetter === 'string' ? source.rankLetter.trim().slice(0, 32) : rankLetterForElo(source.currentElo),
    ratingPro,
    predictedExamScore: predicted,
    todayProblems: today,
    totalMatches: matches,
    winRate,
    status: status(source.status),
    currentActivity: typeof source.currentActivity === 'string' ? source.currentActivity.trim().slice(0, 256) : undefined,
    lastActiveAt: validDate(source.lastActiveAt) ? source.lastActiveAt : exportedAt,
    dimensions: dims,
    isSelf: false,
    eloChangeToday: typeof source.eloChangeToday === 'number' ? source.eloChangeToday : undefined,
    seasonName: typeof source.seasonName === 'string' ? source.seasonName.trim().slice(0, 64) : undefined,
  }

  // Schema v2 附加的公开比赛、报告、动态和 Presence
  let presence: FriendPresence | undefined
  let publicActivities: FriendPublicActivity[] | undefined
  let publicMatches: FriendPublicMatch[] | undefined
  let publicReports: FriendPublicReport[] | undefined

  if (schemaVersion === 2 && isRecord(parsed.presence)) {
    const p = parsed.presence
    if (typeof p.state === 'string' && validDate(p.heartbeatAt)) {
      presence = {
        state: p.state === 'in_match' || p.state === 'online' || p.state === 'idle' ? p.state : 'offline',
        currentActivity: typeof p.currentActivity === 'string' ? p.currentActivity : undefined,
        currentMatchId: typeof p.currentMatchId === 'string' ? p.currentMatchId : undefined,
        heartbeatAt: p.heartbeatAt,
        expiresAt: validDate(p.expiresAt) ? p.expiresAt : new Date(Date.now() + 180000).toISOString(),
      }
    }
  }

  if (schemaVersion === 2 && Array.isArray(parsed.matches)) {
    publicMatches = (parsed.matches as unknown[]).filter(isRecord).map((m): FriendPublicMatch => ({
      publicMatchId: String(m.publicMatchId || newId('match')),
      startedAt: typeof m.startedAt === 'string' && validDate(m.startedAt) ? m.startedAt : exportedAt,
      finishedAt: typeof m.finishedAt === 'string' && validDate(m.finishedAt) ? m.finishedAt : exportedAt,
      mode: typeof m.mode === 'string' ? m.mode : 'paper',
      title: typeof m.title === 'string' ? m.title : undefined,
      questionCount: clamp(m.questionCount, 1, 1, 1000, true),
      correctCount: clamp(m.correctCount, 0, 0, 1000, true),
      accuracy: clamp(m.accuracy, 0, 0, 100),
      durationSeconds: clamp(m.durationSeconds, 60, 1, 86400, true),
      rating: clamp(m.rating, 1.0, 0, 2.5),
      ratingDelta: typeof m.ratingDelta === 'number' ? m.ratingDelta : undefined,
      eloDelta: typeof m.eloDelta === 'number' ? m.eloDelta : undefined,
      result: m.result === 'win' || m.result === 'loss' || m.result === 'mixed' ? m.result : 'uncertain',
      reportId: typeof m.reportId === 'string' ? m.reportId : undefined,
      reportAvailable: Boolean(m.reportAvailable),
    }))
  }

  if (schemaVersion === 2 && Array.isArray(parsed.reports)) {
    publicReports = (parsed.reports as unknown[]).filter(isRecord).map((r): FriendPublicReport => ({
      reportId: String(r.reportId || newId('report')),
      publicMatchId: String(r.publicMatchId || ''),
      createdAt: typeof r.createdAt === 'string' && validDate(r.createdAt) ? r.createdAt : exportedAt,
      summary: typeof r.summary === 'string' ? r.summary.slice(0, 1000) : '高压演练报告',
      rating: clamp(r.rating, 1.0, 0, 2.5),
      accuracy: clamp(r.accuracy, 0, 0, 100),
      durationSeconds: clamp(r.durationSeconds, 60, 1, 86400, true),
      dimensions: dimensions(r.dimensions) || undefined,
      strengths: Array.isArray(r.strengths) ? r.strengths.filter((s): s is string => typeof s === 'string') : [],
      weaknesses: Array.isArray(r.weaknesses) ? r.weaknesses.filter((s): s is string => typeof s === 'string') : [],
      errorTags: Array.isArray(r.errorTags) ? r.errorTags.filter((s): s is string => typeof s === 'string') : [],
      weaknessTags: Array.isArray(r.weaknessTags) ? r.weaknessTags.filter((s): s is string => typeof s === 'string') : [],
      advice: typeof r.advice === 'string' ? r.advice.slice(0, 500) : null,
      betterSolution: typeof r.betterSolution === 'string' ? r.betterSolution.slice(0, 500) : null,
      questionSummaries: Array.isArray(r.questionSummaries) ? r.questionSummaries.filter(isRecord).map((q, qIdx): FriendPublicReportQuestion => ({
        index: clamp(q.index, qIdx + 1, 1, 100, true),
        result: q.result === 'correct' || q.result === 'partial' || q.result === 'uncertain' ? q.result : 'incorrect',
        earliestError: typeof q.earliestError === 'string' ? q.earliestError.slice(0, 300) : null,
        errorTags: Array.isArray(q.errorTags) ? q.errorTags.filter((t): t is string => typeof t === 'string') : [],
        weaknessTags: Array.isArray(q.weaknessTags) ? q.weaknessTags.filter((t): t is string => typeof t === 'string') : [],
        advice: typeof q.advice === 'string' ? q.advice.slice(0, 300) : null,
        betterSolution: typeof q.betterSolution === 'string' ? q.betterSolution.slice(0, 300) : null,
      })) : [],
    }))
  }

  if (schemaVersion === 2 && Array.isArray(parsed.activities)) {
    publicActivities = (parsed.activities as unknown[]).filter(isRecord).map((a): FriendPublicActivity => ({
      id: typeof a.id === 'string' ? a.id : newId('act'),
      profileId: profile.profileId || profile.friendCode,
      friendCode: profile.friendCode,
      type: a.type === 'match_finished' || a.type === 'rank_up' || a.type === 'donk_burst' || a.type === 'exam_finish' ? a.type : 'daily_streak',
      title: typeof a.title === 'string' ? a.title.slice(0, 128) : '完成练习',
      content: typeof a.content === 'string' ? a.content.slice(0, 256) : '',
      timestamp: typeof a.timestamp === 'string' && validDate(a.timestamp) ? a.timestamp : exportedAt,
      questionCount: typeof a.questionCount === 'number' ? a.questionCount : undefined,
      correctCount: typeof a.correctCount === 'number' ? a.correctCount : undefined,
      accuracy: typeof a.accuracy === 'number' ? a.accuracy : undefined,
      durationSeconds: typeof a.durationSeconds === 'number' ? a.durationSeconds : undefined,
      rating: typeof a.rating === 'number' ? a.rating : undefined,
      ratingDelta: typeof a.ratingDelta === 'number' ? a.ratingDelta : undefined,
      eloDelta: typeof a.eloDelta === 'number' ? a.eloDelta : undefined,
      reportId: typeof a.reportId === 'string' ? a.reportId : undefined,
      reportAvailable: Boolean(a.reportAvailable),
    }))
  }

  const revision = typeof parsed.revision === 'number' && Number.isFinite(parsed.revision) ? parsed.revision : 1

  return {
    ok: true,
    value: {
      profile,
      exportedAt,
      hash: profileHash(profile),
      revision,
      presence,
      activities: publicActivities,
      matches: publicMatches,
      reports: publicReports,
    },
  }
}

function fileCode(fileName: string | undefined) {
  const match = fileName ? /^shuaba-friend-(.+)\.json$/i.exec(fileName.trim()) : null
  return match ? normalizeFriendCode(match[1]) : null
}

function sourceFileMatchesSnapshot(profileCode: string, sourceFileName?: string): boolean {
  return sourceFileName === undefined || fileCode(sourceFileName) === profileCode
}

export function addFriendSnapshot(
  raw: string,
  options?: { sourceFileName?: string },
): { success: boolean; message: string; friend?: FriendProfile; changed?: boolean } {
  const parsed = parseFriendSnapshot(raw)
  if (!parsed.ok) {
    const code = parsed.friendCode ?? fileCode(options?.sourceFileName)
    if (code) updateSyncState({ friendCode: code, status: 'invalid', lastError: parsed.message, lastAttemptAt: new Date().toISOString() })
    return { success: false, message: parsed.message }
  }
  const { profile, exportedAt, hash, presence, activities, matches, reports } = parsed.value
  const own = getSavedMyCustomProfile()
  if (!sourceFileMatchesSnapshot(profile.friendCode, options?.sourceFileName)) {
    const sourceCode = fileCode(options?.sourceFileName)
    const message = sourceCode
      ? `好友文件名好友码 ${sourceCode} 与快照好友码 ${profile.friendCode} 不一致，已拒绝导入`
      : '好友文件名不包含有效好友码，已拒绝导入'
    markFriendSyncStatus(sourceCode ?? profile.friendCode, 'invalid', new Date().toISOString(), message)
    return { success: false, message }
  }
  if (profile.friendCode === own.friendCode || profile.profileId === own.profileId) {
    return { success: false, message: '不能添加自己的好友卡片' }
  }
  if (options?.sourceFileName === undefined && isIdentityBlocked(profile.friendCode, profile.profileId)) {
    // 用户手动导入/粘贴该好友数据，自动解除屏蔽
    unblockIdentity(profile.friendCode, profile.profileId)
  } else if (isIdentityBlocked(profile.friendCode, profile.profileId)) {
    return { success: false, message: '该好友已被屏蔽，拒绝导入' }
  }

  const friends = getSavedFriends()
  const existing = friends.find((item) => item.friendCode === profile.friendCode || item.profileId === profile.profileId)
  const changed = existing?.lastSnapshotHash !== hash
  const now = new Date().toISOString()

  // 缓存远端传来的 matches 和 reports
  const friendKey = profile.profileId || profile.friendCode
  if (matches && matches.length > 0) {
    saveFriendCachedMatches(friendKey, matches, profile.friendCode)
  }
  if (reports && reports.length > 0) {
    saveFriendCachedReports(friendKey, reports, profile.friendCode)
  }
  if (activities && activities.length > 0) {
    for (const a of activities) {
      addFriendActivity({
        id: a.id,
        friendCode: profile.friendCode,
        nickname: profile.nickname,
        avatar: profile.avatar,
        type: a.type === 'rank_up' || a.type === 'donk_burst' || a.type === 'exam_finish' ? a.type : 'daily_streak',
        title: a.title,
        content: a.content,
        timestamp: a.timestamp,
      })
    }
  }

  const friend: FriendProfile = {
    ...profile,
    id: `friend-${profile.profileId}`,
    isSelf: false,
    syncStatus: changed ? 'synced' : 'unchanged',
    lastSyncedAt: now,
    lastSnapshotHash: hash,
    lastSnapshotExportedAt: exportedAt,
    currentActivity: presence?.currentActivity || profile.currentActivity,
    status: presence?.state ?? profile.status,
  }

  const rest = existing ? friends.filter((item) => item !== existing && item.friendCode !== profile.friendCode && item.profileId !== profile.profileId) : friends
  saveFriends([friend, ...rest])

  const codes = getSavedFriendCodes()
  const oldCode = existing?.friendCode
  writeStorage(STORAGE_KEY_FRIEND_CODES, [...new Set(codes.filter((code) => code !== oldCode).concat(profile.friendCode))])
  updateSyncState({
    friendCode: profile.friendCode,
    profileId: profile.profileId,
    status: changed ? 'synced' : 'unchanged',
    lastAttemptAt: now,
    lastSyncedAt: now,
    lastSnapshotHash: hash,
    lastSnapshotExportedAt: exportedAt,
    lastError: undefined,
  })

  return {
    success: true,
    changed,
    message: changed ? (existing ? `已更新好友「${friend.nickname}」的数据` : `已添加好友「${friend.nickname}」`) : `好友「${friend.nickname}」数据未变化`,
    friend,
  }
}

export function addFriendByCode(code: string): { success: boolean; message: string } {
  return addFriendCode(code)
}

export function removeFriendById(friendId: string): FriendProfile[] {
  const existing = getSavedFriends()
  const removed = existing.find((item) => item.id === friendId || item.profileId === friendId)
  const friends = existing.filter((item) => item !== removed)
  saveFriends(friends)
  if (removed) {
    // 写入屏蔽名单，防止由于坚果云残留文件复活
    addBlockedIdentity(removed.profileId, [removed.friendCode], '用户删除好友')
    writeStorage(
      STORAGE_KEY_FRIEND_CODES,
      getSavedFriendCodes().filter((code) => code !== removed.friendCode),
    )
    removeSyncState(removed.friendCode)
  }
  return friends
}