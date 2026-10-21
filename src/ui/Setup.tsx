import { useState, type CSSProperties, type ReactNode } from 'react'
import { COLORS, COLOR_NAME, type Color } from '../core/game'
import { swatch } from '../core/theme'
import { useGame, type Seat } from '../core/store'
import { sfx } from '../core/sound'
import { DieFace, IconBan, IconBolt, IconPlay, IconRepeat, IconStar, IconTarget, PawnIcon } from './icons'

const SEATS: { id: Seat; label: string }[] = [
  { id: 'human', label: 'Human' },
  { id: 'cpu', label: 'CPU' },
  { id: 'off', label: 'Off' },
]

const RULES: { icon: ReactNode; text: string }[] = [
  { icon: <DieFace value={6} size={22} />, text: 'Roll a 6 to bring a pawn out of the yard' },
  { icon: <IconBolt />, text: 'Land on a rival to send them back home' },
  { icon: <IconStar />, text: 'Stars and start squares are safe' },
  { icon: <IconTarget />, text: 'You need the exact roll to finish' },
  { icon: <IconRepeat />, text: 'A 6, a capture or a pawn home earns another roll' },
  { icon: <IconBan />, text: 'Three sixes in a row forfeit the turn' },
]

const colorVar = (c: Color, extra: Record<string, string | number> = {}) => ({ ...swatch(c), ...extra }) as CSSProperties

export default function Setup() {
  const seats = useGame((s) => s.seats)
  const setSeat = useGame((s) => s.setSeat)
  const startGame = useGame((s) => s.startGame)
  const [showRules, setShowRules] = useState(false)

  const playing = COLORS.filter((c) => seats[c] !== 'off').length

  return (
    <div className="overlay setup-overlay">
      <section className="card setup" aria-labelledby="title">
        <header className="brand">
          <h1 id="title" className="wordmark" aria-label="Ludo">
            {[...'LUDO'].map((ch, i) => (
              <span key={i} aria-hidden style={colorVar(COLORS[i], { '--i': i })}>
                {ch}
              </span>
            ))}
          </h1>
          <p className="tagline">The classic race home — in 3D</p>
        </header>

        <div className="section-title">
          <span>Players</span>
          <em>{playing} of 4 seated</em>
        </div>
        <div className="seats">
          {COLORS.map((c) => {
            const current = seats[c]
            const locked = current !== 'off' && playing <= 2
            return (
              <div key={c} className={`seat ${current === 'off' ? 'off' : ''}`} style={colorVar(c)}>
                <span className="seat-pawn">
                  <PawnIcon color={c} size={24} />
                </span>
                <span className="seat-name">{COLOR_NAME[c]}</span>
                <div
                  className="seg"
                  role="radiogroup"
                  aria-label={`${COLOR_NAME[c]} seat`}
                  style={{ '--i': SEATS.findIndex((s) => s.id === current) } as CSSProperties}
                >
                  {SEATS.map((s) => (
                    <button
                      key={s.id}
                      role="radio"
                      aria-checked={current === s.id}
                      className={current === s.id ? 'on' : ''}
                      disabled={s.id === 'off' && locked}
                      title={s.id === 'off' && locked ? 'At least two players are needed' : undefined}
                      onClick={() => {
                        sfx.click()
                        setSeat(c, s.id)
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <button className="btn primary xl" onClick={startGame}>
          <IconPlay /> Start game
        </button>

        <button className="link" aria-expanded={showRules} onClick={() => setShowRules((v) => !v)}>
          {showRules ? 'Hide rules' : 'How to play'}
        </button>
        {showRules && (
          <ul className="rules">
            {RULES.map((r, i) => (
              <li key={i}>
                <span className="rule-icon">{r.icon}</span>
                {r.text}
              </li>
            ))}
          </ul>
        )}

        <p className="foot">
          Drag to rotate · scroll to zoom · <kbd>Space</kbd> to roll
        </p>
      </section>
    </div>
  )
}
