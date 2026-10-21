import { useMemo } from 'react'
import {
  COLORS,
  HOME_COLUMN,
  SAFE_INDICES,
  START_INDEX,
  TRACK,
  type Cell,
  type Color,
} from '../../core/game'
import { muted } from '../../core/theme'
import Frame from './Frame'
import Yard from './Yard'
import Tile, { type Mark } from './Tile'
import Center from './Center'

/** Direction angle for a decal that should point from one cell to the next. */
const angleBetween = (from: Cell, to: Cell) => Math.atan2(-(to[1] - from[1]), to[0] - from[0])

/**
 * The whole board: frame and printed cloth, four yards, the 52-square track,
 * four five-square home columns and the finish in the middle.
 */
export default function Board() {
  const startCells = useMemo(
    () => Object.fromEntries(COLORS.map((c) => [START_INDEX[c], c])) as Record<number, Color>,
    [],
  )

  return (
    <group>
      <Frame />

      {COLORS.map((c) => (
        <Yard key={c} color={c} />
      ))}

      {TRACK.map((cell, i) => {
        const owner = startCells[i]
        const entry = COLORS.find((c) => (START_INDEX[c] + 50) % 52 === i)
        let mark: Mark | undefined
        if (SAFE_INDICES.has(i)) mark = { kind: 'star', onColour: !!owner }
        else if (entry) mark = { kind: 'arrow', color: entry, angle: angleBetween(cell, HOME_COLUMN[entry][0]) }
        return <Tile key={i} cell={cell} seed={i} color={owner ? muted(owner, 0.82) : undefined} mark={mark} />
      })}

      {COLORS.map((c) =>
        HOME_COLUMN[c].map((cell, i, col) => (
          <Tile
            key={c + i}
            cell={cell}
            seed={100 + COLORS.indexOf(c) * 5 + i}
            color={muted(c, 0.7 + i * 0.04)}
            mark={{ kind: 'chevron', angle: angleBetween(cell, col[i + 1] ?? [7, 7]) }}
          />
        )),
      )}

      <Center />
    </group>
  )
}
