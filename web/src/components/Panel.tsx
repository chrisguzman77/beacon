import type { CSSProperties, ReactNode } from 'react'
import { color, shape } from '@/tokens'

// Soft rounded corners (the MARSH cards). Kept as a clip so the 2 px edge technique still works.
export const cut = (px: number) => `inset(0 round ${Math.max(2, Math.min(shape.round, px / 2))}px)`

// Depth: a light drop shadow under the panel. The filter sits on an unclipped wrapper, because
// clip-path would cut the shadow off. `glow` is accepted for callers but the design has no glow.
export const lift = (depth: number, _glow?: string) =>
  depth > 0 ? `drop-shadow(0 ${depth}px ${depth * 3}px rgb(0 0 0 / ${shape.shadow}))` : undefined

export const sheen = 'linear-gradient(transparent, transparent)'

type Props = {
  children?: ReactNode
  className?: string // outer box: size, grid placement
  inner?: string // inner face: layout, padding, text
  edge?: string // 2 px edge color, defaults to the line token
  fill?: string // face color, defaults to the surface token
  size?: number // corner size hint in px
  depth?: number // 0 flat, 1 resting, 2 raised, 3 floating
  glow?: string
  style?: CSSProperties
}

export default function Panel({ children, className = '', inner = '', edge, fill, size = 14, depth = 1, glow, style }: Props) {
  return (
    <div className={className} style={{ filter: lift(depth, glow), ...style }}>
      <div className="h-full w-full p-[2px]" style={{ clipPath: cut(size), background: edge ?? color.border }}>
        <div
          className={`relative h-full w-full ${inner}`}
          style={{ clipPath: cut(size - 1), background: `${sheen}, ${fill ?? color.surface}` }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
