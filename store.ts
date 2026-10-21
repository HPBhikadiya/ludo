import { create } from 'zustand'
import {
  COLORS,
  COLOR_NAME,
  HOME,
  applyMove,
  movableTokens,
  newTokens,
  tokenWorld,
  type Color,
  type Tokens,
} from './game'
import { isMuted, setMuted, sfx } from './sound'
import { TIMING } from './theme'

// Animation timings live in theme.ts so the visuals and the turn flow stay in step.
const ROLL_MS = TIMING.rollMs
const STEP_MS = TIMING.stepMs
const LOG_LIMIT = 40

let gameId = 0
let logId = 0
let burstId = 0

/** Delayed callback that dies with its game and waits out a pause. */
const later = (id: number, ms: number, fn: () => void) => {
  const run = () => {
    if (id !== gameId) return
    if (useGame.getState().paused) {
      setTimeout(run, 150)
      return
    }
    fn()
  }
  setTimeout(run, ms)
}

export type Phase = 'setup' | 'roll' | 'rolling' | 'select' | 'moving' | 'over'
export type Seat = 'human' | 'cpu' | 'off'

export interface LogEntry {
  id: number
  color: Color
  text: string
}
export type Stats = Record<Color, { captures: number; sixes: number; rolls: number }>
/** One-shot particle effect on the board; `id` changes for every new burst. */
export interface Burst {
  id: number
  kind: 'capture' | 'home'
  color: Color
  pos: [number, number]
}

const newStats = (): Stats =>
  Object.fromEntries(COLORS.map((c) => [c, { captures: 0, sixes: 0, rolls: 0 }])) as Stats

const bump = (stats: Stats, color: Color, key: keyof Stats[Color], by = 1): Stats => ({
  ...stats,
  [color]: { ...stats[color], [key]: stats[color][key] + by },
})

const entry = (color: Color, text: string): LogEntry => ({ id: ++logId, color, text })
const pushLog = (log: LogEntry[], color: Color, text: string) => [...log, entry(color, text)].slice(-LOG_LIMIT)

interface GameState {
  phase: Phase
  seats: Record<Color, Seat>
  players: Color[] // active colors in turn order
  current: number
  tokens: Tokens
  dice: { value: number; rollId: number }
  sixes: number
  movable: number[]
  message: string
  winner: Color | null
  paused: boolean
  muted: boolean
  hover: number | null
  log: LogEntry[]
  stats: Stats
  burst: Burst | null
  viewNonce: number

  setSeat: (color: Color, seat: Seat) => void
  startGame: () => void
  backToSetup: () => void
  roll: () => void
  afterRoll: () => void
  move: (idx: number) => void
  nextTurn: () => void
  togglePause: () => void
  toggleMute: () => void
  setHover: (idx: number | null) => void
  resetView: () => void
}

export const useGame = create<GameState>((set, get) => ({
  phase: 'setup',
  seats: { red: 'human', green: 'cpu', yellow: 'off', blue: 'cpu' },
  players: [],
  current: 0,
  tokens: newTokens(),
  dice: { value: 1, rollId: 0 },
  sixes: 0,
  movable: [],
  message: '',
  winner: null,
  paused: false,
  muted: isMuted(),
  hover: null,
  log: [],
  stats: newStats(),
  burst: null,
  viewNonce: 0,

  setSeat: (color, seat) =>
    set((s) => {
      const seats = { ...s.seats, [color]: seat }
      const active = COLORS.filter((c) => seats[c] !== 'off').length
      return active < 2 ? s : { seats }
    }),

  startGame: () => {
    gameId++
    const { seats } = get()
    const players = COLORS.filter((c) => seats[c] !== 'off')
    set({
      phase: 'roll',
      players,
      current: 0,
      tokens: newTokens(),
      sixes: 0,
      movable: [],
      winner: null,
      paused: false,
      hover: null,
      stats: newStats(),
      burst: null,
      log: [entry(players[0], 'Game on — good luck!')],
      message: `${COLOR_NAME[players[0]]} to roll`,
    })
  },

  backToSetup: () => {
    gameId++
    set({ phase: 'setup', tokens: newTokens(), movable: [], winner: null, paused: false, hover: null, burst: null })
  },

  roll: () => {
    const s = get()
    if (s.phase !== 'roll' || s.paused) return
    const id = gameId
    const color = s.players[s.current]
    const value = 1 + Math.floor(Math.random() * 6)
    sfx.roll()
    set({
      phase: 'rolling',
      dice: { value, rollId: s.dice.rollId + 1 },
      stats: bump(s.stats, color, 'rolls'),
      movable: [],
      message: '',
    })
    later(id, ROLL_MS, () => get().afterRoll())
  },

  afterRoll: () => {
    const s = get()
    const id = gameId
    const color = s.players[s.current]
    const name = COLOR_NAME[color]
    const value = s.dice.value
    const sixes = value === 6 ? s.sixes + 1 : 0
    const stats = value === 6 ? bump(s.stats, color, 'sixes') : s.stats
    const log = pushLog(s.log, color, `${name} rolled a ${value}`)
    if (sixes === 3) {
      set({ sixes: 0, stats, log, message: `${name} rolled three sixes in a row — turn lost` })
      later(id, 1200, () => get().nextTurn())
      return
    }
    const movable = movableTokens(s.tokens, color, value)
    if (movable.length === 0) {
      set({ sixes, stats, log, message: `${name} rolled ${value} — no moves` })
      later(id, 1000, () => get().nextTurn())
      return
    }
    set({ sixes, stats, log })
    if (movable.length === 1) {
      get().move(movable[0])
      return
    }
    set({ phase: 'select', movable, message: `${name}: pick a pawn` })
  },

  move: (idx) => {
    const s = get()
    if ((s.phase !== 'select' && s.phase !== 'rolling') || s.paused) return
    const id = gameId
    const color = s.players[s.current]
    const name = COLOR_NAME[color]
    const value = s.dice.value
    const prev = s.tokens[color][idx]
    const res = applyMove(s.tokens, color, idx, value)
    const steps = prev < 0 ? 1 : value
    const landing = steps * STEP_MS
    const dest = tokenWorld(color, res.newP, idx)

    let message = ''
    let log = s.log
    let stats = s.stats
    if (res.captured.length) {
      message = `${name} captured ${res.captured.map((c) => COLOR_NAME[c.color]).join(', ')}!`
      log = pushLog(log, color, message)
      stats = bump(stats, color, 'captures', res.captured.length)
    } else if (res.reachedHome) {
      message = `${name} got a pawn home!`
      log = pushLog(log, color, message)
    }
    set({ phase: 'moving', tokens: res.tokens, movable: [], hover: null, message, log, stats })

    for (let i = 1; i <= steps; i++) later(id, i * STEP_MS, sfx.step)
    if (res.captured.length) {
      later(id, landing, () => {
        sfx.capture()
        set({ burst: { id: ++burstId, kind: 'capture', color: res.captured[0].color, pos: dest } })
      })
    } else if (res.reachedHome) {
      later(id, landing, () => {
        sfx.home()
        set({ burst: { id: ++burstId, kind: 'home', color, pos: dest } })
      })
    }

    later(id, landing + 450, () => {
      if (res.tokens[color].every((p) => p === HOME)) {
        sfx.win()
        set((g) => ({
          phase: 'over',
          winner: color,
          message: `${name} wins!`,
          log: pushLog(g.log, color, `${name} wins the game!`),
        }))
        return
      }
      const extra = value === 6 || res.captured.length > 0 || res.reachedHome
      if (extra) {
        set({ phase: 'roll', message: `${name} rolls again` })
      } else {
        get().nextTurn()
      }
    })
  },

  nextTurn: () => {
    const s = get()
    const next = (s.current + 1) % s.players.length
    if (s.seats[s.players[next]] === 'human') sfx.turn()
    set({
      phase: 'roll',
      current: next,
      sixes: 0,
      movable: [],
      message: `${COLOR_NAME[s.players[next]]} to roll`,
    })
  },

  togglePause: () => set((s) => (s.phase === 'setup' || s.phase === 'over' ? s : { paused: !s.paused })),

  toggleMute: () => {
    const muted = !get().muted
    setMuted(muted)
    set({ muted })
  },

  setHover: (hover) => set({ hover }),
  resetView: () => set((s) => ({ viewNonce: s.viewNonce + 1 })),
}))
