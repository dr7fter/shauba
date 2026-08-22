import { motion } from 'framer-motion'
import {
  BookOpen,
  Check,
  Clock3,
  Compass,
  ListPlus,
  LoaderCircle,
  Play,
  RefreshCw,
  Sparkles,
  Target,
  TimerReset,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { searchQuestionPage } from '../api'
import { MathText } from './MathText'
import type { DailyLog, MasteryNode, Question } from '../types'

interface SubBranchArchiveModalProps {
  node: MasteryNode
  today: string
  dailyLog?: DailyLog | null
  onClose: () => void
  onPractice: (question: Question) => void
  onStartVariant: (questionId: number) => void
  onAddToQueue: (questionId: number) => void
  onViewDetail: (question: Question) => void
  onPracticeBatch?: (questions: Question[], reason: string) => void
}

type FilterTab = 'attempted' | 'due' | 'wrong' | 'all'

export function SubBranchArchiveModal({
  node,
  today,
  dailyLog,
  onClose,
  onPractice,
  onStartVariant,
  onAddToQueue,
  onViewDetail,
  onPracticeBatch,
}: SubBranchArchiveModalProps) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('attempted')

  // Listen to Esc key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Load all questions for this sub-branch category
  const loadQuestions = useCallback(async () => {
    setLoading(true)
    try {
      const page = await searchQuestionPage({
        query: '',
        categoryId: node.id,
        status: 'all',
        scope: 'complete',
        page: 1,
        pageSize: 100,
      })
      setQuestions(page.items)
      const hasAttempted = page.items.some((q) => q.attempts > 0)
      setFilter(hasAttempted ? 'attempted' : 'all')
    } catch {
      setQuestions([])
    } finally {
      setLoading(false)
    }
  }, [node.id])

  useEffect(() => {
    void loadQuestions()
  }, [loadQuestions])

  const diagnosisByQuestion = useMemo(() => {
    const map = new Map<number, DailyLog['items'][number]>()
    for (const item of dailyLog?.items ?? []) {
      if (!map.has(item.questionId)) map.set(item.questionId, item)
    }
    return map
  }, [dailyLog])

  const counts = useMemo(() => {
    const attempted = questions.filter((q) => q.attempts > 0).length
    const due = questions.filter((q) => q.nextReview !== null && q.nextReview <= today).length
    const wrong = questions.filter((q) => q.accuracy !== null && q.accuracy < 1.0).length
    const total = questions.length
    return { attempted, due, wrong, total }
  }, [questions, today])

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (filter === 'attempted') return q.attempts > 0
      if (filter === 'due') return q.nextReview !== null && q.nextReview <= today
      if (filter === 'wrong') return q.accuracy !== null && q.accuracy < 1.0
      return true
    })
  }, [questions, filter, today])

  const startBatch = () => {
    if (!onPracticeBatch) return
    const targets = filter === 'attempted'
      ? questions.filter((q) => q.attempts > 0)
      : filter === 'due'
      ? questions.filter((q) => q.nextReview !== null && q.nextReview <= today)
      : filter === 'wrong'
      ? questions.filter((q) => q.accuracy !== null && q.accuracy < 1.0)
      : questions

    if (targets.length === 0) return
    onPracticeBatch(targets, `考点攻坚 · ${node.name}`)
    onClose()
  }

  const addAllToQueue = () => {
    for (const q of filteredQuestions) {
      onAddToQueue(q.id)
    }
  }

  return (
    <div className="ui-overlay modal-backdrop subbranch-modal-backdrop" onClick={onClose}>
      <motion.section
        className="ui-modal modal-card subbranch-archive-modal"
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="subbranch-modal-title"
      >
        {/* Header */}
        <header className="subbranch-modal-header">
          <div className="subbranch-modal-heading">
            <div className="subbranch-modal-icon">
              <Compass size={22} />
            </div>
            <div>
              <div className="subbranch-modal-path">{node.path.split(' / ').slice(-3).join(' / ')}</div>
              <h2 id="subbranch-modal-title">{node.name}</h2>
            </div>
          </div>

          <div className="subbranch-modal-header-right">
            <span className={`mastery-chip ${node.masteryScore !== null && node.masteryScore >= 80 ? 'strong' : node.masteryScore !== null && node.masteryScore >= 50 ? 'steady' : 'weak'}`}>
              {node.masteryScore !== null ? `掌握度 ${Math.round(node.masteryScore)} 分` : '暂无评分'}
            </span>
            <button className="icon-button modal-close-btn" title="关闭 (Esc)" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Cockpit Stats Bar */}
        <div className="subbranch-cockpit-grid">
          <div className="cockpit-stat-item">
            <span>考点总题量</span>
            <strong>{counts.total} <em>题</em></strong>
          </div>
          <div className="cockpit-stat-item">
            <span>已做覆盖率</span>
            <strong>
              {counts.total ? Math.round((counts.attempted / counts.total) * 100) : 0}%
              <small> ({counts.attempted}/{counts.total})</small>
            </strong>
          </div>
          <div className="cockpit-stat-item">
            <span>待复习题目</span>
            <strong className={counts.due > 0 ? 'highlight-warn' : ''}>{counts.due} <em>题</em></strong>
          </div>
          <div className="cockpit-stat-item">
            <span>薄弱错题</span>
            <strong className={counts.wrong > 0 ? 'highlight-danger' : ''}>{counts.wrong} <em>题</em></strong>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="subbranch-modal-tabs" role="tablist">
          {[
            ['attempted', `已做题目 (${counts.attempted})`],
            ['due', `待复习 (${counts.due})`],
            ['wrong', `薄弱错题 (${counts.wrong})`],
            ['all', `全部题库 (${counts.total})`],
          ].map(([tabKey, label]) => (
            <button
              key={tabKey}
              className={filter === tabKey ? 'active' : ''}
              onClick={() => setFilter(tabKey as FilterTab)}
              role="tab"
              aria-selected={filter === tabKey}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Question Cards Stream */}
        <div className="subbranch-modal-scroll">
          {loading ? (
            <div className="subbranch-loading-state">
              <LoaderCircle className="spin" size={24} />
              <span>正在整理「{node.name}」全部题目档案…</span>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="subbranch-empty-state">
              <Compass size={36} />
              <h4>
                {filter === 'attempted'
                  ? '该考点尚未作答过题目'
                  : filter === 'due'
                  ? '太棒了！当前没有到期需要复习的题目'
                  : filter === 'wrong'
                  ? '暂无薄弱错题记录，掌握稳健！'
                  : '该考点题库暂无题目'}
              </h4>
              <p>
                {filter === 'attempted'
                  ? '切换至「全部题库」选择题目开启首轮练习。'
                  : '保持当前复习节奏，稳步推进考研数学冲刺。'}
              </p>
            </div>
          ) : (
            <div className="subbranch-archive-cards">
              {filteredQuestions.map((q) => {
                const diagnosis = diagnosisByQuestion.get(q.id)
                const isDueToday = q.nextReview !== null && q.nextReview === today
                const isOverdue = q.nextReview !== null && q.nextReview < today
                const isScheduled = q.nextReview !== null && q.nextReview > today

                return (
                  <article key={q.id} className="subbranch-archive-card">
                    <div className="archive-card-head">
                      <div className="archive-card-id">
                        <b>#{q.id}</b>
                        <span>{q.source}</span>
                      </div>
                      <div className="archive-card-diff">
                        难度 {'●'.repeat(q.difficulty)}{'○'.repeat(Math.max(0, 3 - q.difficulty))}
                      </div>
                    </div>

                    <div className="archive-card-stem">
                      <MathText value={q.stem} />
                    </div>

                    {/* Status Badges Row */}
                    <div className="archive-badges-row">
                      {q.attempts > 1 ? (
                        <span className="review-pill reviewed">
                          <RefreshCw size={11} /> 已复习 {q.attempts} 次
                        </span>
                      ) : q.attempts === 1 ? (
                        <span className="review-pill attempted">
                          <Check size={11} /> 已作答 1 次
                        </span>
                      ) : (
                        <span className="review-pill unseen">未作答</span>
                      )}

                      {q.mastery === 4 && <span className="review-pill mastery-4">⚡ 熟练秒杀 (4分)</span>}
                      {q.mastery === 3 && <span className="review-pill mastery-3">⏱️ 会做流畅 (3分)</span>}
                      {q.mastery === 2 && <span className="review-pill mastery-2">⚠️ 模糊卡壳 (2分)</span>}
                      {q.mastery === 1 && <span className="review-pill mastery-1">🚫 盲区做错 (1分)</span>}

                      {q.accuracy !== null && q.attempts > 0 && (
                        <span className="review-pill accuracy">
                          正确率 {Math.round(q.accuracy * 100)}%
                        </span>
                      )}

                      {isOverdue && (
                        <span className="review-pill overdue">
                          <TimerReset size={11} /> 逾期 ({q.nextReview})
                        </span>
                      )}
                      {isDueToday && (
                        <span className="review-pill due">
                          <TimerReset size={11} /> 今日到期
                        </span>
                      )}
                      {isScheduled && (
                        <span className="review-pill scheduled">
                          <Clock3 size={11} /> {q.nextReview} 复习
                        </span>
                      )}
                    </div>

                    {/* User Note */}
                    {q.note && (
                      <div className="archive-card-note">
                        <strong>我的批注：</strong>{q.note}
                      </div>
                    )}

                    {/* AI Diagnosis Breakpoint */}
                    {diagnosis?.aiEarliestError && (
                      <div className="archive-card-diagnosis">
                        <span>💡 最早断点：</span>
                        <MathText value={diagnosis.aiEarliestError} />
                        {diagnosis.aiAdvice && (
                          <div className="diagnosis-advice">
                            <span>修复动作：</span>
                            <MathText value={diagnosis.aiAdvice} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="archive-card-actions">
                      <button
                        type="button"
                        className="primary-button compact"
                        onClick={() => {
                          onPractice(q)
                          onClose()
                        }}
                      >
                        <Play size={13} /> 练习此题
                      </button>
                      <button
                        type="button"
                        className="secondary-button compact"
                        onClick={() => {
                          onStartVariant(q.id)
                          onClose()
                        }}
                        title="调出此题同考点的 3 道变式题立即加练"
                      >
                        <Sparkles size={13} /> 3道变式
                      </button>
                      <button
                        type="button"
                        className="secondary-button compact"
                        onClick={() => onAddToQueue(q.id)}
                        title="加入自定义训练队列"
                      >
                        <ListPlus size={13} /> 进队列
                      </button>
                      <button
                        type="button"
                        className="secondary-button compact"
                        onClick={() => onViewDetail(q)}
                        title="查看题目完整解析与答案"
                      >
                        <BookOpen size={13} /> 详细解析
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <footer className="subbranch-modal-footer">
          <div className="footer-info">
            <span>当前筛选显示 <b>{filteredQuestions.length}</b> 道题目</span>
          </div>

          <div className="footer-buttons">
            {onPracticeBatch && filteredQuestions.length > 0 && (
              <button className="primary-button" onClick={startBatch}>
                <Target size={15} /> 练习当前筛选题目 ({filteredQuestions.length})
              </button>
            )}
            {filteredQuestions.length > 0 && (
              <button className="secondary-button" onClick={addAllToQueue}>
                <ListPlus size={15} /> 当前全部进队列
              </button>
            )}
            <button className="secondary-button" onClick={onClose}>
              关闭
            </button>
          </div>
        </footer>
      </motion.section>
    </div>
  )
}
