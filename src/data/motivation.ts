import type { MasteryChapter } from '../types'

// ==========================================
// 1. 考研初试倒计时 (D-Day Countdown)
// ==========================================

export function getExamCountdown(customTargetDate?: string): {
  days: number
  targetDateStr: string
  phaseText: string
} {
  const now = new Date()
  let targetYear = now.getFullYear()
  
  // If no custom date, calculate next December 3rd Saturday (approx Dec 19)
  let target = new Date(targetYear, 11, 19, 8, 30, 0)
  if (customTargetDate) {
    const parsed = new Date(customTargetDate)
    if (!isNaN(parsed.getTime())) target = parsed
  } else if (now.getTime() > target.getTime()) {
    target = new Date(targetYear + 1, 11, 19, 8, 30, 0)
  }

  const diffMs = target.getTime() - now.getTime()
  const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))

  let phaseText = '基础筑基期'
  if (days <= 30) {
    phaseText = '🔥 冲刺押题期'
  } else if (days <= 90) {
    phaseText = '⚡ 真题模考期'
  } else if (days <= 180) {
    phaseText = '🚀 强化拔高期'
  }

  return {
    days,
    targetDateStr: `${target.getFullYear()}年${target.getMonth() + 1}月${target.getDate()}日`,
    phaseText,
  }
}

// ==========================================
// 2. 每日心流契约 (Daily Contract)
// ==========================================

export interface DailyContract {
  date: string // YYYY-MM-DD
  goalText: string
  targetProblemCount: number
  targetMinutes: number
  isCompleted: boolean
  completedAt?: string
  claimedReward: boolean
}

const CONTRACT_KEY = 'shuaba_daily_contract'

export function getTodayDateStr(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getDailyContract(): DailyContract {
  const today = getTodayDateStr()
  try {
    const raw = localStorage.getItem(CONTRACT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.date === today) {
        return parsed
      }
    }
  } catch {
    // fallback
  }

  // Default new daily contract for today
  return {
    date: today,
    goalText: '彻底吃透今天的薄弱计算点，保持专注与规范推导',
    targetProblemCount: 5,
    targetMinutes: 25,
    isCompleted: false,
    claimedReward: false,
  }
}

export function saveDailyContract(contract: DailyContract): void {
  try {
    localStorage.setItem(CONTRACT_KEY, JSON.stringify(contract))
  } catch {
    // ignore
  }
}

export function checkContractStatus(
  contract: DailyContract,
  todayDoneCount: number,
  todayMinutes: number
): DailyContract {
  if (contract.isCompleted) return contract

  if (todayDoneCount >= contract.targetProblemCount || todayMinutes >= contract.targetMinutes) {
    const updated = {
      ...contract,
      isCompleted: true,
      completedAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    }
    saveDailyContract(updated)
    return updated
  }
  return contract
}

// ==========================================
// 3. 名师破局锦囊金句库 (Daily Math Quotes)
// ==========================================

export interface MathQuote {
  text: string
  author: string
  tag: string
}

export const DAILY_QUOTES: MathQuote[] = [
  { text: '考研数学没有奇迹，只有最基础定理用得如臂使指的熟练。', author: '名师寄语', tag: '考研心法' },
  { text: '计算能力也是核心数学素养，草稿纸的整洁度决定了考场的正确率。', author: '张宇', tag: '计算习惯' },
  { text: '线性代数是成网状结构的，把矩阵的秩、特征值、线性相关性串联起来就通了。', author: '李永乐', tag: '线代通透' },
  { text: '高等数学的灵魂在于极限定理与中值定理的几何直观与构造。', author: '武忠祥', tag: '高数破局' },
  { text: '做一道题就要彻底消化一道题的同类变式，绝不留一知半解的隐患。', author: '真题精要', tag: '复习原则' },
  { text: '数学从不欺骗努力的人，每一张写满推导的草稿纸都在为你铺路。', author: '研途激励', tag: '自驱信念' },
  { text: '分部积分法要熟记反对幂指三，表格法是提高极速的关键抓手。', author: '积分口诀', tag: '技巧心得' },
  { text: '概念不清，全盘皆输；把定理的充分条件、必要条件分辨到极致。', author: '概念深挖', tag: '考点防坑' },
  { text: '无论题目多复杂，破题的第一步永远是看清定义与核心已知条件。', author: '解题思维', tag: '破题第一步' },
  { text: '不怕难题难，就怕基础题粗心；每一分都是考场上拼下来的真金白银。', author: '考场战略', tag: '稳拿基础' },
  { text: '知其然，更知其所以然；数学的魅力在于推导逻辑的无懈可击。', author: '华罗庚', tag: '数学之美' },
  { text: '在数学的领域中，提出问题的艺术往往比解答问题的技巧更重要。', author: '康托尔', tag: '深度思考' },
]

export function getDailyQuote(): MathQuote {
  const today = getTodayDateStr()
  let hash = 0
  for (let i = 0; i < today.length; i++) {
    hash = (hash * 31 + today.charCodeAt(i)) % DAILY_QUOTES.length
  }
  return DAILY_QUOTES[hash] || DAILY_QUOTES[0]
}

// ==========================================
// 4. 个人极限记录名人堂 (Hall of Fame)
// ==========================================

export interface HallOfFameRecords {
  fastestChoiceSeconds: number | null
  maxComboStreak: number
  maxDailyProblems: number
  maxDailyMinutes: number
  totalLifetimeProblems: number
}

const HOF_KEY = 'shuaba_hall_of_fame'

export function getHallOfFame(): HallOfFameRecords {
  try {
    const raw = localStorage.getItem(HOF_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return {
    fastestChoiceSeconds: 38,
    maxComboStreak: 5,
    maxDailyProblems: 10,
    maxDailyMinutes: 45,
    totalLifetimeProblems: 25,
  }
}

export function updateHallOfFame(updates: Partial<HallOfFameRecords>): HallOfFameRecords {
  const current = getHallOfFame()
  const next: HallOfFameRecords = {
    fastestChoiceSeconds:
      updates.fastestChoiceSeconds !== undefined && updates.fastestChoiceSeconds !== null
        ? current.fastestChoiceSeconds === null
          ? updates.fastestChoiceSeconds
          : Math.min(current.fastestChoiceSeconds, updates.fastestChoiceSeconds)
        : current.fastestChoiceSeconds,
    maxComboStreak: Math.max(current.maxComboStreak, updates.maxComboStreak ?? 0),
    maxDailyProblems: Math.max(current.maxDailyProblems, updates.maxDailyProblems ?? 0),
    maxDailyMinutes: Math.max(current.maxDailyMinutes, updates.maxDailyMinutes ?? 0),
    totalLifetimeProblems: Math.max(current.totalLifetimeProblems, updates.totalLifetimeProblems ?? 0),
  }
  try {
    localStorage.setItem(HOF_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
  return next
}

// ==========================================
// 5. 数一 23 章知识领地星图 (Knowledge Territory Map)
// ==========================================

export interface TerritoryChapter {
  id: string
  name: string
  subject: '高等数学' | '线性代数' | '概率统计'
  subSections: string[]
  status: 'conquered' | 'in_progress' | 'unexplored'
  masteryScore: number
  attemptCount: number
}

export const MATH_ONE_23_CHAPTERS: Array<{
  id: string
  name: string
  subject: '高等数学' | '线性代数' | '概率统计'
  subSections: string[]
}> = [
  // 高等数学 12 章
  { id: 'm1_1', name: '函数、极限与连续', subject: '高等数学', subSections: ['极限存在准则', '等价无穷小', '间断点分类'] },
  { id: 'm1_2', name: '一元函数微分学导数与计算', subject: '高等数学', subSections: ['复合导数', '隐函数求导', '高阶导数'] },
  { id: 'm1_3', name: '微分中值定理与导数应用', subject: '高等数学', subSections: ['罗尔定理', '拉格朗日', '泰勒公式', '极值最值'] },
  { id: 'm1_4', name: '一元不定积分方法与计算', subject: '高等数学', subSections: ['换元积分法', '分部积分法', '有理函数积分'] },
  { id: 'm1_5', name: '一元定积分与反常积分', subject: '高等数学', subSections: ['变限积分求导', '定积分性质', '反常积分审敛'] },
  { id: 'm1_6', name: '定积分的几何与物理应用', subject: '高等数学', subSections: ['平面面积', '旋转体体积', '弧长与功'] },
  { id: 'm1_7', name: '常微分方程', subject: '高等数学', subSections: ['可分离变量', '一阶线性', '二阶常系数齐次/非齐次'] },
  { id: 'm1_8', name: '多元函数微分学', subject: '高等数学', subSections: ['偏导数与全微分', '多元链式法则', '方向导数与梯度'] },
  { id: 'm1_9', name: '重积分（二重与三重积分）', subject: '高等数学', subSections: ['极坐标二重积分', '对称性简化', '柱面/球面三重积分'] },
  { id: 'm1_10', name: '曲线与曲面积分', subject: '高等数学', subSections: ['格林公式', '高斯公式', '两类曲线曲面转化'] },
  { id: 'm1_11', name: '无穷级数', subject: '高等数学', subSections: ['正项级数审敛', '交错级数', '幂级数求和与展开'] },
  { id: 'm1_12', name: '向量代数与空间解析几何', subject: '高等数学', subSections: ['平面与直线方程', '空间距离与交角', '二次曲面'] },

  // 线性代数 6 章
  { id: 'l1_1', name: '行列式及其性质', subject: '线性代数', subSections: ['行列式按行展开', '特殊行列式计算', '克拉默法则'] },
  { id: 'l1_2', name: '矩阵及其运算', subject: '线性代数', subSections: ['逆矩阵与伴随', '初等变换', '分块矩阵'] },
  { id: 'l1_3', name: '向量组与线性方程组', subject: '线性代数', subSections: ['极大无关组', '向量秩', '齐次/非齐次通解'] },
  { id: 'l1_4', name: '特征值与特征向量', subject: '线性代数', subSections: ['特征多项式', '相似对角化', '实对称矩阵性质'] },
  { id: 'l1_5', name: '二次型及其标准化', subject: '线性代数', subSections: ['配方法', '正交变换法', '正定二次型判别'] },
  { id: 'l1_6', name: '线性空间与线性变换', subject: '线性代数', subSections: ['基与坐标', '过渡矩阵', '核与像'] },

  // 概率论与数理统计 5 章
  { id: 'p1_1', name: '随机事件与概率', subject: '概率统计', subSections: ['全概率与贝叶斯公式', '事件独立性', '古典概型'] },
  { id: 'p1_2', name: '一维随机变量及其分布', subject: '概率统计', subSections: ['离散与连续分布', '正态分布', '分布函数与概率密度'] },
  { id: 'p1_3', name: '多维随机变量及其分布', subject: '概率统计', subSections: ['联合与边缘分布', '条件分布', '二维正态分布'] },
  { id: 'p1_4', name: '随机变量数字特征与极限定理', subject: '概率统计', subSections: ['期望与方差', '协方差与相关系数', '中心极限定理'] },
  { id: 'p1_5', name: '数理统计基本概念与参数估计', subject: '概率统计', subSections: ['三大抽样分布', '矩估计与极大似然估计', '无偏性'] },
]

export function computeTerritories(chapters: MasteryChapter[]): {
  territories: TerritoryChapter[]
  conqueredCount: number
  totalCount: number
  conquestRate: number
} {
  const territories: TerritoryChapter[] = MATH_ONE_23_CHAPTERS.map((base) => {
    // match with chapter in database by name substring
    const matched = chapters.find(
      (c) => c.name.includes(base.name.slice(0, 4)) || base.name.includes(c.name.slice(0, 4))
    )

    const attemptCount = matched ? matched.attempted : 0
    const masteryScore = matched && matched.masteryScore !== null ? matched.masteryScore : 0

    let status: 'conquered' | 'in_progress' | 'unexplored' = 'unexplored'
    if (attemptCount >= 8 && masteryScore >= 75) {
      status = 'conquered'
    } else if (attemptCount > 0) {
      status = 'in_progress'
    }

    return {
      ...base,
      status,
      masteryScore: Math.round(masteryScore),
      attemptCount,
    }
  })

  const conqueredCount = territories.filter((t) => t.status === 'conquered').length
  const totalCount = territories.length
  const conquestRate = Math.round((conqueredCount / totalCount) * 100)

  return { territories, conqueredCount, totalCount, conquestRate }
}

// ==========================================
// 6. 15分钟高压真题闪击战评分 (Blitz Exam)
// ==========================================

export interface BlitzExamResult {
  total: number
  correctCount: number
  accuracy: number
  timeSpentSeconds: number
  speedScore: number
  rank: 'SSS' | 'S' | 'A' | 'B' | 'C'
  title: string
  feedback: string
}

export function gradeBlitzExam(
  total: number,
  correctCount: number,
  timeSpentSeconds: number,
  limitSeconds: number
): BlitzExamResult {
  const accuracy = total > 0 ? correctCount / total : 0
  const avgSecondsPerProblem = total > 0 ? timeSpentSeconds / total : 0

  // Speed bonus: if avg under 180s per problem (3 min), high speed
  const speedRatio = Math.max(0, Math.min(1, 1 - (timeSpentSeconds / limitSeconds) * 0.7))
  const speedScore = Math.round(speedRatio * 100)

  let rank: 'SSS' | 'S' | 'A' | 'B' | 'C' = 'C'
  let title = '初涉战阵'
  let feedback = '还需进一步强化做题熟练度与时间管理。'

  if (accuracy === 1 && avgSecondsPerProblem <= 150) {
    rank = 'SSS'
    title = '⚡ 秒杀之神'
    feedback = '极限手速与满分准确率！考场上的定海神针！'
  } else if (accuracy >= 0.75 && timeSpentSeconds <= limitSeconds) {
    rank = 'S'
    title = '🎯 考场尖兵'
    feedback = '高压之下依然保持了极高命中率与从容节奏。'
  } else if (accuracy >= 0.5) {
    rank = 'A'
    title = '🛡️ 稳扎稳打'
    feedback = '基础扎实，后续多针对薄弱选项进行专项提速。'
  } else if (correctCount > 0) {
    rank = 'B'
    title = '⚔️ 砥砺前行'
    feedback = '部分题目出现审题或计算断点，注意复盘第一步抓手。'
  }

  return {
    total,
    correctCount,
    accuracy,
    timeSpentSeconds,
    speedScore,
    rank,
    title,
    feedback,
  }
}
