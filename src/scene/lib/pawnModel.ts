import * as THREE from 'three'
import type { Color } from '../../core/game'
import { NEUTRAL, PALETTE, PAWN_STYLE, type HeadKind } from '../../core/theme'

/**
 * A turned-and-lacquered pawn, in the spirit of Channapatna toys: flared skirt, a bead collar, a slim neck
 * and one of four head shapes. It is a single lathe, painted with vertex colours in crisp lacquer bands.
 */

type P = [number, number]

const smooth = (pts: P[], perSegment = 7): P[] => {
  const curve = new THREE.CatmullRomCurve3(
    pts.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    false,
    'centripetal',
  )
  return curve.getPoints((pts.length - 1) * perSegment).map((p) => [Math.max(0, p.x), p.y])
}

/** Straight segments with hard corners: each corner gets a twin so the lathe keeps the edge sharp. */
const crisp = (pts: P[]): P[] => {
  const eps = 0.004
  const out: P[] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1]
    const [x, y] = pts[i]
    const [nx, ny] = pts[i + 1]
    const din = Math.hypot(x - px, y - py) || 1
    const dout = Math.hypot(nx - x, ny - y) || 1
    out.push(
      [x - ((x - px) / din) * eps, y - ((y - py) / din) * eps],
      [x, y],
      [x + ((nx - x) / dout) * eps, y + ((ny - y) / dout) * eps],
    )
  }
  out.push(pts[pts.length - 1])
  return out
}

const arc = (cy: number, r: number, from: number, to: number, n: number): P[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180
    return [Math.max(0, Math.cos(a) * r), cy + Math.sin(a) * r] as P
  })

// skirt, collar bead and neck: shared by every pawn
const BODY: P[] = [
  ...crisp([[0, 0], [0.38, 0], [0.41, 0.04]]),
  ...smooth([[0.41, 0.04], [0.41, 0.075], [0.37, 0.125], [0.29, 0.19], [0.2, 0.28], [0.15, 0.38], [0.14, 0.44]]).slice(1),
  ...smooth([[0.14, 0.44], [0.2, 0.47], [0.235, 0.52], [0.205, 0.57], [0.14, 0.595], [0.1, 0.62]]).slice(1),
]

const HEAD: Record<HeadKind, P[]> = {
  ball: arc(0.84, 0.245, -70, 90, 16),
  onion: [
    ...smooth([[0.1, 0.62], [0.15, 0.66], [0.235, 0.73], [0.26, 0.81], [0.225, 0.89], [0.13, 0.96], [0.05, 1.02], [0.022, 1.065]]).slice(1),
    ...arc(1.09, 0.036, -60, 90, 6),
  ],
  button: [
    ...smooth([[0.1, 0.62], [0.115, 0.7], [0.2, 0.75], [0.31, 0.78], [0.335, 0.84], [0.3, 0.9], [0.18, 0.93], [0, 0.94]]).slice(1),
  ],
  gem: crisp([[0.1, 0.62], [0.12, 0.68], [0.29, 0.77], [0.17, 0.9], [0.05, 0.965], [0, 0.97]]).slice(1),
}

const GIRDLE: Record<HeadKind, number> = { ball: 0.84, onion: 0.81, button: 0.84, gem: 0.77 }

const soft = (x: number, w = 0.006) => THREE.MathUtils.smoothstep(x, -w, w)
const band = (y: number, lo: number, hi: number) => soft(y - lo) * soft(hi - y)

const cache = new Map<Color, THREE.BufferGeometry>()

export const PAWN_HEIGHT: Record<HeadKind, number> = { ball: 1.085, onion: 1.125, button: 0.94, gem: 0.97 }

export function pawnGeometry(color: Color) {
  const hit = cache.get(color)
  if (hit) return hit
  const style = PAWN_STYLE[color]
  const profile = [...BODY, ...HEAD[style.head]]
  const geo = new THREE.LatheGeometry(
    profile.map(([x, y]) => new THREE.Vector2(x, y)),
    56,
  )
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const main = new THREE.Color(PALETTE[color].main)
  const dark = new THREE.Color(PALETTE[color].dark)
  const cream = new THREE.Color(NEUTRAL.bone)
  const out = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    out.copy(main)
    // lacquer bands on the skirt: as many rings as the player has bands
    for (let b = 0; b < style.bands; b++) {
      const yc = 0.17 + b * 0.055
      out.lerp(cream, band(y, yc - 0.013, yc + 0.013))
    }
    out.lerp(dark, 1 - soft(y - 0.03)) // the foot
    out.lerp(cream, band(y, 0.47, 0.57)) // collar bead
    out.lerp(dark, band(y, 0.585, 0.66) * 0.9) // neck
    out.lerp(cream, band(y, GIRDLE[style.head] - 0.012, GIRDLE[style.head] + 0.012)) // a fine line round the head
    if (style.head === 'onion') out.lerp(dark, soft(y - 1.04))
    colors.set([out.r, out.g, out.b], i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  cache.set(color, geo)
  return geo
}

let material: THREE.MeshPhysicalMaterial | null = null
/** Lacquered wood: satin colour under a thin clear coat. Shared by all pawns. */
export function pawnMaterial() {
  return (material ||= new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.5,
    clearcoat: 0.25,
    clearcoatRoughness: 0.5,
  }))
}
