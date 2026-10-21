import { memo, useMemo } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { cellToWorld, type Cell, type Color } from './game'
import { GROUND, LAYOUT, NEUTRAL, PLATE_TOP } from './theme'
import { arrowDecal, chevronDecal, rng, starDecal, tileTexture } from './textures'

const TILE_H = GROUND - PLATE_TOP
const VARIANTS = 6

// Everything below is built once and shared by every square.
let shared: {
  geo: THREE.BufferGeometry
  decal: THREE.PlaneGeometry
  maps: THREE.Texture[]
  star: THREE.Texture
  starCream: THREE.Texture
  chevron: THREE.Texture
  arrows: Partial<Record<Color, THREE.Texture>>
} | null = null

function assets() {
  return (shared ||= {
    geo: new RoundedBoxGeometry(LAYOUT.tile, TILE_H, LAYOUT.tile, 2, 0.026),
    decal: new THREE.PlaneGeometry(0.78, 0.78),
    maps: Array.from({ length: VARIANTS }, (_, i) => tileTexture(i + 1)),
    star: starDecal(NEUTRAL.inkSoft, '#E0A62D'),
    starCream: starDecal(NEUTRAL.bone, '#E0A62D'),
    chevron: chevronDecal(),
    arrows: {},
  })
}

export type Mark =
  | { kind: 'star'; onColour?: boolean }
  | { kind: 'chevron'; angle: number }
  | { kind: 'arrow'; color: Color; angle: number }

interface TileProps {
  cell: Cell
  /** unique number per square: drives its texture variant, tiny rotation and tint */
  seed: number
  color?: string
  mark?: Mark
}

/**
 * One square of the track, home column or finish: a slightly raised patch of stitched cloth.
 * No two are identical: each gets its own weave variant, a quarter-turn, a hair of tilt and a tint shift.
 */
function TileImpl({ cell, seed, color = NEUTRAL.tile, mark }: TileProps) {
  const a = assets()
  const [x, z] = cellToWorld(cell)
  const look = useMemo(() => {
    const r = rng(seed * 7919 + 3)
    const tint = new THREE.Color(color)
    const k = 0.955 + r() * 0.07
    tint.multiplyScalar(k)
    tint.r *= 1 + (r() - 0.5) * 0.025
    tint.b *= 1 + (r() - 0.5) * 0.03
    return {
      map: a.maps[seed % VARIANTS],
      tint,
      rotY: Math.floor(r() * 4) * (Math.PI / 2) + (r() - 0.5) * 0.014,
      dx: (r() - 0.5) * 0.008,
      dz: (r() - 0.5) * 0.008,
    }
  }, [a, seed, color])

  let decal: THREE.Texture | null = null
  let rot = 0
  if (mark?.kind === 'star') decal = mark.onColour ? a.starCream : a.star
  else if (mark?.kind === 'chevron') {
    decal = a.chevron
    rot = mark.angle
  } else if (mark?.kind === 'arrow') {
    decal = a.arrows[mark.color] ||= arrowDecal(mark.color)
    rot = mark.angle
  }

  return (
    <group position={[x + look.dx, 0, z + look.dz]}>
      <mesh geometry={a.geo} position={[0, PLATE_TOP + TILE_H / 2, 0]} rotation={[0, look.rotY, 0]} receiveShadow castShadow>
        <meshStandardMaterial color={look.tint} map={look.map} roughness={0.85} />
      </mesh>
      {decal && (
        <mesh geometry={a.decal} position={[0, GROUND + 0.002, 0]} rotation={[-Math.PI / 2, 0, rot]} receiveShadow>
          <meshStandardMaterial map={decal} transparent roughness={0.9} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      )}
    </group>
  )
}

export default memo(TileImpl)
