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

  // Soft retry: clear the error and re-render children. For a failed lazy
  // chunk this re-triggers the import (lazyRetry re-fetches), so a user on a
  // flaky connection can recover without a full reload that re-downloads the
  // whole app. Primary action.
  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })

    // Hard reload — secondary, for when a soft retry isn't enough.
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
          style={{ backgroundColor: 'var(--brand-bg)' }}
        >
          <div
            className="max-w-md w-full glass-card p-8 text-center"
          >
            <div className="inline-flex items-center justify-center mb-4">
              <div
                className="h-16 w-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(var(--color-error-rgb), 0.1)' }}
              >
                <AlertTriangle
                  className="h-8 w-8"
                  style={{ color: "var(--brand-primary)" }}
                />
              </div>
            </div>

            <h2
              className="text-2xl font-bold mb-3"
              style={{ color: "var(--brand-text-primary)" }}
            >
              {typeof navigator !== 'undefined' && !navigator.onLine
                ? "You're offline"
                : 'Something went wrong'}
            </h2>

            <p
              className="mb-6 text-sm"
              style={{ color: "var(--brand-text-secondary)" }}
            >
              {typeof navigator !== 'undefined' && !navigator.onLine
                ? 'Reconnect and try again — the app needs a moment of signal to finish loading.'
                : 'Bad connection can do this. Try again.'}
            </p>

            {/* Show error details only in development */}
            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 text-left">
                <h3 className="text-sm font-bold mb-2" style={{ color: "var(--brand-text-primary)" }}>
                  Error Details:
                </h3>
                <div
                  className="p-4 rounded-lg text-xs font-mono overflow-auto max-h-64"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    color: "var(--brand-text-secondary)"
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

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleRetry}
                className="glass-card px-6 py-3 rounded-lg font-medium transition-all hover:bg-[rgba(255,255,255,0.1)]"
                style={{ color: "var(--brand-primary)" }}
              >
                Try again
              </button>
              <button
                onClick={this.handleReset}
                className="px-4 py-3 rounded-lg text-sm transition-all hover:opacity-80"
                style={{ color: "var(--brand-text-secondary)" }}
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
