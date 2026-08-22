import { AnimatePresence } from 'framer-motion'
import {
  ChevronRight,
  FolderSearch,
  LoaderCircle,
  Play,
  RefreshCw,
  Sparkles,
  Target,
  TimerReset,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addToCustomQueue,
  getDailyLog,
  getInbox,
  getMasteryNodes,
  getQuestion,
  getReviewHistory,
  getReviewPlan,
  getReviewQueue,
} from '../api'
import { localToday, outcomeChip } from '../utils'
import { MathText } from '../components/MathText'
import { QuestionDetail } from '../components/QuestionDetailModal'
import { SubBranchArchiveModal } from '../components/SubBranchArchiveModal'
import type {
  AttemptOutcome,
  DailyLog,
  MasteryChapter,
  MasteryNode,
  Question,
  RecommendedQuestion,
  ReviewHistory,
  ReviewPlan,
} from '../types'

export type ReviewMapMode = 'debt' | 'mastery' | 'wrong' | 'ai'

export type ReviewBoardStats = MasteryChapter & {
  overdueCount: number
  wrongCount: number
  uncertainCount: number
  aiCount: number
  recentCount: number
  modeValue: string
  state: string
}

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
}

export function reviewCategoryMatches(chapter: MasteryChapter, categoryPath: string): boolean {
  const parts = categoryPath.split(' / ')
  return (
    parts[0] === chapter.rootName &&
    (parts.includes(chapter.name) || categoryPath.includes(chapter.name))
  )
}

export function reviewBoardState(
  chapter: MasteryChapter,
  stats: { dueCount: number; overdueCount: number; wrongCount: number; aiCount: number }
): string {
  if (stats.overdueCount > 0) return 'overdue'
  if (stats.dueCount > 0) return 'due'
  if (stats.aiCount > 0) return 'ai'
  if (stats.wrongCount > 0) return 'weak'
  if (chapter.attempted === 0) return 'unseen'
  if (chapter.masteryScore === null) return 'insufficient'
  return chapter.masteryScore >= 75 ? 'strong' : chapter.masteryScore >= 50 ? 'steady' : 'weak'
}

export function ReviewMapView({
  due,
  inboxCount,
  intervals,
  chapters,
  notify,
  onStart,
  onOpenWrongBook,
  onPractice,
  onPracticeBatch,
  onStartVariant,
  onOpenInbox,
}: {
  due: number
  inboxCount: number
  intervals: number[]
  chapters: MasteryChapter[]
  notify: (text: string) => void
  onStart: () => Promise<void>
  onOpenWrongBook: () => void
  onPractice: (question: Question) => void
  onPracticeBatch: (questions: Question[], reason: string) => void
  onStartVariant: (questionId: number) => void
  onOpenInbox: () => void
}) {
  const [history, setHistory] = useState<ReviewHistory | null>(null)
  const [plan, setPlan] = useState<ReviewPlan | null>(null)
  const [dueQueue, setDueQueue] = useState<RecommendedQuestion[]>([])
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null)
  const [nodes, setNodes] = useState<MasteryNode[]>([])
  const [inboxCategories, setInboxCategories] = useState<Record<number, string>>({})
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null)
  const [mapMode, setMapMode] = useState<ReviewMapMode>('debt')
  const [selectedSubject, setSelectedSubject] = useState('all')
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const selectionInitialized = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextHistory, nextPlan, nextDueQueue, nextLog, nextNodes, nextInbox] =
        await Promise.all([
          getReviewHistory(),
          getReviewPlan(),
          getReviewQueue(50),
          getDailyLog(),
          getMasteryNodes(),
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
      setHistory(nextHistory)
      setPlan(nextPlan)
      setDueQueue(nextDueQueue)
      setDailyLog(nextLog)
      setNodes(nextNodes)
      setInboxCategories(
        Object.fromEntries(
          categoryEntries.filter(
            (entry): entry is readonly [number, string] => entry !== null
          )
        )
      )
    } catch (loadError) {
      setError(String(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const today = localToday()
  const displayedDue = dueQueue.length > 0 ? dueQueue.length : due
  const boardChapters = useMemo<MasteryChapter[]>(() => {
    const fallback = new Map<string, { rootName: string; name: string; total: number }>()
    for (const path of [...(plan?.items ?? []), ...(history?.items ?? [])]
      .map((item) => item.categoryPath)
      .concat(dueQueue.map((item) => item.question.categoryPath))) {
      const parts = path.split(' / ')
      const rootName = parts[0] || '未分类'
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
        evidence: '计划或历史中出现，掌握地图尚未建立证据',
        evidenceLevel: '待建立掌握证据',
        evidenceSources: [],
        retestCorrectCount: 0,
      }))
    return [...chapters, ...synthetic]
  }, [chapters, plan, history, dueQueue])

  const subjects = useMemo(
    () => Array.from(new Set(boardChapters.map((chapter) => chapter.rootName))),
    [boardChapters]
  )

  const diagnosisByQuestion = useMemo(() => {
    const map = new Map<number, DailyLog['items'][number]>()
    for (const item of dailyLog?.items ?? []) {
      if (!map.has(item.questionId)) map.set(item.questionId, item)
    }
    return map
  }, [dailyLog])

  const boardStats = useMemo<ReviewBoardStats[]>(() => {
    return boardChapters.map((chapter) => {
      const planItems = (plan?.items ?? []).filter((item) =>
        reviewCategoryMatches(chapter, item.categoryPath)
      )
      const historyItems = (history?.items ?? []).filter((item) =>
        reviewCategoryMatches(chapter, item.categoryPath)
      )
      const wrongIds = new Set(
        historyItems
          .filter((item) => item.result === 'wrong' || item.result === 'partial')
          .map((item) => item.questionId)
      )
      const uncertainIds = new Set(
        historyItems.filter((item) => item.result === 'uncertain').map((item) => item.questionId)
      )
      const dueQueueItems = dueQueue.filter((item) =>
        reviewCategoryMatches(chapter, item.question.categoryPath)
      )
      const aiCount = Object.values(inboxCategories).filter((path) =>
        reviewCategoryMatches(chapter, path)
      ).length
      const dueCount = dueQueueItems.length
      const overdueCount =
        dueQueueItems.filter(
          (item) => item.question.nextReview !== null && item.question.nextReview < today
        ).length || planItems.filter((item) => item.nextReview < today).length
      const stats = { dueCount, overdueCount, wrongCount: wrongIds.size, aiCount }
      const state = reviewBoardState(chapter, stats)
      const modeValue =
        mapMode === 'mastery'
          ? chapter.masteryScore === null
            ? '--'
            : `${Math.round(chapter.masteryScore)}`
          : mapMode === 'wrong'
          ? `${wrongIds.size}`
          : mapMode === 'ai'
          ? `${aiCount}`
          : `${dueCount}`
      return {
        ...chapter,
        dueCount,
        overdueCount,
        wrongCount: wrongIds.size,
        uncertainCount: uncertainIds.size,
        aiCount,
        recentCount: historyItems.length,
        modeValue,
        state,
      }
    })
  }, [boardChapters, plan, history, dueQueue, inboxCategories, today, mapMode])

  const totalOverdue = useMemo(
    () => boardStats.reduce((sum, board) => sum + board.overdueCount, 0),
    [boardStats]
  )
  const uniqueWrongCount = useMemo(
    () =>
      new Set(
        (history?.items ?? [])
          .filter((item) => item.result === 'wrong' || item.result === 'partial')
          .map((item) => item.questionId)
      ).size,
    [history]
  )
  const uniqueUncertainCount = useMemo(
    () =>
      new Set(
        (history?.items ?? [])
          .filter((item) => item.result === 'uncertain')
          .map((item) => item.questionId)
      ).size,
    [history]
  )

  const visibleBoards = useMemo(() => {
    const filtered = boardStats.filter(
      (board) => selectedSubject === 'all' || board.rootName === selectedSubject
    )
    return [...filtered].sort((a, b) => {
      if (mapMode === 'mastery') return (b.masteryScore ?? -1) - (a.masteryScore ?? -1)
      if (mapMode === 'wrong') return b.wrongCount - a.wrongCount || b.dueCount - a.dueCount
      if (mapMode === 'ai') return b.aiCount - a.aiCount || b.wrongCount - a.wrongCount
      return (
        b.overdueCount * 10 +
        b.dueCount * 3 +
        b.wrongCount -
        (a.overdueCount * 10 + a.dueCount * 3 + a.wrongCount)
      );
    })
  }, [boardStats, selectedSubject, mapMode])

  useEffect(() => {
    if (loading || visibleBoards.length === 0) return
    if (
      !selectionInitialized.current ||
      !visibleBoards.some((board) => board.id === selectedBoardId)
    ) {
      setSelectedBoardId(visibleBoards[0].id)
      selectionInitialized.current = true
    }
  }, [loading, visibleBoards, selectedBoardId])

  const selectedBoard = boardStats.find((board) => board.id === selectedBoardId) ?? null
  const [archiveModalNode, setArchiveModalNode] = useState<MasteryNode | null>(null)

  const selectedNodes = useMemo(
    () =>
      nodes
        .filter((node) => selectedBoard && node.chapterId === selectedBoard.id && node.depth >= 3)
        .sort((a, b) => b.dueCount + b.weakCount - (a.dueCount + a.weakCount) || b.total - a.total)
        .slice(0, 10),
    [nodes, selectedBoard]
  )

  const selectedBoardItems = useMemo<ReviewBoardQuestion[]>(() => {
    if (!selectedBoard) return []
    const map = new Map<number, ReviewBoardQuestion>()
    for (const item of dueQueue) {
      if (!reviewCategoryMatches(selectedBoard, item.question.categoryPath)) continue
      const diagnosis = diagnosisByQuestion.get(item.question.id)
      map.set(item.question.id, {
        questionId: item.question.id,
        stem: item.question.stem,
        categoryPath: item.question.categoryPath,
        source: item.question.source,
        kind: 'due',
        result: null,
        scheduledDate: item.question.nextReview,
        attemptedAt: null,
        earliestError: diagnosis?.aiEarliestError ?? null,
        advice: diagnosis?.aiAdvice ?? null,
      })
    }
    for (const item of plan?.items ?? []) {
      if (!reviewCategoryMatches(selectedBoard, item.categoryPath)) continue
      if (map.has(item.questionId)) continue
      const diagnosis = diagnosisByQuestion.get(item.questionId)
      map.set(item.questionId, {
        questionId: item.questionId,
        stem: item.stem,
        categoryPath: item.categoryPath,
        source: item.source,
        kind: 'due',
        result: null,
        scheduledDate: item.scheduledDate,
        attemptedAt: null,
        earliestError: diagnosis?.aiEarliestError ?? null,
        advice: diagnosis?.aiAdvice ?? null,
      })
    }
    for (const item of history?.items ?? []) {
      if (
        !reviewCategoryMatches(selectedBoard, item.categoryPath) ||
        (item.result !== 'wrong' && item.result !== 'partial' && item.result !== 'uncertain')
      )
        continue
      const diagnosis = diagnosisByQuestion.get(item.questionId)
      map.set(item.questionId, {
        questionId: item.questionId,
        stem: item.stem,
        categoryPath: item.categoryPath,
        source: item.source,
        kind: item.result === 'uncertain' ? 'uncertain' : 'wrong',
        result: item.result,
        scheduledDate: null,
        attemptedAt: item.attemptedAt,
        earliestError: diagnosis?.aiEarliestError ?? null,
        advice: diagnosis?.aiAdvice ?? null,
      })
    }
    return [...map.values()]
      .sort((a, b) => {
        const priority = (kind: ReviewBoardQuestion['kind']) =>
          kind === 'wrong' ? 0 : kind === 'uncertain' ? 1 : 2
        return priority(a.kind) - priority(b.kind) || a.questionId - b.questionId
      })
      .slice(0, 12)
  }, [selectedBoard, dueQueue, plan, history, diagnosisByQuestion])

  const startBoardPractice = async (kind: 'due' | 'wrong') => {
    if (!selectedBoard) return
    const candidates =
      kind === 'due'
        ? dueQueue.filter((item) =>
            reviewCategoryMatches(selectedBoard, item.question.categoryPath)
          )
        : (history?.items ?? []).filter(
            (item) =>
              reviewCategoryMatches(selectedBoard, item.categoryPath) &&
              (item.result === 'wrong' || item.result === 'partial')
          )
    const ids = Array.from(
      new Set(
        candidates.map((item) => ('question' in item ? item.question.id : item.questionId))
      )
    )
    if (ids.length === 0) {
      notify(kind === 'due' ? '这个板块目前没有到期题目' : '这个板块目前没有已确认的错题')
      return
    }
    setActionLoading(true)
    try {
      const questions = await Promise.all(ids.map((id) => getQuestion(id)))
      onPracticeBatch(
        questions,
        `${kind === 'due' ? '到期复习' : '错题修复'} · ${selectedBoard.rootName} / ${
          selectedBoard.name
        }`
      )
    } catch (actionError) {
      notify(`加载板块题目失败：${String(actionError)}`)
    } finally {
      setActionLoading(false)
    }
  }

  const practiceSingle = async (questionId: number) => {
    try {
      onPractice(await getQuestion(questionId))
    } catch (actionError) {
      notify(`无法打开题目：${String(actionError)}`)
    }
  }

  const startBoardVariant = () => {
    const item =
      selectedBoardItems.find((candidate) => candidate.kind === 'wrong') ??
      selectedBoardItems[0]
    if (item) onStartVariant(item.questionId)
    else notify('这个板块还没有可用于生成变式题的题目')
  }

  const modeMeta: Record<ReviewMapMode, { label: string; hint: string }> = {
    debt: { label: '复习债务', hint: '颜色和排序优先显示今天最该处理的板块' },
    mastery: { label: '掌握度', hint: '只使用已确认、可评分的证据' },
    wrong: { label: '错题密度', hint: '按近 7 天不同错题数量排序' },
    ai: { label: 'AI 薄弱点', hint: '显示待确认诊断所在的板块' },
  }

  const recentHistory = useMemo(
    () =>
      [...(history?.items ?? [])]
        .sort((a, b) => b.attemptedAt.localeCompare(a.attemptedAt))
        .slice(0, 8),
    [history]
  )

  return (
    <div className="review-view review-map-view">
      <section className="review-map-intro">
        <div>
          <span>复习地图 · 数学一</span>
          <h2>先定位板块，再开始修复</h2>
          <p>
            把到期题、错题、AI 诊断和掌握证据放回同一张地图。点击板块后，直接进入对应的复习或变式训练。
          </p>
        </div>
        <div className="review-map-intro-actions">
          <button className="secondary-button" onClick={onOpenWrongBook}>
            <FolderSearch size={15} /> 全部错题
          </button>
          <button className="primary-button" onClick={() => void onStart()}>
            <TimerReset size={15} /> 开始今日复习 ({displayedDue})
          </button>
          <button
            className="icon-button"
            title="刷新复习地图"
            aria-label="刷新复习地图"
            onClick={() => void load()}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </section>

      <section className="review-map-summary" aria-label="复习债务概览">
        <button className={displayedDue > 0 ? 'active' : ''} onClick={() => void onStart()}>
          <span>今日到期</span>
          <strong>{displayedDue}</strong>
          <small>{displayedDue ? '现在开始处理' : '今天没有到期题'}</small>
        </button>
        <button
          className={totalOverdue > 0 ? 'active danger' : ''}
          onClick={() => setMapMode('debt')}
        >
          <span>已逾期</span>
          <strong>{totalOverdue}</strong>
          <small>{totalOverdue ? '地图已优先标红' : '没有逾期积压'}</small>
        </button>
        <button className={inboxCount > 0 ? 'active ai' : ''} onClick={onOpenInbox}>
          <span>AI 待确认</span>
          <strong>{inboxCount}</strong>
          <small>{inboxCount ? '去确认诊断证据' : '当前已清空'}</small>
        </button>
        <button
          className={uniqueWrongCount > 0 ? 'active wrong' : ''}
          onClick={() => setMapMode('wrong')}
        >
          <span>近 7 日错题</span>
          <strong>{uniqueWrongCount}</strong>
          <small>
            {uniqueUncertainCount ? `另有 ${uniqueUncertainCount} 道待确认` : '按不同题目计数'}
          </small>
        </button>
      </section>

      <section className="review-map-controls">
        <div className="review-map-modes" role="tablist" aria-label="地图查看模式">
          {(Object.keys(modeMeta) as ReviewMapMode[]).map((mode) => (
            <button
              key={mode}
              className={mapMode === mode ? 'active' : ''}
              onClick={() => setMapMode(mode)}
              role="tab"
              aria-selected={mapMode === mode}
            >
              {modeMeta[mode].label}
            </button>
          ))}
        </div>
        <div className="review-map-subjects" aria-label="学科筛选">
          <button
            className={selectedSubject === 'all' ? 'active' : ''}
            onClick={() => setSelectedSubject('all')}
          >
            全部
          </button>
          {subjects.map((subject) => (
            <button
              key={subject}
              className={selectedSubject === subject ? 'active' : ''}
              onClick={() => setSelectedSubject(subject)}
            >
              {subject}
            </button>
          ))}
        </div>
        <p>{modeMeta[mapMode].hint}</p>
      </section>

      {error && (
        <div className="review-map-error">
          <span>复习地图读取失败：{error}</span>
          <button className="secondary-button compact" onClick={() => void load()}>
            重试
          </button>
        </div>
      )}

      {loading ? (
        <div className="review-map-loading">
          <LoaderCircle className="spin" size={20} /> 正在整理复习板块
        </div>
      ) : (
        <div className="review-map-layout">
          <section className="review-board-panel">
            <header className="review-board-panel-head">
              <div>
                <span>板块地图</span>
                <h3>
                  {visibleBoards.length} 个板块 · {modeMeta[mapMode].label}
                </h3>
              </div>
              <small>面积代表题量，颜色代表当前处理状态</small>
            </header>
            {visibleBoards.length === 0 ? (
              <div className="review-map-empty">当前筛选下没有可展示的板块。</div>
            ) : (
              <div className="review-board-grid">
                {visibleBoards.map((board) => {
                  const score = board.masteryScore === null ? 0 : Math.round(board.masteryScore)
                  const progress =
                    mapMode === 'mastery'
                      ? score
                      : mapMode === 'debt'
                      ? Math.min(100, board.overdueCount * 35 + board.dueCount * 18)
                      : mapMode === 'wrong'
                      ? Math.min(100, board.wrongCount * 18)
                      : Math.min(100, board.aiCount * 25)
                  return (
                    <button
                      key={board.id}
                      className={`review-board-tile ${board.state} ${
                        selectedBoardId === board.id ? 'selected' : ''
                      }`}
                      style={{
                        flexGrow: Math.max(1, Math.min(3, Math.ceil(board.total / 160))),
                      }}
                      onClick={() => setSelectedBoardId(board.id)}
                    >
                      <div className="review-board-tile-head">
                        <span>{board.rootName}</span>
                        <b>
                          {board.state === 'overdue'
                            ? '逾期'
                            : board.state === 'due'
                            ? '待复习'
                            : board.state === 'ai'
                            ? '待确认'
                            : board.state === 'weak'
                            ? '需修复'
                            : board.masteryScore === null
                            ? '数据不足'
                            : '稳定'}
                        </b>
                      </div>
                      <h3>{board.name}</h3>
                      <p>
                        {board.dueCount} 到期 · {board.wrongCount} 错题 · {board.aiCount} 待确认
                      </p>
                      <div className="review-board-value">
                        <strong>{board.modeValue}</strong>
                        <span>{modeMeta[mapMode].label}</span>
                      </div>
                      <div className="review-board-progress">
                        <i style={{ width: `${progress}%` }} />
                      </div>
                      <div className="review-board-stats">
                        <span>
                          掌握{' '}
                          <b>
                            {board.masteryScore === null
                              ? '--'
                              : `${Math.round(board.masteryScore)}分`}
                          </b>
                        </span>
                        <span>
                          逾期 <b>{board.overdueCount}</b>
                        </span>
                        <span>
                          证据 <b>{board.attemptCount}</b>
                        </span>
                      </div>
                      <div className="review-board-footer">
                        <span>{board.evidenceLevel}</span>
                        <ChevronRight size={16} />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            <div className="review-map-legend">
              <span>
                <i className="overdue" />逾期
              </span>
              <span>
                <i className="due" />到期
              </span>
              <span>
                <i className="weak" />需修复
              </span>
              <span>
                <i className="strong" />证据稳定
              </span>
              <span>
                <i className="unseen" />暂无证据
              </span>
            </div>
          </section>

          {selectedBoard && (
            <aside
              className="review-board-drawer"
              aria-label={`${selectedBoard.name}板块详情`}
            >
              <header>
                <div>
                  <span>{selectedBoard.rootName} · 当前板块</span>
                  <h3>{selectedBoard.name}</h3>
                  <small>{selectedBoard.evidenceLevel}</small>
                </div>
                <button
                  className="icon-button"
                  title="关闭板块详情"
                  aria-label="关闭板块详情"
                  onClick={() => setSelectedBoardId(null)}
                >
                  <X size={16} />
                </button>
              </header>
              <div className="review-board-drawer-scroll">
                <div className={`review-board-status ${selectedBoard.state}`}>
                  <strong>
                    {selectedBoard.overdueCount > 0
                      ? '这个板块有逾期积压'
                      : selectedBoard.dueCount > 0
                      ? '这个板块今天需要复习'
                      : selectedBoard.wrongCount > 0
                      ? '这个板块存在待修复错题'
                      : '当前没有紧急债务'}
                  </strong>
                  <span>
                    {selectedBoard.masteryScore === null
                      ? '掌握度：数据不足'
                      : `掌握度：${Math.round(selectedBoard.masteryScore)}分`}
                  </span>
                </div>
                <div className="review-board-drawer-stats">
                  <div>
                    <strong>{selectedBoard.dueCount}</strong>
                    <span>到期题</span>
                  </div>
                  <div>
                    <strong>{selectedBoard.wrongCount}</strong>
                    <span>不同错题</span>
                  </div>
                  <div>
                    <strong>{selectedBoard.aiCount}</strong>
                    <span>AI 待确认</span>
                  </div>
                  <div>
                    <strong>{selectedBoard.attemptCount}</strong>
                    <span>有效作答</span>
                  </div>
                </div>
                <div className="review-board-actions">
                  <button
                    className="primary-button"
                    disabled={actionLoading || selectedBoard.dueCount === 0}
                    onClick={() => void startBoardPractice('due')}
                  >
                    <Play size={15} />{' '}
                    {actionLoading ? '正在准备…' : `开始到期复习 (${selectedBoard.dueCount})`}
                  </button>
                  <button
                    className="secondary-button"
                    disabled={actionLoading || selectedBoard.wrongCount === 0}
                    onClick={() => void startBoardPractice('wrong')}
                  >
                    <Target size={15} /> 只练错题 ({selectedBoard.wrongCount})
                  </button>
                  <button
                    className="secondary-button variant"
                    disabled={selectedBoardItems.length === 0}
                    onClick={startBoardVariant}
                  >
                    <Sparkles size={15} /> 练同类变式
                  </button>
                </div>

                <section className="review-board-drawer-section">
                  <header>
                    <h4>知识点子板块</h4>
                    <span>{selectedNodes.length} 个考点 · 点击打开全景档案</span>
                  </header>
                  {selectedNodes.length === 0 ? (
                    <p className="review-board-muted">还没有更细的掌握度证据。</p>
                  ) : (
                    <div className="review-node-list">
                      {selectedNodes.map((node) => (
                        <button
                          key={node.id}
                          className={`review-node-row ${
                            node.masteryScore !== null && node.masteryScore < 50 ? 'weak' : ''
                          }`}
                          onClick={() => setArchiveModalNode(node)}
                          title="点击打开此考点全景做题档案大弹窗"
                        >
                          <div>
                            <b>{node.name}</b>
                            <small>{node.evidenceLevel}</small>
                          </div>
                          <span>
                            {node.masteryScore === null
                              ? '--'
                              : `${Math.round(node.masteryScore)}分`}
                          </span>
                          <div className="review-node-row-meta">
                            <span>
                              {node.attempted}/{node.total} 题已做 · {node.dueCount} 到期 ·{' '}
                              {node.weakCount} 薄弱
                            </span>
                            <span className="node-drill-tag">全景档案 ↗</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="review-board-drawer-section">
                  <header>
                    <h4>板块中的复习题</h4>
                    <span>{selectedBoardItems.length} 条</span>
                  </header>
                  {selectedBoardItems.length === 0 ? (
                    <p className="review-board-muted">这个板块暂时没有待处理题目。</p>
                  ) : (
                    <div className="review-board-question-list">
                      {selectedBoardItems.map((item) => (
                        <article key={`${item.kind}-${item.questionId}`}>
                          <button
                            className="review-board-question-main"
                            onClick={() => void practiceSingle(item.questionId)}
                          >
                            <span className={`review-question-kind ${item.kind}`}>
                              {item.kind === 'due'
                                ? '待复习'
                                : item.kind === 'wrong'
                                ? '错题'
                                : '待确认'}
                            </span>
                            <b>#{item.questionId}</b>
                            <MathText value={item.stem} />
                            <small>
                              {item.scheduledDate
                                ? `下次复习 ${item.scheduledDate}`
                                : item.attemptedAt
                                ? `最近作答 ${item.attemptedAt.slice(5, 16).replace('T', ' ')}`
                                : item.source}
                            </small>
                          </button>
                          {item.earliestError ? (
                            <div className="review-board-evidence">
                              <span>最早错误</span>
                              <p>
                                <MathText value={item.earliestError} />
                              </p>
                              {item.advice && (
                                <small>
                                  修复动作：<MathText value={item.advice} />
                                </small>
                              )}
                            </div>
                          ) : (
                            <div className="review-board-evidence muted">
                              <span>证据状态</span>
                              <p>
                                {item.kind === 'uncertain'
                                  ? '结果不确定，不计入正确率与掌握度。'
                                  : '暂时没有 AI 最早错误诊断。'}
                              </p>
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </aside>
          )}
        </div>
      )}

      <section className="review-trace-card">
        <header>
          <div>
            <span>最近 7 天</span>
            <h3>复习轨迹</h3>
          </div>
          <small>不确定结果只保留诊断，不进入正确率与掌握度</small>
        </header>
        {recentHistory.length === 0 ? (
          <div className="review-map-empty">
            还没有复习轨迹，完成第一道复习题后会出现在这里。
          </div>
        ) : (
          <div className="review-trace-list">
            {recentHistory.map((item) => {
              const result = outcomeChip(item.result)
              return (
                <button
                  key={`${item.attemptId}-${item.questionId}`}
                  onClick={() => {
                    const board = boardStats.find((candidate) =>
                      reviewCategoryMatches(candidate, item.categoryPath)
                    )
                    if (board) setSelectedBoardId(board.id)
                    void practiceSingle(item.questionId)
                  }}
                >
                  <span className={`result-dot ${result.tone}`}>{result.symbol}</span>
                  <div>
                    <b>
                      #{item.questionId} ·{' '}
                      {item.categoryPath.split(' / ').slice(-2).join(' / ')}
                    </b>
                    <small>
                      {item.attemptedAt.slice(5, 16).replace('T', ' ')} · 自评{' '}
                      {item.selfRating}/4{result.note ? ` · ${result.note}` : ''}
                    </small>
                  </div>
                  <ChevronRight size={15} />
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="review-interval-strip">
        <span>间隔规则</span>
        {intervals.slice(0, 4).map((interval, index) => (
          <div key={interval}>
            <b>{index + 1}分</b>
            <small>{interval} 天后复习</small>
          </div>
        ))}
        <span className="review-interval-note">
          评分只决定下一次复习间隔；AI 诊断和作答结果共同决定板块状态。
        </span>
      </section>

      <AnimatePresence>
        {selectedQuestion && (
          <QuestionDetail
            question={selectedQuestion}
            close={() => setSelectedQuestion(null)}
            add={() => {
              void addToCustomQueue(selectedQuestion.id)
                .then(() => notify(`已将错题 #${selectedQuestion.id} 加入训练队列`))
                .catch((actionError) => notify(`无法加入训练队列：${String(actionError)}`))
            }}
            practice={() => {
              onPractice(selectedQuestion)
              setSelectedQuestion(null)
            }}
            onChange={setSelectedQuestion}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {archiveModalNode && (
          <SubBranchArchiveModal
            node={archiveModalNode}
            today={today}
            dailyLog={dailyLog}
            onClose={() => setArchiveModalNode(null)}
            onPractice={onPractice}
            onStartVariant={onStartVariant}
            onAddToQueue={(qid) => {
              void addToCustomQueue(qid)
                .then(() => notify(`已将 #${qid} 加入训练队列`))
                .catch((err) => notify(`加入队列失败: ${String(err)}`))
            }}
            onViewDetail={(q) => setSelectedQuestion(q)}
            onPracticeBatch={onPracticeBatch}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
