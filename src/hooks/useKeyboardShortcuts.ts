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

      if (event.key === 'Enter' || event.key === ' ') {
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
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
