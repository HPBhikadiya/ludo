import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BOARD_HALF, NEUTRAL, SCENE } from '../core/theme'
import { woodTexture } from './lib/textures'
import { useGame } from '../core/store'

/** The dark room around the table, with fog so the far edge of the table melts away. */
function Mood() {
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    scene.background = new THREE.Color(SCENE.background)
    scene.fog = new THREE.Fog(SCENE.fog, 42, 92)
    return () => {
      scene.background = null
      scene.fog = null
    }
  }, [scene])
  return null
}

/** The teak table the board sits on; it also catches the board's shadow. */
function Table() {
  const map = useMemo(() => {
    const t = woodTexture({ base: NEUTRAL.teak, light: NEUTRAL.teakLight, planks: 8, size: 2048, seed: 31 })
    t.repeat.set(3, 3)
    return t
  }, [])
  useEffect(() => () => map.dispose(), [map])
  return (
    <mesh position={[0, -0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[120, 120]} />
      <meshStandardMaterial map={map} roughness={0.62} />
    </mesh>
  )
}

const HOME_POLAR = Math.atan2(15, 19)
const BASE_RADIUS = Math.hypot(19, 15)
const FIT = (BOARD_HALF * 2) / 16.8 // the camera numbers below were tuned for a 16.8-wide board

interface Orbit {
  addEventListener: (type: string, fn: () => void) => void
  removeEventListener: (type: string, fn: () => void) => void
}

/**
 * Owns the camera's "home" pose. Glides back to it when a game starts or the player hits "reset view",
 * and backs off on narrow screens so the whole board stays in frame.
 */
function CameraRig() {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as Orbit | null
  const aspect = useThree((s) => s.size.width / s.size.height)
  const inSetup = useGame((s) => s.phase === 'setup')
  const viewNonce = useGame((s) => s.viewNonce)
  const goal = useRef<THREE.Spherical | null>(null)
  const placed = useRef(false)
  const cur = useMemo(() => new THREE.Spherical(), [])

  useEffect(() => {
    // tall screens need more distance to fit the width; the portrait setup card also wants extra headroom
    const fit = Math.min(56, Math.max(BASE_RADIUS * 1.12 * FIT, (25 * FIT) / aspect))
    const radius = inSetup && aspect < 1.15 ? Math.min(64, fit * 1.2) : fit
    const home = new THREE.Spherical(radius, HOME_POLAR, 0)
    if (!placed.current) {
      placed.current = true
      camera.position.setFromSpherical(home)
      camera.lookAt(0, 0, 0)
    } else {
      goal.current = home
    }
  }, [camera, aspect, inSetup, viewNonce])

  useEffect(() => {
    if (!controls) return
    const cancel = () => (goal.current = null)
    controls.addEventListener('start', cancel)
    return () => controls.removeEventListener('start', cancel)
  }, [controls])

  // On the setup screen the board slides out from behind the card (right on wide screens, up on tall
  // ones), then eases back to the centre once the game starts. Both are fractions of the viewport.
  const shift = useRef({ x: 0, y: 0 })

  useFrame(({ size }, dt) => {
    const cam = camera as THREE.PerspectiveCamera
    const sh = shift.current
    const setup = useGame.getState().phase === 'setup'
    const wide = size.width / size.height > 1.15
    const slide = 1 - Math.exp(-dt * 3.5)
    sh.x += ((setup && wide ? 0.17 : 0) - sh.x) * slide
    sh.y += ((setup && !wide ? 0.33 : 0) - sh.y) * slide
    if (!setup && Math.abs(sh.x) < 0.0005 && Math.abs(sh.y) < 0.0005) {
      if (cam.view?.enabled) cam.clearViewOffset()
      sh.x = sh.y = 0
    } else {
      cam.setViewOffset(size.width, size.height, -sh.x * size.width, sh.y * size.height, size.width, size.height)
    }

    const g = goal.current
    if (!g) return
    cur.setFromVector3(camera.position)
    const k = 1 - Math.exp(-dt * 4.5)
    const dTheta = THREE.MathUtils.euclideanModulo(g.theta - cur.theta + Math.PI, Math.PI * 2) - Math.PI
    cur.theta += dTheta * k
    cur.phi += (g.phi - cur.phi) * k
    cur.radius += (g.radius - cur.radius) * k
    camera.position.setFromSpherical(cur)
    camera.lookAt(0, 0, 0)
    if (Math.abs(dTheta) < 0.002 && Math.abs(g.phi - cur.phi) < 0.002 && Math.abs(g.radius - cur.radius) < 0.02) {
      goal.current = null
    }
  })
  return null
}

export default function Stage() {
  return (
    <>
      <Mood />
      <Table />
      <CameraRig />
    </>
  )
}
