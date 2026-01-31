import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if environment variables are present
const hasRequiredEnvVars = supabaseUrl && supabaseAnonKey;

if (!hasRequiredEnvVars) {
  console.error('Missing Supabase environment variables:', {
    url: supabaseUrl ? 'present' : 'missing',
    key: supabaseAnonKey ? 'present' : 'missing'
  });
}

// Validate URL format if present
if (hasRequiredEnvVars) {
  try {
    new URL(supabaseUrl);
  } catch (error) {
    console.error('Invalid Supabase URL format:', supabaseUrl);
  }
}

// Create a fallback client with dummy values if env vars are missing
// This prevents the app from crashing and allows us to show a proper error message
const finalUrl = supabaseUrl || 'https://placeholder.supabase.co';
const finalKey = supabaseAnonKey || 'placeholder-anon-key';

export const supabase: SupabaseClient<Database> = createClient<Database>(
  finalUrl,
  finalKey,
  {
    auth: {
      // Ensure auth tokens are persisted properly
      storage: window.localStorage,
      // Auto-refresh tokens
      autoRefreshToken: true,
      // Persist session across page reloads
      persistSession: true,
      // Detect session from URL on page load
      detectSessionInUrl: true,
    },
  }
);

// Export flag to check if config is valid
export const isSupabaseConfigured = hasRequiredEnvVars;
