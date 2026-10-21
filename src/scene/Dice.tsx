import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { useGame } from '../core/store'
import { sfx } from '../core/sound'
import { DICE, EASE, GROUND, NEUTRAL, PALETTE, TIMING, YARD_CENTER, damp, lerp } from '../core/theme'
import { blobTexture, diceFaceMaps } from './lib/textures'
import { newPose, sampleRoll, type RollPlan } from './lib/diceMotion'

// BoxGeometry material order: +x, -x, +y, -y, +z, -z (opposite faces always add up to 7)
const FACE_VALUES = [1, 6, 2, 5, 3, 4]

// Rotation that brings the face showing `v` to the top (+y).
const UP_EULER: Record<number, [number, number, number]> = {
  2: [0, 0, 0],
  5: [Math.PI, 0, 0],
  1: [0, 0, Math.PI / 2],
  6: [0, 0, -Math.PI / 2],
  3: [-Math.PI / 2, 0, 0],
  4: [Math.PI / 2, 0, 0],
}

const REST_Y = GROUND + DICE.size / 2
const UP = new THREE.Vector3(0, 1, 0)
const TRAVEL = TIMING.dice.travel
const ivory = new THREE.Color(NEUTRAL.bone)

const randSign = () => (Math.random() < 0.5 ? -1 : 1)
const randAxis = () => new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6 - 0.1, Math.random() - 0.5).normalize()

/**
 * The die. It lives in the dish at the middle of the active player's yard, tinted towards their colour, and
 * hops over to the next player's yard when the turn changes. Rolling it plays the timeline in diceMotion.ts.
 */
export default function Dice({ interactive, onRoll }: { interactive: boolean; onRoll: () => void }) {
  const mesh = useRef<THREE.Mesh>(null)
  const blob = useRef<THREE.Mesh>(null)

  const faces = useMemo(() => FACE_VALUES.map((v) => diceFaceMaps(v)), [])
  const mats = useMemo(
    () =>
      faces.map(
        (f) =>
          new THREE.MeshPhysicalMaterial({
            map: f.map,
            normalMap: f.normal,
            normalScale: new THREE.Vector2(1.1, 1.1),
            roughness: 0.4,
            clearcoat: 0.35,
            clearcoatRoughness: 0.35,
            color: ivory.clone(),
          }),
      ),
    [faces],
  )
  const geometry = useMemo(() => new RoundedBoxGeometry(DICE.size, DICE.size, DICE.size, 5, DICE.radius), [])
  const shadow = useMemo(() => blobTexture(), [])
  useEffect(() => () => {
    faces.forEach((f) => {
      f.map.dispose()
      f.normal.dispose()
    })
    mats.forEach((m) => m.dispose())
    shadow.dispose()
  }, [faces, mats, shadow])

  const st = useRef<{
    color: string
    world: [number, number]
    q: THREE.Quaternion
    rollId: number
    roll: { t: number; plan: RollPlan; landed: boolean } | null
    travel: { t: number; from: [number, number]; to: [number, number] } | null
    pose: ReturnType<typeof newPose>
    tint: THREE.Color
    clock: number
  } | null>(null)
  if (!st.current) {
    const g = useGame.getState()
    const color = g.players[g.current] ?? 'red'
    st.current = {
      color,
      world: [...YARD_CENTER[color]],
      q: new THREE.Quaternion().setFromEuler(new THREE.Euler(...UP_EULER[g.dice.value])),
      rollId: g.dice.rollId,
      roll: null,
      travel: null,
      pose: newPose(),
      tint: ivory.clone(),
      clock: 0,
    }
  }

  useFrame((_, dt) => {
    const d = mesh.current
    const S = st.current
    if (!d || !S) return
    S.clock += dt
    const g = useGame.getState()
    const color = g.players[g.current] ?? 'red'
    const centre = YARD_CENTER[color]

    // the turn moved on: carry the die over to the next yard
    if (color !== S.color) {
      S.color = color
      S.travel = { t: 0, from: [...S.world], to: [...centre] }
    }

    // a new roll: whatever the die was doing, it now rolls from where it is
    if (g.dice.rollId !== S.rollId) {
      S.rollId = g.dice.rollId
      if (S.travel) {
        S.world = [...S.travel.to]
        S.travel = null
      }
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * DICE.scatter
      const yaw = new THREE.Quaternion().setFromAxisAngle(UP, Math.random() * Math.PI * 2)
      S.roll = {
        t: 0,
        landed: false,
        plan: {
          six: g.dice.value === 6,
          from: [...S.world],
          land: [centre[0] + Math.cos(a) * r, centre[1] + Math.sin(a) * r],
          q0: S.q.clone(),
          qf: new THREE.Quaternion().setFromEuler(new THREE.Euler(...UP_EULER[g.dice.value])).premultiply(yaw),
          spins: [
            { axis: randAxis(), turns: randSign() * (2 + Math.round(Math.random())) },
            { axis: randAxis(), turns: randSign() * (1 + Math.round(Math.random())) },
          ],
          tiltAxis: new THREE.Vector3(Math.cos(a + 1.3), 0, Math.sin(a + 1.3)),
        },
      }
    }

    let x = S.world[0]
    let z = S.world[1]
    let lift = 0
    let sy = 1
    let sxz = 1
    let uni = 1

    if (S.roll) {
      const R = S.roll
      R.t += dt
      const p = sampleRoll(R.t, R.plan, S.pose)
      x = p.x
      z = p.z
      lift = p.lift
      sy = p.sy
      sxz = p.sxz
      uni = p.uni
      d.quaternion.copy(p.quat)
      if (!R.landed && R.t >= TIMING.dice.landAt) {
        R.landed = true
        sfx.land()
      }
      if (p.done) {
        S.world = [...R.plan.land]
        S.q.copy(R.plan.qf)
        S.roll = null
        d.quaternion.copy(S.q)
      }
    } else if (S.travel) {
      const T = S.travel
      T.t += dt
      const u = Math.min(1, T.t / TRAVEL)
      const e = EASE.inOut(u)
      x = lerp(T.from[0], T.to[0], e)
      z = lerp(T.from[1], T.to[1], e)
      lift = Math.sin(u * Math.PI) * 1.1
      const turn = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI * 2 * e)
      d.quaternion.copy(S.q).premultiply(turn)
      // squash on take-off and landing
      const edge = Math.min(u, 1 - u)
      sy = 1 - 0.1 * Math.max(0, 1 - edge * 7)
      sxz = 1 + 0.05 * Math.max(0, 1 - edge * 7)
      if (u >= 1) {
        S.world = [...T.to]
        S.travel = null
        d.quaternion.copy(S.q)
      }
    } else {
      d.quaternion.copy(S.q)
      if (interactive) {
        // inviting: a slow breath and a small rock while it waits to be tapped
        const t = S.clock
        lift = 0.03 + 0.03 * Math.sin(t * 2.6)
        d.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(UP, 0.05 * Math.sin(t * 1.7)))
      }
    }

    d.position.set(x, GROUND + lift + (DICE.size / 2) * sy * uni, z)
    d.scale.set(sxz * uni, sy * uni, sxz * uni)

    if (blob.current) {
      blob.current.position.set(x, GROUND + 0.006, z)
      blob.current.scale.setScalar(2 + lift * 0.45)
      ;(blob.current.material as THREE.MeshBasicMaterial).opacity = 0.55 / (1 + lift * 1.2)
    }

    // body colour follows whose turn it is
    const goal = ivory.clone().lerp(new THREE.Color(PALETTE[color].light), 0.6)
    S.tint.lerp(goal, damp(6, dt))
    for (const m of mats) m.color.copy(S.tint)
  })

  return (
    <>
      <mesh ref={blob} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadow} color="#1a0d06" transparent depthWrite={false} polygonOffset polygonOffsetFactor={-4} />
      </mesh>
      <mesh
        ref={mesh}
        geometry={geometry}
        material={mats}
        castShadow
        position={[st.current.world[0], REST_Y, st.current.world[1]]}
        onClick={(e) => {
          e.stopPropagation()
          if (interactive) onRoll()
        }}
        onPointerOver={() => interactive && (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = 'auto')}
      />
    </>
  )
}
