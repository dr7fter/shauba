import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import {
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Flame,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  X,
  Sparkles,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Play,
  Check,
} from 'lucide-react'
import type { DailyPlan, DailyPlanItem, PlanQuestTier, PlanTargetType } from '../types'
import { isSoundEnabled, setSoundEnabled } from '../utils/soundEffects'
import './PlanDrawer.css'

export function PlanTopPill({
  isOpen,
  onToggle,
  currentPlan,
  selectedDate,
  todayDate,
  pulseTrigger = 0,
  toastMessage = null,
}: {
  isOpen: boolean
  onToggle: () => void
  currentPlan: DailyPlan | null
  selectedDate: string
  todayDate: string
  pulseTrigger?: number
  toastMessage?: string | null
}) {
  const baseQuests = currentPlan?.baseQuests ?? []
  const advancedQuests = currentPlan?.advancedQuests ?? []

  const baseCompleted = baseQuests.filter((q) => q.completed).length
  const baseTotal = baseQuests.length
  const advCompleted = advancedQuests.filter((q) => q.completed).length
  const advTotal = advancedQuests.length

  const isToday = selectedDate === todayDate
  const isTomorrow = (() => {
    const d = new Date(todayDate)
    d.setDate(d.getDate() + 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return selectedDate === `${y}-${m}-${day}`
  })()

  return (
    <div className="topbar-plan-pill-container">
      <button
        type="button"
        className={`topbar-plan-pill ${isOpen ? 'active' : ''}`}
        onClick={onToggle}
        title="点击下拉查看每日作战计划 (快捷键 P)"
      >
        {/* 流光反馈动画 */}
        <AnimatePresence>
          {pulseTrigger > 0 && (
            <motion.span
              className="topbar-plan-glow"
              key={pulseTrigger}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: [0, 0.8, 0], scale: [0.8, 1.2, 1] }}
              transition={{ duration: 1.2 }}
            />
          )}
        </AnimatePresence>

        <ClipboardCheck size={14} className="plan-pill-icon" />
        <span className="plan-pill-title">
          {isToday ? '今日作战' : isTomorrow ? '明日作战' : '作战计划'}
        </span>

        <span className={`plan-pill-badge ${baseTotal > 0 && baseCompleted === baseTotal ? 'badge-complete' : 'badge-base'}`}>
          🛡️ {baseCompleted}/{baseTotal}
        </span>
        <span className={`plan-pill-badge ${advTotal > 0 && advCompleted === advTotal ? 'badge-complete' : 'badge-adv'}`}>
          🔥 {advCompleted}/{advTotal}
        </span>

        <ChevronDown size={13} className={`plan-pill-arrow ${isOpen ? 'arrow-up' : ''}`} />
      </button>

      {/* 自动达成轻量气泡 */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            className="topbar-plan-toast"
            initial={{ y: -6, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -6, opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.25 }}
          >
            <Sparkles size={12} /> {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function PlanDrawer({
  isOpen,
  onToggle,
  currentPlan,
  selectedDate,
  todayDate,
  onSelectDate,
  onToggleItem,
  onAddItem,
  onDeleteItem,
  onStartQuestion,
  onAskCodexPlan,
}: {
  isOpen: boolean
  onToggle: () => void
  currentPlan: DailyPlan | null
  selectedDate: string
  todayDate: string
  onSelectDate: (dateStr: string) => void
  onToggleItem: (itemId: string, completed: boolean, event?: React.MouseEvent) => void
  onAddItem: (item: Omit<DailyPlanItem, 'id' | 'completed' | 'sortOrder'>) => void
  onDeleteItem: (itemId: string) => void
  onStartQuestion?: (questionId: number) => void
  onAskCodexPlan?: () => void
  pulseTrigger?: number
  toastMessage?: string | null
}) {
  const [soundOn, setSoundOn] = useState<boolean>(isSoundEnabled())
  const [showAddModal, setShowAddModal] = useState<boolean>(false)
  const [newTitle, setNewTitle] = useState<string>('')
  const [newTier, setNewTier] = useState<PlanQuestTier>('base')
  const [newType, setNewType] = useState<PlanTargetType>('manual')
  const [newCount, setNewCount] = useState<string>('5')
  const [newMinRating, setNewMinRating] = useState<string>('1.35')
  const [newQids, setNewQids] = useState<string>('')

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !soundOn
    setSoundOn(next)
    setSoundEnabled(next)
  }

  const baseQuests = currentPlan?.baseQuests ?? []
  const advancedQuests = currentPlan?.advancedQuests ?? []

  const baseCompleted = baseQuests.filter((q) => q.completed).length
  const baseTotal = baseQuests.length
  const advCompleted = advancedQuests.filter((q) => q.completed).length
  const advTotal = advancedQuests.length

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    const qids = newQids
      .split(/[,，\s]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0)

    onAddItem({
      planDate: selectedDate,
      tier: newTier,
      title: newTitle.trim(),
      targetType: newType,
      targetCount: newType === 'count' ? parseInt(newCount, 10) || 5 : null,
      minRating: newType === 'rating_challenge' ? parseFloat(newMinRating) || 1.35 : null,
      categoryPath: null,
      questionIds: qids,
    })

    setNewTitle('')
    setNewQids('')
    setShowAddModal(false)
  }

  // 计算昨天与明天的日期字符串 (YYYY-MM-DD)
  const shiftDate = (dateStr: string, days: number) => {
    const d = new Date(dateStr)
    d.setDate(d.getDate() + days)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const yesterdayStr = shiftDate(todayDate, -1)
  const tomorrowStr = shiftDate(todayDate, 1)

  const isToday = selectedDate === todayDate
  const isTomorrow = selectedDate === tomorrowStr

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="plan-top-overlay"
          key="top-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onToggle}
        >
          <motion.div
            className="plan-top-panel"
            key="top-panel"
            initial={{ y: -50, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -50, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部：日期切换器与控制按钮 */}
            <div className="top-panel-header">
              <div className="top-panel-date-nav">
                <button
                  className={`date-nav-btn ${selectedDate === yesterdayStr ? 'active' : ''}`}
                  onClick={() => onSelectDate(yesterdayStr)}
                >
                  <ChevronLeft size={13} /> 昨天
                </button>
                <button
                  className={`date-nav-btn ${isToday ? 'active' : ''}`}
                  onClick={() => onSelectDate(todayDate)}
                >
                  <Calendar size={13} /> 今天 ({todayDate.slice(5)})
                </button>
                <button
                  className={`date-nav-btn ${isTomorrow ? 'active' : ''}`}
                  onClick={() => onSelectDate(tomorrowStr)}
                >
                  明天 (提前规划) <ChevronRight size={13} />
                </button>
              </div>

              <div className="top-panel-header-actions">
                <button
                  className="icon-action-btn"
                  onClick={toggleSound}
                  title={soundOn ? '音效开启' : '音效静音'}
                >
                  {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} style={{ opacity: 0.5 }} />}
                </button>
                <button className="icon-action-btn" onClick={onToggle} title="收起 (P / Esc)">
                  <ChevronUp size={16} />
                </button>
              </div>
            </div>

            {/* 总结摘要 Slogan */}
            {currentPlan?.summary && (
              <div className="top-panel-summary-banner">
                <Sparkles size={15} className="summary-sparkle-icon" />
                <span>{currentPlan.summary}</span>
              </div>
            )}

            {/* 任务内容列表 */}
            <div className="top-panel-body">
              {/* 🛡️ 基础底线计划 */}
              <div className="quest-section">
                <div className="quest-section-header">
                  <div className="section-title-wrap">
                    <ShieldCheck size={16} className="base-icon" />
                    <span className="section-title">🛡️ 基础底线计划</span>
                    <span className="section-desc">每日基本盘 · 绝不欠账</span>
                  </div>
                  <span className={`section-counter ${baseTotal > 0 && baseCompleted === baseTotal ? 'counter-done' : ''}`}>
                    {baseCompleted} / {baseTotal}
                  </span>
                </div>

                <div className="quest-list">
                  {baseQuests.length === 0 ? (
                    <div className="quest-empty">暂无基础计划，点击下方「➕ 记一条新计划」或让 Codex 制定。</div>
                  ) : (
                    baseQuests.map((q) => (
                      <div key={q.id} className={`quest-card ${q.completed ? 'quest-card-done' : ''}`}>
                        <button
                          className={`quest-checkbox ${q.completed ? 'checkbox-checked' : ''}`}
                          onClick={(e) => onToggleItem(q.id, !q.completed, e)}
                        >
                          {q.completed && <Check size={13} strokeWidth={3} />}
                        </button>

                        <div className="quest-info">
                          <span className="quest-title">{q.title}</span>
                          <div className="quest-meta">
                            {q.targetType === 'question_ids' && q.questionIds.length > 0 && (
                              <div className="quest-qids-wrap">
                                {q.questionIds.map((qid) => (
                                  <span
                                    key={qid}
                                    className="quest-qid-badge"
                                    onClick={() => onStartQuestion?.(qid)}
                                    title="点击立即在工作台调出该题"
                                  >
                                    #{qid} <Play size={9} />
                                  </span>
                                ))}
                              </div>
                            )}
                            {q.targetType === 'count' && q.targetCount && (
                              <span className="quest-meta-tag">🎯 目标 {q.targetCount} 题</span>
                            )}
                            {q.targetType === 'manual' && <span className="quest-meta-tag tag-manual">线下/讲义</span>}
                          </div>
                        </div>

                        <button className="quest-del-btn" onClick={() => onDeleteItem(q.id)} title="删除此项">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 🔥 进阶冲刺计划 */}
              <div className="quest-section">
                <div className="quest-section-header">
                  <div className="section-title-wrap">
                    <Flame size={16} className="adv-icon" />
                    <span className="section-title">🔥 进阶冲刺计划</span>
                    <span className="section-desc">压轴挑战 · 突破上限</span>
                  </div>
                  <span className={`section-counter adv-counter ${advTotal > 0 && advCompleted === advTotal ? 'counter-done' : ''}`}>
                    {advCompleted} / {advTotal}
                  </span>
                </div>

                <div className="quest-list">
                  {advancedQuests.length === 0 ? (
                    <div className="quest-empty">暂无进阶计划，为明天定一个冲刺拔高目标吧！</div>
                  ) : (
                    advancedQuests.map((q) => (
                      <div key={q.id} className={`quest-card adv-card ${q.completed ? 'quest-card-done' : ''}`}>
                        <button
                          className={`quest-checkbox adv-checkbox ${q.completed ? 'checkbox-checked' : ''}`}
                          onClick={(e) => onToggleItem(q.id, !q.completed, e)}
                        >
                          {q.completed && <Check size={13} strokeWidth={3} />}
                        </button>

                        <div className="quest-info">
                          <span className="quest-title">{q.title}</span>
                          <div className="quest-meta">
                            {q.targetType === 'rating_challenge' && q.minRating && (
                              <span className="quest-meta-tag tag-rating">🌟 挑战 Rating ≥ {q.minRating}</span>
                            )}
                            {q.targetType === 'pressure_session' && (
                              <span className="quest-meta-tag tag-pressure">⚡ 高压演练</span>
                            )}
                            {q.targetType === 'question_ids' && q.questionIds.length > 0 && (
                              <div className="quest-qids-wrap">
                                {q.questionIds.map((qid) => (
                                  <span
                                    key={qid}
                                    className="quest-qid-badge adv-qid-badge"
                                    onClick={() => onStartQuestion?.(qid)}
                                    title="点击立即开始攻坚"
                                  >
                                    #{qid} <Play size={9} />
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <button className="quest-del-btn" onClick={() => onDeleteItem(q.id)} title="删除此项">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* 底部操作工具栏 */}
            <div className="top-panel-footer">
              <button className="panel-action-btn btn-add" onClick={() => setShowAddModal(true)}>
                <Plus size={14} /> 记一条新计划
              </button>

              {onAskCodexPlan && (
                <button className="panel-action-btn btn-codex" onClick={onAskCodexPlan}>
                  <Sparkles size={14} /> 让 Codex 辅助制定明日计划
                </button>
              )}

              <button className="panel-action-btn btn-collapse" onClick={onToggle}>
                <ChevronUp size={14} /> 收起 (P / Esc)
              </button>
            </div>

            {/* 新增任务 Modal */}
            <AnimatePresence>
              {showAddModal && (
                <motion.div
                  className="add-task-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowAddModal(false)}
                >
                  <motion.form
                    className="add-task-modal"
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    onSubmit={handleAddSubmit}
                  >
                    <div className="modal-header">
                      <h3>➕ 新增计划项 ({selectedDate})</h3>
                      <button type="button" className="close-btn" onClick={() => setShowAddModal(false)}>
                        <X size={16} />
                      </button>
                    </div>

                    <div className="form-group">
                      <label>计划层级</label>
                      <div className="tier-select-wrap">
                        <button
                          type="button"
                          className={`tier-btn ${newTier === 'base' ? 'active-base' : ''}`}
                          onClick={() => setNewTier('base')}
                        >
                          🛡️ 基础底线计划
                        </button>
                        <button
                          type="button"
                          className={`tier-btn ${newTier === 'advanced' ? 'active-adv' : ''}`}
                          onClick={() => setNewTier('advanced')}
                        >
                          🔥 进阶冲刺计划
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>计划内容 / 目标描述</label>
                      <input
                        type="text"
                        placeholder="例如：攻克 5 道定积分 King 变换题 / 复习第 5 讲笔记"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        autoFocus
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>任务类型</label>
                      <select value={newType} onChange={(e) => setNewType(e.target.value as PlanTargetType)}>
                        <option value="manual">手动打勾（线下复习/笔记/讲义）</option>
                        <option value="count">做题数量目标（刷满指定题数自动打勾）</option>
                        <option value="question_ids">指定题号集合（全部做对自动打勾）</option>
                        <option value="rating_challenge">Rating 挑战（取得高分自动打勾）</option>
                        <option value="pressure_session">高压演练（完成一场模拟自动打勾）</option>
                      </select>
                    </div>

                    {newType === 'question_ids' && (
                      <div className="form-group">
                        <label>指定题号（以逗号或空格分隔）</label>
                        <input
                          type="text"
                          placeholder="例如：101, 102, 520"
                          value={newQids}
                          onChange={(e) => setNewQids(e.target.value)}
                        />
                      </div>
                    )}

                    {newType === 'count' && (
                      <div className="form-group">
                        <label>目标题数</label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          value={newCount}
                          onChange={(e) => setNewCount(e.target.value)}
                        />
                      </div>
                    )}

                    {newType === 'rating_challenge' && (
                      <div className="form-group">
                        <label>最低 Rating 要求</label>
                        <input
                          type="number"
                          step="0.05"
                          min="0.5"
                          max="2.5"
                          value={newMinRating}
                          onChange={(e) => setNewMinRating(e.target.value)}
                        />
                      </div>
                    )}

                    <div className="modal-actions">
                      <button type="button" className="secondary-button compact" onClick={() => setShowAddModal(false)}>
                        取消
                      </button>
                      <button type="submit" className="primary-button compact">
                        确认添加
                      </button>
                    </div>
                  </motion.form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}