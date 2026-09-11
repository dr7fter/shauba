import { useEffect, useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { imageDataUrl } from '../api'

const isTauri = () => '__TAURI_INTERNALS__' in window

// 桌面端本地绝对路径交给 asset 协议直读（不经 IPC、不占后端 base64 缓存）；
// 浏览器预览模式或非本地路径返回 null，走旧通道兜底。
function assetSrc(path: string): string | null {
  if (!isTauri()) return null
  if (/^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('/')) return convertFileSrc(path)
  return null
}

export function QuestionImages({ paths }: { paths: string[] }) {
  const [urls, setUrls] = useState<string[]>([])
  useEffect(() => {
    let cancelled = false
    const primary = paths.map((p) => assetSrc(p))
    setUrls(primary.map((s) => s ?? ''))
    paths.forEach((path, i) => {
      if (primary[i] !== null) return
      void imageDataUrl(path).then((data) => {
        if (!cancelled) setUrls((prev) => replaceAt(prev, i, data))
      })
    })
    return () => {
      cancelled = true
    }
  }, [paths])

  // asset 协议加载失败（如权限/盘符变化）时逐张回退 base64 通道
  const onError = (index: number) => {
    const current = urls[index]
    if (!current || current.startsWith('data:')) return
    void imageDataUrl(paths[index]).then((data) =>
      setUrls((prev) => (prev[index] === data ? prev : replaceAt(prev, index, data)))
    )
  }

  return (
    <div className="question-images">
      {urls.map((url, i) => (
        <img
          key={paths[i]}
          src={url || undefined}
          alt={`题目附图 ${i + 1}`}
          onError={() => onError(i)}
        />
      ))}
    </div>
  )
}

function replaceAt(list: string[], index: number, value: string): string[] {
  if (list[index] === value) return list
  const next = [...list]
  next[index] = value
  return next
}
