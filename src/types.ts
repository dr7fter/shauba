export type QuestionOption = {
  id: string
  label: string
  contentMd: string
}

export type Question = {
  id: number
  stem: string
  options: QuestionOption[]
  correctAnswer: string
  explanation: string
  source: string
  questionType: 'subjective' | 'single_choice' | 'multiple_choice'
  categoryPath: string
  imagePaths: string[]
  isCore: boolean
  difficulty: number
  favorite: boolean
  attempts: number
  accuracy: number | null
  mastery: number | null
  nextReview: string | null
  note: string | null
}

export type RecommendedQuestion = {
  question: Question
  score: number
  reason: string
  reasonCode: 'due' | 'weakness' | 'explore' | 'fit' | string
}

export type BootstrapData = {
  libraryDir: string
  libraryReady: boolean
  questionCount: number
  imageCount: number
  todayDone: number
  todayMinutes: number
  dueCount: number
  favoriteCount: number
  inboxCount: number
  inboxFailedCount: number
  reviewIntervals: number[]
  dailyMode: 'problems' | 'minutes' | 'both'
  dailyProblemTarget: number
  dailyMinuteTarget: number
  dataDir: string
  inboxDir: string
  currentChapterId: number | null
  currentChapterName: string | null
  currentFocusCategoryIds?: number[]
  customQueueCount: number
  supplementalQuestionCount: number
  supplementalDbPath: string
  activeRecommendation: RecommendationBatch | null
  recommendations: RecommendedQuestion[]
  excludedDurationCount: number
  rewardEventsCount: number
}

export type RecommendationBatch = {
  taskId: string
  title: string
  summary: string
  recommendationReason: string
  status: 'pending' | 'active' | 'paused' | 'dismissed' | 'completed'
  createdAt: string
  totalCount: number
  completedCount: number
  remainingCount: number
}

export type CategoryNode = {
  id: number
  parentId: number | null
  name: string
  path: string
  rootName: string
  depth: number
  questionCount: number
}

export type QuestionPage = {
  items: Question[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export type MasteryChapter = {
  id: number
  name: string
  rootName: string
  total: number
  attempted: number
  correctAttempts: number
  attemptCount: number
  dueCount: number
  weakCount: number
  coverage: number
  accuracy: number | null
  rating: number | null
  masteryScore: number | null
  evidence: string
  evidenceLevel: string
  evidenceSources: string[]
  retestCorrectCount: number
}

export type MasteryNode = {
  id: number
  parentId: number | null
  chapterId: number
  name: string
  path: string
  depth: number
  total: number
  attempted: number
  attemptCount: number
  dueCount: number
  weakCount: number
  coverage: number
  accuracy: number | null
  rating: number | null
  masteryScore: number | null
  evidenceLevel: string
  evidenceSources: string[]
  retestCorrectCount: number
}

export type ReviewDay = {
  date: string
  count: number
  correctCount: number
}

export type ReviewHistoryItem = {
  attemptId: number
  questionId: number
  attemptedAt: string
  stem: string
  categoryPath: string
  source: string
  result: AttemptOutcome
  selfRating: number
}

export type ReviewHistory = {
  days: ReviewDay[]
  items: ReviewHistoryItem[]
}

export type ReviewPlanItem = {
  questionId: number
  stem: string
  categoryPath: string
  source: string
  scheduledDate: string
  nextReview: string
  selfRating: number
}

export type ReviewPlan = {
  days: Array<{ date: string; count: number }>
  items: ReviewPlanItem[]
}

export type BatchAttempt = {
  questionId: number
  result: 'correct' | 'wrong' | 'uncertain'
  selfRating: number
  durationSeconds?: number
  summary: string
  verdict: string | null
  earliestError: string | null
  errorTags: string[]
  weaknessTags: string[]
  advice: string | null
  betterSolution?: string | null
  confidence: number
  rating?: number | null
  ratingTier?: string | null
  difficultyMultiplier?: number | null
  dimensions?: RatingDimensions | null
}

export type RatingDimension = {
  score: number | null
  confidence: number
  evidence: string
  advice?: string | null
  techniqueLevel?: number | null
  independentDiscovery?: 'confirmed' | 'uncertain' | 'prompted' | null
}

export type RatingDimensions = Partial<Record<
  'rigor' | 'computation' | 'modeling' | 'methodUse' | 'speed' | 'strategyInsight',
  RatingDimension
>>

export type EloHistoryPoint = {
  date: string
  rating: number
}

export type EloStatus = {
  current: number
  settlements: number
  calibrated: boolean
  lastDelta: number | null
  /** 正数=连胜次数，负数=连败次数 */
  streak: number
  protectionLeft: number
  history: EloHistoryPoint[]
}

export type ScoreboardQuestion = {
  questionId: number
  stem: string
  outcome: string
  rating: number
  durationSeconds: number
  impact: number | null
}

export type SessionScoreboard = {
  weScore: number | null
  questions: ScoreboardQuestion[]
  mvpQuestionId: number | null
  longestStreak: number
  fastestKillQuestionId: number | null
  eloDelta: number
  totalDuration: number
  correctCount: number
  totalCount: number
}

export type SeasonRecord = {
  seasonName: string
  startedAt: string
  endedAt: string
  peakRating: number
  finalRating: number
  rankIndex: number
}

export type SeasonStatus = {
  name: string
  index: number
  startedAt: string
  currentElo: number
  history: SeasonRecord[]
}

export type TagClosure = {
  tag: string
  questionCount: number
  recentCorrect: number
  recentTotal: number
  beforeCorrect: number
  beforeTotal: number
  delta: number | null
}

export type RatingBucket = { floor: number; count: number }

export type DimensionAverages = {
  rigor: number | null
  computation: number | null
  modeling: number | null
  methodUse: number | null
  speed: number | null
  strategyInsight: number | null
  sample: number
}

export type RatingDistribution = {
  buckets: RatingBucket[]
  mean: number | null
  sd: number | null
  count: number
  p95: number | null
  above130: number
  below070: number
  drift: boolean
  dimensions: DimensionAverages | null
}

export type InboxItem = {
  id: number
  taskId: string
  kind: 'analysis' | 'recommendation' | 'paper' | 'batch'
  questionId: number | null
  summary: string
  verdict: string | null
  earliestError: string | null
  errorTags: string[]
  weaknessTags: string[]
  advice: string | null
  betterSolution?: string | null
  confidence: number
  status: 'pending' | 'confirmed' | 'dismissed'
  createdAt: string
  paperTitle?: string | null
  paperAttempts?: Array<{ questionId: number; result: string; selfRating: number; diagnosis?: string | null }>
  batchAttempts?: BatchAttempt[]
  recommendationQuestionCount?: number | null
  recommendationBatchStatus?: RecommendationBatch['status'] | null
  rating?: number | null
  ratingTier?: string | null
  difficultyMultiplier?: number | null
  dimensions?: RatingDimensions | null
}

export type CodexTask = {
  taskId: string
  questionId: number | null
  questionCount: number
  prompt: string
  inboxDir: string
  outputFile: string
}

export type InsightPoint = {
  name: string
  attempts: number
  accuracy: number
  averageRating: number
}

export type WeaknessTagStat = {
  tag: string
  count: number
  recentCount: number
  lastSeen: string
}

export type WeaknessTagCount = {
  tag: string
  count: number
}

export type WeaknessTrendPoint = {
  date: string
  errorTags: WeaknessTagCount[]
  weaknessTags: WeaknessTagCount[]
}

export type WeaknessRadar = {
  errorTags: WeaknessTagStat[]
  weaknessTags: WeaknessTagStat[]
  trend: WeaknessTrendPoint[]
}

export type FailedInboxItem = {
  fileName: string
  error: string
}

export type ExportResult = {
  dbPath: string
  jsonPath: string
}

export type InboxSummary = {
  pendingCount: number
  failedCount: number
  lastProcessedTaskId: string | null
}

export type DailyTrendPoint = {
  date: string
  attempts: number
  correct: number
  rating: number | null
}

export type UserStreak = {
  currentStreak: number
  bestStreak: number
}

export type DailyLogDay = {
  date: string
  count: number
  correctCount: number
}

export type DailyLogItem = {
  questionId: number
  stem: string
  categoryPath: string
  source: string
  result: AttemptOutcome
  selfRating: number
  mode: string | null
  attemptedAt: string
  aiVerdict: string | null
  aiSummary: string | null
  aiEarliestError: string | null
  aiErrorTags: string[]
  aiWeaknessTags: string[]
  aiAdvice: string | null
  aiConfidence: number | null
  aiConfirmedAt: string | null
}

export type DailyLog = {
  days: DailyLogDay[]
  items: DailyLogItem[]
}

export type AttemptOutcome = 'correct' | 'partial' | 'wrong' | 'uncertain'

export type EvidenceSource = 'digital_answer' | 'self_report' | 'codex' | 'manual_confirmed' | 'legacy'

export type ErrorBreakpoint = {
  id: string
  label: string
  desc: string
}

export type BackupInfo = {
  fileName: string
  path: string
  sizeBytes: number
  createdAt: string
  backupType: 'startup_rolling' | 'pre_restore' | 'manual_export' | string
}

export type RestoreResult = {
  success: boolean
  preRestoreBackupPath: string
  message: string
  restoredAttempts: number
  restoredProgress: number
}

export type PracticeSessionState = {
  queue: RecommendedQuestion[]
  currentIndex: number
  attemptMode: 'paper' | 'review'
  savedAt: string
}

export type ThemeMode = 'light' | 'warm' | 'dark' | 'system'

// 压力模拟模式
export type PressureAnswer = {
  questionId: number
  userAnswer: string
  submitTime?: number
  duration: number
}

export type PressureSession = {
  sessionId: string
  mode: 'pressure'
  questionIds?: number[]
  startTime: number
  endTime: number | null
  totalDuration: number
  questions: PressureAnswer[]
  taskId?: string | null
  status: 'ongoing' | 'awaiting_codex' | 'submitted' | 'graded' | 'graded_partial' | 'abandoned'
  createdAt: number
}

export type QuestionGrade = {
  questionId: number
  correct: boolean
  userAnswer: string
  correctAnswer: string
  feedback: string
  duration: number
  result?: 'correct' | 'wrong' | 'uncertain'
  verdict?: 'correct' | 'partial' | 'incorrect' | 'uncertain' | null
  selfRating?: number | null
  earliestError?: string | null
  errorTags?: string[]
  weaknessTags?: string[]
  advice?: string | null
  betterSolution?: string | null
  confidence?: number | null
  rating?: number | null
  ratingTier?: string | null
  difficultyMultiplier?: number | null
  dimensions?: RatingDimensions | null
}

export type GradingSummary = {
  correctCount: number
  totalCount: number
  accuracy: number
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  partialCount?: number
  wrongCount?: number
  uncertainCount?: number
  gradedCount?: number
  totalDuration?: number
  averageDuration?: number
}

export type GradingReport = {
  sessionId: string
  sourceTaskId?: string | null
  status?: 'graded' | 'graded_partial'
  questionIds?: number[]
  ungradedQuestionIds?: number[]
  grades: QuestionGrade[]
  summary: GradingSummary
  confirmedAt?: number | null
  createdAt: number
}
export type FontScaleMode = 'standard' | 'medium' | 'large'
export type View = 'today' | 'library' | 'review' | 'mastery' | 'insights' | 'settings'
export type AttemptMode = 'paper' | 'review'
