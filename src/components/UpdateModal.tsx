import { AnimatePresence, motion } from 'framer-motion'
import { Download, ExternalLink, Sparkles, X, Check, Copy } from 'lucide-react'
import { useState } from 'react'
import type { AppUpdateInfo } from '../types'

export function UpdateModal({
  updateInfo,
  onClose,
  notify,
}: {
  updateInfo: AppUpdateInfo
  onClose: () => void
  notify: (msg: string) => void
}) {
  const [copied, setCopied] = useState(false)

  const handleCopyLink = () => {
    const url = updateInfo.htmlUrl || updateInfo.zipDownloadUrl || 'https://github.com/shuaba-app/shuaba/releases'
    void navigator.clipboard.writeText(url)
    setCopied(true)
    notify('更新地址已复制到剪贴板')
    setTimeout(() => setCopied(false), 2000)
  }

  const openUrl = (url?: string | null) => {
    if (!url) return
    window.open(url, '_blank')
  }

  return (
    <AnimatePresence>
      <div className="modal-backdrop" onClick={onClose}>
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
            <button className="icon-button" onClick={onClose} title="关闭 (Esc)">
              <X size={18} />
            </button>
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

            <div className="update-safety-banner">
              🛡️ <strong>升级提示：</strong> 本地刷题记录、天梯 Elo 分与复习计划均安全保存在系统数据库，更新软件不会造成任何数据丢失。
            </div>
          </div>

          <div className="modal-footer update-modal-footer">
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

            {updateInfo.zipDownloadUrl && (
              <button
                className="primary-button compact"
                onClick={() => openUrl(updateInfo.zipDownloadUrl)}
              >
                <Download size={14} />
                下载免安装绿色版
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
