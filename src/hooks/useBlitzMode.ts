import { useEffect, useRef, useState } from 'react'
import { gradeBlitzExam } from '../data/motivation'
import type { BlitzExamResult } from '../data/motivation'
import type { RecommendedQuestion } from '../types'

export interface UseBlitzModeOptions {
  queue: RecommendedQuestion[]
  index: number
  onBlitzFinish: (res: BlitzExamResult) => void
}

export function useBlitzMode({ queue, index, onBlitzFinish }: UseBlitzModeOptions) {
  const isBlitzMode = queue[0]?.reasonCode === 'blitz'
  const [blitzCorrect, setBlitzCorrect] = useState(0)
  const [blitzStartTime, setBlitzStartTime] = useState(() => Date.now())
  const blitzTotalRef = useRef(queue.length)

  useEffect(() => {
    if (isBlitzMode) {
      blitzTotalRef.current = queue.length
      if (index === 0) {
        setBlitzStartTime(Date.now())
        setBlitzCorrect(0)
      }
    }
  }, [isBlitzMode, queue.length, index])

  const handleBlitzAttempt = (correct: boolean, currentQuestionId: number) => {
    if (!isBlitzMode) return
    const nextCorrect = correct ? blitzCorrect + 1 : blitzCorrect
    setBlitzCorrect(nextCorrect)
    const remainingAfter = queue.filter((item) => item.question.id !== currentQuestionId)
    if (remainingAfter.length === 0) {
      const totalSpent = Math.max(10, Math.round((Date.now() - blitzStartTime) / 1000))
      const totalProblems = blitzTotalRef.current || queue.length || 4
      const graded = gradeBlitzExam(totalProblems, nextCorrect, totalSpent, 900)
      onBlitzFinish(graded)
    }
  }

  return {
    isBlitzMode,
    blitzCorrect,
    blitzStartTime,
    handleBlitzAttempt,
  }
}
