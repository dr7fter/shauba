import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ScrollText, Sparkles, Trophy, X } from 'lucide-react'
import {
  getDailyContract,
  saveDailyContract,
  checkContractStatus,
} from '../data/motivation'
import { claimRewardEvent } from '../api'
import type { RewardEvent } from '../types'
import type { DailyContract } from '../data/motivation'

interface DailyContractModalProps {
  open: boolean
  onClose: () => void
  todayDone: number
  todayMinutes: number
  targetProblemCount?: number
  targetMinutesCount?: number
  dailyMode?: 'problems' | 'minutes' | 'both'
  onClaimExp: (amount: number) => void
  notify: (msg: string) => void
  rewardEvents: RewardEvent[]
}

const PRESET_GOALS = [
  '攻克一元积分计算与换元法',
  '消灭 5 道高数到期错题',
  '强化线性代数矩阵与特征值',
  '训练做题手速，达成 3 连胜',
  '完成 10 道数一高质量真题',
]

export function DailyContractModal({
  open,
  onClose,
  todayDone,
  todayMinutes,
  targetProblemCount = 20,
  targetMinutesCount = 90,
  dailyMode = 'problems',
  onClaimExp,
  notify,
  rewardEvents,
}: DailyContractModalProps) {
  const [contract, setContract] = useState<DailyContract>(() => getDailyContract(targetProblemCount, targetMinutesCount))
  const [goalInput, setGoalInput] = useState(contract.goalText)

  // Sync and check completion
  useEffect(() => {
    if (open) {
      const current = getDailyContract(targetProblemCount, targetMinutesCount)
      current.claimedReward = rewardEvents.some((event) => event.eventId === `contract-${current.date}`)
      const updated = checkContractStatus(current, todayDone, todayMinutes, dailyMode)
      setContract(updated)
      setGoalInput(updated.goalText)
    }
  }, [open, todayDone, todayMinutes, targetProblemCount, targetMinutesCount, dailyMode, rewardEvents])

  const handleSave = () => {
    const next: DailyContract = {
      ...contract,
      goalText: goalInput.trim() || '保持数一高强度手感与规范推导',
      targetProblemCount,
      targetMinutes: targetMinutesCount,
    }
    const checked = checkContractStatus(next, todayDone, todayMinutes, dailyMode)
    setContract(checked)
    saveDailyContract(checked)
    notify('今日心流作战契约已签署！')
  }

  const handleClaim = async () => {
    if (contract.isCompleted && !contract.claimedReward) {
      try {
        const result = await claimRewardEvent(`contract-${contract.date}`, 'contract', 60)
        if (!result.newlyClaimed) {
          setContract({ ...contract, claimedReward: true })
          notify('该契约奖励已经领取过')
          return
        }
        const updated = { ...contract, claimedReward: true }
        setContract(updated)
        saveDailyContract(updated)
        onClaimExp(60)
        notify('契约达成，已领取 +60 EXP')
      } catch (error) {
        notify(`奖励领取失败，未写入账本：${String(error)}`)
      }
    }
  }

  if (!open) return null

  const problemProgress = Math.min(100, Math.round((todayDone / Math.max(1, targetProblemCount)) * 100))
  const minuteProgress = Math.min(100, Math.round((todayMinutes / Math.max(1, targetMinutesCount)) * 100))
  const contractProgress = dailyMode === 'minutes'
    ? minuteProgress
    : dailyMode === 'both'
      ? Math.min(problemProgress, minuteProgress)
      : problemProgress

  return (
    <AnimatePresence>
      <div className="contract-modal-overlay" onClick={onClose}>
        <motion.div
          className="contract-modal-card"
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button className="contract-close-btn" onClick={onClose} aria-label="关闭每日契约">
            <X size={16} />
          </button>

          {/* Card Header */}
          <div className="contract-header">
            <div className="contract-icon-badge">
              <ScrollText size={22} />
            </div>
            <div>
              <h2>每日心流作战契约</h2>
              <p className="contract-date-subtitle">
                {contract.date} · 为今日考研数学定下一道必破攻坚线
              </p>
            </div>
          </div>

          {/* Goal Input & Presets */}
          <div className="contract-body">
            <div className="contract-field">
              <label>今日作战核心目标</label>
              <input
                type="text"
                className="contract-input"
                placeholder="例如：攻克分部积分表格法..."
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
              />
            </div>

            <div className="contract-presets">
              <span>快捷选择：</span>
              <div className="preset-chips">
                {PRESET_GOALS.map((preset) => (
                  <button
                    key={preset}
                    className="preset-chip"
                    onClick={() => setGoalInput(preset)}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Numbers */}
            <div className="contract-metrics-row">
              <div className="metric-box">
                <label>目标做题数</label>
                <div className="metric-stepper">
                  <strong>{targetProblemCount}</strong>
                  <span>道</span>
                </div>
                <small>当前已完成: <b>{todayDone}</b> 道</small>
              </div>

              <div className="metric-box">
                <label>目标专注时长</label>
                <div className="metric-stepper">
                  <strong>{targetMinutesCount}</strong>
                  <span>分钟</span>
                </div>
                <small>当前已专注: <b>{todayMinutes}</b> 分钟</small>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="contract-progress-card">
              <div className="progress-info">
                <span>契约攻克进度</span>
                <b>
                  {contractProgress}%
                </b>
              </div>
              <div className="contract-bar">
                <div
                  className="contract-bar-fill"
                  style={{
                    width: `${contractProgress}%`,
                  }}
                />
              </div>
            </div>

            {/* Completion Wax Stamp */}
            {contract.isCompleted && (
              <motion.div
                className="contract-stamp-container"
                initial={{ scale: 2, opacity: 0, rotate: -25 }}
                animate={{ scale: 1, opacity: 1, rotate: -10 }}
                transition={{ type: 'spring', damping: 14, stiffness: 220 }}
              >
                <div className="golden-wax-stamp">
                  <div className="stamp-inner">
                    <Check size={26} />
                    <span>契约达成</span>
                    <small>{contract.completedAt}</small>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="contract-footer">
            {!contract.isCompleted ? (
              <button className="primary-button full" onClick={handleSave}>
                <Sparkles size={16} /> 签署并锁定今日契约
              </button>
            ) : contract.claimedReward ? (
              <div className="reward-claimed-tag">
                <Check size={16} /> 今日契约已圆满达成（+60 EXP 已到账）
              </div>
            ) : (
              <button className="gold-claim-btn full" onClick={handleClaim}>
                <Trophy size={16} /> 领取契约奖励 (+60 EXP)
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
