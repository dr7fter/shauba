import { motion } from 'framer-motion'
import { BookOpen, Check, ListPlus, Play, X } from 'lucide-react'
import { useState } from 'react'
import { saveNote } from '../api'
import { normalizeAnswer } from '../utils'
import { MathText } from './MathText'
import { QuestionImages } from './QuestionImages'
import type { Question } from '../types'

export function QuestionDetail({
  question,
  close,
  add,
  practice,
  onChange,
}: {
  question: Question
  close: () => void
  add: () => void
  practice: () => void
  onChange?: (question: Question) => void
}) {
  const [revealAnswer, setRevealAnswer] = useState(false)
  const [note, setNote] = useState(question.note ?? '')

  const saveNoteNow = async () => {
    await saveNote(question.id, note.trim())
    onChange?.({ ...question, note: note.trim() })
  }

  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={close}
    >
      <motion.section
        className="question-detail"
        initial={{ opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10 }}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span>题目 #{question.id}</span>
            <h2>{question.categoryPath.split(' / ').slice(-2).join(' / ')}</h2>
          </div>
          <button className="icon-button" title="关闭" onClick={close}>
            <X size={18} />
          </button>
        </header>
        <div className="detail-meta">
          <span>{question.source}</span>
          <span>
            难度 {'●'.repeat(question.difficulty)}
            {'○'.repeat(Math.max(0, 3 - question.difficulty))}
          </span>
          <span>{question.attempts ? `${question.attempts} 次作答` : '尚未作答'}</span>
        </div>
        <article>
          <MathText className="question-stem" value={question.stem} />
          {question.imagePaths.length > 0 && <QuestionImages paths={question.imagePaths} />}
          {question.options.length > 0 && (
            <div className="detail-options">
              {question.options.map((option) => (
                <div
                  key={option.id}
                  className={
                    revealAnswer &&
                    question.questionType !== 'subjective' &&
                    normalizeAnswer(question.correctAnswer).includes(option.label)
                      ? 'detail-option correct'
                      : 'detail-option'
                  }
                >
                  <b className="option-indicator">{option.label}</b>
                  <MathText value={option.contentMd} />
                </div>
              ))}
            </div>
          )}
          {revealAnswer && (
            <>
              <div className="detail-answer">
                <span>参考答案</span>
                <MathText value={question.correctAnswer} />
              </div>
              <div className="detail-explanation">
                <span>解析</span>
                <MathText value={question.explanation} />
              </div>
            </>
          )}
          <div className="detail-note">
            <div className="detail-note-head">
              <span>我的批注</span>
              <button className="text-button compact" onClick={saveNoteNow}>
                <Check size={14} /> 保存批注
              </button>
            </div>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="记录这道题的踩坑点、关键步骤或值得回看的线索…（保存在本机）"
            />
          </div>
        </article>
        <footer>
          <button className="secondary-button" onClick={() => setRevealAnswer((flag) => !flag)}>
            <BookOpen size={17} /> {revealAnswer ? '隐藏答案解析' : '显示答案解析'}
          </button>
          <button className="secondary-button" onClick={add}>
            <ListPlus size={17} /> 加入队列
          </button>
          <button className="primary-button" onClick={practice}>
            <Play size={17} /> 练习此题
          </button>
        </footer>
      </motion.section>
    </motion.div>
  )
}
