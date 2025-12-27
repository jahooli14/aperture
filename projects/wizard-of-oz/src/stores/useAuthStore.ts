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

// Track if we've already set up the auth listener
let authListenerInitialized = false;

export const useAuthStore = create<AuthState>((set, get) => ({
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

    // Set up auth listener FIRST (before getSession) to ensure we don't miss any changes
    // This listener persists across the app lifecycle
    if (!authListenerInitialized) {
      authListenerInitialized = true;
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('[Auth] State change:', event, session?.user?.id);
        set({ user: session?.user ?? null, loading: false });
      });

      // Store subscription for potential cleanup (though typically not needed for global auth)
      if (typeof window !== 'undefined') {
        (window as any).__authSubscription = subscription;
      }
    }

    try {
      // Try to get the current session with a longer timeout (15 seconds)
      // This is more forgiving on slow networks
      const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) => {
        setTimeout(() => {
          console.warn('[Auth] Session check timed out, will rely on auth listener');
          resolve({ data: { session: null } });
        }, 15000);
      });

      // Race between session check and timeout
      const sessionPromise = supabase.auth.getSession();
      const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

      // Only update if we got a valid session response
      // The auth listener will handle the rest
      if (session) {
        set({ user: session.user, loading: false });
      } else {
        // No session found, but don't clear anything
        // The auth listener will update if a session exists
        set({ loading: false });
      }
    } catch (error) {
      console.error('[Auth] Initialization error:', error);

      // Don't aggressively clear localStorage - the session might still be valid
      // Just set loading to false so user can try again or the auth listener can recover
      set({ loading: false });

      // Only clear storage if explicitly a session corruption error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('invalid') || errorMessage.includes('malformed') || errorMessage.includes('JWT')) {
        console.log('[Auth] Session appears corrupted, clearing auth storage');
        try {
          const keys = Object.keys(localStorage);
          const authKeys = keys.filter(key =>
            key.startsWith('sb-') ||
            key.includes('supabase') ||
            key.includes('auth-token')
          );
          authKeys.forEach(key => localStorage.removeItem(key));
          console.log('[Auth] Cleared auth localStorage keys:', authKeys);
        } catch (storageError) {
          console.error('[Auth] Failed to clear localStorage:', storageError);
        }
      }
    }
  },
}));
