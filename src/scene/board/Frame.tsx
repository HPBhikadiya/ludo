import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { COLORS, COLOR_NAME, type Color } from '../../core/game'
import { BOARD_HALF, LAYOUT, NEUTRAL, PLATE_TOP, YARD_CENTER } from '../../core/theme'
import { DISPLAY_FONT, boardShadowTexture, clothBump, clothTexture, labelTexture, woodTexture } from '../lib/textures'

const rbox = (w: number, h: number, d: number, r: number) => new RoundedBoxGeometry(w, h, d, 3, r)

/** True once the display font is ready, so canvas lettering is drawn in it rather than the fallback. */
function useDisplayFont() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let live = true
    const fonts = document.fonts
    if (!fonts) return
    fonts
      .load(`64px ${DISPLAY_FONT}`)
      .catch(() => undefined)
      .finally(() => live && setReady(true))
    return () => {
      live = false
    }
  }, [])
  return ready
}

/** Name plates printed on the cloth border, beside each yard. */
function Plates() {
  const fontReady = useDisplayFont()
  const maps = useMemo(
    () => Object.fromEntries(COLORS.map((c) => [c, labelTexture(c, COLOR_NAME[c])])) as unknown as Record<Color, THREE.Texture>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fontReady],
  )
  useEffect(() => () => Object.values(maps).forEach((t) => t.dispose()), [maps])
  const band = (7.5 + LAYOUT.clothHalf) / 2
  return (
    <>
      {COLORS.map((c) => {
        const [x, z] = YARD_CENTER[c]
        return (
          <mesh key={c} position={[x, PLATE_TOP + 0.003, Math.sign(z) * band]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3.9, 0.74]} />
            <meshStandardMaterial map={maps[c]} transparent roughness={0.9} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
          </mesh>
        )
      })}
    </>
  )
}

/** Rosewood frame around a printed cloth, resting on the table with a soft shadow. */
export default function Frame() {
  const W = BOARD_HALF * 2
  const T = LAYOUT.rimWidth
  const H = LAYOUT.rimHeight
  const m = BOARD_HALF - T / 2

  const woodH = useMemo(() => woodTexture({ base: NEUTRAL.rosewood, light: NEUTRAL.rosewoodLight, size: 512, seed: 9 }), [])
  const woodV = useMemo(() => woodTexture({ base: NEUTRAL.rosewood, light: NEUTRAL.rosewoodLight, size: 512, seed: 12, vertical: true }), [])
  const cloth = useMemo(() => clothTexture(), [])
  const bump = useMemo(() => clothBump(), [])
  const shadow = useMemo(() => boardShadowTexture(), [])
  const slab = useMemo(() => rbox(W, PLATE_TOP, W, 0.12), [W])
  const barH = useMemo(() => rbox(W, H, T, 0.13), [W, H, T])
  const barV = useMemo(() => rbox(T, H, W - 2 * T + 0.3, 0.13), [W, H, T])
  const wood = (map: THREE.Texture) => <meshPhysicalMaterial map={map} roughness={0.55} clearcoat={0.35} clearcoatRoughness={0.4} />

  return (
    <group>
      {/* soft shadow that seats the board on the table */}
      <mesh position={[0.35, 0.004, 0.55]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1}>
        <planeGeometry args={[W * 1.42, W * 1.42]} />
        <meshBasicMaterial color="#000" alphaMap={shadow} transparent opacity={0.62} depthWrite={false} />
      </mesh>

      <mesh geometry={slab} position={[0, PLATE_TOP / 2, 0]} castShadow receiveShadow>
        {wood(woodH)}
      </mesh>

      {/* the printed cloth */}
      <mesh position={[0, PLATE_TOP + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[LAYOUT.clothHalf * 2, LAYOUT.clothHalf * 2]} />
        <meshStandardMaterial map={cloth} bumpMap={bump} bumpScale={0.9} roughness={0.95} />
      </mesh>

      {[-1, 1].map((s) => (
        <mesh key={'h' + s} geometry={barH} position={[0, H / 2, s * m]} castShadow receiveShadow>
          {wood(woodH)}
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={'v' + s} geometry={barV} position={[s * m, H / 2, 0]} castShadow receiveShadow>
          {wood(woodV)}
        </mesh>
      ))}

      {/* a thin bone inlay along the inner edge of the rim */}
      {[-1, 1].map((s) => (
        <group key={'i' + s}>
          <mesh position={[0, H + 0.002, s * (LAYOUT.clothHalf + 0.13)]}>
            <boxGeometry args={[2 * LAYOUT.clothHalf + 0.28, 0.012, 0.045]} />
            <meshStandardMaterial color={NEUTRAL.bone} roughness={0.5} />
          </mesh>
          <mesh position={[s * (LAYOUT.clothHalf + 0.13), H + 0.002, 0]}>
            <boxGeometry args={[0.045, 0.012, 2 * LAYOUT.clothHalf + 0.28]} />
            <meshStandardMaterial color={NEUTRAL.bone} roughness={0.5} />
          </mesh>
        </group>
      ))}

      <Plates />
    </group>
  )
}
