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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h1 className="text-xl font-bold text-neutral-900">
                Something went wrong
              </h1>
            </div>

            <p className="text-neutral-600">
              The app encountered an unexpected error. This has been logged and we'll look into it.
            </p>

            {this.state.error && (
              <details className="text-sm">
                <summary className="cursor-pointer text-neutral-500 hover:text-neutral-700">
                  Error details
                </summary>
                <pre className="mt-2 p-3 bg-neutral-100 rounded overflow-auto text-xs">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <button
              onClick={this.handleReset}
              className="w-full px-4 py-3 bg-blue-900 text-white rounded-lg font-medium hover:bg-blue-950 transition-colors inline-flex items-center justify-center gap-2"
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
