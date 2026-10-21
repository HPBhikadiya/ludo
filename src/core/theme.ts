import type { CSSProperties } from 'react'
import { Color as ThreeColor } from 'three'
import type { Color } from './game'

/**
 * Single source of truth for how the game looks and feels.
 * Art direction: a hand-printed Pachisi cloth board on a teak table, with lathe-turned lacquer pawns.
 * Colours are dye colours (madder, leaf green, turmeric, indigo), never screen primaries.
 */

// ---------------------------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------------------------

export interface Shades {
  /** tile washes, yard background */
  light: string
  /** pawns, start squares, home column */
  main: string
  /** outlines, shadows, recesses */
  dark: string
}

export const PALETTE: Record<Color, Shades> = {
  red: { light: '#EBC3B1', main: '#C4402E', dark: '#7B2519' }, // vermilion / madder
  green: { light: '#BFDCC8', main: '#2E8C69', dark: '#17503C' }, // bottle green
  yellow: { light: '#F4DFA0', main: '#E0A62D', dark: '#94640F' }, // turmeric / saffron
  blue: { light: '#BDCCE3', main: '#2F5E9F', dark: '#1B396A' }, // indigo
}

export const NEUTRAL = {
  tile: '#F5ECD7', // ivory square
  tileEdge: '#8C7556', // stitched outline on the squares
  cloth: '#E4D5B2', // the cloth showing between squares
  clothDeep: '#CDB98F',
  ink: '#2E2016', // charcoal-brown for text and block-print ink
  inkSoft: '#5B432E',
  bone: '#F3EBD8',
  rosewood: '#3F2418', // board rim
  rosewoodLight: '#6A3F29',
  teak: '#2A1A11', // the table
  teakLight: '#4B2F1D',
  brass: '#B98A3E', // used sparingly: lotus eye only
}

const mixHex = (a: string, b: string, k: number) =>
  '#' + new ThreeColor(a).lerp(new ThreeColor(b), k).getHexString()

/** A muted, chalky version of a player colour for squares that should not shout. */
export const muted = (c: Color, k = 0.5) => mixHex(PALETTE[c].light, PALETTE[c].main, k)

/** Main colour per player, for UI that only needs one swatch. */
export const MAIN: Record<Color, string> = {
  red: PALETTE.red.main,
  green: PALETTE.green.main,
  yellow: PALETTE.yellow.main,
  blue: PALETTE.blue.main,
}

/** Text colour that reads on each player's main colour. */
export const ON_MAIN: Record<Color, string> = { red: '#FBF1DC', green: '#FBF1DC', yellow: NEUTRAL.ink, blue: '#FBF1DC' }

/** CSS custom properties for a player's colours, for the 2D interface (see styles.css). */
export const swatch = (c: Color) =>
  ({
    '--c': PALETTE[c].main,
    '--c-light': PALETTE[c].light,
    '--c-dark': PALETTE[c].dark,
    '--on': ON_MAIN[c],
  }) as CSSProperties

// ---------------------------------------------------------------------------------------------
// Pawn character: colour alone is not enough, so each player also gets its own head silhouette
// ---------------------------------------------------------------------------------------------

export type HeadKind = 'ball' | 'onion' | 'button' | 'gem'
export type InlayKind = 'circle' | 'triangle' | 'square' | 'diamond'

export const PAWN_STYLE: Record<Color, { head: HeadKind; inlay: InlayKind; bands: 1 | 2 | 3 }> = {
  red: { head: 'ball', inlay: 'circle', bands: 1 },
  green: { head: 'onion', inlay: 'triangle', bands: 2 },
  yellow: { head: 'button', inlay: 'square', bands: 3 },
  blue: { head: 'gem', inlay: 'diamond', bands: 2 },
}

// ---------------------------------------------------------------------------------------------
// Layout (world units; the 15x15 grid is 1 unit per cell, centred on the origin, y is up)
// ---------------------------------------------------------------------------------------------

/** Height of the surface that pawns stand on (tile tops, yard panels, centre triangles). */
export const GROUND = 0.26
/** Top of the cloth, below the raised squares. */
export const PLATE_TOP = 0.2
/** How far the pawn spots in the yards are sunk below GROUND. */
export const RECESS = 0.056

export const LAYOUT = {
  tile: 0.9, // square size; the remaining 0.1 shows the cloth
  clothHalf: 8.4, // half-width of the printed cloth, border band included
  rimWidth: 0.55,
  rimHeight: 0.44,
  slabHeight: 0.18,
  yard: 5.9,
  yardRadius: 0.3,
  spotRadius: 0.6,
  diceDish: 0.78,
}
/** Half the outer width of the whole board including the wooden rim. */
export const BOARD_HALF = LAYOUT.clothHalf + LAYOUT.rimWidth

/** Centre of each yard in world x,z (where the dice rests on that player's turn). */
export const YARD_CENTER: Record<Color, [number, number]> = {
  red: [-4.5, -4.5],
  green: [4.5, -4.5],
  yellow: [4.5, 4.5],
  blue: [-4.5, 4.5],
}

// ---------------------------------------------------------------------------------------------
// Timing (seconds unless the name says ms)
// ---------------------------------------------------------------------------------------------

export const TIMING = {
  /** the game waits this long after a tap before resolving the roll (see store.ts) */
  rollMs: 1000,
  /** one hop between neighbouring squares (the game schedules its step sounds on this) */
  stepMs: 140,

  pawn: {
    hopHeight: 0.3,
    landSquash: 0.1, // seconds the pawn takes to recover after each hop
    bobPeriod: 0.9, // movable pawns bounce at this rhythm
    knockBack: 0.3, // seconds
    flightMin: 0.35,
    flightMax: 0.8,
    settle: 0.55, // reached-home settle + glow
    appear: 0.45,
  },

  dice: {
    anticipate: 0.11, // squash, lift, scale up
    landAt: 0.7, // first touchdown, measured from the tap
    bounce1: 0.16,
    bounce2: 0.1,
    pulse: 0.28, // result emphasis after the last bounce
    travel: 0.45, // hopping to the next player's yard
    liftScale: 1.1,
  },
}

export const DICE = {
  size: 1,
  radius: 0.17,
  liftHeight: 0.34,
  arcHeight: 1.55, // apex of the tumble
  bounce1: 0.3,
  bounce2: 0.08,
  bounce1Six: 0.44,
  bounce2Six: 0.13,
  pulse: 1.1,
  pulseSix: 1.24,
  tilt: 0.22, // wobble amplitude in radians after landing
  tiltSix: 0.32,
  pipInk: '#2A1D2B',
  pipAce: '#B8301F',
  scatter: 0.3, // how far from the dish centre it may land
}

// ---------------------------------------------------------------------------------------------
// Easing: cubic-bezier curves and a damped spring, so nothing moves linearly
// ---------------------------------------------------------------------------------------------

/** CSS-style cubic-bezier(x1, y1, x2, y2) as a function of 0..1. */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t
  const sy = (t: number) => ((ay * t + by) * t + cy) * t
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    let t = x
    for (let i = 0; i < 6; i++) {
      const err = sx(t) - x
      if (Math.abs(err) < 1e-5) return sy(t)
      const d = dx(t)
      if (Math.abs(d) < 1e-6) break
      t -= err / d
    }
    let lo = 0
    let hi = 1
    t = x
    for (let i = 0; i < 24; i++) {
      const v = sx(t)
      if (Math.abs(v - x) < 1e-5) break
      if (v < x) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return sy(t)
  }
}

export const EASE = {
  /** fast start, long soft stop: tumbling and travelling */
  out: bezier(0.16, 0.84, 0.32, 1),
  inOut: bezier(0.65, 0, 0.35, 1),
  /** overshoots a little: things that pop into place */
  back: bezier(0.34, 1.56, 0.64, 1),
  /** slow lift, quick drop: hops */
  hop: bezier(0.3, 0, 0.7, 1),
}

/** Damped spring response to a unit impulse at t = 0: 1 at the start, decaying through zero. */
export const spring = (t: number, freq = 9, damping = 7) =>
  t < 0 ? 0 : Math.exp(-damping * t) * Math.cos(freq * t)

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k
/** Frame-rate independent exponential smoothing factor. */
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt)

// ---------------------------------------------------------------------------------------------
// Scene mood
// ---------------------------------------------------------------------------------------------

export const SCENE = {
  background: '#1B120D',
  fog: '#1B120D',
  keyLight: '#FFE9CC', // late-afternoon lamp
  fillLight: '#9DB4D6',
  dimYard: 0.8, // brightness of yards whose player is not on the move
  dimEmpty: 0.62, // yards with nobody seated
}
