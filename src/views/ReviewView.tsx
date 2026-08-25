import { AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Flame,
  Layers,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  Target,
  TimerReset,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addToCustomQueue,
  getDailyLog,
  getInbox,
  getQuestion,
  getReviewHistory,
  getReviewPlan,
  getReviewQueue,
  toggleFavorite,
} from '../api'
import { MathText } from '../components/MathText'
import { QuestionDetail } from '../components/QuestionDetailModal'
import type {
  AttemptOutcome,
  MasteryChapter,
  Question,
  RecommendedQuestion,
  ReviewHistory,
  ReviewPlan,
} from '../types'
import './ReviewView.css'

export type ReviewMapMode = 'all' | 'wrong' | 'due' | 'ai'

export type ReviewBoardQuestion = {
  questionId: number
  stem: string
  categoryPath: string
  source: string
  kind: 'due' | 'wrong' | 'uncertain'
  result: AttemptOutcome | null
  scheduledDate: string | null
  attemptedAt: string | null
  earliestError: string | null
  advice: string | null
  betterSolution: string | null
  errorTags?: string[]
  weaknessTags?: string[]
}

export function reviewCategoryMatches(chapter: MasteryChapter, categoryPath: string): boolean {
  const parts = categoryPath.split(' / ')
  return (
    parts[0] === chapter.rootName &&
    (parts.includes(chapter.name) || categoryPath.includes(chapter.name))
  )
}

function DefusalStepProgress({ currentStep = 1 }: { currentStep?: number }) {
  const steps = [
    { label: '诊断', num: 1 },
    { label: '原题', num: 2 },
    { label: '相似', num: 3 },
    { label: '变式', num: 4 },
    { label: '延迟', num: 5 },
    { label: '🛡️排雷', num: 6 },
  ]
  return (
    <div className="defusal-step-progress">
      {steps.map((s) => {
        const done = s.num < currentStep
        const active = s.num === currentStep
        return (
          <div key={s.label} className={`step-node-item ${done ? 'completed' : active ? 'active' : ''}`}>
            <div className="step-dot">{done ? '✓' : s.num}</div>
            <span className="step-node-label">{s.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function ReviewMapView({
  due,
  chapters,
  notify,
  onStart,
  onOpenWrongBook,
  onPractice,
  onPracticeBatch,
  onStartVariant,
}: {
  due: number
  inboxCount?: number
  intervals?: number[]
  chapters: MasteryChapter[]
  notify: (text: string) => void
  onStart: () => Promise<void>
  onOpenWrongBook: () => void
  onPractice: (question: Question) => void
  onPracticeBatch: (questions: Question[], reason: string) => void
  onStartVariant: (questionId: number) => void
  onOpenInbox?: () => void
}) {
  const [history, setHistory] = useState<ReviewHistory | null>(null)
  const [plan, setPlan] = useState<ReviewPlan | null>(null)
  const [dueQueue, setDueQueue] = useState<RecommendedQuestion[]>([])
  const [inboxCategories, setInboxCategories] = useState<Record<number, string>>({})
  const [inboxDiagnoses, setInboxDiagnoses] = useState<Record<number, { earliestError?: string | null; advice?: string | null; betterSolution?: string | null }>>({})
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null)
  const [selectedBoardQ, setSelectedBoardQ] = useState<ReviewBoardQuestion | null>(null)
  const [questionFilter, setQuestionFilter] = useState<ReviewMapMode>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [detailModalQuestion, setDetailModalQuestion] = useState<Question | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextHistory, nextPlan, nextDueQueue, nextLog, nextInbox] =
        await Promise.all([
          getReviewHistory(),
          getReviewPlan(),
          getReviewQueue(50),
          getDailyLog().catch(() => null),
          getInbox(),
        ])
      const categoryEntries = await Promise.all(
        nextInbox
          .filter((item) => item.questionId !== null)
          .map(async (item) => {
            try {
              const question = await getQuestion(item.questionId as number)
              return [item.questionId as number, question.categoryPath] as const
            } catch {
              return null
            }
          })
      )
      const diagMap: Record<number, { earliestError?: string | null; advice?: string | null; betterSolution?: string | null }> = {}
      for (const item of nextInbox) {
        if (item.questionId) {
          diagMap[item.questionId] = {
            earliestError: item.earliestError,
            advice: item.advice,
            betterSolution: item.betterSolution,
          }
        }
      }
      for (const item of nextLog?.items ?? []) {
        if (item.questionId && !diagMap[item.questionId]) {
          diagMap[item.questionId] = {
            earliestError: item.aiEarliestError,
            advice: item.aiAdvice,
            betterSolution: null,
          }
        }
      }
      setHistory(nextHistory)
      setPlan(nextPlan)
      setDueQueue(nextDueQueue)
      setInboxDiagnoses(diagMap)
      setInboxCategories(
        Object.fromEntries(
          categoryEntries.filter(
            (entry): entry is readonly [number, string] => entry !== null
          )
        )
      )
    } catch {
      notify('无法获取部分复盘记录')
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    void load()
  }, [load])

  const displayedDue = dueQueue.length > 0 ? dueQueue.length : due

  // Synthetic & real chapters
  const boardChapters = useMemo<MasteryChapter[]>(() => {
    const fallback = new Map<string, { rootName: string; name: string; total: number }>()
    for (const path of [...(plan?.items ?? []), ...(history?.items ?? [])]
      .map((item) => item.categoryPath)
      .concat(dueQueue.map((item) => item.question.categoryPath))) {
      const parts = path.split(' / ')
      const rootName = parts[0] || '高等数学'
      const name = parts[1] || rootName
      const key = `${rootName}::${name}`
      const current = fallback.get(key) ?? { rootName, name, total: 0 }
      current.total += 1
      fallback.set(key, current)
    }
    const existing = new Set(chapters.map((chapter) => `${chapter.rootName}::${chapter.name}`))
    const synthetic = Array.from(fallback.entries())
      .filter(([key]) => !existing.has(key))
      .map(([key, item]) => ({
        id: -Math.max(
          1,
          Math.abs(
            Array.from(key).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 7)
          )
        ),
        name: item.name,
        rootName: item.rootName,
        total: item.total,
        attempted: 0,
        correctAttempts: 0,
        attemptCount: 0,
        dueCount: 0,
        weakCount: 0,
        coverage: 0,
        accuracy: null,
        rating: null,
        masteryScore: null,
        evidence: '建立证据中',
        evidenceLevel: '待建立掌握证据',
        evidenceSources: [],
        retestCorrectCount: 0,
      }))
    return [...chapters, ...synthetic]
  }, [chapters, plan, history, dueQueue])

  // Chapter Statistics
  const chapterStats = useMemo(() => {
    return boardChapters.map((chapter) => {
      const historyItems = (history?.items ?? []).filter((item) =>
        reviewCategoryMatches(chapter, item.categoryPath)
      )
      const wrongIds = new Set(
        historyItems
          .filter((item) => item.result === 'wrong' || item.result === 'partial')
          .map((item) => item.questionId)
      )
      const dueQueueItems = dueQueue.filter((item) =>
        reviewCategoryMatches(chapter, item.question.categoryPath)
      )
      const aiCount = Object.values(inboxCategories).filter((path) =>
        reviewCategoryMatches(chapter, path)
      ).length
      const dueCount = dueQueueItems.length
      const score = chapter.masteryScore ?? (chapter.accuracy !== null ? chapter.accuracy : null)
      const rankTier = score === null ? 'none' : score >= 85 ? 's' : score >= 70 ? 'a' : score >= 50 ? 'b' : 'c'
      const isSolid = wrongIds.size === 0 && dueCount === 0 && (score !== null && score >= 70)

      return {
        ...chapter,
        dueCount,
        wrongCount: wrongIds.size,
        aiCount,
        recentCount: historyItems.length,
        rankTier,
        isSolid,
      }
    })
  }, [boardChapters, history, dueQueue, inboxCategories])

  const totalWrongCount = useMemo(() => {
    return new Set(
      (history?.items ?? [])
        .filter((item) => item.result === 'wrong' || item.result === 'partial')
        .map((item) => item.questionId)
    ).size
  }, [history])

  const solidChaptersCount = useMemo(() => {
    return chapterStats.filter((c) => c.isSolid).length
  }, [chapterStats])

  const totalAiDiagnoses = useMemo(() => {
    return Object.keys(inboxCategories).length
  }, [inboxCategories])

  const filteredChapters = useMemo(() => {
    return chapterStats.filter((c) => {
      if (selectedSubject !== 'all' && c.rootName !== selectedSubject) return false
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        return c.name.toLowerCase().includes(q) || c.rootName.toLowerCase().includes(q)
      }
      return true
    })
  }, [chapterStats, selectedSubject, searchQuery])

  useEffect(() => {
    if (!selectedChapterId && filteredChapters.length > 0) {
      setSelectedChapterId(filteredChapters[0].id)
    }
  }, [filteredChapters, selectedChapterId])

  const activeChapter = useMemo(() => {
    return chapterStats.find((c) => c.id === selectedChapterId) ?? filteredChapters[0] ?? null
  }, [chapterStats, selectedChapterId, filteredChapters])

  // Questions for active chapter
  const chapterQuestions = useMemo<ReviewBoardQuestion[]>(() => {
    if (!activeChapter) return []
    const map = new Map<number, ReviewBoardQuestion>()

    // Due queue items
    for (const item of dueQueue) {
      if (reviewCategoryMatches(activeChapter, item.question.categoryPath)) {
        const diag = inboxDiagnoses[item.question.id]
        map.set(item.question.id, {
          questionId: item.question.id,
          stem: item.question.stem,
          categoryPath: item.question.categoryPath,
          source: item.question.source,
          kind: 'due',
          result: null,
          scheduledDate: item.question.nextReview,
          attemptedAt: null,
          earliestError: diag?.earliestError || null,
          advice: diag?.advice || null,
          betterSolution: diag?.betterSolution || null,
        })
      }
    }

    // History items
    for (const item of history?.items ?? []) {
      if (reviewCategoryMatches(activeChapter, item.categoryPath)) {
        const existing = map.get(item.questionId)
        const isWrong = item.result === 'wrong' || item.result === 'partial'
        const isUncertain = item.result === 'uncertain'
        const kind = isWrong ? 'wrong' : isUncertain ? 'uncertain' : 'due'
        const diag = inboxDiagnoses[item.questionId]

        map.set(item.questionId, {
          questionId: item.questionId,
          stem: item.stem || existing?.stem || `题目 #${item.questionId}`,
          categoryPath: item.categoryPath,
          source: item.source || existing?.source || '数一真题库',
          kind: existing?.kind === 'due' ? 'due' : kind,
          result: item.result,
          scheduledDate: existing?.scheduledDate || null,
          attemptedAt: item.attemptedAt,
          earliestError: diag?.earliestError || null,
          advice: diag?.advice || null,
          betterSolution: diag?.betterSolution || null,
        })
      }
    }

    return Array.from(map.values())
  }, [activeChapter, dueQueue, history, inboxDiagnoses])

  const visibleQuestions = useMemo(() => {
    return chapterQuestions.filter((q) => {
      if (questionFilter === 'wrong') return q.kind === 'wrong' || q.result === 'wrong' || q.result === 'partial'
      if (questionFilter === 'due') return q.kind === 'due'
      if (questionFilter === 'ai') return Boolean(q.earliestError || q.advice || q.betterSolution)
      return true
    })
  }, [chapterQuestions, questionFilter])

  useEffect(() => {
    if (visibleQuestions.length > 0 && !selectedBoardQ) {
      setSelectedBoardQ(visibleQuestions[0])
    }
  }, [visibleQuestions, selectedBoardQ])

  const handleOpenDetailModal = async (qId: number) => {
    try {
      const q = await getQuestion(qId)
      if (q) setDetailModalQuestion(q)
    } catch {
      notify(`无法加载题目 #${qId} 详情`)
    }
  }

  const handleToggleFavorite = async (qId: number) => {
    try {
      const nextFav = await toggleFavorite(qId)
      notify(nextFav ? `⭐ 题目 #${qId} 已收藏` : `已取消题目 #${qId} 收藏`)
    } catch {
      notify('收藏操作失败')
    }
  }

  const handleStartChapterPractice = async (type: 'all' | 'wrong' | 'due') => {
    const targetQs = visibleQuestions.filter((q) => {
      if (type === 'wrong') return q.kind === 'wrong' || q.result === 'wrong' || q.result === 'partial'
      if (type === 'due') return q.kind === 'due'
      return true
    })
    if (targetQs.length === 0) {
      notify('当前没有可练习的题目')
      return
    }
    const questions = await Promise.all(targetQs.map((q) => getQuestion(q.questionId)))
    const valid = questions.filter((q): q is Question => Boolean(q))
    if (valid.length > 0) {
      onPracticeBatch(valid, `${activeChapter?.name || '章节'}专项复盘`)
    }
  }

  return (
    <div className="review-command-center">
      {/* Header */}
      <header className="review-header">
        <div>
          <span className="review-kicker">
            <Layers size={14} /> 数一战术复盘指挥中枢 · TACTICAL REVIEW COMMAND
          </span>
          <h1>战术复盘指挥中心</h1>
          <p>
            全景知识防线拓扑 · 错题六步排雷工作台 · 三类错因靶向突围 · SRS 周期清零
          </p>
        </div>
        <div className="learning-header-actions">
          <button
            type="button"
            className="secondary-button compact"
            onClick={onOpenWrongBook}
          >
            <BookOpen size={14} /> 错题本档案
          </button>
          <button
            type="button"
            className="primary-button compact"
            onClick={() => void onStart()}
          >
            <Zap size={14} /> ⚡ 一键清零今日复习 ({displayedDue}题)
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => void load()}
            title="刷新复盘战况"
            aria-label="刷新复盘"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </header>

      {/* Health Bar */}
      <section className="review-health-bar" aria-label="战术健康看板">
        <div className="review-health-tile danger">
          <span className="review-health-label">
            <Flame size={14} /> 待排雷错题
          </span>
          <div className="review-health-val">{totalWrongCount} <small style={{ fontSize: '13px', color: 'var(--muted)' }}>题在办</small></div>
          <span className="review-health-sub">需原题重做、相似与变式验证</span>
        </div>
        <div className="review-health-tile warn">
          <span className="review-health-label">
            <TimerReset size={14} /> 今日到期债务
          </span>
          <div className="review-health-val">{displayedDue} <small style={{ fontSize: '13px', color: 'var(--muted)' }}>题待清</small></div>
          <span className="review-health-sub">SRS 记忆曲线到达临界复习点</span>
        </div>
        <div className="review-health-tile success">
          <span className="review-health-label">
            <ShieldCheck size={14} /> 固若金汤章节
          </span>
          <div className="review-health-val">{solidChaptersCount} / {chapterStats.length}</div>
          <span className="review-health-sub">掌握度≥70% 且 0 错题 0 逾期</span>
        </div>
        <div className="review-health-tile info">
          <span className="review-health-label">
            <Sparkles size={14} /> AI 诊断点位
          </span>
          <div className="review-health-val">{totalAiDiagnoses} <small style={{ fontSize: '13px', color: 'var(--muted)' }}>份回传</small></div>
          <span className="review-health-sub">含秒杀解法与关键断点分析</span>
        </div>
      </section>

      {/* Quick Filter Strip */}
      <section className="review-quick-strip">
        <div className="review-quick-left">
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)', fontWeight: 700 }}>大科筛选：</span>
          <button
            type="button"
            className={`review-filter-pill ${selectedSubject === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedSubject('all')}
          >
            全部三大科 ({chapterStats.length})
          </button>
          <button
            type="button"
            className={`review-filter-pill ${selectedSubject === '高等数学' ? 'active' : ''}`}
            onClick={() => setSelectedSubject('高等数学')}
          >
            高等数学 ({chapterStats.filter((c) => c.rootName === '高等数学').length})
          </button>
          <button
            type="button"
            className={`review-filter-pill ${selectedSubject === '线性代数' ? 'active' : ''}`}
            onClick={() => setSelectedSubject('线性代数')}
          >
            线性代数 ({chapterStats.filter((c) => c.rootName === '线性代数').length})
          </button>
          <button
            type="button"
            className={`review-filter-pill ${selectedSubject === '概率论与数理统计' ? 'active' : ''}`}
            onClick={() => setSelectedSubject('概率论与数理统计')}
          >
            概率统计 ({chapterStats.filter((c) => c.rootName === '概率论与数理统计').length})
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <Search size={14} style={{ color: 'var(--muted)' }} />
          <input
            type="text"
            className="search-input"
            placeholder="搜索考点章节..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '180px', height: '28px', fontSize: 'var(--fs-xs)' }}
          />
        </div>
      </section>

      {/* Main Workspace Grid */}
      <div className="review-workspace-grid">
        {/* Left Column: Math-1 Defense Tree */}
        <section className="defense-tree-panel">
          <div className="defense-tree-head">
            <h2>三大科防线拓扑 ({filteredChapters.length})</h2>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>点击切换工作区章节</span>
          </div>
          <div className="defense-tree-list">
            {filteredChapters.map((chapter) => {
              const isSelected = activeChapter?.id === chapter.id
              return (
                <div
                  key={chapter.id}
                  className={`defense-chapter-card ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedChapterId(chapter.id)
                    setSelectedBoardQ(null)
                  }}
                >
                  <div className="chapter-card-top">
                    <span className="chapter-root-tag">{chapter.rootName.slice(0, 2)}</span>
                    <span className="chapter-title">{chapter.name}</span>
                    <span className={`chapter-rank-badge ${chapter.rankTier}`}>
                      {chapter.rankTier.toUpperCase()} 级 ({chapter.masteryScore !== null ? `${Math.round(chapter.masteryScore)}%` : '--'})
                    </span>
                  </div>
                  <div className="chapter-card-bottom">
                    <span>考题容量 {chapter.total} 题</span>
                    <div className="chapter-indicators">
                      {chapter.isSolid && <span className="indicator-pill success"><ShieldCheck size={12} /> 稳固</span>}
                      {chapter.wrongCount > 0 && <span className="indicator-pill danger"><Flame size={12} /> {chapter.wrongCount}错题</span>}
                      {chapter.dueCount > 0 && <span className="indicator-pill warn"><TimerReset size={12} /> {chapter.dueCount}到期</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Right Column: Defusal Workbench */}
        <section className="defusal-workbench-panel">
          <div className="workbench-head">
            <div className="workbench-title-box">
              <h2>{activeChapter?.rootName} · {activeChapter?.name}</h2>
              <p>
                本章包含 {chapterQuestions.length} 道排查点 · {activeChapter?.wrongCount ?? 0} 道错题在办 · {activeChapter?.dueCount ?? 0} 道到期
              </p>
            </div>
            <div className="workbench-actions">
              <button
                type="button"
                className="secondary-button compact"
                onClick={() => void handleStartChapterPractice('due')}
                disabled={!activeChapter?.dueCount}
              >
                <Zap size={13} /> 练到期 ({activeChapter?.dueCount ?? 0})
              </button>
              <button
                type="button"
                className="primary-button compact"
                onClick={() => void handleStartChapterPractice('wrong')}
                disabled={!activeChapter?.wrongCount}
              >
                <Flame size={13} /> 攻坚错题 ({activeChapter?.wrongCount ?? 0})
              </button>
            </div>
          </div>

          <div className="workbench-scrollable">
            {/* Question Filter Tabs */}
            <div className="workbench-questions-filter">
              <button
                type="button"
                className={`review-filter-pill ${questionFilter === 'all' ? 'active' : ''}`}
                onClick={() => setQuestionFilter('all')}
              >
                全部本章题目 ({chapterQuestions.length})
              </button>
              <button
                type="button"
                className={`review-filter-pill ${questionFilter === 'wrong' ? 'active' : ''}`}
                onClick={() => setQuestionFilter('wrong')}
              >
                🔴 待排错题 ({chapterQuestions.filter((q) => q.kind === 'wrong' || q.result === 'wrong').length})
              </button>
              <button
                type="button"
                className={`review-filter-pill ${questionFilter === 'due' ? 'active' : ''}`}
                onClick={() => setQuestionFilter('due')}
              >
                ⏱️ 到期复习 ({chapterQuestions.filter((q) => q.kind === 'due').length})
              </button>
              <button
                type="button"
                className={`review-filter-pill ${questionFilter === 'ai' ? 'active' : ''}`}
                onClick={() => setQuestionFilter('ai')}
              >
                💡 AI 诊断点 ({chapterQuestions.filter((q) => q.earliestError || q.advice).length})
              </button>
            </div>

            {visibleQuestions.length === 0 ? (
              <div className="learning-empty" style={{ minHeight: '200px' }}>
                <CheckCircle2 size={32} style={{ color: 'var(--green)' }} />
                <strong>当前筛选下暂无题目</strong>
                <span>该章节在此状态下防线完好，可以切换其他筛选或章节查看。</span>
              </div>
            ) : (
              visibleQuestions.map((q) => {
                const isSelected = selectedBoardQ?.questionId === q.questionId
                const isWrong = q.kind === 'wrong' || q.result === 'wrong' || q.result === 'partial'
                const step = isWrong ? 2 : q.kind === 'due' ? 5 : 6

                return (
                  <article
                    key={q.questionId}
                    className={`workbench-qcard ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedBoardQ(q)}
                  >
                    <div className="qcard-topline">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                        <span className="qcard-id-badge">#{q.questionId}</span>
                        <span className={`match-result-pill ${isWrong ? 'loss' : 'win'}`}>
                          {isWrong ? '待排雷' : '到期温习'}
                        </span>
                        <span>{q.source}</span>
                      </div>
                      {q.scheduledDate && <span>下次复习：{q.scheduledDate}</span>}
                    </div>

                    <div className="qcard-stem-box">
                      <MathText value={q.stem} />
                    </div>

                    {/* Defusal Step Progress */}
                    <DefusalStepProgress currentStep={step} />

                    {/* AI Diagnosis details if available */}
                    {isSelected && (
                      <div className="workbench-detail-drawer">
                        {q.earliestError && (
                          <div className="tactical-error-box">
                            <strong>🔴 AI 步骤断点定位：</strong>
                            <p style={{ margin: '4px 0 0' }}><MathText value={q.earliestError} /></p>
                          </div>
                        )}
                        {q.betterSolution && (
                          <div className="tactical-solution-box">
                            <strong>⚡ 考场秒杀更优解：</strong>
                            <p style={{ margin: '4px 0 0' }}><MathText value={q.betterSolution} /></p>
                          </div>
                        )}
                        {q.advice && (
                          <div className="tactical-advice-box">
                            <strong>🎯 专项执行动作：</strong>
                            <p style={{ margin: '4px 0 0' }}><MathText value={q.advice} /></p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="qcard-action-bar">
                      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                        <button
                          type="button"
                          className="primary-button compact"
                          onClick={async (e) => {
                            e.stopPropagation()
                            const fullQ = await getQuestion(q.questionId)
                            if (fullQ) onPractice(fullQ)
                          }}
                        >
                          <Play size={13} /> 原题重做
                        </button>
                        <button
                          type="button"
                          className="secondary-button compact"
                          onClick={(e) => {
                            e.stopPropagation()
                            onStartVariant(q.questionId)
                          }}
                        >
                          <Swords size={13} /> 🔀 变式破局
                        </button>
                        <button
                          type="button"
                          className="secondary-button compact"
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleToggleFavorite(q.questionId)
                          }}
                        >
                          <Star size={13} /> 收藏
                        </button>
                      </div>
                      <button
                        type="button"
                        className="learning-link-button"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleOpenDetailModal(q.questionId)
                        }}
                      >
                        题目全景档案 <ChevronRight size={14} />
                      </button>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </section>
      </div>

      {/* Bottom Section: Error Tag Vault */}
      <section className="error-tag-vault-section">
        <div className="vault-head">
          <div>
            <span className="review-kicker"><Target size={14} /> ERROR TAG BREAKTHROUGH</span>
            <h3>三类错因专项突围库</h3>
          </div>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--muted)' }}>
            根据 AI 诊断标记归类，点击直接开练针对性专项题组
          </span>
        </div>
        <div className="vault-cards-grid">
          <div className="vault-card aim">
            <div className="vault-card-head">
              <strong>🔴 瞄准失误库 (计算/符号/笔误)</strong>
              <Flame size={18} style={{ color: 'var(--danger-strong)' }} />
            </div>
            <p>思路完全正确，但在通分、变上限求导、矩阵初等变换处产生符号与计算笔误。</p>
            <button
              type="button"
              className="primary-button compact vault-card-btn"
              onClick={() => void onStart()}
            >
              ⚡ 启动速算强化特训
            </button>
          </div>

          <div className="vault-card concept">
            <div className="vault-card-head">
              <strong>🟡 概念盲区库 (定理前提/可微连续)</strong>
              <ShieldAlert size={18} style={{ color: 'var(--warn-strong)' }} />
            </div>
            <p>未验证极限存在拆分、导数连续性混淆、可微与偏导存在边界模糊。</p>
            <button
              type="button"
              className="primary-button compact vault-card-btn"
              onClick={() => void onStart()}
            >
              🎯 启动概念反例辨析特训
            </button>
          </div>

          <div className="vault-card detour">
            <div className="vault-card-head">
              <strong>🔵 战术绕路库 (蛮干硬算/超时严重)</strong>
              <Zap size={18} style={{ color: 'var(--info)' }} />
            </div>
            <p>方法机械，陷入代数黑洞；缺乏 King 变换、待定系数法与特征多项式秒杀技巧。</p>
            <button
              type="button"
              className="primary-button compact vault-card-btn"
              onClick={() => void onStart()}
            >
              ⚡ 启动考场秒杀技巧特训
            </button>
          </div>
        </div>
      </section>

      {/* Question Detail Modal */}
      <AnimatePresence>
        {detailModalQuestion && (
          <QuestionDetail
            question={detailModalQuestion}
            close={() => setDetailModalQuestion(null)}
            add={() => void addToCustomQueue(detailModalQuestion.id)}
            practice={() => {
              setDetailModalQuestion(null)
              onPractice(detailModalQuestion)
            }}
            onChange={(updated) => {
              setDetailModalQuestion(updated)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
