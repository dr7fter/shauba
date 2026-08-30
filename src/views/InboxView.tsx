import {
  BarChart3,
  BrainCircuit,
  Check,
  Inbox,
  LoaderCircle,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  confirmInbox,
  dismissRecommendationBatch,
  getFailedInbox,
  getInbox,
  getTaskPrompt,
} from '../api'
import { EmptyState } from '../components/EmptyState'
import { HighlightMoment } from '../components/HighlightMoment'
import { RevealCards } from '../components/RevealCards'
import { MathText } from '../components/MathText'
import { playHighlightSound } from '../data/audio'
import type { AttemptHighlight, FailedInboxItem, InboxItem } from '../types'

export function recommendationStatusLabel(item: InboxItem) {
  if (item.recommendationBatchStatus === 'pending') return '待开始'
  if (item.recommendationBatchStatus === 'active') return '训练中'
  if (item.recommendationBatchStatus === 'paused') return '已暂停'
  if (item.recommendationBatchStatus === 'completed') return '已完成'
  if (item.recommendationBatchStatus === 'dismissed') return '未采用'
  return item.status === 'dismissed' ? '未采用' : item.status === 'confirmed' ? '已开始' : '待开始'
}

export function InboxView({
  notify,
  refresh,
  onStartRecommendation,
  onStartVariant,
  onOpenPressureReport,
}: {
  notify: (s: string) => void
  refresh?: () => void
  onStartRecommendation: (taskId: string) => Promise<void>
  onStartVariant: (questionId: number) => void
  onOpenPressureReport: (taskId: string) => Promise<boolean>
}) {
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [failedItems, setFailedItems] = useState<FailedInboxItem[]>([])
  const [copiedTask, setCopiedTask] = useState<string | null>(null)
  const [pendingFlow, setPendingFlow] = useState<{
    highlight: AttemptHighlight
    taskId: string
    openReport: boolean
    stage: 'reveal' | 'moment'
  } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    void Promise.all([getInbox(), getFailedInbox()])
      .then(([inbox, failed]) => {
        setItems(inbox)
        setFailedItems(failed)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const copyTaskPrompt = async (item: InboxItem) => {
    const prompt = await getTaskPrompt(item.taskId)
    if (!prompt) {
      notify('没有找到这份回传对应的任务说明，请回到练习页重新生成')
      return
    }
    await navigator.clipboard.writeText(prompt)
    setCopiedTask(item.taskId)
    notify('任务说明已复制，可以发送给 Codex')
    setTimeout(() => setCopiedTask(null), 2000)
  }

  const decide = async (item: InboxItem, apply: boolean) => {
    try {
      const result = await confirmInbox(item.id, apply)
      if (apply && result.highlight) {
        // 揭晓卡 → 全屏高光 → 报告：亲手翻开今天的名场面
        setPendingFlow({
          highlight: result.highlight,
          taskId: item.taskId,
          openReport: item.kind === 'batch',
          stage: 'reveal',
        })
        playHighlightSound(result.highlight.kind)
        notify(`已入账 ${result.appliedAttempts} 题 · 做对 ${result.appliedCorrect} · 揭晓名场面`)
      } else {
        notify(
          apply
            ? item.kind === 'paper'
            ? '整卷结果已写入训练记录'
            : item.kind === 'batch'
            ? '整组批改结果已写入训练记录，正在加载学习报告'
            : '诊断已进入推荐画像，并会影响后续荐题'
          : '已忽略本次诊断'
        )
      }
      if (refresh) void refresh()
      if (apply && item.kind === 'batch' && !result.highlight) await onOpenPressureReport(item.taskId)
    } catch (error) {
      notify(`处理回传失败：${String(error)}`)
    } finally {
      load()
      if (refresh) void refresh()
    }
  }

  const start = async (item: InboxItem) => {
    try {
      await onStartRecommendation(item.taskId)
      if (refresh) void refresh()
    } catch {
      /* The parent already presents the error. */
    }
  }

  const dismiss = async (item: InboxItem) => {
    try {
      await dismissRecommendationBatch(item.taskId)
      notify('这组 AI 推荐题已暂不采用')
      load()
      if (refresh) void refresh()
    } catch (error) {
      notify(`无法取消 AI 题组：${String(error)}`)
    }
  }

  return (
    <div className="inbox-view tactical-inbox-container">
      <div className="inbox-toolbar tactical-inbox-toolbar">
        <div>
          <span className="tactical-kicker-tag">
            <Sparkles size={14} /> TACTICAL INTELLIGENCE · CODEX DIAGNOSIS
          </span>
          <h2>Codex 战术回传与诊断中心</h2>
          <p>
            AI 步骤断点定位 · 考场秒杀更优解 · 专项变式题推荐 · 本地收件箱实时监测
          </p>
        </div>
        <button className="secondary-button compact" onClick={load}>
          <RefreshCw size={15} /> 扫描收件箱
        </button>
      </div>

      {failedItems.length > 0 && (
        <div className="failed-inbox-banner">
          <X size={15} />
          <div>
            <b>{failedItems.length} 份回传解析失败</b>
            <p>
              文件已被移到收件箱的 failed/ 目录，不会丢失。常见原因是 JSON 结构不符，请检查后手动重发。
            </p>
          </div>
          <details>
            <summary>查看失败原因</summary>
            <ul>
              {failedItems.map((item) => (
                <li key={item.fileName}>
                  <code>{item.fileName}</code>
                  <span>{item.error}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {loading ? (
        <div className="inbox-loading">
          <LoaderCircle className="spin" size={22} /> 正在扫描本地 Codex 回传情报...
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="暂无待处理诊断回传"
          text="在模考或练习中上传草稿，Codex 将为你提供深度步骤断点与秒杀解法。"
        />
      ) : (
        <div className="inbox-list tactical-inbox-list">
          {items.map((item) => {
            const isRecommendation = item.kind === 'recommendation'
            const isBatch = item.kind === 'batch'
            const isPaper = item.kind === 'paper'
            const recommendationStatus = recommendationStatusLabel(item)
            const canStart = isRecommendation && item.recommendationBatchStatus === 'pending'
            return (
              <article className={`inbox-entry tactical-inbox-entry ${item.status}`} key={item.id}>
                <div className="tactical-entry-header">
                  <div className="tactical-entry-type-pill">
                    <BrainCircuit size={15} />
                    <span>
                      {isRecommendation
                        ? `AI 推荐题组 · ${item.recommendationQuestionCount ?? 0} 道`
                        : isPaper
                        ? '整卷识别回传'
                        : isBatch
                        ? `模考整组批改 · ${item.batchAttempts?.length ?? 0} 道`
                        : '单题深度步骤诊断'}
                    </span>
                  </div>
                  <span className="tactical-entry-taskid">{item.taskId}</span>
                  <span className="tactical-entry-confidence">
                    置信度 {Math.round(item.confidence * 100)}%
                  </span>
                  <time className="tactical-entry-time">
                    {new Date(item.createdAt).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>

                <div className="tactical-entry-body">
                  <h3 className="tactical-entry-title">
                    {item.paperTitle ? (
                      <>
                        <MathText value={item.paperTitle} /> · <MathText value={item.summary} />
                      </>
                    ) : (
                      <MathText value={item.summary} />
                    )}
                  </h3>

                  {isRecommendation && (
                    <div className="ai-plan-card">
                      <Sparkles size={18} />
                      <div>
                        <strong>{recommendationStatus}{item.goal ? ` · ${item.goal}` : ''}</strong>
                        <span>{item.recommendationQuestionCount ?? 0} 道题将按 Codex 给出的战术顺序训练{item.estimatedMinutes ? ` · 预计 ${item.estimatedMinutes} 分钟` : ''}</span>
                        {item.noveltyPlan && item.noveltyPlan.length > 0 && <span>本组变化：{item.noveltyPlan.join('、')}</span>}
                        {item.coverage && item.coverage.length > 0 && <span>覆盖：{item.coverage.slice(0, 4).map((entry) => entry.knowledge).filter(Boolean).join(' · ')}</span>}
                        {item.successCriteria && item.successCriteria.length > 0 && <span>完成标准：{item.successCriteria.slice(0, 2).join('；')}</span>}
                      </div>
                    </div>
                  )}

                  {isPaper && (
                    <div className="paper-import-summary">
                      <strong>{item.paperAttempts?.length ?? 0} 道题识别完成</strong>
                      <span>确认后会按每道题写入正确性、自评和复习日期</span>
                    </div>
                  )}

                  {isBatch && (
                    <div className="batch-import-summary">
                      <div className="batch-summary-meta">
                        <strong>{item.batchAttempts?.length ?? 0} 道题批改完成</strong>
                        <span>只包含上传了草稿的题；确认后按每道题写入正确性、自评与薄弱诊断</span>
                      </div>
                      <ul className="tactical-batch-list">
                        {(item.batchAttempts ?? []).map((attempt) => (
                          <li key={attempt.questionId} className="tactical-batch-item">
                            <b className="batch-q-id">#{attempt.questionId}</b>
                            <span className={`verdict-pill ${attempt.result}`}>
                              {attempt.result === 'correct'
                                ? '正确'
                                : attempt.result === 'wrong'
                                ? '错误'
                                : '不确定'}
                            </span>
                            <span className="batch-q-summary">
                              <MathText value={attempt.summary} />
                            </span>
                            <button
                              className="tactical-variant-btn"
                              onClick={() => onStartVariant(attempt.questionId)}
                              title="调出此题同考点的 3 道变式题"
                            >
                              <Sparkles size={12} /> 练变式题
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {item.earliestError && (
                    <div className="earliest-error">
                      <strong className="earliest-error-title">⚠️ 最早错误断点定位 (BREAKPOINT)</strong>
                      <p>
                        <MathText value={item.earliestError} />
                      </p>
                    </div>
                  )}

                  {item.betterSolution && (
                    <div className="better-solution-box">
                      <strong>⚡ 考场更优秒杀解法 (SPEED-KILL SOLUTION)</strong>
                      <MathText value={item.betterSolution} />
                    </div>
                  )}

                  {item.advice && (
                    <div className="advice-box">
                      <strong className="advice-box-title">🎯 专项修复执行动作 (ACTION)</strong>
                      <p>
                        <MathText value={item.advice} />
                      </p>
                    </div>
                  )}

                  {(item.errorTags.length > 0 || item.weaknessTags.length > 0) && (
                    <div className="tag-line">
                      {item.errorTags.map((t) => (
                        <span className="error-tag" key={t}>
                          {t}
                        </span>
                      ))}
                      {item.weaknessTags.map((t) => (
                        <span className="weakness-tag" key={t}>
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="tactical-entry-footer">
                    {isRecommendation && canStart ? (
                      <div className="entry-actions">
                        <button className="primary-button" onClick={() => start(item)}>
                          <Play size={15} /> 开始这组题
                        </button>
                        <button className="secondary-button" onClick={() => dismiss(item)}>
                          <ThumbsDown size={15} /> 暂不采用
                        </button>
                      </div>
                    ) : !isRecommendation && item.status === 'pending' ? (
                      <div className="entry-actions">
                        <button className="primary-button" onClick={() => decide(item, true)}>
                          <ThumbsUp size={15} />{' '}
                          {item.kind === 'paper'
                            ? '确认并写入整卷'
                            : item.kind === 'batch'
                            ? '确认并写入整组'
                            : '诊断准确，写入画像'}
                        </button>
                        <button className="secondary-button" onClick={() => decide(item, false)}>
                          <ThumbsDown size={15} /> 不采用
                        </button>
                        <button className="secondary-button" onClick={() => copyTaskPrompt(item)}>
                          {copiedTask === item.taskId ? (
                            <>
                              <Check size={14} /> 已复制说明
                            </>
                          ) : (
                            <>
                              <Send size={14} /> 复制任务说明
                            </>
                          )}
                        </button>
                      </div>
                    ) : item.status === 'confirmed' && item.kind === 'analysis' && item.questionId ? (
                      <div className="entry-actions">
                        <span className="resolved">
                          <Check size={15} /> 已写入画像
                        </span>
                        <button className="secondary-button" onClick={() => onStartVariant(item.questionId!)}>
                          <Sparkles size={15} /> 现在修复变式
                        </button>
                      </div>
                    ) : item.status === 'confirmed' && item.kind === 'batch' ? (
                      <div className="entry-actions">
                        <span className="resolved">
                          <Check size={15} /> 整组记录与报告已生成
                        </span>
                        <button className="primary-button" onClick={() => void onOpenPressureReport(item.taskId)}>
                          <BarChart3 size={15} /> 查看学习报告
                        </button>
                      </div>
                    ) : (
                      <div className="resolved">
                        <Check size={15} />{' '}
                        {isRecommendation
                          ? recommendationStatus
                          : item.status === 'confirmed'
                          ? item.kind === 'paper'
                            ? '整卷已写入记录'
                            : '已写入画像'
                          : '已忽略'}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
      {pendingFlow?.stage === 'reveal' && (
        <RevealCards
          highlight={pendingFlow.highlight}
          onDone={() => setPendingFlow((prev) => (prev ? { ...prev, stage: 'moment' } : prev))}
        />
      )}
      {pendingFlow?.stage === 'moment' && (
        <HighlightMoment
          highlight={pendingFlow.highlight}
          onDone={() => {
            const flow = pendingFlow
            setPendingFlow(null)
            if (flow.openReport) void onOpenPressureReport(flow.taskId)
          }}
        />
      )}
    </div>
  )
}
