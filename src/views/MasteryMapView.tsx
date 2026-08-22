import { AnimatePresence } from 'framer-motion'
import { BookOpen, Compass, LoaderCircle, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addToCustomQueue,
  getDailyLog,
  getMasteryMap,
  getMasteryNodes,
} from '../api'
import { localToday } from '../utils'
import { QuestionDetail } from '../components/QuestionDetailModal'
import { SubBranchArchiveModal } from '../components/SubBranchArchiveModal'
import type {
  DailyLog,
  MasteryChapter,
  MasteryNode,
  Question,
} from '../types'

export function masteryState(node: MasteryNode) {
  return node.attempted === 0
    ? 'unseen'
    : node.masteryScore === null
    ? 'insufficient'
    : node.masteryScore >= 75
    ? 'strong'
    : node.masteryScore >= 50
    ? 'steady'
    : 'weak'
}

export function MasteryTreemap({
  chapters,
  nodes,
  select,
}: {
  chapters: MasteryChapter[]
  nodes: MasteryNode[]
  select: (node: MasteryNode) => void
}) {
  const nodesByChapter = useMemo(() => {
    const map = new Map<number, MasteryNode[]>()
    for (const node of nodes) {
      const list = map.get(node.chapterId) ?? []
      list.push(node)
      map.set(node.chapterId, list)
    }
    return map
  }, [nodes])

  return (
    <div className="treemap-board">
      {chapters.map((chapter) => {
        const chNodes = nodesByChapter.get(chapter.id) ?? []
        const depth3Nodes = chNodes.filter((n) => n.depth === 3)
        const visibleNodes =
          depth3Nodes.length > 0 ? depth3Nodes : chNodes.filter((n) => n.depth === 2)
        return (
          <section
            className="treemap-chapter"
            key={chapter.id}
            style={{ flexGrow: Math.max(1, chapter.total) }}
          >
            <header>
              <b>{chapter.name}</b>
              <span>
                {chapter.masteryScore === null
                  ? chapter.attempted
                    ? '数据不足'
                    : '未做'
                  : Math.round(chapter.masteryScore)}
              </span>
            </header>
            <div className="treemap-cells">
              {visibleNodes.map((node) => (
                <button
                  key={node.id}
                  className={`treemap-cell ${masteryState(node)}`}
                  style={{
                    flexGrow: Math.max(1, node.total),
                    flexBasis: `${Math.max(54, Math.sqrt(node.total) * 13)}px`,
                  }}
                  title={`${node.path}\n样本 ${node.attempted}/${node.total} · 点击打开全景档案`}
                  onClick={() => select(node)}
                >
                  <b>{node.name}</b>
                  <span>
                    {node.masteryScore === null
                      ? node.attempted
                        ? '数据不足'
                        : '未做'
                      : `${Math.round(node.masteryScore)}`}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export function MasteryMapView({
  notify,
  onPractice,
  onPracticeBatch,
  onStartVariant,
  onAddToQueue,
}: {
  notify: (s: string) => void
  onPractice: (q: Question) => void
  onPracticeBatch: (questions: Question[], reason: string) => void
  onStartVariant: (questionId: number) => void
  onAddToQueue: (questionId: number) => void
}) {
  const [chapters, setChapters] = useState<MasteryChapter[]>([])
  const [nodes, setNodes] = useState<MasteryNode[]>([])
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedSubject, setSelectedSubject] = useState<'all' | '高等数学' | '线性代数' | '概率统计'>('all')
  const [viewMode, setViewMode] = useState<'treemap' | 'chapters'>('treemap')
  const [archiveModalNode, setArchiveModalNode] = useState<MasteryNode | null>(null)
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, n, l] = await Promise.all([getMasteryMap(), getMasteryNodes(), getDailyLog()])
      setChapters(c)
      setNodes(n)
      setDailyLog(l)
    } catch (e) {
      notify(`加载图谱失败：${String(e)}`)
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => {
    void load()
  }, [load])

  const subjects = ['高等数学', '线性代数', '概率统计'] as const

  const filteredChapters = useMemo(() => {
    if (selectedSubject === 'all') return chapters
    return chapters.filter((c) => c.rootName === selectedSubject)
  }, [chapters, selectedSubject])

  const filteredNodes = useMemo(() => {
    const chIds = new Set(filteredChapters.map((c) => c.id))
    return nodes.filter((n) => chIds.has(n.chapterId))
  }, [filteredChapters, nodes])

  const scoredChapters = useMemo(
    () => filteredChapters.filter((c) => c.masteryScore !== null),
    [filteredChapters]
  )
  const averageMastery = useMemo(
    () =>
      scoredChapters.length
        ? scoredChapters.reduce((sum, c) => sum + (c.masteryScore ?? 0), 0) /
          scoredChapters.length
        : 0,
    [scoredChapters]
  )
  const totalDue = useMemo(
    () => filteredChapters.reduce((sum, c) => sum + c.dueCount, 0),
    [filteredChapters]
  )
  const totalWeak = useMemo(
    () => filteredChapters.reduce((sum, c) => sum + c.weakCount, 0),
    [filteredChapters]
  )
  const totalAttempted = useMemo(
    () => filteredChapters.reduce((sum, c) => sum + c.attempted, 0),
    [filteredChapters]
  )
  const totalQuestions = useMemo(
    () => filteredChapters.reduce((sum, c) => sum + c.total, 0),
    [filteredChapters]
  )
  const coveragePercent =
    totalQuestions > 0 ? Math.round((totalAttempted / totalQuestions) * 100) : 0

  const today = localToday()

  return (
    <div className="mastery-map-view">
      {/* Header */}
      <section className="mastery-map-header">
        <div>
          <span
            style={{
              fontSize: 'var(--fs-xs)',
              color: 'var(--muted)',
              fontWeight: 650,
            }}
          >
            数一全景 · 知识掌握度图谱
          </span>
          <h2 style={{ margin: '4px 0 0', fontSize: 'var(--fs-xl)' }}>知识全景地图</h2>
          <p
            style={{
              margin: '4px 0 0',
              color: 'var(--muted)',
              fontSize: 'var(--fs-sm)',
            }}
          >
            实时把控数一三科知识点分布。点击任意考点色块或卡片，直接打开中置全景做题档案与变式攻坚。
          </p>
        </div>
        <button className="icon-button" onClick={load} title="刷新图谱">
          <RefreshCw size={16} />
        </button>
      </section>

      {/* Control Toolbar: Top-Left Subjects & Top-Right View Modes */}
      <section className="mastery-map-controls-bar">
        {/* Left: Subject Switcher */}
        <div className="segmented" role="tablist" aria-label="学科筛选">
          <button
            className={selectedSubject === 'all' ? 'active' : ''}
            onClick={() => setSelectedSubject('all')}
          >
            全部学科
          </button>
          {subjects.map((sub) => (
            <button
              key={sub}
              className={selectedSubject === sub ? 'active' : ''}
              onClick={() => setSelectedSubject(sub)}
            >
              {sub}
            </button>
          ))}
        </div>

        {/* Right: View Mode Switcher */}
        <div className="segmented" role="tablist" aria-label="视图模式">
          <button
            className={viewMode === 'treemap' ? 'active' : ''}
            onClick={() => setViewMode('treemap')}
          >
            <Compass size={14} style={{ marginRight: 5, verticalAlign: -2 }} /> 矩形树图 (Treemap)
          </button>
          <button
            className={viewMode === 'chapters' ? 'active' : ''}
            onClick={() => setViewMode('chapters')}
          >
            <BookOpen size={14} style={{ marginRight: 5, verticalAlign: -2 }} /> 章节视图 (Chapters)
          </button>
        </div>
      </section>

      {/* Stats Summary Strip */}
      <section className="mastery-map-stats-strip">
        <span>
          当前学科覆盖率：<strong>{coveragePercent}%</strong> ({totalAttempted}/
          {totalQuestions} 题)
        </span>
        <span>
          综合掌握度：
          <strong>
            {scoredChapters.length ? `${Math.round(averageMastery)} 分` : '数据不足'}
          </strong>
        </span>
        <span>
          待复习考点：
          <strong className={totalDue > 0 ? 'highlight-warn' : ''}>{totalDue} 题</strong>
        </span>
        <span>
          薄弱重点：
          <strong className={totalWeak > 0 ? 'highlight-danger' : ''}>{totalWeak} 点</strong>
        </span>
      </section>

      {/* Main View Area */}
      {loading ? (
        <div className="review-map-loading" style={{ minHeight: 360 }}>
          <LoaderCircle className="spin" size={24} /> 正在整理数一知识图谱…
        </div>
      ) : viewMode === 'treemap' ? (
        <MasteryTreemap
          chapters={filteredChapters}
          nodes={filteredNodes}
          select={(node) => setArchiveModalNode(node)}
        />
      ) : (
        <div className="mastery-chapters-grid">
          {filteredChapters.map((chapter, index) => {
            const chNodes = filteredNodes.filter(
              (n) => n.chapterId === chapter.id && n.depth >= 3
            )
            const score =
              chapter.masteryScore === null ? null : Math.round(chapter.masteryScore)
            const state =
              chapter.attempted === 0
                ? 'unseen'
                : score === null
                ? 'insufficient'
                : score >= 75
                ? 'strong'
                : score >= 50
                ? 'steady'
                : 'weak'

            return (
              <div key={chapter.id} className={`mastery-chapter-card ${state}`}>
                <div className="mastery-chapter-card-head">
                  <span>
                    {chapter.rootName} · {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={`mastery-chip ${state}`}>
                    {score === null ? (chapter.attempted ? '数据不足' : '未做') : `${score} 分`}
                  </span>
                </div>
                <h3>{chapter.name}</h3>
                <div className="tile-progress">
                  <i style={{ width: `${score ?? 0}%` }} />
                </div>
                <div className="tile-stats">
                  <span>
                    已做 <b>{Math.round(chapter.coverage * 100)}%</b>
                  </span>
                  <span>
                    到期 <b>{chapter.dueCount}</b>
                  </span>
                  <span>
                    薄弱 <b>{chapter.weakCount}</b>
                  </span>
                </div>
                {chNodes.length > 0 && (
                  <div className="mastery-chapter-subnodes">
                    {chNodes.slice(0, 6).map((subNode) => (
                      <button
                        key={subNode.id}
                        type="button"
                        className="mastery-subnode-pill"
                        onClick={() => setArchiveModalNode(subNode)}
                        title="点击打开此考点全景档案"
                      >
                        <span>{subNode.name}</span>
                        <b>
                          {subNode.masteryScore !== null
                            ? `${Math.round(subNode.masteryScore)}分`
                            : subNode.attempted
                            ? '样本少'
                            : '未做'}
                        </b>
                      </button>
                    ))}
                    {chNodes.length > 6 && (
                      <small
                        style={{
                          color: 'var(--muted)',
                          fontSize: 11,
                          textAlign: 'center',
                          marginTop: 2,
                        }}
                      >
                        共 {chNodes.length} 个考点组 · 在树图中查看全部
                      </small>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Legend */}
      <div className="mastery-legend">
        <span>
          <i className="unseen" />未开始
        </span>
        <span>
          <i className="insufficient" />数据不足
        </span>
        <span>
          <i className="weak" />需要加强
        </span>
        <span>
          <i className="steady" />逐步稳定
        </span>
        <span>
          <i className="strong" />掌握良好
        </span>
      </div>

      {/* Centered Modal: Sub-branch Archive */}
      <AnimatePresence>
        {archiveModalNode && (
          <SubBranchArchiveModal
            node={archiveModalNode}
            today={today}
            dailyLog={dailyLog}
            onClose={() => setArchiveModalNode(null)}
            onPractice={onPractice}
            onStartVariant={onStartVariant}
            onAddToQueue={onAddToQueue}
            onViewDetail={(q) => setSelectedQuestion(q)}
            onPracticeBatch={onPracticeBatch}
          />
        )}
      </AnimatePresence>

      {/* Centered Modal: Question Detail */}
      <AnimatePresence>
        {selectedQuestion && (
          <QuestionDetail
            question={selectedQuestion}
            close={() => setSelectedQuestion(null)}
            add={() => {
              void addToCustomQueue(selectedQuestion.id)
                .then(() => notify(`已将 #${selectedQuestion.id} 加入训练队列`))
                .catch((err) => notify(`无法加入训练队列：${String(err)}`))
            }}
            practice={() => {
              onPractice(selectedQuestion)
              setSelectedQuestion(null)
            }}
            onChange={setSelectedQuestion}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
