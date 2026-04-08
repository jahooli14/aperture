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
    // Timeout: if auth doesn't resolve within 10s, stop loading and show the app
    const timeoutId = setTimeout(() => {
      setState(prev => {
        if (prev.loading) {
          console.warn('[Auth] Timed out waiting for session — continuing without auth')
          return { user: null, session: null, loading: false }
        }
        return prev
      })
    }, 10_000)

    // Use getSession to restore from local storage, then immediately validate
    // with getUser to ensure the token is still valid (refreshes if needed)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Validate the token is still good — this triggers a refresh if expired
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) {
          // Token was expired and refresh failed — treat as signed out
          console.warn('[Auth] Session expired and refresh failed:', error?.message)
          currentUserId.current = null
          setState({ user: null, session: null, loading: false })
          return
        }
        currentUserId.current = user.id
        // Re-fetch session after potential refresh to get the fresh token
        const { data: { session: freshSession } } = await supabase.auth.getSession()
        setState({ user, session: freshSession, loading: false })
      } else {
        currentUserId.current = null
        setState({ user: null, session: null, loading: false })
      }
    }).catch(error => {
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
      clearTimeout(timeoutId)
      subscription.unsubscribe()
    }
  }, [])

  // Block rendering until auth state is resolved — prevents API calls with stale/missing tokens
  if (state.loading) {
    return (
      <AuthContext.Provider value={{ ...state, isAuthenticated: false }}>
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--brand-bg)' }}>
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--brand-primary)', borderTopColor: 'transparent' }} />
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
