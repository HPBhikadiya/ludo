import { memo, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { HOME, cellFor, tokenWorld, type Color } from './game'
import { EASE, GROUND, PALETTE, RECESS, TIMING, clamp01, damp, lerp, spring } from './theme'
import { blobTexture, glowTexture, ringTexture } from './textures'
import { pawnGeometry, pawnMaterial } from './pawnModel'
import { useGame } from './store'

type V2 = [number, number]
type Seg =
  | { k: 'hop'; to: V2; dur: number; h: number }
  | { k: 'fly'; to: V2; dur: number; h: number }
  | { k: 'wait'; dur: number }
  | { k: 'knock'; dir: V2; dur: number }
type Live = Seg & { u: number; from: V2 }

const P = TIMING.pawn
const STEP = TIMING.stepMs / 1000
const flightTime = (dist: number) => Math.min(P.flightMax, Math.max(P.flightMin, dist * 0.05))
const flightHeight = (dist: number) => 0.9 + Math.min(2.2, dist * 0.12)

// shared by every pawn
let fx: { blob: THREE.Texture; ring: THREE.Texture; glow: THREE.Texture; plane: THREE.PlaneGeometry; hit: THREE.CylinderGeometry } | null = null
const assets = () =>
  (fx ||= {
    blob: blobTexture(),
    ring: ringTexture(),
    glow: glowTexture(),
    plane: new THREE.PlaneGeometry(1, 1),
    hit: new THREE.CylinderGeometry(0.58, 0.58, 1.3, 12),
  })

/** Hops square by square, but flies when it jumps further (leaving the yard, a long flight home). */
function buildPath(color: Color, idx: number, from: number, to: number): Seg[] {
  if (from >= 0 && to > from && to <= HOME && to - from <= 6) {
    const out: Seg[] = []
    for (let p = from + 1; p <= to; p++) out.push({ k: 'hop', to: tokenWorld(color, p, idx), dur: STEP, h: P.hopHeight })
    return out
  }
  return []
}

interface PawnProps {
  color: Color
  idx: number
  p: number
  offset: [number, number]
  scale: number
  selectable: boolean
}

function Pawn({ color, idx, p, offset, scale, selectable }: PawnProps) {
  const a = assets()
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const floor = useRef<THREE.Group>(null)
  const blob = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const ripple = useRef<THREE.Mesh>(null)
  const glow = useRef<THREE.Mesh>(null)
  const prevP = useRef(p)
  const move = useGame((s) => s.move)
  const setHover = useGame((s) => s.setHover)

  const geometry = useMemo(() => pawnGeometry(color), [color])
  const material = pawnMaterial()
  const shades = PALETTE[color]
  const ringColor = useMemo(() => new THREE.Color(shades.main).lerp(new THREE.Color('#ffffff'), 0.05), [shades.main])
  const glowColor = useMemo(() => new THREE.Color(shades.main).lerp(new THREE.Color('#ffe9b8'), 0.55), [shades.main])

  const initial = useMemo(() => {
    const [x, z] = tokenWorld(color, p, idx)
    return [x + offset[0], z + offset[1]] as V2
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const s = useRef({
    x: initial[0],
    z: initial[1],
    queue: [] as Seg[],
    seg: null as Live | null,
    yOff: 0,
    knock: [0, 0] as V2,
    tilt: 0,
    tiltAxis: new THREE.Vector3(1, 0, 0),
    shake: 0,
    landT: 99,
    landAmp: 0,
    settleT: 99,
    restY: GROUND - (p < 0 ? RECESS : 0),
    appear: 0,
    bob: 0,
    lift: 0,
    sel: 0,
    clock: 0,
    finalP: p,
  })

  // a change of progress (or of where it stands in a stack) queues the animation to get there
  useEffect(() => {
    const st = s.current
    const from = prevP.current
    prevP.current = p
    st.finalP = p
    const dest: V2 = (() => {
      const [x, z] = tokenWorld(color, p, idx)
      return [x + offset[0], z + offset[1]]
    })()
    const hopsTo = (list: Seg[]) => {
      // the last hop carries the stack offset
      const last = list[list.length - 1]
      if (last && 'to' in last) last.to = dest
      return list
    }

    if (p === from) {
      // only the stack offset changed: shuffle over, unless we are already there (first mount)
      if (Math.hypot(dest[0] - st.x, dest[1] - st.z) > 0.002) {
        st.queue = [{ k: 'hop', to: dest, dur: 0.2, h: 0.08 }]
        st.seg = null
      }
      return
    }
    if (p === -1 && from >= 0) {
      // captured: wait for the capturer to land, get knocked, then fly home
      const capturerArrives = useGame.getState().dice.value * STEP
      const here = cellFor(color, from)
      const next = from < 50 ? cellFor(color, from + 1) : here
      const d: V2 = [next[0] - here[0], next[1] - here[1]]
      const len = Math.hypot(d[0], d[1]) || 1
      const [fx0, fz0] = [st.x, st.z]
      const dist = Math.hypot(dest[0] - fx0, dest[1] - fz0)
      st.queue = [
        { k: 'wait', dur: capturerArrives },
        { k: 'knock', dir: [d[0] / len, d[1] / len], dur: P.knockBack },
        { k: 'fly', to: dest, dur: flightTime(dist), h: flightHeight(dist) },
      ]
      st.seg = null
      return
    }
    const path = buildPath(color, idx, from, p)
    if (path.length) st.queue = hopsTo(path)
    else {
      const dist = Math.hypot(dest[0] - st.x, dest[1] - st.z)
      st.queue = [{ k: 'fly', to: dest, dur: flightTime(dist), h: flightHeight(dist) }]
    }
    st.seg = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, offset[0], offset[1]])

  useFrame((state, dt) => {
    const g = root.current
    const b = body.current
    if (!g || !b || !floor.current) return
    const st = s.current
    st.clock += dt
    const hovered = useGame.getState().hover === idx

    // ---- advance the queued animation -------------------------------------------------------
    if (!st.seg && st.queue.length) {
      const next = st.queue.shift()!
      st.seg = { ...next, u: 0, from: [st.x, st.z] } as Live
    }
    const seg = st.seg
    if (seg) {
      seg.u = Math.min(1, seg.u + dt / seg.dur)
      const u = seg.u
      if (seg.k === 'hop') {
        const e = lerp(u, EASE.inOut(u), 0.45) // a touch of ease keeps a run of hops from feeling mechanical
        st.x = lerp(seg.from[0], seg.to[0], e)
        st.z = lerp(seg.from[1], seg.to[1], e)
        st.yOff = Math.sin(u * Math.PI) * seg.h
      } else if (seg.k === 'fly') {
        const e = EASE.inOut(u)
        st.x = lerp(seg.from[0], seg.to[0], e)
        st.z = lerp(seg.from[1], seg.to[1], e)
        st.yOff = Math.sin(u * Math.PI) * seg.h
        st.tilt = 0.25 * Math.sin(u * Math.PI * 2) * (1 - u)
      } else if (seg.k === 'knock') {
        const e = EASE.out(u)
        st.knock = [seg.dir[0] * 0.34 * e, seg.dir[1] * 0.34 * e]
        st.yOff = Math.sin(u * Math.PI) * 0.16
        st.tilt = 0.5 * Math.sin(Math.min(1, u * 1.6) * Math.PI) * (1 - u * 0.4)
        st.tiltAxis.set(seg.dir[1], 0, -seg.dir[0])
        st.shake = Math.sin(u * 46) * 0.05 * (1 - u)
      }
      if (u >= 1) {
        if (seg.k === 'hop' || seg.k === 'fly') {
          st.x = seg.to[0]
          st.z = seg.to[1]
          st.yOff = 0
          st.landT = 0
          st.landAmp = seg.k === 'fly' ? 0.17 : 0.09
          st.tilt = 0
          if (!st.queue.length && st.finalP === HOME) st.settleT = 0
        } else if (seg.k === 'knock') {
          st.x += st.knock[0]
          st.z += st.knock[1]
          st.knock = [0, 0]
          st.shake = 0
          st.yOff = 0
        }
        st.seg = null
      }
    }
    const idle = !st.seg && !st.queue.length

    // ---- idle states: movable bounce, hover lift --------------------------------------------
    let bobY = 0
    let bobSquash = 0
    if (selectable && idle) {
      st.bob += dt
      const ph = (st.bob % P.bobPeriod) / P.bobPeriod
      const bounce = Math.abs(Math.sin(ph * Math.PI))
      bobY = bounce * 0.17
      bobSquash = Math.pow(1 - bounce, 10) * 0.07
    } else st.bob = 0
    st.sel += ((hovered && selectable ? 1 : 0) - st.sel) * damp(14, dt)
    st.lift = st.sel * 0.16

    // ---- height of the surface it stands on --------------------------------------------------
    const goalY = GROUND - (st.finalP < 0 && idle ? RECESS : 0)
    st.restY += (goalY - st.restY) * damp(18, dt)

    // ---- pose --------------------------------------------------------------------------------
    st.landT += dt
    st.settleT += dt
    st.appear = Math.min(1, st.appear + dt / P.appear)
    const squash = st.landAmp * spring(st.landT, 26, 15) + bobSquash + 0.16 * spring(st.settleT, 20, 9) * (st.settleT < P.settle ? 1 : 0)
    const base = scale * (0.0001 + EASE.back(st.appear)) * (1 + 0.08 * st.sel)

    const px = st.x + st.knock[0] + st.shake
    const pz = st.z + st.knock[1]
    const h = st.yOff + bobY + st.lift
    g.position.set(px, st.restY + h, pz)
    b.scale.set(base * (1 + squash * 0.5), base * (1 - squash), base * (1 + squash * 0.5))
    if (st.tilt !== 0) b.quaternion.setFromAxisAngle(st.tiltAxis, st.tilt)
    else b.quaternion.identity()

    // ---- things that stay on the board --------------------------------------------------------
    const f = floor.current
    f.position.set(px, st.restY + 0.003, pz)
    f.scale.setScalar(scale * Math.max(0.0001, st.appear))
    if (blob.current) {
      const m = blob.current.material as THREE.MeshBasicMaterial
      const spread = 1.2 + h * 0.3 + st.sel * 0.35
      blob.current.scale.setScalar(spread)
      m.opacity = (0.5 / (1 + h * 1.4)) * (1 + st.sel * 0.3)
    }
    if (ring.current && ripple.current) {
      const on = selectable && idle
      ring.current.visible = ripple.current.visible = on
      if (on) {
        const t = state.clock.elapsedTime
        const pulse = 0.5 + 0.5 * Math.sin(t * (Math.PI * 2) / P.bobPeriod)
        ring.current.scale.setScalar(1.25 + pulse * 0.1 + st.sel * 0.12)
        ;(ring.current.material as THREE.MeshBasicMaterial).opacity = 0.55 + pulse * 0.3 + st.sel * 0.15
        const r = (t / (P.bobPeriod * 1.6)) % 1
        ripple.current.scale.setScalar(1.15 + r * 0.8)
        ;(ripple.current.material as THREE.MeshBasicMaterial).opacity = (1 - r) * 0.5
      }
    }
    if (glow.current) {
      const on = st.settleT < P.settle * 1.8
      glow.current.visible = on
      if (on) {
        const k = clamp01(st.settleT / (P.settle * 1.8))
        glow.current.scale.setScalar(1.6 + k * 1.6)
        ;(glow.current.material as THREE.MeshBasicMaterial).opacity = (1 - k) * (1 - k) * 0.85
      }
    }
  })

  const FLOOR_Z = [-Math.PI / 2, 0, 0] as const
  return (
    <>
      <group ref={floor} position={[initial[0], GROUND, initial[1]]}>
        <mesh ref={blob} geometry={a.plane} rotation={FLOOR_Z} renderOrder={1}>
          <meshBasicMaterial map={a.blob} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-4} color="#1a0d06" />
        </mesh>
        <mesh ref={ring} geometry={a.plane} rotation={FLOOR_Z} position={[0, 0.004, 0]} visible={false} renderOrder={2}>
          <meshBasicMaterial map={a.ring} color={ringColor} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <mesh ref={ripple} geometry={a.plane} rotation={FLOOR_Z} position={[0, 0.005, 0]} visible={false} renderOrder={2}>
          <meshBasicMaterial map={a.ring} color={ringColor} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <mesh ref={glow} geometry={a.plane} rotation={FLOOR_Z} position={[0, 0.006, 0]} visible={false} renderOrder={3}>
          <meshBasicMaterial map={a.glow} color={glowColor} transparent depthWrite={false} blending={THREE.AdditiveBlending} polygonOffset polygonOffsetFactor={-6} />
        </mesh>
      </group>

      <group
        ref={root}
        position={[initial[0], GROUND, initial[1]]}
        onClick={(e) => {
          if (!selectable) return
          e.stopPropagation()
          move(idx)
        }}
        onPointerOver={() => {
          if (!selectable) return
          document.body.style.cursor = 'pointer'
          setHover(idx)
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto'
          setHover(null)
        }}
      >
        <group ref={body} scale={0.0001}>
          <mesh geometry={geometry} material={material} castShadow receiveShadow />
        </group>
        {/* generous invisible hit area so small screens are easy to tap */}
        <mesh geometry={a.hit} position={[0, 0.65, 0]} visible={false} />
      </group>
    </>
  )
}

// Scene builds a fresh offset array on every render; compare by value so unaffected pawns stay put.
export default memo(
  Pawn,
  (a, b) =>
    a.color === b.color &&
    a.idx === b.idx &&
    a.p === b.p &&
    a.scale === b.scale &&
    a.selectable === b.selectable &&
    a.offset[0] === b.offset[0] &&
    a.offset[1] === b.offset[1],
)
