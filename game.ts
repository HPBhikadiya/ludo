// Pure Ludo rules + board geometry. Board is a 15x15 grid, (col,row), row 0 at the top.

import { MAIN } from './theme'

export type Color = 'red' | 'green' | 'yellow' | 'blue'
export type Cell = [number, number]
export type Tokens = Record<Color, number[]>

export const COLORS: Color[] = ['red', 'green', 'yellow', 'blue'] // clockwise
export const COLOR_HEX: Record<Color, string> = MAIN // defined in theme.ts
export const COLOR_NAME: Record<Color, string> = { red: 'Red', green: 'Green', yellow: 'Yellow', blue: 'Blue' }

// 52 cells of the shared track, clockwise, index 0 = red's start square.
export const TRACK: Cell[] = [
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  [7, 0], [8, 0],
  [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  [14, 7], [14, 8],
  [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  [7, 14], [6, 14],
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  [0, 7], [0, 6],
]

export const START_INDEX: Record<Color, number> = { red: 0, green: 13, yellow: 26, blue: 39 }

// Squares where tokens cannot be captured: every start square + the star squares.
export const SAFE_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47])

// Home column cells (5 each) leading to the centre.
export const HOME_COLUMN: Record<Color, Cell[]> = {
  red: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  green: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  yellow: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  blue: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
}

export const YARD_ORIGIN: Record<Color, Cell> = {
  red: [0, 0],
  green: [9, 0],
  yellow: [9, 9],
  blue: [0, 9],
}

// Token progress: -1 = in yard, 0..50 = on track (0 = own start square),
// 51..55 = home column, 56 = home (finished).
export const IN_YARD = -1
export const HOME = 56
export const LAST_TRACK = 50

export const trackIndex = (color: Color, p: number) => (START_INDEX[color] + p) % 52

/** Grid cell [col,row] for a token on the board (progress 0..55). */
export function cellFor(color: Color, p: number): Cell {
  if (p <= LAST_TRACK) return TRACK[trackIndex(color, p)]
  return HOME_COLUMN[color][p - LAST_TRACK - 1]
}

/** World position (x,z) with the board centred on the origin, 1 unit per cell. */
export const cellToWorld = ([c, r]: Cell): [number, number] => [c + 0.5 - 7.5, r + 0.5 - 7.5]

export function yardSpot(color: Color, i: number): [number, number] {
  const [ox, oy] = YARD_ORIGIN[color]
  const dx = i % 2 === 0 ? 2 : 4
  const dy = i < 2 ? 2 : 4
  return cellToWorld([ox + dx - 0.5, oy + dy - 0.5])
}

const HOME_SPOT_DIR: Record<Color, [number, number]> = { red: [-1, 0], green: [0, -1], yellow: [1, 0], blue: [0, 1] }
export function homeSpot(color: Color, i: number): [number, number] {
  const [dx, dz] = HOME_SPOT_DIR[color]
  // fan out the finished tokens along the player's side of the centre
  const side = (i - 1.5) * 0.4
  return [dx * 1.0 + (dz !== 0 ? side : 0), dz * 1.0 + (dx !== 0 ? side : 0)]
}

/** World position (x,z) of a token ignoring stacking offsets. */
export function tokenWorld(color: Color, p: number, i: number): [number, number] {
  if (p === IN_YARD) return yardSpot(color, i)
  if (p === HOME) return homeSpot(color, i)
  return cellToWorld(cellFor(color, p))
}

export const newTokens = (): Tokens =>
  Object.fromEntries(COLORS.map((c) => [c, [-1, -1, -1, -1]])) as Tokens

/** Tokens of `color` that can legally move with `roll`. */
export function movableTokens(tokens: Tokens, color: Color, roll: number): number[] {
  const res: number[] = []
  tokens[color].forEach((p, i) => {
    if (p === IN_YARD) {
      if (roll === 6) res.push(i)
    } else if (p !== HOME && p + roll <= HOME) res.push(i)
  })
  return res
}

/** Apply a move without mutating. Returns new tokens + info. */
export function applyMove(tokens: Tokens, color: Color, idx: number, roll: number) {
  const p = tokens[color][idx]
  const np = p === IN_YARD ? 0 : p + roll
  const next = Object.fromEntries(COLORS.map((c) => [c, [...tokens[c]]])) as Tokens
  next[color][idx] = np
  const captured: { color: Color; idx: number }[] = []
  if (np <= LAST_TRACK) {
    const ti = trackIndex(color, np)
    if (!SAFE_INDICES.has(ti)) {
      for (const other of COLORS) {
        if (other === color) continue
        next[other].forEach((op, oi) => {
          if (op >= 0 && op <= LAST_TRACK && trackIndex(other, op) === ti) {
            next[other][oi] = IN_YARD
            captured.push({ color: other, idx: oi })
          }
        })
      }
    }
  }
  return { tokens: next, newP: np, captured, reachedHome: np === HOME }
}

/** Simple heuristic for CPU players. Returns the index of the token to move. */
export function chooseMove(tokens: Tokens, color: Color, roll: number, options: number[]): number {
  let best = options[0]
  let bestScore = -Infinity
  for (const idx of options) {
    const p = tokens[color][idx]
    const { newP, captured, reachedHome } = applyMove(tokens, color, idx, roll)
    let score = newP * 0.5
    if (captured.length) score += 100 + captured.reduce((s, c) => s + tokens[c.color][c.idx], 0)
    if (reachedHome) score += 80
    if (p === IN_YARD) score += 50
    if (newP > LAST_TRACK && newP < HOME) score += 15
    if (newP <= LAST_TRACK && SAFE_INDICES.has(trackIndex(color, newP))) score += 20
    if (p <= LAST_TRACK && p >= 0 && SAFE_INDICES.has(trackIndex(color, p))) score -= 8
    // danger: an opponent token a few squares behind the destination
    if (newP >= 0 && newP <= LAST_TRACK && !SAFE_INDICES.has(trackIndex(color, newP))) {
      const ti = trackIndex(color, newP)
      for (const other of COLORS) {
        if (other === color) continue
        for (const op of tokens[other]) {
          if (op < 0 || op > LAST_TRACK) continue
          const dist = (ti - trackIndex(other, op) + 52) % 52
          if (dist >= 1 && dist <= 6) score -= 12
        }
      }
    }
    score += Math.random() * 2
    if (score > bestScore) {
      bestScore = score
      best = idx
    }
  }
  return best
}
