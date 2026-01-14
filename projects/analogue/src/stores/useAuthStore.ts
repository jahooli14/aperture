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
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>
  signUpWithEmail: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  signInWithMagicLink: (email: string) => Promise<{ error?: string }>
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
          // Get current session
          const { data: { session } } = await supabase.auth.getSession()

          if (session) {
            set({ user: session.user, session, isLoading: false })
          } else {
            set({ user: null, session: null, isLoading: false })
          }

          // Listen for auth changes
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

      signInWithEmail: async (email, password) => {
        if (!isSupabaseConfigured) {
          return { error: 'Supabase not configured' }
        }

        set({ isLoading: true })
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
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
          return { error: 'Failed to sign in' }
        }
      },

      signUpWithEmail: async (email, password) => {
        if (!isSupabaseConfigured) {
          return { error: 'Supabase not configured' }
        }

        set({ isLoading: true })
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password
          })

          if (error) {
            set({ isLoading: false })
            return { error: error.message }
          }

          // If email confirmation is required, user won't be logged in yet
          if (data.user && !data.session) {
            set({ isLoading: false })
            return { error: 'Check your email for a confirmation link' }
          }

          set({
            user: data.user,
            session: data.session,
            isLoading: false
          })
          return {}
        } catch (error) {
          set({ isLoading: false })
          return { error: 'Failed to sign up' }
        }
      },

      signOut: async () => {
        if (!isSupabaseConfigured) return

        await supabase.auth.signOut()
        set({ user: null, session: null })
      },

      signInWithMagicLink: async (email) => {
        if (!isSupabaseConfigured) {
          return { error: 'Supabase not configured' }
        }

        try {
          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
              emailRedirectTo: window.location.origin
            }
          })

          if (error) {
            return { error: error.message }
          }

          return {}
        } catch (error) {
          return { error: 'Failed to send magic link' }
        }
      }
    }),
    {
      name: 'analogue-auth',
      partialize: () => ({
        // Don't persist sensitive data, re-fetch from supabase
      })
    }
  )
)
