import { motion } from 'framer-motion'
import { ListPlus, Play, Trash2, X } from 'lucide-react'
import { MathText } from './MathText'
import { EmptyState } from './EmptyState'
import type { Question } from '../types'

export function QueueDrawer({
  questions,
  close,
  remove,
  clear,
  start,
}: {
  questions: Question[]
  close: () => void
  remove: (id: number) => void
  clear: () => void
  start: () => void
}) {
  return (
    <motion.div
      className="ui-overlay drawer-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={close}
    >
      <motion.aside
        className="ui-drawer queue-drawer"
        initial={{ x: 420 }}
        animate={{ x: 0 }}
        exit={{ x: 420 }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <h2>自定义训练队列</h2>
            <span>{questions.length} 道题 · 按加入顺序练习</span>
          </div>
          <button className="icon-button" title="关闭" onClick={close}>
            <X size={18} />
          </button>
        </header>
        <div className="drawer-list">
          {questions.map((question, index) => (
            <div className="drawer-item" key={question.id}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div>
                <b>{question.categoryPath.split(' / ').slice(-2).join(' / ')}</b>
                <MathText value={question.stem} />
                <small>
                  #{question.id} · {question.source}
                </small>
              </div>
              <button title="移出队列" onClick={() => remove(question.id)}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {questions.length === 0 && (
            <EmptyState icon={ListPlus} title="队列还是空的" text="从题库加入今天想练的题。" />
          )}
        </div>
        <footer>
          <button
            className="text-button danger"
            disabled={!questions.length}
            onClick={clear}
          >
            <Trash2 size={16} /> 清空
          </button>
          <button
            className="primary-button"
            disabled={!questions.length}
            onClick={start}
          >
            <Play size={17} /> 开始训练
          </button>
        </footer>
      </motion.aside>
    </motion.div>
  )
}
