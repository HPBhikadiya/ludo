import * as THREE from 'three'
import { DICE, EASE, TIMING, clamp01, lerp, spring } from '../../core/theme'

/**
 * The tap-to-result timeline of one dice roll, as a pure function of time.
 *
 *   0 ─ anticipate ─ tumble ─────────────────────── land ─ bounce ─ bounce ─ pulse
 *   squash + lift    arc, spinning on two axes,      first   (lower)   (lower)  emphasis on
 *   + scale up       ease-out so it starts fast      touch                      the result
 *
 * With the default timings the die is settled flat ~0.96s after the tap (the game resolves the roll at
 * 1.0s) and the emphasis pulse runs on into the pawn highlight.
 */

export interface RollPlan {
  six: boolean
  /** ground position at the tap, and where it comes to rest (world x,z) */
  from: [number, number]
  land: [number, number]
  q0: THREE.Quaternion
  qf: THREE.Quaternion
  spins: { axis: THREE.Vector3; turns: number }[]
  tiltAxis: THREE.Vector3
}

export interface RollPose {
  x: number
  z: number
  /** height of the die's underside above the surface */
  lift: number
  /** non-uniform squash/stretch, uniform scale */
  sy: number
  sxz: number
  uni: number
  quat: THREE.Quaternion
  done: boolean
}

export const newPose = (): RollPose => ({ x: 0, z: 0, lift: 0, sy: 1, sxz: 1, uni: 1, quat: new THREE.Quaternion(), done: false })

const D = TIMING.dice
export const SETTLED_AT = D.landAt + D.bounce1 + D.bounce2
export const TOTAL = SETTLED_AT + D.pulse - 0.03

const _q = new THREE.Quaternion()
const _w = new THREE.Quaternion()

const hump = (u: number) => 4 * u * (1 - u)

export function sampleRoll(t: number, plan: RollPlan, out: RollPose): RollPose {
  const { six } = plan
  const A = D.anticipate
  const L = D.landAt
  out.x = plan.from[0]
  out.z = plan.from[1]
  out.lift = 0
  out.sy = out.sxz = out.uni = 1
  out.done = false
  let spin = 0
  let tilt = 0

  if (t < A) {
    // anticipation: a quick squat, then up and bigger
    const u = clamp01(t / A)
    out.lift = DICE.liftHeight * EASE.out(clamp01((u - 0.25) / 0.75))
    const down = u < 0.45 ? Math.sin((Math.PI * u) / 0.45) : 0
    const up = u >= 0.45 ? Math.sin((Math.PI * (u - 0.45)) / 0.55) : 0
    out.sy = 1 - 0.14 * down + 0.06 * up
    out.sxz = 1 + 0.07 * down - 0.03 * up
    out.uni = lerp(1, D.liftScale, EASE.out(u))
  } else if (t < L) {
    // tumble: one arc, fast then slowing
    const u = (t - A) / (L - A)
    const e = EASE.out(u)
    out.lift = DICE.liftHeight * (1 - u) + DICE.arcHeight * hump(u)
    out.uni = lerp(D.liftScale, 1, EASE.out(u))
    out.x = lerp(plan.from[0], plan.land[0], e)
    out.z = lerp(plan.from[1], plan.land[1], e)
    spin = e
  } else {
    // landing: two decreasing bounces, impact squashes, a decaying wobble, then the result pulse
    const tau = t - L
    out.x = plan.land[0]
    out.z = plan.land[1]
    spin = 1
    const B1 = D.bounce1
    const B2 = D.bounce2
    const h1 = six ? DICE.bounce1Six : DICE.bounce1
    const h2 = six ? DICE.bounce2Six : DICE.bounce2
    if (tau < B1) out.lift = h1 * hump(tau / B1)
    else if (tau < B1 + B2) out.lift = h2 * hump((tau - B1) / B2)
    const amp = six ? [0.22, 0.09, 0.04] : [0.15, 0.06, 0.03]
    const sq = amp[0] * spring(tau, 30, 17) + amp[1] * spring(tau - B1, 30, 17) + amp[2] * spring(tau - B1 - B2, 30, 17)
    out.sy = 1 - sq
    out.sxz = 1 + 0.5 * sq
    const pt = tau - (B1 + B2 - 0.03)
    if (pt > 0 && pt < D.pulse) out.uni = 1 + ((six ? DICE.pulseSix : DICE.pulse) - 1) * Math.sin((Math.PI * pt) / D.pulse)
    tilt = (six ? DICE.tiltSix : DICE.tilt) * Math.exp(-7 * tau) * Math.sin(2 * Math.PI * 3.4 * tau)
    out.done = t >= TOTAL
  }

  // orientation: whole turns about two axes (ease-out), folded over the slide from the old pose to the new
  out.quat.slerpQuaternions(plan.q0, plan.qf, spin)
  for (const s of plan.spins) {
    _q.setFromAxisAngle(s.axis, Math.PI * 2 * s.turns * spin)
    out.quat.premultiply(_q)
  }
  if (tilt !== 0) out.quat.premultiply(_w.setFromAxisAngle(plan.tiltAxis, tilt))
  return out
}
