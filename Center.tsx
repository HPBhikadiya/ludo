import { useMemo } from 'react'
import * as THREE from 'three'
import { COLORS, type Color } from './game'
import { GROUND, NEUTRAL, PALETTE, PLATE_TOP, muted } from './theme'
import { centerStitchTexture } from './textures'

const TILE_H = GROUND - PLATE_TOP
const HALF = 1.47 // half the 3x3 centre, minus the gap

/** Corners (world x,z) of each colour's triangle; the apex is always the middle. */
const TRI: Record<Color, [number, number][]> = {
  red: [[-HALF, -HALF], [-HALF, HALF], [0, 0]],
  green: [[-HALF, -HALF], [HALF, -HALF], [0, 0]],
  yellow: [[HALF, -HALF], [HALF, HALF], [0, 0]],
  blue: [[-HALF, HALF], [HALF, HALF], [0, 0]],
}

function triangleGeometry(points: [number, number][]) {
  // pull the corners in a touch so neighbouring triangles leave a thin seam
  const cx = points.reduce((s, p) => s + p[0], 0) / 3
  const cz = points.reduce((s, p) => s + p[1], 0) / 3
  const shape = new THREE.Shape()
  points.forEach(([x, z], i) => {
    const px = cx + (x - cx) * 0.975
    const py = -(cz + (z - cz) * 0.975) // shape y maps to -z once laid flat
    if (i === 0) shape.moveTo(px, py)
    else shape.lineTo(px, py)
  })
  shape.closePath()
  return new THREE.ExtrudeGeometry(shape, { depth: TILE_H, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.01, bevelSegments: 2 })
}

function petalGeometry(length: number, width: number) {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(length * 0.25, width, length * 0.8, width * 0.75, length, 0)
  s.bezierCurveTo(length * 0.8, -width * 0.75, length * 0.25, -width, 0, 0)
  return new THREE.ExtrudeGeometry(s, { depth: 0.025, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.008, bevelSegments: 2 })
}

/**
 * The 3x3 centre: four cloth triangles meeting under a small turned lotus whose cardinal petals
 * wear the four player colours. Finished pawns stand on their own triangle.
 */
export default function Center() {
  const geos = useMemo(
    () => Object.fromEntries(COLORS.map((c) => [c, triangleGeometry(TRI[c])])) as unknown as Record<Color, THREE.BufferGeometry>,
    [],
  )
  const stitch = useMemo(() => centerStitchTexture(), [])
  const long = useMemo(() => petalGeometry(0.62, 0.17), [])
  const short = useMemo(() => petalGeometry(0.4, 0.12), [])

  // petal angles in the x-z plane: red points west, green north, yellow east, blue south
  const cardinals: [Color, number][] = [['red', Math.PI], ['green', Math.PI / 2], ['yellow', 0], ['blue', -Math.PI / 2]]
  return (
    <group>
      {COLORS.map((c) => (
        <mesh key={c} geometry={geos[c]} position={[0, PLATE_TOP, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
          <meshStandardMaterial color={muted(c, 0.78)} roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, GROUND + 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3, 3]} />
        <meshBasicMaterial map={stitch} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
      </mesh>

      {/* the lotus */}
      <group position={[0, GROUND, 0]}>
        <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.62, 0.66, 0.04, 56]} />
          <meshPhysicalMaterial color={NEUTRAL.rosewood} roughness={0.45} clearcoat={0.5} />
        </mesh>
        {[0, 1, 2, 3].map((i) => {
          const a = (i + 0.5) * (Math.PI / 2)
          return (
            <mesh key={'s' + i} geometry={short} position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, a]} castShadow>
              <meshStandardMaterial color={NEUTRAL.bone} roughness={0.5} />
            </mesh>
          )
        })}
        {cardinals.map(([c, a]) => (
          <mesh key={c} geometry={long} position={[0, 0.052, 0]} rotation={[-Math.PI / 2, 0, a]} castShadow>
            <meshPhysicalMaterial color={PALETTE[c].main} roughness={0.4} clearcoat={0.5} />
          </mesh>
        ))}
        <mesh position={[0, 0.085, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.12, 0.05, 28]} />
          <meshStandardMaterial color={NEUTRAL.brass} roughness={0.35} metalness={0.8} />
        </mesh>
      </group>
    </group>
  )
}
