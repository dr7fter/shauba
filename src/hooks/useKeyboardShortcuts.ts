import { useEffect, useRef } from 'react'

export interface KeyboardShortcutActions {
  reveal: () => void
  submitIfReady: () => void
  chooseRating: (rating: number) => void
  toggleOption: (option: string) => void
  skip: () => void
  startVariant: () => void
  previousQuestion: () => void
  nextQuestion: () => void
  revealed: boolean
}

/**
 * Custom hook to manage single-key operations inside TodayView practice workspace.
 */
export function useKeyboardShortcuts(actions: KeyboardShortcutActions) {
  const actionsRef = useRef(actions)
  useEffect(() => {
    actionsRef.current = actions
  })

  useEffect(() => {
    let lastFocusTime = Date.now()
    const onFocus = () => {
      lastFocusTime = Date.now()
    }
    window.addEventListener('focus', onFocus)

    const onKey = (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea, or selecting options
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (
        tag === 'BUTTON' ||
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return
      }

      // Ignore modifier combinations
      if (event.ctrlKey || event.metaKey || event.altKey) return

      const keyUpper = event.key.toUpperCase()

      // 电脑息屏/睡眠唤醒或窗口刚恢复焦点后的 800ms 内，忽略回车与跳题，杜绝硬件唤醒误触
      if (Date.now() - lastFocusTime < 800) {
        if (event.key === 'Enter' || keyUpper === 'S') return
      }

      // 仅允许 Enter 翻转与提交，彻底取消 Space 空格键绑定（避免电脑按空格唤醒时跳题）
      if (event.key === 'Enter') {
        event.preventDefault()
        if (!actionsRef.current.revealed) {
          actionsRef.current.reveal()
        } else {
          actionsRef.current.submitIfReady()
        }
      } else if (event.key >= '1' && event.key <= '4') {
        event.preventDefault()
        actionsRef.current.chooseRating(Number(event.key))
      } else if (['A', 'B', 'C', 'D'].includes(keyUpper)) {
        event.preventDefault()
        actionsRef.current.toggleOption(keyUpper)
      } else if (keyUpper === 'S') {
        event.preventDefault()
        actionsRef.current.skip()
      } else if (keyUpper === 'V' && actionsRef.current.revealed) {
        event.preventDefault()
        actionsRef.current.startVariant()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        actionsRef.current.previousQuestion()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        actionsRef.current.nextQuestion()
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('keydown', onKey)
    }
  }, [])
}
