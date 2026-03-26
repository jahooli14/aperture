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
    supabase.auth.getSession().then(({ data: { session } }) => {
      currentUserId.current = session?.user?.id ?? null
      setState({ user: session?.user ?? null, session, loading: false })
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

  return (
    <AuthContext.Provider value={{ ...state, isAuthenticated: !!state.user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  return useContext(AuthContext)
}
