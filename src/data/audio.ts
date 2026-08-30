// 轻量音效合成（Web Audio，零外部资源）。音效开关在设置页，存储于 localStorage。

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (AudioContextClass) audioCtx = new AudioContextClass()
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      void audioCtx.resume()
    }
    return audioCtx
  } catch {
    return null
  }
}

export function isAudioMuted(): boolean {
  try {
    return localStorage.getItem('shuaba_sound_muted') === 'true'
  } catch {
    return false
  }
}

export function setAudioMuted(muted: boolean): void {
  try {
    localStorage.setItem('shuaba_sound_muted', muted ? 'true' : 'false')
  } catch {
    // ignore
  }
}

/** 答对时的清脆提示音 */
export function playCorrectSound(): void {
  if (isAudioMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(587.33, now) // D5
  osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.12) // A5

  gain.gain.setValueAtTime(0.18, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.35)
}

/** 答错时的低频下坠反馈（此前答错完全静音，反馈缺失） */
export function playWrongSound(): void {
  if (isAudioMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'triangle'
  osc.frequency.setValueAtTime(220.0, now) // A3
  osc.frequency.exponentialRampToValueAtTime(110.0, now + 0.18) // A2 下坠

  gain.gain.setValueAtTime(0.16, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.3)
}

/** 高光时刻旋律：kind 决定长度与走向。DONK/ZYWOO 超神五连音，REDEEM 愈合暖调 */
const HIGHLIGHT_NOTES: Record<string, number[]> = {
  ace: [523.25, 659.25, 783.99, 1046.5], // C5-E5-G5-C6 上行琶音
  s1mple: [587.33, 739.99, 880.0, 1174.66], // D5-F#5-A5-D6 大调更恢弘
  clutch: [523.25, 622.25, 783.99, 1046.5], // 紧张感半音上行
  redeem: [440.0, 554.37, 659.25], // A4-C#5-E5 愈合暖调
  donk: [523.25, 659.25, 783.99, 1046.5, 1318.5, 2093.0], // 超神：加高八度收尾
  zywoo: [523.25, 659.25, 783.99, 1046.5, 1318.5, 2093.0],
}

/** 高光时刻专属音效（区别于普通答对音），Web Audio 合成，零外部资源 */
export function playHighlightSound(kind: string): void {
  if (isAudioMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const notes = HIGHLIGHT_NOTES[kind] ?? HIGHLIGHT_NOTES.ace
  const step = kind === 'donk' || kind === 'zywoo' ? 0.09 : 0.11
  notes.forEach((freq, index) => {
    const now = ctx.currentTime + index * step
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = kind === 'redeem' ? 'sine' : 'triangle'
    osc.frequency.setValueAtTime(freq, now)
    gain.gain.setValueAtTime(0.14, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.28)
  })
}
