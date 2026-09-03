import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addDailyPlanItem, getQuestionAttemptHistory, saveNote } from '../../api'
import { benchmarkSeconds, formatElapsed, gradeOutcomeKey } from '../../utils'
import {
  buildBreakpointGroups,
  buildGradeFlow,
  buildReportViewModel,
  type BreakpointGroup,
} from '../../domain/reportViewModel'
import { QuestionRail, type RailRow } from './QuestionRail'
import { ReviewPane } from './ReviewPane'
import { SessionPane } from './SessionPane'
import { DossierPane } from './DossierPane'
import { Icon } from '../ui/Icon'
import type {
  AttemptHistoryEntry,
  GradingReport,
  GradingReportOrigin,
  PressureSession,
  Question,
} from '../../types'

type TabKey = 'review' | 'session' | 'dossier'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'review', label: '复盘' },
  { key: 'session', label: '本场' },
  { key: 'dossier', label: '档案' },
]

/** 折叠段的默认开合：断点与识别规则默认展开，原理段默认收起（需要时再看） */
const DEFAULT_SECTIONS: Record<string, boolean> = {
  entry: true,
  kill: true,
  why: false,
  sol: true,
  rule: true,
}

function tomorrowDateString(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ReportWindow({
  report,
  reportOrigin,
  session,
  questions,
  loading,
  onRefresh,
  onClose,
}: {
  report: GradingReport
  reportOrigin: GradingReportOrigin
  session: PressureSession | null
  questions: Record<number, Question>
  loading: boolean
  onRefresh: () => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<TabKey>('review')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [history, setHistory] = useState<AttemptHistoryEntry[]>([])
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [noteSaved, setNoteSaved] = useState<Record<number, boolean>>({})
  const [planAdded, setPlanAdded] = useState<Record<number, boolean>>({})
  const [sections, setSections] = useState<Record<string, boolean>>(DEFAULT_SECTIONS)
  const [revealed, setRevealed] = useState<Record<number, boolean>>({})
  const [copied, setCopied] = useState(false)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const vm = useMemo(
    () => buildReportViewModel(report, questions, session, reportOrigin),
    [report, questions, session, reportOrigin],
  )

  const groups: BreakpointGroup[] = useMemo(
    () => buildBreakpointGroups(vm.grades, history),
    [vm.grades, history],
  )

  const gradeQuestionIds = useMemo(() => vm.grades.map((g) => g.questionId), [vm.grades])

  /* 历史作答：复发判定与用时压缩都依赖它 */
  useEffect(() => {
    let alive = true
    if (gradeQuestionIds.length === 0) {
      setHistory([])
      return
    }
    void getQuestionAttemptHistory(gradeQuestionIds)
      .then((rows) => {
        if (alive) setHistory(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (alive) setHistory([])
      })
    return () => {
      alive = false
    }
  }, [gradeQuestionIds])

  /* 已有便笺回填，避免把学员写过的自省冲掉 */
  useEffect(() => {
    const initial: Record<number, string> = {}
    for (const [idStr, q] of Object.entries(questions)) {
      if (q?.note) initial[Number(idStr)] = q.note
    }
    setNotes((prev) => ({ ...initial, ...prev }))
  }, [questions])

  /* 默认落在最该看的那题上，只在新报告时打一次，之后尊重用户的选择 */
  const initializedKeyRef = useRef<string | null>(null)
  useEffect(() => {
    const key = `${report.confirmedAt ?? report.createdAt ?? report.sourceTaskId}_${vm.grades.length}`
    if (initializedKeyRef.current === key) return
    initializedKeyRef.current = key
    const firstAttention = vm.attentionEntries[0]?.index
    if (vm.grades.length > 0) setSelectedIndex(firstAttention ?? vm.worstGradeEntry?.index ?? 0)
  }, [report, vm.grades.length, vm.attentionEntries, vm.worstGradeEntry])

  const moveSelection = useCallback(
    (delta: number) => {
      if (vm.grades.length === 0) return
      setSelectedIndex((prev) => (prev + delta + vm.grades.length) % vm.grades.length)
    },
    [vm.grades.length],
  )

  const toggleSection = useCallback((key: string) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const activeGrade = vm.grades[selectedIndex]
  const activeQuestion = activeGrade ? questions[activeGrade.questionId] : undefined
  const activeFlow = useMemo(
    () => (activeGrade ? buildGradeFlow(activeGrade) : null),
    [activeGrade],
  )
  const activeGroup = useMemo(() => {
    if (!activeGrade) return null
    return groups.find((group) => group.indices.includes(selectedIndex)) ?? null
  }, [groups, activeGrade, selectedIndex])

  const activeHistory = useMemo(() => {
    if (!activeGrade) return []
    return history.filter((row) => row.questionId === activeGrade.questionId)
  }, [history, activeGrade])

  const activeDurationSec = useMemo(() => {
    if (!activeGrade) return 0
    if (typeof activeGrade.duration === 'number' && activeGrade.duration > 0) {
      return activeGrade.duration
    }
    const fromSession = session?.questions?.find((item) => item.questionId === activeGrade.questionId)
    return fromSession?.duration ?? 0
  }, [activeGrade, session])

  const handleSaveNote = useCallback(
    (questionId: number, value: string) => {
      void saveNote(questionId, value)
        .then(() => {
          setNoteSaved((prev) => ({ ...prev, [questionId]: true }))
          window.setTimeout(
            () => setNoteSaved((prev) => ({ ...prev, [questionId]: false })),
            1600,
          )
        })
        .catch(() => {})
    },
    [],
  )

  const handleAddToPlan = useCallback(() => {
    if (!activeGrade || !activeFlow?.nextAction) return
    const planDate = tomorrowDateString()
    const item = {
      id: `rp-${activeGrade.questionId}-${Date.now()}`,
      planDate,
      tier: 'base' as const,
      title: activeFlow.nextAction,
      targetType: 'manual' as const,
      categoryPath: activeQuestion?.categoryPath ?? null,
      questionIds: [activeGrade.questionId],
      completed: false,
      completedAt: null,
      sortOrder: 0,
    }
    void addDailyPlanItem(item)
      .then(() => setPlanAdded((prev) => ({ ...prev, [activeGrade.questionId]: true })))
      .catch(() => {})
  }, [activeGrade, activeFlow, activeQuestion])

  /* 追问上下文：题面与详解请求在前，我的断点过程隔在分割线后——
     让新 AI 先独立给出考纲内标准详解，不被先前批改思路带偏，再对照指出换路点 */
  const handleCopyContext = useCallback(() => {
    if (!activeGrade) return
    const lines = [
      `题号 #${activeGrade.questionId}`,
      activeQuestion?.categoryPath ? `分类：${activeQuestion.categoryPath}` : null,
      activeQuestion?.stem ? `题干：${activeQuestion.stem}` : null,
      ``,
      `请给我这道题在考研数学一考纲范围内的标准详解：`,
      `1. 步骤完整，可直接写在答卷上；关键步骤注明依据（定理 / 公式名）。`,
      `2. 只用考纲内方法：不用二级结论、秒杀技巧、特殊值凑答案。`,
      `3. 详解完全基于题目独立推导，不要受下方我的过程影响。`,
      ...(activeFlow
        ? [
            ``,
            `━━━ 详解写完再看这里：我当时的过程 ━━━`,
            activeFlow.myEntry ? `我的落笔入口：${activeFlow.myEntry}` : null,
            activeFlow.killLine ? `断点：${activeFlow.killLine}` : null,
            activeFlow.whyDeadEnd ? `为什么走不通：${activeFlow.whyDeadEnd}` : null,
            activeFlow.rule?.negation ? `我已知道的禁止项：${activeFlow.rule.negation}` : null,
            activeFlow.rule?.positive ? `我已知道的该做项：${activeFlow.rule.positive}` : null,
            `4. 对照你的详解，指出我从哪一步开始必须换路、当时该怎么识别；我的入口本身可行就沿它补完。`,
          ]
        : []),
    ].filter((line): line is string => line !== null)
    void navigator.clipboard
      ?.writeText(lines.join('\n'))
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => {})
  }, [activeGrade, activeQuestion, activeFlow])

  /* 键盘：报告是高频界面，手不离键盘 */
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key === 'j' || event.key === 'ArrowDown') {
        event.preventDefault()
        moveSelection(1)
      } else if (event.key === 'k' || event.key === 'ArrowUp') {
        event.preventDefault()
        moveSelection(-1)
      } else if (event.key === '1') {
        setTab('review')
      } else if (event.key === '2') {
        setTab('session')
      } else if (event.key === '3') {
        setTab('dossier')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [moveSelection])

  const railRows: RailRow[] = useMemo(
    () =>
      vm.grades.map((grade, index) => {
        const q = questions[grade.questionId]
        const fromSession = session?.questions?.find((item) => item.questionId === grade.questionId)
        return {
          index,
          questionId: grade.questionId,
          outcome: gradeOutcomeKey(grade),
          categoryShort: q?.categoryPath?.split('/').pop()?.trim() ?? '未分类',
          durationSec:
            typeof grade.duration === 'number' && grade.duration > 0
              ? grade.duration
              : fromSession?.duration ?? 0,
        }
      }),
    [vm.grades, questions, session],
  )

  const reportDate = new Date(report.confirmedAt ?? report.createdAt ?? Date.now())
  const taskLabel =
    reportOrigin.kind === 'codex-batch' ? reportOrigin.taskId : reportOrigin.sessionId

  const relapseCount = groups.filter((group) => group.state === 'relapse').length

  return (
    <div
      className="ui-overlay modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="批改报告"
      onClick={onClose}
    >
      <div className="ui-modal rp-win" onClick={(event) => event.stopPropagation()}>
        <div className="rp-toolbar">
          <span className="rp-title">批改报告</span>
          <span className="rp-sub">
            {taskLabel} · {reportDate.toISOString().slice(0, 10)} · {vm.totalCount} 题
          </span>

          <div className="segmented" role="tablist">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                className={tab === item.key ? 'active' : ''}
                onClick={() => setTab(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="secondary-button compact"
            onClick={handleCopyContext}
            disabled={!activeGrade}
          >
            {copied ? '已复制' : '复制追问上下文'}
          </button>
          <button
            type="button"
            className="secondary-button compact"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? '读取中' : '刷新'}
          </button>
          <button
            type="button"
            className="ui-modal-close"
            onClick={onClose}
            aria-label="关闭报告"
          >
            <Icon name="x" />
          </button>
        </div>

          {/* 本场 / 档案 两个视图没有侧栏，网格收成一列 */}
          <div className={`rp-body${tab === 'review' ? '' : ' rp-wide'}`}>
            {tab === 'review' ? (
              <QuestionRail
                rows={railRows}
                activeIndex={selectedIndex}
                onSelect={setSelectedIndex}
                footerLeft={`${vm.totalCount} 题`}
                footerRight={noteSaved[activeGrade?.questionId ?? -1] ? '已保存' : 'j / k 切换'}
              />
            ) : null}

            <main className="rp-content">
              {tab === 'review' ? (
                activeGrade && activeFlow ? (
                  <ReviewPane
                    question={activeQuestion}
                    grade={activeGrade}
                    flow={activeFlow}
                    outcome={gradeOutcomeKey(activeGrade)}
                    durationSec={activeDurationSec}
                    benchmarkSec={benchmarkSeconds(activeQuestion?.questionType)}
                    history={activeHistory}
                    group={activeGroup}
                    note={notes[activeGrade.questionId] ?? ''}
                    sections={sections}
                    onToggleSection={toggleSection}
                    revealed={revealed[selectedIndex] === true}
                    onReveal={() => setRevealed((prev) => ({ ...prev, [selectedIndex]: true }))}
                    onNoteChange={(value) =>
                      setNotes((prev) => ({ ...prev, [activeGrade.questionId]: value }))
                    }
                    onNoteBlur={() =>
                      handleSaveNote(activeGrade.questionId, notes[activeGrade.questionId] ?? '')
                    }
                    onAddToPlan={handleAddToPlan}
                    planAdded={planAdded[activeGrade.questionId] === true}
                  />
                ) : (
                  <div className="rp-view">
                    <div className="empty-state">本场还没有可复盘的题目。</div>
                  </div>
                )
              ) : null}

              {tab === 'session' ? <SessionPane vm={vm} /> : null}
              {tab === 'dossier' ? <DossierPane groups={groups} /> : null}
            </main>
          </div>

          <div className="rp-statusbar">
            <span>正确率 {vm.accuracy != null ? `${vm.accuracy}%` : '—'}</span>
            <span>断点 {groups.length}</span>
            <span style={{ color: relapseCount > 0 ? 'var(--danger)' : undefined }}>
              复发 {relapseCount}
            </span>
            <span>用时 {formatElapsed(vm.totalDuration * 1000)}</span>
            {vm.ungradedIds.length > 0 ? <span>{vm.ungradedIds.length} 题无批改证据</span> : null}
            <span className="rp-sp" />
            <span>j / k 切题 · 1-3 切视图 · Esc 关闭</span>
        </div>
      </div>
    </div>
  )
}
