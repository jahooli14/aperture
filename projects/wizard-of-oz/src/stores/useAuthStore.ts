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
    const startTime = Date.now();
    console.log('[Auth] Starting initialization...');
    set({ loading: true });

    // Set up auth listener FIRST (before getSession) to ensure we don't miss any changes
    // This listener persists across the app lifecycle
    if (!authListenerInitialized) {
      authListenerInitialized = true;
      console.log('[Auth] Setting up auth state listener...');
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        console.log('[Auth] State change:', event, 'user:', session?.user?.id, 'time:', Date.now() - startTime, 'ms');
        set({ user: session?.user ?? null, loading: false });
      });

      // Store subscription for potential cleanup (though typically not needed for global auth)
      if (typeof window !== 'undefined') {
        (window as any).__authSubscription = subscription;
      }
    } else {
      console.log('[Auth] Auth listener already initialized');
    }

    try {
      // getSession() reads localStorage and is usually instant, but if Supabase
      // decides a token needs refreshing it will hit the network. On poor
      // signal that fetch hangs — and we used to wait 15s before falling
      // through, which looked like the app was broken. 3s is plenty to read
      // localStorage; if the network is slow the listener will catch up later.
      console.log('[Auth] Calling getSession()...');
      const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) => {
        setTimeout(() => {
          console.warn('[Auth] Session check timed out after 3s, continuing with cached state');
          resolve({ data: { session: null } });
        }, 3000);
      });

      const sessionPromise = supabase.auth.getSession();
      const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
      console.log('[Auth] getSession completed in', Date.now() - startTime, 'ms, hasSession:', !!session);

      if (session) {
        set({ user: session.user, loading: false });
      } else {
        // Timeout or no session — unblock the UI. If a session does exist
        // and the network call eventually completes, onAuthStateChange will
        // update the user. Meanwhile the app renders the sign-in screen,
        // which is far better than a frozen spinner.
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
