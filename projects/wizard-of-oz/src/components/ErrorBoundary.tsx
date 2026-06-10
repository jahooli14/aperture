import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render-time errors anywhere below it and shows a recovery screen
 * instead of letting React unmount the whole tree to a blank white page.
 *
 * lazyRetry() already assumes a boundary like this exists ("Throwing lets the
 * nearest ErrorBoundary render something useful"). Without one, any thrown
 * render error — a failed lazy chunk after a deploy, a bad hook order, a null
 * deref — wipes the screen with no way back. This is the safety net.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Render error caught:', error, info.componentStack);
  }

  handleReload = () => {
    // Clear app state but preserve the Supabase auth session so a reload
    // doesn't sign the user out.
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !key.startsWith('sb-') && !key.includes('supabase') && !key.includes('auth')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
      sessionStorage.clear();
    } catch (e) {
      console.error('[ErrorBoundary] Failed to clear storage:', e);
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
          <div className="text-5xl mb-4">😕</div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
          <p className="text-gray-600 mb-5">
            Pupils hit an unexpected error. Reloading usually fixes it — your photos are safe.
          </p>
          {this.state.error?.message && (
            <pre className="text-xs text-gray-500 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-lg p-3 mb-5 text-left overflow-auto max-h-40">
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            className="bg-cyan-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-cyan-700 transition-colors min-h-[44px]"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
