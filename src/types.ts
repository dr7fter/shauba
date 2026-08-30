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
  /** AI 给这道题指定的角色（diagnosis / method_choice / consolidate /
   *  integration / transfer / timed / challenge / review），
   *  仅 AI 题组的题目有值，做题时显示为题号旁的角色徽章。 */
  questionRole?: string | null
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
  resultContextPath?: string | null
  resultExportedAt?: string | null
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

export type TacticalProfile = {
  nickname: string
  title: string
  combatPower: number
  currentElo: number
  peakElo: number
  currentRankLetter: string
  peakRankLetter: string
  weScore: number
  ratingPro: number
  matches: number
  winRate: number
  headshotRate: number
  adr: number
  kdRatio: number
  rws: number
  firepower: number
  kastRate: number
}

export type AttemptHighlight = {
  kind: 'donk' | 'ace' | 's1mple' | 'clutch' | 'redeem' | 'zywoo'
  rating: number
}

export type SeasonPoint = { date: string; rating: number }
export type SeasonSummary = {
  weekStart: string
  startRating: number
  endRating: number
  delta: number
  settlements: number
}
export type SeasonLadder = {
  weekStart: string
  weekStartRating: number | null
  weekCurrentRating: number | null
  weekDelta: number | null
  weekPoints: SeasonPoint[]
  seasons: SeasonSummary[]
  allPoints: SeasonPoint[]
}
export type ProgressComparison = {
  questionId: number
  stem: string
  categoryPath: string
  wrongDuration: number
  correctDuration: number
  fixedAt: string
}

export type UndoLastAttemptResult = {
  question: Question
  removedEloDelta: number | null
}

export type ConfirmInboxResult = {
  appliedAttempts: number
  appliedCorrect: number
  highlight: AttemptHighlight | null
}

export type PeriodBucket = {
  attempted: number
  correct: number
  partial: number
  /** 正确率（百分比，一位小数） */
  accuracy: number
  avgRating: number | null
  totalDuration: number
  bestStreak: number
  distinctQuestions: number
}

export type PeriodOverview = {
  days: number | null
  current: PeriodBucket
  previous: PeriodBucket
  longestActiveStreakDays: number
  bestDayCount: number
  firstDonkAt: string | null
  redeemedCount: number
  coveragePercent: number
  questionCount: number
}

export type HighlightMoment = {
  attemptId: number
  questionId: number
  stem: string
  categoryPath: string
  questionType: string
  durationSeconds: number
  benchmarkSeconds: number
  rating: number
  attemptedAt: string
  techniqueLevel: number | null
  difficultyMultiplier: number | null
  rigor: number | null
  computation: number | null
  modeling: number | null
  methodUse: number | null
  speed: number | null
  strategyInsight: number | null
}

export type TacticalMapSubject = {
  id: string
  name: string
  mapAlias: string
  totalQuestions: number
  attemptedCount: number
  correctCount: number
  winRate: number
  ratingPro: number
  adr: number
  avgKills: number
  firepower: number
  ctWinRate: number
  tWinRate: number
  masteryGrade: string
}

export type TacticalAbilitySkill = {
  id: string
  label: string
  icon: string
  grade: string
  score: number
  desc: string
}

export type TacticalDimension = {
  key: string
  label: string
  value: number
}

export type TacticalWeapon = {
  id: string
  name: string
  alias: string
  methodName: string
  killTime: number
  killTimeGrade: string
  kills: number
  totalAttempts: number
  sprayAccuracy: number
  sprayGrade: string
  headshotRate: number
  headshotGrade: string
  quickStopRate: number
  quickStopGrade: string
  avgKills: number
  avgKillsGrade: string
}

export type TacticalDashboardData = {
  profile: TacticalProfile
  mapSubjects: TacticalMapSubject[]
  dimensions: TacticalDimension[]
  specialtySkills: TacticalAbilitySkill[]
  weapons: TacticalWeapon[]
  currentSeason: string
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
  goal?: string | null
  estimatedMinutes?: number | null
  questionRoles?: Record<string, string>
  recommendationOrder?: number[]
  coverage?: Array<{ knowledge?: string; questionIds?: number[]; priority?: string }>
  noveltyPlan?: string[]
  successCriteria?: string[]
  fallbackPlan?: string | null
  recommendedQuestionIds?: number[]
  recommendationReason?: string | null
}

export type LearningTaskInput = {
  request: string
  availableMinutes: number
  categoryId?: number | null
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
export type LearningCenterTrack =
  | 'repair'
  | 'consolidate'
  | 'transfer'
  | 'challenge'

export type LearningCenterLoadingState =
  | 'idle'
  | 'loading'
  | 'refreshing'
  | 'ready'
  | 'empty'
  | 'error'

export type LearningConfidenceState =
  | 'unknown'
  | 'low'
  | 'medium'
  | 'high'
  | 'conflict'

export type LearningSkillState =
  | 'unseen'
  | 'exposed'
  | 'diagnosed'
  | 'learning'
  | 'unstable'
  | 'stable'
  | 'decaying'
  | 'remediating'
  | 'uncertain'

export type LearningNextAction =
  | 'move_on'
  | 'quick_retry'
  | 'recall'
  | 'review_concept'
  | 'practice_similar'
  | 'practice_variant'
  | 'timed_retry'
  | 'schedule_delayed_review'
  | 'manual_check'
  | 'open_report'

export type LearningLedger = 'training' | 'competitive' | 'incentive'

export type LearningMetricKey =
  | 'mastery'
  | 'fluency'
  | 'transfer'
  | 'retention'
  | 'confidence'

export type LearningMetric = {
  key: LearningMetricKey
  value: number | null
  state: 'unseen' | 'initial' | 'unstable' | 'stable' | 'risk' | 'conflict'
  evidenceCount: number
  lastEvidenceAt: string | null
  delta: number | null
  deltaReason: string | null
  description: string
}

export type LearningEvidenceRef = {
  id: string
  source: 'attempt' | 'review' | 'variant' | 'delayed_review' | 'pressure' | 'codex' | string
  questionId: number | null
  attemptId: number | null
  sessionId: string | null
  observedAt: string
  confidence: number | null
  accepted: boolean
  note: string | null
}

export type LearningObjectiveStatus =
  | 'not_started'
  | 'in_progress'
  | 'temporarily_passed'
  | 'stable_completed'
  | 'blocked'
  | 'skipped'

export type LearningObjective = {
  id: string
  order: 1 | 2 | 3
  track: LearningCenterTrack
  title: string
  categoryId: number | null
  categoryPath: string | null
  status: LearningObjectiveStatus
  estimatedMinutes: number
  plannedItemCount: number
  completedItemCount: number
  whyNow: string
  evidenceIds: string[]
  successCriteria: string
  nextAction: LearningNextAction
  questionIds: number[]
  isUserPinned: boolean
  blockedReason: string | null
}

export type RecommendationReason = {
  track: LearningCenterTrack
  targetCategoryId: number | null
  evidenceText: string
  goalText: string
  successCriteria: string
  sourceEvidenceIds: string[]
  confidence: number | null
}

export type LearningRecommendation = {
  id: string
  questionId: number | null
  title: string
  categoryPath: string | null
  track: LearningCenterTrack
  score: number
  estimatedMinutes: number
  state: 'available' | 'completed' | 'deferred' | 'invalid' | 'blocked' | 'ready'
  reason: RecommendationReason
  variantOfQuestionId: number | null
  isDifferentQuestion: boolean
  isDifferentStructure: boolean
  actions: Array<'start' | 'replace' | 'defer' | 'open_detail'>
}

export type MistakeChainStage =
  | 'exposed'
  | 'diagnosed'
  | 'recall'
  | 'original_retry'
  | 'similar_check'
  | 'transfer_check'
  | 'delayed_review'
  | 'closed'
  | 'remediating'
  | 'uncertain'
  | 'manual_check'

export type MistakeChain = {
  id: string
  categoryId: number | null
  categoryPath: string
  label: string
  errorClass: 'aiming' | 'concept' | 'tactics' | 'mixed' | 'uncertain'
  stage: MistakeChainStage
  statusLabel: string
  firstExposedAt: string
  lastObservedAt: string
  nextReviewAt: string | null
  repeatedCount: number
  evidenceCount: number
  confidence: number | null
  earliestError: string | null
  advice: string | null
  nextAction: LearningNextAction
  originalRetryPassed: boolean
  similarPassed: boolean
  transferPassed: boolean
  delayedReviewPassed: boolean
  stableClosedAt: string | null
  relapseAt: string | null
  blockedReason: string | null
}

export type TrainingLedgerSummary = {
  todayProblems: number
  todayMinutes: number
  weeklyProblems: number
  weeklyMinutes: number
  dueReviews: number
  activeMistakeChains: number
  stableClosedChains: number
  variantPasses: number
  delayedReviewPasses: number
  incentiveAvailable: boolean
  xpThisWeek: number | null
  achievements: Array<{ id: string; label: string; earnedAt: string }> | null
}

export type CompetitiveLedgerSummary = {
  rating: number | null
  elo: number | null
  rank: string | null
  seasonName: string | null
  settlementCount: number
  lastDelta: number | null
  lastMatchAt: string | null
  validPressureSessions: number
  pendingSettlementCount: number
  note: string
}

export type IncentiveLedgerSummary = {
  available: boolean
  xp: number | null
  level: number | null
  streakDays: number | null
  weeklyGoalCompleted: number | null
  weeklyGoalTotal: number | null
  recentAchievements: string[]
  note?: string | null
}

export type FriendBroadcastEvent = {
  id: string
  friendProfileId: string
  friendName: string
  eventType:
    | 'pressure_settled'
    | 'mistake_closed'
    | 'variant_passed'
    | 'delayed_review_passed'
    | 'review_streak'
    | 'real_match_conversion'
    | 'daily_objectives_completed'
    | 'report_published'
    | string
  occurredAt: string
  title: string
  summary: string
  publicCategoryPath: string | null
  ratingDelta: number | null
  eloDelta: number | null
  xpDelta: number | null
  reportId: string | null
  privacy: 'public_summary' | 'private' | 'redacted' | string
}

export type LearningSectionError = {
  section: string
  message: string
  code?: string | null
}

export type LearningIntegrity = {
  stableGateStatus?: 'blocked' | 'accepted' | 'degraded' | string
  stableGateReasons?: string[]
  acceptedEvidenceCount?: number
  lowConfidenceEvidenceCount?: number
  uncertainEvidenceCount?: number
  structuredVariantEvidence?: boolean
  structuredDelayedReviewEvidence?: boolean
  /** Compatibility fields for older snapshots. */
  status?: 'ok' | 'degraded' | 'error' | string
  message?: string | null
  evidenceCount?: number | null
  projectionVersion?: string | null
}

export type LearningCenterNavigationTarget =
  | { type: 'today'; questionId?: number | null; objectiveId?: string; queueQuestionIds?: number[] }
  | { type: 'review'; questionId?: number | null; mistakeChainId?: string }
  | { type: 'mastery'; categoryId?: number | null }
  | { type: 'insights' }
  | { type: 'pressure'; sessionId?: string | null }
  | { type: 'report'; sessionId: string }
  | { type: 'friends'; friendProfileId?: string | null }
  | { type: 'batch_grade'; questionIds: number[] }

export type LearningCenterFeatureFlags = {
  learningCenterV1: boolean
  learningEvidenceProjectionV1: boolean
  lowConfidenceGateV1: boolean
  nonPressureBatchGradingV1: boolean
  shadowRecommendationPlanV1: boolean
  rankedOnlyEloV1: boolean
  friendBroadcastsV1: boolean
  aiRecommendationV1?: boolean
  recommendationValidatorV1?: boolean
  learningGroupV1?: boolean
}

export type LearningCenterData = {
  generatedAt: string
  today: {
    date: string
    objectives: LearningObjective[]
    completedCount: number
    totalCount: number
    completedMinutes: number
    plannedMinutes: number
  }
  recommendations: {
    weights: Record<LearningCenterTrack, number>
    items: LearningRecommendation[]
    emptyReason?: string | null
  }
  metrics: LearningMetric[]
  mistakeChains: MistakeChain[]
  training: TrainingLedgerSummary
  competitive: CompetitiveLedgerSummary
  incentive: IncentiveLedgerSummary
  friendEvents: FriendBroadcastEvent[]
  capabilities: {
    canBatchGradeDrafts: boolean
    canOpenPressureReport: boolean
    canOpenExistingMasteryMap: boolean
    canOpenExistingReviewView: boolean
    canReadFriendEvents: boolean
    structuredVariantEvidence: boolean
    structuredDelayedReviewEvidence: boolean
    canReadIncentiveLedger: boolean
    rankedOnlyCompetitiveLedger: boolean
  }
}

export type LearningCenterSnapshot = LearningCenterData & {
  schemaVersion?: number
  recentEvidence?: LearningEvidenceRef[] | null
  integrity?: LearningIntegrity | string | null
  sectionErrors?: LearningSectionError[] | Record<string, string | null> | null
  /** Compatibility name for backends that expose the shadow plan explicitly. */
  shadowPlan?: LearningCenterData['recommendations'] & { isShadow?: boolean }
}

export type FontScaleMode = 'standard' | 'medium' | 'large'
export type View = 'today' | 'mistakes' | 'library' | 'review' | 'mastery' | 'insights' | 'friends' | 'learning' | 'settings'
export type AttemptMode = 'paper' | 'review'

export type MistakeTimelineItem = {
  attemptId: number
  questionId: number
  stem: string
  categoryPath: string
  questionType: string
  difficulty: number
  attemptedAt: string
  durationSeconds: number
  result: string
  outcome?: string | null
  earliestError?: string | null
  advice?: string | null
  mastery?: number | null
  favorite: boolean
}

export type MistakeDayGroup = {
  date: string
  displayDate: string
  totalCount: number
  items: MistakeTimelineItem[]
}

export type TodayAttemptItem = {
  attemptId: number
  questionId: number
  outcome: 'correct' | 'wrong' | 'uncertain' | string
  selfRating: number
  durationSeconds: number
  attemptedAt: string
  sessionId: string | null
  question: Question
}

export type AppUpdateInfo = {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
  releaseName?: string | null
  releaseNotes?: string | null
  publishedAt?: string | null
  htmlUrl?: string | null
  setupDownloadUrl?: string | null
  zipDownloadUrl?: string | null
  sourceDownloadUrl?: string | null
}

export type UserProfileSettings = {
  nickname: string
  friendCode?: string | null
  targetSchool?: string | null
  avatar?: string | null
}

export type FriendDimensions = {
  rigor: number
  computation: number
  speed: number
  modeling: number
  methodUse: number
  strategyInsight: number
}

export type FriendProfile = {
  id: string
  /** 稳定的本机/好友身份；好友码修改后仍保持不变。 */
  profileId?: string
  friendCode: string
  nickname: string
  avatar: string
  title: string
  targetSchool: string
  currentElo: number
  peakElo: number
  rankLetter: string
  ratingPro: number
  predictedExamScore: number
  todayProblems: number
  totalMatches: number
  winRate: number
  status: FriendPresenceState
  currentActivity?: string | null
  lastActiveAt: string
  dimensions: FriendDimensions
  isSelf?: boolean
  eloChangeToday?: number
  seasonName?: string
  /** 以下字段只用于本地同步状态，不会被好友快照公开。 */
  syncStatus?: FriendSyncStatus
  lastSyncedAt?: string
  lastSnapshotHash?: string
  lastSnapshotExportedAt?: string
  lastSyncError?: string
}

export type FriendSyncStatus = 'pending' | 'synced' | 'unchanged' | 'failed' | 'invalid'

export type FriendSyncState = {
  friendCode: string
  profileId?: string
  status: FriendSyncStatus
  lastAttemptAt?: string
  lastSyncedAt?: string
  lastSnapshotHash?: string
  lastSnapshotExportedAt?: string
  lastError?: string
}

export type FriendActivity = {
  id: string
  friendCode: string
  nickname: string
  avatar: string
  type: 'rank_up' | 'donk_burst' | 'exam_finish' | 'daily_streak'
  title: string
  content: string
  timestamp: string
}

export type FriendsSystemData = {
  myProfile: FriendProfile
  friends: FriendProfile[]
  activities: FriendActivity[]
}

export type FriendPresenceState =
  | 'online'
  | 'in_match'
  | 'idle'
  | 'offline'
  | 'unknown'

export type FriendPresence = {
  state: FriendPresenceState
  currentActivity?: string | null
  currentMatchId?: string | null
  heartbeatAt: string
  expiresAt: string
}

export type FriendPublicActivity = {
  id: string
  profileId: string
  friendCode: string
  type:
    | 'match_finished'
    | 'rank_up'
    | 'donk_burst'
    | 'exam_finish'
    | 'daily_streak'
  title: string
  content: string
  timestamp: string

  matchId?: string
  questionCount?: number
  correctCount?: number
  accuracy?: number
  durationSeconds?: number

  rating?: number
  ratingDelta?: number
  eloDelta?: number

  reportId?: string
  reportAvailable?: boolean
}

export type FriendPublicMatch = {
  publicMatchId: string
  startedAt: string
  finishedAt: string
  mode: string
  title?: string

  questionCount: number
  correctCount: number
  accuracy: number
  durationSeconds: number

  rating: number
  ratingDelta?: number
  eloBefore?: number
  eloAfter?: number
  eloDelta?: number

  result: 'win' | 'loss' | 'mixed' | 'uncertain'
  reportId?: string
  reportAvailable: boolean
}

export type FriendPublicReportQuestion = {
  index: number
  result: 'correct' | 'partial' | 'incorrect' | 'uncertain'
  earliestError?: string | null
  errorTags: string[]
  weaknessTags: string[]
  advice?: string | null
  betterSolution?: string | null
}

export type FriendPublicReport = {
  reportId: string
  publicMatchId: string
  createdAt: string

  summary: string
  rating: number
  accuracy: number
  durationSeconds: number

  dimensions?: FriendDimensions
  strengths: string[]
  weaknesses: string[]
  errorTags: string[]
  weaknessTags: string[]

  advice?: string | null
  betterSolution?: string | null

  questionSummaries: FriendPublicReportQuestion[]
}

export type FriendShareSnapshot = {
  schemaVersion: 1
  kind: 'shuaba-friend-profile'
  exportedAt: string
  profile: FriendProfile
  snapshotId?: string
}

export type FriendShareSnapshotV2 = {
  schemaVersion: 2
  kind: 'shuaba-friend-public'
  snapshotId: string
  profileId: string
  friendCode: string
  revision: number
  exportedAt: string

  profile: FriendProfile
  presence: FriendPresence
  activities: FriendPublicActivity[]
  matches: FriendPublicMatch[]
  reports: FriendPublicReport[]
  challengeGroups?: FriendChallengeGroup[]
}

export type FriendChallengeGroup = {
  id: string
  title: string
  questionIds: number[]
  createdAt: string
  senderProfileId: string
  senderNickname: string
}

export type BlockedFriendIdentity = {
  profileId?: string
  friendCodes: string[]
  blockedAt: string
  reason?: string
}

export type FriendInvitationPayload = {
  schemaVersion: 1
  kind: 'shuaba-friend-invitation'
  endpoint: string
  folder: string
  friendCode: string
  profileId: string
  nickname: string
  avatar: string
  createdAt: string
}

export type FriendSyncConfig = {
  endpoint: string
  username: string
  appPassword: string
  folder: string
}

export type FriendSyncRemoteSnapshot = {
  fileName: string
  payload: string
  serverEtag?: string | null
  unchanged?: boolean
}

export type FriendSyncResult = {
  /** 保留字段，表示本次实际发生变化的好友数。 */
  updated: number
  /** 本次尝试检查的好友码/远端文件数。 */
  checked: number
  unchanged: number
  pending: number
  invalid: number
  unrecognizedFiles: number
  failedFiles: string[]
}
