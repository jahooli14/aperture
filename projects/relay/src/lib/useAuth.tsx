import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { api } from './api'
import { ensurePushHealthy } from './push'
import type { Profile } from './types'

interface AuthValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  setProfile: (profile: Profile) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) setProfile(null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Repair this device's push registration whenever someone is signed in.
  useEffect(() => {
    if (!session) return
    void ensurePushHealthy()
  }, [session])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    api
      .me()
      .then(({ profile: loaded }) => {
        if (!cancelled) setProfile(loaded)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [session])

  const value: AuthValue = {
    session,
    profile,
    loading,
    setProfile,
    signOut: async () => {
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
