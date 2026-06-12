import { Component, Fragment, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  /** shown in the fallback so the user knows which window died */
  label?: string
  children: ReactNode
}

interface ErrorBoundaryState {
  failed: boolean
  /** bumping this key remounts the children — "Neu laden" */
  generation: number
}

/**
 * Per-window error boundary: a crashing panel must never kill the whole
 * cockpit. Shows a token-styled fallback with a reload button that remounts
 * the children via key bump (styles: .error-fallback in styles/base.css).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false, generation: 0 }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { failed: true }
  }

  override componentDidCatch(error: unknown): void {
    // keep a trace for debugging — the UI already shows the fallback
    console.error('[ErrorBoundary] panel crashed:', error)
  }

  private readonly reload = (): void => {
    this.setState((s) => ({ failed: false, generation: s.generation + 1 }))
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="error-fallback" role="alert">
          <span className="error-fallback-title">
            ⚠ Fenster abgestürzt{this.props.label ? ` — ${this.props.label}` : ''}
          </span>
          <button onClick={this.reload}>Neu laden</button>
        </div>
      )
    }
    return <Fragment key={this.state.generation}>{this.props.children}</Fragment>
  }
}
