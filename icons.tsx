import type { SVGProps } from 'react'
import type { Color } from './game'
import { PAWN_STYLE } from './theme'

type IconProps = SVGProps<SVGSVGElement>

const stroke = (p: IconProps): IconProps => ({
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  ...p,
})

export const IconPause = (p: IconProps) => (
  <svg {...stroke(p)}>
    <path d="M8 5v14M16 5v14" />
  </svg>
)
export const IconPlay = (p: IconProps) => (
  <svg {...stroke({ fill: 'currentColor', ...p })}>
    <path d="M7 4.5v15l12.5-7.5z" />
  </svg>
)
export const IconVolume = (p: IconProps) => (
  <svg {...stroke(p)}>
    <path d="M11 5 6.5 9H3v6h3.5L11 19z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
)
export const IconMute = (p: IconProps) => (
  <svg {...stroke(p)}>
    <path d="M11 5 6.5 9H3v6h3.5L11 19z" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </svg>
)
export const IconView = (p: IconProps) => (
  <svg {...stroke(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
  </svg>
)
export const IconRestart = (p: IconProps) => (
  <svg {...stroke(p)}>
    <path d="M20 11a8 8 0 1 0-2.3 5.7" />
    <path d="M20 4v7h-7" />
  </svg>
)
export const IconExit = (p: IconProps) => (
  <svg {...stroke(p)}>
    <path d="M9 4H5v16h4" />
    <path d="m16 8 4 4-4 4M20 12H9" />
  </svg>
)
export const IconBolt = (p: IconProps) => (
  <svg {...stroke(p)}>
    <path d="m13 3-8 11h6l-1 7 8-11h-6z" />
  </svg>
)
export const IconStar = (p: IconProps) => (
  <svg {...stroke(p)}>
    <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />
  </svg>
)
export const IconTarget = (p: IconProps) => (
  <svg {...stroke(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
)
export const IconRepeat = (p: IconProps) => (
  <svg {...stroke(p)}>
    <path d="M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4" />
  </svg>
)
export const IconBan = (p: IconProps) => (
  <svg {...stroke(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m6 6 12 12" />
  </svg>
)
export const IconHome = (p: IconProps) => (
  <svg {...stroke(p)}>
    <path d="m3 11 9-7 9 7" />
    <path d="M5.5 9.5V20h13V9.5" />
  </svg>
)
export const IconCrown = (p: IconProps) => (
  <svg {...stroke({ fill: 'currentColor', strokeWidth: 1.5, ...p })}>
    <path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
  </svg>
)

const CREAM = '#F3EBD8'

/**
 * A turned pawn tinted by the surrounding `--c` / `--c-dark` custom properties. Each colour has its own
 * head, the same four silhouettes as the 3D pieces (see PAWN_STYLE in theme.ts).
 */
export function PawnIcon({ size = 28, color = 'red', ...rest }: IconProps & { size?: number; color?: Color }) {
  const style = PAWN_STYLE[color]
  const edge = (y: number) => 5.5 + (47 - y) * 0.575
  return (
    <svg width={size} height={size * 1.3} viewBox="0 0 40 52" aria-hidden {...rest}>
      <ellipse cx="20" cy="47.5" rx="15" ry="3.6" fill="var(--c-dark)" />
      <path d="M5.5 47C7 40 14.5 35 17 27h6c2.5 8 10 13 11.5 20z" fill="var(--c)" />
      <path d="M23 27c2.5 8 10 13 11.5 20H24c.6-7 0-14-1-20z" fill="#000" opacity=".16" />
      {Array.from({ length: style.bands }, (_, i) => {
        const y = 43 - i * 3.6
        return <path key={i} d={`M${edge(y)} ${y}Q20 ${y + 3} ${40 - edge(y)} ${y}`} fill="none" stroke={CREAM} strokeWidth="1.5" strokeLinecap="round" />
      })}
      <rect x="17.3" y="20" width="5.4" height="7.5" fill="var(--c-dark)" />
      <ellipse cx="20" cy="26.5" rx="8" ry="3" fill={CREAM} />
      {style.head === 'ball' && (
        <>
          <circle cx="20" cy="14" r="9.5" fill="var(--c)" />
          <path d="M20 4.5a9.5 9.5 0 0 1 0 19c4-3 5.5-9 0-19z" fill="#000" opacity=".16" />
          <ellipse cx="16.5" cy="10.5" rx="3.2" ry="2.3" fill="#fff" opacity=".45" transform="rotate(-30 16.5 10.5)" />
        </>
      )}
      {style.head === 'onion' && (
        <>
          <path d="M20 1.5C21 6 29.5 8 28.5 15 27.8 21.5 12.2 21.5 11.5 15 10.5 8 19 6 20 1.5z" fill="var(--c)" />
          <path d="M20 1.5C21 6 29.5 8 28.5 15 27.8 21.5 24 22 20 21.5 24 17 24 7 20 1.5z" fill="#000" opacity=".16" />
          <ellipse cx="15.8" cy="12.5" rx="2.4" ry="3.4" fill="#fff" opacity=".4" transform="rotate(12 15.8 12.5)" />
        </>
      )}
      {style.head === 'button' && (
        <>
          <ellipse cx="20" cy="15.5" rx="12.5" ry="6.5" fill="var(--c)" />
          <path d="M20 9a12.5 6.5 0 0 1 0 13c5-1.5 8-8.5 0-13z" fill="#000" opacity=".16" />
          <ellipse cx="15.5" cy="12.6" rx="4.6" ry="1.8" fill="#fff" opacity=".42" transform="rotate(-8 15.5 12.6)" />
        </>
      )}
      {style.head === 'gem' && (
        <>
          <path d="M20 3 30 13.5 20 22 10 13.5z" fill="var(--c)" />
          <path d="M20 3 30 13.5H20z" fill="#fff" opacity=".28" />
          <path d="M20 13.5H30L20 22z" fill="#000" opacity=".18" />
          <path d="M10 13.5H30" stroke={CREAM} strokeWidth="1.2" />
        </>
      )}
    </svg>
  )
}

const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.24], [0.72, 0.24], [0.28, 0.5], [0.72, 0.5], [0.28, 0.76], [0.72, 0.76]],
}

/** A bone die face with carved pips (the one is red), matching the 3D die. */
export function DieFace({ value, size = 44, ...rest }: IconProps & { value: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden {...rest}>
      <rect x="2" y="2" width="44" height="44" rx="10" fill={CREAM} />
      <rect x="2" y="2" width="44" height="44" rx="10" fill="none" stroke="#5B432E" strokeOpacity=".45" strokeWidth="1.4" />
      <rect x="5" y="4.5" width="38" height="15" rx="7" fill="#fff" opacity=".4" />
      {PIPS[value].map(([x, y], i) => {
        const r = value === 1 ? 6.8 : 4.3
        const ink = value === 1 ? '#B8301F' : '#2A1D2B'
        return (
          <g key={i}>
            <circle cx={x * 48} cy={y * 48 + 0.7} r={r + 0.6} fill="#fff" opacity=".7" />
            <circle cx={x * 48} cy={y * 48} r={r} fill={ink} />
            <circle cx={x * 48} cy={y * 48 - 0.8} r={r * 0.7} fill="#000" opacity=".28" />
          </g>
        )
      })}
    </svg>
  )
}
