import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { getReportWall, getMistakeList, getTagClosure } from '../api'
import type { ReportCard, MistakeItem, TagClosure } from '../types'
import { TrendingUp, TrendingDown, Minus, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

type ReviewCenterViewProps = {
  notify: (msg: string) => void
  onStartTraining: (questionIds: number[]) => void  // 跳转到训练视图并加载题目
  onOpenPressureReport: (sessionId: string) => void  // 打开学习报告弹窗
}

export function ReviewCenterView({ notify, onStartTraining, onOpenPressureReport }: ReviewCenterViewProps) {
  const [reportCards, setReportCards] = useState<ReportCard[]>([])
  const [mistakes, setMistakes] = useState<MistakeItem[]>([])
  const [tagClosure, setTagClosure] = useState<TagClosure[]>([])
  const [loading, setLoading] = useState(true)

  // 筛选器状态
  const [chapterFilter, setChapterFilter] = useState<string>('')
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [timeRangeFilter, setTimeRangeFilter] = useState<number | undefined>(undefined)

  useEffect(() => {
    loadData()
  }, [chapterFilter, tagFilter, timeRangeFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      const [reports, mistakeList, closure] = await Promise.all([
        getReportWall(10),
        getMistakeList({
          chapter: chapterFilter || undefined,
          tags: tagFilter.length > 0 ? tagFilter : undefined,
          timeRangeDays: timeRangeFilter
        }),
        getTagClosure()
      ])
      setReportCards(reports)
      setMistakes(mistakeList)
      setTagClosure(closure)
    } catch (err) {
      notify(`加载失败: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="review-center-loading">
        <div className="spinner"></div>
        <p>加载复盘数据...</p>
      </div>
    )
  }

  return (
    <div className="review-center-view">
      {/* 板块A：批改报告墙 */}
      <motion.section
        className="report-wall-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="section-header">
          <h2>批改报告墙</h2>
          <p className="section-desc">最近批改的测试报告，点击查看完整六维评分</p>
        </div>

        <div className="report-cards">
          {reportCards.length === 0 ? (
            <div className="empty-state">暂无批改报告</div>
          ) : (
            reportCards.map(card => (
              <div
                key={card.sessionId}
                className="report-card"
                onClick={() => {
                  onOpenPressureReport(card.sessionId)
                  notify('正在加载报告详情')
                }}
              >
                <div className="report-card-header">
                  <span className="report-date">{formatDate(card.createdAt)}</span>
                  <span className="report-status">{card.status === 'graded' ? '已批改' : '部分批改'}</span>
                </div>
                <div className="report-card-body">
                  <div className="report-stat">
                    <strong>{card.questionCount}</strong>
                    <span>题目</span>
                  </div>
                  <div className="report-stat">
                    <strong>{Math.round(card.accuracy * 100)}%</strong>
                    <span>正确率</span>
                  </div>
                  {card.avgRating && (
                    <div className="report-stat">
                      <strong>{card.avgRating.toFixed(2)}</strong>
                      <span>平均rating</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </motion.section>

      {/* 板块B：错题本 */}
      <motion.section
        className="mistake-book-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="section-header">
          <h2>错题本</h2>
          <p className="section-desc">所有做错的题目及AI诊断详情</p>
        </div>

        {/* 筛选器 */}
        <div className="mistake-filters">
          <select
            value={chapterFilter}
            onChange={(e) => setChapterFilter(e.target.value)}
            className="filter-select"
          >
            <option value="">全部章节</option>
            <option value="高等数学">高等数学</option>
            <option value="线性代数">线性代数</option>
            <option value="概率论">概率论与数理统计</option>
          </select>

          <select
            value={timeRangeFilter || ''}
            onChange={(e) => setTimeRangeFilter(e.target.value ? Number(e.target.value) : undefined)}
            className="filter-select"
          >
            <option value="">全部时间</option>
            <option value="7">最近7天</option>
            <option value="30">最近30天</option>
            <option value="90">最近90天</option>
          </select>
        </div>

        {/* 错题列表 */}
        <div className="mistake-list">
          {mistakes.length === 0 ? (
            <div className="empty-state">暂无错题记录</div>
          ) : (
            mistakes.map(item => (
              <div key={`${item.questionId}-${item.attemptedAt}`} className="mistake-item">
                <div className="mistake-item-meta">
                  <span className="mistake-qid">#{item.questionId}</span>
                  <span className="mistake-date">{formatDate(item.attemptedAt)}</span>
                  {item.hasRedone && <CheckCircle2 size={14} className="redone-icon" aria-label="已重做" />}
                </div>

                <div className="mistake-item-content">
                  <div className="mistake-stem">{truncate(item.stem, 80)}</div>

                  {item.earliestError && (
                    <div className="mistake-diagnosis">
                      <XCircle size={14} className="error-icon" />
                      <span className="diagnosis-label">最早错误：</span>
                      <span className="diagnosis-text">{item.earliestError}</span>
                    </div>
                  )}

                  {item.advice && (
                    <div className="mistake-diagnosis">
                      <AlertCircle size={14} className="advice-icon" />
                      <span className="diagnosis-label">修复建议：</span>
                      <span className="diagnosis-text">{item.advice}</span>
                    </div>
                  )}

                  <div className="mistake-tags">
                    {item.errorTags.map(tag => (
                      <span key={tag} className="tag tag-error">{tag}</span>
                    ))}
                    {item.weaknessTags.map(tag => (
                      <span key={tag} className="tag tag-weakness">{tag}</span>
                    ))}
                  </div>
                </div>

                <div className="mistake-item-actions">
                  <button
                    className="btn-secondary btn-sm"
                    onClick={() => {
                      onStartTraining([item.questionId])
                      notify(`开始重做题目 #${item.questionId}`)
                    }}
                  >
                    重做
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 批量操作 */}
        {mistakes.length > 0 && (
          <div className="batch-actions">
            <button
              className="btn-primary"
              onClick={() => {
                const questionIds = mistakes.map(m => m.questionId)
                onStartTraining(questionIds)
                notify(`开始重做全部 ${mistakes.length} 道错题`)
              }}
            >
              重做全部错题 ({mistakes.length})
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                const recent = mistakes.filter(m => {
                  const days = Math.floor((Date.now() - new Date(m.attemptedAt).getTime()) / (1000 * 60 * 60 * 24))
                  return days <= 7
                })
                if (recent.length === 0) {
                  notify('最近7天无错题')
                  return
                }
                onStartTraining(recent.map(m => m.questionId))
                notify(`开始重做近7天的 ${recent.length} 道错题`)
              }}
            >
              重做近7天
            </button>
          </div>
        )}
      </motion.section>

      {/* 板块C：薄弱知识地图 */}
      <motion.section
        className="weakness-map-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <div className="section-header">
          <h2>薄弱知识地图</h2>
          <p className="section-desc">错误类型与薄弱点聚合，闭环追踪改善趋势</p>
        </div>

        {tagClosure.length === 0 ? (
          <div className="empty-state">暂无标签数据</div>
        ) : (
          <div className="tag-cloud">
            {tagClosure.map(item => {
              const recentCorrectRate = item.recentTotal > 0 ? (item.recentCorrect / item.recentTotal) * 100 : 0
              const beforeCorrectRate = item.beforeTotal > 0 ? (item.beforeCorrect / item.beforeTotal) * 100 : 0
              const delta = recentCorrectRate - beforeCorrectRate

              const arrow = delta >= 10 ? <TrendingUp size={14} className="closure-arrow-up" />
                          : delta <= -10 ? <TrendingDown size={14} className="closure-arrow-down" />
                          : <Minus size={14} className="closure-arrow-stable" />

              return (
                <button
                  key={item.tag}
                  className="tag-badge"
                  onClick={() => {
                    setTagFilter([item.tag])
                    notify(`已筛选标签: ${item.tag}`)
                  }}
                >
                  <span className="tag-name">{item.tag}</span>
                  {arrow}
                  <span className="tag-count">{item.questionCount}</span>
                </button>
              )
            })}
          </div>
        )}
      </motion.section>
    </div>
  )
}

function formatDate(isoStr: string): string {
  const date = new Date(isoStr)
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}
