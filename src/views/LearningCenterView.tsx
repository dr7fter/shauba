import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  Check,
  ClipboardCopy,
  Clock3,
  Edit3,
  FileText,
  GraduationCap,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Sliders,
  Target,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addToCustomQueue,
  createLearningTask,
  dismissRecommendationBatch,
  getCategories,
  getFailedInbox,
  getInbox,
  getLearningCenterSnapshot,
  getLearningTaskCandidates,
  getQuestion,
  startRecommendationBatch,
  updateRecommendationBatchItems,
} from '../api'
import { isFeatureEnabled } from '../data/featureFlags'
import { MathText } from '../components/MathText'
import type {
  CategoryNode,
  FailedInboxItem,
  InboxItem,
  LearningCenterFeatureFlags,
  LearningCenterNavigationTarget,
  LearningCenterSnapshot,
  LearningCenterTrack,
  LearningEvidenceRef,
  LearningMetric,
  LearningMetricKey,
  LearningObjective,
  MistakeChain,
  Question,
} from '../types'
import './LearningCenterView.css'

type LearningCenterViewProps = {
  initialData?: LearningCenterSnapshot | null
  featureFlags?: LearningCenterFeatureFlags
  onNavigate: (target: LearningCenterNavigationTarget) => void
  onNotify: (message: string) => void
  onRefresh?: () => Promise<void>
}

const TRACK_LABELS: Record<LearningCenterTrack, string> = {
  repair: '修复',
  consolidate: '巩固',
  transfer: '迁移',
  challenge: '挑战',
}

const METRIC_LABELS: Record<LearningMetricKey, string> = {
  mastery: '掌握',
  fluency: '流畅',
  transfer: '迁移',
  retention: '保持',
  confidence: '置信',
}

const ROLE_META: Record<string, { label: string; desc: string; colorClass: string }> = {
  diagnosis: { label: '诊断', desc: '识别薄弱考法与最早错误断点', colorClass: 'learning-workbench-role-diagnosis' },
  method_choice: { label: '方法辨析', desc: '考察破局入口与最优策略选择', colorClass: 'learning-workbench-role-method_choice' },
  consolidate: { label: '巩固', desc: '熟练核心公式推导与计算链路', colorClass: 'learning-workbench-role-consolidate' },
  integration: { label: '综合', desc: '多考点与多分支条件交叉应用', colorClass: 'learning-workbench-role-integration' },
  transfer: { label: '迁移', desc: '改变条件或表现形式的结构化变式', colorClass: 'learning-workbench-role-transfer' },
  timed: { label: '限时', desc: '考场限时高压与秒杀节奏', colorClass: 'learning-workbench-role-timed' },
  challenge: { label: '挑战', desc: '高区分度压轴题突破', colorClass: 'learning-workbench-role-challenge' },
  review: { label: '复习', desc: '间隔回看与长效保持', colorClass: 'learning-workbench-role-consolidate' },
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '暂无时间'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatMetricValue(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '—' : String(Math.round(value))
}

function formatConfidence(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '未知置信度'
  return String(Math.round(value * 100)) + '% 置信'
}

function clampPercent(value: number | null): number {
  return value === null || !Number.isFinite(value) ? 0 : Math.min(100, Math.max(0, value))
}

function sectionErrorItems(snapshot: LearningCenterSnapshot | null): Array<{ section: string; message: string }> {
  const errors = snapshot?.sectionErrors
  if (!errors) return []
  if (Array.isArray(errors)) return errors.map((item) => ({ section: item.section, message: item.message }))
  return Object.entries(errors).flatMap(([section, message]) => (message ? [{ section, message }] : []))
}

function getIntegrityMessage(snapshot: LearningCenterSnapshot | null): string | null {
  if (!snapshot) return null
  const integrity = snapshot.integrity
  if (!integrity) return null
  if (typeof integrity === 'string') return integrity === 'ok' ? null : integrity
  if (integrity.status === 'ok') return null
  return integrity.message || '学习快照通过独立门禁校验。'
}

function trackNavigation(
  track: LearningCenterTrack,
  questionId: number | null,
): LearningCenterNavigationTarget {
  switch (track) {
    case 'repair':
      return { type: 'review', questionId }
    case 'consolidate':
    case 'transfer':
    case 'challenge':
    default:
      return { type: 'today', questionId }
  }
}

function ObjectiveCard({
  objective,
  onOpen,
}: {
  objective: LearningObjective
  onOpen: () => void
}) {
  const isDone = objective.status === 'stable_completed'
  const isBlocked = objective.status === 'blocked'
  return (
    <div
      className={`learning-objective ${isDone ? 'learning-objective-stable_completed' : ''} ${
        isBlocked ? 'learning-objective-blocked' : ''
      }`}
    >
      <div className="learning-objective-topline">
        <span className="learning-objective-order">#{objective.order}</span>
        <span className="learning-track-pill">{TRACK_LABELS[objective.track] ?? objective.track}</span>
        <span className="learning-status">{objective.status}</span>
      </div>
      <h3>{objective.title}</h3>
      <p>{objective.whyNow}</p>
      <div className="learning-objective-meta">
        <span><Clock3 size={13} /> {objective.estimatedMinutes} 分钟</span>
        <span><Target size={13} /> {objective.questionIds.length} 题</span>
      </div>
      <div className="learning-objective-footer">
        <small>{objective.successCriteria}</small>
        <button
          type="button"
          className="learning-primary-button compact"
          onClick={onOpen}
          disabled={isBlocked}
        >
          {isDone ? '查看记录' : '开始执行'} <ArrowRight size={13} />
        </button>
      </div>
    </div>
  )
}

function MetricStrip({
  metrics,
  projectionEnabled,
  onOpen,
}: {
  metrics: LearningMetric[]
  projectionEnabled: boolean
  onOpen: (m: LearningMetric) => void
}) {
  return (
    <section className="learning-card learning-metrics-card" aria-labelledby="learning-metrics-title">
      <div className="learning-section-heading">
        <div>
          <span className="learning-eyebrow">认知状态</span>
          <h2 id="learning-metrics-title">学习指标雷达</h2>
        </div>
        <span className="learning-muted">
          {projectionEnabled ? '采用双引擎投影事实' : '仅展示受控事实证据'}
        </span>
      </div>
      <div className="learning-metric-strip">
        {metrics.map((m) => (
          <button
            type="button"
            key={m.key}
            className="learning-metric"
            onClick={() => onOpen(m)}
          >
            <span className="learning-metric-label">{METRIC_LABELS[m.key]}</span>
            <strong>{formatMetricValue(m.value)}</strong>
            <span className="learning-meter" aria-hidden="true">
              <i style={{ width: `${clampPercent(m.value)}%` }} />
            </span>
            <small>{m.description}</small>
          </button>
        ))}
      </div>
    </section>
  )
}

function EmptySection({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="learning-empty">
      <BookOpenCheck size={28} />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="learning-center learning-center-skeleton">
      <div className="learning-skeleton-head" />
      <div className="learning-skeleton-grid">
        <div className="learning-skeleton-card" />
        <div className="learning-skeleton-card" />
      </div>
    </div>
  )
}

function EvidenceDrawer({
  metric,
  evidence,
  onClose,
}: {
  metric: LearningMetric | null
  evidence: LearningEvidenceRef[]
  onClose: () => void
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!metric) return null
  return (
    <div className="learning-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="learning-evidence-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="learning-evidence-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="learning-drawer-head">
          <div>
            <span className="learning-eyebrow">证据抽屉</span>
            <h2 id="learning-evidence-title">{METRIC_LABELS[metric.key]} · {metric.description}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="learning-icon-button"
            onClick={onClose}
            aria-label="关闭证据抽屉"
          >
            <X size={18} />
          </button>
        </div>
        <p className="learning-drawer-note">
          这里展示后端提供的证据引用，不在前端推断稳定、变式或延迟复习结论。
        </p>
        {evidence.length === 0 ? (
          <EmptySection title="暂无可展示证据" detail="没有足够的本地证据引用，指标不会被前端补成默认分数。" />
        ) : (
          <div className="learning-evidence-list">
            {evidence.map((item) => (
              <div className="learning-evidence-item" key={item.id}>
                <div className="learning-evidence-line">
                  <strong>{item.source}</strong>
                  <span>{formatDateTime(item.observedAt)}</span>
                </div>
                <div className="learning-evidence-line">
                  <span>题目 {item.questionId ?? '—'} · 作答 {item.attemptId ?? '—'}</span>
                  <span>{formatConfidence(item.confidence)}</span>
                </div>
                <p>{item.note ?? (item.accepted ? '已被投影接受' : '保留为原始证据，未进入核心投影')}</p>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  )
}

function DefusalStepProgress({ chain }: { chain: MistakeChain }) {
  const steps = [
    { label: '诊断', done: chain.stage !== 'exposed', active: chain.stage === 'exposed' },
    { label: '原题', done: chain.originalRetryPassed, active: chain.stage === 'diagnosed' || chain.stage === 'original_retry' },
    { label: '相似', done: chain.similarPassed, active: chain.stage === 'similar_check' },
    { label: '变式', done: chain.transferPassed, active: chain.stage === 'transfer_check' },
    { label: '延迟', done: chain.delayedReviewPassed, active: chain.stage === 'delayed_review' },
    { label: '🛡️排雷', done: Boolean(chain.stableClosedAt), active: chain.stage === 'closed' },
  ]

  return (
    <div className="defusal-step-progress">
      {steps.map((step, idx) => (
        <div key={step.label} className={`step-node-item ${step.done ? 'completed' : step.active ? 'active' : ''}`}>
          <div className="step-dot">{step.done ? '✓' : idx + 1}</div>
          <span className="step-node-label">{step.label}</span>
        </div>
      ))}
    </div>
  )
}

/** AI 题组工作台抽屉：支持逐题预览、勾选筛选、同角色替换、入自定义队列与采用开练 */
function AiWorkbenchDrawer({
  batch,
  onClose,
  onAdopt,
  onDismiss,
  onNotify,
}: {
  batch: InboxItem
  onClose: () => void
  onAdopt: (activeIds: number[]) => Promise<void>
  onDismiss: () => Promise<void>
  onNotify: (msg: string) => void
}) {
  const [candidates, setCandidates] = useState<Question[]>([])
  const [questionsMap, setQuestionsMap] = useState<Record<number, Question>>({})
  const [questionIds, setQuestionIds] = useState<number[]>(
    batch.recommendationOrder?.length ? batch.recommendationOrder : (batch.recommendedQuestionIds ?? [])
  )
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set())
  const [replacingTargetQid, setReplacingTargetQid] = useState<number | null>(null)
  const [adopting, setAdopting] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  useEffect(() => {
    let mounted = true
    const initData = async () => {
      try {
        const cands = await getLearningTaskCandidates(batch.taskId)
        if (mounted) setCandidates(cands)
        const qMap: Record<number, Question> = {}
        for (const c of cands) qMap[c.id] = c
        // Fetch any missing questions
        const missingIds = questionIds.filter((id) => !qMap[id])
        await Promise.all(
          missingIds.map(async (id) => {
            try {
              const q = await getQuestion(id)
              if (q) qMap[id] = q
            } catch {
              // ignore
            }
          })
        )
        if (mounted) setQuestionsMap(qMap)
      } catch {
        // ignore
      }
    }
    void initData()
    return () => {
      mounted = false
    }
  }, [batch.taskId, questionIds])

  const activeQuestionIds = useMemo(
    () => questionIds.filter((id) => !excludedIds.has(id)),
    [questionIds, excludedIds]
  )

  const toggleInclude = (qid: number) => {
    if (!excludedIds.has(qid) && activeQuestionIds.length <= 1) {
      onNotify('题组至少需保留 1 道题目')
      return
    }
    setExcludedIds((prev) => {
      const next = new Set(prev)
      if (next.has(qid)) next.delete(qid)
      else next.add(qid)
      return next
    })
  }

  const handleReplaceWith = (newQid: number) => {
    if (replacingTargetQid === null) return
    setQuestionIds((prev) => prev.map((id) => (id === replacingTargetQid ? newQid : id)))
    setReplacingTargetQid(null)
    onNotify(`已将题目 #${replacingTargetQid} 替换为备选题目 #${newQid}`)
  }

  const handleAddToCustom = async (qid: number) => {
    try {
      await addToCustomQueue(qid)
      onNotify(`题目 #${qid} 已成功加入自定义队列`)
    } catch (err) {
      onNotify(`加入队列失败：${String(err)}`)
    }
  }

  const handleConfirmAdopt = async () => {
    if (activeQuestionIds.length === 0) {
      onNotify('题组至少需保留 1 道有效题目')
      return
    }
    setAdopting(true)
    try {
      await onAdopt(activeQuestionIds)
    } finally {
      setAdopting(false)
    }
  }

  const handleConfirmDismiss = async () => {
    setDismissing(true)
    try {
      await onDismiss()
    } finally {
      setDismissing(false)
    }
  }

  const totalEstimatedMinutes = Math.max(10, activeQuestionIds.length * 4)

  return (
    <div className="learning-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="learning-workbench-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="learning-workbench-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="learning-workbench-header">
          <div className="learning-workbench-title-row">
            <div>
              <span className="learning-eyebrow"><Sparkles size={13} /> AI 题组工作台 · 结构化校验</span>
              <h2 id="learning-workbench-title">{batch.goal ?? batch.summary}</h2>
            </div>
            <button type="button" className="learning-icon-button" onClick={onClose} aria-label="关闭工作台">
              <X size={18} />
            </button>
          </div>
          <p className="learning-drawer-note">{batch.recommendationReason ?? '根据当前历史作答证据生成的自适应题组。'}</p>
          <div className="learning-workbench-meta-grid">
            <span className="learning-workbench-meta-pill">
              <Target size={12} /> 已选 {activeQuestionIds.length}/{questionIds.length} 题
            </span>
            <span className="learning-workbench-meta-pill">
              <Clock3 size={12} /> 预计 {totalEstimatedMinutes} 分钟
            </span>
            {batch.noveltyPlan && batch.noveltyPlan.length > 0 && (
              <span className="learning-workbench-meta-pill">
                <Sliders size={12} /> 考法变化：{batch.noveltyPlan.join('、')}
              </span>
            )}
          </div>
        </div>

        {/* 替换题目选单 Modal */}
        {replacingTargetQid !== null && (
          <div className="learning-candidate-picker-card">
            <div className="learning-candidate-picker-head">
              <strong>从本次 AI 候选题中替换题目 (原题 #{replacingTargetQid})</strong>
              <button type="button" className="learning-icon-button compact" onClick={() => setReplacingTargetQid(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="learning-candidate-picker-list">
              {candidates
                .filter((c) => !questionIds.includes(c.id))
                .slice(0, 8)
                .map((cand) => (
                  <div key={cand.id} className="learning-candidate-picker-item">
                    <div>
                      <b>#{cand.id} · {cand.categoryPath.split(' / ').slice(-2).join(' · ')}</b>
                      <small className="candidate-stem-preview">{cand.stem.slice(0, 60)}...</small>
                    </div>
                    <button
                      type="button"
                      className="learning-primary-button compact"
                      onClick={() => handleReplaceWith(cand.id)}
                    >
                      替换为此题
                    </button>
                  </div>
                ))}
              {candidates.filter((c) => !questionIds.includes(c.id)).length === 0 && (
                <p className="learning-muted" style={{ padding: '8px' }}>
                  本次任务候选题库中暂无其他备选题。
                </p>
              )}
            </div>
          </div>
        )}

        <div className="learning-workbench-questions-list">
          {questionIds.map((qid, idx) => {
            const isExcluded = excludedIds.has(qid)
            const q = questionsMap[qid]
            const roleKey = batch.questionRoles?.[String(qid)] ?? 'consolidate'
            const roleInfo = ROLE_META[roleKey] ?? {
              label: roleKey,
              desc: '自适应训练题目',
              colorClass: 'learning-workbench-role-consolidate',
            }

            return (
              <article
                key={qid}
                className={`learning-workbench-item ${isExcluded ? 'excluded' : ''}`}
              >
                <div className="learning-workbench-item-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      id={`chk-${qid}`}
                      checked={!isExcluded}
                      onChange={() => toggleInclude(qid)}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <span className="learning-workbench-item-qnum">#{idx + 1}</span>
                    <strong style={{ fontSize: 'var(--fs-sm)' }}>题目 #{qid}</strong>
                    <span className={`learning-workbench-role-badge ${roleInfo.colorClass}`}>
                      {roleInfo.label}
                    </span>
                  </div>
                  <span className="learning-muted" style={{ fontSize: 'var(--fs-xs)' }}>
                    {q?.categoryPath ? q.categoryPath.split(' / ').slice(-2).join(' · ') : '加载中…'}
                  </span>
                </div>

                <div className="learning-workbench-item-stem">
                  {q ? <MathText value={q.stem} /> : <span>题目加载中...</span>}
                </div>

                <div className="learning-workbench-item-actions">
                  <span className="learning-muted" style={{ fontSize: 'var(--fs-xs)' }}>
                    {roleInfo.desc}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      className="learning-secondary-button compact"
                      onClick={() => setReplacingTargetQid(qid)}
                      title="从同任务候选题目中选择替换"
                    >
                      <RotateCcw size={12} /> 同角色替换
                    </button>
                    <button
                      type="button"
                      className="learning-secondary-button compact"
                      onClick={() => void handleAddToCustom(qid)}
                      title="加入自定义队列随时单练"
                    >
                      <Plus size={12} /> 加自定义队
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        <div className="learning-workbench-footer-bar">
          <div>
            <strong style={{ fontSize: 'var(--fs-md)', color: 'var(--ink)' }}>
              合计 {activeQuestionIds.length} 题 · 约 {totalEstimatedMinutes} 分钟
            </strong>
            <small style={{ display: 'block', color: 'var(--muted)', fontSize: 'var(--fs-xs)' }}>
              将按上述顺序载入做题队列，并在完成后结构化输出下一轮学习事实
            </small>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="learning-secondary-button danger"
              onClick={handleConfirmDismiss}
              disabled={dismissing}
              title="拒绝并放弃该题组"
            >
              <Trash2 size={14} /> 放弃此题组
            </button>
            <button
              type="button"
              className="learning-primary-button"
              onClick={handleConfirmAdopt}
              disabled={adopting || activeQuestionIds.length === 0}
            >
              <Zap size={14} /> ⚡ 确认调整并开练
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}

/** 完成题组结果面板抽屉 */
function CompletedResultDrawer({
  batch,
  onClose,
  onGenerateNext,
}: {
  batch: InboxItem
  onClose: () => void
  onGenerateNext: (reqText: string) => void
}) {
  return (
    <div className="learning-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="learning-result-modal-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="learning-result-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="learning-drawer-head">
          <div>
            <span className="learning-eyebrow"><Check size={13} /> 题组完成报告 · 执行上下文</span>
            <h2 id="learning-result-title">{batch.goal ?? batch.summary}</h2>
          </div>
          <button type="button" className="learning-icon-button" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="learning-result-status-card">
          <strong style={{ fontSize: 'var(--fs-base)', color: 'var(--green-dark)' }}>
            🎯 目标与考法验证报告
          </strong>
          <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--ink)' }}>
            {batch.recommendationReason ?? '本组题目已全部作答完成，作答耗时、自评分与批改证据已写入结构化事实库。'}
          </p>
        </div>

        <div>
          <h3 style={{ fontSize: 'var(--fs-md)', margin: 'var(--sp-2) 0' }}>📋 考法覆盖与作答证据</h3>
          <div style={{ display: 'grid', gap: '8px' }}>
            {(batch.recommendedQuestionIds ?? []).map((qid, idx) => (
              <div key={qid} className="learning-ai-return-item" style={{ padding: '8px 12px' }}>
                <div>
                  <strong>#{idx + 1} · 题目 #{qid}</strong>
                  <small>角色：{batch.questionRoles?.[String(qid)] ?? '巩固题'} · 已绑定真实作答记录</small>
                </div>
                <span className="learning-track-pill" style={{ background: 'var(--success-soft)', color: 'var(--success-strong)' }}>
                  已完成
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--line)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="learning-muted" style={{ fontSize: 'var(--fs-xs)' }}>
            下一轮 AI 会优先保留未验证考法，并对高风险考法安排方法辨析
          </span>
          <button
            type="button"
            className="learning-primary-button"
            onClick={() => {
              onClose()
              onGenerateNext(`根据「${batch.goal ?? batch.summary}」完成结果，安排下一轮：保留未验证考法，避免同构题。`)
            }}
          >
            <Sparkles size={14} /> 🚀 继续安排下一轮自适应训练
          </button>
        </div>
      </aside>
    </div>
  )
}

export function LearningCenterView({
  initialData = null,
  featureFlags,
  onNavigate,
  onNotify,
  onRefresh,
}: LearningCenterViewProps) {
  const flags = featureFlags ?? {
    learningCenterV1: isFeatureEnabled('learningCenterV1'),
    learningEvidenceProjectionV1: isFeatureEnabled('learningEvidenceProjectionV1'),
    lowConfidenceGateV1: isFeatureEnabled('lowConfidenceGateV1'),
    nonPressureBatchGradingV1: isFeatureEnabled('nonPressureBatchGradingV1'),
    shadowRecommendationPlanV1: isFeatureEnabled('shadowRecommendationPlanV1'),
    rankedOnlyEloV1: isFeatureEnabled('rankedOnlyEloV1'),
    friendBroadcastsV1: isFeatureEnabled('friendBroadcastsV1'),
    aiRecommendationV1: isFeatureEnabled('aiRecommendationV1'),
    recommendationValidatorV1: isFeatureEnabled('recommendationValidatorV1'),
    learningGroupV1: isFeatureEnabled('learningGroupV1'),
  }
  const [snapshot, setSnapshot] = useState<LearningCenterSnapshot | null>(initialData)
  const snapshotRef = useRef<LearningCenterSnapshot | null>(initialData)
  const requestSeqRef = useRef(0)
  const initialLoadTriggeredRef = useRef(Boolean(initialData))
  const [loading, setLoading] = useState(!initialData)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedMetric, setSelectedMetric] = useState<LearningMetric | null>(null)
  const [chainTab, setChainTab] = useState<'active' | 'trophy'>('active')
  const [aiRequest, setAiRequest] = useState('')
  const [aiMinutes, setAiMinutes] = useState(40)
  const [aiCategoryId, setAiCategoryId] = useState<number | null>(null)
  const [availableCategories, setAvailableCategories] = useState<CategoryNode[]>([])
  const [aiTask, setAiTask] = useState<{ taskId: string; prompt: string; outputFile: string } | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiRecommendations, setAiRecommendations] = useState<InboxItem[]>([])
  const [aiCompletedRecommendations, setAiCompletedRecommendations] = useState<InboxItem[]>([])
  const [failedInboxItems, setFailedInboxItems] = useState<FailedInboxItem[]>([])
  const [selectedWorkbenchBatch, setSelectedWorkbenchBatch] = useState<InboxItem | null>(null)
  const [selectedResultBatch, setSelectedResultBatch] = useState<InboxItem | null>(null)

  const aiTemplates = [
    '漏洞修复：优先处理最近高信心错误，安排一题诊断和一题验证。',
    '扩大覆盖：标准题已经熟悉，改变条件、表示或方法入口，避免只换数字。',
    '方法辨析：我想练识别解题入口，减少机械硬算。',
    '迁移挑战：在已有独立正确证据后，安排有结构依据的变式迁移。',
    '考场限时：在有限时间内保留诊断和验证，控制题组负荷。',
  ]

  const load = useCallback(
    async (initial = false) => {
      if (!flags.learningCenterV1) return
      const requestSeq = ++requestSeqRef.current
      const hasSnapshot = Boolean(snapshotRef.current)
      if (initial && !hasSnapshot) setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const [inbox, failed, cats, next] = await Promise.all([
          getInbox().catch(() => []),
          getFailedInbox().catch(() => []),
          getCategories().catch(() => []),
          getLearningCenterSnapshot(),
        ])
        setAiRecommendations(
          inbox
            .filter((item) => {
              if (item.kind !== 'recommendation' || (item.recommendedQuestionIds?.length ?? 0) === 0) return false
              if (item.status === 'dismissed') return false
              return !item.recommendationBatchStatus || item.recommendationBatchStatus === 'pending'
            })
            .slice(0, 4)
        )
        setAiCompletedRecommendations(
          inbox
            .filter(
              (item) => item.kind === 'recommendation' && item.recommendationBatchStatus === 'completed'
            )
            .slice(0, 4)
        )
        setFailedInboxItems(failed)
        setAvailableCategories(cats.filter((c) => c.depth >= 1 && c.questionCount > 0))
        if (requestSeq !== requestSeqRef.current) return
        snapshotRef.current = next
        setSnapshot(next)
        if (onRefresh) await onRefresh()
      } catch (cause) {
        if (requestSeq !== requestSeqRef.current) return
        const message = cause instanceof Error ? cause.message : String(cause)
        setError(message)
        onNotify(message.includes('学习中心仅支持桌面端本地数据') ? message : '学习中心刷新失败：' + message)
      } finally {
        if (requestSeq === requestSeqRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [flags.learningCenterV1, onNotify, onRefresh]
  )

  useEffect(() => {
    if (!flags.learningCenterV1 || initialData || initialLoadTriggeredRef.current) return
    initialLoadTriggeredRef.current = true
    void load(true)
  }, [flags.learningCenterV1, initialData, load])

  const sectionErrors = useMemo(() => sectionErrorItems(snapshot), [snapshot])
  const integrityMessage = getIntegrityMessage(snapshot)
  const metrics = snapshot?.metrics ?? []
  const objectives = snapshot?.today?.objectives ?? []
  const chains = snapshot?.mistakeChains ?? []
  const activeChains = chains.filter((c) => c.stage !== 'closed' && !c.stableClosedAt)
  const trophyChains = chains.filter((c) => c.stage === 'closed' || Boolean(c.stableClosedAt))
  const recentEvidence = snapshot?.recentEvidence ?? []

  const openObjective = (objective: LearningObjective) => {
    const target = trackNavigation(objective.track, objective.questionIds[0] ?? null)
    onNavigate({ ...target, objectiveId: objective.id } as LearningCenterNavigationTarget)
  }

  const openChain = (chain: MistakeChain) => {
    const qidStr = chain.id.split(':').pop()
    const qid = qidStr ? parseInt(qidStr, 10) : null
    onNavigate({ type: 'review', mistakeChainId: chain.id, questionId: Number.isFinite(qid) ? qid : null })
  }

  const handleCreateAiTask = async () => {
    const request = aiRequest.trim()
    if (!request) {
      onNotify('请先描述这次想练什么，例如“标准题已熟，想覆盖更多考法”')
      return
    }
    setAiBusy(true)
    try {
      const task = await createLearningTask({ request, availableMinutes: aiMinutes, categoryId: aiCategoryId })
      setAiTask(task)
      onNotify(`AI 学习任务已生成：${task.taskId}。复制任务说明发给 Codex，回传后刷新学习中心。`)
    } catch (error) {
      onNotify(`生成 AI 学习任务失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setAiBusy(false)
    }
  }

  const copyAiPrompt = async () => {
    if (!aiTask) return
    if (!navigator.clipboard?.writeText) {
      onNotify('当前环境不支持复制，请直接打开任务说明文件')
      return
    }
    try {
      await navigator.clipboard.writeText(aiTask.prompt)
      onNotify('AI 任务说明已复制；请发送给 Codex，并让它按说明写回回传文件')
    } catch {
      onNotify('复制失败，请直接打开任务说明文件：' + aiTask.outputFile)
    }
  }

  if (!flags.learningCenterV1) return null
  if (loading && !snapshot) return <LoadingSkeleton />

  return (
    <div className="learning-center" aria-busy={refreshing}>
      <header className="learning-center-header">
        <div>
          <span className="learning-eyebrow"><GraduationCap size={14} aria-hidden="true" /> Phase D · AI 自适应学习</span>
          <h1>学习中心</h1>
          <p>根据你的需求和历史作答证据，让 AI 先识别考法，再生成结构化覆盖题组。</p>
        </div>
        <div className="learning-header-actions">
          <button
            type="button"
            className="learning-primary-button compact"
            onClick={() => setAiTask(aiTask ?? { taskId: '', prompt: '', outputFile: '' })}
            disabled={!flags.aiRecommendationV1}
          >
            <Sparkles size={14} /> AI 生成题组
          </button>
          <span className="learning-generated-at">
            {snapshot ? '生成于 ' + formatDateTime(snapshot.generatedAt) : '尚未生成快照'}
          </span>
          <button
            type="button"
            className="learning-refresh-button"
            onClick={() => void load(!snapshot)}
            disabled={refreshing}
            aria-label="刷新学习中心"
          >
            <RefreshCw size={15} className={refreshing ? 'learning-spin' : ''} /> {refreshing ? '更新中…' : '刷新'}
          </button>
        </div>
      </header>

      {error && snapshot && (
        <div className="learning-alert learning-alert-warn" role="status">
          <AlertTriangle size={16} />
          <span>本次刷新失败，仍保留上一次快照：{error}</span>
          <button type="button" onClick={() => void load(false)}>重试</button>
        </div>
      )}
      {integrityMessage && (
        <div className="learning-alert learning-alert-info" role="status">
          <ShieldCheck size={16} />
          <span>{integrityMessage}</span>
        </div>
      )}
      {sectionErrors.length > 0 && (
        <div className="learning-section-errors" role="status">
          {sectionErrors.map((item) => (
            <div className="learning-alert learning-alert-warn" key={item.section}>
              <AlertTriangle size={15} />
              <span>{item.section}：{item.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* 校验未通过的失败任务提示卡片 */}
      {failedInboxItems.length > 0 && (
        <section className="learning-card learning-failed-inbox-card" aria-label="回传校验异常">
          <div className="learning-section-heading">
            <div>
              <span className="learning-eyebrow" style={{ color: 'var(--warn-strong)' }}>
                <AlertTriangle size={13} /> 回传校验异常 ({failedInboxItems.length})
              </span>
              <h2 style={{ fontSize: 'var(--fs-lg)', margin: '4px 0 0' }}>AI 回传未通过结构化门禁校验</h2>
            </div>
            <span className="learning-muted">已自动隔离，不影响正常刷题与天梯记账</span>
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {failedInboxItems.map((f, i) => (
              <div key={i} className="learning-failed-inbox-item">
                <div>
                  <strong style={{ fontSize: 'var(--fs-sm)' }}>文件：{f.fileName}</strong>
                  <p style={{ margin: '2px 0 0', fontSize: 'var(--fs-xs)', color: 'var(--danger-strong)' }}>
                    原因：{f.error}
                  </p>
                </div>
                <button
                  type="button"
                  className="learning-secondary-button compact"
                  onClick={() => {
                    setAiTask({ taskId: '', prompt: '', outputFile: '' })
                    setAiRequest('重新规划本轮题组：严格从上下文 candidates 中选择题号，遵循时间预算。')
                  }}
                >
                  重新发起规划
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {!snapshot ? (
        <div className="learning-card learning-full-error" role="alert">
          <AlertTriangle size={24} />
          <h2>暂时无法读取学习中心</h2>
          <p>{error ?? '没有可用的本地学习快照。'}</p>
          <button type="button" className="learning-primary-button" onClick={() => void load(true)}>
            重新读取
          </button>
        </div>
      ) : (
        <>
          <section className="learning-card learning-objectives-card" aria-labelledby="learning-objectives-title">
            <div className="learning-section-heading">
              <div>
                <span className="learning-eyebrow">今日起手式</span>
                <h2 id="learning-objectives-title">今天只做三件事</h2>
              </div>
              <div className="learning-header-actions">
                <span className="learning-progress-summary">
                  {snapshot.today?.completedCount ?? 0}/{snapshot.today?.totalCount ?? 0} 项 · {snapshot.today?.completedMinutes ?? 0}/{snapshot.today?.plannedMinutes ?? 0} 分钟
                </span>
                {objectives.length > 0 && (
                  <button
                    type="button"
                    className="learning-primary-button compact"
                    onClick={() => {
                      const allQids = objectives.flatMap((o) => o.questionIds).filter(Boolean)
                      if (allQids.length > 0) {
                        onNavigate({ type: 'today', questionId: allQids[0], queueQuestionIds: allQids })
                      } else {
                        openObjective(objectives[0])
                      }
                    }}
                  >
                    <Zap size={14} /> ⚡ 一键合流开练 ({objectives.length}项)
                  </button>
                )}
              </div>
            </div>
            {objectives.length === 0 ? (
              <EmptySection title="暂无今日目标" detail="后端没有返回可执行目标；学习中心不会在前端自行生成计划。" />
            ) : (
              <div className="learning-objectives-grid">
                {objectives.slice(0, 3).map((objective) => (
                  <ObjectiveCard key={objective.id} objective={objective} onOpen={() => openObjective(objective)} />
                ))}
              </div>
            )}
          </section>

          <MetricStrip metrics={metrics} projectionEnabled={flags.learningEvidenceProjectionV1} onOpen={setSelectedMetric} />

          {/* 待采用的 AI 题组列表 */}
          {aiRecommendations.length > 0 && (
            <section className="learning-card learning-ai-return-card" aria-labelledby="learning-ai-return-title">
              <div className="learning-section-heading">
                <div>
                  <span className="learning-eyebrow">AI 规划题组</span>
                  <h2 id="learning-ai-return-title">待采用的自适应题组 ({aiRecommendations.length})</h2>
                </div>
                <span className="learning-muted">已按题号、候选范围与考法角色严格校验</span>
              </div>
              <div className="learning-ai-return-list">
                {aiRecommendations.map((item) => (
                  <article className="learning-ai-return-item" key={item.taskId}>
                    <div>
                      <strong>{item.goal ?? item.summary}</strong>
                      <p>{item.recommendationReason ?? 'AI 未提供推荐理由。'}</p>
                      <small>
                        {(item.recommendationOrder?.length ?? item.recommendedQuestionIds?.length) ?? 0} 题 · 约 {item.estimatedMinutes ?? '—'} 分钟 · {item.noveltyPlan?.join('、') || '考法覆盖待查看'}
                      </small>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className="learning-secondary-button compact"
                        onClick={() => setSelectedWorkbenchBatch(item)}
                      >
                        <Edit3 size={13} /> 预览 / 编辑
                      </button>
                      <button
                        type="button"
                        className="learning-primary-button compact"
                        onClick={() => setSelectedWorkbenchBatch(item)}
                      >
                        <Zap size={14} /> 查看并开练
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* 最近完成的 AI 题组列表 */}
          {aiCompletedRecommendations.length > 0 && (
            <section className="learning-card learning-ai-complete-card" aria-labelledby="learning-ai-complete-title">
              <div className="learning-section-heading">
                <div>
                  <span className="learning-eyebrow">训练结果</span>
                  <h2 id="learning-ai-complete-title">最近完成的 AI 题组</h2>
                </div>
                <span className="learning-muted">已写入结构化事实库，供下一轮规划参考</span>
              </div>
              <div className="learning-ai-return-list">
                {aiCompletedRecommendations.map((item) => (
                  <article className="learning-ai-return-item" key={item.taskId}>
                    <div>
                      <strong>{item.goal ?? item.summary}</strong>
                      <p>{item.recommendationReason ?? '本组训练已完成。'}</p>
                      <small>
                        {item.recommendationQuestionCount ?? item.recommendedQuestionIds?.length ?? 0} 题全部完成 · 点击查看已验证与高风险考法
                      </small>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        className="learning-secondary-button compact"
                        onClick={() => setSelectedResultBatch(item)}
                      >
                        <FileText size={13} /> 考法验证报告
                      </button>
                      <button
                        type="button"
                        className="learning-primary-button compact"
                        onClick={() => {
                          setAiTask({ taskId: '', prompt: '', outputFile: '' })
                          setAiRequest(`根据上一组「${item.goal ?? item.summary}」完成结果，安排下一轮：保留未验证考法，避免同构题。`)
                        }}
                      >
                        <Sparkles size={13} /> 生成下一轮
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <div className="learning-main-grid">
            <section className="learning-card" aria-labelledby="learning-chains-title">
              <div className="learning-section-heading">
                <div>
                  <span className="learning-eyebrow">错题闭环</span>
                  <h2 id="learning-chains-title">
                    {chainTab === 'active' ? `在办排雷 (${activeChains.length})` : `🛡️ 排雷功勋档案 (${trophyChains.length})`}
                  </h2>
                </div>
                <div className="learning-header-actions">
                  <button
                    type="button"
                    className={`learning-chain-tab ${chainTab === 'active' ? 'active' : ''}`}
                    onClick={() => setChainTab('active')}
                  >
                    在办排雷
                  </button>
                  <button
                    type="button"
                    className={`learning-chain-tab ${chainTab === 'trophy' ? 'active' : ''}`}
                    onClick={() => setChainTab('trophy')}
                  >
                    🛡️ 功勋墙 ({trophyChains.length})
                  </button>
                  <button type="button" className="learning-link-button" onClick={() => onNavigate({ type: 'review' })}>
                    打开复盘 <ArrowRight size={14} />
                  </button>
                </div>
              </div>
              {chainTab === 'active' ? (
                activeChains.length === 0 ? (
                  <EmptySection title="暂无在办排雷链路" detail="当你在练习中答错题目并由 AI 诊断出最早断点时，会自动建立闭环追踪。" />
                ) : (
                  <div className="learning-chain-list">
                    {activeChains.slice(0, 6).map((chain) => (
                      <article className="learning-chain" key={chain.id}>
                        <div className="learning-chain-head">
                          <div>
                            <strong>{chain.label}</strong>
                            <small>{chain.categoryPath}</small>
                          </div>
                          <span className="learning-chain-stage">{chain.statusLabel}</span>
                        </div>
                        <DefusalStepProgress chain={chain} />
                        <button type="button" className="learning-link-button" onClick={() => openChain(chain)}>
                          查看排雷闭环 <ArrowRight size={13} />
                        </button>
                      </article>
                    ))}
                  </div>
                )
              ) : (
                trophyChains.length === 0 ? (
                  <EmptySection title="功勋档案尚无收录" detail="完成 原题重做 -> 相似验证 -> 变式迁移 -> 延迟复习 的题目将在此永久封存。" />
                ) : (
                  <div className="learning-chain-list">
                    {trophyChains.slice(0, 6).map((chain) => (
                      <article className="learning-chain" key={chain.id}>
                        <div className="learning-chain-head">
                          <div>
                            <strong>🛡️ {chain.label}</strong>
                            <small>{chain.categoryPath}</small>
                          </div>
                          <span className="learning-chain-stage learning-chain-closed">稳定关闭</span>
                        </div>
                      </article>
                    ))}
                  </div>
                )
              )}
            </section>

            <section className="learning-card" aria-labelledby="learning-evidence-title">
              <div className="learning-section-heading">
                <div>
                  <span className="learning-eyebrow">事实库</span>
                  <h2 id="learning-evidence-title">最近作答证据</h2>
                </div>
                <span className="learning-muted">已投影的核心学习事实</span>
              </div>
              {recentEvidence.length === 0 ? (
                <EmptySection title="暂无学习证据" detail="开始日常练习或高压模考后，作答记录将自动汇入此证据库。" />
              ) : (
                <div className="learning-recent-evidence">
                  {recentEvidence.slice(0, 6).map((ev) => (
                    <div className="learning-recent-evidence-row" key={ev.id}>
                      <span className="learning-evidence-dot" />
                      <div>
                        <strong>{ev.source}</strong>
                        <small>题目 #{ev.questionId ?? '—'} · {formatConfidence(ev.confidence)}</small>
                      </div>
                      <span>{formatDateTime(ev.observedAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {/* AI 题组工作台抽屉 */}
      {selectedWorkbenchBatch && (
        <AiWorkbenchDrawer
          batch={selectedWorkbenchBatch}
          onClose={() => setSelectedWorkbenchBatch(null)}
          onAdopt={async (activeIds) => {
            await updateRecommendationBatchItems(selectedWorkbenchBatch.taskId, activeIds)
            await startRecommendationBatch(selectedWorkbenchBatch.taskId)
            setSelectedWorkbenchBatch(null)
            onNavigate({ type: 'today', questionId: activeIds[0], queueQuestionIds: activeIds })
            onNotify(`已采用 AI 题组「${selectedWorkbenchBatch.goal ?? selectedWorkbenchBatch.summary}」，共 ${activeIds.length} 题`)
          }}
          onDismiss={async () => {
            await dismissRecommendationBatch(selectedWorkbenchBatch.taskId)
            setSelectedWorkbenchBatch(null)
            onNotify(`已拒绝并放弃该 AI 题组`)
            await load(false)
          }}
          onNotify={onNotify}
        />
      )}

      {/* 题组完成报告抽屉 */}
      {selectedResultBatch && (
        <CompletedResultDrawer
          batch={selectedResultBatch}
          onClose={() => setSelectedResultBatch(null)}
          onGenerateNext={(nextReq) => {
            setAiTask({ taskId: '', prompt: '', outputFile: '' })
            setAiRequest(nextReq)
          }}
        />
      )}

      {/* 指标证据抽屉 */}
      <EvidenceDrawer
        metric={selectedMetric}
        evidence={snapshot?.recentEvidence ?? []}
        onClose={() => setSelectedMetric(null)}
      />

      {/* AI 生成题组模态抽屉 */}
      {aiTask && (
        <div className="learning-drawer-backdrop" role="presentation" onClick={() => setAiTask(null)}>
          <aside
            className="learning-ai-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="learning-ai-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="learning-drawer-head">
              <div>
                <span className="learning-eyebrow"><Sparkles size={13} /> AI 自适应学习会话</span>
                <h2 id="learning-ai-title">规划新的训练题组</h2>
              </div>
              <button type="button" className="learning-icon-button" onClick={() => setAiTask(null)} aria-label="关闭">
                <X size={18} />
              </button>
            </div>
            <p className="learning-drawer-note">
              描述你今天想怎么练，App 会自动结合历史作答证据、考法覆盖与候选题生成任务说明。
            </p>

            <div className="learning-ai-templates">
              {aiTemplates.map((tpl, i) => (
                <button
                  type="button"
                  key={i}
                  className="learning-ai-template"
                  onClick={() => setAiRequest(tpl)}
                >
                  {tpl.split('：')[0]}
                </button>
              ))}
            </div>

            <label className="learning-ai-label">
              <span>你的训练需求：</span>
              <textarea
                className="learning-ai-input"
                rows={3}
                value={aiRequest}
                onChange={(e) => setAiRequest(e.target.value)}
                placeholder="例如：标准题已熟悉，想覆盖更多考法变化，避免机械硬算。"
              />
            </label>

            <label className="learning-ai-label">
              <span>目标章节 / 考点分类 (可选)：</span>
              <select
                className="learning-ai-select"
                value={aiCategoryId ?? ''}
                onChange={(e) => setAiCategoryId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">🤖 智能自动识别（根据需求意图与考法语义精准匹配）</option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.path} ({c.questionCount}题)
                  </option>
                ))}
              </select>
            </label>

            <label className="learning-ai-label">
              <span>预计可用时间 (分钟)：</span>
              <select
                className="learning-ai-select"
                value={aiMinutes}
                onChange={(e) => setAiMinutes(Number(e.target.value))}
              >
                <option value={20}>20 分钟 (约 4-5 题)</option>
                <option value={30}>30 分钟 (约 6-8 题)</option>
                <option value={40}>40 分钟 (约 8-10 题)</option>
                <option value={60}>60 分钟 (约 12-15 题)</option>
                <option value={90}>90 分钟 (深度专项)</option>
              </select>
            </label>

            {aiTask.taskId ? (
              <div style={{ marginTop: '16px', display: 'grid', gap: '10px' }}>
                <div className="learning-ai-task-meta">
                  <strong>任务编号：{aiTask.taskId}</strong>
                  <span>任务说明与候选题上下文已生成并就绪。</span>
                </div>
                <div className="learning-ai-file">
                  <span>回传目标文件：</span>
                  <code>{aiTask.outputFile}</code>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="learning-primary-button" onClick={copyAiPrompt}>
                    <ClipboardCopy size={15} /> 复制任务说明给 Codex
                  </button>
                  <button
                    type="button"
                    className="learning-secondary-button"
                    onClick={() => {
                      void load(false)
                      onNotify('已刷新收件箱，若 Codex 已回传将展示在待采用题组中')
                    }}
                  >
                    <RefreshCw size={14} /> 刷新检查回传
                  </button>
                </div>
                <pre className="learning-ai-prompt">{aiTask.prompt}</pre>
              </div>
            ) : (
              <div style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className="learning-primary-button"
                  onClick={handleCreateAiTask}
                  disabled={aiBusy || !aiRequest.trim()}
                >
                  <Sparkles size={15} /> {aiBusy ? '生成任务中…' : '生成 AI 任务说明'}
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
