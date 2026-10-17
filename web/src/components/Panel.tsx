import type { CSSProperties, ReactNode } from 'react'

// Chamfered corners (top left, bottom right) for every panel, window and control.
export const cut = (px: number) =>
  `polygon(${px}px 0, 100% 0, 100% calc(100% - ${px}px), calc(100% - ${px}px) 100%, 0 100%, 0 ${px}px)`

type Props = {
  children?: ReactNode
  className?: string // outer box: size, grid placement
  inner?: string // inner face: layout, padding, text
  edge?: string // 2 px edge color, defaults to the line token
  fill?: string // face color, defaults to the surface token
  size?: number // chamfer in px
  style?: CSSProperties
}

export default function Panel({ children, className = '', inner = '', edge, fill, size = 14, style }: Props) {
  return (
    <div
      className={`bg-line p-[2px] ${className}`}
      style={{ clipPath: cut(size), ...(edge && { background: edge }), ...style }}
    >
      <div
        className={`relative h-full w-full bg-surface ${inner}`}
        style={{ clipPath: cut(size - 1), ...(fill && { background: fill }) }}
      >
        {children}
      </div>
    </div>
  )
}
