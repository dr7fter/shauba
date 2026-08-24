import { invoke } from '@tauri-apps/api/core'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { mockBootstrap, mockCategories, mockInbox, mockMastery, mockQuestions, mockRecommendations } from './mock'
import type { BootstrapData, CategoryNode, CodexTask, DailyLog, DailyTrendPoint, EloStatus, TagClosure, ExportResult, FailedInboxItem, InboxItem, InboxSummary, InsightPoint, MasteryChapter, MasteryNode, PracticeSessionState, Question, QuestionPage, RatingDistribution, RecommendationBatch, RecommendedQuestion, ReviewHistory, ReviewPlan, SeasonStatus, SessionScoreboard, UserStreak, WeaknessRadar, PressureSession, GradingReport, TacticalDashboardData, UserProfileSettings, FriendSyncConfig, FriendSyncRemoteSnapshot } from './types'
import { createPracticeSessionPayload } from './domain/evidence'

const isTauri = () => '__TAURI_INTERNALS__' in window

export async function bootstrap(): Promise<BootstrapData> {
  return isTauri() ? invoke('bootstrap') : mockBootstrap
}

export async function getTacticalDashboardStats(scope = 'ranked'): Promise<TacticalDashboardData> {
  if (isTauri()) {
    return invoke('get_tactical_dashboard_stats', { scope })
  }
  return {
    profile: {
      nickname: 'dr7fter',
      title: '一锤定音的战场收割者',
      combatPower: 3558,
      currentElo: 1956,
      peakElo: 1956,
      currentRankLetter: 'A',
      peakRankLetter: 'A',
      weScore: 68.5,
      ratingPro: 1.15,
      matches: 160,
      winRate: 55.0,
      headshotRate: 65.9,
      adr: 105,
      kdRatio: 1.65,
      rws: 13.98,
      firepower: 68,
    },
    mapSubjects: [],
    dimensions: [
      { key: 'rigor', label: '严谨性', value: 64 },
      { key: 'computation', label: '计算力', value: 65 },
      { key: 'speed', label: '速度', value: 62 },
      { key: 'modeling', label: '审题建模', value: 64 },
      { key: 'methodUse', label: '方法使用', value: 63 },
      { key: 'strategyInsight', label: '策略洞察力', value: 62 },
    ],
    specialtySkills: [],
    weapons: [],
    currentSeason: '2026S2·热浪争锋',
  }
}

export async function getQuestion(id: number): Promise<Question> {
  return isTauri() ? invoke('get_question', { id }) : mockQuestions.find((q) => q.id === id) ?? mockQuestions[0]
}

export async function getRecommendations(limit = 12): Promise<RecommendedQuestion[]> {
  return isTauri() ? invoke('get_recommendations', { limit }) : mockRecommendations.slice(0, limit)
}

export async function getLibraryPath(): Promise<string> {
  return isTauri() ? invoke('get_library_path') : 'E:\考研资料\题库-大观园'
}

export async function setLibraryPath(path: string): Promise<void> {
  if (isTauri()) await invoke('set_library_path', { path })
}

export async function getEloStatus(): Promise<EloStatus> {
  if (isTauri()) return invoke('get_elo_status')
  return { current: 1400, settlements: 0, calibrated: false, lastDelta: null, streak: 0, protectionLeft: 0, history: [] }
}

export async function getSessionScoreboard(sessionId: string | null): Promise<SessionScoreboard> {
  if (isTauri()) return invoke('get_session_scoreboard', { sessionId })
  return { weScore: null, questions: [], mvpQuestionId: null, longestStreak: 0, fastestKillQuestionId: null, eloDelta: 0, totalDuration: 0, correctCount: 0, totalCount: 0 }
}

export async function getSeasonStatus(): Promise<SeasonStatus> {
  if (isTauri()) return invoke('get_season_status')
  return { name: '基础期', index: 0, startedAt: '', currentElo: 10000, history: [] }
}

export async function advanceSeason(): Promise<SeasonStatus> {
  return invoke('advance_season')
}

export async function getTagClosure(): Promise<TagClosure[]> {
  return isTauri() ? invoke('get_tag_closure') : []
}

export async function getRatingDistribution(): Promise<RatingDistribution> {
  if (isTauri()) return invoke('get_rating_distribution')
  return { buckets: [], mean: null, sd: null, count: 0, p95: null, above130: 0, below070: 0, drift: false, dimensions: null }
}

export async function getReviewQueue(limit = 50): Promise<RecommendedQuestion[]> {
  return isTauri() ? invoke('get_review_queue', { limit }) : mockRecommendations.slice(0, limit)
}

export async function getReviewHistory(): Promise<ReviewHistory> {
  if (isTauri()) return invoke('get_review_history')
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - 6 + index)
    return { date: date.toISOString().slice(0, 10), count: index === 6 ? 2 : 0, correctCount: index === 6 ? 1 : 0 }
  })
  return { days, items: [{ attemptId: 1, questionId: mockQuestions[0].id, attemptedAt: today.toISOString(), stem: mockQuestions[0].stem, categoryPath: mockQuestions[0].categoryPath, source: mockQuestions[0].source, result: 'wrong', selfRating: 2 }] }
}

export async function getReviewPlan(): Promise<ReviewPlan> {
  if (isTauri()) return invoke('get_review_plan')
  const today = new Date()
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() + index)
    return { date: date.toISOString().slice(0, 10), count: index === 1 ? 2 : 0 }
  })
  return { days, items: [{ questionId: mockQuestions[0].id, stem: mockQuestions[0].stem, categoryPath: mockQuestions[0].categoryPath, source: mockQuestions[0].source, scheduledDate: days[1].date, nextReview: days[1].date, selfRating: 1 }] }
}

export async function getCategories(root = ''): Promise<CategoryNode[]> {
  return isTauri() ? invoke('get_categories', { root }) : mockCategories.filter((item) => !root || item.rootName === root)
}

export async function searchQuestionPage(input: { query: string; categoryId: number | null; status: string; scope: string; page: number; pageSize: number }): Promise<QuestionPage> {
  if (isTauri()) return invoke('search_question_page', input)
  const category = mockCategories.find((item) => item.id === input.categoryId)
  const preview = Array.from({ length: 5388 }, (_, index) => ({ ...mockQuestions[index % mockQuestions.length], id: index + 1 }))
  const filtered = preview.filter((question) =>
    (!input.query || `${question.stem}${question.source}${question.id}`.includes(input.query)) &&
    (!category || question.categoryPath.includes(category.name)) &&
    (input.scope === 'complete' || (input.scope === 'core' && question.isCore) || (input.scope === 'truth' && question.source.includes('真题'))) &&
    (input.status === 'all' || (input.status === 'favorite' && question.favorite) || (input.status === 'wrong' && question.accuracy === 0) || (input.status === 'unseen' && question.attempts === 0) || (input.status === 'noted' && !!question.note)),
  )
  const start = (input.page - 1) * input.pageSize
  return { items: filtered.slice(start, start + input.pageSize), total: filtered.length, page: input.page, pageSize: input.pageSize, pageCount: Math.ceil(filtered.length / input.pageSize) }
}

export async function getMasteryMap(): Promise<MasteryChapter[]> {
  return isTauri() ? invoke('get_mastery_map') : mockMastery
}

export async function getMasteryNodes(): Promise<MasteryNode[]> {
  if (isTauri()) return invoke('get_mastery_nodes')
  const leaves = ['概念辨析', '基本计算', '综合应用', '参数问题', '证明与推理']
  return mockCategories.filter((item) => item.rootName === '高等数学' && item.depth === 1).flatMap((chapter, chapterIndex) => leaves.map((name, leafIndex) => {
    const attempted = chapterIndex === 0 ? Math.max(0, 5 - leafIndex) : chapterIndex === 1 && leafIndex === 0 ? 2 : 0
    return { id: chapter.id * 10 + leafIndex, parentId: chapter.id, chapterId: chapter.id, name, path: `${chapter.path} / ${name}`, depth: 3,
      total: 18 + leafIndex * 9 + chapterIndex * 3, attempted, attemptCount: attempted, dueCount: attempted > 2 ? 1 : 0, weakCount: attempted > 0 ? 1 : 0,
      coverage: attempted / (18 + leafIndex * 9 + chapterIndex * 3), accuracy: attempted ? .55 + leafIndex * .07 : null,
      rating: attempted ? Math.min(2, 0.88 + leafIndex * .12) : null, masteryScore: attempted >= 3 ? 38 + leafIndex * 10 : null,
      evidenceLevel: attempted >= 3 ? '多次独立作答' : attempted ? '初步作答证据' : '无可评分证据',
      evidenceSources: attempted ? [`自评 ${attempted}`] : [], retestCorrectCount: 0 }
  }))
}

export async function getCustomQueue(): Promise<Question[]> {
  return isTauri() ? invoke('get_custom_queue') : mockQuestions
}

export async function addToCustomQueue(questionId: number): Promise<number> {
  return isTauri() ? invoke('add_to_custom_queue', { questionId }) : 1
}

export async function removeFromCustomQueue(questionId: number): Promise<number> {
  return isTauri() ? invoke('remove_from_custom_queue', { questionId }) : 0
}

export async function clearCustomQueue(): Promise<void> {
  if (isTauri()) await invoke('clear_custom_queue')
}

export async function getChapterQueue(categoryId: number, limit = 100): Promise<RecommendedQuestion[]> {
  return isTauri() ? invoke('get_chapter_queue', { categoryId, limit }) : mockRecommendations.slice(0, limit)
}

export async function getFocusQueue(categoryIds: number[], limit = 50): Promise<RecommendedQuestion[]> {
  return isTauri() ? invoke('get_focus_queue', { categoryIds, limit }) : mockRecommendations.slice(0, limit)
}

export async function getVariantQueue(questionId: number, limit = 3): Promise<RecommendedQuestion[]> {
  return isTauri() ? invoke('get_variant_queue', { questionId, limit }) : mockRecommendations.slice(0, limit)
}

export async function setFocusBranches(categoryIds: number[]): Promise<void> {
  if (isTauri()) await invoke('set_focus_branches', { categoryIds })
}

export async function setCurrentChapter(categoryId: number | null): Promise<void> {
  if (isTauri()) await invoke('set_current_chapter', { categoryId })
}

export async function recordAttempt(input: {
  questionId: number
  durationSeconds: number
  result: string
  selfRating: number
  selectedAnswer?: string
  mode?: string
  outcome?: string
  evidenceSource?: string
  fluencyRating?: number
  confidence?: number
  sessionId?: string
  diagnosisId?: string
}): Promise<Question> {
  if (isTauri()) return invoke('record_attempt', { input })
  return { ...(await getQuestion(input.questionId)), attempts: 1, mastery: input.selfRating }
}

export async function savePracticeSession(
  queue: RecommendedQuestion[],
  currentIndex: number,
  attemptMode: 'paper' | 'review',
): Promise<void> {
  if (!isTauri()) return
  await invoke('save_practice_session', {
    input: createPracticeSessionPayload(queue, currentIndex, attemptMode),
  })
}

export async function loadPracticeSession(): Promise<PracticeSessionState | null> {
  if (!isTauri()) return null
  return invoke('load_practice_session')
}

export async function clearPracticeSession(): Promise<void> {
  if (isTauri()) await invoke('clear_practice_session')
}

export async function restoreDatabaseBackup(backupPath: string): Promise<import('./types').RestoreResult> {
  if (isTauri()) return invoke('restore_database_backup', { backupPath })
  return { success: true, preRestoreBackupPath: '', message: '本地预览恢复成功', restoredAttempts: 0, restoredProgress: 0 }
}

export async function listDatabaseBackups(): Promise<import('./types').BackupInfo[]> {
  if (isTauri()) return invoke('list_database_backups')
  return []
}

export async function toggleFavorite(questionId: number): Promise<boolean> {
  return isTauri() ? invoke('toggle_favorite', { questionId }) : true
}

export async function getTodayAttemptedQuestions(): Promise<import('./types').TodayAttemptItem[]> {
  if (isTauri()) return invoke('get_today_attempted_questions')
  return []
}

export async function saveNote(questionId: number, note: string): Promise<void> {
  if (isTauri()) await invoke('save_note', { questionId, note })
}

export async function saveReviewIntervals(intervals: number[]): Promise<void> {
  if (isTauri()) await invoke('save_review_intervals', { intervals })
}

export async function undoLastAttempt(questionId: number): Promise<Question> {
  if (isTauri()) return invoke('undo_last_attempt', { questionId })
  return getQuestion(questionId)
}

export async function exportRecords(): Promise<ExportResult> {
  if (isTauri()) return invoke('export_records')
  return { dbPath: '本地预览', jsonPath: '本地预览' }
}

export async function getFailedInbox(): Promise<FailedInboxItem[]> {
  return isTauri() ? invoke('get_failed_inbox') : []
}

export async function refreshInbox(): Promise<InboxSummary> {
  if (isTauri()) return invoke('refresh_inbox')
  return { pendingCount: 0, failedCount: 0, lastProcessedTaskId: null }
}

export async function getTaskPrompt(taskId: string): Promise<string | null> {
  if (isTauri()) return invoke('get_task_prompt', { taskId })
  const task = mockInbox.find((item) => item.taskId === taskId)
  return task ? `批改任务说明（${task.taskId}）\n题目：${task.summary}` : null
}

export async function saveGoal(input: { dailyMode: string; dailyProblemTarget: number; dailyMinuteTarget: number }): Promise<void> {
  if (isTauri()) await invoke('save_goal', { input })
}

export async function getInbox(): Promise<InboxItem[]> {
  return isTauri() ? invoke('get_inbox') : mockInbox
}

export async function confirmInbox(id: number, applyToProfile: boolean): Promise<void> {
  if (isTauri()) await invoke('confirm_inbox', { id, applyToProfile })
}

export async function startRecommendationBatch(taskId: string): Promise<RecommendationBatch | null> {
  return isTauri() ? invoke('start_recommendation_batch', { taskId }) : null
}

export async function dismissRecommendationBatch(taskId: string): Promise<void> {
  if (isTauri()) await invoke('dismiss_recommendation_batch', { taskId })
}

export async function createCodexTask(questionId: number): Promise<CodexTask> {
  if (isTauri()) return invoke('create_codex_task', { questionId })
  return {
    taskId: 'SB-PREVIEW-155', questionId, questionCount: 1,
    prompt: '你正在为数学刷题 App「刷吧」批改数一草稿。请结合我发送的草稿图片定位最早错误，并将结构化结果写回刷吧收件箱。',
    inboxDir: '本地预览', outputFile: '本地预览/SB-PREVIEW-155.json',
  }
}

export async function createCodexBatchTask(
  questionIds: number[],
  durations?: Record<number, number>,
  sessionId?: string,
): Promise<CodexTask> {
  if (isTauri()) return invoke('create_codex_batch_task', { questionIds, durations, sessionId })
  return {
    taskId: 'SB-BATCH-PREVIEW-0001', questionId: null, questionCount: questionIds.length,
    prompt: '你正在为数学刷题 App「刷吧」批改数一草稿。本任务包含多道题，草稿图片按顺序对应题目；若草稿张数少于题目数，只批改上传了草稿的题，不猜测其余题目。',
    inboxDir: '本地预览', outputFile: '本地预览/SB-BATCH-PREVIEW-0001.json',
  }
}

export async function imageDataUrl(path: string): Promise<string> {
  return isTauri() ? invoke('image_data_url', { path }) : path
}

export async function getInsights(): Promise<InsightPoint[]> {
  return isTauri() ? invoke('get_insights') : [
    { name: '高等数学', attempts: 42, accuracy: 0.69, averageRating: 1.18 },
    { name: '线性代数', attempts: 31, accuracy: 0.58, averageRating: 0.94 },
    { name: '概率统计', attempts: 18, accuracy: 0.78, averageRating: 1.42 },
  ]
}

export async function getWeaknessRadar(): Promise<WeaknessRadar> {
  if (isTauri()) return invoke('get_weakness_radar')
  return {
    errorTags: [
      { tag: '符号计算', count: 12, recentCount: 4, lastSeen: new Date().toISOString() },
      { tag: '概念边界', count: 8, recentCount: 2, lastSeen: new Date().toISOString() },
    ],
    weaknessTags: [
      { tag: '复合求导', count: 9, recentCount: 3, lastSeen: new Date().toISOString() },
      { tag: '幂零矩阵', count: 6, recentCount: 1, lastSeen: new Date().toISOString() },
    ],
    trend: Array.from({ length: 14 }, (_, i) => {
      const date = new Date(); date.setDate(date.getDate() - 13 + i)
      return {
        date: date.toISOString().slice(0, 10),
        errorTags: i % 3 === 0 ? [{ tag: '符号计算', count: 1 }] : [],
        weaknessTags: i % 4 === 0 ? [{ tag: '复合求导', count: 1 }] : [],
      }
    }),
  }
}

export async function getDailyTrend(): Promise<DailyTrendPoint[]> {
  if (!isTauri()) return Array.from({ length: 14 }, (_, i) => {
    const date = new Date(); date.setDate(date.getDate() - 13 + i)
    const attempts = i === 13 ? 5 : i === 12 ? 3 : i > 8 ? 2 : 0
    const correct = i === 13 ? 3 : i === 12 ? 2 : i > 8 ? 1 : 0
    const rating = attempts > 0 ? Math.min(2, 0.76 + i * 0.025) : null
    return { date: date.toISOString().slice(0, 10), attempts, correct, rating }
  })
  return invoke('get_daily_trend')
}

export async function getStreak(): Promise<UserStreak> {
  return isTauri() ? invoke('get_streak') : { currentStreak: 3, bestStreak: 5 }
}

export async function getDailyLog(): Promise<DailyLog> {
  if (isTauri()) return invoke('get_daily_log')
  return {
    days: [{ date: new Date().toISOString().slice(0, 10), count: 2, correctCount: 1 }],
    items: [{
      questionId: mockQuestions[0].id, stem: mockQuestions[0].stem, categoryPath: mockQuestions[0].categoryPath, source: mockQuestions[0].source,
      result: 'wrong', selfRating: 2, mode: 'paper', attemptedAt: new Date().toISOString(),
      aiVerdict: 'incorrect', aiSummary: '草稿中把二阶导展开错写成…', aiEarliestError: '展开时漏掉 (u′)² 项', aiErrorTags: ['复合求导'], aiWeaknessTags: ['链式法则'],
      aiAdvice: '把 u=ln y−sin x 先写完整再展开', aiConfidence: 0.9, aiConfirmedAt: new Date().toISOString(),
    }],
  }
}

// 压力模拟模式 API
export async function createPressureSession(questionIds: number[]): Promise<PressureSession> {
  if (isTauri()) return invoke('create_pressure_session', { questionIds })
  return {
    sessionId: 'mock-' + Date.now(),
    mode: 'pressure',
    startTime: Date.now(),
    endTime: null,
    totalDuration: 0,
    questions: [],
    status: 'ongoing',
    createdAt: Date.now(),
  }
}

export async function submitPressureAnswer(
  sessionId: string,
  questionId: number,
  userAnswer: string,
  duration: number
): Promise<void> {
  if (isTauri()) {
    return invoke('submit_pressure_answer', { sessionId, questionId, userAnswer, duration })
  }
}

export async function abandonPressureSession(sessionId: string): Promise<void> {
  if (isTauri()) await invoke('abandon_pressure_session', { sessionId })
}

export async function completePressureSession(sessionId: string): Promise<PressureSession> {
  if (isTauri()) return invoke('complete_pressure_session', { sessionId })
  return {
    sessionId,
    mode: 'pressure',
    startTime: Date.now() - 3600000,
    endTime: Date.now(),
    totalDuration: 3600,
    questions: [],
    status: 'submitted',
    createdAt: Date.now(),
  }
}

export async function savePressureGradingReport(
  sessionId: string,
  report: GradingReport
): Promise<void> {
  if (isTauri()) {
    return invoke('save_pressure_grading_report', { sessionId, reportJson: JSON.stringify(report) })
  }
}

export async function getPressureSession(sessionId: string): Promise<PressureSession | null> {
  if (isTauri()) return invoke('get_pressure_session', { sessionId })
  return null
}

export async function getPressureGradingReport(sessionId: string): Promise<GradingReport | null> {
  if (isTauri()) return invoke('get_pressure_grading_report', { sessionId })
  return null
}

export async function listPressureSessions(): Promise<PressureSession[]> {
  if (isTauri()) return invoke('list_pressure_sessions')
  return []
}

export async function getAppVersion(): Promise<string> {
  if (isTauri()) {
    try {
      return await invoke<string>('get_app_version')
    } catch {
      return '开发版'
    }
  }
  return '开发版'
}

export type UpdateProgress = { downloaded: number; total: number | null }

/** 读取 Windows 系统代理（与浏览器同源），直连环境返回 null */
export async function getSystemProxy(): Promise<string | null> {
  if (!isTauri()) return null
  try {
    return await invoke<string | null>('get_system_proxy')
  } catch {
    return null
  }
}

/** 用官方 updater 插件检查更新：优先走系统代理，失败降级直连 */
export async function checkAppUpdate(): Promise<Update | null> {
  if (!isTauri()) return null
  const proxy = await getSystemProxy()
  if (!proxy) return check()
  try {
    return await check({ proxy })
  } catch {
    // 代理工具异常退出未还原设置时端口已死，降级直连重试一次
    return check()
  }
}

/** 应用内下载并安装更新，进度透传给回调 */
export async function installUpdate(
  update: Update,
  onProgress?: (progress: UpdateProgress) => void,
): Promise<void> {
  let total: number | null = null
  let downloaded = 0
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        total = event.data.contentLength ?? null
        onProgress?.({ downloaded, total })
        break
      case 'Progress':
        downloaded += event.data.chunkLength
        onProgress?.({ downloaded, total })
        break
      case 'Finished':
        onProgress?.({ downloaded, total })
        break
    }
  })
}

/** 安装完成后重启应用 */
export async function restartApp(): Promise<void> {
  if (isTauri()) await relaunch()
}

export async function getUserProfile(): Promise<UserProfileSettings> {
  if (isTauri()) {
    try {
      return await invoke<UserProfileSettings>('get_user_profile')
    } catch {
      // fallback
    }
  }
  try {
    const raw = localStorage.getItem('shuaba_my_profile_v1')
    if (raw) return JSON.parse(raw)
  } catch {
    // ignore
  }
  return {
    nickname: 'dr7fter',
    targetSchool: '考研数学一 · 目标985',
    avatar: '🚀',
  }
}

export async function setUserProfile(profile: UserProfileSettings): Promise<void> {
  try {
    localStorage.setItem('shuaba_my_profile_v1', JSON.stringify(profile))
  } catch {
    // ignore
  }
  if (isTauri()) {
    try {
      await invoke('set_user_profile', { profile })
    } catch {
      // ignore
    }
  }
}




export async function testFriendSync(config: FriendSyncConfig): Promise<string> {
  if (!isTauri()) return '浏览器预览不执行坚果云连接'
  return invoke('test_friend_sync', { config })
}

export async function publishFriendSnapshot(
  config: FriendSyncConfig,
  friendCode: string,
  payload: string,
): Promise<string> {
  if (!isTauri()) return `shuaba-friend-${friendCode}.json`
  return invoke('publish_friend_snapshot', { config, friendCode, payload })
}

export async function pullFriendSnapshots(
  config: FriendSyncConfig,
  friendCodes: string[],
): Promise<FriendSyncRemoteSnapshot[]> {
  if (!isTauri()) return []
  return invoke('pull_friend_snapshots', { config, friendCodes })
}
