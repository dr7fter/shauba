/**
 * Formats a Date object to local YYYY-MM-DD string according to the local timezone.
 * Avoids the UTC-offset mismatch from Date#toISOString() (which is off by 8 hours in UTC+8).
 */
export function localToday(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Formats seconds into a human-readable string (e.g., "3分20秒" or "45秒").
 */
export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  if (mins === 0) return `${secs}秒`
  if (secs === 0) return `${mins}分钟`
  return `${mins}分${secs}秒`
}
