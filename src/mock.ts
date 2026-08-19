import type { BootstrapData, CategoryNode, InboxItem, MasteryChapter, Question, RecommendedQuestion } from './types'

export const mockQuestions: Question[] = [
  {
    id: 155,
    stem: '设 $A$ 为 $n$ 阶非零矩阵，$E$ 为 $n$ 阶单位矩阵，若 $A^3=O$，则（ ）。',
    options: [
      { id: 'opt-a', label: 'A', contentMd: '$E-A$ 不可逆，$E+A$ 不可逆' },
      { id: 'opt-b', label: 'B', contentMd: '$E-A$ 不可逆，$E+A$ 可逆' },
      { id: 'opt-c', label: 'C', contentMd: '$E-A$ 可逆，$E+A$ 可逆' },
      { id: 'opt-d', label: 'D', contentMd: '$E-A$ 可逆，$E+A$ 不可逆' },
    ],
    correctAnswer: 'C',
    explanation: '由于 $A^3=O$，有 $(E-A)(E+A+A^2)=E-A^3=E$，$(E+A)(E-A+A^2)=E+A^3=E$。因此两者均可逆。',
    source: '2008 数一',
    questionType: 'single_choice',
    categoryPath: '线性代数 / 矩阵 / 逆矩阵',
    imagePaths: [], isCore: true, difficulty: 2, favorite: false,
    attempts: 1, accuracy: 0, mastery: 2, nextReview: '2026-08-13', note: null,
  },
  {
    id: 1284,
    stem: String.raw`求广义积分 $$\int_{0}^{+\infty}\frac{x}{(1+x)^3}\,\mathrm{d}x.$$`,
    options: [], correctAnswer: String.raw`$\frac12$`,
    explanation: String.raw`拆分 $x=(x+1)-1$，分别计算 $\int_0^{+\infty}(x+1)^{-2}\,dx$ 与 $\int_0^{+\infty}(x+1)^{-3}\,dx$，得到 $\frac12$。`,
    source: '1993 数二同源', questionType: 'subjective',
    categoryPath: '高等数学 / 一元积分 / 广义积分', imagePaths: [], isCore: false,
    difficulty: 2, favorite: true, attempts: 0, accuracy: null, mastery: null, nextReview: null, note: null,
  },
  {
    id: 2301,
    stem: String.raw`设随机变量 $X,Y$ 相互独立，且均服从标准正态分布，求 $P\{X+Y>0\}$。`,
    options: [], correctAnswer: String.raw`$\frac12$`,
    explanation: String.raw`$X+Y\sim N(0,2)$，其分布关于原点对称，因此概率为 $\frac12$。`,
    source: '基础例题', questionType: 'subjective', categoryPath: '概率统计 / 随机变量 / 正态分布',
    imagePaths: [], isCore: false, difficulty: 1, favorite: false, attempts: 0, accuracy: null, mastery: null, nextReview: null, note: null,
  },
]

export const mockRecommendations: RecommendedQuestion[] = mockQuestions.map((question, index) => ({
  question,
  score: 88 - index * 7,
  reason: ['到了该回看的时间，先把记忆接上', '补齐尚未触达的数一范围', '难度与当前训练节奏匹配'][index],
  reasonCode: ['due', 'explore', 'fit'][index],
}))

export const mockBootstrap: BootstrapData = {
  libraryReady: true, libraryDir: 'E:\\考研资料\\题库-大观园', questionCount: 5388, imageCount: 1306,
  todayDone: 7, todayMinutes: 38, dueCount: 16, favoriteCount: 24, inboxCount: 1, inboxFailedCount: 0,
  excludedDurationCount: 0, rewardEventsCount: 0,
  reviewIntervals: [1, 3, 7, 15],
  dailyMode: 'both', dailyProblemTarget: 20, dailyMinuteTarget: 90,
  dataDir: '本地预览', inboxDir: '本地预览', currentChapterId: 321, currentChapterName: '极限', customQueueCount: 3, supplementalQuestionCount: 0, supplementalDbPath: '本地预览/supplemental.db', activeRecommendation: null, recommendations: mockRecommendations,
}

const chapterNames = ['极限', '一元函数微分学', '一元函数积分学', '微分方程', '多元函数微分学', '二重积分', '无穷级数']
const chapterIds = [321, 322, 224, 325, 324, 326, 1064]
export const mockCategories: CategoryNode[] = [
  { id: 223, parentId: null, name: '高等数学', path: '高等数学', rootName: '高等数学', depth: 0, questionCount: 3080 },
  ...chapterNames.map((name, index) => ({ id: chapterIds[index], parentId: 223, name, path: `高等数学 / ${name}`, rootName: '高等数学', depth: 1, questionCount: 320 + index * 31 })),
  { id: 400, parentId: null, name: '线性代数', path: '线性代数', rootName: '线性代数', depth: 0, questionCount: 1240 },
  { id: 500, parentId: null, name: '概率统计', path: '概率统计', rootName: '概率统计', depth: 0, questionCount: 1068 },
  { id: 600, parentId: null, name: '历年真题', path: '历年真题', rootName: '历年真题', depth: 0, questionCount: 987 },
]

export const mockMastery: MasteryChapter[] = [
  ...chapterNames.map((name, index) => ({
    id: chapterIds[index], rootName: '高等数学', name, total: 320 + index * 31, attempted: index === 0 ? 18 : index === 1 ? 2 : 0,
    correctAttempts: index === 0 ? 14 : 1, attemptCount: index === 0 ? 20 : index === 1 ? 2 : 0,
    dueCount: index === 0 ? 3 : 0, weakCount: index === 0 ? 4 : index === 1 ? 1 : 0,
    coverage: index === 0 ? 18 / 320 : index === 1 ? 2 / 351 : 0,
    accuracy: index === 0 ? .7 : index === 1 ? .5 : null, rating: index === 0 ? 2.8 : index === 1 ? 2 : null,
    masteryScore: index === 0 ? 48 : null, evidence: index === 0 ? '覆盖 18/320 · 20 次作答' : index === 1 ? '仅 2 道证据，暂不评分' : '尚未开始',
    evidenceLevel: index === 0 ? '多次独立作答' : index === 1 ? '初步作答证据' : '无可评分证据',
    evidenceSources: index < 2 ? ['人工确认 2', '自评 18'] : [], retestCorrectCount: 0,
  })),
  { id: 2, rootName: '线性代数', name: '行列式', total: 121, attempted: 0, correctAttempts: 0, attemptCount: 0, dueCount: 0, weakCount: 0, coverage: 0, accuracy: null, rating: null, masteryScore: null, evidence: '尚未开始', evidenceLevel: '无可评分证据', evidenceSources: [], retestCorrectCount: 0 },
  { id: 602, rootName: '概率统计', name: '随机事件与概率', total: 59, attempted: 0, correctAttempts: 0, attemptCount: 0, dueCount: 0, weakCount: 0, coverage: 0, accuracy: null, rating: null, masteryScore: null, evidence: '尚未开始', evidenceLevel: '无可评分证据', evidenceSources: [], retestCorrectCount: 0 },
]

export const mockInbox: InboxItem[] = [{
  id: 1, taskId: 'SB-20260813-155-0421', kind: 'analysis', questionId: 155,
  summary: '最终结论正确，但论证中把充分条件写成了必要条件。', verdict: 'partial',
  earliestError: '从 $A^3=O$ 直接推出 $A=O$ 的一步不成立。',
  errorTags: ['推理越界'], weaknessTags: ['幂零矩阵', '可逆性判定'],
  advice: '用乘积恒等式直接构造逆矩阵，再做一道同类变式。', confidence: 0.92,
  status: 'pending', createdAt: new Date().toISOString(),
}]
