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
  libraryReady: boolean
  libraryDir: string
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
  summary: string
  verdict: string | null
  earliestError: string | null
  errorTags: string[]
  weaknessTags: string[]
  advice: string | null
  confidence: number
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
  confidence: number
  status: 'pending' | 'confirmed' | 'dismissed'
  createdAt: string
  paperTitle?: string | null
  paperAttempts?: Array<{ questionId: number; result: string; selfRating: number; diagnosis?: string | null }>
  batchAttempts?: BatchAttempt[]
  recommendationQuestionCount?: number | null
  recommendationBatchStatus?: RecommendationBatch['status'] | null
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

export type RewardEvent = {
  eventId: string
  rewardType: string
  amount: number
  metaJson?: string | null
  createdAt: string
}

export type RewardSummary = {
  totalClaimedExp: number
  newlyClaimed: boolean
  eventId: string
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
export type FontScaleMode = 'standard' | 'medium' | 'large'
