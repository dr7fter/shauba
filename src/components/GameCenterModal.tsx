import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Calendar,
  Compass,
  Crown,
  Gift,
  Lock,
  Shield,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import {
  isAudioMuted,
  setAudioMuted,
  playLevelUpSound,
} from '../data/gamification'
import { claimRewardEvent } from '../api'
import type { RewardEvent } from '../types'
import {
  computeTerritories,
  getHallOfFame,
  getDailyQuote,
  getExamCountdown,
} from '../data/motivation'
import { localToday } from '../utils'
import type { GamificationStats } from '../data/gamification'
import type { MasteryChapter } from '../types'

interface GameCenterModalProps {
  open: boolean
  onClose: () => void
  stats: GamificationStats
  chapters: MasteryChapter[]
  onStartBoss?: (categoryName: string) => void
  onRewardClaimed?: () => void
  rewardEvents: RewardEvent[]
}

type TabType = 'profile' | 'quests' | 'territory' | 'boss' | 'trophies' | 'loot'

export function GameCenterModal({
  open,
  onClose,
  stats,
  chapters,
  onStartBoss,
  onRewardClaimed,
  rewardEvents,
}: GameCenterModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('profile')
  const [achievementFilter, setAchievementFilter] = useState<string>('all')
  const [soundMuted, setSoundMuted] = useState(() => isAudioMuted())

  const todayKey = `chest-${localToday()}`
  const [chestClaimed, setChestClaimed] = useState(() => rewardEvents.some((event) => event.eventId === todayKey))

  useEffect(() => {
    setChestClaimed(rewardEvents.some((event) => event.eventId === todayKey))
  }, [rewardEvents, todayKey])

  const hallOfFame = useMemo(() => getHallOfFame(), [])
  const territoryData = useMemo(() => computeTerritories(chapters), [chapters])
  const countdown = getExamCountdown()
  const quote = getDailyQuote()

  const toggleSound = () => {
    const next = !soundMuted
    setSoundMuted(next)
    setAudioMuted(next)
  }

  const handleClaimChest = async () => {
    if (!stats.allQuestsCompleted || chestClaimed) return
    try {
      const result = await claimRewardEvent(todayKey, 'chest', 150)
      if (result.newlyClaimed) {
      setChestClaimed(true)
      playLevelUpSound()
      onRewardClaimed?.()
      } else {
        setChestClaimed(true)
      }
    } catch {
      setChestClaimed(false)
    }
  }

  const unlockedCount = useMemo(() => {
    return stats.achievements.filter((a) => a.unlocked).length
  }, [stats.achievements])

  const filteredAchievements = useMemo(() => {
    if (achievementFilter === 'all') return stats.achievements
    return stats.achievements.filter((a) => a.category === achievementFilter)
  }, [stats.achievements, achievementFilter])

  // Radar Polygon Points Calculation
  const radarPoints = useMemo(() => {
    const r = stats.radar
    const values = [
      r.calculation / 100,
      r.concept / 100,
      r.algebra / 100,
      r.calculus / 100,
      r.probability / 100,
      r.consistency / 100,
    ]
    const cx = 110
    const cy = 110
    const maxRadius = 80

    return values
      .map((val, i) => {
        const angle = (Math.PI / 3) * i - Math.PI / 2
        const radius = Math.max(15, val * maxRadius)
        const x = cx + radius * Math.cos(angle)
        const y = cy + radius * Math.sin(angle)
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [stats.radar])

  // Weakest category boss
  const weakestChapter = useMemo(() => {
    const scored = chapters.filter((c) => c.attempted > 0 && c.masteryScore !== null)
    if (scored.length === 0) return chapters[0] || null
    return [...scored].sort((a, b) => (a.masteryScore || 0) - (b.masteryScore || 0))[0]
  }, [chapters])

  if (!open) return null

  return (
    <AnimatePresence>
      <div className="game-modal-overlay" onClick={onClose}>
        <motion.div
          className="game-modal-container"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="game-modal-header">
            <div className="game-header-left">
              <div className="game-level-icon">{stats.levelInfo.rankBadge}</div>
              <div>
                <div className="game-header-title-row">
                  <h3 className="game-header-title">考研数一 · 战力与成就中心</h3>
                  <span className="game-dday-badge">{countdown.isConfigured ? `距初试 ${countdown.days} 天` : '考试日期未配置'}</span>
                </div>
                <p className="game-header-subtitle">
                  Lv.{stats.levelInfo.level} {stats.levelInfo.title} · 综合战力 {stats.combatPower} CP
                </p>
              </div>
            </div>
            <div className="game-header-actions">
              <button
                className="icon-button sound-btn"
                onClick={toggleSound}
                title={soundMuted ? '开启答题音效' : '静音答题音效'}
                aria-label={soundMuted ? '开启答题音效' : '静音答题音效'}
              >
                {soundMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <button className="icon-button" onClick={onClose} title="关闭 (Esc)" aria-label="关闭战力与成就中心">
                <X size={20} />
              </button>
            </div>
          </header>

          {/* Sub Navigation Tabs */}
          <nav className="game-modal-tabs">
            <button
              className={`game-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <Swords size={15} /> 角色与战力
            </button>
            <button
              className={`game-tab-btn ${activeTab === 'quests' ? 'active' : ''}`}
              onClick={() => setActiveTab('quests')}
            >
              <Target size={15} /> 每日悬赏 ({stats.dailyQuests.filter((q) => q.completed).length}/3)
            </button>
            <button
              className={`game-tab-btn ${activeTab === 'territory' ? 'active' : ''}`}
              onClick={() => setActiveTab('territory')}
            >
              <Compass size={15} /> 23章星空图 ({territoryData.conqueredCount}/23)
            </button>
            <button
              className={`game-tab-btn ${activeTab === 'boss' ? 'active' : ''}`}
              onClick={() => setActiveTab('boss')}
            >
              <Crown size={15} /> 周末魔王战
            </button>
            <button
              className={`game-tab-btn ${activeTab === 'trophies' ? 'active' : ''}`}
              onClick={() => setActiveTab('trophies')}
            >
              <Trophy size={15} /> 勋章馆 ({unlockedCount}/{stats.achievements.length})
            </button>
            <button
              className={`game-tab-btn ${activeTab === 'loot' ? 'active' : ''}`}
              onClick={() => setActiveTab('loot')}
            >
              <Calendar size={15} /> 战利品与足迹
            </button>
          </nav>

          {/* Body Content */}
          <div className="game-modal-body">
            {/* TAB 1: 角色档案与六维战力 + 名人堂 */}
            {activeTab === 'profile' && (
              <div className="game-profile-view">
                <div className="profile-hero-card">
                  <div className="hero-avatar-box">
                    <div className="hero-avatar-badge">{stats.levelInfo.rankBadge}</div>
                    <div className="hero-level-tag">Lv.{stats.levelInfo.level}</div>
                  </div>
                  <div className="hero-info-box">
                    <div className="hero-title-row">
                      <h4>{stats.levelInfo.title}</h4>
                      <span className="hero-cp-badge">⚡ 综合战力 {stats.combatPower} CP</span>
                    </div>

                    <div className="hero-exp-bar-wrapper">
                      <div className="hero-exp-labels">
                        <span>经验进度 EXP</span>
                        <span>
                          {stats.levelInfo.currentLevelExp} / {stats.levelInfo.nextLevelExp} EXP ({stats.levelInfo.progressPct}%)
                        </span>
                      </div>
                      <div className="hero-exp-track">
                        <motion.div
                          className="hero-exp-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${stats.levelInfo.progressPct}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6D Radar and Key Stats */}
                <div className="profile-radar-split">
                  <div className="profile-radar-card">
                    <div className="radar-card-head">
                      <h6>⚡ 考研数一六维属性雷达</h6>
                      <small>基于全卷做题数据实时演进</small>
                    </div>
                    <div className="radar-chart-container">
                      <svg width="220" height="220" viewBox="0 0 220 220" className="radar-svg">
                        <polygon points="110,30 179.3,70 179.3,150 110,190 40.7,150 40.7,70" className="radar-grid ring-3" />
                        <polygon points="110,57 156.2,83 156.2,137 110,163 63.8,137 63.8,83" className="radar-grid ring-2" />
                        <polygon points="110,83 133.1,97 133.1,123 110,137 86.9,123 86.9,97" className="radar-grid ring-1" />

                        <line x1="110" y1="110" x2="110" y2="30" className="radar-axis" />
                        <line x1="110" y1="110" x2="179.3" y2="70" className="radar-axis" />
                        <line x1="110" y1="110" x2="179.3" y2="150" className="radar-axis" />
                        <line x1="110" y1="110" x2="110" y2="190" className="radar-axis" />
                        <line x1="110" y1="110" x2="40.7" y2="150" className="radar-axis" />
                        <line x1="110" y1="110" x2="40.7" y2="70" className="radar-axis" />

                        <polygon points={radarPoints} className="radar-polygon" />

                        <text x="110" y="20" textAnchor="middle" className="radar-label">计算力 {stats.radar.calculation}</text>
                        <text x="188" y="70" textAnchor="start" className="radar-label">概念力 {stats.radar.concept}</text>
                        <text x="188" y="155" textAnchor="start" className="radar-label">代数力 {stats.radar.algebra}</text>
                        <text x="110" y="205" textAnchor="middle" className="radar-label">分析力 {stats.radar.calculus}</text>
                        <text x="32" y="155" textAnchor="end" className="radar-label">概率力 {stats.radar.probability}</text>
                        <text x="32" y="70" textAnchor="end" className="radar-label">毅力值 {stats.radar.consistency}</text>
                      </svg>
                    </div>
                  </div>

                  {/* Hall of Fame / Record Stats */}
                  <div className="hof-card">
                    <div className="hof-head">
                      <h6>⚡ 个人极限破题「名人堂」</h6>
                      <small>每一次突破都在刷新历史</small>
                    </div>
                    <div className="hof-metrics">
                      <div className="hof-tile">
                        <span className="hof-lbl">⚡ 最快选择题秒杀</span>
                        <strong className="hof-val">{hallOfFame.fastestChoiceSeconds ?? 38} 秒</strong>
                      </div>
                      <div className="hof-tile">
                        <span className="hof-lbl">🔥 历史最高连胜</span>
                        <strong className="hof-val">{Math.max(stats.maxCombo, hallOfFame.maxComboStreak)} 连对</strong>
                      </div>
                      <div className="hof-tile">
                        <span className="hof-lbl">🎯 单日最高做题</span>
                        <strong className="hof-val">{Math.max(stats.todaySolved, hallOfFame.maxDailyProblems)} 题</strong>
                      </div>
                      <div className="hof-tile">
                        <span className="hof-lbl">⏱️ 单日最高专注</span>
                        <strong className="hof-val">{hallOfFame.maxDailyMinutes} 分钟</strong>
                      </div>
                    </div>
                    <div className="hof-motto">
                      <span>💬 今日锦囊：{quote.text}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: 每日悬赏任务 */}
            {activeTab === 'quests' && (
              <div className="game-quests-view">
                <div className="quests-chest-banner">
                  <div className="chest-icon-wrapper">
                    <Gift size={32} className={`chest-gift ${stats.allQuestsCompleted ? 'ready' : ''}`} />
                  </div>
                  <div className="chest-info">
                    <h5>每日黄金大宝箱</h5>
                    <p>
                      {stats.allQuestsCompleted
                        ? chestClaimed
                          ? '🎉 今日宝箱已成功开启！获得 +150 EXP 奖励'
                          : '✨ 今日所有悬赏已达成，点击右侧立即开启宝箱！'
                        : `完成今日全部 3 项悬赏任务即可开启（当前进度：${stats.dailyQuests.filter((q) => q.completed).length}/3）`}
                    </p>
                  </div>
                  <button
                    className={`chest-claim-btn ${stats.allQuestsCompleted && !chestClaimed ? 'active' : ''}`}
                    disabled={!stats.allQuestsCompleted || chestClaimed}
                    onClick={handleClaimChest}
                  >
                    {chestClaimed ? '已开启' : stats.allQuestsCompleted ? '开启宝箱 (+150 EXP)' : '未达成'}
                  </button>
                </div>

                <div className="quests-list">
                  {stats.dailyQuests.map((quest) => (
                    <div
                      key={quest.id}
                      className={`quest-card ${quest.completed ? 'completed' : ''}`}
                    >
                      <div className="quest-icon-badge">{quest.icon}</div>
                      <div className="quest-main-info">
                        <div className="quest-title-row">
                          <h6>{quest.title}</h6>
                          <span className="quest-exp-tag">+{quest.rewardExp} EXP</span>
                        </div>
                        <p className="quest-desc">{quest.desc}</p>
                        <div className="quest-progress-track">
                          <div
                            className="quest-progress-fill"
                            style={{ width: `${Math.min(100, (quest.progress / quest.maxProgress) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <div className="quest-status-col">
                        <span className="quest-ratio">
                          {quest.progress} / {quest.maxProgress}
                        </span>
                        {quest.completed ? (
                          <span className="quest-badge-done">已完成</span>
                        ) : (
                          <span className="quest-badge-todo">进行中</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: 数一 23 章知识领地星空点亮图 */}
            {activeTab === 'territory' && (
              <div className="game-territory-view">
                <div className="territory-header-summary">
                  <div className="territory-map-badge">🌌</div>
                  <div>
                    <h5>考研数一 23 章知识星空图</h5>
                    <p>
                      已征服 <b>{territoryData.conqueredCount} / 23</b> 领地（开拓率 <b>{territoryData.conquestRate}%</b>）· 掌握分达 75 分且刷满样本将点亮为金色星宿
                    </p>
                  </div>
                </div>

                <div className="territory-chapters-grid">
                  {territoryData.territories.map((t) => (
                    <div key={t.id} className={`territory-star-card ${t.status}`}>
                      <div className="star-card-top">
                        <span className="subject-tag">{t.subject}</span>
                        <span className="status-badge">
                          {t.status === 'conquered' ? '🌟 已点亮' : t.status === 'in_progress' ? '🌓 征战中' : '🌑 未探索'}
                        </span>
                      </div>
                      <h6 className="star-chapter-name">{t.name}</h6>
                      <div className="sub-chips-row">
                        {t.subSections.map((s) => (
                          <span key={s} className="sub-section-chip">{s}</span>
                        ))}
                      </div>
                      <div className="star-footer">
                        <span>掌握分 <b>{t.masteryScore}</b></span>
                        <small>样本 {t.attemptCount} 题</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: 周末错题专项 Boss 挑战关卡 */}
            {activeTab === 'boss' && (
              <div className="game-boss-view">
                {weakestChapter ? (
                  <div className="boss-card">
                    <div className="boss-banner">
                      <div className="boss-avatar">🐉</div>
                      <div className="boss-title-box">
                        <span className="boss-tag">WEEKLY SHADOW BOSS</span>
                        <h3>魔王 · {weakestChapter.name}</h3>
                        <p>该板块当前掌握分仅为 {Math.round(weakestChapter.masteryScore ?? 0)} 分，已积累 {weakestChapter.weakCount} 道薄弱错题</p>
                      </div>
                    </div>

                    <div className="boss-challenge-info">
                      <h6>⚔️ 魔王关卡挑战规则：</h6>
                      <ul>
                        <li>包含该板块 3 道核心到期错题 + 2 道同考点同题型变式题；</li>
                        <li>闭卷完成推导，全部击破后即可封印魔王，斩获 <b>+100 EXP</b> 战力大奖！</li>
                      </ul>
                    </div>

                    <div className="boss-actions">
                      <button
                        className="boss-start-btn"
                        onClick={() => {
                          onClose()
                          onStartBoss?.(weakestChapter.name)
                        }}
                      >
                        <Swords size={18} /> 开启魔王讨伐战 (5题攻坚)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="empty-boss">
                    <Shield size={32} />
                    <p>目前还没有积累足够的薄弱章节，继续保持良好的刷题节奏！</p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: 勋章馆 */}
            {activeTab === 'trophies' && (
              <div className="game-trophies-view">
                <div className="trophy-filter-bar">
                  <button
                    className={`trophy-chip ${achievementFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setAchievementFilter('all')}
                  >
                    全部 ({stats.achievements.length})
                  </button>
                  <button
                    className={`trophy-chip ${achievementFilter === 'volume' ? 'active' : ''}`}
                    onClick={() => setAchievementFilter('volume')}
                  >
                    ⚔️ 刷题战绩
                  </button>
                  <button
                    className={`trophy-chip ${achievementFilter === 'streak' ? 'active' : ''}`}
                    onClick={() => setAchievementFilter('streak')}
                  >
                    🔥 连击绝杀
                  </button>
                  <button
                    className={`trophy-chip ${achievementFilter === 'mastery' ? 'active' : ''}`}
                    onClick={() => setAchievementFilter('mastery')}
                  >
                    🏰 考点征服
                  </button>
                  <button
                    className={`trophy-chip ${achievementFilter === 'discipline' ? 'active' : ''}`}
                    onClick={() => setAchievementFilter('discipline')}
                  >
                    🛡️ 自律复仇
                  </button>
                </div>

                <div className="trophies-grid">
                  {filteredAchievements.map((ach) => (
                    <div
                      key={ach.id}
                      className={`trophy-card ${ach.unlocked ? 'unlocked' : 'locked'}`}
                    >
                      <div className="trophy-icon-wrapper">
                        <span className="trophy-emoji">{ach.icon}</span>
                        {!ach.unlocked && <Lock size={12} className="trophy-lock" />}
                      </div>
                      <div className="trophy-details">
                        <div className="trophy-title-row">
                          <h6>{ach.title}</h6>
                          {ach.unlocked ? (
                            <span className="trophy-status-tag done">已达成</span>
                          ) : (
                            <span className="trophy-status-tag progress">
                              {ach.progress}/{ach.maxProgress}
                            </span>
                          )}
                        </div>
                        <p className="trophy-desc">{ach.desc}</p>
                        <div className="trophy-req">目标: {ach.requirement}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 6: 战利品与 365 天学习足迹 */}
            {activeTab === 'loot' && (
              <div className="game-loot-view">
                <div className="loot-recap-banner">
                  <Sparkles size={28} className="loot-sparkle" />
                  <div>
                    <h5>今日战利品结算</h5>
                    <p>今日斩获 <b>+{stats.todayExp} EXP</b> 战力经验，今日完成 <b>{stats.todaySolved}</b> 道题目推导！</p>
                  </div>
                </div>

                <div className="loot-cards-grid">
                  <div className="loot-card">
                    <span className="loot-val">+{stats.todayExp}</span>
                    <span className="loot-lbl">⚡ 今日获得 EXP</span>
                  </div>
                  <div className="loot-card">
                    <span className="loot-val">{stats.todaySolved}</span>
                    <span className="loot-lbl">🎯 今日击杀题数</span>
                  </div>
                  <div className="loot-card">
                    <span className="loot-val">{stats.todayCorrect}</span>
                    <span className="loot-lbl">✅ 今日准确命中</span>
                  </div>
                  <div className="loot-card">
                    <span className="loot-val">{stats.currentStreakDays} 天</span>
                    <span className="loot-lbl">🔥 连续打卡天数</span>
                  </div>
                </div>

                <div className="yearly-footprint-box">
                  <h6>📅 学习足迹与连续奋斗墙</h6>
                  <p>连续打卡 <b>{stats.currentStreakDays}</b> 天 · 每一个方块都是通往考场胜利的坚实脚印</p>
                  <div className="footprint-grid">
                    {Array.from({ length: 70 }, (_, i) => {
                      const isRecent = i >= 70 - stats.currentStreakDays
                      return (
                        <div
                          key={i}
                          className={`footprint-cell ${isRecent ? 'active' : ''}`}
                          title={`打卡点 #${i + 1}`}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
