import { useMemo } from 'react'
import { MathText } from '../MathText'
import { ReportSection } from './ReportSection'
import { SessionDigestView } from './SessionDigest'
import { Icon } from '../ui/Icon'
import { formatElapsed, type GradeOutcome } from '../../utils'
import {
  ERROR_CLASS_CHIP_META,
  NEXT_ACTION_LABELS,
  type BreakpointGroup,
  type GradeFlow,
  type SessionDigest,
} from '../../domain/reportViewModel'
import type { AttemptHistoryEntry, Question, QuestionGrade, QuestionLearningMeta } from '../../types'

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

export type FixState = { key: 'red' | 'yellow'; label: string }

/**
 * 断点固化状态——只从已有作答证据推，推不出来就返回 null 不显示。
 *
 * 这里刻意不提供「已固化」：那需要画像里跨场次的历史，本地拿不到。
 * 凭一次正确就打上「已固化」等于凭几道题声称全章掌握，是红线里明令禁止的。
 */
export function deriveFixState(group: BreakpointGroup | null): FixState | null {
  if (!group) return null
  if (group.state === 'relapse') return { key: 'red', label: '待验证' }
  if (group.historyTotal >= 2) return { key: 'yellow', label: '观察中' }
  return { key: 'red', label: '首次暴露' }
}

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

export function ReviewPane({
  question,
  grade,
  flow,
  outcome,
  durationSec,
  benchmarkSec,
  history,
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
  group: BreakpointGroup | null
  meta: QuestionLearningMeta | null
  digest: SessionDigest
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
            {revealed ? (
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
                  展开{outcome === 'correct' ? '解法' : '正确入口'}
                </button>
              </div>
            )}
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
