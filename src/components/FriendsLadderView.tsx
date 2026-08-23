import {
  Check,
  Copy,
  Cloud,
  Settings2,
  Edit3,
  FileDown,
  FileUp,
  Flame,
  RefreshCw,
  Swords,
  Trash2,
  Trophy,
  UserPlus,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  addFriendCode,
  addFriendSnapshot,
  createFriendShareSnapshot,
  getSavedFriendSyncConfig,
  getSavedFriends,
  loadFriendsSystemData,
  publishMyFriendSnapshot,
  saveFriendSyncConfig,
  syncFriendSnapshots,
  removeFriendById,
  saveMyCustomProfile,
} from '../data/friendsService'
import { FriendVsRadarModal } from './FriendVsRadarModal'
import { getEloStatus, getTacticalDashboardStats, testFriendSync } from '../api'
import type { BootstrapData, EloStatus, FriendProfile, FriendSyncConfig, TacticalDashboardData } from '../types'

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
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [syncConfig, setSyncConfig] = useState<FriendSyncConfig>(() => getSavedFriendSyncConfig() ?? {
    endpoint: 'https://dav.jianguoyun.com/dav/',
    username: '',
    appPassword: '',
    folder: 'shuaba-friends',
  })
  const [syncing, setSyncing] = useState(false)
  const [testingSync, setTestingSync] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const importFileRef = useRef<HTMLInputElement>(null)
  const dataRef = useRef(data)
  const syncBusyRef = useRef(false)

  // Edit My Profile state
  const [editNickname, setEditNickname] = useState(data.myProfile.nickname)
  const [editFriendCode, setEditFriendCode] = useState(data.myProfile.friendCode)
  const [editSchool, setEditSchool] = useState(data.myProfile.targetSchool)
  const [editAvatar, setEditAvatar] = useState(data.myProfile.avatar)

  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    let cancelled = false
    void Promise.all([getTacticalDashboardStats(), getEloStatus()])
      .then(([nextTacticalData, nextEloStatus]) => {
        if (!cancelled) setData(loadFriendsSystemData(nextTacticalData, bootstrapData, nextEloStatus))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [bootstrapData])

  const syncConfigured = Boolean(
    syncConfig.endpoint.trim() && syncConfig.username.trim() && syncConfig.appPassword.trim(),
  )

  const runSync = async (silent = false) => {
    if (!syncConfigured || syncBusyRef.current) return
    syncBusyRef.current = true
    if (!silent) setSyncing(true)
    try {
      await publishMyFriendSnapshot(dataRef.current.myProfile, syncConfig)
      const result = await syncFriendSnapshots(syncConfig)
      setData((prev) => ({ ...prev, friends: getSavedFriends() }))
      const now = new Date().toISOString()
      setLastSyncAt(now)
      if (!silent) notify(`坚果云已同步：更新 ${result.updated} 位好友`)
    } catch (error) {
      if (!silent) notify(`坚果云同步失败：${String(error)}`)
    } finally {
      syncBusyRef.current = false
      if (!silent) setSyncing(false)
    }
  }

  useEffect(() => {
    if (!syncConfigured) return
    let cancelled = false
    const syncWhenVisible = () => {
      if (!cancelled && document.visibilityState === 'visible') void runSync(true)
    }
    syncWhenVisible()
    const timer = window.setInterval(syncWhenVisible, 60_000)
    document.addEventListener('visibilitychange', syncWhenVisible)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', syncWhenVisible)
    }
  }, [syncConfig])

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

  const handleExportSnapshot = () => {
    if (syncConfigured) void publishMyFriendSnapshot(data.myProfile, syncConfig).catch(() => undefined)
    const blob = new Blob([createFriendShareSnapshot(data.myProfile)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `shuaba-friend-${data.myProfile.friendCode}.json`
    link.click()
    URL.revokeObjectURL(url)
    notify('好友卡片已导出，把这个 JSON 文件发给你的朋友即可')
  }

  const handleImportSnapshot = (raw: string) => {
    const result = addFriendSnapshot(raw)
    notify(result.message)
    if (result.success) {
      setData(loadFriendsSystemData(tacticalData, bootstrapData, eloStatus))
      setInputFriendCode('')
      setShowAddModal(false)
    }
  }

  const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    void file.text().then(handleImportSnapshot)
  }

  const handleRefresh = () => {
    setRefreshing(true)
    if (syncConfigured) {
      void runSync(false).finally(() => setRefreshing(false))
      return
    }
    window.setTimeout(() => {
      setData(loadFriendsSystemData(tacticalData, bootstrapData, eloStatus))
      setRefreshing(false)
      notify('好友列表已刷新（本地数据）')
    }, 120)
  }

  const handleAddFriend = () => {
    const text = inputFriendCode.trim()
    if (!text) {
      notify('请输入好友码，或粘贴朋友导出的 JSON')
      return
    }
    if (text.startsWith('{')) {
      handleImportSnapshot(text)
      return
    }
    const result = addFriendCode(text)
    notify(result.message)
    if (result.success) {
      setData(loadFriendsSystemData(tacticalData, bootstrapData, eloStatus))
      setInputFriendCode('')
      setShowAddModal(false)
      if (syncConfigured) void runSync(false)
    }
  }

  const handleSaveSyncConfig = () => {
    if (!syncConfig.endpoint.trim() || !syncConfig.username.trim() || !syncConfig.appPassword.trim()) {
      notify('请填写 WebDAV 地址、账号和应用密码')
      return
    }
    const normalized = { ...syncConfig, endpoint: syncConfig.endpoint.trim(), folder: syncConfig.folder.trim() || 'shuaba-friends' }
    saveFriendSyncConfig(normalized)
    setSyncConfig(normalized)
    setShowSyncModal(false)
    notify('坚果云同步已保存；应用会在后台每 60 秒安静同步一次')
    void runSync(false)
  }

  const handleTestSync = () => {
    setTestingSync(true)
    void testFriendSync(syncConfig)
      .then((message) => notify(message))
      .catch((error) => notify(`连接测试失败：${String(error)}`))
      .finally(() => setTestingSync(false))
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
    const customCode = editFriendCode.trim().toUpperCase()
    if (!customCode) {
      notify('好友码不能为空')
      return
    }
    saveMyCustomProfile({
      nickname: editNickname.trim(),
      friendCode: customCode,
      targetSchool: editSchool.trim(),
      avatar: editAvatar,
    })
    setData(loadFriendsSystemData(tacticalData, bootstrapData, eloStatus))
    setShowEditProfileModal(false)
    notify(`个人战术名片已更新！专属好友码：${customCode}`)
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
          <span className="live-pulse-dot match" /> 快照：高压模考
        </span>
      )
    }
    if (status === 'online') {
      return (
        <span className="live-status-pill online" title={activity}>
          <span className="live-pulse-dot online" /> 快照：刷题中
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
            <h2>好友数据看板</h2>
          </div>
          <p>
            好友主动分享的数据快照 · 只展示汇总数据，不暴露题目明细 · 共 {data.friends.length + 1} 位选手{lastSyncAt ? ` · 上次同步 ${new Date(lastSyncAt).toLocaleTimeString()}` : ""}
          </p>
        </div>

        <div className="friends-header-actions">
          <button className="secondary-button compact" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            刷新本地列表
          </button>
          <button className="secondary-button compact" onClick={() => setShowSyncModal(true)}>
            {syncing ? <RefreshCw size={14} className="spin" /> : <Cloud size={14} />}
            {syncConfigured ? '坚果云同步' : '设置自动同步'}
          </button>
          <button className="secondary-button compact" onClick={handleCopyMyCode}>
            {copiedCode ? <Check size={14} /> : <Copy size={14} />}
            {copiedCode ? '已复制好友码' : '我的好友码'}
          </button>
          <button className="secondary-button compact" onClick={handleExportSnapshot}>
            <FileDown size={14} /> 导出我的数据
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
            {sortedRoster.length === 1 && (
              <div className="friends-empty-row">
                还没有好友数据。点击「导出我的数据」发给朋友，也可以导入朋友发来的好友 JSON 文件。
              </div>
            )}
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
                <strong>好友最近动态（来自快照）</strong>
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

      {/* Nutstore WebDAV Sync Modal */}
      {showSyncModal && (
        <div className="modal-backdrop" onClick={() => setShowSyncModal(false)}>
          <div className="modal friend-sync-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Settings2 size={18} /> 坚果云自动同步</h2>
              <button className="icon-button" onClick={() => setShowSyncModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="sync-help-text">
                只同步好友公开汇总 JSON，不上传题目、草稿或数据库。配置一次后，打开好友页立即同步，后台每 60 秒检查一次，不会阻塞刷题。
              </p>
              <div className="form-field-group">
                <label>WebDAV 地址</label>
                <input className="profile-text-input" value={syncConfig.endpoint} onChange={(e) => setSyncConfig((prev) => ({ ...prev, endpoint: e.target.value }))} placeholder="https://dav.jianguoyun.com/dav/" />
              </div>
              <div className="form-field-group">
                <label>坚果云账号</label>
                <input className="profile-text-input" value={syncConfig.username} onChange={(e) => setSyncConfig((prev) => ({ ...prev, username: e.target.value }))} placeholder="邮箱账号" autoComplete="username" />
              </div>
              <div className="form-field-group">
                <label>应用密码（不要填网页登录密码）</label>
                <input className="profile-text-input" type="password" value={syncConfig.appPassword} onChange={(e) => setSyncConfig((prev) => ({ ...prev, appPassword: e.target.value }))} placeholder="坚果云安全设置中生成的应用密码" autoComplete="current-password" />
              </div>
              <div className="form-field-group">
                <label>共享文件夹路径</label>
                <input className="profile-text-input" value={syncConfig.folder} onChange={(e) => setSyncConfig((prev) => ({ ...prev, folder: e.target.value }))} placeholder="shuaba-friends" />
              </div>
              <p className="sync-help-text">你和朋友需要对同一个共享文件夹有读写权限；朋友只需首次配置一次，之后刷题时无需手动导出。</p>
            </div>
            <div className="modal-footer">
              <button className="secondary-button compact" onClick={handleTestSync} disabled={testingSync}>
                <Cloud size={14} /> {testingSync ? '测试中…' : '测试连接'}
              </button>
              <button className="secondary-button compact" onClick={() => setShowSyncModal(false)}>取消</button>
              <button className="primary-button compact" onClick={handleSaveSyncConfig}>保存并同步</button>
            </div>
          </div>
        </div>
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
                输入好友码即可先建立关注；配置坚果云后会自动拉取，或者直接粘贴朋友导出的 JSON（无需朋友配置坚果云）。
              </p>
              <div className="input-with-button-row">
                <textarea
                  className="friend-snapshot-input"
                  placeholder="好友码（如 SB-A1234），或粘贴 shuaba-friend-*.json 内容"
                  value={inputFriendCode}
                  onChange={(e) => setInputFriendCode(e.target.value)}
                  autoFocus
                  rows={6}
                />
                <input
                  ref={importFileRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={handleImportFile}
                />
                <button className="secondary-button compact" onClick={() => importFileRef.current?.click()}>
                  <FileUp size={14} /> 选择好友 JSON 文件
                </button>
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
                <label>专属好友码 (可自定义)</label>
                <input
                  type="text"
                  className="profile-text-input"
                  value={editFriendCode}
                  onChange={(e) => setEditFriendCode(e.target.value)}
                  placeholder="例如: SB-9527 或 KAYAN-2026"
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
