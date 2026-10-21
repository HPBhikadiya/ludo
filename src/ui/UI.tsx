import { useGame } from '../core/store'
import Setup from './Setup'
import Hud from './Hud'
import GameOver from './GameOver'

export default function UI() {
  const phase = useGame((s) => s.phase)
  return (
    <div className="ui" data-phase={phase}>
      {phase === 'setup' ? <Setup /> : <Hud />}
      {phase === 'over' && <GameOver />}
    </div>
  )
}
