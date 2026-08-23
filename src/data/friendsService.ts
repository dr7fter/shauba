import type { FriendProfile, FriendActivity, FriendsSystemData, TacticalDashboardData, BootstrapData, EloStatus } from '../types'
import { predictedExamScore, rankLetterForElo } from '../utils'
import { setUserProfile } from '../api'

const STORAGE_KEY_FRIENDS = 'shuaba_friends_roster_v1'
const STORAGE_KEY_MY_PROFILE = 'shuaba_my_profile_v1'
const STORAGE_KEY_ACTIVITIES = 'shuaba_friends_activities_v1'

const DEFAULT_FRIENDS: FriendProfile[] = [
  {
    id: 'friend-1',
    friendCode: 'SHUABA-8891',
    nickname: '考研必上岸_985',
    avatar: '🎓',
    title: '定积分极速突破大师',
    targetSchool: '浙江大学 · 计算机',
    currentElo: 1885,
    peakElo: 1910,
    rankLetter: 'S',
    ratingPro: 1.38,
    predictedExamScore: 124,
    todayProblems: 14,
    totalMatches: 142,
    winRate: 62.5,
    status: 'online',
    currentActivity: '正在刷题：二重积分极坐标对称性',
    lastActiveAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    eloChangeToday: 18,
    dimensions: {
      rigor: 88,
      computation: 91,
      speed: 84,
      modeling: 86,
      methodUse: 89,
      strategyInsight: 87,
    },
  },
  {
    id: 'friend-2',
    friendCode: 'SHUABA-7723',
    nickname: '张宇汤家凤合体',
    avatar: '⚡',
    title: '矩阵特征值秒杀猎手',
    targetSchool: '清华大学 · 自动化',
    currentElo: 1760,
    peakElo: 1785,
    rankLetter: 'A+',
    ratingPro: 1.25,
    predictedExamScore: 116,
    todayProblems: 18,
    totalMatches: 198,
    winRate: 58.0,
    status: 'in_match',
    currentActivity: '高压演练中：2024数一全真模考 (第12题)',
    lastActiveAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    eloChangeToday: 25,
    dimensions: {
      rigor: 82,
      computation: 86,
      speed: 92,
      modeling: 81,
      methodUse: 85,
      strategyInsight: 83,
    },
  },
  {
    id: 'friend-3',
    friendCode: 'SHUABA-6612',
    nickname: '不考130不改名',
    avatar: '🔥',
    title: '微分方程降维打击者',
    targetSchool: '复旦大学 · 软件',
    currentElo: 1640,
    peakElo: 1690,
    rankLetter: 'A',
    ratingPro: 1.18,
    predictedExamScore: 112,
    todayProblems: 8,
    totalMatches: 110,
    winRate: 53.2,
    status: 'offline',
    currentActivity: '35分钟前完成今日复盘打卡',
    lastActiveAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    eloChangeToday: -5,
    dimensions: {
      rigor: 79,
      computation: 82,
      speed: 78,
      modeling: 84,
      methodUse: 80,
      strategyInsight: 79,
    },
  },
  {
    id: 'friend-4',
    friendCode: 'SHUABA-5509',
    nickname: '高数秒杀王',
    avatar: '👑',
    title: 'Taylor展开无解压制',
    targetSchool: '上海交大 · 电子信息',
    currentElo: 1980,
    peakElo: 2010,
    rankLetter: 'DONK',
    ratingPro: 1.58,
    predictedExamScore: 136,
    todayProblems: 22,
    totalMatches: 240,
    winRate: 68.0,
    status: 'online',
    currentActivity: '正在复盘：微分中值定理辅助函数构造',
    lastActiveAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    eloChangeToday: 32,
    dimensions: {
      rigor: 94,
      computation: 96,
      speed: 95,
      modeling: 93,
      methodUse: 97,
      strategyInsight: 95,
    },
  },
  {
    id: 'friend-5',
    friendCode: 'SHUABA-4418',
    nickname: '线代满分怪',
    avatar: '📐',
    title: '实对称正交对角化推土机',
    targetSchool: '同济大学 · 土木/智能工程',
    currentElo: 1550,
    peakElo: 1590,
    rankLetter: 'B+',
    ratingPro: 1.09,
    predictedExamScore: 98,
    todayProblems: 6,
    totalMatches: 85,
    winRate: 49.5,
    status: 'offline',
    currentActivity: '2小时前活跃',
    lastActiveAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    eloChangeToday: 0,
    dimensions: {
      rigor: 76,
      computation: 75,
      speed: 72,
      modeling: 77,
      methodUse: 78,
      strategyInsight: 74,
    },
  },
]

const DEFAULT_ACTIVITIES: FriendActivity[] = [
  {
    id: 'act-1',
    friendCode: 'SHUABA-5509',
    nickname: '高数秒杀王',
    avatar: '👑',
    type: 'donk_burst',
    title: '打出 👑 DONK 级神仙秒杀',
    content: '在「反常积分收敛性与比值判别法」解答题仅用 110 秒击破，斩获 Rating 2.24！',
    timestamp: '10分钟前',
  },
  {
    id: 'act-2',
    friendCode: 'SHUABA-8891',
    nickname: '考研必上岸_985',
    avatar: '🎓',
    type: 'rank_up',
    title: '晋升 S 极境段位',
    content: '天梯 Elo 达到 1885 分，成功晋升「S 极境」天梯段位！',
    timestamp: '25分钟前',
  },
  {
    id: 'act-3',
    friendCode: 'SHUABA-7723',
    nickname: '张宇汤家凤合体',
    avatar: '⚡',
    type: 'exam_finish',
    title: '完成全真高压模考',
    content: '耗时 160 分钟完成 2024 数一演练，考场预估分 116 分，KAST 82%！',
    timestamp: '1小时前',
  },
  {
    id: 'act-4',
    friendCode: 'SHUABA-6612',
    nickname: '不考130不改名',
    avatar: '🔥',
    type: 'daily_streak',
    title: '连续 14 天打卡里程碑',
    content: '坚持每日数一刷题与错题深度复盘，达成 14 天火热连胜标记！',
    timestamp: '2小时前',
  },
]

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
    rigor: 84,
    computation: 86,
    speed: 86,
    modeling: 87,
    methodUse: 84,
    strategyInsight: 84,
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

export function addFriendByCode(code: string): { success: boolean; message: string; friend?: FriendProfile } {
  const cleanCode = code.trim().toUpperCase()
  if (!cleanCode) {
    return { success: false, message: '好友码不能为空' }
  }

  const myProfile = getSavedMyCustomProfile()
  if (cleanCode === myProfile.friendCode.toUpperCase()) {
    return { success: false, message: '不能添加自己的专属好友码' }
  }

  const friends = getSavedFriends()
  if (friends.some((f) => f.friendCode.toUpperCase() === cleanCode)) {
    return { success: false, message: '该好友已在你的天梯好友列表中' }
  }

  // Generate a realistic peer profile for the friend code
  const mockNames = ['汤家凤亲传弟子', '李林六套卷战神', '高数重积分推土机', '宇哥真题秒杀手', '复试直通车']
  const mockAvatars = ['🎯', '✨', '🏆', '🌟', '📚']
  const randomName = mockNames[Math.floor(Math.random() * mockNames.length)]
  const randomAvatar = mockAvatars[Math.floor(Math.random() * mockAvatars.length)]
  const randomElo = 1500 + Math.floor(Math.random() * 450)
  const randomRating = 1.05 + Math.random() * 0.45

  const newFriend: FriendProfile = {
    id: `friend-${Date.now()}`,
    friendCode: cleanCode,
    nickname: randomName,
    avatar: randomAvatar,
    title: '战术研讨新队友',
    targetSchool: '考研数一目标 125+',
    currentElo: randomElo,
    peakElo: randomElo + 25,
    rankLetter: rankLetterForElo(randomElo),
    ratingPro: Math.round(randomRating * 100) / 100,
    predictedExamScore: predictedExamScore(randomRating, 80),
    todayProblems: Math.floor(Math.random() * 15) + 1,
    totalMatches: 60 + Math.floor(Math.random() * 80),
    winRate: 50 + Math.floor(Math.random() * 18),
    status: 'online',
    currentActivity: '刚刚上线，正在复习错题',
    lastActiveAt: new Date().toISOString(),
    eloChangeToday: Math.floor(Math.random() * 30) - 10,
    dimensions: {
      rigor: 75 + Math.floor(Math.random() * 20),
      computation: 75 + Math.floor(Math.random() * 20),
      speed: 75 + Math.floor(Math.random() * 20),
      modeling: 75 + Math.floor(Math.random() * 20),
      methodUse: 75 + Math.floor(Math.random() * 20),
      strategyInsight: 75 + Math.floor(Math.random() * 20),
    },
  }

  const updated = [newFriend, ...friends]
  saveFriends(updated)
  return { success: true, message: `成功添加好友「${newFriend.nickname}」！`, friend: newFriend }
}

export function removeFriendById(friendId: string): FriendProfile[] {
  const friends = getSavedFriends().filter((f) => f.id !== friendId)
  saveFriends(friends)
  return friends
}
