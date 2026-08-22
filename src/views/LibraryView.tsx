import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  ChevronDown,
  ChevronRight,
  ListPlus,
  Play,
  Search,
  Sparkles,
  Target,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  addToCustomQueue,
  clearCustomQueue,
  getCategories,
  getCustomQueue,
  getFocusQueue,
  getMasteryMap,
  getMasteryNodes,
  removeFromCustomQueue,
  searchQuestionPage,
  setCurrentChapter,
  setFocusBranches,
} from '../api'
import { EmptyState } from '../components/EmptyState'
import { MathText } from '../components/MathText'
import { Pagination } from '../components/Pagination'
import { QuestionDetail } from '../components/QuestionDetailModal'
import { QueueDrawer } from '../components/QueueDrawer'
import { masteryState } from './MasteryMapView'
import type {
  BootstrapData,
  CategoryNode,
  MasteryChapter,
  MasteryNode,
  Question,
  QuestionPage,
  RecommendedQuestion,
} from '../types'

type SectionWithChildren = {
  section: MasteryNode
  children: MasteryNode[]
}

export function FocusView({
  data,
  refresh,
  onStart,
  notify,
}: {
  data: BootstrapData
  refresh: () => void
  onStart: (queue?: RecommendedQuestion[]) => void
  notify: (text: string) => void
}) {
  const [chapters, setChapters] = useState<MasteryChapter[]>([])
  const [nodes, setNodes] = useState<MasteryNode[]>([])
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set())
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(data.currentFocusCategoryIds ?? [])
  )
  const [limit, setLimit] = useState(15)
  const [loading, setLoading] = useState(false)

  // Load once on mount
  useEffect(() => {
    void Promise.all([getMasteryMap(), getMasteryNodes()]).then(([c, n]) => {
      setChapters(c)
      setNodes(n)
    })
  }, [])

  // Sync initial focus category IDs if they change from external bootstrap
  useEffect(() => {
    if (data.currentFocusCategoryIds && data.currentFocusCategoryIds.length > 0) {
      setSelectedIds(new Set(data.currentFocusCategoryIds))
    }
  }, [data.currentFocusCategoryIds])

  // Build high-performance lookup tree: Chapter -> Sections -> Sub-branches
  const chapterTree = useMemo(() => {
    const tree = new Map<number, SectionWithChildren[]>()
    const nodesByChapter = new Map<number, MasteryNode[]>()
    for (const node of nodes) {
      const list = nodesByChapter.get(node.chapterId) ?? []
      list.push(node)
      nodesByChapter.set(node.chapterId, list)
    }

    for (const chapter of chapters) {
      const chNodes = nodesByChapter.get(chapter.id) ?? []
      const depth2Nodes = chNodes.filter((n) => n.depth === 2)
      const secList: SectionWithChildren[] = []

      if (depth2Nodes.length > 0) {
        for (const sec of depth2Nodes) {
          const children = chNodes.filter((n) => n.parentId === sec.id && n.depth === 3)
          secList.push({ section: sec, children })
        }
      } else {
        const depth3Nodes = chNodes.filter((n) => n.depth >= 2)
        for (const leaf of depth3Nodes) {
          secList.push({ section: leaf, children: [] })
        }
      }
      tree.set(chapter.id, secList)
    }
    return tree
  }, [chapters, nodes])

  const bySubject = useMemo(() => {
    const map = new Map<string, MasteryChapter[]>()
    for (const chapter of chapters) {
      const subject = chapter.rootName || '其他'
      map.set(subject, [...(map.get(subject) ?? []), chapter])
    }
    return map
  }, [chapters])

  const orderedSubjects = useMemo(() => {
    const subjectOrder = ['高等数学', '线性代数', '概率统计']
    return [...bySubject.keys()].sort((a, b) => {
      const ia = subjectOrder.indexOf(a)
      const ib = subjectOrder.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
  }, [bySubject])

  const toggleExpand = (chapterId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedChapters((prev) => {
      const next = new Set(prev)
      if (next.has(chapterId)) next.delete(chapterId)
      else next.add(chapterId)
      return next
    })
  }

  const toggleNode = (nodeId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const toggleSection = (sec: SectionWithChildren, e: React.MouseEvent) => {
    e.stopPropagation()
    const targetIds =
      sec.children.length > 0 ? sec.children.map((c) => c.id) : [sec.section.id]
    const isAllSelected = targetIds.every((id) => selectedIds.has(id))

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (isAllSelected) {
        targetIds.forEach((id) => next.delete(id))
        next.delete(sec.section.id)
      } else {
        targetIds.forEach((id) => next.add(id))
        next.add(sec.section.id)
      }
      return next
    })
  }

  const toggleChapterAll = (chapterId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const sections = chapterTree.get(chapterId) ?? []
    const allIds: number[] = []
    for (const sec of sections) {
      if (sec.children.length > 0) {
        sec.children.forEach((c) => allIds.push(c.id))
      }
      allIds.push(sec.section.id)
    }
    const isAllSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (isAllSelected) {
        allIds.forEach((id) => next.delete(id))
        next.delete(chapterId)
      } else {
        allIds.forEach((id) => next.add(id))
        next.add(chapterId)
      }
      return next
    })
  }

  const chooseWholeChapter = async (chapter: MasteryChapter) => {
    try {
      await setCurrentChapter(chapter.id)
      await refresh()
      notify(`已进入「${chapter.name}」首轮`)
      onStart()
    } catch (err) {
      notify(`无法进入章节：${String(err)}`)
    }
  }

  const startMultiBranchPractice = async (selectedLimit = limit) => {
    const ids = Array.from(selectedIds)
    if (!ids.length) {
      notify('请先至少勾选一个子分支考点')
      return
    }
    setLoading(true)
    try {
      await setFocusBranches(ids)
      const queue = await getFocusQueue(ids, selectedLimit)
      if (!queue.length) {
        notify('所选子分支今天已全部做完，请选择其他考点或调整题数')
        return
      }
      await refresh()
      notify(`已进入专项多分支训练，共 ${queue.length} 道题`)
      onStart(queue)
    } catch (err) {
      notify(`开始专项训练失败：${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const clearAllFocus = async () => {
    setSelectedIds(new Set())
    await setFocusBranches([])
    await setCurrentChapter(null)
    await refresh()
    notify('已退出专项训练，恢复全库推荐')
  }

  const stats = useMemo(() => {
    const selectedNodes = nodes.filter((n) => selectedIds.has(n.id))
    const totalQuestions = selectedNodes.reduce((sum, n) => sum + n.total, 0)
    const unattemptedQuestions = selectedNodes.reduce(
      (sum, n) => sum + Math.max(0, n.total - n.attempted),
      0
    )
    const weakQuestions = selectedNodes.reduce((sum, n) => sum + n.weakCount, 0)
    const dueQuestions = selectedNodes.reduce((sum, n) => sum + n.dueCount, 0)
    return { totalQuestions, unattemptedQuestions, weakQuestions, dueQuestions }
  }, [selectedIds, nodes])

  const activeFocusCount = data.currentFocusCategoryIds?.length ?? 0

  return (
    <div className="focus-view">
      <div className="section-intro">
        <span>数一 · 专项攻坚</span>
        <h2>逐级展开子考点与多分支组合训练</h2>
        <p>
          按大章节展开「考点大类」与「细分子分支」（如反函数求导、高阶导、切法线、渐近线等），自由勾选组合，定向突破。
        </p>
      </div>

      {(data.currentChapterName || activeFocusCount > 0) && (
        <div className="active-chapter-bar">
          <Target size={20} />
          <div>
            <span>当前活跃专项</span>
            <b>
              {data.currentChapterName
                ? `章节首轮 · ${data.currentChapterName}`
                : `多子分支专项 · 已选 ${activeFocusCount} 个考点`}
            </b>
          </div>
          <button className="primary-button compact" onClick={() => onStart()}>
            <Zap size={16} /> 继续训练
          </button>
          <button className="secondary-button compact" onClick={clearAllFocus}>
            退出专项
          </button>
        </div>
      )}

      {orderedSubjects.map((subject) => (
        <div key={subject} className="focus-subject">
          <div className="focus-subject-title">{subject}</div>
          <div className="chapter-list">
            {bySubject.get(subject)!.map((chapter, index) => {
              const sections = chapterTree.get(chapter.id) ?? []
              const isExpanded = expandedChapters.has(chapter.id)
              const isChapterActive = data.currentChapterId === chapter.id

              const allChapterSubIds: number[] = []
              for (const sec of sections) {
                if (sec.children.length > 0) {
                  sec.children.forEach((c) => allChapterSubIds.push(c.id))
                } else {
                  allChapterSubIds.push(sec.section.id)
                }
              }
              const chapterSelectedCount = allChapterSubIds.filter((id) =>
                selectedIds.has(id)
              ).length
              const isAllChapterSelected =
                allChapterSubIds.length > 0 &&
                chapterSelectedCount === allChapterSubIds.length
              const coveragePercent = Math.round(chapter.coverage * 100)
              const coverageGrade =
                coveragePercent === 0
                  ? 'grade-zero'
                  : coveragePercent <= 40
                  ? 'grade-low'
                  : coveragePercent <= 75
                  ? 'grade-mid'
                  : 'grade-high'

              return (
                <div key={chapter.id} className="focus-chapter-block">
                  <div className={isChapterActive ? 'chapter-row current' : 'chapter-row'}>
                    <button
                      type="button"
                      className={`focus-checkbox ${
                        isAllChapterSelected
                          ? 'checked'
                          : chapterSelectedCount > 0
                          ? 'indeterminate'
                          : ''
                      }`}
                      onClick={(e) => toggleChapterAll(chapter.id, e)}
                      title="勾选/取消勾选该章节全部考点"
                    >
                      {isAllChapterSelected ? (
                        <Check size={14} />
                      ) : chapterSelectedCount > 0 ? (
                        <span className="minus-bar" />
                      ) : null}
                    </button>
                    <span className="chapter-index">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div
                      className="chapter-info"
                      onClick={() => chooseWholeChapter(chapter)}
                    >
                      <b>{chapter.name}</b>
                      <small>
                        {chapter.attempted}/{chapter.total} 已覆盖 · {chapter.evidence}
                        {chapterSelectedCount > 0 && (
                          <span className="selected-tag">
                            已选 {chapterSelectedCount}/{allChapterSubIds.length} 子分支
                          </span>
                        )}
                      </small>
                    </div>
                    <div className={`mini-progress ${coverageGrade}`}>
                      <i style={{ width: `${chapter.coverage * 100}%` }} />
                    </div>
                    <strong>{coveragePercent}%</strong>
                    {sections.length > 0 && (
                      <button
                        type="button"
                        className={`expand-toggle-btn ${isExpanded ? 'expanded' : ''}`}
                        onClick={(e) => toggleExpand(chapter.id, e)}
                        title={isExpanded ? '收起子考点' : '展开子考点'}
                      >
                        <span>
                          {sections.length} 个考点组 · {allChapterSubIds.length} 个子分支
                        </span>
                        <motion.span
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                          style={{ display: 'inline-flex', alignItems: 'center' }}
                        >
                          <ChevronDown size={15} />
                        </motion.span>
                      </button>
                    )}
                  </div>

                  <AnimatePresence initial={false}>
                    {isExpanded && sections.length > 0 && (
                      <motion.div
                        className="focus-sections-container"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                        style={{ overflow: 'hidden' }}
                      >
                        {sections.map((sec) => {
                          const targetSubIds =
                            sec.children.length > 0
                              ? sec.children.map((c) => c.id)
                              : [sec.section.id]
                          const secSelectedCount = targetSubIds.filter((id) =>
                            selectedIds.has(id)
                          ).length
                          const isSecAll =
                            targetSubIds.length > 0 &&
                            secSelectedCount === targetSubIds.length

                          return (
                            <div key={sec.section.id} className="focus-section-group">
                              <div
                                className="focus-section-header"
                                onClick={(e) => toggleSection(sec, e)}
                              >
                                <button
                                  type="button"
                                  className={`focus-checkbox small ${
                                    isSecAll
                                      ? 'checked'
                                      : secSelectedCount > 0
                                      ? 'indeterminate'
                                      : ''
                                  }`}
                                  onClick={(e) => toggleSection(sec, e)}
                                  title="勾选该分类全部子分支"
                                >
                                  {isSecAll ? (
                                    <Check size={12} />
                                  ) : secSelectedCount > 0 ? (
                                    <span className="minus-bar" />
                                  ) : null}
                                </button>
                                <span className="focus-section-title">
                                  {sec.section.name}
                                </span>
                                <span className="focus-section-meta">
                                  {sec.section.attempted}/{sec.section.total} 题已做 ·{' '}
                                  {secSelectedCount}/{targetSubIds.length} 已选
                                </span>
                              </div>

                              <div className="sub-branch-grid">
                                {(sec.children.length > 0
                                  ? sec.children
                                  : [sec.section]
                                ).map((node) => {
                                  const isSelected = selectedIds.has(node.id)
                                  const state = masteryState(node)
                                  return (
                                    <motion.div
                                      key={node.id}
                                      whileHover={{
                                        y: -2,
                                        transition: { duration: 0.14 },
                                      }}
                                      whileTap={{ scale: 0.98 }}
                                      className={`sub-branch-card ${
                                        isSelected ? 'selected' : ''
                                      } ${state}`}
                                      onClick={(e) => toggleNode(node.id, e)}
                                    >
                                      <div className="sub-branch-head">
                                        <span
                                          className={`focus-checkbox small ${
                                            isSelected ? 'checked' : ''
                                          }`}
                                        >
                                          {isSelected && <Check size={11} />}
                                        </span>
                                        <b title={node.name}>{node.name}</b>
                                        <span className={`mastery-chip ${state}`}>
                                          {state === 'strong'
                                            ? '熟练'
                                            : state === 'steady'
                                            ? '稳健'
                                            : state === 'weak'
                                            ? '薄弱'
                                            : state === 'insufficient'
                                            ? '题少'
                                            : '未做'}
                                        </span>
                                      </div>
                                      <div className="sub-branch-stats">
                                        <span>
                                          题量: <b>{node.attempted}/{node.total}</b>
                                        </span>
                                        {node.weakCount > 0 && (
                                          <span className="stat-weak">
                                            薄弱: <b>{node.weakCount}</b>
                                          </span>
                                        )}
                                        {node.dueCount > 0 && (
                                          <span className="stat-due">
                                            待复习: <b>{node.dueCount}</b>
                                          </span>
                                        )}
                                        {node.masteryScore !== null && (
                                          <span>
                                            掌握: <b>{Math.round(node.masteryScore)}分</b>
                                          </span>
                                        )}
                                      </div>
                                    </motion.div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            className="focus-action-bar"
            initial={{ opacity: 0, y: 35, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 35, scale: 0.96 }}
            transition={{ type: 'spring', damping: 25, stiffness: 320 }}
          >
            <div className="focus-action-info">
              <Sparkles size={20} />
              <div>
                <strong>
                  已选 {selectedIds.size} 个子分支考点 · 预计 {stats.totalQuestions} 道题
                </strong>
                <span>
                  包含 {stats.unattemptedQuestions} 未做 · {stats.weakQuestions} 薄弱 ·{' '}
                  {stats.dueQuestions} 待复习
                </span>
              </div>
            </div>
            <div className="focus-action-controls">
              <div className="limit-selector">
                <span>题数:</span>
                {[10, 15, 20, 30].map((num) => (
                  <button
                    key={num}
                    className={limit === num ? 'active' : ''}
                    onClick={() => setLimit(num)}
                  >
                    {num}
                  </button>
                ))}
              </div>
              <button
                className="text-button compact"
                onClick={() => setSelectedIds(new Set())}
              >
                <Trash2 size={14} /> 清空
              </button>
              <button
                className="primary-button"
                disabled={loading}
                onClick={() => void startMultiBranchPractice()}
              >
                <Play size={16} /> 开始专项训练（{limit} 题）
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function LibraryView({
  data,
  initialStatus,
  queueCount,
  refresh,
  notify,
  onPractice,
  onPracticeFocus,
}: {
  data: BootstrapData
  initialStatus: string
  queueCount: number
  refresh: () => void
  notify: (text: string) => void
  onPractice: (questions: Question[], reason: string) => void
  onPracticeFocus?: (queue?: RecommendedQuestion[]) => void
}) {
  const [tab, setTab] = useState<'browse' | 'focus'>('focus')
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [status, setStatus] = useState(initialStatus)
  const [scope, setScope] = useState('complete')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set([223]))
  const [result, setResult] = useState<QuestionPage>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 50,
    pageCount: 0,
  })
  const [busy, setBusy] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [queueOpen, setQueueOpen] = useState(false)
  const [customQueue, setCustomQueue] = useState<Question[]>([])
  const [queuedIds, setQueuedIds] = useState<Set<number>>(new Set())
  const [queueActionId, setQueueActionId] = useState<number | null>(null)

  useEffect(() => {
    void getCategories().then(setCategories)
  }, [])
  useEffect(() => {
    void getCustomQueue().then((items) =>
      setQueuedIds(new Set(items.map((item) => item.id)))
    )
  }, [])
  useEffect(() => {
    setStatus(initialStatus)
  }, [initialStatus])
  useEffect(() => {
    setPage(1)
  }, [query, categoryId, status, scope, pageSize])
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusy(true)
      void searchQuestionPage({ query, categoryId, status, scope, page, pageSize })
        .then(setResult)
        .finally(() => setBusy(false))
    }, 160)
    return () => clearTimeout(timer)
  }, [query, categoryId, status, scope, page, pageSize])

  const children = (parentId: number | null) =>
    categories.filter((item) => item.parentId === parentId)
  const renderNode = (node: CategoryNode) => {
    const nested = children(node.id)
    const isOpen = expanded.has(node.id)
    return (
      <div className="category-branch" key={node.id}>
        <div
          className={categoryId === node.id ? 'category-row active' : 'category-row'}
          style={{ paddingLeft: `${10 + node.depth * 13}px` }}
        >
          <button
            className="tree-toggle"
            disabled={nested.length === 0}
            title={isOpen ? '收起' : '展开'}
            onClick={() =>
              setExpanded((old) => {
                const next = new Set(old)
                if (isOpen) next.delete(node.id)
                else next.add(node.id)
                return next
              })
            }
          >
            {nested.length > 0 ? (
              isOpen ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )
            ) : (
              <span />
            )}
          </button>
          <button className="category-select" onClick={() => setCategoryId(node.id)}>
            <span>{node.name}</span>
            <b>{node.questionCount}</b>
          </button>
        </div>
        {isOpen && nested.map(renderNode)}
      </div>
    )
  }

  const currentCategory = categories.find((item) => item.id === categoryId)
  const activeFilterCount =
    (categoryId !== null ? 1 : 0) +
    (scope !== 'complete' ? 1 : 0) +
    (status !== 'all' ? 1 : 0) +
    (query.trim() ? 1 : 0)
  const scopeLabel = scope === 'core' ? '核心' : scope === 'truth' ? '真题' : '完整'
  const statusLabel =
    status === 'unseen'
      ? '未做'
      : status === 'wrong'
      ? '错题'
      : status === 'favorite'
      ? '收藏'
      : status === 'noted'
      ? '有笔记'
      : '全部'
  const clearFilters = () => {
    setQuery('')
    setCategoryId(null)
    setScope('complete')
    setStatus('all')
  }
  const firstResult = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1
  const lastResult =
    result.total === 0 ? 0 : Math.min(result.total, result.page * result.pageSize)
  const openQueue = async () => {
    const items = await getCustomQueue()
    setCustomQueue(items)
    setQueuedIds(new Set(items.map((item) => item.id)))
    setQueueOpen(true)
  }
  const addQuestion = async (question: Question) => {
    if (queuedIds.has(question.id)) {
      notify('这道题已经在训练队列里')
      return
    }
    setQueueActionId(question.id)
    try {
      await addToCustomQueue(question.id)
      setQueuedIds((old) => new Set(old).add(question.id))
      notify('已加入自定义训练队列')
      await refresh()
    } finally {
      setQueueActionId(null)
    }
  }
  const removeQuestion = async (questionId: number) => {
    await removeFromCustomQueue(questionId)
    setQueuedIds((old) => {
      const next = new Set(old)
      next.delete(questionId)
      return next
    })
    setCustomQueue(await getCustomQueue())
    await refresh()
  }
  const clearQueue = async () => {
    await clearCustomQueue()
    setQueuedIds(new Set())
    setCustomQueue([])
    await refresh()
    notify('自定义队列已清空')
  }

  return (
    <div className="library-view">
      <div className="library-toolbar">
        <div className="library-toolbar-main">
          <div className="segmented library-mode-tabs">
            <button
              className={tab === 'browse' ? 'active' : ''}
              onClick={() => setTab('browse')}
            >
              {tab === 'browse' && (
                <motion.div
                  layoutId="library-mode-pill"
                  className="segmented-pill"
                  transition={{ type: 'spring', damping: 28, stiffness: 350 }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 2 }}>题库检索</span>
            </button>
            <button
              className={tab === 'focus' ? 'active' : ''}
              onClick={() => setTab('focus')}
            >
              {tab === 'focus' && (
                <motion.div
                  layoutId="library-mode-pill"
                  className="segmented-pill"
                  transition={{ type: 'spring', damping: 28, stiffness: 350 }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 2 }}>专项多考点攻坚</span>
            </button>
          </div>
          {tab === 'browse' && (
            <div className="search-box">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索题干、来源、年份或题号"
              />
            </div>
          )}
          {tab === 'browse' && (
            <button className="queue-button" onClick={openQueue}>
              <ListPlus size={17} />
              <span>训练队列</span>
              <b>{queueCount}</b>
            </button>
          )}
        </div>
        {tab === 'browse' && (
          <div className="library-filter-strip">
            <div className="filter-cluster">
              <span>范围</span>
              <div className="segmented scope-tabs">
                {[
                  ['complete', '完整'],
                  ['core', '核心'],
                  ['truth', '真题'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={scope === value ? 'active' : ''}
                    onClick={() => setScope(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-cluster">
              <span>状态</span>
              <div className="segmented">
                {[
                  ['all', '全部'],
                  ['unseen', '未做'],
                  ['wrong', '错题'],
                  ['favorite', '收藏'],
                  ['noted', '有笔记'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={status === value ? 'active' : ''}
                    onClick={() => setStatus(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-summary">
              <span>
                {activeFilterCount
                  ? `已启用 ${activeFilterCount} 项筛选 · ${scopeLabel} / ${statusLabel}`
                  : '全部题目 · 可按分类继续缩小范围'}
              </span>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters}>
                  <X size={13} /> 清除筛选
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {tab === 'focus' ? (
        <FocusView
          data={data}
          refresh={refresh}
          onStart={onPracticeFocus ?? (() => {})}
          notify={notify}
        />
      ) : (
        <div className="library-layout">
          <aside className="category-panel">
            <div className="category-head">
              <div>
                <b>题目分类</b>
                <span>大观园完整目录</span>
              </div>
              <button
                className={categoryId === null ? 'active' : ''}
                onClick={() => setCategoryId(null)}
              >
                全部
              </button>
            </div>
            <div className="category-tree">{children(null).map(renderNode)}</div>
          </aside>
          <section className="library-results">
            <div className="library-summary">
              <div className="library-summary-title">
                <span className="summary-kicker">检索结果</span>
                <b>{currentCategory?.name ?? '全部题目'}</b>
                <span>
                  {busy
                    ? '正在筛选'
                    : `共 ${result.total.toLocaleString()} 道 · 第 ${firstResult}–${lastResult} 条`}
                </span>
              </div>
              <div className="library-summary-actions">
                <span className="result-density">密集浏览</span>
                <label>
                  每页
                  <select
                    value={pageSize}
                    onChange={(event) => setPageSize(Number(event.target.value))}
                  >
                    {[50, 100, 200].map((size) => (
                      <option key={size}>{size}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="question-table">
              <div className="table-head">
                <span>题目 / 来源</span>
                <span>考点</span>
                <span>难度</span>
                <span>状态</span>
                <span />
              </div>
              {result.items.map((question) => {
                const state =
                  question.attempts === 0
                    ? '未做'
                    : question.accuracy === 1
                    ? '已掌握'
                    : '需复习'
                const categoryLabel = question.categoryPath
                  .split(' / ')
                  .slice(-2)
                  .join(' / ')
                const isQueued = queuedIds.has(question.id)
                return (
                  <motion.div
                    className="table-row"
                    key={question.id}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <button
                      className="question-row-main"
                      onClick={() => setSelectedQuestion(question)}
                    >
                      <b className="question-id-badge">#{question.id}</b>
                      <span className="question-row-copy">
                        <div className="math-wrapper">
                          <MathText value={question.stem} />
                        </div>
                        <small>
                          {question.source}
                          {question.isCore ? ' · 核心' : ''}
                        </small>
                      </span>
                    </button>
                    <span className="category-cell" title={question.categoryPath}>
                      {categoryLabel}
                    </span>
                    <span
                      className="difficulty-cell"
                      aria-label={`难度 ${question.difficulty}`}
                    >
                      <span className={`difficulty-badge diff-${question.difficulty}`}>
                        <span className="diff-bars">
                          <span className="diff-bar b1" />
                          <span className="diff-bar b2" />
                          <span className="diff-bar b3" />
                        </span>
                        <small>
                          {question.difficulty === 1
                            ? '基础'
                            : question.difficulty === 2
                            ? '进阶'
                            : '综合'}
                        </small>
                      </span>
                    </span>
                    <span
                      className={`state-cell ${
                        state === '已掌握'
                          ? 'mastered'
                          : state === '需复习'
                          ? 'review'
                          : 'unseen'
                      }`}
                    >
                      <i className="status-dot" />
                      <span>
                        {state}
                        {question.favorite ? ' · 收藏' : ''}
                      </span>
                    </span>
                    <div className="row-action-wrap">
                      <motion.button
                        whileTap={{ scale: 0.88 }}
                        className={`row-add ${isQueued ? 'queued' : ''}`}
                        disabled={queueActionId === question.id}
                        title={isQueued ? '已在训练队列中' : '加入训练队列'}
                        onClick={() => void addQuestion(question)}
                      >
                        {isQueued ? <Check size={16} /> : <ListPlus size={16} />}
                      </motion.button>
                    </div>
                  </motion.div>
                )
              })}
            </div>
            {!busy && result.items.length === 0 && (
              <EmptyState
                icon={Search}
                title="没有匹配的题目"
                text="换一个分类或清除筛选条件。"
              />
            )}
            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              onChange={setPage}
            />
          </section>
        </div>
      )}
      <AnimatePresence>
        {selectedQuestion && (
          <QuestionDetail
            question={selectedQuestion}
            close={() => setSelectedQuestion(null)}
            add={() => addQuestion(selectedQuestion)}
            practice={() => onPractice([selectedQuestion], '从题库选择的单题训练')}
            onChange={(updated) => setSelectedQuestion(updated)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {queueOpen && (
          <QueueDrawer
            questions={customQueue}
            close={() => setQueueOpen(false)}
            remove={removeQuestion}
            clear={clearQueue}
            start={() => {
              if (customQueue.length) {
                setQueueOpen(false)
                onPractice(customQueue, '自定义训练队列')
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
