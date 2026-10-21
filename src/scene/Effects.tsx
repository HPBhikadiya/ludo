import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import * as THREE from 'three'
import { GROUND, PALETTE } from '../core/theme'
import { ringTexture } from './lib/textures'
import { useGame } from '../core/store'

/** Anti-aliasing, a gentle lamp-lit vignette and neutral tone mapping, so the dyes keep their colour. */
export function Post() {
  return (
    <EffectComposer multisampling={4}>
      <Vignette offset={0.32} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
    </EffectComposer>
  )
}

const LIFE = 0.9
const RINGS = 2

/**
 * One restrained flourish for a capture or a pawn coming home: two soft ripples spreading across the cloth,
 * in the colour of the pawn concerned. No particles.
 */
export function Burst() {
  const burst = useGame((s) => s.burst)
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const tex = useMemo(() => ringTexture(), [])
  const sim = useRef({ t: LIFE, x: 0, z: 0 })
  const tint = useMemo(() => new THREE.Color(), [])

  useEffect(() => {
    if (!burst) return
    sim.current = { t: 0, x: burst.pos[0], z: burst.pos[1] }
    tint.set(PALETTE[burst.color].main)
    if (burst.kind === 'home') tint.lerp(new THREE.Color('#ffe9b8'), 0.5)
    else tint.lerp(new THREE.Color('#ffffff'), 0.1)
    refs.current.forEach((m) => m && (m.material as THREE.MeshBasicMaterial).color.copy(tint))
  }, [burst, tint])

  useFrame((_, dt) => {
    const s = sim.current
    if (s.t >= LIFE + 0.2) {
      refs.current.forEach((m) => m && (m.visible = false))
      return
    }
    s.t += dt
    refs.current.forEach((m, i) => {
      if (!m) return
      const k = Math.min(1, Math.max(0, (s.t - i * 0.14) / LIFE))
      m.visible = k > 0 && k < 1
      const e = 1 - Math.pow(1 - k, 3)
      m.position.set(s.x, GROUND + 0.014 + i * 0.001, s.z)
      m.scale.setScalar(1 + e * 3.4)
      ;(m.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.85
    })
  })

  return (
    <>
      {Array.from({ length: RINGS }, (_, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={3}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={tex} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-7} />
        </mesh>
      ))}
    </>
  )
}
