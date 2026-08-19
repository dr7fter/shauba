import { AnimatePresence, motion } from 'framer-motion'
import { Check, X, Zap } from 'lucide-react'
import type { BlitzExamResult } from '../data/motivation'

interface BlitzExamModalProps {
  open: boolean
  onClose: () => void
  result: BlitzExamResult | null
  onRestart: () => void
}

export function BlitzExamModal({
  open,
  onClose,
  result,
  onRestart,
}: BlitzExamModalProps) {
  if (!open || !result) return null

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}分${s}秒`
  }

  return (
    <AnimatePresence>
      <div className="blitz-modal-overlay" onClick={onClose}>
        <motion.div
          className="blitz-modal-card"
          initial={{ opacity: 0, scale: 0.88, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 15 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button className="blitz-close-btn" onClick={onClose}>
            <X size={16} />
          </button>

          {/* Header Rank Badge */}
          <div className="blitz-rank-banner">
            <motion.div
              className={`blitz-rank-badge ${result.rank.toLowerCase()}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200 }}
            >
              <span>{result.rank}</span>
            </motion.div>
            <div className="blitz-rank-title-box">
              <h2>{result.title}</h2>
              <span className="blitz-subtag">15分钟真题闪击战 · 战力评定</span>
            </div>
          </div>

          {/* Feedback note */}
          <p className="blitz-feedback-text">“{result.feedback}”</p>

          {/* Results Grid */}
          <div className="blitz-metrics-grid">
            <div className="blitz-metric-tile">
              <span className="blitz-lbl">正确题目</span>
              <div className="blitz-val">
                <strong>{result.correctCount}</strong>
                <small>/ {result.total}</small>
              </div>
              <span className="blitz-sub">正确率 {Math.round(result.accuracy * 100)}%</span>
            </div>

            <div className="blitz-metric-tile">
              <span className="blitz-lbl">总共用时</span>
              <div className="blitz-val">
                <strong>{formatSeconds(result.timeSpentSeconds)}</strong>
              </div>
              <span className="blitz-sub">限时 15:00</span>
            </div>

            <div className="blitz-metric-tile">
              <span className="blitz-lbl">极速破题分</span>
              <div className="blitz-val speed">
                <strong>{result.speedScore}</strong>
                <small>PTS</small>
              </div>
              <span className="blitz-sub">高压手速判定</span>
            </div>
          </div>

          {/* Actions */}
          <div className="blitz-actions">
            <button className="primary-button full" onClick={onClose}>
              <Check size={16} /> 查看题解与复盘
            </button>
            <button className="secondary-button full" onClick={onRestart}>
              <Zap size={16} /> 再来一组 15 分钟闪击战
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
