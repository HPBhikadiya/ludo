import { memo, useMemo } from 'react'
import { Environment, Lightformer, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import Board from './board/Board'
import Pawn from './Pawn'
import Dice from './Dice'
import Stage from './Stage'
import { Burst, Post } from './Effects'
import { Destinations, RollCue } from './Markers'
import { COLORS, cellFor, cellToWorld, type Color, type Tokens } from '../core/game'
import { GROUND, SCENE } from '../core/theme'
import { badgeTexture } from './lib/textures'
import { useGame } from '../core/store'

interface Placed {
  offset: [number, number]
  scale: number
}

function offsetsFor(tokens: Tokens, players: Color[]) {
  // pawns that share a track/home-column cell stand side by side, a little smaller
  const groups: Record<string, string[]> = {}
  for (const c of players) {
    tokens[c].forEach((p, i) => {
      if (p < 0 || p > 55) return
      const [col, row] = cellFor(c, p)
      ;(groups[`${col},${row}`] ||= []).push(`${c}${i}`)
    })
  }
  const placed: Record<string, Placed> = {}
  const stacks: { key: string; pos: [number, number]; count: number }[] = []
  for (const [key, list] of Object.entries(groups)) {
    const n = list.length
    if (n > 1) {
      const [col, row] = key.split(',').map(Number)
      stacks.push({ key, pos: cellToWorld([col, row]), count: n })
    }
    list.forEach((id, k) => {
      if (n === 1) placed[id] = { offset: [0, 0], scale: 1 }
      else {
        const a = (k / n) * Math.PI * 2 + (n === 2 ? 0 : Math.PI / 4)
        placed[id] = { offset: [Math.cos(a) * 0.23, Math.sin(a) * 0.23], scale: n === 2 ? 0.78 : 0.68 }
      }
    })
  }
  return { placed, stacks }
}

const badgeMaps: Record<number, THREE.Texture> = {}
const badge = (n: number) => (badgeMaps[n] ||= badgeTexture(n))

/** A small count disc floating above any square holding two or more pawns, so none is ever lost. */
function StackBadge({ pos, count }: { pos: [number, number]; count: number }) {
  return (
    <sprite position={[pos[0], GROUND + 1.55, pos[1]]} scale={[0.58, 0.58, 1]} renderOrder={10}>
      <spriteMaterial map={badge(count)} depthWrite={false} toneMapped={false} />
    </sprite>
  )
}

/** Lights and reflections never change, so keep them (and the environment capture) out of every re-render. */
const Lighting = memo(function Lighting() {
  return (
    <>
      <hemisphereLight args={['#d9dfeb', '#3a281c', 0.32]} />
      <directionalLight
        position={[-7, 17, 10]}
        intensity={2.1}
        color={SCENE.keyLight}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
        shadow-camera-near={1}
        shadow-camera-far={44}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[9, 6, -6]} intensity={0.28} color={SCENE.fillLight} />
      {/* soft boxes: reflections for the lacquer, the die and the rim */}
      <Environment resolution={256} environmentIntensity={0.32}>
        <Lightformer form="rect" intensity={2.6} position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[14, 14, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[-10, 3, 4]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} color="#ffd9b0" />
        <Lightformer form="rect" intensity={0.7} position={[10, 3, -2]} rotation-y={-Math.PI / 2} scale={[10, 4, 1]} color="#c9d6f0" />
      </Environment>
    </>
  )
})

export default function Scene() {
  const tokens = useGame((s) => s.tokens)
  const players = useGame((s) => s.players)
  const current = useGame((s) => s.current)
  const phase = useGame((s) => s.phase)
  const movable = useGame((s) => s.movable)
  // only who is seated matters here, not whether a seat is human or CPU
  const seated = useGame((s) => COLORS.map((c) => (s.seats[c] === 'off' ? '0' : '1')).join(''))
  const humanTurn = useGame((s) => {
    const color = s.players[s.current]
    return !!color && s.seats[color] === 'human'
  })
  const paused = useGame((s) => s.paused)
  const roll = useGame((s) => s.roll)

  const active = players[current]
  // while choosing seats, preview the pawns of everyone who is sitting in
  const shown = useMemo(
    () => (phase === 'setup' ? COLORS.filter((_, i) => seated[i] === '1') : players),
    [phase, seated, players],
  )
  const { placed, stacks } = useMemo(() => offsetsFor(tokens, shown), [tokens, shown])

  return (
    <>
      <Lighting />

      <Stage />
      <Board />

      {phase !== 'setup' && (
        <>
          <Dice interactive={humanTurn && phase === 'roll' && !paused} onRoll={roll} />
          <RollCue />
        </>
      )}

      {shown.map((c) =>
        tokens[c].map((p, i) => {
          const st = placed[`${c}${i}`] || { offset: [0, 0] as [number, number], scale: 1 }
          return (
            <Pawn
              key={c + i}
              color={c}
              idx={i}
              p={p}
              offset={st.offset}
              scale={st.scale}
              selectable={phase === 'select' && humanTurn && c === active && movable.includes(i)}
            />
          )
        }),
      )}
      {stacks.map((s) => (
        <StackBadge key={s.key} pos={s.pos} count={s.count} />
      ))}

      <Destinations />
      <Burst />

      <OrbitControls
        makeDefault
        enableDamping
        autoRotate={phase === 'setup'}
        autoRotateSpeed={0.5}
        enablePan={false}
        minDistance={11}
        maxDistance={64}
        maxPolarAngle={Math.PI / 2.2}
        target={[0, 0, 0]}
      />

      <Post />
    </>
  )
}
