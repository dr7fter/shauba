import { useEffect, useMemo, useState, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookMarked, Check, Copy, Heart, Lightbulb, Search, Sparkles, X } from 'lucide-react'
import { FORMULA_CHAPTERS, FORMULA_LIBRARY } from '../data/formulas'
import type { MathFormula } from '../data/formulas'
import { MathText } from './MathText'
import type { Question } from '../types'

interface FormulaDrawerProps {
  open: boolean
  onClose: () => void
  currentQuestion?: Question | null
  currentCategoryPath?: string | null
}

const FAVORITES_KEY = 'shuaba_favorite_formulas'

export function FormulaDrawer({ open, onClose, currentQuestion, currentCategoryPath }: FormulaDrawerProps) {
  const [activeSubject, setActiveSubject] = useState<string>('all')
  const [activeChapter, setActiveChapter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_KEY)
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Save favorites to localStorage
  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(next)))
      } catch {
        // ignore
      }
      return next
    })
  }

  // Listen for ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Focus search input when drawer opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 150)
    } else {
      setSearchQuery('')
    }
  }, [open])

  // Context-aware matched formulas based on current question & category path
  const matchedFormulas = useMemo(() => {
    const contextText = [
      currentCategoryPath || '',
      currentQuestion?.categoryPath || '',
      currentQuestion?.stem || '',
      currentQuestion?.source || '',
    ].join(' ')

    if (!contextText.trim()) return []

    return FORMULA_LIBRARY.filter((formula) => {
      return formula.keywords.some((kw) => contextText.includes(kw))
    })
  }, [currentQuestion, currentCategoryPath])

  // Set default tab when opening drawer with context
  useEffect(() => {
    if (open) {
      if (matchedFormulas.length > 0) {
        setActiveSubject('matched')
        setActiveChapter('all')
      } else {
        setActiveSubject('all')
        setActiveChapter('all')
      }
    }
  }, [open, matchedFormulas.length])

  // Available chapter chips based on active subject
  const availableChapters = useMemo(() => {
    if (activeSubject === 'matched' || activeSubject === 'favorites') {
      return []
    }
    if (activeSubject === 'all') {
      return FORMULA_CHAPTERS.filter((c) => c.id !== 'all')
    }
    return FORMULA_CHAPTERS.filter((c) => c.subject === activeSubject)
  }, [activeSubject])

  // Filter formulas based on active filters and search query
  const displayedFormulas = useMemo(() => {
    let list = FORMULA_LIBRARY

    if (activeSubject === 'matched') {
      list = matchedFormulas.length > 0 ? matchedFormulas : FORMULA_LIBRARY
    } else if (activeSubject === 'favorites') {
      list = FORMULA_LIBRARY.filter((f) => favoriteIds.has(f.id))
    } else if (activeSubject === 'gaoshu') {
      list = FORMULA_LIBRARY.filter((f) => f.subject === '高等数学')
    } else if (activeSubject === 'xiandai') {
      list = FORMULA_LIBRARY.filter((f) => f.subject === '线性代数')
    } else if (activeSubject === 'gailv') {
      list = FORMULA_LIBRARY.filter((f) => f.subject === '概率统计')
    }

    if (activeChapter !== 'all' && activeSubject !== 'matched' && activeSubject !== 'favorites') {
      list = list.filter((f) => f.chapter === activeChapter)
    }

    if (!searchQuery.trim()) {
      return list
    }

    const q = searchQuery.toLowerCase().trim()
    return list.filter((f) => {
      return (
        f.title.toLowerCase().includes(q) ||
        f.topic.toLowerCase().includes(q) ||
        f.subject.toLowerCase().includes(q) ||
        (f.note && f.note.toLowerCase().includes(q)) ||
        f.keywords.some((k) => k.toLowerCase().includes(q)) ||
        f.latex.toLowerCase().includes(q)
      )
    })
  }, [activeSubject, activeChapter, searchQuery, matchedFormulas, favoriteIds])

  const copyFormula = async (f: MathFormula) => {
    try {
      await navigator.clipboard.writeText(f.latex)
      setCopiedId(f.id)
      setTimeout(() => setCopiedId(null), 1800)
    } catch {
      // ignore
    }
  }

  const activeBranchName = useMemo(() => {
    const path = currentQuestion?.categoryPath || currentCategoryPath
    if (path) {
      return path.split(' / ').pop() || ''
    }
    return ''
  }, [currentQuestion, currentCategoryPath])

  return (
    <AnimatePresence>
      {open && (
        <div className="ui-overlay formula-drawer-overlay" onClick={onClose}>
          <motion.aside
            className="ui-drawer formula-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="drawer-header">
              <div className="drawer-title-row">
                <div className="drawer-title">
                  <BookMarked size={20} className="drawer-icon" />
                  <h3>考研数学公式大全速查</h3>
                  <span className="formula-count-badge">共 {FORMULA_LIBRARY.length} 组</span>
                </div>
                <button className="icon-button" onClick={onClose} title="关闭 (Esc)">
                  <X size={18} />
                </button>
              </div>

              {matchedFormulas.length > 0 && activeBranchName && (
                <div
                  className="drawer-context-banner"
                  onClick={() => {
                    setActiveSubject('matched')
                    setActiveChapter('all')
                  }}
                  title="点击置顶查看当前考点关联公式"
                >
                  <Sparkles size={15} />
                  <span>
                    当前考点「<b>{activeBranchName}</b>」已智能提取 <b>{matchedFormulas.length}</b> 条重点公式与避坑结论
                  </span>
                </div>
              )}

              <div className="drawer-search-bar">
                <Search size={16} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="快速搜索公式定理 (如: 泰勒, 莱布尼茨, 麦克劳林, 伴随矩阵, 正态分布, 卷积, 格林)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Subject Tabs */}
              <div className="drawer-tabs">
                {matchedFormulas.length > 0 && (
                  <button
                    className={`drawer-tab matched ${activeSubject === 'matched' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveSubject('matched')
                      setActiveChapter('all')
                    }}
                  >
                    <Sparkles size={13} /> 考点关联 ({matchedFormulas.length})
                  </button>
                )}
                <button
                  className={`drawer-tab ${activeSubject === 'all' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSubject('all')
                    setActiveChapter('all')
                  }}
                >
                  全部 ({FORMULA_LIBRARY.length})
                </button>
                <button
                  className={`drawer-tab gaoshu ${activeSubject === 'gaoshu' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSubject('gaoshu')
                    setActiveChapter('all')
                  }}
                >
                  高等数学 ({FORMULA_LIBRARY.filter((f) => f.subject === '高等数学').length})
                </button>
                <button
                  className={`drawer-tab xiandai ${activeSubject === 'xiandai' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSubject('xiandai')
                    setActiveChapter('all')
                  }}
                >
                  线性代数 ({FORMULA_LIBRARY.filter((f) => f.subject === '线性代数').length})
                </button>
                <button
                  className={`drawer-tab gailv ${activeSubject === 'gailv' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSubject('gailv')
                    setActiveChapter('all')
                  }}
                >
                  概率统计 ({FORMULA_LIBRARY.filter((f) => f.subject === '概率统计').length})
                </button>
                <button
                  className={`drawer-tab fav ${activeSubject === 'favorites' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveSubject('favorites')
                    setActiveChapter('all')
                  }}
                >
                  <Heart size={12} fill={favoriteIds.size > 0 ? 'currentColor' : 'none'} /> 收藏 ({favoriteIds.size})
                </button>
              </div>

              {/* Chapter Sub-Filter Chips */}
              {availableChapters.length > 0 && (
                <div className="drawer-chapter-chips">
                  <button
                    className={`chapter-chip ${activeChapter === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveChapter('all')}
                  >
                    全部章节
                  </button>
                  {availableChapters.map((chap) => (
                    <button
                      key={chap.id}
                      className={`chapter-chip ${activeChapter === chap.id ? 'active' : ''}`}
                      onClick={() => setActiveChapter(chap.id)}
                    >
                      {chap.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="drawer-body">
              {displayedFormulas.length === 0 ? (
                <div className="drawer-empty">
                  <Lightbulb size={32} />
                  <p>
                    {activeSubject === 'favorites'
                      ? '还没有收藏公式，点击卡片右上角心形图标即可收藏常用公式'
                      : `没有找到与 “${searchQuery}” 匹配的公式定理`}
                  </p>
                  <small>尝试切换上方分类或缩短搜索关键词</small>
                </div>
              ) : (
                <div className="formula-card-list">
                  {displayedFormulas.map((formula) => {
                    const isMatched = matchedFormulas.some((m) => m.id === formula.id)
                    const isCopied = copiedId === formula.id
                    const isFav = favoriteIds.has(formula.id)

                    return (
                      <article
                        key={formula.id}
                        className={`formula-card ${isMatched ? 'context-highlight' : ''}`}
                      >
                        <header className="formula-card-head">
                          <div className="formula-meta">
                            <span className={`subject-badge ${formula.subject}`}>{formula.subject}</span>
                            <span className="topic-badge">{formula.topic}</span>
                            {isMatched && <span className="matched-badge"><Sparkles size={11} /> 考点关联</span>}
                          </div>
                          <div className="formula-actions">
                            <button
                              className={`formula-fav-btn ${isFav ? 'active' : ''}`}
                              onClick={() => toggleFavorite(formula.id)}
                              title={isFav ? '取消收藏' : '收藏公式'}
                            >
                              <Heart size={14} fill={isFav ? 'currentColor' : 'none'} />
                            </button>
                            <button
                              className="formula-copy-btn"
                              onClick={() => copyFormula(formula)}
                              title="复制 LaTeX 代码"
                            >
                              {isCopied ? <Check size={14} className="copied" /> : <Copy size={14} />}
                              <span>{isCopied ? '已复制' : '复制'}</span>
                            </button>
                          </div>
                        </header>

                        <h4 className="formula-title">{formula.title}</h4>

                        <div className="formula-math-display">
                          <MathText value={`$$\n${formula.latex}\n$$`} />
                        </div>

                        {formula.note && (
                          <div className="formula-note">
                            <Lightbulb size={14} />
                            <span>{formula.note}</span>
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
