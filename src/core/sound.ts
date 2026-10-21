// Tiny synthesised sound kit. No assets: every effect is a few oscillators from the Web Audio API.

const KEY = 'ludo:muted'

let ctx: AudioContext | null = null
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
})()

export const isMuted = () => muted

export function setMuted(value: boolean) {
  muted = value
  try {
    localStorage.setItem(KEY, value ? '1' : '0')
  } catch {
    /* storage unavailable: the preference just won't persist */
  }
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

interface Tone {
  freq: number
  /** glide to this frequency over the tone's duration */
  to?: number
  /** start offset in seconds */
  at?: number
  dur?: number
  type?: OscillatorType
  gain?: number
}

function play(tones: Tone[]) {
  if (muted) return
  const a = audio()
  if (!a) return
  const t0 = a.currentTime
  for (const { freq, to, at = 0, dur = 0.12, type = 'sine', gain = 0.14 } of tones) {
    const osc = a.createOscillator()
    const amp = a.createGain()
    const start = t0 + at
    osc.type = type
    osc.frequency.setValueAtTime(freq, start)
    if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur)
    amp.gain.setValueAtTime(0.0001, start)
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.008)
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(amp).connect(a.destination)
    osc.start(start)
    osc.stop(start + dur + 0.02)
  }
}

const NOTE = { c5: 523.25, e5: 659.25, g5: 783.99, c6: 1046.5, e6: 1318.5 }

export const sfx = {
  /** dice clattering across the board */
  roll: () =>
    play(
      Array.from({ length: 13 }, (_, i) => ({
        freq: 170 + Math.random() * 260,
        at: i * 0.065 + Math.random() * 0.02,
        dur: 0.04,
        type: 'square' as const,
        gain: 0.035 * (1 - i / 16),
      })),
    ),
  /** the die touching down on the cloth: a dull knock, then a lighter one for the bounce */
  land: () =>
    play([
      { freq: 150, to: 70, dur: 0.1, type: 'sine', gain: 0.16 },
      { freq: 260, to: 140, at: 0.03, dur: 0.05, type: 'triangle', gain: 0.07 },
      { freq: 120, to: 70, at: 0.17, dur: 0.07, type: 'sine', gain: 0.07 },
    ]),
  step: () => play([{ freq: 540, to: 360, dur: 0.07, type: 'triangle', gain: 0.12 }]),
  turn: () => play([{ freq: 660, dur: 0.08, gain: 0.05 }, { freq: 880, at: 0.07, dur: 0.1, gain: 0.05 }]),
  capture: () =>
    play([
      { freq: 320, to: 80, dur: 0.32, type: 'sawtooth', gain: 0.09 },
      { freq: 180, to: 50, dur: 0.36, type: 'square', gain: 0.06 },
    ]),
  home: () => play([NOTE.c5, NOTE.e5, NOTE.g5, NOTE.c6].map((freq, i) => ({ freq, at: i * 0.08, dur: 0.22, gain: 0.1 }))),
  win: () =>
    play(
      [NOTE.c5, NOTE.e5, NOTE.g5, NOTE.c6, NOTE.g5, NOTE.c6, NOTE.e6].map((freq, i) => ({
        freq,
        at: i * 0.11,
        dur: i === 6 ? 0.7 : 0.25,
        type: 'triangle' as const,
        gain: 0.12,
      })),
    ),
  click: () => play([{ freq: 440, to: 600, dur: 0.05, type: 'triangle', gain: 0.06 }]),
}
