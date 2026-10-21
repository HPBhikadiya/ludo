import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { tokenWorld, type Color } from '../core/game'
import { GROUND, PALETTE, TIMING, YARD_CENTER, damp } from '../core/theme'
import { ringTexture } from './lib/textures'
import { useGame } from '../core/store'

let ring: THREE.Texture | null = null
const ringTex = () => (ring ||= ringTexture())

/** A painted landing mark with a small inlaid diamond hovering over it. */
function DestMarker({ x, z, color, hot, onClick }: { x: number; z: number; color: Color; hot: boolean; onClick: () => void }) {
  const group = useRef<THREE.Group>(null)
  const gem = useRef<THREE.Mesh>(null)
  const tint = useMemo(() => new THREE.Color(PALETTE[color].main).lerp(new THREE.Color('#fff'), 0.2), [color])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const g = group.current
    if (!g) return
    g.scale.setScalar((hot ? 1.18 : 1) * (1 + Math.sin(t * 5) * 0.05))
    if (gem.current) {
      gem.current.position.y = 0.95 + Math.abs(Math.sin(t * 4)) * 0.2
      gem.current.rotation.y = t * 1.6
    }
  })
  return (
    <group
      ref={group}
      position={[x, GROUND + 0.012, z]}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = 'auto')}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[1.35, 1.35]} />
        <meshBasicMaterial map={ringTex()} color={tint} transparent opacity={hot ? 1 : 0.85} depthWrite={false} polygonOffset polygonOffsetFactor={-6} />
      </mesh>
      <mesh ref={gem} position={[0, 0.95, 0]} scale={[0.17, 0.26, 0.17]} castShadow>
        <octahedronGeometry args={[1, 0]} />
        <meshPhysicalMaterial color={PALETTE[color].main} roughness={0.35} clearcoat={0.7} />
      </mesh>
    </group>
  )
}

/** Shows where each pawn the human can move would land, and lets them tap the spot instead. */
export function Destinations() {
  const phase = useGame((s) => s.phase)
  const movable = useGame((s) => s.movable)
  const players = useGame((s) => s.players)
  const current = useGame((s) => s.current)
  const seats = useGame((s) => s.seats)
  const tokens = useGame((s) => s.tokens)
  const dice = useGame((s) => s.dice.value)
  const hover = useGame((s) => s.hover)
  const move = useGame((s) => s.move)

  const color = players[current]
  if (phase !== 'select' || !color || seats[color] !== 'human') return null
  return (
    <>
      {movable.map((idx) => {
        const prev = tokens[color][idx]
        const [x, z] = tokenWorld(color, prev < 0 ? 0 : prev + dice, idx)
        return <DestMarker key={idx} x={x} z={z} color={color} hot={hover === idx} onClick={() => move(idx)} />
      })}
    </>
  )
}

/** A soft ripple spreading from the dice dish while a human is expected to roll. */
export function RollCue() {
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const target = useMemo(() => new THREE.Color(), [])
  useFrame(({ clock }, dt) => {
    const { phase, players, current, seats, paused } = useGame.getState()
    const color = players[current]
    const on = phase === 'roll' && !!color && seats[color] === 'human' && !paused
    const m = mesh.current
    if (!m || !mat.current) return
    m.visible = on
    if (!on) return
    const [x, z] = YARD_CENTER[color]
    m.position.set(x, GROUND + 0.012, z)
    target.set(PALETTE[color].main)
    mat.current.color.lerp(target, damp(10, dt))
    const p = (clock.elapsedTime / (TIMING.pawn.bobPeriod * 1.8)) % 1
    m.scale.setScalar(1.9 + p * 1.5)
    mat.current.opacity = (1 - p) * 0.75
  })
  return (
    <mesh ref={mesh} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={2}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial ref={mat} map={ringTex()} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-6} />
    </mesh>
  )
}
