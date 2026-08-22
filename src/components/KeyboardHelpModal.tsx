import { AnimatePresence, motion } from 'framer-motion'
import { Command, HelpCircle, Sparkles, X, Zap } from 'lucide-react'

interface KeyboardHelpModalProps {
  open: boolean
  onClose: () => void
}

export function KeyboardHelpModal({ open, onClose }: KeyboardHelpModalProps) {
  if (!open) return null

  const globalShortcuts = [
    { key: 'Ctrl + K', desc: '打开全局命令菜单（快速跳转视图与执行操作）' },
    { key: 'Alt + F', desc: '展开 / 收起考点公式速查抽屉' },
    { key: 'Alt + Z', desc: '进入 / 退出沉浸专注刷题模式' },
    { key: '? / F1', desc: '打开本快捷键指南' },
    { key: 'Esc', desc: '关闭当前浮层 / 弹窗' },
  ]

  const practiceShortcuts = [
    { key: 'Space / Enter', desc: '看答案（未翻转时） / 记录并进入下一题（自评后）' },
    { key: '1 ~ 4', desc: '极速自评流畅度：1·没思路 2·没做完 3·稍有迟疑 4·流畅秒杀' },
    { key: 'A / B / C / D', desc: '快速勾选或切换选择题选项' },
    { key: 'S', desc: '跳过当前题目，移至今日训练队列末尾' },
    { key: 'V', desc: '攻坚当前考点的 3 道同类变式题（看答案后）' },
    { key: '← / →', desc: '在训练队列中切换上一题 / 下一题' },
  ]

  return (
    <AnimatePresence>
      <div className="ui-overlay modal-backdrop" onClick={onClose} style={{ zIndex: 110 }}>
        <motion.div
          className="ui-modal keyboard-help-modal"
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 320 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="keyboard-help-title"
        >
          <div className="modal-head keyboard-help-head">
            <div className="keyboard-help-title-box">
              <span className="keyboard-help-icon">
                <Command size={18} />
              </span>
              <div>
                <h3 id="keyboard-help-title">全键盘极速流指南</h3>
                <small>双手不离键盘，极速推进数一真题与自评</small>
              </div>
            </div>
            <button className="icon-button" onClick={onClose} aria-label="关闭快捷键指南">
              <X size={18} />
            </button>
          </div>

          <div className="keyboard-help-content">
            <section className="keyboard-help-section">
              <div className="keyboard-section-title">
                <Zap size={15} />
                <span>全局快捷键</span>
              </div>
              <div className="keyboard-shortcut-grid">
                {globalShortcuts.map((item) => (
                  <div key={item.key} className="keyboard-shortcut-row">
                    <kbd className="keyboard-kbd">{item.key}</kbd>
                    <span className="keyboard-desc">{item.desc}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="keyboard-help-section">
              <div className="keyboard-section-title">
                <Sparkles size={15} />
                <span>今日刷题与极速自评</span>
              </div>
              <div className="keyboard-shortcut-grid">
                {practiceShortcuts.map((item) => (
                  <div key={item.key} className="keyboard-shortcut-row">
                    <kbd className="keyboard-kbd">{item.key}</kbd>
                    <span className="keyboard-desc">{item.desc}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="modal-footer keyboard-help-footer">
            <span className="keyboard-help-hint">
              <HelpCircle size={14} /> 在任意页面按下 <kbd className="keyboard-kbd-inline">?</kbd> 即可随时打开此面板
            </span>
            <button className="primary-button compact" onClick={onClose}>
              我知道了
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
