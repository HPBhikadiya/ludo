import { useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import Scene from './Scene'
import UI from './UI'
import { useGame } from './store'
import { chooseMove, movableTokens } from './game'

/** Drives CPU players: rolls and picks tokens after a short pause. */
function useCpu() {
  const phase = useGame((s) => s.phase)
  const current = useGame((s) => s.current)
  const rollId = useGame((s) => s.dice.rollId)
  const tokens = useGame((s) => s.tokens)
  const paused = useGame((s) => s.paused)

  useEffect(() => {
    if (paused) return
    const s = useGame.getState()
    const color = s.players[s.current]
    if (!color || s.seats[color] !== 'cpu') return
    if (phase === 'roll') {
      const t = setTimeout(() => useGame.getState().roll(), 800)
      return () => clearTimeout(t)
    }
    if (phase === 'select') {
      const t = setTimeout(() => {
        const g = useGame.getState()
        if (g.phase !== 'select') return
        const opts = movableTokens(g.tokens, color, g.dice.value)
        g.move(chooseMove(g.tokens, color, g.dice.value, opts))
      }, 900)
      return () => clearTimeout(t)
    }
  }, [phase, current, rollId, tokens, paused])
}

export default function App() {
  useCpu()
  return (
    <div className="app">
      <Canvas
        shadows
        camera={{ position: [0, 19, 15], fov: 45 }}
        dpr={[1, 2]}
        // tone mapping and anti-aliasing are handled by the post-processing chain in Scene
        gl={{ antialias: false, toneMapping: THREE.NoToneMapping, powerPreference: 'high-performance' }}
      >
        <Scene />
      </Canvas>
      <UI />
    </div>
  )
}
