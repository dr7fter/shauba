import {
  Check,
  Copy,
  Cloud,
  Settings2,
  Edit3,
  Eye,
  FileDown,
  FileUp,
  Flame,
  RefreshCw,
  Share2,
  Swords,
  Trash2,
  Trophy,
  UserPlus,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  addFriendCode,
  addFriendSnapshot,
  createFriendInvitation,
  createFriendShareSnapshot,
  getSavedFriendSyncConfig,
  getSavedFriends,
  importFriendInvitation,
  loadFriendsSystemData,
  normalizeFriendCode,
  publishMyFriendSnapshot,
  saveFriendSyncConfig,
  syncFriendSnapshots,
  removeFriendById,
  saveMyCustomProfile,
} from '../data/friendsService'
import { FriendVsRadarModal } from './FriendVsRadarModal'
import { FriendPublicProfileModal } from './FriendPublicProfileModal'
import { getEloStatus, getTacticalDashboardStats, testFriendSync } from '../api'
import { getRankDescription } from '../utils'
import type { BootstrapData, EloStatus, FriendProfile, FriendSyncConfig, FriendsSystemData, TacticalDashboardData } from '../types'

type SyncPhase = 'idle' | 'publishing' | 'pulling' | 'success' | 'partial' | 'failed'

type SyncOutcome = {
  status: 'success' | 'partial' | 'failed'
  publish: 'success' | 'failed'
  pull: 'success' | 'failed'
  checked: number
  updated: number
  error?: string
}

const DEFAULT_SYNC_CONFIG: FriendSyncConfig = {
  endpoint: 'https://dav.jianguoyun.com/dav/',
  username: '',
  appPassword: '',
  folder: 'shuaba-friends',
}

function isSyncConfigReady(config: FriendSyncConfig | null | undefined): config is FriendSyncConfig {
  return Boolean(config?.endpoint.trim() && config.username.trim() && config.appPassword.trim())
}

function formatError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return String(error)
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '尚未同步'
  const elapsed = Math.max(0, Date.now() - new Date(iso).getTime())
  if (!Number.isFinite(elapsed)) return '时间未知'
  const seconds = Math.floor(elapsed / 1000)
  if (seconds < 10) return '刚刚'
  if (seconds < 60) return `${seconds} 秒前`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

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
  const [data, setData] = useState<FriendsSystemData>(() =>
    loadFriendsSystemData(tacticalData, bootstrapData, eloStatus)
  )
  const [selectedVsFriend, setSelectedVsFriend] = useState<FriendProfile | null>(null)
  const [selectedFriendForProfile, setSelectedFriendForProfile] = useState<FriendProfile | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditProfileModal, setShowEditProfileModal] = useState(false)
  const [inputFriendCode, setInputFriendCode] = useState('')
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [syncConfig, setSyncConfig] = useState<FriendSyncConfig>(() => getSavedFriendSyncConfig() ?? DEFAULT_SYNC_CONFIG)
  const [activeSyncConfig, setActiveSyncConfig] = useState<FriendSyncConfig | null>(() => getSavedFriendSyncConfig())
  const [syncing, setSyncing] = useState(false)
  const [testingSync, setTestingSync] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [syncPhase, setSyncPhase] = useState<SyncPhase>('idle')
  const [syncDetail, setSyncDetail] = useState('')
  const [syncStats, setSyncStats] = useState<{ checked: number; updated: number } | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const importFileRef = useRef<HTMLInputElement>(null)
  const dataRef = useRef(data)
  const activeSyncConfigRef = useRef<FriendSyncConfig | null>(activeSyncConfig)
  const syncBusyRef = useRef(false)
  const queuedSyncRef = useRef<{ silent: boolean } | null>(null)
  const syncConfigVersionRef = useRef(0)
  const mountedRef = useRef(true)

  // Edit My Profile state
  const [editNickname, setEditNickname] = useState(data.myProfile.nickname)
  const [editFriendCode, setEditFriendCode] = useState(data.myProfile.friendCode)
  const [editSchool, setEditSchool] = useState(data.myProfile.targetSchool)
  const [editAvatar, setEditAvatar] = useState(data.myProfile.avatar)

  useEffect(() => {
    dataRef.current = data
  }, [data])

  useEffect(() => {
    activeSyncConfigRef.current = activeSyncConfig
  }, [activeSyncConfig])

  useEffect(() => () => {
    mountedRef.current = false
  }, [])

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

  const syncConfigured = isSyncConfigReady(activeSyncConfig)

  const runSync = async (silent = false, configOverride?: FriendSyncConfig): Promise<SyncOutcome | null> => {
    if (configOverride) activeSyncConfigRef.current = configOverride
    const requestConfig = configOverride ?? activeSyncConfigRef.current
    if (!isSyncConfigReady(requestConfig)) return null
    if (syncBusyRef.current) {
      const previous = queuedSyncRef.current
      queuedSyncRef.current = { silent: previous ? previous.silent && silent : silent }
      if (!silent && mountedRef.current) setSyncDetail('当前同步尚未完成，已排队使用最新配置重试')
      return null
    }
    syncBusyRef.current = true
    setSyncing(true)
    const requestVersion = syncConfigVersionRef.current
    const isCurrentRequest = () => requestVersion === syncConfigVersionRef.current
    const outcome: SyncOutcome = {
      status: 'failed',
      publish: 'failed',
      pull: 'failed',
      checked: 0,
      updated: 0,
    }
    try {
      if (mountedRef.current && isCurrentRequest()) {
        setSyncPhase('publishing')
        setSyncStats(null)
        setSyncDetail('正在上传自己的好友数据…')
      }
      await publishMyFriendSnapshot(dataRef.current.myProfile, requestConfig)
      outcome.publish = 'success'
      if (mountedRef.current && isCurrentRequest()) {
        setSyncPhase('pulling')
        setSyncDetail('自己的数据已上传，正在拉取好友数据…')
      }
      const result = await syncFriendSnapshots(requestConfig)
      outcome.pull = 'success'
      outcome.checked = result.checked
      outcome.updated = result.updated
      outcome.status = 'success'
      if (mountedRef.current && isCurrentRequest()) {
        setData((prev) => ({ ...prev, friends: getSavedFriends() }))
        setLastSyncAt(new Date().toISOString())
        setSyncStats({ checked: result.checked, updated: result.updated })
        setSyncPhase('success')
        setSyncDetail(`上传成功 · 拉取检查 ${result.checked} 位，更新 ${result.updated} 位`)
        if (!silent) notify(`坚果云同步完成：上传成功，检查 ${result.checked} 位好友，更新 ${result.updated} 位`)
      }
      return outcome
    } catch (error) {
      const message = formatError(error)
      outcome.error = message
      if (outcome.publish === 'success') {
        outcome.status = 'partial'
        if (mountedRef.current && isCurrentRequest()) {
          setLastSyncAt(new Date().toISOString())
          setSyncPhase('partial')
          setSyncDetail(`自己的数据已上传，但拉取好友数据失败：${message}`)
          if (!silent) notify(`部分同步：自己的数据已上传，但拉取好友数据失败：${message}`)
        }
      } else if (mountedRef.current && isCurrentRequest()) {
        setSyncPhase('failed')
        setSyncDetail(`上传自己的数据失败：${message}`)
        if (!silent) notify(`坚果云同步失败：上传自己的数据失败：${message}`)
      }
      return outcome
    } finally {
      syncBusyRef.current = false
      const queued = queuedSyncRef.current
      queuedSyncRef.current = null
      if (queued && isSyncConfigReady(activeSyncConfigRef.current)) {
        window.setTimeout(() => void runSync(queued.silent), 0)
      } else if (mountedRef.current) {
        setSyncing(false)
      }
    }
  }

  const runSyncRef = useRef(runSync)
  runSyncRef.current = runSync

  useEffect(() => {
    if (!syncConfigured) return
    let cancelled = false
    const syncWhenVisible = () => {
      if (!cancelled && document.visibilityState === 'visible') void runSyncRef.current(true)
    }
    syncWhenVisible()
    const timer = window.setInterval(syncWhenVisible, 60_000)
    document.addEventListener('visibilitychange', syncWhenVisible)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', syncWhenVisible)
    }
  }, [activeSyncConfig, syncConfigured])

  // Sort combined ladder roster by Elo descending
  const sortedRoster = useMemo(() => {
    const combined = [data.myProfile, ...data.friends]
    return combined.sort((a, b) => b.currentElo - a.currentElo)
  }, [data.myProfile, data.friends])

  const copyText = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return true
      }
    } catch {
      // Fall through to the legacy textarea fallback used by older WebView environments.
    }
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand('copy')
      textarea.remove()
      return copied
    } catch {
      return false
    }
  }

  const handleCopyMyCode = async () => {
    const copied = await copyText(data.myProfile.friendCode)
    if (!copied) {
      setCopiedCode(false)
      notify(`复制好友码失败，请手动复制：${data.myProfile.friendCode}`)
      return
    }
    setCopiedCode(true)
    notify(`专属好友码 ${data.myProfile.friendCode} 已复制到剪贴板！`)
    window.setTimeout(() => setCopiedCode(false), 2000)
  }

  const handleExportSnapshot = async () => {
    const payload = createFriendShareSnapshot(data.myProfile)
    try {
      const blob = new Blob([payload], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `shuaba-friend-${data.myProfile.friendCode}.json`
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
    } catch (error) {
      notify(`好友卡片导出失败：${formatError(error)}`)
      return
    }
    if (!syncConfigured) {
      notify('好友卡片已导出，把这个 JSON 文件发给你的朋友即可')
      return
    }
    notify('好友卡片已导出本地，正在上传到坚果云…')
    const outcome = await runSync(false, activeSyncConfigRef.current ?? undefined)
    if (!outcome) notify('本地导出成功；云端同步正在进行，完成后会更新状态')
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
      void runSync(false, activeSyncConfigRef.current ?? undefined).finally(() => setRefreshing(false))
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
      notify('请输入好友码，或粘贴朋友导出的 JSON / 好友邀请')
      return
    }
    if (text.includes('"kind": "shuaba-friend-invitation"') || text.includes('"kind":"shuaba-friend-invitation"')) {
      const inv = importFriendInvitation(text)
      notify(inv.message)
      if (inv.success) {
        if (inv.config) {
          setSyncConfig((prev) => ({ ...prev, ...inv.config }))
        }
        setData(loadFriendsSystemData(tacticalData, bootstrapData, eloStatus))
        setInputFriendCode('')
        setShowAddModal(false)
        if (syncConfigured) void runSync(false, activeSyncConfigRef.current ?? undefined)
      }
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
      if (syncConfigured) void runSync(false, activeSyncConfigRef.current ?? undefined)
    }
  }

  const handleCopyInvitation = () => {
    if (!isSyncConfigReady(syncConfig)) {
      notify('请先配置好坚果云 WebDAV 共享文件夹再生成邀请')
      return
    }
    const json = createFriendInvitation(syncConfig)
    void navigator.clipboard.writeText(json)
    notify('好友邀请配置已复制到剪贴板！发送给好友，对方直接导入即可自动绑定')
  }

  const handleSaveSyncConfig = () => {
    if (!syncConfig.endpoint.trim() || !syncConfig.username.trim() || !syncConfig.appPassword.trim()) {
      notify('请填写 WebDAV 地址、账号和应用密码')
      return
    }
    const normalized = {
      ...syncConfig,
      endpoint: syncConfig.endpoint.trim(),
      username: syncConfig.username.trim(),
      folder: syncConfig.folder.trim() || 'shuaba-friends',
    }
    saveFriendSyncConfig(normalized)
    activeSyncConfigRef.current = normalized
    syncConfigVersionRef.current += 1
    setActiveSyncConfig(normalized)
    setSyncConfig(normalized)
    setShowSyncModal(false)
    notify('坚果云同步已保存；应用会在后台每 60 秒安静同步一次')
  }

  const handleTestSync = () => {
    if (syncBusyRef.current) {
      notify('当前同步正在进行，请等待完成后再测试连接')
      return
    }
    const config = {
      ...syncConfig,
      endpoint: syncConfig.endpoint.trim(),
      username: syncConfig.username.trim(),
      folder: syncConfig.folder.trim() || 'shuaba-friends',
    }
    if (!isSyncConfigReady(config)) {
      notify('请先填写 WebDAV 地址、账号和应用密码')
      return
    }
    setTestingSync(true)
    void testFriendSync(config)
      .then((message) => notify(message))
      .catch((error) => notify(`连接测试失败：${formatError(error)}`))
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
    const rawCode = editFriendCode.trim()
    if (!rawCode) {
      notify('好友码不能为空')
      return
    }
    const customCode = normalizeFriendCode(rawCode)
    if (!customCode) {
      notify('好友码格式不正确')
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

  const syncStatusTitle = {
    idle: syncConfigured ? '已配置，等待同步' : '未配置坚果云同步',
    publishing: '正在上传自己的数据',
    pulling: '正在拉取好友数据',
    success: '同步完成',
    partial: '部分同步成功',
    failed: '同步失败',
  }[syncPhase]
  const showSyncStatus = syncConfigured || syncPhase !== 'idle' || Boolean(lastSyncAt)
  const canRetrySync = syncConfigured && !syncing && (syncPhase === 'failed' || syncPhase === 'partial')

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
            好友主动分享的数据快照 · 只展示汇总数据，不暴露题目明细 · 共 {data.friends.length + 1} 位选手{lastSyncAt ? ` · 最近同步 ${formatRelativeTime(lastSyncAt)}` : ''}
          </p>
          {showSyncStatus && (
            <div className={`friend-sync-status ${syncPhase}`} role="status">
              <div className="friend-sync-status-main">
                {syncPhase === 'publishing' || syncPhase === 'pulling' || syncing ? (
                  <RefreshCw size={14} className="spin" />
                ) : syncPhase === 'success' ? (
                  <Check size={14} />
                ) : (
                  <Cloud size={14} />
                )}
                <div>
                  <strong>{syncStatusTitle}</strong>
                  <span>{syncDetail || `最近同步：${formatRelativeTime(lastSyncAt)}`}</span>
                </div>
              </div>
              <div className="friend-sync-status-meta">
                {syncStats && <small>检查 {syncStats.checked} 位 · 更新 {syncStats.updated} 位</small>}
                {canRetrySync && (
                  <button
                    className="friend-sync-retry-btn"
                    onClick={() => void runSync(false, activeSyncConfigRef.current ?? undefined)}
                  >
                    重试
                  </button>
                )}
              </div>
            </div>
          )}
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
                <div
                  className={`col-player ${player.isSelf ? '' : 'clickable-player'}`}
                  onClick={() => !player.isSelf && setSelectedFriendForProfile(player)}
                  title={player.isSelf ? undefined : '点击查看好友公开数据与比赛战报'}
                >
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
                  <span
                    className={`ladder-tier-badge ${getTierClass(player.rankLetter)}`}
                    title={getRankDescription(player.currentElo)}
                  >
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
                        className="view-profile-btn"
                        onClick={() => setSelectedFriendForProfile(player)}
                        title="查看好友公开数据与战报"
                      >
                        <Eye size={13} /> 数据
                      </button>
                      <button
                        className="vs-battle-btn"
                        onClick={() => setSelectedVsFriend(player)}
                        title="发起 1v1 战力对决"
                      >
                        <Swords size={13} /> 对决
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

      {/* Friend Public Profile Modal */}
      {selectedFriendForProfile && (
        <FriendPublicProfileModal
          friend={selectedFriendForProfile}
          activities={data.activities}
          onClose={() => setSelectedFriendForProfile(null)}
          onOpenVsRadar={(f) => setSelectedVsFriend(f)}
          onRemoveFriend={(id) => {
            const next = removeFriendById(id)
            setData((prev) => ({ ...prev, friends: next }))
            notify('已删除好友并屏蔽同步')
          }}
        />
      )}

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
                <small className="form-field-help">请先在坚果云网页端创建并共享这个文件夹，再只填云端文件夹名，例如 <code>shuaba-friends</code>；不要填 <code>E:\刷吧</code>、本地路径或完整网址。</small>
              </div>
              <p className="sync-help-text">你和朋友需要对同一个共享文件夹有读写权限；朋友只需首次配置一次，之后刷题时无需手动导出。</p>
            </div>
            <div className="modal-footer">
              <button className="secondary-button compact" onClick={handleTestSync} disabled={testingSync || syncing}>
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
                输入好友码即可先建立关注；配置坚果云后会自动拉取，或者直接粘贴朋友发来的 JSON 或邀请码（无需手动配置繁琐参数）。
              </p>
              <div className="input-with-button-row">
                <textarea
                  className="friend-snapshot-input"
                  placeholder="好友码（如 SB-A1234），或粘贴 shuaba-friend-*.json / 好友邀请内容"
                  value={inputFriendCode}
                  onChange={(e) => setInputFriendCode(e.target.value)}
                  autoFocus
                  rows={5}
                />
                <input
                  ref={importFileRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={handleImportFile}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button className="secondary-button compact" onClick={() => importFileRef.current?.click()}>
                    <FileUp size={14} /> 选择好友 JSON 文件
                  </button>
                  <button className="secondary-button compact" onClick={handleCopyInvitation} title="生成我的 WebDAV 邀请配置，发给好友一键导入">
                    <Share2 size={14} /> 复制我的好友邀请
                  </button>
                </div>
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
