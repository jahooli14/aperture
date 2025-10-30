/**
 * Error Boundary Component
 * Catches React errors and displays fallback UI instead of blank screen
 */

import { Component, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: any
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('React Error Boundary caught:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--premium-bg-primary)' }}>
          <div className="max-w-md w-full premium-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)' }}>
                <AlertCircle className="h-6 w-6" style={{ color: '#ef4444' }} />
              </div>
              <h1 className="text-xl font-bold premium-text-platinum">
                Something went wrong
              </h1>
            </div>

            <p style={{ color: 'var(--premium-text-secondary)' }}>
              The app encountered an unexpected error. This has been logged and we'll look into it.
            </p>

            {this.state.error && (
              <details className="text-sm">
                <summary className="cursor-pointer transition-colors" style={{ color: 'var(--premium-text-tertiary)' }}>
                  Error details
                </summary>
                <pre className="mt-2 p-3 rounded overflow-auto text-xs" style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--premium-text-secondary)',
                  borderLeft: '3px solid #ef4444'
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <button
              onClick={this.handleReset}
              className="w-full px-4 py-3 rounded-lg font-medium transition-all inline-flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, var(--premium-blue), var(--premium-indigo))',
                color: 'white'
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Return to Home
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
