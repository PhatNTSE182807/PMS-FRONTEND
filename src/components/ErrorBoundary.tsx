import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Rendered instead of the default (cyber-themed) fallback. */
  fallback?: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  private reset = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback(error, this.reset)

    return (
      <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#3B3632', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ color: '#E85A4F', marginBottom: '0.75rem' }}>An error occurred</h2>
        <p style={{ color: '#6F6A64', maxWidth: '500px', marginBottom: '1.5rem' }}>
          {error.message || 'Something went wrong.'}
        </p>
        <button type="button" className="btn btn-primary-cyan" onClick={this.reset}>
          Reload Application
        </button>
      </div>
    )
  }
}
