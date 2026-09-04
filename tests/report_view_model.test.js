import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildReportViewModel,
  filterReportEntries,
  buildGradeFlow,
  buildBreakpointGroups,
  buildSessionDigest,
  sortIndicesByValue,
  timeBaselineFor,
  baselineDimensionValues,
  deriveFixState,
  deriveConsolidation,
  dimensionSpotlight,
} from '../src/domain/reportViewModel.ts'
import { benchmarkSeconds, predictedExamScore } from '../src/utils.ts'

const pressureOrigin = { kind: 'pressure-session', sessionId: 'pressure-1' }
const batchOrigin = { kind: 'codex-batch', taskId: 'SB-20260902-1' }

function grade(questionId, overrides = {}) {
  return {
    questionId,
    correct: true,
    userAnswer: '',
    correctAnswer: '',
    feedback: '',
    duration: 120,
    ...overrides,
  }
}

function report(grades, overrides = {}) {
  return {
    sessionId: 'pressure-1',
    grades,
    summary: {
      correctCount: 0,
      totalCount: grades.length,
      accuracy: 0,
      strengths: [],
      weaknesses: [],
      suggestions: [],
      ...overrides.summary,
    },
    createdAt: 0,
    ...overrides,
  }
}

function fullDimensions(values = {}) {
  return {
    rigor: { score: values.rigor ?? 80 },
    computation: { score: values.computation ?? 90 },
    modeling: { score: values.modeling ?? 70 },
    methodUse: { score: values.methodUse ?? 75 },
    speed: { score: values.speed ?? 85 },
    strategyInsight: { score: values.strategyInsight ?? 65 },
  }
}

test('empty report keeps summary totals but does not invent rating or evidence', () => {
  const model = buildReportViewModel(
    report([], {
      summary: {
        totalCount: 4,
        correctCount: 0,
        accuracy: 0,
      },
      questionIds: [11, 12, 13, 14],
    }),
    {},
    null,
    pressureOrigin,
  )

  assert.equal(model.reportStatus, 'empty')
  assert.equal(model.totalCount, 4)
  assert.equal(model.gradedCount, 0)
  assert.deepEqual(model.counts, { correct: 0, partial: 0, wrong: 0, uncertain: 0 })
  assert.equal(model.accuracy, null)
  assert.equal(model.averageRatingScore, null)
  assert.equal(model.kastRate, null)
  assert.equal(model.examPrediction, null)
  assert.equal(model.hasFullDimensionEvidence, false)
  assert.match(model.verdictText, /没有可用的逐题证据/)
})

test('partial reports derive truthful counts and keep pressure omissions visible', () => {
  const grades = [
    grade(11, { rating: 1.2 }),
    grade(12, { correct: false, verdict: 'partial', rating: 1.0 }),
    grade(13, { correct: false, result: 'wrong', rating: 0.5 }),
    grade(14, { verdict: 'uncertain', rating: 0.8 }),
  ]
  const model = buildReportViewModel(
    report(grades, {
      status: 'graded_partial',
      questionIds: [11, 12, 13, 14, 15],
      ungradedQuestionIds: [15],
      summary: { totalCount: 5, correctCount: 99, accuracy: 0.99 },
    }),
    {},
    null,
    pressureOrigin,
  )

  assert.equal(model.reportStatus, 'partial')
  assert.deepEqual(model.counts, { correct: 1, partial: 1, wrong: 1, uncertain: 1 })
  assert.equal(model.accuracy, 25)
  assert.equal(model.totalCount, 5)
  assert.equal(model.gradedCount, 4)
  assert.deepEqual(model.ungradedIds, [15])
  assert.deepEqual(model.attentionEntries.map(({ index }) => index), [1, 2, 3])
  assert.equal(model.worstGradeEntry.grade.questionId, 13)
  assert.equal(model.priorityEntries.length, 3)
})

test('daily batch reports state that omission coverage is unknown', () => {
  const model = buildReportViewModel(
    report([grade(21, { correct: false, result: 'wrong' })], {
      sourceTaskId: 'SB-20260902-1',
      questionIds: [21],
      ungradedQuestionIds: [],
    }),
    {},
    null,
    batchOrigin,
  )

  assert.equal(model.coverageKnown, false)
  assert.deepEqual(model.ungradedIds, [])
})

test('mixed result filters include partial and uncertain in needs-attention', () => {
  const grades = [
    grade(1),
    grade(2, { correct: false, result: 'wrong' }),
    grade(3, { correct: false, verdict: 'partial' }),
    grade(4, { verdict: 'uncertain' }),
  ]

  assert.deepEqual(filterReportEntries(grades, 'needs-attention').map(({ index }) => index), [1, 2, 3])
  assert.deepEqual(filterReportEntries(grades, 'correct').map(({ index }) => index), [0])
  assert.deepEqual(filterReportEntries(grades, 'uncertain').map(({ index }) => index), [3])
  assert.deepEqual(filterReportEntries(grades, 'all').map(({ index }) => index), [0, 1, 2, 3])
})

test('missing dimensions never become zero and block KAST prediction', () => {
  const model = buildReportViewModel(
    report([grade(31, {
      rating: 1.1,
      dimensions: { rigor: { score: 80 }, computation: { score: null } },
    })]),
    {},
    null,
    pressureOrigin,
  )

  assert.equal(model.evidenceCoverage, 1)
  assert.equal(model.dimStats.find((dimension) => dimension.key === 'rigor').value, 80)
  assert.equal(model.dimStats.find((dimension) => dimension.key === 'computation').value, null)
  assert.equal(model.hasFullDimensionEvidence, false)
  assert.equal(model.kastRate, null)
  assert.equal(model.examPrediction, null)
})

test('complete six-dimension evidence produces KAST and the existing prediction', () => {
  const dimensions = fullDimensions()
  const model = buildReportViewModel(
    report([
      grade(41, { dimensions }),
      grade(42, { dimensions }),
    ]),
    {},
    null,
    pressureOrigin,
  )

  assert.equal(model.evidenceCoverage, 2)
  assert.equal(model.hasFullDimensionEvidence, true)
  assert.equal(model.kastRate, Math.round(0.5 * 80 + 0.3 * 90 + 0.2 * 70))
  assert.equal(model.examPrediction, predictedExamScore(model.averageRatingScore, model.kastRate))
  assert.ok(Number.isFinite(model.averageRatingScore))
})

// ============ E1 断点工单 · 派生层 ============

const completeDiagnosis = {
  errorCode: 'E-027',
  title: '根式换元入口缺失',
  severity: 'L1',
  myEntry: '看到根号就令 x = sin t',
  whyDeadEnd: '根号内是二次式，三角换元后积分区间无法对应',
  rule: { negation: '根号复合禁止三角换元', positive: '整体设 t = √根式' },
  fork: {
    step: 2,
    label: '换元选择',
    myPath: 'x = sin t',
    standardPath: 't = √(1+x²)',
    consequence: '区间映射错，结果差一个系数',
  },
  acceptance: '根号池 13 题零覆盖',
  nextAction: '今晚重做根号池前 5 题',
}

test('buildGradeFlow passes a complete diagnosis through unchanged', () => {
  const flow = buildGradeFlow(grade(70, {
    correct: false,
    advice: '旧的一句话建议',
    diagnosis: completeDiagnosis,
  }))

  assert.equal(flow.errorCode, 'E-027')
  assert.equal(flow.title, '根式换元入口缺失')
  assert.equal(flow.severity, 'L1')
  assert.equal(flow.myEntry, '看到根号就令 x = sin t')
  assert.equal(flow.whyDeadEnd, '根号内是二次式，三角换元后积分区间无法对应')
  assert.deepEqual(flow.rule, { negation: '根号复合禁止三角换元', positive: '整体设 t = √根式' })
  assert.deepEqual(flow.fork, completeDiagnosis.fork)
  assert.equal(flow.acceptance, '根号池 13 题零覆盖')
  // diagnosis 有 nextAction 时不回落到 advice
  assert.equal(flow.nextAction, '今晚重做根号池前 5 题')
})

test('buildGradeFlow degrades to existing fields when diagnosis is absent', () => {
  const flow = buildGradeFlow(grade(71, {
    correct: false,
    errorTags: ['概念盲区'],
    earliestError: '第 2 行换元写错',
    betterSolution: '整体设 t = √(1+x²)',
    advice: '今晚重做根号池前 5 题',
  }))

  assert.equal(flow.errorCode, null)
  assert.equal(flow.title, '概念盲区')
  assert.equal(flow.severity, 'L1')
  assert.equal(flow.killLine, '第 2 行换元写错')
  // 老报告没有 fork 时用已有字段重排，只是换个呈现方式
  assert.deepEqual(flow.fork, {
    step: 1,
    label: '路径选择',
    myPath: '第 2 行换元写错',
    standardPath: '整体设 t = √(1+x²)',
    consequence: null,
  })
  assert.equal(flow.nextAction, '今晚重做根号池前 5 题')
  // 无法派生的字段必须留空，不许拿题干或结论编造
  assert.equal(flow.myEntry, null)
  assert.equal(flow.whyDeadEnd, null)
  assert.equal(flow.acceptance, null)
  assert.equal(flow.rule, null)
})

test('buildGradeFlow invents nothing for a bare incorrect grade', () => {
  const flow = buildGradeFlow(grade(72, { correct: false }))

  assert.equal(flow.errorCode, null)
  assert.equal(flow.title, null)
  assert.equal(flow.severity, null)
  assert.equal(flow.killLine, null)
  assert.equal(flow.rule, null)
  assert.equal(flow.fork, null)
  assert.equal(flow.nextAction, null)
})

test('buildGradeFlow infers severity L1 > L3 > L2 > null from error tags', () => {
  const severityOf = (errorTags) =>
    buildGradeFlow(grade(73, { correct: false, errorTags })).severity

  assert.equal(severityOf(['概念盲区']), 'L1')
  assert.equal(severityOf(['定理记错']), 'L1')
  assert.equal(severityOf(['瞄准失误']), 'L3')
  assert.equal(severityOf(['负号抄错']), 'L3')
  assert.equal(severityOf(['战术绕路']), 'L2')
  assert.equal(severityOf([]), null)
  // 致命标签优先于精度标签
  assert.equal(severityOf(['瞄准失误', '概念盲区']), 'L1')
})

test('buildGradeFlow keeps a half-filled rule but drops an empty one', () => {
  const half = buildGradeFlow(grade(74, {
    correct: false,
    diagnosis: { rule: { negation: '禁止三角换元' } },
  }))
  assert.deepEqual(half.rule, { negation: '禁止三角换元', positive: '' })

  const empty = buildGradeFlow(grade(75, {
    correct: false,
    diagnosis: { rule: { negation: '', positive: '' } },
  }))
  assert.equal(empty.rule, null)

  // 空 diagnosis 对象与没有 diagnosis 走同一条降级路径
  const blank = buildGradeFlow(grade(76, { correct: false, diagnosis: {} }))
  assert.equal(blank.errorCode, null)
  assert.equal(blank.rule, null)
  assert.equal(blank.fork, null)
})

test('buildGradeFlow falls back to feedback and betterSolution for the fork', () => {
  const flow = buildGradeFlow(grade(77, {
    correct: false,
    feedback: '分布函数三段讨论写漏区间',
    betterSolution: '严格单调直接套公式法',
    diagnosis: { fork: { step: 3, label: '方法选择', myPath: '分布函数法' } },
  }))

  // fork 存在但 standardPath 缺失时补 betterSolution，其余字段尊重 diagnosis
  assert.equal(flow.fork.step, 3)
  assert.equal(flow.fork.label, '方法选择')
  assert.equal(flow.fork.myPath, '分布函数法')
  assert.equal(flow.fork.standardPath, '严格单调直接套公式法')
  assert.equal(flow.killLine, '分布函数三段讨论写漏区间')
})

// ============ WP6 总诊断与价值排序 ============

test('buildSessionDigest clusters same errorCode and picks the negation rule as the one thing', () => {
  const wrongWithCode = (questionId) => grade(questionId, {
    correct: false,
    result: 'wrong',
    verdict: 'incorrect',
    errorTags: ['概念盲区'],
    diagnosis: {
      errorCode: 'E-027',
      title: '根式换元入口缺失',
      severity: 'L1',
      rule: { negation: '根号复合禁止三角换元', positive: '整体设 t' },
    },
  })
  const grades = [grade(1), wrongWithCode(2), wrongWithCode(3)]
  const groups = buildBreakpointGroups(grades, [])
  const digest = buildSessionDigest(grades, groups, {}, {})

  assert.equal(digest.distribution, '3 题：对 1 / 错 2')
  assert.ok(digest.clusterLine.includes('2 题死在同一个动作'))
  assert.equal(digest.oneThingLine, '本次只带走一件：根号复合禁止三角换元')
  // 领域层不掺表情符号：图标由呈现层用矢量 Icon 画
  assert.ok(!digest.oneThingLine.includes('📌'))
})

test('buildSessionDigest leads with error-class mode when it covers multiple wrongs', () => {
  const wrong = (questionId, tag) => grade(questionId, {
    correct: false,
    result: 'wrong',
    verdict: 'incorrect',
    errorTags: [tag],
  })
  const grades = [grade(1), wrong(2, '计算笔误'), wrong(3, '瞄准失误')]
  const metas = {
    2: { questionId: 2, errorClass: 'aiming', nextReviewAt: null, nextAction: null, reviewStage: null },
    3: { questionId: 3, errorClass: 'aiming', nextReviewAt: null, nextAction: null, reviewStage: null },
  }
  const digest = buildSessionDigest(grades, buildBreakpointGroups(grades, []), metas, {})

  assert.ok(digest.clusterLine.startsWith('病因聚类：瞄准失误 × 2 题'))
})

test('buildSessionDigest counts overtime against per-question benchmark and stays silent on clean sessions', () => {
  const grades = [
    grade(1, { duration: 400 }),
    grade(2, { duration: 60 }),
    grade(3, { duration: 100 }),
  ]
  const questions = { 1: { questionType: 'single_choice' }, 2: { questionType: 'single_choice' }, 3: { questionType: 'single_choice' } }
  const digest = buildSessionDigest(grades, buildBreakpointGroups(grades, []), {}, questions)

  assert.equal(digest.overtimeCount, 1)
  assert.ok(digest.distribution.includes('1 题超时'))
  assert.equal(digest.clusterLine, null)
  assert.equal(digest.oneThingLine, null)
})

test('sortIndicesByValue orders wrong before correct, L1 before L2, clustered first', () => {
  const clustered = (questionId) => grade(questionId, {
    correct: false,
    result: 'wrong',
    verdict: 'incorrect',
    errorTags: ['概念盲区'],
    diagnosis: { errorCode: 'E-027', title: '根式换元入口缺失', severity: 'L1' },
  })
  const grades = [
    grade(10),                                              // 0 correct，垫底
    grade(11, { correct: false, result: 'wrong', verdict: 'incorrect', errorTags: ['方法绕路'] }), // 1 错但 L2
    clustered(12),                                          // 2 错 L1 聚类
    clustered(13),                                          // 3 错 L1 聚类
  ]

  assert.deepEqual(sortIndicesByValue(grades), [2, 3, 1, 0])
})

test('timeBaselineFor prefers personal median at 3+ samples, falls back to type benchmark otherwise', () => {
  const baselines = { '高等数学/一元函数积分学': { medianSeconds: 240, sampleCount: 5 } }

  assert.deepEqual(
    timeBaselineFor('高等数学/一元函数积分学', 'single_choice', baselines),
    { seconds: 240, personal: true },
  )
  // 其他板块无数据 → 题型通用基准，标记非个人
  assert.deepEqual(
    timeBaselineFor('线性代数/矩阵', 'single_choice', baselines),
    { seconds: 180, personal: false },
  )
  // 样本不足 3 同样回退，不冒充个人基准
  assert.deepEqual(
    timeBaselineFor('高等数学/一元函数积分学', 'single_choice', {
      '高等数学/一元函数积分学': { medianSeconds: 240, sampleCount: 2 },
    }),
    { seconds: 180, personal: false },
  )
})

// ============ 批次 B · 证据层与固化判定 ============

test('buildGradeFlow surfaces the correct-answer consolidation card', () => {
  const flow = buildGradeFlow(grade(9, {
    correct: true,
    result: 'correct',
    verdict: 'correct',
    diagnosis: {
      myEntry: '看到 $\\sqrt{x^2+2x}$ 先配方',
      rule: { positive: '根号内是二次式 → 先配方再设元' },
      whyItWorked: '配成完全平方后根式整体降为一次，换元不再产生新根号',
    },
  }))
  assert.equal(flow.myEntry, '看到 $\\sqrt{x^2+2x}$ 先配方')
  assert.equal(flow.whyItWorked, '配成完全平方后根式整体降为一次，换元不再产生新根号')
})

function dims(values) {
  const keys = ['rigor', 'computation', 'modeling', 'methodUse', 'speed', 'strategyInsight']
  return Object.fromEntries(
    keys.map((key) => [
      key,
      { score: values[key] ?? null, confidence: 0.9, evidence: `${key} 的草稿证据` },
    ]),
  )
}

const EMPTY_BASELINE = {
  rigor: null,
  computation: null,
  modeling: null,
  methodUse: null,
  speed: null,
  strategyInsight: null,
}

test('dimensionSpotlight publishes only the two most extreme dims with their evidence', () => {
  const spot = dimensionSpotlight(
    grade(1, { dimensions: dims({ rigor: 92, computation: 55, methodUse: 80, speed: 88 }) }),
    EMPTY_BASELINE,
  )
  assert.equal(spot.high.key, 'rigor')
  assert.equal(spot.high.value, 92)
  assert.equal(spot.high.evidence, 'rigor 的草稿证据')
  assert.equal(spot.low.key, 'computation')
  assert.equal(spot.low.evidence, 'computation 的草稿证据')
  assert.equal(spot.spread, 37)

  // 极差不足 20 分不上架，避免把噪声当结论
  assert.equal(
    dimensionSpotlight(grade(2, { dimensions: dims({ rigor: 80, computation: 72 }) }), EMPTY_BASELINE),
    null,
  )
  // 可打分维度不足两个同样不上架
  assert.equal(
    dimensionSpotlight(grade(3, { dimensions: dims({ rigor: 80 }) }), EMPTY_BASELINE),
    null,
  )
})

test('dimensionSpotlight deltas are measured against the group baseline', () => {
  const gradeA = grade(1, { dimensions: dims({ rigor: 90, computation: 50 }) })
  const baseline = baselineDimensionValues([gradeA])
  const spot = dimensionSpotlight(gradeA, baseline)
  assert.equal(baseline.rigor, 90)
  assert.equal(spot.high.delta, 0)
  assert.equal(spot.low.value, 50)
})

test('deriveFixState keeps three states so a first exposure never reads as 观察中', () => {
  const group = (overrides) => ({
    key: 'E-027',
    errorCode: 'E-027',
    title: '根式换元入口缺失',
    severity: 'L1',
    indices: [0],
    questionIds: [1],
    state: 'new',
    historyWrong: 0,
    historyTotal: 0,
    ...overrides,
  })
  assert.equal(deriveFixState(null), null)
  assert.equal(deriveFixState(group({})).label, '首次暴露')
  assert.equal(deriveFixState(group({ historyTotal: 2 })).label, '观察中')
  assert.equal(deriveFixState(group({ state: 'relapse' })).label, '待验证')
})

test('deriveConsolidation refuses to claim mastery without repeated independent evidence', () => {
  const flow = { whyItWorked: '配方后根式降次' }
  const attempt = (verdict) => ({ verdict, outcome: verdict, attemptedAt: 'x', durationSeconds: 60 })

  // 本次做对 + 之前连续两次做对 → 已固化
  assert.equal(
    deriveConsolidation('correct', [attempt('correct'), attempt('correct'), attempt('correct')], flow)
      .label,
    '已固化 · 连续 3 次做对',
  )
  // 只有一次前序证据 → 观察中
  assert.equal(
    deriveConsolidation('correct', [attempt('correct'), attempt('correct')], flow).label,
    '观察中 · 连续 2 次做对',
  )
  // 首次做对：一次做对不等于稳定掌握，不给状态
  assert.equal(deriveConsolidation('correct', [attempt('correct')], flow), null)
  // 中间错一次就断链：只数到连续的那一段（1 次前序），封顶在观察中
  assert.equal(
    deriveConsolidation(
      'correct',
      [attempt('correct'), attempt('correct'), attempt('wrong'), attempt('correct')],
      flow,
    ).label,
    '观察中 · 连续 2 次做对',
  )
  // 没有固化卡证据不给状态；错题也不走这条判定
  assert.equal(deriveConsolidation('correct', [attempt('correct'), attempt('correct')], {}), null)
  assert.equal(
    deriveConsolidation('wrong', [attempt('wrong'), attempt('correct')], flow),
    null,
  )
})

test('benchmarkSeconds keeps the same math-one timing table as the Rust kernel', () => {
  // 与 src-tauri/src/services/rating.rs::benchmark_seconds_pins_the_math_one_timing_table 成对：
  // 基准耗时被提示词、压力报告、前端三处引用，任一侧改数值这里就红。
  assert.equal(benchmarkSeconds('single_choice'), 180)
  assert.equal(benchmarkSeconds('multiple_choice'), 240)
  assert.equal(benchmarkSeconds('fill_in'), 300)
  assert.equal(benchmarkSeconds('subjective'), 600)
  assert.equal(benchmarkSeconds(null), 600)
  assert.equal(benchmarkSeconds(undefined), 600)
})
