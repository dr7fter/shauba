// 15 分钟高压真题闪击战评分（Blitz Exam）。
// 游戏中心/每日契约/战报功能已于 2026-08-20 移除，此文件仅保留闪击战评分。

export interface BlitzExamResult {
  total: number
  correctCount: number
  accuracy: number
  timeSpentSeconds: number
  speedScore: number
  rank: 'SSS' | 'S' | 'A' | 'B' | 'C'
  title: string
  feedback: string
}

export function gradeBlitzExam(
  total: number,
  correctCount: number,
  timeSpentSeconds: number,
  limitSeconds: number
): BlitzExamResult {
  const accuracy = total > 0 ? correctCount / total : 0
  const avgSecondsPerProblem = total > 0 ? timeSpentSeconds / total : 0

  // Speed bonus: if avg under 180s per problem (3 min), high speed
  const speedRatio = Math.max(0, Math.min(1, 1 - (timeSpentSeconds / limitSeconds) * 0.7))
  const speedScore = Math.round(speedRatio * 100)

  let rank: 'SSS' | 'S' | 'A' | 'B' | 'C' = 'C'
  let title = '初涉战阵'
  let feedback = '还需进一步强化做题熟练度与时间管理。'

  if (accuracy === 1 && avgSecondsPerProblem <= 150) {
    rank = 'SSS'
    title = '⚡ 秒杀之神'
    feedback = '极限手速与满分准确率！考场上的定海神针！'
  } else if (accuracy >= 0.75 && timeSpentSeconds <= limitSeconds) {
    rank = 'S'
    title = '🎯 考场尖兵'
    feedback = '高压之下依然保持了极高命中率与从容节奏。'
  } else if (accuracy >= 0.5) {
    rank = 'A'
    title = '🛡️ 稳扎稳打'
    feedback = '基础扎实，后续多针对薄弱选项进行专项提速。'
  } else if (correctCount > 0) {
    rank = 'B'
    title = '⚔️ 砥砺前行'
    feedback = '部分题目出现审题或计算断点，注意复盘第一步抓手。'
  }

  return {
    total,
    correctCount,
    accuracy,
    timeSpentSeconds,
    speedScore,
    rank,
    title,
    feedback,
  }
}
