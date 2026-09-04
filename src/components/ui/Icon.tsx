import type { ReactNode } from 'react'

/* ==========================================================================
   Icon —— 手绘 inline SVG 图标（2026-09-04 WP4）
   取代文字符号（✓/◐/✕/▶）：跨平台渲染一致、粗细可调、颜色全走 currentColor。
   尺寸用 tokens 的 --icon-sm/md/lg；新增图标只往 GLYPHS 里加，不引图标库依赖。
   ========================================================================== */

export type IconName =
  | 'chevron' // 折叠段展开/收起
  | 'check' // 正确
  | 'half' // 部分正确
  | 'x' // 错误 / 关闭
  | 'dot' // 待确认
  | 'crosshair' // 瞄准失误（计算/符号类）
  | 'book' // 概念盲区
  | 'route' // 战术绕路
  | 'rotate-ccw' // 复做
  | 'dice' // 碰对（结果对但方法不可复现）
  | 'copy' // 复制
  | 'arrow-down' // 向下流向指示
  | 'alert' // 警告/复发

const GLYPHS: Record<IconName, ReactNode> = {
  chevron: <path d="m9 18 6-6-6-6" />,
  check: <path d="M20 6 9 17l-5-5" />,
  half: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none" />
    </>
  ),
  x: <path d="M18 6 6 18M6 6l12 12" />,
  dot: <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />,
  crosshair: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M21 12h-3M6 12H3M12 6V3M12 21v-3" />
    </>
  ),
  book: (
    <>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </>
  ),
  route: (
    <>
      <circle cx="6" cy="19" r="3" />
      <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      <circle cx="18" cy="5" r="3" />
    </>
  ),
  'rotate-ccw': (
    <>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  dice: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="8.2" cy="8.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.8" cy="8.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8.2" cy="15.8" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.8" cy="15.8" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  'arrow-down': <path d="M12 5v14M19 12l-7 7-7-7" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
}

export function Icon({
  name,
  size = 'sm',
  className,
}: {
  name: IconName
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      style={{ width: `var(--icon-${size})`, height: `var(--icon-${size})`, flex: 'none' }}
    >
      {GLYPHS[name]}
    </svg>
  )
}
