import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addDailyPlanItem, getCategoryTimeBaselines, getErrorCodeHistory, getQuestionAttemptHistory, getQuestionsLearningMeta, saveNote } from '../../api'
import { benchmarkSeconds, formatElapsed, gradeOutcomeKey } from '../../utils'
import {
  baselineDimensionValues,
  buildBreakpointGroups,
  buildGradeFlow,
  buildReportViewModel,
  buildSessionDigest,
  type BreakpointGroup,
} from '../../domain/reportViewModel'
import { QuestionRail, type RailRow } from './QuestionRail'
import { ReviewPane } from './ReviewPane'
import { SessionPane } from './SessionPane'
import { DossierPane } from './DossierPane'
import { Icon } from '../ui/Icon'
import type {
  AttemptHistoryEntry,
  ErrorCodeEncounter,
  GradingReport,
  GradingReportOrigin,
  PressureSession,
  Question,
  QuestionLearningMeta,
} from '../../types'

type TabKey = 'review' | 'session' | 'dossier'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'review', label: '复盘' },
  { key: 'session', label: '本场' },
  { key: 'dossier', label: '档案' },
]

/** 折叠段的默认开合：断点、原理与识别规则默认展开 */
const DEFAULT_SECTIONS: Record<string, boolean> = {
  entry: true,
  kill: true,
  why: true,
  sol: true,
  rule: true,
  worked: false,
  evidence: false,
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
  /* 提示：报告里所有写库动作的成败都必须被看见，静默失败等于数据事故 */
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null)
  const toastTimer = useRef<number | null>(null)
  const contentRef = useRef<HTMLElement | null>(null)

  const showToast = useCallback((text: string, tone: 'ok' | 'err' = 'ok') => {
    setToast({ text, tone })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    },
    [],
  )

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const vm = useMemo(
    () => buildReportViewModel(report, questions, session, reportOrigin),
    [report, questions, session, reportOrigin],
  )

  /* 本组六维基线：单题极差最大的那一维要跟它对照才有意义 */
  const dimBaseline = useMemo(() => baselineDimensionValues(vm.grades), [vm.grades])

  const groups: BreakpointGroup[] = useMemo(
    () => buildBreakpointGroups(vm.grades, history),
    [vm.grades, history],
  )

  const gradeQuestionIds = useMemo(() => vm.grades.map((g) => g.questionId), [vm.grades])

  /* 历史作答：复发判定与用时压缩都依赖它 */
  const [historyDegraded, setHistoryDegraded] = useState(false)
  useEffect(() => {
    let alive = true
    if (gradeQuestionIds.length === 0) {
      setHistory([])
      setHistoryDegraded(false)
      return
    }
    void getQuestionAttemptHistory(gradeQuestionIds)
      .then((rows) => {
        if (!alive) return
        setHistory(Array.isArray(rows) ? rows : [])
        setHistoryDegraded(false)
      })
      .catch(() => {
        if (!alive) return
        setHistory([])
        // 「复发 0」与「查不到历史」必须长得不一样，否则状态栏在说谎
        setHistoryDegraded(true)
      })
    return () => {
      alive = false
    }
  }, [gradeQuestionIds])

  /* 学习引擎元信息：病因类 / 复做排期 / 药方。查不到即空，前端留空不编造 */
  const [learningMetas, setLearningMetas] = useState<Record<number, QuestionLearningMeta>>({})
  useEffect(() => {
    let alive = true
    if (gradeQuestionIds.length === 0) {
      setLearningMetas({})
      return
    }
    void getQuestionsLearningMeta(gradeQuestionIds)
      .then((rows) => {
        if (!alive) return
        const map: Record<number, QuestionLearningMeta> = {}
        for (const row of Array.isArray(rows) ? rows : []) map[row.questionId] = row
        setLearningMetas(map)
      })
      .catch(() => {
        if (alive) setLearningMetas({})
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

  /* 默认落在第一题上（按作答顺序），只在新报告时打一次，之后尊重用户的选择 */
  const initializedKeyRef = useRef<string | null>(null)
  useEffect(() => {
    const key = `${report.confirmedAt ?? report.createdAt ?? report.sourceTaskId}_${vm.grades.length}`
    if (initializedKeyRef.current === key) return
    initializedKeyRef.current = key
    if (vm.grades.length > 0) setSelectedIndex(0)
  }, [report, vm.grades.length])

  /* 题目列表按作答顺序排列，j/k 与上下键线性步进 */
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

  /* 同 errorCode 的历史命中：复发时间线要拿"上次那条规则"来并排 */
  const activeErrorCode = activeFlow?.errorCode ?? null
  const [encounters, setEncounters] = useState<ErrorCodeEncounter[]>([])
  useEffect(() => {
    if (!activeGrade || !activeErrorCode) {
      setEncounters([])
      return
    }
    let alive = true
    void getErrorCodeHistory(activeGrade.questionId, activeErrorCode, report.sourceTaskId ?? null)
      .then((rows) => {
        if (alive) setEncounters(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (alive) setEncounters([])
      })
    return () => {
      alive = false
    }
  }, [activeGrade, activeErrorCode, report.sourceTaskId])

  /* 切题后正文回到顶部，断点段必须第一眼可见 */
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [selectedIndex, tab])

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
        .catch((error: unknown) => {
          /* 亲笔自省是画像契约里的最高维度证据，存不上必须让学员当场知道 */
          showToast(`自省没能保存：${String(error)}`, 'err')
        })
    },
    [showToast],
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
      .then(() => {
        setPlanAdded((prev) => ({ ...prev, [activeGrade.questionId]: true }))
        showToast(`已加入 ${planDate} 的计划`, 'ok')
      })
      .catch((error: unknown) => showToast(`加入明日计划失败：${String(error)}`, 'err'))
  }, [activeGrade, activeFlow, activeQuestion, showToast])

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
        showToast('已复制：贴给 AI 就能拿到考纲内标准详解', 'ok')
      })
      .catch((error: unknown) => showToast(`复制失败：${String(error)}`, 'err'))
  }, [activeGrade, activeQuestion, activeFlow, showToast])

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

  const digest = useMemo(
    () => buildSessionDigest(vm.grades, groups, learningMetas, questions),
    [vm.grades, groups, learningMetas, questions],
  )

  /* 个人化用时基准：报告打开时拉一次（全库统计，与具体哪场无关） */
  const [timeBaselines, setTimeBaselines] = useState<
    Record<string, { medianSeconds: number; sampleCount: number }>
  >({})
  useEffect(() => {
    let alive = true
    void getCategoryTimeBaselines()
      .then((rows) => {
        if (!alive) return
        const map: Record<string, { medianSeconds: number; sampleCount: number }> = {}
        for (const row of Array.isArray(rows) ? rows : []) {
          map[row.categoryPath] = { medianSeconds: row.medianSeconds, sampleCount: row.sampleCount }
        }
        setTimeBaselines(map)
      })
      .catch(() => {
        if (alive) setTimeBaselines({})
      })
    return () => {
      alive = false
    }
  }, [])

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
    >
      <div className="ui-modal rp-win">
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
            <Icon name={copied ? 'check' : 'copy'} />
            复制追问上下文
          </button>
          <button
            type="button"
            className="secondary-button compact"
            onClick={onRefresh}
            disabled={loading}
          >
            <Icon name="rotate-ccw" />
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
                footerRight={
                  noteSaved[activeGrade?.questionId ?? -1] ? (
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>已保存</span>
                  ) : (
                    <span>
                      <kbd className="rp-kbd">j</kbd> <kbd className="rp-kbd">k</kbd> 切题
                    </span>
                  )
                }
              />
            ) : null}

            <main className="rp-content" ref={contentRef}>
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
                    encounters={encounters}
                    dimBaseline={dimBaseline}
                    group={activeGroup}
                    meta={learningMetas[activeGrade.questionId] ?? null}
                    digest={digest}
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
                    <div className="empty-state">
                      <Icon name="book" size="lg" />
                      <span>本场还没有可复盘的题目。</span>
                    </div>
                  </div>
                )
              ) : null}

              {tab === 'session' ? (
                <SessionPane vm={vm} questions={questions} timeBaselines={timeBaselines} />
              ) : null}
              {tab === 'dossier' ? <DossierPane groups={groups} /> : null}
            </main>
          </div>

          <div className="rp-statusbar">
            <span>正确率 {vm.accuracy != null ? `${vm.accuracy}%` : '—'}</span>
            <span>断点 {groups.length}</span>
            {historyDegraded ? (
              <span style={{ color: 'var(--warn-strong)' }} title="历史作答查询失败，复发数无法判定">
                历史不可用 · 复发数不显示
              </span>
            ) : (
              <span style={{ color: relapseCount > 0 ? 'var(--danger)' : undefined }}>
                复发 {relapseCount}
              </span>
            )}
            <span>用时 {formatElapsed(vm.totalDuration * 1000)}</span>
            {vm.ungradedIds.length > 0 ? <span>{vm.ungradedIds.length} 题无批改证据</span> : null}
            {vm.reportStatus === 'evidence-insufficient' ? (
              <span style={{ color: 'var(--warn-strong)' }} title="部分题目六维分缺失，会回退到特征曲线评分">
                六维证据不全
              </span>
            ) : null}
            <span className="rp-sp" />
            <span>
              <kbd className="rp-kbd">j</kbd> / <kbd className="rp-kbd">k</kbd> 切题 · <kbd className="rp-kbd">1</kbd>-<kbd className="rp-kbd">3</kbd> 切视图 · <kbd className="rp-kbd">Esc</kbd> 关闭
            </span>
        </div>

        {toast ? (
          <div className={`ui-toast${toast.tone === 'err' ? ' toast-error' : ''}`} role="status">
            <Icon name={toast.tone === 'err' ? 'alert' : 'check'} size="sm" />
            {toast.text}
            <button type="button" onClick={() => setToast(null)} aria-label="关闭提示">
              <Icon name="x" size="sm" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
