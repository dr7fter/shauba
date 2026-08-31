import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  HelpCircle,
  Lightbulb,
  Sparkles,
  Target,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { MathText } from './MathText'
import type { FriendPublicReport, FriendPublicReportQuestion } from '../types'

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s} 秒`
  return s > 0 ? `${m} 分 ${s} 秒` : `${m} 分钟`
}

export function FriendPublicReportModal({
  report,
  friendNickname,
  onClose,
}: {
  report: FriendPublicReport | null
  friendNickname: string
  onClose: () => void
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!report) return null

  const getVerdictBadge = (verdict: FriendPublicReportQuestion['result']) => {
    switch (verdict) {
      case 'correct':
        return (
          <span className="pub-verdict-pill correct">
            <CheckCircle2 size={13} />
            <span>正确</span>
          </span>
        )
      case 'partial':
        return (
          <span className="pub-verdict-pill partial">
            <AlertTriangle size={13} />
            <span>步骤分</span>
          </span>
        )
      case 'uncertain':
        return (
          <span className="pub-verdict-pill uncertain">
            <HelpCircle size={13} />
            <span>存疑</span>
          </span>
        )
      default:
        return (
          <span className="pub-verdict-pill incorrect">
            <XCircle size={13} />
            <span>做错</span>
          </span>
        )
    }
  }

  return (
    <AnimatePresence>
      <div className="modal-backdrop" onClick={onClose}>
        <motion.div
          className="modal friend-public-report-modal"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="modal-header">
            <div className="modal-header-main">
              <div className="public-report-badge">
                <Sparkles size={16} />
                <span>好友公开报告 (只读)</span>
              </div>
              <h2 className="public-report-title">
                「{friendNickname}」的高压演练公开报告
              </h2>
              <p className="public-report-subtitle">
                演练时间：{new Date(report.createdAt).toLocaleString()} · 本报告已脱敏
              </p>
            </div>
            <button className="icon-button" onClick={onClose} title="关闭 (Esc)">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="modal-body friend-public-report-body">
            {/* Stat Row */}
            <div className="public-report-metrics-grid">
              <div className="public-metric-card rating">
                <div className="metric-icon-wrap">
                  <Award size={18} />
                </div>
                <div className="metric-info">
                  <span className="pub-metric-label">HLTV Rating</span>
                  <strong className="pub-metric-val rating-highlight">
                    {report.rating.toFixed(2)}
                  </strong>
                </div>
              </div>

              <div className="public-metric-card accuracy">
                <div className="metric-icon-wrap">
                  <Target size={18} />
                </div>
                <div className="metric-info">
                  <span className="pub-metric-label">正确率</span>
                  <strong className="pub-metric-val">{report.accuracy}%</strong>
                </div>
              </div>

              <div className="public-metric-card duration">
                <div className="metric-icon-wrap">
                  <Clock size={18} />
                </div>
                <div className="metric-info">
                  <span className="pub-metric-label">总用时</span>
                  <strong className="pub-metric-val">
                    {formatSeconds(report.durationSeconds)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Overall Summary Card */}
            <div className="public-report-section summary-card">
              <h3 className="section-title">
                <Sparkles size={16} />
                <span>整组训练战况评估</span>
              </h3>
              <div className="summary-content">
                <MathText value={report.summary} />
              </div>
            </div>

            {/* AI Insights & Tags */}
            <div className="public-report-two-col">
              {/* Strengths & Weaknesses */}
              <div className="public-report-section">
                <h3 className="section-title">
                  <Zap size={16} />
                  <span>知识点分布</span>
                </h3>
                {report.strengths.length > 0 && (
                  <div className="tag-group">
                    <span className="group-label success">优势板块：</span>
                    <div className="tags-wrap">
                      {report.strengths.map((t) => (
                        <span key={t} className="public-tag strength">
                          <MathText value={t} />
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {report.weaknesses.length > 0 && (
                  <div className="tag-group" style={{ marginTop: '8px' }}>
                    <span className="group-label warn">薄弱盲区：</span>
                    <div className="tags-wrap">
                      {report.weaknesses.map((t) => (
                        <span key={t} className="public-tag weakness">
                          <MathText value={t} />
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Advice */}
              {report.advice && (
                <div className="public-report-section">
                  <h3 className="section-title">
                    <Lightbulb size={16} />
                    <span>战术改进建议</span>
                  </h3>
                  <div className="public-advice-box">
                    <MathText value={report.advice} />
                  </div>
                </div>
              )}
            </div>

            {/* Per-Question Summaries */}
            {report.questionSummaries.length > 0 && (
              <div className="public-report-section questions-section">
                <h3 className="section-title">
                  <Target size={16} />
                  <span>各题作答诊断摘要 ({report.questionSummaries.length} 题)</span>
                </h3>
                <div className="question-diagnoses-list">
                  {report.questionSummaries.map((q) => (
                    <div key={q.index} className="public-question-card">
                      <div className="q-card-header">
                        <span className="q-index">第 {q.index} 题</span>
                        {getVerdictBadge(q.result)}
                      </div>

                      {q.earliestError && (
                        <div className="q-error-box">
                          <span className="q-label error">最早错误断点：</span>
                          <div className="q-text">
                            <MathText value={q.earliestError} />
                          </div>
                        </div>
                      )}

                      {q.advice && (
                        <div className="q-advice-box">
                          <span className="q-label advice">修复动作：</span>
                          <div className="q-text">
                            <MathText value={q.advice} />
                          </div>
                        </div>
                      )}

                      {q.betterSolution && (
                        <div className="q-solution-box">
                          <span className="q-label solution">极速秒杀思路：</span>
                          <div className="q-text">
                            <MathText value={q.betterSolution} />
                          </div>
                        </div>
                      )}

                      {(q.errorTags.length > 0 || q.weaknessTags.length > 0) && (
                        <div className="q-tags-row">
                          {q.errorTags.map((tag) => (
                            <span key={tag} className="q-tag error">
                              <MathText value={tag} />
                            </span>
                          ))}
                          {q.weaknessTags.map((tag) => (
                            <span key={tag} className="q-tag topic">
                              <MathText value={tag} />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button className="primary-button compact" onClick={onClose}>
              关闭
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
