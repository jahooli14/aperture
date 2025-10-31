/**
 * Error Boundary Component
 * Catches React errors and displays a fallback UI
 */

import React, { Component, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
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

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Error stack:', error.stack)
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack)

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

    // Reload the page to reset state
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div
          className="min-h-screen flex items-center justify-center p-4"
          style={{ backgroundColor: 'var(--premium-surface-base)' }}
        >
          <div
            className="max-w-md w-full premium-card p-8 text-center"
            style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}
          >
            <div className="inline-flex items-center justify-center mb-4">
              <div
                className="h-16 w-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
              >
                <AlertTriangle
                  className="h-8 w-8"
                  style={{ color: '#ef4444' }}
                />
              </div>
            </div>

            <h2
              className="text-2xl font-bold mb-3"
              style={{ color: 'var(--premium-text-primary)' }}
            >
              Something went wrong
            </h2>

            <p
              className="mb-6 text-sm"
              style={{ color: 'var(--premium-text-secondary)' }}
            >
              We've encountered an unexpected error. Please refresh the page to continue.
            </p>

            {/* Always show error details for debugging */}
            {this.state.error && (
              <div className="mb-6 text-left">
                <h3 className="text-sm font-bold mb-2" style={{ color: '#ef4444' }}>
                  Error Details:
                </h3>
                <div
                  className="p-4 rounded-lg text-xs font-mono overflow-auto max-h-64"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)'
                  }}
                >
                  <div className="mb-3">
                    <strong>Message:</strong>
                    <div className="mt-1 whitespace-pre-wrap">{this.state.error.message}</div>
                  </div>

                  {this.state.error.stack && (
                    <div className="mb-3">
                      <strong>Stack Trace:</strong>
                      <pre className="mt-1 whitespace-pre-wrap text-xs overflow-x-auto">
                        {this.state.error.stack}
                      </pre>
                    </div>
                  )}

                  {this.state.errorInfo && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="mt-1 whitespace-pre-wrap text-xs overflow-x-auto">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="premium-glass border px-6 py-3 rounded-lg font-medium transition-all hover:bg-white/10"
              style={{
                borderColor: 'rgba(59, 130, 246, 0.3)',
                color: 'var(--premium-blue)'
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
