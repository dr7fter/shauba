import {
  Check,
  Copy,
  Edit3,
  Flame,
  RefreshCw,
  Swords,
  Trash2,
  Trophy,
  UserPlus,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  addFriendByCode,
  loadFriendsSystemData,
  removeFriendById,
  saveMyCustomProfile,
} from '../data/friendsService'
import { FriendVsRadarModal } from './FriendVsRadarModal'
import type { BootstrapData, EloStatus, FriendProfile, TacticalDashboardData } from '../types'

export function FriendsLadderView({
  tacticalData,
  bootstrapData,
  eloStatus,
  notify,
}: {
  tacticalData: TacticalDashboardData | null
  bootstrapData: BootstrapData | null
  eloStatus: EloStatus | null
  notify: (msg: string) => void
}) {
  const [data, setData] = useState(() =>
    loadFriendsSystemData(tacticalData, bootstrapData, eloStatus)
  )
  const [selectedVsFriend, setSelectedVsFriend] = useState<FriendProfile | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditProfileModal, setShowEditProfileModal] = useState(false)
  const [inputFriendCode, setInputFriendCode] = useState('')
  const [copiedCode, setCopiedCode] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Edit My Profile state
  const [editNickname, setEditNickname] = useState(data.myProfile.nickname)
  const [editSchool, setEditSchool] = useState(data.myProfile.targetSchool)
  const [editAvatar, setEditAvatar] = useState(data.myProfile.avatar)

  // Sort combined ladder roster by Elo descending
  const sortedRoster = useMemo(() => {
    const combined = [data.myProfile, ...data.friends]
    return combined.sort((a, b) => b.currentElo - a.currentElo)
  }, [data.myProfile, data.friends])

  const handleCopyMyCode = () => {
    void navigator.clipboard.writeText(data.myProfile.friendCode)
    setCopiedCode(true)
    notify(`专属好友码 ${data.myProfile.friendCode} 已复制到剪贴板！`)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => {
      setData(loadFriendsSystemData(tacticalData, bootstrapData, eloStatus))
      setRefreshing(false)
      notify('好友在线状态与战报已同步！')
    }, 400)
  }

  const handleAddFriend = () => {
    if (!inputFriendCode.trim()) {
      notify('请输入有效的好友码')
      return
    }
    const res = addFriendByCode(inputFriendCode)
    notify(res.message)
    if (res.success) {
      setData(loadFriendsSystemData(tacticalData, bootstrapData, eloStatus))
      setInputFriendCode('')
      setShowAddModal(false)
    }
  }

  const handleRemoveFriend = (id: string, name: string) => {
    const updated = removeFriendById(id)
    setData((prev) => ({ ...prev, friends: updated }))
    notify(`已移除好友「${name}」`)
  }

  const handleSaveProfile = () => {
    if (!editNickname.trim()) {
      notify('昵称不能为空')
      return
    }
    saveMyCustomProfile({
      nickname: editNickname.trim(),
      targetSchool: editSchool.trim(),
      avatar: editAvatar,
    })
    setData(loadFriendsSystemData(tacticalData, bootstrapData, eloStatus))
    setShowEditProfileModal(false)
    notify('个人战术名片已更新！')
  }

  const getRankEmblem = (index: number) => {
    if (index === 0) return <span className="rank-badge gold">👑 1</span>
    if (index === 1) return <span className="rank-badge silver">🥈 2</span>
    if (index === 2) return <span className="rank-badge bronze">🥉 3</span>
    return <span className="rank-badge default">{index + 1}</span>
  }

  const getStatusBadge = (status: FriendProfile['status'], activity?: string) => {
    if (status === 'in_match') {
      return (
        <span className="live-status-pill in-match" title={activity}>
          <span className="live-pulse-dot match" /> 高压模考中
        </span>
      )
    }
    if (status === 'online') {
      return (
        <span className="live-status-pill online" title={activity}>
          <span className="live-pulse-dot online" /> 在线刷题
        </span>
      )
    }
    return (
      <span className="live-status-pill offline" title={activity}>
        <span className="live-pulse-dot offline" /> 离线
      </span>
    )
  }

  const getTierClass = (letter: string) => {
    if (letter === 'DONK' || letter.includes('👑')) return 'donk-tier'
    if (letter.startsWith('S')) return 's-tier'
    if (letter.startsWith('A')) return 'a-tier'
    return 'b-tier'
  }

  return (
    <div className="friends-ladder-view">
      {/* Top Banner & Control Bar */}
      <div className="friends-header-bar">
        <div className="friends-title-box">
          <div className="title-row">
            <span className="trophy-gold-icon">
              <Trophy size={20} />
            </span>
            <h2>完美对战平台 · 数一天梯好友榜</h2>
          </div>
          <p>
            2026S2 赛季实时排位 · 考场 150 预估分对决 · 共 {data.friends.length + 1} 位选手在榜
          </p>
        </div>

        <div className="friends-header-actions">
          <button className="secondary-button compact" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            刷新动态
          </button>
          <button className="secondary-button compact" onClick={handleCopyMyCode}>
            {copiedCode ? <Check size={14} /> : <Copy size={14} />}
            {copiedCode ? '已复制好友码' : '我的好友码'}
          </button>
          <button className="primary-button compact" onClick={() => setShowAddModal(true)}>
            <UserPlus size={14} />
            添加好友
          </button>
        </div>
      </div>

      {/* Main Grid: Left Ladder Table, Right Sidebar */}
      <div className="friends-main-grid">
        {/* Left: Ladder Table */}
        <div className="friends-ladder-card">
          <div className="ladder-table-header">
            <div className="col-rank">排名</div>
            <div className="col-player">战术选手</div>
            <div className="col-elo">天梯 Elo</div>
            <div className="col-tier">段位</div>
            <div className="col-rating">Rating 3.0</div>
            <div className="col-exam">考场预估</div>
            <div className="col-problems">今日作答</div>
            <div className="col-status">实时状态</div>
            <div className="col-actions">对决</div>
          </div>

          <div className="ladder-table-body">
            {sortedRoster.map((player, index) => (
              <div
                key={player.id}
                className={`ladder-row ${player.isSelf ? 'is-self-row' : ''}`}
              >
                <div className="col-rank">{getRankEmblem(index)}</div>

                <div className="col-player">
                  <span className="player-avatar-circle">{player.avatar}</span>
                  <div className="player-meta-info">
                    <div className="player-name-row">
                      <strong className="player-nickname">{player.nickname}</strong>
                      {player.isSelf && <span className="self-tag">YOU (我)</span>}
                    </div>
                    <span className="player-school-sub">{player.targetSchool}</span>
                  </div>
                </div>

                <div className="col-elo">
                  <strong className="elo-value">{player.currentElo}</strong>
                  {player.eloChangeToday !== undefined && player.eloChangeToday !== 0 && (
                    <span
                      className={`elo-delta-tag ${player.eloChangeToday > 0 ? 'plus' : 'minus'}`}
                    >
                      {player.eloChangeToday > 0
                        ? `+${player.eloChangeToday}`
                        : player.eloChangeToday}
                    </span>
                  )}
                </div>

                <div className="col-tier">
                  <span className={`ladder-tier-badge ${getTierClass(player.rankLetter)}`}>
                    {player.rankLetter === 'DONK' ? '👑 DONK' : player.rankLetter}
                  </span>
                </div>

                <div className="col-rating">
                  <strong
                    className={`rating-val ${
                      player.ratingPro >= 1.4
                        ? 'gold'
                        : player.ratingPro >= 1.2
                        ? 'cyan'
                        : 'green'
                    }`}
                  >
                    {player.ratingPro.toFixed(2)}
                  </strong>
                </div>

                <div className="col-exam">
                  <span className="exam-score-pill">{player.predictedExamScore} 分</span>
                </div>

                <div className="col-problems">
                  <span className="problems-count">{player.todayProblems} 题</span>
                </div>

                <div className="col-status">
                  {getStatusBadge(player.status, player.currentActivity)}
                </div>

                <div className="col-actions">
                  {player.isSelf ? (
                    <button
                      className="edit-my-card-btn"
                      onClick={() => setShowEditProfileModal(true)}
                      title="编辑我的名片"
                    >
                      <Edit3 size={14} />
                    </button>
                  ) : (
                    <div className="action-buttons-group">
                      <button
                        className="vs-battle-btn"
                        onClick={() => setSelectedVsFriend(player)}
                        title="发起 1v1 战力对决"
                      >
                        <Swords size={14} /> 对决
                      </button>
                      <button
                        className="remove-friend-btn"
                        onClick={() => handleRemoveFriend(player.id, player.nickname)}
                        title="删除好友"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar: My Tactical Profile & Activity Feed */}
        <div className="friends-sidebar">
          {/* My Profile Card */}
          <div className="my-tactical-profile-card">
            <div className="my-card-header">
              <span className="my-card-avatar">{data.myProfile.avatar}</span>
              <div className="my-card-info">
                <div className="my-card-name-row">
                  <strong>{data.myProfile.nickname}</strong>
                  <button
                    className="edit-profile-icon-btn"
                    onClick={() => setShowEditProfileModal(true)}
                  >
                    <Edit3 size={13} />
                  </button>
                </div>
                <span className="my-school-badge">{data.myProfile.targetSchool}</span>
              </div>
            </div>

            <div className="my-friend-code-box" onClick={handleCopyMyCode}>
              <div className="code-info">
                <span>专属好友码</span>
                <strong>{data.myProfile.friendCode}</strong>
              </div>
              <button className="copy-code-btn">
                {copiedCode ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>

            <div className="my-stats-grid">
              <div className="my-stat-box">
                <span>天梯 Elo</span>
                <strong>{data.myProfile.currentElo}</strong>
              </div>
              <div className="my-stat-box">
                <span>Rating 3.0</span>
                <strong className="accent-green">{data.myProfile.ratingPro.toFixed(2)}</strong>
              </div>
              <div className="my-stat-box">
                <span>考场预估分</span>
                <strong className="accent-cyan">{data.myProfile.predictedExamScore}</strong>
              </div>
              <div className="my-stat-box">
                <span>今日刷题</span>
                <strong>{data.myProfile.todayProblems} 题</strong>
              </div>
            </div>
          </div>

          {/* Activity Live Feed */}
          <div className="friends-activity-feed-card">
            <div className="feed-header">
              <div className="feed-title-row">
                <Flame size={16} className="accent-gold" />
                <strong>好友战术高光动态</strong>
              </div>
              <span className="live-dot-ticker" />
            </div>

            <div className="feed-list">
              {data.activities.map((act) => (
                <div key={act.id} className="feed-item">
                  <div className="feed-avatar">{act.avatar}</div>
                  <div className="feed-content-wrapper">
                    <div className="feed-top-line">
                      <strong className="feed-player-name">{act.nickname}</strong>
                      <span className="feed-time">{act.timestamp}</span>
                    </div>
                    <div className="feed-event-title">{act.title}</div>
                    <p className="feed-event-desc">{act.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 1v1 Head-to-Head VS Battle Modal */}
      {selectedVsFriend && (
        <FriendVsRadarModal
          myProfile={data.myProfile}
          friend={selectedVsFriend}
          onClose={() => setSelectedVsFriend(null)}
        />
      )}

      {/* Add Friend Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal add-friend-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ 添加战术好友</h2>
              <button className="icon-button" onClick={() => setShowAddModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--muted)', marginBottom: '14px' }}>
                输入研友发给你的专属好友码（例如 <code>SHUABA-8891</code>），即可实时同步好友的天梯排位与战术雷达！
              </p>
              <div className="input-with-button-row">
                <input
                  type="text"
                  className="friend-code-input"
                  placeholder="例如: SHUABA-8891"
                  value={inputFriendCode}
                  onChange={(e) => setInputFriendCode(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-button compact" onClick={() => setShowAddModal(false)}>
                取消
              </button>
              <button className="primary-button compact" onClick={handleAddFriend}>
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit My Profile Modal */}
      {showEditProfileModal && (
        <div className="modal-backdrop" onClick={() => setShowEditProfileModal(false)}>
          <div className="modal edit-profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🎨 自定义我的战术名片</h2>
              <button className="icon-button" onClick={() => setShowEditProfileModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-field-group">
                <label>战术头像徽章</label>
                <div className="avatar-options-row">
                  {['🚀', '👑', '⚡', '🎓', '🎯', '🔥', '🦁', '🌟'].map((em) => (
                    <button
                      key={em}
                      className={`avatar-option-btn ${editAvatar === em ? 'selected' : ''}`}
                      onClick={() => setEditAvatar(em)}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-field-group">
                <label>战术昵称</label>
                <input
                  type="text"
                  className="profile-text-input"
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  placeholder="例如: dr7fter"
                />
              </div>

              <div className="form-field-group">
                <label>目标院校与专业</label>
                <input
                  type="text"
                  className="profile-text-input"
                  value={editSchool}
                  onChange={(e) => setEditSchool(e.target.value)}
                  placeholder="例如: 清华大学 · 自动化"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="secondary-button compact"
                onClick={() => setShowEditProfileModal(false)}
              >
                取消
              </button>
              <button className="primary-button compact" onClick={handleSaveProfile}>
                保存名片
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
