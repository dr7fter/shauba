import { Archive, LoaderCircle, RefreshCw, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  advanceSeason,
  getLibraryPath,
  exportRecords,
  getSeasonStatus,
  listDatabaseBackups,
  restoreDatabaseBackup,
  saveGoal,
  saveReviewIntervals,
  setLibraryPath,
  checkAppUpdate,
  getAppVersion,
  getUserProfile,
  setUserProfile,
} from '../api'
import { isAudioMuted, setAudioMuted } from '../data/audio'
import { UpdateModal } from '../components/UpdateModal'
import type { BackupInfo, BootstrapData, SeasonStatus, AppUpdateInfo, UserProfileSettings } from '../types'

export function SettingsView({
  data,
  refresh,
  theme,
  onThemeChange,
  fontScale,
  onFontScaleChange,
  reducedMotion,
  onReducedMotionChange,
  notify,
  onOpenHelp,
}: {
  data: BootstrapData
  refresh: () => void
  theme: 'light' | 'warm'
  onThemeChange: (t: 'light' | 'warm') => void
  fontScale: 'standard' | 'medium' | 'large'
  onFontScaleChange: (f: 'standard' | 'medium' | 'large') => void
  reducedMotion: boolean
  onReducedMotionChange: (r: boolean) => void
  notify: (s: string) => void
  onOpenHelp?: () => void
}) {
  const [mode, setMode] = useState(data.dailyMode)
  const [problems, setProblems] = useState(data.dailyProblemTarget)
  const [minutes, setMinutes] = useState(data.dailyMinuteTarget)
  const [intervals, setIntervals] = useState(
    data.reviewIntervals.length === 4 ? data.reviewIntervals : [1, 3, 7, 15]
  )
  const [exporting, setExporting] = useState(false)
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [loadingBackups, setLoadingBackups] = useState(false)
  const [restoringPath, setRestoringPath] = useState<string | null>(null)
  const [audioMuted, setAudioMutedState] = useState(() => isAudioMuted())
  const [season, setSeason] = useState<SeasonStatus | null>(null)
  const [libraryPathInput, setLibraryPathInput] = useState('')
  const [currentVersion, setCurrentVersion] = useState('1.3.1')
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateResult, setUpdateResult] = useState<AppUpdateInfo | null>(null)
  const [showUpdateModal, setShowUpdateModal] = useState(false)

  const [userNickname, setUserNickname] = useState('dr7fter')
  const [userFriendCode, setUserFriendCode] = useState('')
  const [userSchool, setUserSchool] = useState('考研数学一 · 目标985')
  const [userAvatar, setUserAvatar] = useState('🚀')

  useEffect(() => {
    void getSeasonStatus().then(setSeason).catch(() => undefined)
    void getLibraryPath().then(setLibraryPathInput).catch(() => undefined)
    void getAppVersion().then(setCurrentVersion).catch(() => undefined)
    void getUserProfile().then((p) => {
      if (p.nickname) setUserNickname(p.nickname)
      if (p.friendCode) setUserFriendCode(p.friendCode)
      if (p.targetSchool) setUserSchool(p.targetSchool)
      if (p.avatar) setUserAvatar(p.avatar)
    }).catch(() => undefined)
  }, [])

  const handleSaveUserProfile = async () => {
    if (!userNickname.trim()) {
      notify('战术昵称不能为空')
      return
    }
    const cleanCode = userFriendCode.trim().toUpperCase()
    const profile: UserProfileSettings = {
      nickname: userNickname.trim(),
      friendCode: cleanCode || undefined,
      targetSchool: userSchool.trim(),
      avatar: userAvatar,
    }
    await setUserProfile(profile)
    notify(`战术名片已更新：选手「${profile.nickname}」${cleanCode ? `(好友码: ${cleanCode})` : ''}`)
    refresh()
  }

  const handleCheckUpdate = async (silent = false) => {
    setCheckingUpdate(true)
    try {
      const info = await checkAppUpdate()
      setUpdateResult(info)
      if (info.hasUpdate) {
        setShowUpdateModal(true)
        notify(`🎉 发现新版本 v${info.latestVersion}`)
      } else if (!silent) {
        notify(`当前已是最新版本 v${info.currentVersion}`)
      }
    } catch {
      if (!silent) notify('检测更新失败，请检查网络连接')
    } finally {
      setCheckingUpdate(false)
    }
  }

  const handleSimulateUpdate = () => {
    const mockInfo: AppUpdateInfo = {
      currentVersion: currentVersion,
      latestVersion: '1.4.0',
      hasUpdate: true,
      releaseName: '刷吧 v1.4.0 战术突击升级',
      releaseNotes: `### 🌟 v1.4.0 更新亮点
1. **数一天梯排位赛季深化**：新增赛季专属段位奖励与巅峰排位勋章；
2. **HLTV Rating 3.0 秒杀算法升级**：增强泰勒展开与反常积分判别法的秒杀识别权重；
3. **1v1 战力对决雷达优化**：支持与好友实时对比六维战术优势；
4. **考研几何大题高清配图增量**：补充 50+ 道高频几何大题精准图谱。

*注：升级覆盖程序不影响任何本地刷题历史与天梯 Elo 分。*`,
      publishedAt: new Date().toISOString(),
      htmlUrl: 'https://github.com/shuaba-app/shuaba/releases/latest',
      setupDownloadUrl: 'https://github.com/shuaba-app/shuaba/releases/latest',
      zipDownloadUrl: 'https://github.com/shuaba-app/shuaba/releases/latest',
      sourceDownloadUrl: 'https://github.com/shuaba-app/shuaba/releases/latest',
    }
    setUpdateResult(mockInfo)
    setShowUpdateModal(true)
    notify('🎉 模拟检测到新版本 v1.4.0！')
  }

  const loadBackups = useCallback(async () => {
    setLoadingBackups(true)
    try {
      const list = await listDatabaseBackups()
      setBackups(list)
    } catch {
      // ignore
    } finally {
      setLoadingBackups(false)
    }
  }, [])

  useEffect(() => {
    void loadBackups()
  }, [loadBackups])

  const submit = async () => {
    await saveGoal({ dailyMode: mode, dailyProblemTarget: problems, dailyMinuteTarget: minutes })
    notify('训练目标与偏好已保存')
    refresh()
  }

  const saveIntervals = async () => {
    await saveReviewIntervals(intervals)
    notify('复习间隔已保存')
    refresh()
  }

  const exportNow = async () => {
    setExporting(true)
    try {
      const result = await exportRecords()
      notify(`备份完成：${result.dbPath}`)
      void loadBackups()
    } catch (error) {
      notify(`备份失败：${String(error)}`)
    } finally {
      setExporting(false)
    }
  }

  const handleRestore = async (backup: BackupInfo) => {
    if (
      !window.confirm(
        `确认恢复至备份「${backup.fileName}」？\n\n系统会在恢复前自动创建一份当前状态的安全快照，如需回退随时可用。`
      )
    ) {
      return
    }
    setRestoringPath(backup.path)
    try {
      const res = await restoreDatabaseBackup(backup.path)
      notify(`数据库已成功恢复！安全快照位于：${res.preRestoreBackupPath}`)
      refresh()
      void loadBackups()
    } catch (e) {
      notify(`恢复失败：${String(e)}`)
    } finally {
      setRestoringPath(null)
    }
  }

  return (
    <div className="settings-view">
      <section>
        <div>
          <h2>题库目录</h2>
          <p>
            {data.libraryReady ? '当前题库目录有效。' : '⚠ 未在当前目录找到题库 JSON，请检查路径。'}
            更换后新路径立即生效，题库按内容哈希增量同步。
          </p>
        </div>
        <div className="setting-control">
          <input
            type="text"
            value={libraryPathInput}
            onChange={(e) => setLibraryPathInput(e.target.value)}
            placeholder="E:\考研资料\题库-大观园"
            style={{ flex: 1, minWidth: 220, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)' }}
          />
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              void setLibraryPath(libraryPathInput.trim())
                .then(() => notify('题库目录已更新，将按哈希增量同步'))
                .catch((e) => notify(`更新失败：${String(e)}`))
            }}
          >
            保存路径
          </button>
        </div>
      </section>
      <section>
        <div>
          <h2>赛季（备考阶段）</h2>
          <p>
            当前：<b>{season?.name ?? '基础期'}</b> · ELO {Math.round(season?.currentElo ?? 10000)}
            {season && season.history.length > 0 && (
              <>
                <br />
                历史赛季：
                {season.history.map((h) => (
                  <span key={h.seasonName + h.endedAt} style={{ marginRight: 10, color: 'var(--muted)', fontSize: 12 }}>
                    {h.seasonName} 峰值 {Math.round(h.peakRating)}
                  </span>
                ))}
              </>
            )}
          </p>
        </div>
        <div className="setting-control">
          <button
            type="button"
            className="secondary-button"
            disabled={!season || season.index >= 2}
            onClick={() => {
              if (window.confirm('切换赛季将结算当前段位并软重置 ELO（向 10000 收敛 25%），确定？')) {
                void advanceSeason().then(setSeason).then(() => notify('已进入下一赛季'))
              }
            }}
          >
            进入下一赛季
          </button>
        </div>
      </section>

      <section>
        <div>
          <h2>战术选手与名片设置</h2>
          <p>自定义你的考研战术选手昵称、目标院校与头像徽章，同步至天梯好友榜与战力大屏。</p>
        </div>
        <div className="setting-control">
          <label>战术头像徽章</label>
          <div className="avatar-options-row">
            {['🚀', '👑', '⚡', '🎓', '🎯', '🔥', '🦁', '🌟', '📐', '💎'].map((em) => (
              <button
                key={em}
                type="button"
                className={`avatar-option-btn ${userAvatar === em ? 'selected' : ''}`}
                onClick={() => setUserAvatar(em)}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        <div className="setting-control" style={{ marginTop: '16px' }}>
          <label>战术昵称 (用户名)</label>
          <input
            type="text"
            className="profile-text-input"
            value={userNickname}
            onChange={(e) => setUserNickname(e.target.value)}
            placeholder="例如: dr7fter"
          />
        </div>

        <div className="setting-control" style={{ marginTop: '16px' }}>
          <label>专属好友码 (可自定义)</label>
          <input
            type="text"
            className="profile-text-input"
            value={userFriendCode}
            onChange={(e) => setUserFriendCode(e.target.value)}
            placeholder="例如: SB-9527 或 KAYAN-2026"
          />
        </div>

        <div className="setting-control" style={{ marginTop: '16px' }}>
          <label>目标院校与专业</label>
          <input
            type="text"
            className="profile-text-input"
            value={userSchool}
            onChange={(e) => setUserSchool(e.target.value)}
            placeholder="例如: 清华大学 · 自动化"
          />
        </div>

        <button
          type="button"
          className="primary-button compact"
          style={{ marginTop: '16px', alignSelf: 'flex-start' }}
          onClick={handleSaveUserProfile}
        >
          保存选手名片
        </button>
      </section>

      <section>
        <div>
          <h2>界面与反馈</h2>
          <p>保持清爽的纸笔刷题界面，减少干扰，把注意力留给题目、复盘和下一步行动。</p>
        </div>
        <div className="setting-control">
          <label>主题色彩</label>
          <div className="segmented wide">
            {[
              ['light', '清爽浅色'],
              ['warm', '暖纸护眼'],
            ].map(([t, l]) => (
              <button
                key={t}
                className={theme === t ? 'active' : ''}
                onClick={() => onThemeChange(t as 'light' | 'warm')}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="setting-control" style={{ marginTop: '16px' }}>
          <label>字号缩放</label>
          <div className="segmented wide">
            {[
              ['standard', '标准 (100%)'],
              ['medium', '适中 (110%)'],
              ['large', '大号 (120%)'],
            ].map(([f, l]) => (
              <button
                key={f}
                className={fontScale === f ? 'active' : ''}
                onClick={() => onFontScaleChange(f as 'standard' | 'medium' | 'large')}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="setting-control" style={{ marginTop: '16px' }}>
          <label>减弱动态动效</label>
          <div className="segmented wide">
            <button
              className={!reducedMotion ? 'active' : ''}
              onClick={() => onReducedMotionChange(false)}
            >
              开启平滑过渡动效
            </button>
            <button
              className={reducedMotion ? 'active' : ''}
              onClick={() => onReducedMotionChange(true)}
            >
              减弱动效 (极致低延迟)
            </button>
          </div>
        </div>

        <div className="setting-control" style={{ marginTop: '16px' }}>
          <label>答题反馈音效</label>
          <div className="segmented wide">
            <button
              className={!audioMuted ? 'active' : ''}
              onClick={() => {
                setAudioMuted(false)
                setAudioMutedState(false)
              }}
            >
              开启音效
            </button>
            <button
              className={audioMuted ? 'active' : ''}
              onClick={() => {
                setAudioMuted(true)
                setAudioMutedState(true)
              }}
            >
              关闭音效
            </button>
          </div>
        </div>
      </section>

      <section>
        <div>
          <h2>每日训练目标 (SQLite 同步源)</h2>
          <p>题数和时长可以同时启用，作为今日进度和复习安排的唯一基准。</p>
        </div>
        <div className="setting-control">
          <label>目标模式</label>
          <div className="segmented wide">
            {[
              ['problems', '固定题数'],
              ['minutes', '固定时长'],
              ['both', '两种都看'],
            ].map(([v, l]) => (
              <button
                key={v}
                className={mode === v ? 'active' : ''}
                onClick={() => setMode(v as typeof mode)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="numeric-settings">
          <label>
            每日题数
            <input
              type="number"
              min="1"
              max="200"
              value={problems}
              onChange={(e) => setProblems(Number(e.target.value))}
            />
          </label>
          <label>
            每日分钟
            <input
              type="number"
              min="5"
              max="600"
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
          </label>
        </div>
        <button className="primary-button compact" onClick={submit}>
          保存目标与偏好
        </button>
      </section>

      <section>
        <div>
          <h2>复习间隔</h2>
          <p>四档自评对应的下次复习天数。冲刺阶段可以压缩到更短节奏。</p>
        </div>
        <div className="numeric-settings four">
          <label>
            不会
            <input
              type="number"
              min="1"
              max="180"
              value={intervals[0]}
              onChange={(e) =>
                setIntervals([Number(e.target.value), intervals[1], intervals[2], intervals[3]])
              }
            />
          </label>
          <label>
            模糊
            <input
              type="number"
              min="1"
              max="180"
              value={intervals[1]}
              onChange={(e) =>
                setIntervals([intervals[0], Number(e.target.value), intervals[2], intervals[3]])
              }
            />
          </label>
          <label>
            会做
            <input
              type="number"
              min="1"
              max="180"
              value={intervals[2]}
              onChange={(e) =>
                setIntervals([intervals[0], intervals[1], Number(e.target.value), intervals[3]])
              }
            />
          </label>
          <label>
            熟练
            <input
              type="number"
              min="1"
              max="180"
              value={intervals[3]}
              onChange={(e) =>
                setIntervals([intervals[0], intervals[1], intervals[2], Number(e.target.value)])
              }
            />
          </label>
        </div>
        <button className="primary-button compact" onClick={saveIntervals}>
          保存间隔
        </button>
      </section>

      <section>
        <div>
          <h2>本地数据、滚动备份与恢复</h2>
          <p>
            大观园题库源只读；学习记录保存在本机 SQLite 数据库中。启动时自动创建滚动备份，恢复时自动生成安全快照。
          </p>
        </div>
        <dl>
          <dt>大观园题库</dt>
          <dd>{data.libraryDir}</dd>
          <dt>学习数据库</dt>
          <dd>{data.dataDir}</dd>
          <dt>Codex 收件箱</dt>
          <dd>{data.inboxDir}</dd>
          <dt>异常时长隔离</dt>
          <dd>已过滤 {data.excludedDurationCount ?? 0} 条异常时长记录（不计入今日/总时长）</dd>
        </dl>
        <div className="setting-actions" style={{ marginBottom: '16px' }}>
          <button className="primary-button compact" disabled={exporting} onClick={exportNow}>
            {exporting ? <LoaderCircle className="spin" size={15} /> : <Archive size={15} />} 手动导出备份（数据库 + JSON v0.9.0）
          </button>
          <span>备份文件保存在 {data.dataDir}\backups</span>
        </div>

        {loadingBackups ? (
          <div>
            <LoaderCircle className="spin" size={16} /> 正在检索备份...
          </div>
        ) : backups.length > 0 ? (
          <div style={{ overflowX: 'auto', marginTop: '12px' }}>
            <table className="backup-table">
              <thead>
                <tr>
                  <th>备份文件</th>
                  <th>类型</th>
                  <th>创建时间</th>
                  <th>大小</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {backups.slice(0, 10).map((b) => (
                  <tr key={b.path}>
                    <td>
                      <code>{b.fileName}</code>
                    </td>
                    <td>
                      {b.backupType === 'rolling'
                        ? '滚动自动备份'
                        : b.backupType === 'pre_restore'
                        ? '恢复前安全快照'
                        : '手动导出'}
                    </td>
                    <td>{b.createdAt.slice(0, 19).replace('T', ' ')}</td>
                    <td>{Math.round(b.sizeBytes / 1024)} KB</td>
                    <td>
                      <button
                        className="backup-restore-btn"
                        disabled={restoringPath === b.path}
                        onClick={() => void handleRestore(b)}
                      >
                        {restoringPath === b.path ? '正在恢复...' : '恢复此版本'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: '13px' }}>暂无可用备份文件</p>
        )}
      </section>

      <section>
        <div>
          <h2>版本与在线更新</h2>
          <p>
            检测最新发布的「刷吧」版本与题库升级，在线获取更新说明并一键升级。
          </p>
        </div>

        <div className="update-check-card">
          <div className="update-check-info">
            <div className="update-current-version">
              <span className="version-pill">当前版本 v{currentVersion}</span>
              {updateResult && (
                <span className={`status-tag ${updateResult.hasUpdate ? 'has-update' : 'is-latest'}`}>
                  {updateResult.hasUpdate ? `🎉 发现新版 v${updateResult.latestVersion}` : '已是最新版本'}
                </span>
              )}
            </div>
            <p className="update-desc-text">
              {updateResult?.hasUpdate
                ? `最新版本包含战术分析优化与题库更新，点击查看详情。`
                : '定期检测可获取最新数一题库、Rating 算法与秒杀诊断功能。'}
            </p>
          </div>

          <div className="update-actions-group">
            <button
              className="primary-button compact"
              disabled={checkingUpdate}
              onClick={() => void handleCheckUpdate()}
            >
              {checkingUpdate ? (
                <>
                  <LoaderCircle className="spin" size={14} /> 正在检测...
                </>
              ) : (
                <>
                  <RefreshCw size={14} /> 检查新版本
                </>
              )}
            </button>

            <button
              type="button"
              className="secondary-button compact"
              onClick={handleSimulateUpdate}
              title="预览并体验新版本发布弹窗效果"
            >
              <Sparkles size={14} /> 演示升级弹窗
            </button>

            {updateResult?.hasUpdate && (
              <button
                className="secondary-button compact accent"
                onClick={() => setShowUpdateModal(true)}
              >
                <Sparkles size={14} /> 查看更新详情
              </button>
            )}
          </div>
        </div>
      </section>

      <section>
        <div>
          <h2>键盘快捷键</h2>
          <p>
            刷吧支持全键盘无鼠标极速刷题流，提升做题专注力与效率。
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span className="setting-chip"><kbd>Ctrl+K</kbd> 命令菜单</span>
            <span className="setting-chip"><kbd>Alt+F</kbd> 公式速查</span>
            <span className="setting-chip"><kbd>Alt+Z</kbd> 专注模式</span>
            <span className="setting-chip"><kbd>?</kbd> 快捷键帮助</span>
          </div>
          {onOpenHelp && (
            <button className="secondary-button compact" onClick={onOpenHelp}>
              查看完整指南
            </button>
          )}
        </div>
      </section>

      <section>
        <div>
          <h2>隐私与 AI</h2>
          <p>
            刷题、推荐和复习完全离线。只有你主动把草稿发给 Codex 时，图片才会进入对应的 Codex 任务。
          </p>
        </div>
        <div className="privacy-line">
          <span className="status-dot" />
          <span>本地优先离线可用模式已启用</span>
        </div>
      </section>

      {showUpdateModal && updateResult && (
        <UpdateModal
          updateInfo={updateResult}
          onClose={() => setShowUpdateModal(false)}
          notify={notify}
        />
      )}
    </div>
  )
}
