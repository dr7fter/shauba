import { AnimatePresence } from 'framer-motion'
import { ChevronRight, History, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { addToCustomQueue, getDailyLog, getQuestion } from '../api'
import { localToday, outcomeChip, verdictChip } from '../utils'
import { EmptyState } from '../components/EmptyState'
import { MathText } from '../components/MathText'
import { QuestionDetail } from '../components/QuestionDetailModal'
import type { DailyLog, Question } from '../types'

export function HistoryView({
  notify,
  onStartVariant,
}: {
  notify: (text: string) => void
  onStartVariant: (questionId: number) => void
}) {
  const [log, setLog] = useState<DailyLog | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [openingQuestionId, setOpeningQuestionId] = useState<number | null>(null)

  const load = useCallback(() => {
    void getDailyLog().then((next) => {
      setLog(next)
      setSelectedDate((current) => current || next.days[next.days.length - 1]?.date || '')
    })
  }, [])

  useEffect(load, [load])

  const days = log?.days ?? []
  const items =
    log?.items.filter((item) => item.attemptedAt.slice(0, 10) === selectedDate) ?? []
  const selectedDay = days.find((day) => day.date === selectedDate)

  const openQuestion = async (questionId: number) => {
    setOpeningQuestionId(questionId)
    try {
      setSelectedQuestion(await getQuestion(questionId))
    } catch (error) {
      notify(`无法读取题目：${String(error)}`)
    } finally {
      setOpeningQuestionId(null)
    }
  }

  const openLabel = (questionId: number) =>
    openingQuestionId === questionId ? '正在打开题目' : '点击查看完整题目'

  const todayIso = localToday()
  const todayStats = days.find((d) => d.date === todayIso)
  const outcomeStats = (date: string) => {
    const dayItems = log?.items.filter((item) => item.attemptedAt.slice(0, 10) === date) ?? []
    const scored = dayItems.filter((item) => item.result !== 'uncertain')
    return {
      scored: scored.length,
      correct: scored.filter((item) => item.result === 'correct').length,
      uncertain: dayItems.length - scored.length,
    }
  }
  const todayOutcomeStats = outcomeStats(todayIso)
  const todayAccuracy =
    todayOutcomeStats.scored > 0
      ? Math.round((todayOutcomeStats.correct / todayOutcomeStats.scored) * 100)
      : null

  return (
    <div className="history-view">
      <section className="review-history">
        <div className="review-history-head">
          <div>
            <span>过去每一天</span>
            <h3>每日回顾</h3>
          </div>
          <div className="review-history-actions">
            <button
              className="icon-button"
              title="刷新历史记录"
              aria-label="刷新历史记录"
              onClick={load}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {todayStats && (
          <div className="history-today-summary">
            <Sparkles size={16} />
            <div>
              <strong>今日摘要：已完成 {todayStats.count} 道题</strong>
              <span>
                {todayAccuracy === null ? '暂无可评分作答' : `正确率 ${todayAccuracy}%`} ·
                不确定结果不计入正确率与掌握进度
              </span>
            </div>
          </div>
        )}

        {!log ? (
          <div className="inbox-loading">
            <LoaderCircle className="spin" size={20} /> 正在读取历史记录
          </div>
        ) : days.length === 0 ? (
          <EmptyState
            icon={History}
            title="还没有历史记录"
            text="完成第一道题后，这里会按天展示你的作答卡片和 Codex 点评。"
          />
        ) : (
          <>
            <div className="review-days">
              {days.map((day) => {
                const stats = outcomeStats(day.date)
                return (
                  <button
                    key={day.date}
                    className={day.date === selectedDate ? 'review-day active' : 'review-day'}
                    onClick={() => setSelectedDate(day.date)}
                  >
                    <span>{day.date.slice(5).replace('-', '/')}</span>
                    <strong>{day.count}</strong>
                    <small>
                      {stats.correct}/{stats.scored} 正确
                      {stats.uncertain ? ` · ${stats.uncertain} 不确定` : ''}
                    </small>
                  </button>
                )
              })}
            </div>
            <div className="review-detail">
              <div>
                <div>
                  <span>{selectedDate.slice(5).replace('-', '/')}</span>
                  <h3>{selectedDay?.count ?? 0} 道题</h3>
                </div>
                <small>
                  {selectedDay?.count
                    ? '已按最新作答时间排序置顶；点击卡片查看完整题目与 Codex 点评'
                    : '当天还没有作答记录'}
                </small>
              </div>
            </div>
            <div className="history-card-list">
              {items.map((item) => {
                const aiChip = verdictChip(item.aiVerdict)
                const result = outcomeChip(item.result)
                return (
                  <article
                    className="history-card"
                    key={`${item.attemptedAt}-${item.questionId}`}
                  >
                    <button
                      className="history-card-main"
                      onClick={() => void openQuestion(item.questionId)}
                    >
                      <div className="history-card-meta">
                        <span className={`result-dot ${result.tone}`}>
                          {result.symbol}
                        </span>
                        <b>#{item.questionId}</b>
                        <span>
                          {item.categoryPath.split(' / ').slice(-2).join(' / ')}
                        </span>
                        <ChevronRight size={16} />
                      </div>
                      <MathText value={item.stem} />
                      <div className="history-card-sub-row">
                        <small className="history-card-sub">
                          {item.source} · 自评 {item.selfRating}/4 ·{' '}
                          {new Date(item.attemptedAt).toLocaleString('zh-CN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                          {result.note ? ` · ${result.note}` : ''}
                        </small>
                        <div className="history-card-actions">
                          <span
                            className="variant-practice-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              onStartVariant(item.questionId)
                            }}
                            title="调出此题同考点的 3 道变式题"
                          >
                            <Sparkles size={12} /> 练同类变式题
                          </span>
                        </div>
                      </div>
                      <span className="sr-only">{openLabel(item.questionId)}</span>
                    </button>
                    <div
                      className={
                        item.aiConfirmedAt ? 'history-ai-panel' : 'history-ai-empty'
                      }
                    >
                      {item.aiConfirmedAt ? (
                        <>
                          <div className="history-ai-head">
                            <Sparkles size={14} />
                            <b>Codex 点评</b>
                            <i className={`batch-verdict ${aiChip.tone}`}>
                              {aiChip.label}
                            </i>
                            {item.aiConfidence !== null && (
                              <small>
                                置信度 {Math.round(item.aiConfidence * 100)}%
                              </small>
                            )}
                          </div>
                          {item.aiSummary && (
                            <p>
                              <MathText value={item.aiSummary} />
                            </p>
                          )}
                          {item.aiEarliestError && (
                            <div className="earliest-error">
                              <span>最早断点</span>
                              <p>
                                <MathText value={item.aiEarliestError} />
                              </p>
                            </div>
                          )}
                          {(item.aiErrorTags.length > 0 ||
                            item.aiWeaknessTags.length > 0) && (
                            <div className="tag-line">
                              {item.aiErrorTags.map((tag) => (
                                <span className="error-tag" key={tag}>
                                  <MathText value={tag} />
                                </span>
                              ))}
                              {item.aiWeaknessTags.map((tag) => (
                                <span className="weakness-tag" key={tag}>
                                  <MathText value={tag} />
                                </span>
                              ))}
                            </div>
                          )}
                          {item.aiAdvice && (
                            <p className="advice">
                              下一步：<MathText value={item.aiAdvice} />
                            </p>
                          )}
                        </>
                      ) : (
                        <p>这道题当时没有提交 Codex 批改，所以没有 AI 点评。</p>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}
      </section>
      <AnimatePresence>
        {selectedQuestion && (
          <QuestionDetail
            question={selectedQuestion}
            close={() => setSelectedQuestion(null)}
            add={() => {
              void addToCustomQueue(selectedQuestion.id)
                .then(() => notify(`已将错题 #${selectedQuestion.id} 加入训练队列`))
                .catch((error) => notify(`无法加入训练队列：${String(error)}`))
            }}
            practice={() => setSelectedQuestion(null)}
            onChange={setSelectedQuestion}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
