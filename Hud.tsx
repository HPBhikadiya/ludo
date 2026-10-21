import { useEffect, useState } from 'react'
import { COLOR_NAME, HOME } from './game'
import { swatch } from './theme'
import { useGame, type Phase } from './store'
import { sfx } from './sound'
import {
  DieFace,
  IconBolt,
  IconExit,
  IconMute,
  IconPause,
  IconPlay,
  IconRestart,
  IconView,
  IconVolume,
  PawnIcon,
} from './icons'

const tint = swatch

/** Cycles random faces while the dice is in the air. */
function useShuffle(active: boolean, final: number) {
  const [face, setFace] = useState(final)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 85)
    return () => clearInterval(id)
  }, [active])
  return active ? face : final
}

function statusLine(phase: Phase, human: boolean) {
  switch (phase) {
    case 'roll':
      return human ? 'Roll the dice' : 'About to roll…'
    case 'rolling':
      return 'Rolling…'
    case 'select':
      return human ? 'Pick a pawn to move' : 'Choosing a pawn…'
    case 'moving':
      return 'Moving…'
    default:
      return ''
  }
}

function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const g = useGame.getState()
      if (e.code === 'Space') {
        e.preventDefault()
        const color = g.players[g.current]
        if (g.phase === 'roll' && g.seats[color] === 'human') g.roll()
      } else if (e.code === 'Escape') {
        g.togglePause()
      } else if (e.key === 'm' || e.key === 'M') {
        g.toggleMute()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

function Toolbar() {
  const muted = useGame((s) => s.muted)
  const toggleMute = useGame((s) => s.toggleMute)
  const togglePause = useGame((s) => s.togglePause)
  const resetView = useGame((s) => s.resetView)
  return (
    <div className="hud toolbar" role="toolbar" aria-label="Game controls">
      <button className="icon-btn" onClick={togglePause} title="Pause (Esc)" aria-label="Pause">
        <IconPause />
      </button>
      <button className="icon-btn" onClick={toggleMute} title={muted ? 'Unmute (M)' : 'Mute (M)'} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}>
        {muted ? <IconMute /> : <IconVolume />}
      </button>
      <button className="icon-btn" onClick={resetView} title="Reset camera" aria-label="Reset camera">
        <IconView />
      </button>
    </div>
  )
}

function Banner() {
  const players = useGame((s) => s.players)
  const current = useGame((s) => s.current)
  const seats = useGame((s) => s.seats)
  const message = useGame((s) => s.message)
  const active = players[current]
  return (
    <div className="top-stack">
      <div className="hud banner" style={tint(active)} key={active}>
        <span className="banner-pawn">
          <PawnIcon color={active} size={22} />
        </span>
        <div className="banner-text">
          <small>{seats[active] === 'cpu' ? 'CPU' : 'Player'}</small>
          <strong>{COLOR_NAME[active]}’s turn</strong>
        </div>
      </div>
      {message && (
        <div className="toast" key={message} aria-hidden>
          {message}
        </div>
      )}
      <div className="sr-only" aria-live="polite">
        {message}
      </div>
    </div>
  )
}

function Scoreboard() {
  const players = useGame((s) => s.players)
  const current = useGame((s) => s.current)
  const seats = useGame((s) => s.seats)
  const tokens = useGame((s) => s.tokens)
  const stats = useGame((s) => s.stats)
  return (
    <div className="hud board" aria-label="Scoreboard">
      {players.map((c, i) => {
        const home = tokens[c].filter((p) => p === HOME).length
        return (
          <div key={c} className={`pl ${i === current ? 'on' : ''}`} style={tint(c)}>
            <span className="pl-pawn">
              <PawnIcon color={c} size={16} />
            </span>
            <span className="pl-name">
              {COLOR_NAME[c]}
              <small>{seats[c] === 'cpu' ? 'CPU' : 'Player'}</small>
            </span>
            <span className="pips" title={`${home} of 4 pawns home`}>
              {tokens[c].map((p, k) => (
                <i key={k} className={p === HOME ? 'done' : p >= 0 ? 'live' : ''} />
              ))}
            </span>
            <span className="caps" title={`${stats[c].captures} captures`}>
              <IconBolt width={12} height={12} />
              {stats[c].captures}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function Dock() {
  const phase = useGame((s) => s.phase)
  const players = useGame((s) => s.players)
  const current = useGame((s) => s.current)
  const seats = useGame((s) => s.seats)
  const dice = useGame((s) => s.dice)
  const roll = useGame((s) => s.roll)

  const active = players[current]
  const human = seats[active] === 'human'
  const canRoll = phase === 'roll' && human
  const face = useShuffle(phase === 'rolling', dice.value)

  return (
    <div className="dock">
      <button
        className={`roll ${canRoll ? 'ready' : ''} ${phase === 'rolling' ? 'rolling' : ''}`}
        style={tint(active)}
        disabled={!canRoll}
        onClick={roll}
      >
        <span className="roll-die">
          <DieFace value={dice.rollId ? face : 6} size={46} />
        </span>
        <span className="roll-text">
          <strong>{canRoll ? 'Roll dice' : phase === 'rolling' ? 'Rolling…' : dice.rollId ? `You got ${dice.value}` : 'Dice'}</strong>
          <small>{canRoll ? 'Click or press Space' : statusLine(phase, human)}</small>
        </span>
      </button>
    </div>
  )
}

function Feed() {
  const log = useGame((s) => s.log)
  return (
    <ol className="feed" aria-hidden>
      {log.slice(-5).map((e) => (
        <li key={e.id} style={tint(e.color)}>
          <i className="dot" />
          {e.text}
        </li>
      ))}
    </ol>
  )
}

function PauseMenu() {
  const togglePause = useGame((s) => s.togglePause)
  const startGame = useGame((s) => s.startGame)
  const backToSetup = useGame((s) => s.backToSetup)
  return (
    <div className="overlay dim" role="dialog" aria-modal aria-label="Paused">
      <div className="card pause">
        <h2>Paused</h2>
        <button className="btn primary xl" onClick={togglePause} autoFocus>
          <IconPlay /> Resume
        </button>
        <button className="btn ghost" onClick={startGame}>
          <IconRestart /> Restart game
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            sfx.click()
            backToSetup()
          }}
        >
          <IconExit /> Main menu
        </button>
      </div>
    </div>
  )
}

export default function Hud() {
  const paused = useGame((s) => s.paused)
  useHotkeys()
  return (
    <>
      <Toolbar />
      <Banner />
      <Scoreboard />
      <Feed />
      <Dock />
      {paused && <PauseMenu />}
    </>
  )
}
