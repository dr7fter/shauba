import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Copy, X } from 'lucide-react'
import { getExamCountdown, getDailyQuote, getTodayDateStr } from '../data/motivation'
import type { BootstrapData } from '../types'
import type { computeGamification } from '../data/gamification'

interface BattleReportModalProps {
  open: boolean
  onClose: () => void
  data: BootstrapData
  stats: ReturnType<typeof computeGamification>
  todayReviewCount: number
  notify: (msg: string) => void
}

export function BattleReportModal({
  open,
  onClose,
  data,
  stats,
  todayReviewCount,
  notify,
}: BattleReportModalProps) {
  const [copied, setCopied] = useState(false)
  const countdown = getExamCountdown()
  const quote = getDailyQuote()
  const todayStr = getTodayDateStr()

  if (!open) return null

  const handleCopyText = async () => {
    const countdownText = countdown.isConfigured ? `距初试：${countdown.days} 天 (${countdown.phaseText})` : '考试日期：未配置'
    const text = `【考研数学一 · 今日修炼简报】\n` +
      `📅 日期：${todayStr} · ${countdownText}\n` +
      `⚡ 今日攻克：${data.todayDone} 道题 | 今日复习巩固：${todayReviewCount} 道题 | 专注时长：${data.todayMinutes} 分钟\n` +
      `🏆 当前战力：Lv.${stats.levelInfo.level} ${stats.levelInfo.title} (${stats.totalExp} EXP)\n` +
      `💬 今日锦囊：“${quote.text}” —— ${quote.author}\n` +
      `—— 来自「刷吧」数一纸笔训练与自驱系统`

    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
    notify('已复制今日战报文本，可发至打卡群或备忘录！')
  }

  return (
    <AnimatePresence>
      <div className="battle-report-overlay" onClick={onClose}>
        <motion.div
          className="battle-report-container"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 15 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button className="battle-close-btn" onClick={onClose} aria-label="关闭今日战报">
            <X size={18} />
          </button>

          {/* Premium Poster Card */}
          <div className="battle-poster-card">
            {/* Header */}
            <div className="poster-header">
              <div className="poster-brand">
                <span className="brand-badge">SHUABA MATH</span>
                <span className="poster-phase">{countdown.phaseText}</span>
              </div>
              <h1 className="poster-title">考研数一 · 今日修炼战报</h1>
              <div className="poster-date-row">
                <span>{todayStr}</span>
                <span className="dday-pill">{countdown.isConfigured ? <>距初试 <strong>{countdown.days}</strong> 天</> : '考试日期未配置'}</span>
              </div>
            </div>

            {/* Main Stats Grid */}
            <div className="poster-stats-grid">
              <div className="poster-stat-tile">
                <span className="stat-label">今日攻克真题</span>
                <div className="stat-number-row">
                  <strong>{data.todayDone}</strong>
                  <small>道</small>
                </div>
                <div className="stat-sub">复习巩固 {todayReviewCount} 道 · 达成率 {Math.min(100, Math.round((data.todayDone / Math.max(1, data.dailyProblemTarget)) * 100))}%</div>
              </div>

              <div className="poster-stat-tile">
                <span className="stat-label">今日深度专注</span>
                <div className="stat-number-row">
                  <strong>{data.todayMinutes}</strong>
                  <small>分钟</small>
                </div>
                <div className="stat-sub">手感温度 🔥 滚烫</div>
              </div>

              <div className="poster-stat-tile">
                <span className="stat-label">角色数学段位</span>
                <div className="stat-number-row rank">
                  <span className="rank-emoji">{stats.levelInfo.rankBadge}</span>
                  <strong>Lv.{stats.levelInfo.level}</strong>
                </div>
                <div className="stat-sub">{stats.levelInfo.title}</div>
              </div>

              <div className="poster-stat-tile">
                <span className="stat-label">累计斩获经验</span>
                <div className="stat-number-row">
                  <strong>{stats.totalExp}</strong>
                  <small>EXP</small>
                </div>
                <div className="stat-sub">已解锁复习加成</div>
              </div>
            </div>

            {/* Radar Mini Attribute Snapshot */}
            <div className="poster-attributes-strip">
              <div className="attr-pill">
                <span>计算力</span>
                <b>{stats.radar.calculation}</b>
              </div>
              <div className="attr-pill">
                <span>概念力</span>
                <b>{stats.radar.concept}</b>
              </div>
              <div className="attr-pill">
                <span>代数力</span>
                <b>{stats.radar.algebra}</b>
              </div>
              <div className="attr-pill">
                <span>分析力</span>
                <b>{stats.radar.calculus}</b>
              </div>
              <div className="attr-pill">
                <span>概率力</span>
                <b>{stats.radar.probability}</b>
              </div>
              <div className="attr-pill">
                <span>毅力值</span>
                <b>{stats.radar.consistency}</b>
              </div>
            </div>

            {/* Quote of the Day */}
            <div className="poster-quote-box">
              <div className="quote-icon">“</div>
              <p className="quote-text">{quote.text}</p>
              <div className="quote-author">—— {quote.author} · 《{quote.tag}》</div>
            </div>

            {/* Footer watermark */}
            <div className="poster-watermark">
              <span>刷吧 · 数一纸笔训练与自驱系统</span>
              <span>Keep Coding, Keep Solving.</span>
            </div>
          </div>

          {/* Action Bar */}
          <div className="battle-actions-bar">
            <button className="battle-copy-btn" onClick={handleCopyText}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              <span>{copied ? '已复制战报文案' : '复制打卡战报文案'}</span>
            </button>
            <button className="battle-done-btn" onClick={onClose}>
              完成今日打卡
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
