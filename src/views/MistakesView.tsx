import { AnimatePresence } from 'framer-motion'
import {
  BookMarked,
  Calendar,
  CheckSquare,
  Clock3,
  Eye,
  ListPlus,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Square,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { addToCustomQueue, getMistakeTimeline, getQuestion } from '../api'
import { MathText } from '../components/MathText'
import { QuestionDetail } from '../components/QuestionDetailModal'
import type { MistakeDayGroup, Question } from '../types'
import './MistakesView.css'

export function MistakesView({
  onNavigate,
  onNotify,
}: {
  onNavigate: (target: import('../types').LearningCenterNavigationTarget) => void
  onNotify: (text: string) => void
}) {
  const [groups, setGroups] = useState<MistakeDayGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [detailQuestion, setDetailQuestion] = useState<Question | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const data = await getMistakeTimeline(90)
      setGroups(data)
    } catch (e) {
      onNotify('加载错题时间线失败：' + String(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [onNotify])

  useEffect(() => {
    void load()
  }, [load])

  // Total statistics
  const totalMistakeCount = useMemo(() => {
    return groups.reduce((acc, g) => acc + g.items.length, 0)
  }, [groups])

  // Filtered groups by search query
  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return groups

    return groups
      .map((g) => {
        const filteredItems = g.items.filter((item) => {
          return (
            String(item.questionId).includes(q) ||
            item.categoryPath.toLowerCase().includes(q) ||
            item.stem.toLowerCase().includes(q) ||
            item.questionType.toLowerCase().includes(q) ||
            Boolean(item.earliestError && item.earliestError.toLowerCase().includes(q))
          )
        })
        return {
          ...g,
          items: filteredItems,
          totalCount: filteredItems.length,
        }
      })
      .filter((g) => g.items.length > 0)
  }, [groups, searchQuery])

  // Toggle single item selection
  const toggleSelect = (questionId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(questionId)) {
        next.delete(questionId)
      } else {
        next.add(questionId)
      }
      return next
    })
  }

  // Toggle select all in a day group
  const toggleSelectGroup = (group: MistakeDayGroup) => {
    const groupQIds = group.items.map((i) => i.questionId)
    const allSelected = groupQIds.every((id) => selectedIds.has(id))

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        groupQIds.forEach((id) => next.delete(id))
      } else {
        groupQIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  // Select all visible
  const selectAllVisible = () => {
    const allIds = filteredGroups.flatMap((g) => g.items.map((i) => i.questionId))
    const isAllSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))

    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allIds))
    }
  }

  // Single add to custom queue
  const handleSingleAdd = async (questionId: number) => {
    try {
      await addToCustomQueue(questionId)
      onNotify(`已将题目 #${questionId} 加入今日训练队列！`)
    } catch (e) {
      onNotify('添加失败：' + String(e))
    }
  }

  // Batch add to custom queue
  const handleBatchAddToQueue = async () => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    setSubmitting(true)
    try {
      await Promise.all(ids.map((id) => addToCustomQueue(id)))
      onNotify(`成功将 ${ids.length} 道错题添加至今日训练队列！`)
      setSelectedIds(new Set())
    } catch (e) {
      onNotify('批量入队失败：' + String(e))
    } finally {
      setSubmitting(false)
    }
  }

  // View detail
  const handleOpenDetail = async (questionId: number) => {
    try {
      const q = await getQuestion(questionId)
      setDetailQuestion(q)
    } catch (e) {
      onNotify('获取题目详情失败：' + String(e))
    }
  }

  if (loading && groups.length === 0) {
    return (
      <div className="mistakes-loading">
        <LoaderCircle className="spin" size={24} />
        <span>正在整理错题时间线…</span>
      </div>
    )
  }

  return (
    <div className="mistakes-view">
      <header className="mistakes-header">
        <div className="mistakes-header-left">
          <div className="mistakes-title-wrap">
            <span className="mistakes-badge">
              <BookMarked size={14} /> 时间线错题本
            </span>
            <h1>错题本</h1>
          </div>
          <p className="mistakes-subtitle">
            按日期聚合做错题目 · 累计收录 <strong>{totalMistakeCount}</strong> 道错题 · 覆盖 {groups.length} 个训练日
          </p>
        </div>

        <div className="mistakes-header-actions">
          <div className="mistakes-search-bar">
            <Search size={14} />
            <input
              type="text"
              placeholder="搜索题号、考点或题干…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="mistakes-clear-search"
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="button"
            className="mistakes-refresh-btn"
            onClick={() => void load(true)}
            title="刷新错题记录"
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
          </button>

          <button
            type="button"
            className="mistakes-batch-btn"
            disabled={selectedIds.size === 0 || submitting}
            onClick={handleBatchAddToQueue}
            title="将勾选的错题放入今日做题队列"
          >
            <ListPlus size={15} />
            <span>
              加入今日队列 {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </span>
          </button>
        </div>
      </header>

      {/* Global Quick Action Bar when items exist */}
      {groups.length > 0 && (
        <div className="mistakes-toolbar">
          <button
            type="button"
            className="mistakes-select-all-btn"
            onClick={selectAllVisible}
          >
            {filteredGroups.flatMap((g) => g.items).every((i) => selectedIds.has(i.questionId)) ? (
              <>
                <CheckSquare size={14} /> 取消全选
              </>
            ) : (
              <>
                <Square size={14} /> 全选当前显示错题
              </>
            )}
          </button>
          <span className="mistakes-select-stat">
            已勾选 <b>{selectedIds.size}</b> / {filteredGroups.reduce((a, b) => a + b.items.length, 0)} 道错题
          </span>
          {selectedIds.size > 0 && (
            <button
              type="button"
              className="mistakes-direct-today-btn"
              onClick={() => onNavigate({ type: 'today' })}
            >
              <Zap size={13} /> 前往今日训练
            </button>
          )}
        </div>
      )}

      {/* Timeline List */}
      <div className="mistakes-timeline-container">
        {filteredGroups.length === 0 ? (
          <div className="mistakes-empty-state">
            <div className="mistakes-empty-icon">🎉</div>
            <h3>{searchQuery ? '没有找到符合条件的错题' : '暂无历史错题记录'}</h3>
            <p>{searchQuery ? '请尝试更换搜索关键字' : '继续在今日训练或模考中保持全对！'}</p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const groupQIds = group.items.map((i) => i.questionId)
            const allGroupSelected = groupQIds.every((id) => selectedIds.has(id))
            const someGroupSelected = groupQIds.some((id) => selectedIds.has(id))

            return (
              <section key={group.date} className="mistakes-day-card">
                <div className="mistakes-day-header">
                  <div className="mistakes-day-title">
                    <Calendar size={15} />
                    <strong>{group.displayDate}</strong>
                    <span className="mistakes-day-count-badge">
                      {group.items.length} 题
                    </span>
                  </div>

                  <button
                    type="button"
                    className={`mistakes-group-select-btn ${allGroupSelected ? 'selected' : ''}`}
                    onClick={() => toggleSelectGroup(group)}
                  >
                    {allGroupSelected ? (
                      <CheckSquare size={13} />
                    ) : someGroupSelected ? (
                      <CheckSquare size={13} style={{ opacity: 0.6 }} />
                    ) : (
                      <Square size={13} />
                    )}
                    <span>{allGroupSelected ? '取消当天' : '全选当天'}</span>
                  </button>
                </div>

                <div className="mistakes-day-items">
                  {group.items.map((item) => {
                    const isSelected = selectedIds.has(item.questionId)

                    return (
                      <article
                        key={`${item.attemptId}-${item.questionId}`}
                        className={`mistake-item-row ${isSelected ? 'selected' : ''}`}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('button')) return
                          toggleSelect(item.questionId)
                        }}
                      >
                        <div className="mistake-item-checkbox">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(item.questionId)}
                            aria-label={`勾选题目 ${item.questionId}`}
                          />
                        </div>

                        <div className="mistake-item-main">
                          <div className="mistake-item-meta">
                            <span className="mistake-qid">#{item.questionId}</span>
                            <span className="mistake-category" title={item.categoryPath}>
                              {item.categoryPath}
                            </span>
                            <span className="mistake-type-pill">{item.questionType}</span>
                            <span className="mistake-duration">
                              <Clock3 size={11} /> {Math.round(item.durationSeconds)}秒
                            </span>
                            {item.mastery !== null && item.mastery !== undefined && item.mastery >= 3 && (
                              <span className="mistake-mastery-tag">
                                已掌握 (Lv.{item.mastery})
                              </span>
                            )}
                          </div>

                          <div className="mistake-item-stem">
                            <MathText value={item.stem} />
                          </div>

                          {(item.earliestError || item.advice) && (
                            <div className="mistake-item-diag">
                              {item.earliestError && (
                                <div className="mistake-diag-row error">
                                  <b>🔴 断点：</b>
                                  <MathText value={item.earliestError} />
                                </div>
                              )}
                              {item.advice && (
                                <div className="mistake-diag-row advice">
                                  <b>💡 建议：</b>
                                  <MathText value={item.advice} />
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="mistake-item-actions">
                          <button
                            type="button"
                            className="mistake-action-btn detail"
                            onClick={() => void handleOpenDetail(item.questionId)}
                            title="查看题目详情与完整解析"
                          >
                            <Eye size={13} /> 详情
                          </button>
                          <button
                            type="button"
                            className="mistake-action-btn add"
                            onClick={() => void handleSingleAdd(item.questionId)}
                            title="加入今日做题队列"
                          >
                            <Plus size={13} /> 入队
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            )
          })
        )}
      </div>

      {/* Question Detail Modal */}
      <AnimatePresence>
        {detailQuestion && (
          <QuestionDetail
            question={detailQuestion}
            close={() => setDetailQuestion(null)}
            add={() => {
              void addToCustomQueue(detailQuestion.id)
              onNotify(`已将题目 #${detailQuestion.id} 加入今日队列！`)
            }}
            practice={() => {
              const q = detailQuestion
              setDetailQuestion(null)
              onNavigate({ type: 'today', questionId: q.id })
            }}
            onChange={(updated) => setDetailQuestion(updated)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
