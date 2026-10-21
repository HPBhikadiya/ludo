import { useEffect, useRef } from 'react'
import { COLOR_NAME, HOME, type Color } from './game'
import { PALETTE, swatch } from './theme'
import { useGame } from './store'
import { IconCrown, IconExit, IconRestart, PawnIcon } from './icons'

// the printed-cloth palette: the four dyes plus cream and turmeric
const CONFETTI_COLORS = [PALETTE.red.main, PALETTE.green.main, PALETTE.yellow.main, PALETTE.blue.main, '#F3EBD8', '#E0A62D']

interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  rot: number
  vr: number
  color: string
  phase: number
}

/** One-shot confetti shower on a full-screen canvas; skipped for people who prefer reduced motion. */
function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let w = 0
    let h = 0
    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const spawn = (i: number): Piece => ({
      x: Math.random() * w,
      y: -20 - Math.random() * h * 0.7,
      vx: (Math.random() - 0.5) * 1.6,
      vy: 2.2 + Math.random() * 3,
      w: 6 + Math.random() * 7,
      h: 9 + Math.random() * 9,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.3,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      phase: Math.random() * Math.PI * 2,
    })
    const pieces = Array.from({ length: 190 }, (_, i) => spawn(i))

    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(2.5, (now - last) / 16.67)
      last = now
      ctx.clearRect(0, 0, w, h)
      let alive = 0
      for (const p of pieces) {
        p.phase += 0.05 * dt
        p.x += (p.vx + Math.sin(p.phase) * 0.8) * dt
        p.y += p.vy * dt
        p.rot += p.vr * dt
        if (p.y > h + 30) continue
        alive++
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.scale(1, Math.cos(p.phase * 1.4)) // flutter
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }
      if (alive > 0) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} className="confetti" aria-hidden />
}

export default function GameOver() {
  const winner = useGame((s) => s.winner)
  const players = useGame((s) => s.players)
  const tokens = useGame((s) => s.tokens)
  const stats = useGame((s) => s.stats)
  const startGame = useGame((s) => s.startGame)
  const backToSetup = useGame((s) => s.backToSetup)
  if (!winner) return null

  const homeCount = (c: Color) =>tokens[c].filter((p) => p === HOME).length
  const ranked = [...players].sort((a, b) => homeCount(b) - homeCount(a) || stats[b].captures - stats[a].captures)

  return (
    <div className="overlay dim" role="dialog" aria-modal aria-label={`${COLOR_NAME[winner]} wins`}>
      <Confetti />
      <div className="card win-card" style={swatch(winner)}>
        <div className="crown">
          <IconCrown width={30} height={30} />
        </div>
        <div className="win-pawn">
          <PawnIcon color={winner} size={64} />
        </div>
        <h2 className="win">{COLOR_NAME[winner]} wins!</h2>
        <p className="sub">All four pawns made it home.</p>

        <table className="stats">
          <thead>
            <tr>
              <th />
              <th>Home</th>
              <th>Captures</th>
              <th>Sixes</th>
              <th>Rolls</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((c) => (
              <tr key={c} className={c === winner ? 'champ' : ''} style={swatch(c)}>
                <th scope="row">
                  <span className="dot" />
                  {COLOR_NAME[c]}
                </th>
                <td>{homeCount(c)}/4</td>
                <td>{stats[c].captures}</td>
                <td>{stats[c].sixes}</td>
                <td>{stats[c].rolls}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="row">
          <button className="btn primary" onClick={startGame} autoFocus>
            <IconRestart /> Play again
          </button>
          <button className="btn ghost" onClick={backToSetup}>
            <IconExit /> Change players
          </button>
        </div>
      </div>
    </div>
  )
}
