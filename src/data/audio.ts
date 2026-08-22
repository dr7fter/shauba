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
