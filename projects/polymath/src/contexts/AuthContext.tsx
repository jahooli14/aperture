import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useMemoryStore } from '../stores/useMemoryStore'
import { useProjectStore } from '../stores/useProjectStore'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  isAuthenticated: false,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<AuthContextValue, 'isAuthenticated'>>({
    user: null,
    session: null,
    loading: true,
  })
  const currentUserId = useRef<string | null>(null)

  useEffect(() => {
    // Safety timeout: if getSession() hasn't resolved in 3 seconds, force loading=false.
    // This prevents a permanent black screen if Supabase client hangs for any reason.
    const timeout = setTimeout(() => {
      setState(prev => {
        if (prev.loading) {
          console.warn('[Auth] getSession() timed out after 3s — rendering without session')
          return { user: null, session: null, loading: false }
        }
        return prev
      })
    }, 3000)

    // Restore session from local storage — no network call, resolves instantly.
    // Token validation happens in the background; authFetch handles 401s as a safety net.
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout)
      currentUserId.current = session?.user?.id ?? null
      setState({ user: session?.user ?? null, session, loading: false })

      // Background: validate token freshness without blocking the UI
      if (session) {
        supabase.auth.getUser().then(({ error }) => {
          if (error) {
            console.warn('[Auth] Session expired and refresh failed:', error.message)
            currentUserId.current = null
            setState({ user: null, session: null, loading: false })
          }
        }).catch(() => {
          // Network error — keep using cached session, authFetch will handle 401s
        })
      }
    }).catch(error => {
      clearTimeout(timeout)
      console.error('[Auth] Failed to get session:', error)
      currentUserId.current = null
      setState({ user: null, session: null, loading: false })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id ?? null
      // Clear cached store data only when switching between two known accounts or signing out.
      // If currentUserId is null it means this is the initial session restore on page load — don't clear.
      if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && currentUserId.current !== null && newUserId !== currentUserId.current)) {
        useMemoryStore.getState().clearCache()
        useProjectStore.getState().clearCache()
      }
      currentUserId.current = newUserId
      setState({ user: session?.user ?? null, session, loading: false })
    })

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  // Block rendering until auth state is resolved — prevents API calls with stale/missing tokens.
  // The 3-second timeout above guarantees this won't persist forever.
  if (state.loading) {
    return (
      <AuthContext.Provider value={{ ...state, isAuthenticated: false }}>
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0f1829' }}>
          <div className="text-center">
            <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-3"
                 style={{ borderColor: '#38bdf8', borderTopColor: 'transparent' }} />
            <p style={{ color: '#9ca3af', fontSize: '14px' }}>Loading...</p>
          </div>
        </div>
      </AuthContext.Provider>
    )
  }

  return (
    <AuthContext.Provider value={{ ...state, isAuthenticated: !!state.user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  return useContext(AuthContext)
}
