import { memo } from 'react'
import { Check, ChevronRight, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { formatTimer } from '../utils'

export interface AchievementCardData {
  correct: boolean
  duration: number
  todayProgress: { done: number; target: number }
  correctCount: number
  totalCount: number
  yesterdayDone?: number
  milestone?: number
  goalReached?: boolean
}

interface Props {
  data: AchievementCardData
  tomorrowPreview: { stem: string; reason: string } | null
  onDismiss: () => void
}

/**
 * 答题后成就卡片。抽自 TodayView 并 memo 隔离（同 EloFlashBanner：每秒 tick 的
 * 计时 state 不再驱动它重绘）。退出动画依赖外层 AnimatePresence 对本组件的 key。
 */
export const AchievementCardOverlay = memo(function AchievementCardOverlay({
  data,
  tomorrowPreview,
  onDismiss,
}: Props) {
  return (
    <motion.div
      className="achievement-card-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onDismiss}
    >
      <motion.div
        className={`achievement-card ${data.milestone ? 'milestone-celebrate' : ''}`}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`achievement-icon ${data.correct ? 'correct' : 'wrong'}`}>
          {data.correct ? <Check size={32} /> : <X size={32} />}
        </div>
        <h3>{data.correct ? '✅ 正确！' : '❌ 错误'}</h3>
        <p className="achievement-time">用时 {formatTimer(data.duration)}</p>

        {data.milestone && (
          <div className="milestone-banner">
            🎉 达成里程碑：完成 {data.milestone} 题！
          </div>
        )}

        {data.goalReached && (
          <div className="milestone-banner">
            🎯 今日目标达成，可以收工——明天的修复动作已在队列里等你
          </div>
        )}
        {data.goalReached && tomorrowPreview && (
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '6px 0 0' }}>
            明天第一件事：{tomorrowPreview.reason}
          </p>
        )}

        <div className="achievement-stats">
          <div className="achievement-stat">
            <span className="stat-label">今日进度</span>
            <div className="stat-value stat-animate">
              <strong>{data.todayProgress.done}</strong>
              <small>/ {data.todayProgress.target} 题</small>
            </div>
            {data.yesterdayDone !== undefined && data.todayProgress.done > data.yesterdayDone && (
              <div className="data-growth positive">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M6 2L6 10M6 2L3 5M6 2L9 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                比昨天多 {data.todayProgress.done - data.yesterdayDone} 题
              </div>
            )}
            {data.yesterdayDone !== undefined && data.todayProgress.done === data.yesterdayDone && (
              <div className="data-growth">持平昨天</div>
            )}
            {data.yesterdayDone !== undefined && data.todayProgress.done < data.yesterdayDone && (
              <div className="data-growth negative">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M6 10L6 2M6 10L3 7M6 10L9 7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                比昨天少 {data.yesterdayDone - data.todayProgress.done} 题
              </div>
            )}
            {!data.yesterdayDone && data.yesterdayDone !== 0 && (
              <div className="stat-badge">
                {data.todayProgress.done >= data.todayProgress.target
                  ? '🎉 已完成目标'
                  : `还差 ${data.todayProgress.target - data.todayProgress.done} 题`}
              </div>
            )}
          </div>

          <div className="achievement-stat">
            <span className="stat-label">本轮正确率</span>
            <div className="stat-value">
              <strong>
                {Math.round((data.correctCount / data.totalCount) * 100)}%
              </strong>
              <small>
                ({data.correctCount}/{data.totalCount})
              </small>
            </div>
          </div>
        </div>

        <div className="achievement-actions">
          <button className="achievement-continue" onClick={onDismiss}>
            继续刷题 <ChevronRight size={16} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
})
