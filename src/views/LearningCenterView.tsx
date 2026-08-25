import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  ChevronRight,
  ChevronDown,
  ClipboardCopy,
  Clock3,
  Gauge,
  GraduationCap,
  ListChecks,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
  X,
  Plus,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addToCustomQueue, createLearningTask, getInbox, getLearningCenterSnapshot, startRecommendationBatch } from '../api'
import { isFeatureEnabled } from '../data/featureFlags'
import { MathText } from '../components/MathText'
import type {
  FriendBroadcastEvent,
  LearningCenterFeatureFlags,
  LearningCenterNavigationTarget,
  LearningCenterSnapshot,
  LearningCenterTrack,
  LearningEvidenceRef,
  LearningMetric,
  LearningMetricKey,
  LearningObjective,
  LearningRecommendation,
  MistakeChain,
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

const STAGE_LABELS: Record<string, string> = {
  exposed: '暴露', diagnosed: '已诊断', recall: '回忆', original_retry: '原题重做',
  similar_check: '相似验证', transfer_check: '变式迁移', delayed_review: '延迟复习',
  closed: '稳定关闭', remediating: '修复中', uncertain: '不确定', manual_check: '待人工确认',
}

const STATUS_LABELS: Record<string, string> = {
  not_started: '未开始', in_progress: '进行中', temporarily_passed: '暂时通过',
  stable_completed: '稳定完成', blocked: '被阻塞', skipped: '已跳过',
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '暂无时间'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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
  return Object.entries(errors).flatMap(([section, message]) => message ? [{ section, message }] : [])
}

function getIntegrityMessage(snapshot: LearningCenterSnapshot | null): string | null {
  const integrity = snapshot?.integrity
  if (!integrity) return null
  if (typeof integrity === 'string') return integrity
  if (integrity.stableGateStatus && integrity.stableGateStatus !== 'accepted') {
    const reasons = integrity.stableGateReasons?.filter(Boolean).join(' ')
    return reasons || '稳定性门控未通过：当前证据不足以证明稳定掌握。'
  }
  if (integrity.status && integrity.status !== 'ok') return integrity.message ?? '数据完整性状态：' + integrity.status
  return null
}

function trackNavigation(track: LearningCenterTrack, questionId: number | null | undefined): LearningCenterNavigationTarget {
  if (track === 'repair' || track === 'consolidate') return { type: 'review', questionId: questionId ?? null }
  return { type: 'today', questionId: questionId ?? null }
}

function EmptySection({ title, detail }: { title: string; detail: string }) {
  return <div className="learning-empty" role="status"><BookOpenCheck size={20} aria-hidden="true" /><strong>{title}</strong><span>{detail}</span></div>
}

function LoadingSkeleton() {
  return <div className="learning-center learning-center-skeleton" aria-busy="true" aria-label="正在加载学习中心"><div className="learning-skeleton-head" /><div className="learning-skeleton-grid">{Array.from({ length: 7 }, (_, index) => <div className="learning-skeleton-card" key={index} />)}</div></div>
}

function MetricStrip({ metrics, projectionEnabled, onOpen }: { metrics: LearningMetric[]; projectionEnabled: boolean; onOpen: (metric: LearningMetric) => void }) {
  const byKey = new Map(metrics.map((metric) => [metric.key, metric]))
  return <section className="learning-card learning-metrics-card" aria-labelledby="learning-metrics-title">
    <div className="learning-section-heading"><div><span className="learning-eyebrow">画像摘要</span><h2 id="learning-metrics-title">五指标</h2></div><span className="learning-muted">只读投影 · 不等同 Rating</span></div>
    {!projectionEnabled ? <EmptySection title="学习证据投影未开启" detail="打开 learningEvidenceProjectionV1 后才读取五指标。" /> : <div className="learning-metric-strip">{(Object.keys(METRIC_LABELS) as LearningMetricKey[]).map((key) => {
      const metric = byKey.get(key)
      const value = metric?.value ?? null
      return <button type="button" className="learning-metric" key={key} onClick={() => metric && onOpen(metric)} disabled={!metric} aria-label={metric ? '查看' + METRIC_LABELS[key] + '指标证据' : METRIC_LABELS[key] + '暂无证据'}><span className="learning-metric-label">{METRIC_LABELS[key]}</span><strong>{formatMetricValue(value)}</strong><span className="learning-meter"><i style={{ width: String(clampPercent(value)) + '%' }} /></span><small>{metric ? metric.state : 'unseen'} · {metric?.evidenceCount ?? 0} 条证据</small></button>
    })}</div>}
  </section>
}

function ObjectiveCard({ objective, onOpen }: { objective: LearningObjective; onOpen: () => void }) {
  const isBlocked = objective.status === 'blocked' || !objective.questionIds || objective.questionIds.length === 0
  const buttonText = objective.status === 'stable_completed'
    ? '查看闭环'
    : isBlocked
    ? '暂无题目'
    : '开始训练'

  return <article className={'learning-objective learning-objective-' + objective.status}>
    <div className="learning-objective-topline"><span className="learning-objective-order">0{objective.order}</span><span className="learning-track-pill">{TRACK_LABELS[objective.track]}</span><span className="learning-status">{STATUS_LABELS[objective.status] ?? objective.status}</span></div>
    <h3><MathText value={objective.title} /></h3><p><MathText value={objective.whyNow || '暂无推荐理由。'} /></p>
    <div className="learning-objective-meta"><span><Clock3 size={14} aria-hidden="true" /> {objective.estimatedMinutes} 分钟</span><span><ListChecks size={14} aria-hidden="true" /> {objective.completedItemCount}/{objective.plannedItemCount} 项</span></div>
    <div className="learning-objective-footer">
      <small>{objective.blockedReason ?? objective.successCriteria}</small>
      <button
        type="button"
        className="learning-link-button"
        onClick={onOpen}
        disabled={isBlocked}
      >
        {buttonText} {!isBlocked && <ArrowRight size={14} />}
      </button>
    </div>
  </article>
}

function EvidenceDrawer({ metric, evidence, onClose }: { metric: LearningMetric | null; evidence: LearningEvidenceRef[]; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [])

  if (!metric) return null
  return <div className="learning-drawer-backdrop" role="presentation" onClick={onClose}><aside className="learning-evidence-drawer" role="dialog" aria-modal="true" aria-labelledby="learning-evidence-title" onClick={(event) => event.stopPropagation()}>
    <div className="learning-drawer-head"><div><span className="learning-eyebrow">证据抽屉</span><h2 id="learning-evidence-title">{METRIC_LABELS[metric.key]} · {metric.description}</h2></div><button ref={closeButtonRef} type="button" className="learning-icon-button" onClick={onClose} aria-label="关闭证据抽屉"><X size={18} /></button></div>
    <p className="learning-drawer-note">这里展示后端提供的证据引用，不在前端推断稳定、变式或延迟复习结论。</p>
    {evidence.length === 0 ? <EmptySection title="暂无可展示证据" detail="没有足够的本地证据引用，指标不会被前端补成默认分数。" /> : <div className="learning-evidence-list">{evidence.map((item) => <div className="learning-evidence-item" key={item.id}><div className="learning-evidence-line"><strong>{item.source}</strong><span>{formatDateTime(item.observedAt)}</span></div><div className="learning-evidence-line"><span>题目 {item.questionId ?? '—'} · 作答 {item.attemptId ?? '—'}</span><span>{formatConfidence(item.confidence)}</span></div><p>{item.note ?? (item.accepted ? '已被投影接受' : '保留为原始证据，未进入核心投影')}</p></div>)}</div>}
  </aside></div>
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

export function LearningCenterView({ initialData = null, featureFlags, onNavigate, onNotify, onRefresh }: LearningCenterViewProps) {
  const flags = featureFlags ?? {
    learningCenterV1: isFeatureEnabled('learningCenterV1'), learningEvidenceProjectionV1: isFeatureEnabled('learningEvidenceProjectionV1'), lowConfidenceGateV1: isFeatureEnabled('lowConfidenceGateV1'), nonPressureBatchGradingV1: isFeatureEnabled('nonPressureBatchGradingV1'), shadowRecommendationPlanV1: isFeatureEnabled('shadowRecommendationPlanV1'), rankedOnlyEloV1: isFeatureEnabled('rankedOnlyEloV1'), friendBroadcastsV1: isFeatureEnabled('friendBroadcastsV1'), aiRecommendationV1: isFeatureEnabled('aiRecommendationV1'), recommendationValidatorV1: isFeatureEnabled('recommendationValidatorV1'), learningGroupV1: isFeatureEnabled('learningGroupV1'),
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
  const [selectedRecIds, setSelectedRecIds] = useState<Set<string>>(new Set())
  const [expandedRecIds, setExpandedRecIds] = useState<Set<string>>(new Set())
  const [aiRequest, setAiRequest] = useState('')
  const [aiMinutes, setAiMinutes] = useState(40)
  const [aiTask, setAiTask] = useState<{ taskId: string; prompt: string; outputFile: string } | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiRecommendations, setAiRecommendations] = useState<import('../types').InboxItem[]>([])
  const [aiCompletedRecommendations, setAiCompletedRecommendations] = useState<import('../types').InboxItem[]>([])
  const aiTemplates = [
    '漏洞修复：优先处理最近高信心错误，安排一题诊断和一题验证。',
    '扩大覆盖：标准题已经熟悉，改变条件、表示或方法入口，避免只换数字。',
    '方法辨析：我想练识别解题入口，减少机械硬算。',
    '迁移挑战：在已有独立正确证据后，安排有结构依据的变式迁移。',
    '考场限时：在有限时间内保留诊断和验证，控制题组负荷。',
  ]

  const load = useCallback(async (initial = false) => {
    if (!flags.learningCenterV1) return
    const requestSeq = ++requestSeqRef.current
    const hasSnapshot = Boolean(snapshotRef.current)
    if (initial && !hasSnapshot) setLoading(true); else setRefreshing(true)
    setError(null)
    try {
      const inbox = await getInbox().catch(() => [])
      setAiRecommendations(inbox.filter((item) => {
        if (item.kind !== 'recommendation' || (item.recommendedQuestionIds?.length ?? 0) === 0) return false
        if (item.status === 'dismissed') return false
        return !item.recommendationBatchStatus || item.recommendationBatchStatus === 'pending'
      }).slice(0, 3))
      setAiCompletedRecommendations(inbox.filter((item) => item.kind === 'recommendation' && item.recommendationBatchStatus === 'completed').slice(0, 3))
      const next = await getLearningCenterSnapshot()
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
  }, [flags.learningCenterV1, onNotify, onRefresh])

  useEffect(() => {
    if (!flags.learningCenterV1 || initialData || initialLoadTriggeredRef.current) return
    initialLoadTriggeredRef.current = true
    void load(true)
  }, [flags.learningCenterV1, initialData, load])

  const sectionErrors = useMemo(() => sectionErrorItems(snapshot), [snapshot])
  const integrityMessage = getIntegrityMessage(snapshot)
  const metrics = snapshot?.metrics ?? []
  const objectives = snapshot?.today?.objectives ?? []
  const recommendations = flags.shadowRecommendationPlanV1 ? (snapshot?.shadowPlan?.items ?? snapshot?.recommendations?.items ?? []) : []
  const recommendationWeights = flags.shadowRecommendationPlanV1 ? (snapshot?.shadowPlan?.weights ?? snapshot?.recommendations?.weights ?? { repair: 0, consolidate: 0, transfer: 0, challenge: 0 }) : { repair: 0, consolidate: 0, transfer: 0, challenge: 0 }
  const chains = snapshot?.mistakeChains ?? []
  const activeChains = chains.filter((c) => c.stage !== 'closed' && !c.stableClosedAt)
  const trophyChains = chains.filter((c) => c.stage === 'closed' || Boolean(c.stableClosedAt))
  const recentEvidence = snapshot?.recentEvidence ?? []
  const incentive = snapshot?.incentive
  const incentiveAvailable = Boolean(incentive?.available && snapshot?.capabilities?.canReadIncentiveLedger && incentive.xp !== null)

  const openObjective = (objective: LearningObjective) => {
    const target = trackNavigation(objective.track, objective.questionIds[0] ?? null)
    onNavigate({ ...target, objectiveId: objective.id } as LearningCenterNavigationTarget)
  }
  const openRecommendation = (item: LearningRecommendation) => onNavigate(trackNavigation(item.track, item.questionId))
  const openChain = (chain: MistakeChain) => {
    const qidStr = chain.id.split(':').pop()
    const qid = qidStr ? parseInt(qidStr, 10) : null
    onNavigate({ type: 'review', mistakeChainId: chain.id, questionId: Number.isFinite(qid) ? qid : null })
  }
  const openFriend = (event: FriendBroadcastEvent) => onNavigate({ type: 'friends', friendProfileId: event.friendProfileId || null })

  const toggleRecSelect = (id: string) => {
    setSelectedRecIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleMergeShadowQueue = () => {
    const selectedItems = recommendations.filter((r) => selectedRecIds.has(r.id) && r.questionId)
    const qids = selectedItems.map((r) => r.questionId as number)
    if (qids.length > 0) {
      onNavigate({
        type: 'today',
        questionId: qids[0],
        queueQuestionIds: qids,
      })
      onNotify(`已将选中的 ${qids.length} 道影子推荐题混编载入今日训练队列`)
    }
  }

  const handleAddSelectedToCustomQueue = async () => {
    const selectedItems = recommendations.filter((r) => selectedRecIds.has(r.id) && r.questionId)
    if (selectedItems.length === 0) return
    try {
      await Promise.all(selectedItems.map((item) => addToCustomQueue(item.questionId as number)))
      onNotify(`已将 ${selectedItems.length} 道题加入自定义队列，可在今日训练中继续安排`)
      setSelectedRecIds(new Set())
    } catch (error) {
      onNotify(`加入自定义队列失败：${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const handleCreateAiTask = async () => {
    const request = aiRequest.trim()
    if (!request) {
      onNotify('请先描述这次想练什么，例如“标准题已熟，想覆盖更多考法”')
      return
    }
    setAiBusy(true)
    try {
      const task = await createLearningTask({ request, availableMinutes: aiMinutes, categoryId: null })
      setAiTask(task)
      onNotify(`AI 学习任务已生成：${task.taskId}。复制任务说明发给 Codex，回传后刷新学习中心。`)
    } catch (error) {
      onNotify(`生成 AI 学习任务失败：${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setAiBusy(false)
    }
  }

  const openAiRecommendation = async (item: import('../types').InboxItem) => {
    const ids = item.recommendationOrder?.length ? item.recommendationOrder : (item.recommendedQuestionIds ?? [])
    if (ids.length === 0) return
    try {
      await startRecommendationBatch(item.taskId)
      onNavigate({ type: 'today', questionId: ids[0], queueQuestionIds: ids })
      onNotify(`已采用 AI 题组「${item.goal ?? item.summary}」，共 ${ids.length} 题`)
    } catch (error) {
      onNotify(`采用 AI 题组失败：${error instanceof Error ? error.message : String(error)}`)
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

  return <div className="learning-center" aria-busy={refreshing}>
    <header className="learning-center-header"><div><span className="learning-eyebrow"><GraduationCap size={14} aria-hidden="true" /> Phase D · AI 自适应学习</span><h1>学习中心</h1><p>根据你的需求和历史证据，让 AI 先识别考法，再生成覆盖目标题组。</p></div><div className="learning-header-actions"><button type="button" className="learning-primary-button compact" onClick={() => setAiTask(aiTask ?? { taskId: '', prompt: '', outputFile: '' })} disabled={!flags.aiRecommendationV1}><Sparkles size={14} /> AI 生成题组</button><span className="learning-generated-at">{snapshot ? '生成于 ' + formatDateTime(snapshot.generatedAt) : '尚未生成快照'}</span><button type="button" className="learning-refresh-button" onClick={() => void load(!snapshot)} disabled={refreshing} aria-label="刷新学习中心"><RefreshCw size={15} className={refreshing ? 'learning-spin' : ''} /> {refreshing ? '更新中…' : '刷新'}</button></div></header>
    {error && snapshot ? <div className="learning-alert learning-alert-warn" role="status"><AlertTriangle size={16} /><span>本次刷新失败，仍保留上一次快照：{error}</span><button type="button" onClick={() => void load(false)}>重试</button></div> : null}
    {integrityMessage ? <div className="learning-alert learning-alert-info" role="status"><ShieldCheck size={16} /><span>{integrityMessage}</span></div> : null}
    {sectionErrors.length > 0 ? <div className="learning-section-errors" role="status">{sectionErrors.map((item) => <div className="learning-alert learning-alert-warn" key={item.section}><AlertTriangle size={15} /><span>{item.section}：{item.message}</span></div>)}</div> : null}
    {!snapshot ? <div className="learning-card learning-full-error" role="alert"><AlertTriangle size={24} /><h2>暂时无法读取学习中心</h2><p>{error ?? '没有可用的本地学习快照。'}</p><button type="button" className="learning-primary-button" onClick={() => void load(true)}>重新读取</button></div> : <>
      <section className="learning-card learning-objectives-card" aria-labelledby="learning-objectives-title">
        <div className="learning-section-heading">
          <div><span className="learning-eyebrow">今日起手式</span><h2 id="learning-objectives-title">今天只做三件事</h2></div>
          <div className="learning-header-actions">
            <span className="learning-progress-summary">{snapshot.today?.completedCount ?? 0}/{snapshot.today?.totalCount ?? 0} 项 · {snapshot.today?.completedMinutes ?? 0}/{snapshot.today?.plannedMinutes ?? 0} 分钟</span>
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
        {objectives.length === 0 ? <EmptySection title="暂无今日目标" detail="后端没有返回可执行目标；学习中心不会在前端自行生成计划。" /> : <div className="learning-objectives-grid">{objectives.slice(0, 3).map((objective) => <ObjectiveCard key={objective.id} objective={objective} onOpen={() => openObjective(objective)} />)}</div>}
      </section>
      <MetricStrip metrics={metrics} projectionEnabled={flags.learningEvidenceProjectionV1} onOpen={setSelectedMetric} />
      {aiRecommendations.length > 0 && <section className="learning-card learning-ai-return-card" aria-labelledby="learning-ai-return-title"><div className="learning-section-heading"><div><span className="learning-eyebrow">AI 回传</span><h2 id="learning-ai-return-title">待采用的 AI 题组</h2></div><span className="learning-muted">已按题号和题组约束校验</span></div><div className="learning-ai-return-list">{aiRecommendations.map((item) => <article className="learning-ai-return-item" key={item.taskId}><div><strong>{item.goal ?? item.summary}</strong><p>{item.recommendationReason ?? 'AI 未提供推荐理由。'}</p><small>{item.recommendedQuestionIds?.length ?? 0} 题 · {item.estimatedMinutes ?? '—'} 分钟 · {item.noveltyPlan?.join('、') || '考法覆盖待查看'}</small></div><button type="button" className="learning-primary-button compact" onClick={() => void openAiRecommendation(item)}><Zap size={14} /> 采用并开练</button></article>)}</div></section>}
      {aiCompletedRecommendations.length > 0 && <section className="learning-card learning-ai-complete-card" aria-labelledby="learning-ai-complete-title"><div className="learning-section-heading"><div><span className="learning-eyebrow">训练结果</span><h2 id="learning-ai-complete-title">最近完成的 AI 题组</h2></div><span className="learning-muted">结果已写入下一轮 AI 上下文</span></div><div className="learning-ai-return-list">{aiCompletedRecommendations.map((item) => <article className="learning-ai-return-item" key={item.taskId}><div><strong>{item.goal ?? item.summary}</strong><p>{item.recommendationReason ?? '本组训练已完成。'}</p><small>{item.recommendationQuestionCount ?? item.recommendedQuestionIds?.length ?? 0} 题 · 可继续生成下一轮训练</small></div><button type="button" className="learning-secondary-button compact" onClick={() => { setAiTask({ taskId: '', prompt: '', outputFile: '' }); setAiRequest('根据上一组完成结果，继续安排下一轮：保留未验证考法，避免重复同构题。') }}>生成下一轮</button></article>)}</div></section>}
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
              <button type="button" className="learning-link-button" onClick={() => onNavigate({ type: 'review' })}>打开复盘 <ArrowRight size={14} /></button>
            </div>
          </div>
          {chainTab === 'active' ? (
            activeChains.length === 0 ? (
              <EmptySection title="暂无在办错题链" detail="当前错题已全部攻克或尚未形成闭环证据。" />
            ) : (
              <div className="learning-chain-list">
                {activeChains.slice(0, 5).map((chain) => (
                  <article className="learning-chain" key={chain.id}>
                    <div className="learning-chain-head">
                      <div>
                        <strong>{chain.label}</strong>
                        <small>{chain.categoryPath}</small>
                      </div>
                      <span className={'learning-chain-stage learning-chain-' + chain.stage}>
                        {chain.statusLabel || STAGE_LABELS[chain.stage] || chain.stage}
                      </span>
                    </div>
                    <DefusalStepProgress chain={chain} />
                    <p><MathText value={chain.blockedReason ?? chain.advice ?? ('证据 ' + chain.evidenceCount + ' 条 · ' + formatConfidence(chain.confidence))} /></p>
                    <button type="button" className="learning-link-button" onClick={() => openChain(chain)}>
                      推进排雷 <ChevronRight size={14} />
                    </button>
                  </article>
                ))}
              </div>
            )
          ) : (
            trophyChains.length === 0 ? (
              <EmptySection title="功勋墙暂无记录" detail="完成六步排雷闭环后，已攻克的硬骨头题目会永久陈列在此。" />
            ) : (
              <div className="learning-chain-list trophy-chain-list">
                {trophyChains.map((chain) => (
                  <article className="learning-chain learning-chain-trophy" key={chain.id}>
                    <div className="learning-chain-head">
                      <div>
                        <strong>🛡️ {chain.label} · 彻底排雷</strong>
                        <small>{chain.categoryPath} · 闭环于 {formatDateTime(chain.stableClosedAt)}</small>
                      </div>
                      <span className="learning-chain-stage learning-chain-closed">
                        已攻克闭环
                      </span>
                    </div>
                    <DefusalStepProgress chain={chain} />
                    <p><MathText value={chain.advice ?? '防线已牢不可破，已掌握该题型核心秒杀解法。'} /></p>
                    <button type="button" className="learning-link-button" onClick={() => openChain(chain)}>
                      翻阅排雷档案 <ChevronRight size={14} />
                    </button>
                  </article>
                ))}
              </div>
            )
          )}
        </section>
        <section className="learning-card" aria-labelledby="learning-recommendations-title">
          <div className="learning-section-heading">
            <div>
              <span className="learning-eyebrow">Shadow Plan</span>
              <h2 id="learning-recommendations-title">四轨推荐影子计划</h2>
            </div>
            <div className="learning-header-actions">
              {selectedRecIds.size > 0 && (
                <>
                  <button type="button" className="learning-secondary-button compact" onClick={() => void handleAddSelectedToCustomQueue()}><Plus size={14} /> 加入自定义队列</button>
                  <button type="button" className="learning-primary-button compact" onClick={handleMergeShadowQueue}><Zap size={14} /> 立即合流 ({selectedRecIds.size}题)</button>
                </>
              )}
              <span className="learning-shadow-badge">智能混编</span>
            </div>
          </div>
          {!flags.shadowRecommendationPlanV1 ? (
            <EmptySection title="影子计划未开启" detail="打开 shadowRecommendationPlanV1 后展示后端返回的四轨候选，不替换今日队列。" />
          ) : recommendations.length === 0 ? (
            <EmptySection title="暂无候选题目" detail={snapshot?.shadowPlan?.emptyReason ?? snapshot?.recommendations?.emptyReason ?? '后端没有返回可用的影子推荐；不会用旧推荐或假题目填充。'} />
          ) : (
            <>
              <div className="learning-track-weights">
                {(Object.keys(TRACK_LABELS) as LearningCenterTrack[]).map((track) => (
                  <span key={track}><b>{TRACK_LABELS[track]}</b> {Math.round(recommendationWeights[track] ?? 0)}%</span>
                ))}
              </div>
              <div className="learning-recommendation-list">
                {recommendations.slice(0, 6).map((item) => {
                  const isSelected = selectedRecIds.has(item.id)
                  const canSelect = item.state === 'available' || item.state === 'ready'
                  return (
                    <article className={`learning-recommendation ${isSelected ? 'selected' : ''}`} key={item.id}>
                      <div className="learning-recommendation-head">
                        {canSelect && (
                          <input
                            type="checkbox"
                            className="learning-rec-checkbox"
                            checked={isSelected}
                            onChange={() => toggleRecSelect(item.id)}
                            aria-label={`勾选题目 ${item.title}`}
                          />
                        )}
                        <span className={'learning-track-pill learning-track-' + item.track}>{TRACK_LABELS[item.track]}</span>
                        <span>{item.estimatedMinutes} 分钟</span>
                        <button type="button" className="learning-rec-expand" onClick={() => setExpandedRecIds((prev) => { const next = new Set(prev); next.has(item.id) ? next.delete(item.id) : next.add(item.id); return next })} aria-label={expandedRecIds.has(item.id) ? '收起推荐详情' : '展开推荐详情'}>{expandedRecIds.has(item.id) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
                      </div>
                      <strong><MathText value={item.title} /></strong>
                      <small>{item.categoryPath ?? '未提供章节路径'}</small>
                      <p><MathText value={item.reason.evidenceText || item.reason.goalText || '后端未提供推荐理由。'} /></p>
                      {expandedRecIds.has(item.id) && <div className="learning-recommendation-detail"><span><b>成功标准</b> {item.reason.successCriteria || '完成一次有效独立作答'}</span><span><b>证据</b> {item.reason.sourceEvidenceIds.length > 0 ? item.reason.sourceEvidenceIds.join('、') : '暂无可引用证据'}</span><span><b>结构</b> {item.isDifferentStructure ? '已确认结构变化' : item.variantOfQuestionId ? '关联变式题' : '普通候选题'}</span></div>}
                      <div className="learning-rec-actions">
                        <button
                          type="button"
                          className="learning-link-button"
                          onClick={() => openRecommendation(item)}
                          disabled={!canSelect}
                        >
                          {canSelect ? '直接跳转' : item.state} <ArrowRight size={14} />
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            </>
          )}
        </section>
      </div>
      <section className="learning-card learning-ledgers-card" aria-labelledby="learning-ledgers-title"><div className="learning-section-heading"><div><span className="learning-eyebrow">边界说明</span><h2 id="learning-ledgers-title">三账分离</h2></div><span className="learning-muted">本页只读，不写训练计划、ELO 或好友数据</span></div><div className="learning-ledger-grid"><article className="learning-ledger learning-ledger-training"><div className="learning-ledger-icon"><Target size={18} /></div><h3>训练账</h3><p>记录学习证据、诊断、复习链和计划完成度。</p><strong>{snapshot.training?.todayProblems ?? 0} 题 · {snapshot.training?.todayMinutes ?? 0} 分钟</strong><small>到期复习 {snapshot.training?.dueReviews ?? 0} · 活跃错题链 {snapshot.training?.activeMistakeChains ?? 0}</small><button type="button" className="learning-link-button" onClick={() => onNavigate({ type: 'today' })}>去今日训练 <ArrowRight size={14} /></button></article><article className="learning-ledger learning-ledger-competitive"><div className="learning-ledger-icon"><Gauge size={18} /></div><h3>竞技账</h3><p>{snapshot.capabilities?.rankedOnlyCompetitiveLedger ? '仅有效压力 / 排位结算影响 Rating 与 ELO，日常训练不会混入。' : '当前只读展示历史竞技账；旧版非压力结算尚未迁移，不能宣称已经完全分账。'}</p><strong>{snapshot.competitive?.rating ?? '—'} Rating · {snapshot.competitive?.elo ?? '—'} ELO</strong><small>{snapshot.competitive?.rank ?? '暂无段位'} · 历史结算 {snapshot.competitive?.settlementCount ?? 0} 次</small><button type="button" className="learning-link-button" onClick={() => onNavigate({ type: 'insights' })}>去现有数据页 <ArrowRight size={14} /></button></article><article className="learning-ledger learning-ledger-incentive"><div className="learning-ledger-icon"><Trophy size={18} /></div><h3>激励账</h3><p>XP、连续天数和成就只负责反馈，不代表考试战力。</p><strong>{incentiveAvailable ? `${incentive?.xp} XP · ${incentive?.streakDays ?? '—'} 天连续` : '激励账不可用 · XP 暂无'}</strong><small>本周目标 {incentiveAvailable ? `${incentive?.weeklyGoalCompleted ?? '—'}/${incentive?.weeklyGoalTotal ?? '—'}` : '暂不可读'}</small><button type="button" className="learning-link-button" onClick={() => onNotify('激励账首版只提供摘要，暂不开放独立写入入口')}>查看说明 <ArrowRight size={14} /></button></article></div><div className="learning-ledger-warning"><ShieldCheck size={15} /> 强制说明：学习中心的投影不会修改 attempts、progress、elo_events、好友快照或任何正式训练队列。</div></section>
      <section className="learning-card learning-bottom-grid"><div><div className="learning-section-heading"><div><span className="learning-eyebrow">证据与完整性</span><h2>最近证据</h2></div><span className="learning-muted">{recentEvidence.length} 条引用</span></div>{!flags.learningEvidenceProjectionV1 ? <EmptySection title="证据投影未开启" detail="原始数据不会在前端臆测成学习结论。" /> : recentEvidence.length === 0 ? <EmptySection title="暂无最近证据" detail="完成并确认有效作答后，后端才会提供证据引用。" /> : <div className="learning-recent-evidence">{recentEvidence.slice(0, 4).map((item) => <div className="learning-recent-evidence-row" key={item.id}><span className="learning-evidence-dot" /><div><strong>{item.source} · 题目 {item.questionId ?? '—'}</strong><small>{formatDateTime(item.observedAt)} · {formatConfidence(item.confidence)}</small></div><span>{item.accepted ? '已采纳' : '待确认'}</span></div>)}</div>}</div><div><div className="learning-section-heading"><div><span className="learning-eyebrow">好友广播</span><h2>好友动态</h2></div><Users size={18} aria-hidden="true" /></div>{!flags.friendBroadcastsV1 || !snapshot.capabilities?.canReadFriendEvents ? <EmptySection title="好友动态首版暂不可用" detail="保留入口，但不展示未授权或未同步的好友数据。" /> : snapshot.friendEvents.length === 0 ? <EmptySection title="暂无可公开动态" detail="低置信度诊断、普通单题和未确认回传不会播报。" /> : <div className="learning-friend-list">{snapshot.friendEvents.slice(0, 4).map((event) => <button type="button" className="learning-friend-event" key={event.id} onClick={() => openFriend(event)}><div><strong>{event.title}</strong><small>{event.friendName} · {formatDateTime(event.occurredAt)}</small></div><span>{event.ratingDelta === null ? '学习动态' : (event.ratingDelta > 0 ? '+' : '') + event.ratingDelta.toFixed(2) + ' Rating'}</span></button>)}</div>}<button type="button" className="learning-secondary-button learning-friends-link" onClick={() => onNavigate({ type: 'friends' })}>打开好友页 <ArrowRight size={14} /></button></div></section>
    </>}
    {selectedMetric ? <EvidenceDrawer metric={selectedMetric} evidence={recentEvidence} onClose={() => setSelectedMetric(null)} /> : null}
    {aiTask && (
      <div className="learning-drawer-backdrop" role="presentation" onClick={() => setAiTask(null)}><aside className="learning-ai-drawer" role="dialog" aria-modal="true" aria-labelledby="learning-ai-title" onClick={(event) => event.stopPropagation()}>
        <div className="learning-drawer-head"><div><span className="learning-eyebrow">AI 训练会话</span><h2 id="learning-ai-title">让 AI 按你的状态设计题组</h2></div><button type="button" className="learning-icon-button" onClick={() => setAiTask(null)} aria-label="关闭 AI 训练会话"><X size={18} /></button></div>
        {!aiTask.taskId ? <><p className="learning-drawer-note">App 会自动带上当前分类、历史作答、上一组结果和候选题。AI 只从候选题中选择，并返回已适应考法、待覆盖考法和题组顺序。</p><div className="learning-ai-templates" aria-label="训练模板">{aiTemplates.map((template) => <button key={template} type="button" className="learning-ai-template" onClick={() => setAiRequest(template)}>{template.split('：')[0]}</button>)}</div><label className="learning-ai-label">这次想怎么练？<textarea className="learning-ai-input" rows={5} value={aiRequest} onChange={(event) => setAiRequest(event.target.value)} placeholder="例如：极限标准题已经熟了，今天想覆盖更多考法，重点练方法选择，不要太基础。" /></label><label className="learning-ai-label">可用时间<select className="learning-ai-select" value={aiMinutes} onChange={(event) => setAiMinutes(Number(event.target.value))}>{[15, 30, 40, 60, 90].map((value) => <option key={value} value={value}>{value} 分钟</option>)}</select></label><button type="button" className="learning-primary-button" onClick={() => void handleCreateAiTask()} disabled={aiBusy}><Sparkles size={15} /> {aiBusy ? '生成中…' : '生成 AI 训练任务'}</button></> : <><div className="learning-ai-task-meta"><strong>{aiTask.taskId}</strong><span>候选题和上一组结果已写入上下文，等待 Codex 规划题组</span></div><p className="learning-drawer-note">复制下面的任务说明发送给 Codex。Codex 完成后将推荐 JSON 写入回传文件，回到这里点击刷新即可看到题组。</p><button type="button" className="learning-primary-button" onClick={() => void copyAiPrompt()}><ClipboardCopy size={15} /> 复制 AI 任务说明</button><div className="learning-ai-file"><small>回传文件</small><code>{aiTask.outputFile}</code></div><pre className="learning-ai-prompt">{aiTask.prompt}</pre></>}
      </aside></div>
    )}
  </div>
}

export type { LearningCenterViewProps }
