import type { MasteryChapter } from '../types'
import { localToday } from '../utils'

export interface LevelInfo {
  level: number
  title: string
  rankBadge: string
  currentLevelExp: number
  nextLevelExp: number
  progressPct: number
}

export interface Achievement {
  id: string
  title: string
  icon: string
  category: 'volume' | 'streak' | 'mastery' | 'discipline' | 'special'
  desc: string
  requirement: string
  unlocked: boolean
  progress: number
  maxProgress: number
  unlockedAt?: string
}

export interface DailyQuest {
  id: string
  title: string
  icon: string
  desc: string
  rewardExp: number
  progress: number
  maxProgress: number
  completed: boolean
}

export interface RadarAttributes {
  calculation: number // 计算力 (0-100)
  concept: number     // 概念力 (0-100)
  algebra: number     // 代数力 (0-100)
  calculus: number    // 分析力 (0-100)
  probability: number // 概率力 (0-100)
  consistency: number // 毅力值 (0-100)
}

export interface GamificationStats {
  totalExp: number
  levelInfo: LevelInfo
  combatPower: number
  totalSolved: number
  totalCorrect: number
  accuracyPct: number
  currentStreakDays: number
  maxCombo: number
  todaySolved: number
  todayExp: number
  todayCorrect: number
  territoryConquestPct: number
  achievements: Achievement[]
  dailyQuests: DailyQuest[]
  allQuestsCompleted: boolean
  radar: RadarAttributes
}

const LEVEL_TIERS: { exp: number; title: string; badge: string }[] = [
  { exp: 0, title: '初入江湖 · 数学学徒', badge: '🥉' },
  { exp: 120, title: '初窥门径 · 初等函数行者', badge: '🥉' },
  { exp: 300, title: '小有所成 · 极限破局者', badge: '🥉' },
  { exp: 550, title: '渐入佳境 · 导数与中值定理', badge: '🥈' },
  { exp: 900, title: '拔类超群 · 一元微分大师', badge: '🥈' },
  { exp: 1350, title: '名震一方 · 积分入门猎手', badge: '🥈' },
  { exp: 1900, title: '登堂入室 · 积分换元专家', badge: '🥇' },
  { exp: 2550, title: '炉火纯青 · 一元积分领主', badge: '🥇' },
  { exp: 3300, title: '出神入化 · 行列式与矩阵宗师', badge: '🥇' },
  { exp: 4200, title: '傲视群雄 · 向量与方程主宰', badge: '💎' },
  { exp: 5250, title: '独步天下 · 相似对角化先锋', badge: '💎' },
  { exp: 6450, title: '举世无双 · 多元微分统领', badge: '💎' },
  { exp: 7800, title: '万夫莫敌 · 多元积分重器', badge: '👑' },
  { exp: 9300, title: '一代宗师 · 无穷级数圣手', badge: '👑' },
  { exp: 11000, title: '震古烁今 · 概率统计掌控者', badge: '👑' },
  { exp: 13000, title: '半步封神 · 抽样估计行家', badge: '🏆' },
  { exp: 15500, title: '登峰造极 · 数一 130+ 准战神', badge: '🏆' },
  { exp: 18500, title: '超凡入圣 · 考研数学一 140+ 传奇极客', badge: '🌟' },
]

export function calculateLevel(totalExp: number): LevelInfo {
  let tierIndex = 0
  for (let i = 0; i < LEVEL_TIERS.length; i++) {
    if (totalExp >= LEVEL_TIERS[i].exp) {
      tierIndex = i
    } else {
      break
    }
  }

  const currentTier = LEVEL_TIERS[tierIndex]
  const nextTier = LEVEL_TIERS[tierIndex + 1] || {
    exp: currentTier.exp + 3500,
    title: '数学无极宗师',
    badge: '🌟',
  }

  const level = tierIndex + 1
  const levelFloor = currentTier.exp
  const levelCeil = nextTier.exp
  const currentLevelExp = Math.max(0, totalExp - levelFloor)
  const neededForNext = levelCeil - levelFloor
  const progressPct = Math.min(100, Math.round((currentLevelExp / neededForNext) * 100))

  return {
    level,
    title: currentTier.title,
    rankBadge: currentTier.badge,
    currentLevelExp,
    nextLevelExp: neededForNext,
    progressPct,
  }
}

export function computeGamification(
  attempts: any[],
  chapters: MasteryChapter[] = [],
  savedFavoritesCount = 0
): GamificationStats {
  const todayStr = localToday()

  let totalExp = 0
  let totalSolved = 0
  let totalCorrect = 0
  let todaySolved = 0
  let todayCorrect = 0
  let todayExp = 0
  let todayReviewCorrect = 0
  let maxCombo = 0
  let currentCombo = 0
  let todayMaxCombo = 0
  let todayCurrentCombo = 0

  // Category stats for radar
  let calcAttempts = 0
  let calcCorrect = 0
  let conceptAttempts = 0
  let conceptCorrect = 0
  let algebraAttempts = 0
  let algebraCorrect = 0
  let calculusAttempts = 0
  let calculusCorrect = 0
  let probAttempts = 0
  let probCorrect = 0

  const sortedAttempts = [...attempts].sort((a, b) =>
    (a.attempted_at || a.attemptedAt || '').localeCompare(b.attempted_at || b.attemptedAt || '')
  )

  const distinctDays = new Set<string>()

  for (const att of sortedAttempts) {
    totalSolved++
    const isCorrect = att.result === 'correct'
    const attemptedTime = att.attempted_at || att.attemptedAt || ''
    const isToday = attemptedTime.startsWith(todayStr)
    const rating = att.self_rating || att.selfRating || 1
    const day = attemptedTime.slice(0, 10)
    const catPath = att.category_path || att.categoryPath || ''
    if (day) distinctDays.add(day)

    // Radar category accounting
    if (catPath.includes('计算') || catPath.includes('求导') || catPath.includes('积分')) {
      calcAttempts++
      if (isCorrect) calcCorrect++
    }
    if (catPath.includes('概念') || catPath.includes('性质') || catPath.includes('连续') || catPath.includes('审敛')) {
      conceptAttempts++
      if (isCorrect) conceptCorrect++
    }
    if (catPath.includes('线性代数') || catPath.includes('矩阵') || catPath.includes('行列式') || catPath.includes('二次型')) {
      algebraAttempts++
      if (isCorrect) algebraCorrect++
    }
    if (catPath.includes('高等数学') || catPath.includes('微分') || catPath.includes('级数') || catPath.includes('方程')) {
      calculusAttempts++
      if (isCorrect) calculusCorrect++
    }
    if (catPath.includes('概率') || catPath.includes('分布') || catPath.includes('统计') || catPath.includes('估计')) {
      probAttempts++
      if (isCorrect) probCorrect++
    }

    // Base EXP
    let exp = 20
    if (isCorrect) {
      exp += 15
      currentCombo++
      if (currentCombo > maxCombo) maxCombo = currentCombo
    } else {
      currentCombo = 0
    }

    if (rating === 3) exp += 10
    if (rating === 4) exp += 20 // instant kill blitz bonus
    if (att.mode === 'review' && isCorrect) {
      exp += 25 // revenge bonus
      if (isToday) todayReviewCorrect++
    }

    totalExp += exp
    if (isCorrect) totalCorrect++

    if (isToday) {
      todaySolved++
      todayExp += exp
      if (isCorrect) {
        todayCorrect++
        todayCurrentCombo++
        if (todayCurrentCombo > todayMaxCombo) todayMaxCombo = todayCurrentCombo
      } else {
        todayCurrentCombo = 0
      }
    }
  }

  const levelInfo = calculateLevel(totalExp)
  const accuracyPct = totalSolved > 0 ? Math.round((totalCorrect / totalSolved) * 100) : 0

  // Combat Power Index
  let chapterPower = 0
  let masteredChapters = 0
  for (const ch of chapters) {
    const score = ch.masteryScore || 0
    chapterPower += score * 12
    if (score >= 75) masteredChapters++
  }
  const combatPower = Math.round(totalExp * 1.5 + totalSolved * 8 + chapterPower)

  // Territory Conquest
  const totalChapters = Math.max(1, chapters.length)
  const conquestPct = Math.min(
    100,
    Math.round((chapters.reduce((acc, c) => acc + (c.masteryScore || 0), 0) / (totalChapters * 100)) * 100)
  )

  // 6-Dimension Radar Attributes
  const getSubjScore = (corr: number, atts: number, fallback = 35) => {
    if (atts === 0) return fallback
    const acc = corr / atts
    return Math.min(100, Math.round(acc * 70 + Math.min(30, atts * 3)))
  }

  const radar: RadarAttributes = {
    calculation: getSubjScore(calcCorrect, calcAttempts, 40),
    concept: getSubjScore(conceptCorrect, conceptAttempts, 35),
    algebra: getSubjScore(algebraCorrect, algebraAttempts, 30),
    calculus: getSubjScore(calculusCorrect, calculusAttempts, 45),
    probability: getSubjScore(probCorrect, probAttempts, 25),
    consistency: Math.min(100, Math.round(distinctDays.size * 18 + todaySolved * 3)),
  }

  // Daily Quests
  const dailyQuests: DailyQuest[] = [
    {
      id: 'daily_solve_5',
      title: '初露锋芒',
      icon: '🎯',
      desc: '今日完成 5 道数学题目推导',
      rewardExp: 60,
      progress: Math.min(5, todaySolved),
      maxProgress: 5,
      completed: todaySolved >= 5,
    },
    {
      id: 'daily_review_2',
      title: '错题清道夫',
      icon: '🛡️',
      desc: '在错题复习模式中攻克 2 道题目',
      rewardExp: 80,
      progress: Math.min(2, todayReviewCorrect),
      maxProgress: 2,
      completed: todayReviewCorrect >= 2,
    },
    {
      id: 'daily_combo_3',
      title: '手感滚烫',
      icon: '🔥',
      desc: '今日达成一次 3 连胜 Combo',
      rewardExp: 50,
      progress: Math.min(3, todayMaxCombo),
      maxProgress: 3,
      completed: todayMaxCombo >= 3,
    },
  ]

  const allQuestsCompleted = dailyQuests.every((q) => q.completed)

  // 18 Math Achievements Definition & Status
  const achievements: Achievement[] = [
    {
      id: 'first_blood',
      title: '一箭破晓',
      icon: '🎯',
      category: 'volume',
      desc: '在刷吧完成你的第 1 道真题或练习',
      requirement: '累计完成 1 道题',
      unlocked: totalSolved >= 1,
      progress: Math.min(1, totalSolved),
      maxProgress: 1,
    },
    {
      id: 'solved_10',
      title: '十步一人',
      icon: '⚔️',
      category: 'volume',
      desc: '累计完成 10 道考研数学题目推导',
      requirement: '累计完成 10 道题',
      unlocked: totalSolved >= 10,
      progress: Math.min(10, totalSolved),
      maxProgress: 10,
    },
    {
      id: 'solved_50',
      title: '半百试炼',
      icon: '🛡️',
      category: 'volume',
      desc: '在数一题海中斩获 50 道战绩',
      requirement: '累计完成 50 道题',
      unlocked: totalSolved >= 50,
      progress: Math.min(50, totalSolved),
      maxProgress: 50,
    },
    {
      id: 'solved_100',
      title: '百题斩封魔',
      icon: '🗡️',
      category: 'volume',
      desc: '累计刷题量突破 100 道大关',
      requirement: '累计完成 100 道题',
      unlocked: totalSolved >= 100,
      progress: Math.min(100, totalSolved),
      maxProgress: 100,
    },
    {
      id: 'combo_3',
      title: '势不可挡',
      icon: '🔥',
      category: 'streak',
      desc: '在做题过程中达成 3 连胜',
      requirement: '最高 Combo 连胜达到 3',
      unlocked: maxCombo >= 3,
      progress: Math.min(3, maxCombo),
      maxProgress: 3,
    },
    {
      id: 'combo_5',
      title: '超凡入圣',
      icon: '⚡',
      category: 'streak',
      desc: '在做题过程中达成 5 连绝杀',
      requirement: '最高 Combo 连胜达到 5',
      unlocked: maxCombo >= 5,
      progress: Math.min(5, maxCombo),
      maxProgress: 5,
    },
    {
      id: 'combo_10',
      title: '神乎其技',
      icon: '💥',
      category: 'streak',
      desc: '手感滚烫，连续做对 10 道题目无失误',
      requirement: '最高 Combo 连胜达到 10',
      unlocked: maxCombo >= 10,
      progress: Math.min(10, maxCombo),
      maxProgress: 10,
    },
    {
      id: 'blitz_master',
      title: '秒杀宗师',
      icon: '⏱️',
      category: 'mastery',
      desc: '累计给出 5 次自评 4 分（一眼秒杀）',
      requirement: '获得 5 次 4 分自评',
      unlocked: attempts.filter((a) => (a.self_rating || a.selfRating) === 4).length >= 5,
      progress: Math.min(5, attempts.filter((a) => (a.self_rating || a.selfRating) === 4).length),
      maxProgress: 5,
    },
    {
      id: 'review_revenge',
      title: '绝地反击',
      icon: '🔄',
      category: 'discipline',
      desc: '成功在错题复习中把错题逆转为完全掌握',
      requirement: '复习模式下做对 3 道错题',
      unlocked: attempts.filter((a) => a.mode === 'review' && a.result === 'correct').length >= 3,
      progress: Math.min(3, attempts.filter((a) => a.mode === 'review' && a.result === 'correct').length),
      maxProgress: 3,
    },
    {
      id: 'integral_lord',
      title: '积分领主',
      icon: '🏰',
      category: 'mastery',
      desc: '一元积分学章节掌握度突破 60%',
      requirement: '一元积分掌握度达到 60%',
      unlocked:
        chapters.some((c) => c.name.includes('积分') && (c.masteryScore || 0) >= 60),
      progress: Math.min(
        60,
        Math.round(
          chapters.find((c) => c.name.includes('积分'))?.masteryScore || 0
        )
      ),
      maxProgress: 60,
    },
    {
      id: 'matrix_ruler',
      title: '线代主宰',
      icon: '💎',
      category: 'mastery',
      desc: '完成至少 10 道线性代数核心题目',
      requirement: '完成 10 道线性代数题',
      unlocked: attempts.filter((a) => (a.category_path || a.categoryPath || '').includes('线性代数')).length >= 10,
      progress: Math.min(
        10,
        attempts.filter((a) => (a.category_path || a.categoryPath || '').includes('线性代数')).length
      ),
      maxProgress: 10,
    },
    {
      id: 'prob_scholar',
      title: '概率先知',
      icon: '🎲',
      category: 'mastery',
      desc: '完成至少 5 道概率论与数理统计题目',
      requirement: '完成 5 道概率统计题',
      unlocked: attempts.filter((a) => (a.category_path || a.categoryPath || '').includes('概率')).length >= 5,
      progress: Math.min(
        5,
        attempts.filter((a) => (a.category_path || a.categoryPath || '').includes('概率')).length
      ),
      maxProgress: 5,
    },
    {
      id: 'formula_collector',
      title: '博闻强识',
      icon: '📖',
      category: 'special',
      desc: '在公式速查抽屉中收藏 5 条以上核心公式',
      requirement: '收藏 5 条公式',
      unlocked: savedFavoritesCount >= 5,
      progress: Math.min(5, savedFavoritesCount),
      maxProgress: 5,
    },
    {
      id: 'daily_grind_10',
      title: '单日狂飙',
      icon: '🚀',
      category: 'discipline',
      desc: '在单日内完成 10 道题目的高强度训练',
      requirement: '单日完成 10 道题',
      unlocked: todaySolved >= 10,
      progress: Math.min(10, todaySolved),
      maxProgress: 10,
    },
    {
      id: 'streak_3_days',
      title: '持之以恒',
      icon: '📅',
      category: 'discipline',
      desc: '累计打卡练习达到 3 天',
      requirement: '打卡练习 3 天',
      unlocked: distinctDays.size >= 3,
      progress: Math.min(3, distinctDays.size),
      maxProgress: 3,
    },
    {
      id: 'accuracy_elite',
      title: '百步穿杨',
      icon: '🎖️',
      category: 'mastery',
      desc: '完成 20 题以上且总正确率保持在 70% 以上',
      requirement: '20 题以上且正确率 ≥ 70%',
      unlocked: totalSolved >= 20 && accuracyPct >= 70,
      progress: totalSolved >= 20 ? accuracyPct : Math.round((totalSolved / 20) * 70),
      maxProgress: 70,
    },
    {
      id: 'exp_500',
      title: '小试牛刀',
      icon: '🌟',
      category: 'volume',
      desc: '累计斩获 500 点战力经验值',
      requirement: '累计获得 500 EXP',
      unlocked: totalExp >= 500,
      progress: Math.min(500, totalExp),
      maxProgress: 500,
    },
    {
      id: 'exp_2000',
      title: '名动四方',
      icon: '👑',
      category: 'volume',
      desc: '累计斩获 2000 点战力经验值',
      requirement: '累计获得 2000 EXP',
      unlocked: totalExp >= 2000,
      progress: Math.min(2000, totalExp),
      maxProgress: 2000,
    },
  ]

  return {
    totalExp,
    levelInfo,
    combatPower,
    totalSolved,
    totalCorrect,
    accuracyPct,
    currentStreakDays: distinctDays.size,
    maxCombo,
    todaySolved,
    todayExp,
    todayCorrect,
    territoryConquestPct: conquestPct,
    achievements,
    dailyQuests,
    allQuestsCompleted,
    radar,
  }
}

// ============================================================================
// Web Audio API Sound FX Synthesizer (Zero External Assets, 100% Pure Synthetic)
// ============================================================================

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContextClass) audioCtx = new AudioContextClass()
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      void audioCtx.resume()
    }
    return audioCtx
  } catch {
    return null
  }
}

export function isAudioMuted(): boolean {
  try {
    return localStorage.getItem('shuaba_sound_muted') === 'true'
  } catch {
    return false
  }
}

export function setAudioMuted(muted: boolean): void {
  try {
    localStorage.setItem('shuaba_sound_muted', muted ? 'true' : 'false')
  } catch {
    // ignore
  }
}

/** Crisp ding chime on correct answer */
export function playCorrectSound(): void {
  if (isAudioMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(587.33, now) // D5
  osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.12) // A5

  gain.gain.setValueAtTime(0.18, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.35)
}

/** Epic fanfare chime on level up / chest unlock */
export function playLevelUpSound(): void {
  if (isAudioMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, now + i * 0.08)

    gain.gain.setValueAtTime(0.2, now + i * 0.08)
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.4)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now + i * 0.08)
    osc.stop(now + i * 0.08 + 0.4)
  })
}
