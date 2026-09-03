import { ReportWindow } from './report/ReportWindow'
import type { GradingReport, GradingReportOrigin, PressureSession, Question } from '../types'

/**
 * 批改报告入口（薄壳）。
 *
 * 这里曾经是 1637 行的单组件：三栏布局、进场遮罩、六维抽屉、8 个 useState 开关。
 * 2026-09-03 重构为 macOS / Codex 风格，全部呈现逻辑迁到 components/report/ 下，
 * 本文件只保留 App.tsx 需要的接口形状，因此 App.tsx 无需改动。
 *
 * 保留 `onStartVariant` 在类型里但不再使用：变式练习已由报告外的入口承担，
 * 报告内再塞一个「练变式」按钮只会让主屏多一个分心的出口。
 */
export function PressureLearningReportView({
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
  onStartVariant?: (questionId: number) => void
}) {
  return (
    <ReportWindow
      report={report}
      reportOrigin={reportOrigin}
      session={session}
      questions={questions}
      loading={loading}
      onRefresh={onRefresh}
      onClose={onClose}
    />
  )
}
