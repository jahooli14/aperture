import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthStore {
  user: User | null
  session: Session | null
  isLoading: boolean
  isConfigured: boolean

  // Actions
  initialize: () => Promise<void>
  sendOtp: (email: string) => Promise<{ error?: string }>
  verifyOtp: (email: string, token: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isLoading: true,
      isConfigured: isSupabaseConfigured,

      initialize: async () => {
        if (!isSupabaseConfigured) {
          set({ isLoading: false })
          return
        }

        try {
          const { data: { session } } = await supabase.auth.getSession()

          if (session) {
            set({ user: session.user, session, isLoading: false })
          } else {
            set({ user: null, session: null, isLoading: false })
          }

          supabase.auth.onAuthStateChange((_event, session) => {
            set({
              user: session?.user ?? null,
              session: session ?? null
            })
          })
        } catch (error) {
          console.error('Auth initialization error:', error)
          set({ isLoading: false })
        }
      },

      sendOtp: async (email) => {
        if (!isSupabaseConfigured) {
          return { error: 'Supabase not configured' }
        }

        try {
          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
              shouldCreateUser: true
            }
          })

          if (error) {
            return { error: error.message }
          }

          return {}
        } catch (error) {
          return { error: 'Failed to send code' }
        }
      },

      verifyOtp: async (email, token) => {
        if (!isSupabaseConfigured) {
          return { error: 'Supabase not configured' }
        }

        set({ isLoading: true })
        try {
          const { data, error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: 'email'
          })

          if (error) {
            set({ isLoading: false })
            return { error: error.message }
          }

          set({
            user: data.user,
            session: data.session,
            isLoading: false
          })
          return {}
        } catch (error) {
          set({ isLoading: false })
          return { error: 'Failed to verify code' }
        }
      },

      signOut: async () => {
        if (!isSupabaseConfigured) return

        await supabase.auth.signOut()
        set({ user: null, session: null })
      }
    }),
    {
      name: 'analogue-auth',
      partialize: () => ({})
    }
  )
)
