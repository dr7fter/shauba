import { useMemo } from 'react'
import { MathText } from '../MathText'
import { ReportSection } from './ReportSection'
import { SessionDigestView } from './SessionDigest'
import { Icon } from '../ui/Icon'
import { QuestionImages } from '../QuestionImages'
import { formatElapsed, type GradeOutcome } from '../../utils'
import {
  deriveConsolidation,
  deriveFixState,
  dimensionSpotlight,
  ERROR_CLASS_CHIP_META,
  NEXT_ACTION_LABELS,
  type BreakpointGroup,
  type GradeFlow,
  type ReportDimKey,
  type SessionDigest,
} from '../../domain/reportViewModel'
import type {
  AttemptHistoryEntry,
  ErrorCodeEncounter,
  Question,
  QuestionGrade,
  QuestionLearningMeta,
} from '../../types'

const OUTCOME_LABEL: Record<GradeOutcome, string> = {
  correct: '正确',
  partial: '部分正确',
  wrong: '错误',
  uncertain: '待确认',
}

/** 结果胶囊：直接挂 ui.css 的 .reason-chip 语义变体，不另造一套颜色 */
const OUTCOME_CHIP: Record<GradeOutcome, string> = {
  correct: 'reason-chip fit',
  partial: 'reason-chip retest',
  wrong: 'reason-chip yesterday_wrong',
  uncertain: 'reason-chip explore',
}

/** 严重度按 L1→L3 递减用危险/警告/中性，和档案页的断点卡片同一套编码 */
const SEVERITY_CHIP: Record<'L1' | 'L2' | 'L3', string> = {
  L1: 'reason-chip yesterday_wrong',
  L2: 'reason-chip retest',
  L3: 'reason-chip explore',
}

const SEVERITY_LABEL: Record<'L1' | 'L2' | 'L3', string> = {
  L1: 'L1 致命',
  L2: 'L2 战术',
  L3: 'L3 精度',
}

export type { FixState } from '../../domain/reportViewModel'

/** 复发信号：同编码再次命中。若本次用时明显短于首次，说明错路已被自动化。 */
function relapseSignal(
  group: BreakpointGroup | null,
  history: AttemptHistoryEntry[],
  durationSec: number,
): { attemptCount: number; faster: boolean; firstDurationSec: number | null } | null {
  if (!group || group.state !== 'relapse') return null
  const timed = [...history]
    .filter((row) => row.durationSeconds > 0)
    .sort((a, b) => a.attemptedAt.localeCompare(b.attemptedAt))
  const firstDurationSec = timed.length ? timed[0].durationSeconds : null
  const faster =
    firstDurationSec != null && durationSec > 0 && durationSec < firstDurationSec * 0.7
  return {
    attemptCount: Math.max(group.historyTotal, history.length, 1),
    faster,
    firstDurationSec,
  }
}

/** 复做日期标签：今天/明天/后天/M月D日；无效日期返回 null 不显示 */
function reviewDateLabel(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const days = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (days <= 0) return '复做 今天'
  if (days === 1) return '复做 明天'
  if (days === 2) return '复做 后天'
  return `复做 ${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

/** 复发时间线的日期标签；解析不出来就返回 null，由调用方跳过这一行 */
function encounterDateLabel(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

export function ReviewPane({
  question,
  grade,
  flow,
  outcome,
  durationSec,
  benchmarkSec,
  history,
  encounters,
  dimBaseline,
  group,
  meta,
  digest,
  note,
  sections,
  onToggleSection,
  revealed,
  onReveal,
  onNoteChange,
  onNoteBlur,
  onAddToPlan,
  planAdded,
}: {
  question: Question | undefined
  grade: QuestionGrade
  flow: GradeFlow
  outcome: GradeOutcome
  durationSec: number
  benchmarkSec: number
  history: AttemptHistoryEntry[]
  encounters: ErrorCodeEncounter[]
  dimBaseline: Record<ReportDimKey, number | null>
  group: BreakpointGroup | null
  meta: QuestionLearningMeta | null
  digest?: SessionDigest | null
  note: string
  sections: Record<string, boolean>
  onToggleSection: (key: string) => void
  revealed: boolean
  onReveal: () => void
  onNoteChange: (value: string) => void
  onNoteBlur: () => void
  onAddToPlan: () => void
  planAdded: boolean
}) {
  const fixState = useMemo(() => deriveFixState(group), [group])
  const relapse = useMemo(
    () => relapseSignal(group, history, durationSec),
    [group, history, durationSec],
  )
  /* 固化态一律由 App 用真实作答序列算——批改侧只写事实，不自报状态 */
  const consolidation = useMemo(
    () => deriveConsolidation(outcome, history, flow),
    [outcome, history, flow],
  )
  const spotlight = useMemo(() => dimensionSpotlight(grade, dimBaseline), [grade, dimBaseline])
  const strategy = grade.dimensions?.strategyInsight
  const confidencePct =
    typeof grade.confidence === 'number' ? Math.round(grade.confidence * 100) : null
  const lowConfidence = confidencePct != null && confidencePct < 70

  /* 学习引擎元信息派生的三个 chip：病因类 / 复做排期 / 药方类型 */
  const errorClassChip = meta?.errorClass ? ERROR_CLASS_CHIP_META[meta.errorClass] : null
  const reviewLabel = reviewDateLabel(meta?.nextReviewAt ?? null)
  const actionLabel = meta?.nextAction ? NEXT_ACTION_LABELS[meta.nextAction] ?? null : null

  const categoryShort =
    question?.categoryPath?.split('/').pop()?.trim() || grade.errorTags?.[0] || '本题'

  /* 节奏胶囊沿用 ui.css 的 .pace-pill：≤60% 预算为快，超预算为超时 */
  const paceRatio = benchmarkSec > 0 ? durationSec / benchmarkSec : 0
  const paceClass =
    paceRatio > 1 ? 'overtime' : paceRatio > 0.85 ? 'slow' : paceRatio > 0.6 ? 'normal' : 'fast'

  const standardPath =
    question?.explanation || flow.fork?.standardPath || grade.betterSolution || null
  const shortcut = grade.betterSolution || grade.advice || null

  /* 有 fork 时也不能只看 fork.standardPath：它常常为空，而 question.explanation
     是有内容的（题库 6125 题 100% 有正解文本）。丢掉回退就会误显示「未提供标准路径」。 */
  const forkStd = flow.fork?.standardPath ?? standardPath

  /* 段的序号按实际渲染顺序递增；哪些段存在由数据决定，不存在的段不占位 */
  let seq = 0

  return (
    <div className="rp-view">
      <SessionDigestView digest={digest} />
      <div className="rp-head">
        <div className="rp-meta">
          <span className="question-id-badge">#{grade.questionId}</span>
          <span>{question?.categoryPath || '未分类'}</span>
          <span className={OUTCOME_CHIP[outcome]}>{OUTCOME_LABEL[outcome]}</span>
          {outcome === 'correct' && grade.methodSoundness === 'lucky' ? (
            <span className="reason-chip explore rp-icon-chip ic-gold" title="结果对，但方法不可复现（特殊值 / 代选项 / 跳步）">
              <Icon name="dice" />
              碰对
            </span>
          ) : null}
          {outcome === 'correct' && grade.methodSoundness === 'detour' ? (
            <span className="reason-chip explore rp-icon-chip ic-cyan" title="解法正确但绕路，有更省时的路径">
              <Icon name="route" />
              绕路
            </span>
          ) : null}
          {errorClassChip ? (
            <span className={`reason-chip explore rp-icon-chip ic-${errorClassChip.tone}`} title="学习引擎归一的病因分类">
              <Icon name={errorClassChip.icon} />
              {errorClassChip.label}
            </span>
          ) : null}
          {grade.secondaryTags?.map((tag) => (
            <span key={tag} className="reason-chip explore" title="次要病因（不参与归一）">
              {tag}
            </span>
          ))}
          {flow.errorCode ? (
            <span className="question-id-badge">{flow.errorCode}</span>
          ) : null}
          {flow.severity ? (
            <span className={SEVERITY_CHIP[flow.severity]}>{SEVERITY_LABEL[flow.severity]}</span>
          ) : null}
          {fixState ? (
            <span
              className={fixState.key === 'yellow' ? 'reason-chip retest' : 'reason-chip yesterday_wrong'}
            >
              {fixState.label}
            </span>
          ) : null}
          {outcome === 'correct' && group === null && history.length > 0 ? (
            <span className="reason-chip fit">历史 {history.length} 次作答</span>
          ) : null}
          <span className={`pace-pill ${paceClass}`}>
            {formatElapsed(durationSec * 1000)} / 预算 {formatElapsed(benchmarkSec * 1000)}
          </span>
          {outcome !== 'correct' && reviewLabel ? (
            <span className="reason-chip explore rp-icon-chip ic-green" title="学习引擎排定的复做日期">
              <Icon name="rotate-ccw" />
              {reviewLabel}
            </span>
          ) : null}
          {outcome !== 'correct' && actionLabel ? (
            <span className="reason-chip explore" title="学习引擎排定的下一步练习类型">
              {actionLabel}
            </span>
          ) : null}
        </div>
        <h1 className="rp-h1">{categoryShort}</h1>
        {question?.stem ? (
          <div className="rp-stem">
            <MathText value={question.stem} />
          </div>
        ) : null}
        {/* 含图题干此前在报告里读不通——图进了批改侧就没进 App，现在把原件摆回来 */}
        {question?.imagePaths?.length ? <QuestionImages paths={question.imagePaths} /> : null}
        {grade.userAnswer?.trim() || grade.correctAnswer?.trim() ? (
          <div className="rp-answer-row">
            <span className="rp-answer-cell">
              <span className="rp-answer-k">我答</span>
              <span className={grade.correct ? 'rp-answer-v rp-yes' : 'rp-answer-v rp-no'}>
                {grade.userAnswer?.trim() ? (
                  <MathText value={grade.userAnswer.trim()} />
                ) : (
                  <span className="rp-quiet">未记录</span>
                )}
              </span>
            </span>
            <span className="rp-answer-cell">
              <span className="rp-answer-k">标答</span>
              <span className="rp-answer-v">
                {grade.correctAnswer?.trim() ? (
                  <MathText value={grade.correctAnswer.trim()} />
                ) : (
                  <span className="rp-quiet">未记录</span>
                )}
              </span>
            </span>
          </div>
        ) : null}
      </div>

      {/* 复发 + 加速：最危险的信号，必须在读任何分析之前先看到 */}
      {relapse ? (
        <div className="rp-alert" role="alert">
          <span className="rp-alert-ic" aria-hidden="true">
            <Icon name="alert" size="sm" />
          </span>
          <div className="rp-alert-b">
            <b>
              {flow.errorCode ? `${flow.errorCode} 复发` : '同一断点复发'}
              {relapse.attemptCount > 1 ? ` · 第 ${relapse.attemptCount} 次` : ''}
            </b>
            {relapse.faster && relapse.firstDurationSec != null ? (
              <>
                {' · 用时 '}
                {formatElapsed(relapse.firstDurationSec * 1000)}
                {' → '}
                <b>{formatElapsed(durationSec * 1000)}</b>
              </>
            ) : null}
            <span className="rp-alert-why">
              {relapse.faster
                ? '不是想不起来，是已经把错路执行得更熟练——这伪装成「我会做」，是当前最危险的断点。'
                : '同一入口再次触发，说明识别规则还没能在动笔前形成拦截。'}
            </span>
          </div>
        </div>
      ) : null}

      {/* 复发最有杀伤力的呈现是两次并排：「上次规则是 X → 今天还是这个断点」 */}
      {encounters.length > 0 ? (
        <div className="rp-tl" aria-label="同一断点的历史命中">
          <div className="rp-tl-hd">
            <Icon name="rotate-ccw" size="sm" />
            同一断点的历史命中{flow.errorCode ? ` · ${flow.errorCode}` : ''}
          </div>
          {encounters.slice(0, 2).map((row) => {
            const date = encounterDateLabel(row.createdAt)
            return (
              <div className="rp-tl-row" key={row.taskId}>
                <span className="rp-tl-date">{date ?? '上次'}</span>
                <span className="rp-tl-verdict">
                  {row.verdict === 'correct'
                    ? '做对'
                    : row.verdict === 'partial'
                      ? '半对'
                      : row.verdict === 'uncertain'
                        ? '待确认'
                        : row.verdict
                          ? '做错'
                          : '—'}
                  {typeof row.stepScore === 'number'
                    ? ` · 步骤分 ${Math.round(row.stepScore)}`
                    : ''}
                </span>
                <span className="rp-tl-rule">
                  {row.ruleNegation ? (
                    <MathText value={row.ruleNegation} />
                  ) : row.acceptance ? (
                    <>验收：
                      <MathText value={row.acceptance} />
                    </>
                  ) : row.myEntry ? (
                    <MathText value={row.myEntry} />
                  ) : (
                    <span className="rp-quiet">那次没有留下规则文本</span>
                  )}
                </span>
              </div>
            )
          })}
          <div className="rp-tl-row rp-tl-now">
            <span className="rp-tl-date">本次</span>
            <span className="rp-tl-verdict">
              {OUTCOME_LABEL[outcome]}
              {typeof grade.stepScore === 'number' ? ` · 步骤分 ${Math.round(grade.stepScore)}` : ''}
            </span>
            <span className="rp-tl-rule">
              {flow.rule?.negation ? (
                <MathText value={flow.rule.negation} />
              ) : (
                <span className="rp-quiet">本次未给出否定式规则</span>
              )}
            </span>
          </div>
        </div>
      ) : null}

      <div className="rp-secs">
        {flow.myEntry ? (
          <ReportSection
            n={seq++}
            title="我的落笔入口"
            open={sections.entry !== false}
            onToggle={() => onToggleSection('entry')}
          >
            <MathText value={flow.myEntry} />
          </ReportSection>
        ) : null}

        {flow.killLine ? (
          <ReportSection
            n={seq++}
            title="断点在哪"
            tag="最早逻辑断层"
            variant="kill"
            open={sections.kill !== false}
            onToggle={() => onToggleSection('kill')}
          >
            <MathText value={flow.killLine} />
          </ReportSection>
        ) : null}

        {flow.whyDeadEnd ? (
          <ReportSection
            n={seq++}
            title="为什么这条路走不通"
            tag="讲原理，不讲步骤"
            open={sections.why === true}
            onToggle={() => onToggleSection('why')}
          >
            <MathText value={flow.whyDeadEnd} />
          </ReportSection>
        ) : null}

        {standardPath || flow.fork ? (
          <ReportSection
            n={seq++}
            title={outcome === 'correct' ? '正确解法' : '正确入口'}
            tag=""
            open={sections.sol !== false}
            onToggle={() => onToggleSection('sol')}
          >
            {revealed || outcome === 'correct' ? (
              <>
                {flow.fork ? (
                  <div className="rp-fork">
                    {/* 上：我的错路，收着写——它是要被否定的东西，不该占正解的位置 */}
                    <div className="rp-fork-mine">
                      <span className="rp-fork-sn">
                        我的考场演进 · 第 {flow.fork.step} 步 {flow.fork.label}
                      </span>
                      {flow.fork.myPath ? (
                        <MathText value={flow.fork.myPath} />
                      ) : (
                        <span className="rp-quiet">
                          考场演算在此受阻中断，未能完成最终化简（详见上方断点）。
                        </span>
                      )}
                    </div>

                    <div className="rp-fork-mid" aria-hidden="true">
                      <Icon name="arrow-down" size="sm" />
                    </div>

                    {/* 下：正解。复盘后要照着重写一遍的就是这段，给它最大的空间和字号 */}
                    <div className="rp-fork-std">
                      <span className="rp-fork-sn">正解</span>
                      {forkStd ? (
                        <MathText value={forkStd} />
                      ) : (
                        <span className="rp-quiet">本题未提供标准路径</span>
                      )}
                    </div>

                    {flow.fork.consequence ? (
                      <div className="rp-fork-cons">走错之后：{flow.fork.consequence}</div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rp-fork-std">
                    <span className="rp-fork-sn">正解</span>
                    <MathText value={standardPath ?? ''} />
                  </div>
                )}

                {shortcut && shortcut !== standardPath ? (
                  <div className="rp-fork-extra">
                    <span className="rp-fork-sn">选填速算</span>
                    <MathText value={shortcut} />
                  </div>
                ) : null}
              </>
            ) : (
              <div className="rp-reveal">
                <p>先自己推一遍这一步该做什么，推不出来再看。</p>
                <button type="button" className="secondary-button compact" onClick={onReveal}>
                  <Icon name="book" />
                  展开正确入口
                </button>
              </div>
            )}
          </ReportSection>
        ) : null}

        {flow.syllabusTools?.length ? (
          <ReportSection
            n={seq++}
            title="用到的数一工具"
            tag="全部在考纲内"
            open={sections.tools !== false}
            onToggle={() => onToggleSection('tools')}
          >
            <div className="rp-tools">
              {flow.syllabusTools.map((tool, idx) => (
                <div className="rp-tool-row" key={idx}>
                  <span className="rp-tool-idx">{idx + 1}</span>
                  <div className="rp-tool-v">
                    <MathText value={tool} />
                  </div>
                </div>
              ))}
            </div>
          </ReportSection>
        ) : null}

        {flow.rule?.negation || flow.rule?.positive ? (
          <ReportSection
            n={seq++}
            title="识别规则"
            tag="动笔前 30 秒口述 · 否定式在前"
            open={sections.rule !== false}
            onToggle={() => onToggleSection('rule')}
          >
            <div className="rp-rule">
              {flow.rule?.negation ? (
                <div className="rp-rule-row">
                  <span className="rp-rule-k rp-no">禁止</span>
                  <span className="rp-rule-v">
                    <MathText value={flow.rule.negation} />
                  </span>
                </div>
              ) : null}
              {flow.rule?.positive ? (
                <div className="rp-rule-row">
                  <span className="rp-rule-k rp-yes">该做</span>
                  <span className="rp-rule-v">
                    <MathText value={flow.rule.positive} />
                  </span>
                </div>
              ) : null}
            </div>
          </ReportSection>
        ) : null}
        {outcome === 'correct' && flow.whyItWorked ? (
          <ReportSection
            n={seq++}
            title="这次为什么做对"
            tag="画像封盘的证据"
            open={sections.worked === true}
            onToggle={() => onToggleSection('worked')}
          >
            <div className="rp-ev">
              <div className="rp-ev-row">
                <MathText value={flow.whyItWorked} />
              </div>
              {consolidation ? (
                <div className="rp-ev-note">
                  <span
                    className={
                      consolidation.key === 'green'
                        ? 'reason-chip fit'
                        : 'reason-chip retest'
                    }
                  >
                    {consolidation.label}
                  </span>
                  <span className="rp-quiet">
                    固化态由 App 按真实作答序列判定，批改侧不自报
                  </span>
                </div>
              ) : (
                <div className="rp-ev-note">
                  <span className="rp-quiet">首次做对，按画像契约不计入固化证据</span>
                </div>
              )}
            </div>
          </ReportSection>
        ) : null}

        {spotlight || typeof grade.stepScore === 'number' || confidencePct != null ? (
          <ReportSection
            n={seq++}
            title="这次评分的证据"
            tag="可核对"
            open={sections.evidence === true}
            onToggle={() => onToggleSection('evidence')}
          >
            <div className="rp-ev">
              <div className="rp-ev-row rp-ev-meta">
                {typeof grade.selfRating === 'number' ? (
                  <span className="rp-ev-k">
                    自评 <b>{grade.selfRating}/4</b>
                  </span>
                ) : null}
                <span className="rp-ev-k">
                  实判 <b>{OUTCOME_LABEL[outcome]}</b>
                </span>
                {typeof grade.stepScore === 'number' ? (
                  <span className="rp-ev-k">
                    有效步骤分 <b>{Math.round(grade.stepScore)}</b>/100
                  </span>
                ) : null}
                {confidencePct != null ? (
                  <span className={`rp-ev-k${lowConfidence ? ' rp-no' : ''}`}>
                    AI 置信 <b>{confidencePct}%</b>
                    {lowConfidence ? ' · 这条判定本身不确定' : ''}
                  </span>
                ) : null}
              </div>
              {spotlight ? (
                <>
                  {[spotlight.high, spotlight.low].map((row) => (
                    <div className="rp-ev-row" key={row.key}>
                      <span className="rp-ev-dim">
                        {row.label} <b>{Math.round(row.value)}</b>
                        {row.delta != null ? (
                          <span className="rp-quiet">
                            {' '}
                            {row.delta >= 0 ? '+' : ''}
                            {row.delta} vs 本组
                          </span>
                        ) : null}
                        {row.confidence != null ? (
                          <span className="rp-quiet"> · 置信 {Math.round(row.confidence * 100)}%</span>
                        ) : null}
                      </span>
                      {row.evidence ? (
                        <span className="rp-ev-quote">
                          <MathText value={row.evidence} />
                        </span>
                      ) : (
                        <span className="rp-quiet">这一维没有留下证据句</span>
                      )}
                    </div>
                  ))}
                  {spotlight.insight ? (
                    <div className="rp-ev-note">{spotlight.insight}</div>
                  ) : null}
                </>
              ) : null}
              {typeof strategy?.techniqueLevel === 'number' || strategy?.independentDiscovery ? (
                <div className="rp-ev-row rp-ev-meta">
                  {typeof strategy?.techniqueLevel === 'number' ? (
                    <span className="reason-chip explore" title="本题技巧等级 1–5">
                      技巧 L{strategy.techniqueLevel}
                    </span>
                  ) : null}
                  {strategy?.independentDiscovery === 'confirmed' ? (
                    <span className="reason-chip fit" title="草稿显示独立做出">
                      独立做出
                    </span>
                  ) : strategy?.independentDiscovery === 'prompted' ? (
                    <span className="reason-chip retest" title="提示后才做对——练习价值低于独立做出">
                      提示后才做对
                    </span>
                  ) : strategy?.independentDiscovery === 'uncertain' ? (
                    <span className="reason-chip explore" title="草稿无法判定是否独立做出">
                      独立性未知
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </ReportSection>
        ) : null}
      </div>

      {flow.nextAction ? (
        <>
          <div className="rp-note-hd">
            <h3>明日动作</h3>
            <span>
              {planAdded ? '已加入明日计划' : '验收判据见下'}
            </span>
          </div>
          <label className="rp-todo">
            <input
              type="checkbox"
              checked={planAdded}
              onChange={() => {
                if (!planAdded) onAddToPlan()
              }}
            />
            <span className="rp-todo-t">
              <MathText value={flow.nextAction} />
              <span className="rp-todo-a">
                验收：{flow.acceptance ?? '合上报告独立重做本题，不翻解法、不用提示，且结果正确。'}
              </span>
            </span>
          </label>
        </>
      ) : null}

      <div className="rp-note-hd">
        <h3>亲笔自省</h3>
        <span>离焦自动保存 · 按题号归档</span>
      </div>
      <textarea
        className="rp-ta"
        value={note}
        placeholder="写下考场上的真实反应：识别到了什么 → 卡在哪 → 下次怎么拦。明日复习前先读这条。"
        onChange={(event) => onNoteChange(event.target.value)}
        onBlur={onNoteBlur}
      />
    </div>
  )
}
