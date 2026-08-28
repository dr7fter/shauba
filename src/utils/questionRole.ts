// AI 题组的「题目角色」元数据。
//
// 后端 recommendation_batch_items.role 的合法值只有 8 种
// （见 lib.rs create_recommendation_batch 的校验），这里把它们翻译成
// 做题时一眼能懂的徽章：标签 + 一句「这道题该怎么对待」的行动提示。
//
// 设计原则（对应用户的刷法）：
// - 「快筛型」角色（诊断 / 限时）允许跳题——认不出原型就自评 1 分过，
//   做错也算达成目标，这类题是用来暴露漏洞的，不是用来死磕的。
// - 「精做型」角色（巩固 / 综合 / 攻坚）不允许跳——要么算到底，要么记录断点。

export type QuestionRoleTone =
  | 'scan' // 快筛：蓝
  | 'method' // 选法：紫
  | 'solid' // 巩固：绿
  | 'synthetic' // 综合：金
  | 'transfer' // 迁移：青
  | 'blitz' // 限时：红
  | 'boss' // 攻坚：深红
  | 'review' // 复习：灰

export type QuestionRoleMeta = {
  /** 徽章上显示的短标签 */
  label: string
  /** 这道题该怎么对待（hover 提示 / 题号旁小字） */
  hint: string
  tone: QuestionRoleTone
}

export const QUESTION_ROLE_META: Record<string, QuestionRoleMeta> = {
  diagnosis: {
    label: '诊断',
    tone: 'scan',
    hint: '快筛题：先认原型再动笔，认不出就自评 1 分跳过，做错也算达成目标',
  },
  method_choice: {
    label: '选法',
    tone: 'method',
    hint: '先定方法再动笔：想清楚用什么方法、为什么，不必算到底',
  },
  consolidate: {
    label: '巩固',
    tone: 'solid',
    hint: '标准形态：求稳求快，计时别超基准，不许跳',
  },
  integration: {
    label: '综合',
    tone: 'synthetic',
    hint: '多考点串联：重点记断点卡在哪一步，不许跳',
  },
  transfer: {
    label: '迁移',
    tone: 'transfer',
    hint: '变体题：先认出原型再下手，认不出记下来回去补',
  },
  timed: {
    label: '限时',
    tone: 'blitz',
    hint: '限时快筛：卡住立刻跳，别硬熬',
  },
  challenge: {
    label: '攻坚',
    tone: 'boss',
    hint: '压轴级：允许超时但不许跳，必须写到底',
  },
  review: {
    label: '复习',
    tone: 'review',
    hint: '回头重做：追求一次写对',
  },
}

/** 兜底：未知 role 原样显示，不猜含义。 */
export function questionRoleMeta(role?: string | null): QuestionRoleMeta | null {
  if (!role) return null
  return QUESTION_ROLE_META[role] ?? { label: role, hint: '', tone: 'review' }
}
