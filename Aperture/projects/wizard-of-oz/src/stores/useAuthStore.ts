import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  signIn: async (email: string) => {
    // Send OTP code via email (no magic link redirect needed)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true, // Auto-create user if doesn't exist
      },
    });

    if (error) throw error;
  },

  verifyOtp: async (email: string, token: string) => {
    const { data: { session }, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error) throw error;

    // Update auth state
    set({ user: session?.user ?? null });
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    set({ user: null });
  },

  initialize: async () => {
    set({ loading: true });

    try {
      // Add timeout to prevent infinite loading (10 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Auth initialization timeout')), 10000);
      });

      // Race between session check and timeout
      const sessionPromise = supabase.auth.getSession();
      const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

      set({ user: session?.user ?? null, loading: false });

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ user: session?.user ?? null });
      });
    } catch (error) {
      console.error('Auth initialization error:', error);

      // Clear potentially corrupted auth state from localStorage
      try {
        const keys = Object.keys(localStorage);
        const authKeys = keys.filter(key =>
          key.startsWith('sb-') ||
          key.includes('supabase') ||
          key.includes('auth-token')
        );
        authKeys.forEach(key => localStorage.removeItem(key));
        console.log('Cleared auth localStorage keys:', authKeys);
      } catch (storageError) {
        console.error('Failed to clear localStorage:', storageError);
      }

      // Set loading to false so user can try to sign in again
      set({ user: null, loading: false });
    }
  },
}));
