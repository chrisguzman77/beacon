import { Component } from 'react'
import type { ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { color } from '@/tokens'

// Safety net for the live demo: if any screen throws, show a calm OmniRisk card with Reload
// instead of a blank page. The beacon keeps enforcing stop work on its own either way.
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Screen error', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center" style={{ background: color.bg, color: color.text }}>
        <Logo className="size-14" />
        <h1 className="text-[26px] font-semibold">Something went wrong on this screen</h1>
        <p className="max-w-md text-[15px]" style={{ color: color.muted }}>
          Reload to try again. The beacon keeps enforcing stop work on its own, so nothing on site depends on this page.
        </p>
        <div className="flex gap-3">
          <button onClick={() => location.reload()} className="press flex h-11 items-center gap-2 rounded-md px-5 text-[15px] font-semibold" style={{ background: color.accent, color: color.accentInk }}>
            <RotateCcw className="size-4" /> Reload
          </button>
          <a href="/dashboard" className="press flex h-11 items-center rounded-md px-5 text-[15px] font-semibold" style={{ boxShadow: `inset 0 0 0 1.5px ${color.border}` }}>
            Dashboard
          </a>
        </div>
        <p className="font-mono text-[11px]" style={{ color: color.muted }}>{this.state.error.message}</p>
      </div>
    )
  }
}
