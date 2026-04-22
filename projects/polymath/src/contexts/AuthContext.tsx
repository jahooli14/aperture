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
    // Restore session from local storage — no network call, resolves instantly.
    //
    // We deliberately do NOT run a background getUser() validation here. That
    // used to live in this effect, and it raced with the OAuth callback flow:
    // getSession() would resolve with the fresh session (signed in), then the
    // background getUser() would error for a fresh-token propagation / 5xx /
    // rate-limit reason and clobber the state back to { user: null }, bouncing
    // the user straight back to the sign-in screen. Symptom: "I sign in with
    // Google, the home page flashes for a second, then I'm signed out again."
    //
    // We don't need this extra call:
    //   - Supabase autoRefreshToken (default true) keeps the token fresh and
    //     fires SIGNED_OUT via onAuthStateChange if refresh ever fails — the
    //     subscription below picks that up and clears the state correctly.
    //   - authFetch handles 401s on individual API calls by refreshing +
    //     retrying once. A genuinely dead session surfaces there.
    // getSession() reads local storage and should resolve effectively
    // instantly, but we've seen it hang in the wild (stale IndexedDB lock on
    // iOS PWA, etc). A stuck promise here leaves the app on a blank spinner
    // forever, which at demo time looks like the app is totally dead. Cap it
    // at 5s and fall through to the unauthenticated state — worst case the
    // user has to sign in again, which is strictly better than a frozen UI.
    let settled = false
    const bail = setTimeout(() => {
      if (settled) return
      settled = true
      console.warn('[Auth] getSession() timed out after 5s — continuing as unauthenticated')
      currentUserId.current = null
      setState({ user: null, session: null, loading: false })
    }, 5000)

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (settled) return
      settled = true
      clearTimeout(bail)
      currentUserId.current = session?.user?.id ?? null
      setState({ user: session?.user ?? null, session, loading: false })
    }).catch(error => {
      if (settled) return
      settled = true
      clearTimeout(bail)
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

    return () => subscription.unsubscribe()
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
