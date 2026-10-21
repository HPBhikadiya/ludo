import * as THREE from 'three'
import { COLORS, type Color } from '../../core/game'
import { DICE, LAYOUT, NEUTRAL, PALETTE, PAWN_STYLE, type HeadKind } from '../../core/theme'

/**
 * Procedural art. Every texture is painted on a canvas with a seeded random source, so the "hand wear"
 * (uneven ink, misregistered prints, stitched outlines) is identical on every load and needs no image files.
 */

export const DISPLAY_FONT = '"Rozha One", "Playfair Display", Georgia, serif'

export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
type Rand = () => number

function surface(w: number, h = w) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!] as const
}

function toTexture(c: HTMLCanvasElement, opts: { srgb?: boolean; aniso?: number } = {}) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace
  t.anisotropy = opts.aniso ?? 8
  return t
}

const rgba = (hex: string, a = 1) => {
  const c = new THREE.Color(hex).convertLinearToSRGB()
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`
}

/** Plain-weave cloth: a 2px checker, slubby rows and columns, and fine noise, multiplied over what is there. */
function weave(g: CanvasRenderingContext2D, w: number, h: number, rand: Rand, amount: number) {
  const img = g.getImageData(0, 0, w, h)
  const d = img.data
  const rows = Float32Array.from({ length: h }, () => (rand() - 0.5) * amount * 1.1)
  const cols = Float32Array.from({ length: w }, () => (rand() - 0.5) * amount * 1.1)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const thread = ((x >> 1) + (y >> 1)) & 1 ? 0.5 : -0.5
      const k = 1 + thread * amount * 0.9 + rows[y] + cols[x] + (rand() - 0.5) * amount
      d[i] = Math.min(255, d[i] * k)
      d[i + 1] = Math.min(255, d[i + 1] * k)
      d[i + 2] = Math.min(255, d[i + 2] * k)
    }
  }
  g.putImageData(img, 0, 0)
}

/** Faint large-scale mottling, like dye that took unevenly. */
function mottle(g: CanvasRenderingContext2D, w: number, h: number, rand: Rand, n: number, strength: number) {
  for (let i = 0; i < n; i++) {
    const x = rand() * w
    const y = rand() * h
    const r = (0.15 + rand() * 0.45) * Math.max(w, h)
    const dark = rand() < 0.6
    const grad = g.createRadialGradient(x, y, 0, x, y, r)
    const col = dark ? '70,45,20' : '255,250,235'
    grad.addColorStop(0, `rgba(${col},${strength * (0.5 + rand() * 0.5)})`)
    grad.addColorStop(1, `rgba(${col},0)`)
    g.fillStyle = grad
    g.fillRect(0, 0, w, h)
  }
}

const jit = (rand: Rand, a: number) => (rand() - 0.5) * 2 * a

/** A rounded rectangle path wobbling like a line drawn by hand. */
function wobblyRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, rand: Rand, amt: number) {
  const pts: [number, number][] = []
  const step = 14
  const push = (px: number, py: number) => pts.push([px + jit(rand, amt), py + jit(rand, amt)])
  for (let px = x + r; px < x + w - r; px += step) push(px, y)
  for (let py = y + r; py < y + h - r; py += step) push(x + w, py)
  for (let px = x + w - r; px > x + r; px -= step) push(px, y + h)
  for (let py = y + h - r; py > y + r; py -= step) push(x, py)
  g.beginPath()
  pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)))
  g.closePath()
  g.lineJoin = 'round'
}

// ---------------------------------------------------------------------------------------------
// Squares
// ---------------------------------------------------------------------------------------------

/** Near-white cloth with a hand-drawn outline; the square's real colour comes from the material tint. */
export function tileTexture(seed: number) {
  const S = 256
  const rand = rng(seed * 977 + 13)
  const [c, g] = surface(S)
  g.fillStyle = '#fff'
  g.fillRect(0, 0, S, S)
  mottle(g, S, S, rand, 7, 0.07)
  weave(g, S, S, rand, 0.05)
  // soft double outline
  g.strokeStyle = rgba(NEUTRAL.tileEdge, 0.2)
  g.lineWidth = 7
  wobblyRect(g, 15, 15, S - 30, S - 30, 12, rand, 1.4)
  g.stroke()
  g.strokeStyle = rgba(NEUTRAL.tileEdge, 0.55)
  g.lineWidth = 2.4
  wobblyRect(g, 15, 15, S - 30, S - 30, 12, rand, 1.1)
  g.stroke()
  // wear: scuffs and a little grime near the corners
  for (let i = 0; i < 5; i++) {
    g.strokeStyle = `rgba(110,80,45,${0.03 + rand() * 0.05})`
    g.lineWidth = 0.7 + rand()
    g.beginPath()
    const x = rand() * S
    const y = rand() * S
    g.moveTo(x, y)
    g.lineTo(x + jit(rand, 40), y + jit(rand, 40))
    g.stroke()
  }
  const vg = g.createRadialGradient(S / 2, S / 2, S * 0.32, S / 2, S / 2, S * 0.78)
  vg.addColorStop(0, 'rgba(90,60,30,0)')
  vg.addColorStop(1, 'rgba(90,60,30,0.14)')
  g.fillStyle = vg
  g.fillRect(0, 0, S, S)
  return toTexture(c)
}

/** The eight-pointed block-print star used for safe squares. Printed twice, a hair out of register. */
export function starDecal(ink: string, accent: string | null) {
  const S = 256
  const rand = rng(41)
  const [c, g] = surface(S)
  const star = (dx: number, dy: number, color: string, alpha: number, scale = 1) => {
    g.fillStyle = rgba(color, alpha)
    g.beginPath()
    for (let i = 0; i < 16; i++) {
      const r = (i % 2 === 0 ? 86 : 38) * scale
      const a = (i / 16) * Math.PI * 2 - Math.PI / 2
      const px = S / 2 + dx + Math.cos(a) * r + jit(rand, 1.4)
      const py = S / 2 + dy + Math.sin(a) * r + jit(rand, 1.4)
      i ? g.lineTo(px, py) : g.moveTo(px, py)
    }
    g.closePath()
    g.fill()
  }
  star(2.5, 2, ink, 0.28) // the misregistered ghost
  star(0, 0, ink, 0.92)
  // ring of dots around the star
  g.fillStyle = rgba(ink, 0.8)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    g.beginPath()
    g.arc(S / 2 + Math.cos(a) * 108, S / 2 + Math.sin(a) * 108, 4.2 + rand(), 0, Math.PI * 2)
    g.fill()
  }
  // the eye of the star
  g.fillStyle = accent ? rgba(accent, 0.95) : rgba('#ffffff', 0.9)
  g.beginPath()
  g.arc(S / 2 + 1, S / 2 + 1, 17, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = rgba(ink, 0.9)
  g.beginPath()
  g.arc(S / 2 + 1, S / 2 + 1, 6.5, 0, Math.PI * 2)
  g.fill()
  return toTexture(c)
}

/** A brushed arrowhead pointing +x, in a player's colour. */
export function arrowDecal(color: Color) {
  const S = 256
  const rand = rng(7 + COLORS.indexOf(color))
  const [c, g] = surface(S)
  const { main, dark } = PALETTE[color]
  const path = (grow: number) => {
    const pts: [number, number][] = [
      [226, 128], [112, 36 - grow], [140, 104], [38 - grow, 104], [38 - grow, 152], [140, 152], [112, 220 + grow],
    ]
    g.beginPath()
    pts.forEach(([x, y], i) => {
      const px = x + jit(rand, 1.6)
      const py = y + jit(rand, 1.6)
      i ? g.lineTo(px, py) : g.moveTo(px, py)
    })
    g.closePath()
    g.lineJoin = 'round'
  }
  path(0)
  g.fillStyle = rgba(dark, 0.85)
  g.lineWidth = 12
  g.strokeStyle = rgba(dark, 0.85)
  g.stroke()
  path(0)
  g.fillStyle = rgba(main, 1)
  g.fill()
  // brush streaks
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.04 + rand() * 0.08})`
    g.lineWidth = 1 + rand() * 2.5
    const y = 60 + rand() * 140
    g.beginPath()
    g.moveTo(50 + rand() * 40, y)
    g.lineTo(150 + rand() * 70, y + jit(rand, 4))
    g.stroke()
  }
  return toTexture(c)
}

/** Two nested chevrons pointing +x, printed in cream on the coloured home-column squares. */
export function chevronDecal() {
  const S = 256
  const rand = rng(23)
  const [c, g] = surface(S)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (const [off, a] of [[0, 0.8], [-62, 0.55]] as const) {
    g.strokeStyle = rgba(NEUTRAL.bone, a)
    g.lineWidth = 17
    g.beginPath()
    g.moveTo(148 + off + jit(rand, 2), 62 + jit(rand, 2))
    g.lineTo(212 + off + jit(rand, 2), 128 + jit(rand, 2))
    g.lineTo(148 + off + jit(rand, 2), 194 + jit(rand, 2))
    g.stroke()
  }
  return toTexture(c)
}

// ---------------------------------------------------------------------------------------------
// Block-print motifs shared by cloth and yards
// ---------------------------------------------------------------------------------------------

function petalRosette(g: CanvasRenderingContext2D, x: number, y: number, r: number, petals: number, fill: string, alpha: number, rand: Rand) {
  g.fillStyle = rgba(fill, alpha)
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2
    g.save()
    g.translate(x + jit(rand, 0.6), y + jit(rand, 0.6))
    g.rotate(a)
    g.beginPath()
    g.moveTo(r * 0.28, 0)
    g.quadraticCurveTo(r * 0.7, -r * 0.34, r, 0)
    g.quadraticCurveTo(r * 0.7, r * 0.34, r * 0.28, 0)
    g.fill()
    g.restore()
  }
}

function diamond(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  g.beginPath()
  g.moveTo(x, y - ry)
  g.lineTo(x + rx, y)
  g.lineTo(x, y + ry)
  g.lineTo(x - rx, y)
  g.closePath()
}

function runningStitch(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string, alpha: number, lw: number, dash: number, offset = 0) {
  g.save()
  g.strokeStyle = rgba(color, alpha)
  g.lineWidth = lw
  g.lineCap = 'round'
  g.setLineDash([dash, dash * 0.75])
  g.lineDashOffset = offset
  g.beginPath()
  g.roundRect(x, y, w, h, r)
  g.stroke()
  g.restore()
}

// ---------------------------------------------------------------------------------------------
// The cloth
// ---------------------------------------------------------------------------------------------

const BAND = '#6E2B22' // madder-dyed border

/** The whole printed cloth: ground, border band with a diamond chain, corner rosettes. */
export function clothTexture() {
  const S = 2048
  const u = S / (LAYOUT.clothHalf * 2) // pixels per world unit
  const rand = rng(2024)
  const [c, g] = surface(S)
  g.fillStyle = NEUTRAL.cloth
  g.fillRect(0, 0, S, S)
  mottle(g, S, S, rand, 16, 0.06)

  const band = (LAYOUT.clothHalf - 7.5) * u // 0.9 units
  const four = COLORS.map((k) => PALETTE[k].main)

  // the border band, drawn once along the top edge and rotated into the four sides
  for (let side = 0; side < 4; side++) {
    g.save()
    g.translate(S / 2, S / 2)
    g.rotate((side * Math.PI) / 2)
    g.translate(-S / 2, -S / 2)
    g.fillStyle = BAND
    g.fillRect(0, 0, S, band)
    // paper-thin cream rules
    g.fillStyle = rgba(NEUTRAL.bone, 0.85)
    g.fillRect(0, band * 0.1, S, band * 0.045)
    g.fillRect(0, band * 0.845, S, band * 0.045)
    // sawtooth along the inner and outer rules
    const tooth = band * 0.2
    for (let x = band; x < S - band; x += tooth * 1.5) {
      g.fillStyle = rgba(NEUTRAL.bone, 0.9)
      g.beginPath()
      g.moveTo(x, band * 0.155)
      g.lineTo(x + tooth * 0.5, band * 0.155 + tooth * 0.55)
      g.lineTo(x + tooth, band * 0.155)
      g.fill()
      g.beginPath()
      g.moveTo(x, band * 0.84)
      g.lineTo(x + tooth * 0.5, band * 0.84 - tooth * 0.55)
      g.lineTo(x + tooth, band * 0.84)
      g.fill()
    }
    // the diamond chain, one player colour after another
    const pitch = band * 0.62
    let n = 0
    for (let x = band + pitch * 0.5; x < S - band; x += pitch, n++) {
      const cx = x + jit(rand, 0.8)
      const cy = band * 0.5 + jit(rand, 0.8)
      g.fillStyle = rgba(NEUTRAL.bone, 0.3)
      diamond(g, cx + 2, cy + 1.5, band * 0.27, band * 0.27) // misregistered ghost
      g.fill()
      g.fillStyle = rgba(NEUTRAL.bone, 0.95)
      diamond(g, cx, cy, band * 0.27, band * 0.27)
      g.fill()
      g.fillStyle = rgba(four[n % 4], 1)
      diamond(g, cx, cy, band * 0.17, band * 0.17)
      g.fill()
      g.fillStyle = rgba(NEUTRAL.bone, 0.9)
      g.beginPath()
      g.arc(cx, cy, band * 0.035, 0, Math.PI * 2)
      g.fill()
    }
    g.restore()
  }
  // corner rosettes
  for (const [cx, cy] of [[band / 2, band / 2], [S - band / 2, band / 2], [S - band / 2, S - band / 2], [band / 2, S - band / 2]]) {
    g.fillStyle = BAND
    g.fillRect(cx - band / 2, cy - band / 2, band, band)
    g.fillStyle = rgba(NEUTRAL.bone, 0.9)
    g.fillRect(cx - band * 0.4, cy - band * 0.4, band * 0.8, band * 0.8)
    g.fillStyle = BAND
    g.fillRect(cx - band * 0.34, cy - band * 0.34, band * 0.68, band * 0.68)
    petalRosette(g, cx, cy, band * 0.33, 8, NEUTRAL.bone, 0.95, rand)
    g.fillStyle = rgba(NEUTRAL.brass, 1)
    g.beginPath()
    g.arc(cx, cy, band * 0.07, 0, Math.PI * 2)
    g.fill()
  }

  // a stitched seam where the border meets the field
  runningStitch(g, band, band, S - 2 * band, S - 2 * band, 8, NEUTRAL.inkSoft, 0.45, 3.2, 14)
  // the field is a deeper tone, so the gaps between squares read as thin dark lines
  g.fillStyle = rgba(NEUTRAL.clothDeep, 0.55)
  g.fillRect(band + 6, band + 6, S - 2 * band - 12, S - 2 * band - 12)
  weave(g, S, S, rand, 0.075)
  return toTexture(c, { aniso: 16 })
}

/** The tileable fibre relief that makes the cloth catch the light. */
export function clothBump() {
  const S = 256
  const rand = rng(88)
  const [c, g] = surface(S)
  g.fillStyle = '#808080'
  g.fillRect(0, 0, S, S)
  weave(g, S, S, rand, 0.55)
  const t = toTexture(c, { srgb: false })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(24, 24)
  return t
}

// ---------------------------------------------------------------------------------------------
// Yards
// ---------------------------------------------------------------------------------------------

/**
 * One yard's printed top: coloured border band with a lotus chain, a stitched seam, a pale field
 * printed with a small lattice, a ring of petals around each pawn spot, and a rosette for the dice.
 * Local u/v follow the extruded panel: x right, y up (= world -z).
 */
export function yardTexture(color: Color) {
  const S = 1024
  const u = S / LAYOUT.yard
  const rand = rng(100 + COLORS.indexOf(color) * 31)
  const { light, main, dark } = PALETTE[color]
  const [c, g] = surface(S)
  g.fillStyle = main
  g.fillRect(0, 0, S, S)
  mottle(g, S, S, rand, 12, 0.07)

  // border band: a row of cream temple-roof teeth pointing inwards, with a dot between each
  const band = 0.52 * u
  const teeth = 20
  for (let side = 0; side < 4; side++) {
    g.save()
    g.translate(S / 2, S / 2)
    g.rotate((side * Math.PI) / 2)
    g.translate(-S / 2, -S / 2)
    g.fillStyle = rgba(dark, 0.4)
    g.fillRect(0, band * 0.12, S, band * 0.05)
    for (let i = 0; i < teeth; i++) {
      const x = ((i + 0.5) / teeth) * S
      const w = (S / teeth) * 0.36
      g.fillStyle = rgba(light, 0.92)
      g.beginPath()
      g.moveTo(x - w + jit(rand, 0.6), band * 0.22)
      g.lineTo(x + w + jit(rand, 0.6), band * 0.22)
      g.lineTo(x + jit(rand, 0.6), band * 0.78)
      g.closePath()
      g.fill()
      g.fillStyle = rgba(dark, 0.85)
      g.beginPath()
      g.arc(x + S / teeth / 2, band * 0.36, band * 0.05, 0, Math.PI * 2)
      g.fill()
    }
    g.restore()
  }
  runningStitch(g, band + 4, band + 4, S - 2 * band - 8, S - 2 * band - 8, 0.2 * u, NEUTRAL.bone, 0.85, 3.4, 13)

  // the pale field
  const fx = band + 14
  const fw = S - 2 * fx
  g.fillStyle = rgba(light, 1)
  g.beginPath()
  g.roundRect(fx, fx, fw, fw, 0.16 * u)
  g.fill()
  mottle(g, S, S, rand, 6, 0.05)
  // lattice of tiny four-petal flowers, printed pale-on-pale so it stays in the background
  const pitch = 0.5 * u
  for (let y = fx + pitch / 2; y < fx + fw; y += pitch) {
    for (let x = fx + pitch / 2; x < fx + fw; x += pitch) {
      petalRosette(g, x + jit(rand, 1.4), y + jit(rand, 1.4), 0.1 * u, 4, dark, 0.13, rand)
    }
  }
  // rings of petals around the pawn spots
  for (const dx of [-1, 1]) {
    for (const dy of [-1, 1]) {
      const cx = S / 2 + dx * 1.0 * u
      const cy = S / 2 + dy * 1.0 * u
      petalRosette(g, cx, cy, 0.9 * u, 12, main, 0.9, rand)
      g.fillStyle = rgba(light, 1)
      g.beginPath()
      g.arc(cx, cy, 0.72 * u, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = rgba(dark, 0.9)
      g.lineWidth = 3.4
      g.beginPath()
      g.arc(cx, cy, 0.72 * u, 0, Math.PI * 2)
      g.stroke()
    }
  }
  // the dice dish
  const dr = LAYOUT.diceDish * u
  g.fillStyle = rgba(dark, 0.14)
  g.beginPath()
  g.arc(S / 2, S / 2, dr * 1.28, 0, Math.PI * 2)
  g.fill()
  petalRosette(g, S / 2, S / 2, dr * 1.28, 8, main, 0.55, rand)
  g.fillStyle = rgba(light, 1)
  g.beginPath()
  g.arc(S / 2, S / 2, dr, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = rgba(dark, 0.9)
  g.lineWidth = 3.4
  g.beginPath()
  g.arc(S / 2, S / 2, dr, 0, Math.PI * 2)
  g.stroke()
  g.strokeStyle = rgba(main, 0.8)
  g.lineWidth = 2
  g.setLineDash([9, 8])
  g.beginPath()
  g.arc(S / 2, S / 2, dr * 0.86, 0, Math.PI * 2)
  g.stroke()
  g.setLineDash([])
  petalRosette(g, S / 2, S / 2, dr * 0.62, 8, main, 0.22, rand)
  weave(g, S, S, rand, 0.06)
  const t = toTexture(c, { aniso: 16 })
  return t
}

/** A dark, soft-edged floor for a recessed pawn spot (cheap ambient occlusion). */
export function recessTexture(color: Color) {
  const S = 128
  const [c, g] = surface(S)
  const grad = g.createRadialGradient(S / 2, S / 2, S * 0.08, S / 2, S / 2, S / 2)
  const floor = new THREE.Color(PALETTE[color].dark).lerp(new THREE.Color(PALETTE[color].main), 0.4).getStyle()
  grad.addColorStop(0, floor)
  grad.addColorStop(0.6, floor)
  grad.addColorStop(1, rgba(PALETTE[color].dark, 1))
  g.fillStyle = grad
  g.fillRect(0, 0, S, S)
  return toTexture(c)
}

/** The moving stitch border drawn around the active player's yard; redrawn every frame by Yard. */
export function paintYardStitch(c: HTMLCanvasElement, color: Color, phase: number) {
  const g = c.getContext('2d')!
  const S = c.width
  const u = S / LAYOUT.yard
  g.clearRect(0, 0, S, S)
  const inset = 0.12 * u
  runningStitch(g, inset, inset, S - 2 * inset, S - 2 * inset, 0.3 * u, NEUTRAL.bone, 0.95, 0.09 * u, 0.2 * u, -phase * 0.5 * u)
  runningStitch(g, inset, inset, S - 2 * inset, S - 2 * inset, 0.3 * u, PALETTE[color].dark, 0.35, 0.03 * u, 0.2 * u, -phase * 0.5 * u + 0.2 * u * 0.4)
}

// ---------------------------------------------------------------------------------------------
// Centre of the board
// ---------------------------------------------------------------------------------------------

/** Running-stitch outlines inside each of the four home triangles, on a transparent 3x3 sheet. */
export function centerStitchTexture() {
  const S = 768
  const u = S / 3
  const [c, g] = surface(S)
  const tri = (pts: [number, number][], inset: number) => {
    // pull the corners towards the centroid
    const cx = pts.reduce((s, p) => s + p[0], 0) / 3
    const cy = pts.reduce((s, p) => s + p[1], 0) / 3
    return pts.map(([x, y]) => [cx + (x - cx) * inset, cy + (y - cy) * inset] as [number, number])
  }
  const m = S / 2
  const raw: [number, number][][] = [
    [[0, 0], [0, S], [m, m]],
    [[0, 0], [S, 0], [m, m]],
    [[S, 0], [S, S], [m, m]],
    [[0, S], [S, S], [m, m]],
  ]
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (const t of raw) {
    for (const [inset, a] of [[0.86, 0.85], [0.68, 0.45]] as const) {
      g.strokeStyle = rgba(NEUTRAL.bone, a)
      g.lineWidth = 0.035 * u
      g.setLineDash([0.12 * u, 0.1 * u])
      g.beginPath()
      tri(t, inset).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
      g.closePath()
      g.stroke()
    }
  }
  return toTexture(c)
}

// ---------------------------------------------------------------------------------------------
// Table, wood and labels
// ---------------------------------------------------------------------------------------------

/** Dark teak planks with long grain; the grain runs along x. */
export function woodTexture(opts: { base: string; light: string; planks?: number; size?: number; seed?: number; vertical?: boolean }) {
  const S = opts.size ?? 1024
  const planks = opts.planks ?? 1
  const rand = rng(opts.seed ?? 5)
  const [c, g] = surface(S)
  const ph = S / planks
  for (let p = 0; p < planks; p++) {
    const y0 = p * ph
    const k = 0.82 + rand() * 0.36
    g.fillStyle = rgba(opts.base, 1)
    g.fillRect(0, y0, S, ph)
    g.fillStyle = `rgba(${k > 1 ? '255,220,170' : '0,0,0'},${Math.abs(k - 1) * 0.55})`
    g.fillRect(0, y0, S, ph)
    const phase = rand() * 50
    const lines = Math.round(ph * 0.9)
    for (let i = 0; i < lines; i++) {
      const y = y0 + rand() * ph
      const dark = rand() < 0.55
      g.strokeStyle = dark ? `rgba(8,3,0,${0.05 + rand() * 0.16})` : rgba(opts.light, 0.04 + rand() * 0.1)
      g.lineWidth = 0.5 + rand() * (ph / 120 + 1.2)
      g.beginPath()
      const wob = 1.5 + rand() * 3
      for (let x = 0; x <= S; x += 24) g.lineTo(x, y + Math.sin(x * 0.01 + i * 0.7 + phase) * wob)
      g.stroke()
    }
    // a knot or two
    if (rand() < 0.6) {
      const kx = rand() * S
      const ky = y0 + ph * (0.25 + rand() * 0.5)
      for (let r = 4; r < 26; r += 4) {
        g.strokeStyle = `rgba(8,3,0,${0.18 - r * 0.005})`
        g.lineWidth = 1.3
        g.beginPath()
        g.ellipse(kx, ky, r * 2.1, r * 0.7, 0, 0, Math.PI * 2)
        g.stroke()
      }
    }
    // the seam between planks
    g.fillStyle = 'rgba(0,0,0,0.55)'
    g.fillRect(0, y0, S, 2)
    g.fillStyle = 'rgba(255,220,170,0.06)'
    g.fillRect(0, y0 + 2, S, 1.5)
  }
  const t = toTexture(c, { aniso: 16 })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  if (opts.vertical) {
    t.center.set(0.5, 0.5)
    t.rotation = Math.PI / 2
  }
  return t
}

/** A soft rounded-rectangle shadow, sat under the board so it rests on the table. */
export function boardShadowTexture() {
  const S = 512
  const [c, g] = surface(S)
  g.filter = 'blur(26px)'
  g.fillStyle = 'rgba(0,0,0,0.9)'
  g.beginPath()
  g.roundRect(120, 120, S - 240, S - 240, 20)
  g.fill()
  return toTexture(c, { srgb: false })
}

export function blobTexture() {
  const S = 128
  const [c, g] = surface(S)
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  grad.addColorStop(0, 'rgba(0,0,0,0.8)')
  grad.addColorStop(0.45, 'rgba(0,0,0,0.38)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, S, S)
  return toTexture(c, { srgb: false })
}

/** A soft ring (white; tinted by the material) for movable pawns and the dice cue. */
export function ringTexture() {
  const S = 256
  const [c, g] = surface(S)
  const grad = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.5)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.55, 'rgba(255,255,255,0.95)')
  grad.addColorStop(0.75, 'rgba(255,255,255,0.7)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, S, S)
  return toTexture(c)
}

export function glowTexture() {
  const S = 128
  const [c, g] = surface(S)
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.4)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, S, S)
  return toTexture(c)
}

/** Silhouette of a pawn head, used for the corner emblems (and mirrored by icons.tsx). */
export function drawHeadIcon(g: CanvasRenderingContext2D, kind: HeadKind, cx: number, cy: number, r: number) {
  g.beginPath()
  if (kind === 'ball') {
    g.arc(cx, cy - r * 0.1, r * 0.62, 0, Math.PI * 2)
  } else if (kind === 'onion') {
    g.moveTo(cx, cy - r * 0.95)
    g.bezierCurveTo(cx + r * 0.12, cy - r * 0.5, cx + r * 0.78, cy - r * 0.35, cx + r * 0.62, cy + r * 0.12)
    g.bezierCurveTo(cx + r * 0.5, cy + r * 0.55, cx - r * 0.5, cy + r * 0.55, cx - r * 0.62, cy + r * 0.12)
    g.bezierCurveTo(cx - r * 0.78, cy - r * 0.35, cx - r * 0.12, cy - r * 0.5, cx, cy - r * 0.95)
  } else if (kind === 'button') {
    g.ellipse(cx, cy, r * 0.86, r * 0.5, 0, 0, Math.PI * 2)
  } else {
    g.moveTo(cx, cy - r * 0.9)
    g.lineTo(cx + r * 0.7, cy - r * 0.05)
    g.lineTo(cx, cy + r * 0.55)
    g.lineTo(cx - r * 0.7, cy - r * 0.05)
    g.closePath()
  }
  g.fill()
  // pedestal so the four icons share a baseline
  g.beginPath()
  g.roundRect(cx - r * 0.5, cy + r * 0.55, r, r * 0.3, r * 0.1)
  g.fill()
}

/** Printed name plate for one player: emblem and name, drawn on the cloth border. */
export function labelTexture(color: Color, name: string) {
  const W = 1024
  const H = 192
  const [c, g] = surface(W, H)
  const { main } = PALETTE[color]
  const cx = 112
  const cy = H / 2
  // a sewn-on tag: dark madder cloth, cream stitching
  g.fillStyle = rgba('#3A140F', 1)
  g.beginPath()
  g.roundRect(6, 8, W - 12, H - 16, 44)
  g.fill()
  runningStitch(g, 18, 20, W - 36, H - 40, 34, NEUTRAL.bone, 0.7, 3.5, 13)
  // emblem: dyed disc with a cream ring and the pawn's head
  g.fillStyle = rgba(NEUTRAL.bone, 0.95)
  g.beginPath()
  g.arc(cx, cy, 70, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = rgba(main, 1)
  g.beginPath()
  g.arc(cx, cy, 60, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = rgba(NEUTRAL.bone, 1)
  drawHeadIcon(g, PAWN_STYLE[color].head, cx, cy + 5, 43)
  // name, centred in the space beside the emblem
  g.font = `92px ${DISPLAY_FONT}`
  g.textBaseline = 'middle'
  g.textAlign = 'center'
  if ('letterSpacing' in g) (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '14px'
  const tx = (cx + 70 + W - 36) / 2 + 7
  g.fillStyle = 'rgba(10,3,1,0.55)'
  g.fillText(name.toUpperCase(), tx + 3, cy + 8)
  g.fillStyle = rgba(NEUTRAL.bone, 1)
  g.fillText(name.toUpperCase(), tx, cy + 5)
  return toTexture(c)
}

/** Count badge for stacked pawns. */
export function badgeTexture(n: number) {
  const S = 128
  const [c, g] = surface(S)
  g.fillStyle = rgba(NEUTRAL.ink, 0.95)
  g.beginPath()
  g.arc(S / 2, S / 2, 56, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = rgba(NEUTRAL.bone, 1)
  g.beginPath()
  g.arc(S / 2, S / 2, 48, 0, Math.PI * 2)
  g.fill()
  g.font = `64px ${DISPLAY_FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = rgba(NEUTRAL.ink, 1)
  g.fillText(String(n), S / 2, S / 2 + 6)
  return toTexture(c)
}

// ---------------------------------------------------------------------------------------------
// Dice
// ---------------------------------------------------------------------------------------------

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.22], [0.73, 0.22], [0.27, 0.5], [0.73, 0.5], [0.27, 0.78], [0.73, 0.78]],
}

/**
 * One die face: bone-white grain, and pips carved into the surface. The pips are real depressions
 * (a height map turned into a normal map), so they catch the light instead of being flat dots.
 */
export function diceFaceMaps(value: number) {
  const S = 256
  const rand = rng(300 + value)
  const [c, g] = surface(S)
  g.fillStyle = '#fff'
  g.fillRect(0, 0, S, S)
  mottle(g, S, S, rand, 5, 0.05)
  weave(g, S, S, rand, 0.025)

  const height = new Float32Array(S * S).fill(0.5)
  const ace = value === 1
  for (const [px, py] of PIPS[value]) {
    const cx = px * S
    const cy = py * S
    const r = ace ? 31 : 21
    // the painted pip
    const ink = ace ? DICE.pipAce : DICE.pipInk
    const grad = g.createRadialGradient(cx - r * 0.25, cy - r * 0.25, r * 0.1, cx, cy, r)
    grad.addColorStop(0, rgba(ink, 1))
    grad.addColorStop(1, rgba(NEUTRAL.ink, 1))
    g.fillStyle = grad
    g.beginPath()
    g.arc(cx, cy, r, 0, Math.PI * 2)
    g.fill()
    // carve the height map: a smooth bowl
    const R = r * 1.15
    for (let y = Math.max(0, Math.floor(cy - R)); y < Math.min(S, Math.ceil(cy + R)); y++) {
      for (let x = Math.max(0, Math.floor(cx - R)); x < Math.min(S, Math.ceil(cx + R)); x++) {
        const d = Math.hypot(x - cx, y - cy) / R
        if (d < 1) height[y * S + x] -= 0.5 * Math.pow(1 - d * d, 0.8)
      }
    }
  }
  // normal map from the height map
  const [n, ng] = surface(S)
  const img = ng.createImageData(S, S)
  const strength = 7
  const at = (x: number, y: number) => height[Math.min(S - 1, Math.max(0, y)) * S + Math.min(S - 1, Math.max(0, x))]
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength
      const len = Math.hypot(dx, dy, 1)
      const i = (y * S + x) * 4
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  ng.putImageData(img, 0, 0)
  return { map: toTexture(c), normal: toTexture(n, { srgb: false }) }
}
