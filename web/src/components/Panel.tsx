import type { CSSProperties, ReactNode } from 'react'
import { color, shape } from '@/tokens'

// Chamfered corners (top left, bottom right) for every panel, window and control.
// MARSH looks with shape.round swap the chamfer for soft rounded corners.
export const cut = (px: number) =>
  shape.round
    ? `inset(0 round ${Math.max(2, Math.min(shape.round, px / 1.6))}px)`
    : `polygon(${px}px 0, 100% 0, 100% calc(100% - ${px}px), calc(100% - ${px}px) 100%, 0 100%, 0 ${px}px)`

// Depth: a drop shadow under the panel and a lit top face. Glow adds a colored halo for hazards.
// The filter sits on an unclipped wrapper, because clip-path would cut the shadow off.
export const lift = (depth: number, glow?: string) =>
  [
    depth > 0 && `drop-shadow(0 ${depth * 3}px ${depth * 6}px rgb(0 0 0 / ${shape.shadow}))`,
    glow && shape.glow && `drop-shadow(0 0 ${6 + depth * 3}px ${glow})`,
  ]
    .filter(Boolean)
    .join(' ') || undefined

export const sheen = shape.marsh ? 'linear-gradient(transparent, transparent)' : 'linear-gradient(180deg, rgb(255 255 255 / 0.07), rgb(255 255 255 / 0) 45%)'

type Props = {
  children?: ReactNode
  className?: string // outer box: size, grid placement
  inner?: string // inner face: layout, padding, text
  edge?: string // 2 px edge color, defaults to the line token
  fill?: string // face color, defaults to the surface token
  size?: number // chamfer in px
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
