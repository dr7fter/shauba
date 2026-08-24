import type { FriendProfile, FriendActivity, FriendShareSnapshot, FriendsSystemData, TacticalDashboardData, BootstrapData, EloStatus, FriendSyncConfig } from '../types'
import { predictedExamScore, rankLetterForElo } from '../utils'
import { pullFriendSnapshots, publishFriendSnapshot, setUserProfile } from '../api'

const STORAGE_KEY_FRIENDS = 'shuaba_friends_roster_v1'
const STORAGE_KEY_MY_PROFILE = 'shuaba_my_profile_v1'
const STORAGE_KEY_ACTIVITIES = 'shuaba_friends_activities_v1'
const STORAGE_KEY_FRIEND_CODES = 'shuaba_friend_codes_v1'
const STORAGE_KEY_SYNC_CONFIG = 'shuaba_friend_sync_config_v1'

const DEFAULT_FRIENDS: FriendProfile[] = []

const DEFAULT_ACTIVITIES: FriendActivity[] = []

function generateRandomFriendCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const letter = letters[Math.floor(Math.random() * letters.length)]
  const num = Math.floor(1000 + Math.random() * 9000)
  return `SB-${letter}${num}`
}

export function getSavedMyCustomProfile(): {
  nickname: string
  friendCode: string
  targetSchool: string
  avatar: string
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MY_PROFILE)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (!parsed.friendCode || parsed.friendCode === 'SHUABA-9527') {
        parsed.friendCode = generateRandomFriendCode()
        localStorage.setItem(STORAGE_KEY_MY_PROFILE, JSON.stringify(parsed))
      }
      return parsed
    }
  } catch {
    // fallback
  }
  const defaultProfile = {
    nickname: 'dr7fter',
    friendCode: generateRandomFriendCode(),
    targetSchool: '考研数学一 · 目标985',
    avatar: '🚀',
  }
  try {
    localStorage.setItem(STORAGE_KEY_MY_PROFILE, JSON.stringify(defaultProfile))
  } catch {
    // ignore
  }
  return defaultProfile
}

export function saveMyCustomProfile(custom: {
  nickname: string
  friendCode?: string
  targetSchool: string
  avatar: string
}) {
  const existing = getSavedMyCustomProfile()
  const toSave = {
    ...existing,
    ...custom,
    friendCode: custom.friendCode ? custom.friendCode.trim().toUpperCase() : existing.friendCode,
  }
  localStorage.setItem(STORAGE_KEY_MY_PROFILE, JSON.stringify(toSave))
  void setUserProfile(toSave)
}

export function getSavedFriends(): FriendProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FRIENDS)
    if (raw) {
      const list = JSON.parse(raw)
      if (Array.isArray(list) && list.length > 0) return list
    }
  } catch {
    // fallback
  }
  return DEFAULT_FRIENDS
}

export function saveFriends(friends: FriendProfile[]) {
  localStorage.setItem(STORAGE_KEY_FRIENDS, JSON.stringify(friends))
}

export function getSavedFriendCodes(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FRIEND_CODES)
    const list = raw ? JSON.parse(raw) : []
    if (Array.isArray(list)) return list.filter((item): item is string => typeof item === 'string')
  } catch {
    // fallback
  }
  return getSavedFriends().map((friend) => friend.friendCode)
}

export function addFriendCode(codeInput: string): { success: boolean; message: string } {
  const code = codeInput.trim().toUpperCase()
  const ownCode = getSavedMyCustomProfile().friendCode.toUpperCase()
  if (!code || !/^[A-Z0-9_-]{2,64}$/.test(code)) return { success: false, message: '好友码格式不正确' }
  if (code === ownCode) return { success: false, message: '不能添加自己' }
  const codes = getSavedFriendCodes()
  if (!codes.includes(code)) {
    localStorage.setItem(STORAGE_KEY_FRIEND_CODES, JSON.stringify([code, ...codes]))
  }
  return { success: true, message: `已记录好友码 ${code}，等待好友首次发布数据` }
}

export function getSavedFriendSyncConfig(): FriendSyncConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SYNC_CONFIG)
    if (!raw) return null
    const config = JSON.parse(raw) as Partial<FriendSyncConfig>
    if (typeof config.endpoint !== 'string' || typeof config.username !== 'string' || typeof config.appPassword !== 'string' || typeof config.folder !== 'string') return null
    return { endpoint: config.endpoint, username: config.username, appPassword: config.appPassword, folder: config.folder }
  } catch {
    return null
  }
}

export function saveFriendSyncConfig(config: FriendSyncConfig) {
  // MVP 只保存坚果云“应用密码”，不保存主账号密码；后续可接系统凭据库。
  localStorage.setItem(STORAGE_KEY_SYNC_CONFIG, JSON.stringify(config))
}

export async function publishMyFriendSnapshot(profile: FriendProfile, config: FriendSyncConfig): Promise<string> {
  return publishFriendSnapshot(config, profile.friendCode, createFriendShareSnapshot(profile))
}

export async function syncFriendSnapshots(config: FriendSyncConfig): Promise<{ updated: number; checked: number }> {
  const codes = getSavedFriendCodes()
  if (codes.length === 0) return { updated: 0, checked: 0 }
  const remote = await pullFriendSnapshots(config, codes)
  let updated = 0
  for (const item of remote) {
    const result = addFriendSnapshot(item.payload)
    if (result.success) updated += 1
  }
  return { updated, checked: codes.length }
}

export function getSavedActivities(): FriendActivity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVITIES)
    if (raw) {
      const list = JSON.parse(raw)
      if (Array.isArray(list) && list.length > 0) return list
    }
  } catch {
    // fallback
  }
  return DEFAULT_ACTIVITIES
}

export function buildMyFriendProfile(
  tacticalData: TacticalDashboardData | null,
  bootstrapData: BootstrapData | null,
  eloStatus: EloStatus | null
): FriendProfile {
  const custom = getSavedMyCustomProfile()
  const elo = Math.round(eloStatus?.current ?? tacticalData?.profile.currentElo ?? 1600)
  const peakElo = Math.round(tacticalData?.profile.peakElo ?? elo)
  const rankLetter = tacticalData?.profile.currentRankLetter ?? rankLetterForElo(elo)
  const ratingPro = tacticalData?.profile.ratingPro ?? 1.17
  const predictedScore = predictedExamScore(ratingPro, 85)

  const dimsMap: Record<string, number> = {
    rigor: 64,
    computation: 65,
    speed: 62,
    modeling: 64,
    methodUse: 63,
    strategyInsight: 62,
  }

  if (tacticalData?.dimensions) {
    for (const d of tacticalData.dimensions) {
      if (d.key in dimsMap) {
        dimsMap[d.key] = d.value
      }
    }
  }

  return {
    id: 'my-self-profile',
    friendCode: custom.friendCode,
    nickname: custom.nickname || tacticalData?.profile.nickname || 'dr7fter',
    avatar: custom.avatar || '🚀',
    title: tacticalData?.profile.title || '一锤定音的战场收割者',
    targetSchool: custom.targetSchool || '考研数学一 · 目标985',
    currentElo: elo,
    peakElo,
    rankLetter,
    ratingPro,
    predictedExamScore: predictedScore,
    todayProblems: bootstrapData?.todayDone ?? 8,
    totalMatches: tacticalData?.profile.matches ?? 42,
    winRate: tacticalData?.profile.winRate ?? 55.0,
    status: 'online',
    currentActivity: '在线：正在研读战术数据大屏',
    lastActiveAt: new Date().toISOString(),
    eloChangeToday: Math.round(eloStatus?.lastDelta ?? 12),
    isSelf: true,
    seasonName: tacticalData?.currentSeason || 'S2',
    dimensions: {
      rigor: dimsMap.rigor,
      computation: dimsMap.computation,
      speed: dimsMap.speed,
      modeling: dimsMap.modeling,
      methodUse: dimsMap.methodUse,
      strategyInsight: dimsMap.strategyInsight,
    },
  }
}

export function loadFriendsSystemData(
  tacticalData: TacticalDashboardData | null,
  bootstrapData: BootstrapData | null,
  eloStatus: EloStatus | null
): FriendsSystemData {
  const myProfile = buildMyFriendProfile(tacticalData, bootstrapData, eloStatus)
  const friends = getSavedFriends()
  const activities = getSavedActivities()

  return {
    myProfile,
    friends,
    activities,
  }
}

export function createFriendShareSnapshot(profile: FriendProfile): string {
  const snapshot: FriendShareSnapshot = {
    schemaVersion: 1,
    kind: 'shuaba-friend-profile',
    exportedAt: new Date().toISOString(),
    profile: {
      ...profile,
      isSelf: false,
    },
  }
  return JSON.stringify(snapshot, null, 2)
}

export function addFriendSnapshot(raw: string): {
  success: boolean
  message: string
  friend?: FriendProfile
} {
  try {
    const parsed = JSON.parse(raw) as Partial<FriendShareSnapshot>
    const profile = parsed.profile
    if (
      parsed.schemaVersion !== 1 ||
      parsed.kind !== 'shuaba-friend-profile' ||
      !profile ||
      typeof profile.friendCode !== 'string' ||
      typeof profile.nickname !== 'string' ||
      typeof profile.currentElo !== 'number' ||
      !profile.dimensions
    ) {
      return { success: false, message: '这不是有效的刷吧好友卡片' }
    }

    const cleanCode = profile.friendCode.trim().toUpperCase()
    const myProfile = getSavedMyCustomProfile()
    if (!cleanCode || cleanCode === myProfile.friendCode.toUpperCase()) {
      return { success: false, message: '不能添加自己的好友卡片' }
    }

    const friends = getSavedFriends()
    const existing = friends.find((friend) => friend.friendCode.toUpperCase() === cleanCode)

    const friend: FriendProfile = {
      ...profile,
      id: `friend-${cleanCode}`,
      friendCode: cleanCode,
      nickname: profile.nickname.trim(),
      avatar: profile.avatar || '🙂',
      title: profile.title || '刷吧研友',
      targetSchool: profile.targetSchool || '暂未填写目标院校',
      status: profile.status === 'online' || profile.status === 'in_match' ? profile.status : 'offline',
      isSelf: false,
    }
    saveFriends(existing ? friends.map((item) => item.friendCode.toUpperCase() === cleanCode ? friend : item) : [friend, ...friends])
    const codes = getSavedFriendCodes()
    if (!codes.includes(cleanCode)) localStorage.setItem(STORAGE_KEY_FRIEND_CODES, JSON.stringify([cleanCode, ...codes]))
    return { success: true, message: existing ? `已更新好友「${friend.nickname}」的数据` : `已添加好友「${friend.nickname}」`, friend }
  } catch {
    return { success: false, message: '好友卡片内容无法读取，请重新导出后再试' }
  }
}

export function addFriendByCode(_code: string): { success: boolean; message: string } {
  return {
    success: false,
    message: '好友码只能用于识别好友；请让对方导出好友卡片，再在这里导入，避免伪造数据',
  }
}

export function removeFriendById(friendId: string): FriendProfile[] {
  const existing = getSavedFriends()
  const removed = existing.find((f) => f.id === friendId)
  const friends = existing.filter((f) => f.id !== friendId)
  saveFriends(friends)
  if (removed) {
    const codes = getSavedFriendCodes().filter((code) => code.toUpperCase() !== removed.friendCode.toUpperCase())
    localStorage.setItem(STORAGE_KEY_FRIEND_CODES, JSON.stringify(codes))
  }
  return friends
}
