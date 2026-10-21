import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { cellToWorld, yardSpot, YARD_ORIGIN, type Color } from '../../core/game'
import { damp, GROUND, LAYOUT, PALETTE, PLATE_TOP, SCENE } from '../../core/theme'
import { paintYardStitch, recessTexture, yardTexture } from '../lib/textures'
import { useGame } from '../../core/store'

const THICK = GROUND - PLATE_TOP

/** The yard's raised cloth panel, with a real hole cut for each of the four pawn spots. */
let panel: THREE.ExtrudeGeometry | null = null
function panelGeometry() {
  if (panel) return panel
  const W = LAYOUT.yard
  const r = LAYOUT.yardRadius
  const h = W / 2
  const shape = new THREE.Shape()
  shape.moveTo(-h + r, -h)
  shape.lineTo(h - r, -h)
  shape.quadraticCurveTo(h, -h, h, -h + r)
  shape.lineTo(h, h - r)
  shape.quadraticCurveTo(h, h, h - r, h)
  shape.lineTo(-h + r, h)
  shape.quadraticCurveTo(-h, h, -h, h - r)
  shape.lineTo(-h, -h + r)
  shape.quadraticCurveTo(-h, -h, -h + r, -h)
  for (const dx of [-1, 1]) {
    for (const dy of [-1, 1]) {
      const hole = new THREE.Path()
      hole.absarc(dx, dy, LAYOUT.spotRadius, 0, Math.PI * 2, true)
      shape.holes.push(hole)
    }
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: THICK, bevelEnabled: false, curveSegments: 40 })
  // lay it flat (extrusion goes up) and map the top onto the printed texture
  const pos = geo.attributes.position
  const uv = geo.attributes.uv
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / W + 0.5, pos.getY(i) / W + 0.5)
  geo.rotateX(-Math.PI / 2)
  return (panel = geo)
}

export default function Yard({ color }: { color: Color }) {
  const [ox, oy] = YARD_ORIGIN[color]
  const [cx, cz] = cellToWorld([ox + 2.5, oy + 2.5])
  const shades = PALETTE[color]

  const mats = useMemo(() => {
    const top = new THREE.MeshStandardMaterial({ map: yardTexture(color), roughness: 0.88 })
    const side = new THREE.MeshStandardMaterial({ color: shades.dark, roughness: 0.7 })
    return { top, side }
  }, [color, shades.dark])
  const floorMat = useMemo(() => new THREE.MeshStandardMaterial({ map: recessTexture(color), roughness: 0.9 }), [color])
  const floorGeo = useMemo(() => new THREE.CircleGeometry(LAYOUT.spotRadius + 0.01, 40), [])

  // the moving stitch border that marks whose turn it is
  const stitch = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 512
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return { canvas, tex }
  }, [])
  const stitchMat = useRef<THREE.MeshBasicMaterial>(null)
  const stitchMesh = useRef<THREE.Mesh>(null)
  const light = useRef({ k: 1, on: 0, t: 0 })

  useEffect(() => () => stitch.tex.dispose(), [stitch])

  useFrame((_, dt) => {
    const { players, current, phase, seats } = useGame.getState()
    const playing = phase === 'setup' ? seats[color] !== 'off' : players.includes(color)
    const onTurn = phase !== 'setup' && phase !== 'over' && players[current] === color
    const L = light.current
    const goalK = onTurn ? 1 : playing ? (phase === 'setup' ? 1 : SCENE.dimYard) : SCENE.dimEmpty
    L.k += (goalK - L.k) * damp(6, dt)
    L.on += ((onTurn ? 1 : 0) - L.on) * damp(7, dt)
    mats.top.color.setScalar(L.k)
    mats.side.color.set(shades.dark).multiplyScalar(L.k)

    const m = stitchMat.current
    if (m && stitchMesh.current) {
      stitchMesh.current.visible = L.on > 0.01
      if (L.on > 0.01) {
        L.t += dt
        paintYardStitch(stitch.canvas, color, L.t * 0.9)
        stitch.tex.needsUpdate = true
        m.opacity = L.on
      }
    }
  })

  return (
    <group position={[cx, 0, cz]}>
      <mesh geometry={panelGeometry()} position={[0, PLATE_TOP, 0]} material={[mats.top, mats.side]} receiveShadow castShadow />
      {[0, 1, 2, 3].map((i) => {
        const [x, z] = yardSpot(color, i)
        return <mesh key={i} geometry={floorGeo} material={floorMat} position={[x - cx, PLATE_TOP + 0.004, z - cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow />
      })}
      <mesh ref={stitchMesh} position={[0, GROUND + 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <planeGeometry args={[LAYOUT.yard, LAYOUT.yard]} />
        <meshBasicMaterial ref={stitchMat} map={stitch.tex} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-3} />
      </mesh>
    </group>
  )
}
