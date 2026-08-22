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
import { MathText } from '../components/MathText'
import type { FailedInboxItem, InboxItem } from '../types'

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
      await confirmInbox(item.id, apply)
      notify(
        apply
          ? item.kind === 'paper'
            ? '整卷结果已写入训练记录'
            : item.kind === 'batch'
            ? '整组批改结果已写入训练记录，正在加载学习报告'
            : '诊断已进入推荐画像，并会影响后续荐题'
          : '已忽略本次诊断'
      )
      if (refresh) void refresh()
      if (apply && item.kind === 'batch') await onOpenPressureReport(item.taskId)
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
    <div className="inbox-view">
      <div className="inbox-toolbar">
        <div>
          <h2>Codex 回传</h2>
          <p>
            AI 推荐先在这里确认；开始后会作为一组题进入今日训练。收件箱每 20 秒自动扫描一次，无需手动刷新。
          </p>
        </div>
        <button className="secondary-button" onClick={load}>
          <RefreshCw size={16} /> 扫描收件箱
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
          <LoaderCircle className="spin" size={20} /> 正在扫描本地收件箱
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="收件箱是空的"
          text="从练习页生成批改任务，再把草稿发给 Codex。"
        />
      ) : (
        <div className="inbox-list">
          {items.map((item) => {
            const isRecommendation = item.kind === 'recommendation'
            const recommendationStatus = recommendationStatusLabel(item)
            const canStart = isRecommendation && item.recommendationBatchStatus === 'pending'
            return (
              <article className={`inbox-entry ${item.status}`} key={item.id}>
                <div className="entry-rail">
                  <BrainCircuit size={19} />
                  <span />
                </div>
                <div className="entry-main">
                  <div className="entry-meta">
                    <span>{item.taskId}</span>
                    <span>
                      {isRecommendation
                        ? `AI 题组 · ${item.recommendationQuestionCount ?? 0} 道`
                        : item.kind === 'paper'
                        ? '整卷回传'
                        : item.kind === 'batch'
                        ? `整组批改 · ${item.batchAttempts?.length ?? 0} 道`
                        : `置信度 ${Math.round(item.confidence * 100)}%`}
                    </span>
                    <time>{new Date(item.createdAt).toLocaleString('zh-CN')}</time>
                  </div>
                  <h3>
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
                      <Sparkles size={17} />
                      <div>
                        <strong>{recommendationStatus}</strong>
                        <span>{item.recommendationQuestionCount ?? 0} 道题将按 Codex 给出的顺序训练</span>
                      </div>
                    </div>
                  )}
                  {item.kind === 'paper' && (
                    <div className="paper-import-summary">
                      <strong>{item.paperAttempts?.length ?? 0} 道题识别完成</strong>
                      <span>确认后会按每道题写入正确性、自评和复习日期</span>
                    </div>
                  )}
                  {item.kind === 'batch' && (
                    <div className="paper-import-summary">
                      <strong>{item.batchAttempts?.length ?? 0} 道题批改完成</strong>
                      <span>
                        只包含上传了草稿的题；确认后按每道题写入正确性、自评和薄弱诊断
                      </span>
                      <ul className="batch-result-list">
                        {(item.batchAttempts ?? []).map((attempt) => (
                          <li key={attempt.questionId}>
                            <b>#{attempt.questionId}</b>
                            <i className={`batch-verdict ${attempt.result}`}>
                              {attempt.result === 'correct'
                                ? '正确'
                                : attempt.result === 'wrong'
                                ? '出错'
                                : '不确定'}
                            </i>
                            <span>
                              <MathText value={attempt.summary} />
                            </span>
                            <button
                              className="variant-practice-btn"
                              onClick={() => onStartVariant(attempt.questionId)}
                              title="调出此题同考点的 3 道变式题"
                            >
                              <Sparkles size={11} /> 练变式题
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {item.earliestError && (
                    <div className="earliest-error">
                      <span>最早断点</span>
                      <p>
                        <MathText value={item.earliestError} />
                      </p>
                    </div>
                  )}
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
                  {item.betterSolution && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 10,
                        borderRadius: 8,
                        background: '#F2F7FC',
                      }}
                    >
                      <strong
                        style={{
                          display: 'block',
                          marginBottom: 4,
                          color: '#315E9E',
                          fontSize: 12,
                        }}
                      >
                        更好的解法
                      </strong>
                      <MathText value={item.betterSolution} />
                    </div>
                  )}
                  {item.advice && (
                    <p className="advice">
                      下一步：<MathText value={item.advice} />
                    </p>
                  )}
                  {isRecommendation && canStart ? (
                    <div className="entry-actions">
                      <button onClick={() => start(item)}>
                        <Play size={16} /> 开始这组题
                      </button>
                      <button onClick={() => dismiss(item)}>
                        <ThumbsDown size={16} /> 暂不采用
                      </button>
                    </div>
                  ) : !isRecommendation && item.status === 'pending' ? (
                    <div className="entry-actions">
                      <button onClick={() => decide(item, true)}>
                        <ThumbsUp size={16} />{' '}
                        {item.kind === 'paper'
                          ? '确认并写入整卷'
                          : item.kind === 'batch'
                          ? '确认并写入整组'
                          : '诊断准确，写入画像'}
                      </button>
                      <button onClick={() => decide(item, false)}>
                        <ThumbsDown size={16} /> 不采用
                      </button>
                      <button onClick={() => copyTaskPrompt(item)}>
                        {copiedTask === item.taskId ? (
                          <>
                            <Check size={15} /> 已复制
                          </>
                        ) : (
                          <>
                            <Send size={15} /> 重新复制任务说明
                          </>
                        )}
                      </button>
                    </div>
                  ) : item.status === 'confirmed' && item.kind === 'analysis' && item.questionId ? (
                    <div className="entry-actions">
                      <span className="resolved">
                        <Check size={15} /> 已写入画像
                      </span>
                      <button onClick={() => onStartVariant(item.questionId!)}>
                        <Sparkles size={16} /> 现在修复
                      </button>
                    </div>
                  ) : item.status === 'confirmed' && item.kind === 'batch' ? (
                    <div className="entry-actions">
                      <span className="resolved">
                        <Check size={15} /> 整组记录与报告已生成
                      </span>
                      <button onClick={() => void onOpenPressureReport(item.taskId)}>
                        <BarChart3 size={16} /> 查看学习报告
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
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
