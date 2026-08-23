import { AnimatePresence, motion } from 'framer-motion'
import { Download, ExternalLink, Sparkles, X, Check, Copy, LoaderCircle, RotateCw } from 'lucide-react'
import { useState } from 'react'
import type { UpdateProgress } from '../api'
import type { AppUpdateInfo } from '../types'

type InstallPhase = 'idle' | 'downloading' | 'installing' | 'ready'

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function UpdateModal({
  updateInfo,
  onClose,
  notify,
  onInstall,
  onRestart,
}: {
  updateInfo: AppUpdateInfo
  onClose: () => void
  notify: (msg: string) => void
  /** 存在时显示「立即更新」走应用内下载安装；缺失时回退浏览器下载（演示模式） */
  onInstall?: (onProgress: (progress: UpdateProgress) => void) => Promise<void>
  onRestart?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [phase, setPhase] = useState<InstallPhase>('idle')
  const [progress, setProgress] = useState<UpdateProgress | null>(null)

  const handleCopyLink = () => {
    const url = updateInfo.htmlUrl || updateInfo.zipDownloadUrl || 'https://github.com/dr7fter/shauba/releases'
    void navigator.clipboard.writeText(url)
    setCopied(true)
    notify('更新地址已复制到剪贴板')
    setTimeout(() => setCopied(false), 2000)
  }

  const openUrl = (url?: string | null) => {
    if (!url) return
    window.open(url, '_blank')
  }

  const handleInstall = async () => {
    if (!onInstall) return
    setPhase('downloading')
    setProgress({ downloaded: 0, total: null })
    try {
      await onInstall(setProgress)
      setPhase('ready')
      notify('新版本已下载完成，重启后生效')
    } catch (error) {
      setPhase('idle')
      setProgress(null)
      notify(`更新失败：${String(error)}`)
    }
  }

  const percent =
    progress && progress.total && progress.total > 0
      ? Math.min(100, Math.round((progress.downloaded / progress.total) * 100))
      : null

  return (
    <AnimatePresence>
      <div className="modal-backdrop" onClick={phase === 'idle' ? onClose : undefined}>
        <motion.div
          className="modal update-modal"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <div className="update-modal-title">
              <span className="update-spark-icon">
                <Sparkles size={18} />
              </span>
              <div>
                <h2>{updateInfo.hasUpdate ? '发现新版本可用' : '版本信息'}</h2>
                <p>
                  当前版本 v{updateInfo.currentVersion} → 最新版本 v{updateInfo.latestVersion}
                </p>
              </div>
            </div>
            {phase === 'idle' && (
              <button className="icon-button" onClick={onClose} title="关闭 (Esc)">
                <X size={18} />
              </button>
            )}
          </div>

          <div className="update-modal-body">
            <div className="update-meta-row">
              <div className="version-tag-badge">
                <span className="version-pulse-dot" />
                <strong>{updateInfo.releaseName || `刷吧 v${updateInfo.latestVersion}`}</strong>
              </div>
              {updateInfo.publishedAt && (
                <span className="update-date-text">
                  发布于 {updateInfo.publishedAt.slice(0, 10)}
                </span>
              )}
            </div>

            <div className="update-notes-container">
              <div className="update-notes-header">✨ 本次更新亮点与改进</div>
              <div className="update-notes-content">
                {updateInfo.releaseNotes ? (
                  <pre className="update-pre-text">{updateInfo.releaseNotes}</pre>
                ) : (
                  <p className="update-default-text">包含性能提升、战力算法调优与已知问题修复。</p>
                )}
              </div>
            </div>

            {phase !== 'idle' && (
              <div className="update-progress-panel">
                {phase === 'downloading' && (
                  <>
                    <div className="update-progress-head">
                      <LoaderCircle size={14} className="spin" />
                      <span>正在下载更新{percent !== null ? ` · ${percent}%` : ''}</span>
                      <em>
                        {progress ? formatMb(progress.downloaded) : '0 MB'}
                        {progress?.total ? ` / ${formatMb(progress.total)}` : ''}
                      </em>
                    </div>
                    <div className="update-progress-track">
                      <div
                        className="update-progress-fill"
                        style={{ width: percent !== null ? `${percent}%` : '100%' }}
                      />
                    </div>
                  </>
                )}
                {phase === 'ready' && (
                  <div className="update-ready-banner">
                    <Check size={16} />
                    更新包已就绪，重启刷吧后即可使用 v{updateInfo.latestVersion}。
                  </div>
                )}
              </div>
            )}

            <div className="update-safety-banner">
              🛡️ <strong>升级提示：</strong> 本地刷题记录、天梯 Elo 分与复习计划均安全保存在系统数据库，更新软件不会造成任何数据丢失。
            </div>
          </div>

          <div className="modal-footer update-modal-footer">
            {phase === 'idle' && (
              <>
                <button className="secondary-button compact" onClick={handleCopyLink}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? '已复制' : '复制下载链接'}
                </button>

                {updateInfo.htmlUrl && (
                  <button
                    className="secondary-button compact"
                    onClick={() => openUrl(updateInfo.htmlUrl)}
                  >
                    <ExternalLink size={14} />
                    前往 Release 页面
                  </button>
                )}

                {onInstall ? (
                  <button className="primary-button compact" onClick={() => void handleInstall()}>
                    <Download size={14} />
                    立即更新
                  </button>
                ) : (
                  updateInfo.zipDownloadUrl && (
                    <button
                      className="primary-button compact"
                      onClick={() => openUrl(updateInfo.zipDownloadUrl)}
                    >
                      <Download size={14} />
                      下载免安装绿色版
                    </button>
                  )
                )}
              </>
            )}

            {phase === 'downloading' && (
              <button className="secondary-button compact" disabled>
                <LoaderCircle size={14} className="spin" />
                正在下载…
              </button>
            )}

            {phase === 'ready' && onRestart && (
              <button className="primary-button compact" onClick={onRestart}>
                <RotateCw size={14} />
                立即重启
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
