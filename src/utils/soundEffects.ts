/**
 * 刷吧 · 纯代码原生 Web Audio 音频合成引擎
 * 零外链音频文件依赖，零延迟，专为多巴胺激励体系定制
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export function isSoundEnabled(): boolean {
  try {
    const val = localStorage.getItem('shuaba_quest_sound_enabled')
    return val !== 'false'
  } catch {
    return true
  }
}

export function setSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem('shuaba_quest_sound_enabled', enabled ? 'true' : 'false')
  } catch {}
}

/**
 * Level 1: 单项任务打勾音效（清脆利落的「叮」高频双音）
 */
export function playCheckSound() {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime

  // Note 1: E6 (1318.5 Hz)
  const osc1 = ctx.createOscillator()
  const gain1 = ctx.createGain()
  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(1318.5, now)
  gain1.gain.setValueAtTime(0.12, now)
  gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
  osc1.connect(gain1)
  gain1.connect(ctx.destination)
  osc1.start(now)
  osc1.stop(now + 0.12)

  // Note 2: B6 (1975.5 Hz)
  const osc2 = ctx.createOscillator()
  const gain2 = ctx.createGain()
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(1975.5, now + 0.04)
  gain2.gain.setValueAtTime(0.0001, now)
  gain2.gain.setValueAtTime(0.15, now + 0.04)
  gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
  osc2.connect(gain2)
  gain2.connect(ctx.destination)
  osc2.start(now + 0.04)
  osc2.stop(now + 0.22)
}

/**
 * Level 2: 基础计划全通通关音效（宏亮上扬的大三和弦升级音，底线达成笃定感）
 */
export function playBaseCompleteSound() {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const notes = [
    { freq: 523.25, time: 0.0, dur: 0.35, gain: 0.12 },  // C5
    { freq: 659.25, time: 0.08, dur: 0.40, gain: 0.14 }, // E5
    { freq: 783.99, time: 0.16, dur: 0.45, gain: 0.15 }, // G5
    { freq: 1046.50, time: 0.24, dur: 0.70, gain: 0.20 }, // C6
  ]

  notes.forEach(({ freq, time, dur, gain }) => {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, now + time)
    g.gain.setValueAtTime(0.0001, now)
    g.gain.setValueAtTime(gain, now + time)
    g.gain.exponentialRampToValueAtTime(0.0001, now + time + dur)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(now + time)
    osc.stop(now + time + dur)
  })
}

/**
 * Level 3: 进阶冲刺单项突破音效（低音战鼓重击 + 锐利冲刺破空音）
 */
export function playAdvancedBreakthroughSound() {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime

  // 1. 低音重击鼓点
  const kickOsc = ctx.createOscillator()
  const kickGain = ctx.createGain()
  kickOsc.type = 'sine'
  kickOsc.frequency.setValueAtTime(180, now)
  kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.25)
  kickGain.gain.setValueAtTime(0.35, now)
  kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)
  kickOsc.connect(kickGain)
  kickGain.connect(ctx.destination)
  kickOsc.start(now)
  kickOsc.stop(now + 0.28)

  // 2. 突破破空光效音
  const riserOsc = ctx.createOscillator()
  const riserGain = ctx.createGain()
  riserOsc.type = 'triangle'
  riserOsc.frequency.setValueAtTime(440, now + 0.06)
  riserOsc.frequency.exponentialRampToValueAtTime(1760, now + 0.32)
  riserGain.gain.setValueAtTime(0.0001, now)
  riserGain.gain.setValueAtTime(0.18, now + 0.08)
  riserGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
  riserOsc.connect(riserGain)
  riserGain.connect(ctx.destination)
  riserOsc.start(now + 0.06)
  riserOsc.stop(now + 0.45)
}

/**
 * Level 4: 基础+进阶全部拉满（ALL CLEAR 巅峰史诗大满贯凯旋音）
 */
export function playAllClearFanfare() {
  if (!isSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const fanfare = [
    { freq: 523.25, time: 0.0, dur: 0.20, gain: 0.12 },   // C5
    { freq: 659.25, time: 0.12, dur: 0.20, gain: 0.14 },  // E5
    { freq: 783.99, time: 0.24, dur: 0.22, gain: 0.16 },  // G5
    { freq: 1046.50, time: 0.36, dur: 0.25, gain: 0.18 }, // C6
    { freq: 1318.51, time: 0.48, dur: 0.30, gain: 0.20 }, // E6
    { freq: 1567.98, time: 0.60, dur: 0.35, gain: 0.22 }, // G6
    { freq: 2093.00, time: 0.72, dur: 0.85, gain: 0.28 }, // C7 (Grand finale)
  ]

  fanfare.forEach(({ freq, time, dur, gain }) => {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, now + time)
    g.gain.setValueAtTime(0.0001, now)
    g.gain.setValueAtTime(gain, now + time)
    g.gain.exponentialRampToValueAtTime(0.0001, now + time + dur)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(now + time)
    osc.stop(now + time + dur)
  })
}