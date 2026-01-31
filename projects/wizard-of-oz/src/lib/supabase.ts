import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if environment variables are present
const hasRequiredEnvVars = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasRequiredEnvVars) {
  console.error('Missing Supabase environment variables:', {
    url: supabaseUrl ? 'present' : 'missing',
    key: supabaseAnonKey ? 'present' : 'missing'
  });
}

// Validate URL format if present
let isValidUrl = false;
if (hasRequiredEnvVars) {
  try {
    new URL(supabaseUrl);
    isValidUrl = true;
  } catch (error) {
    console.error('Invalid Supabase URL format:', supabaseUrl);
  }
}

// Create a fallback client with dummy values if env vars are missing or invalid
// This prevents the app from crashing and allows us to show a proper error message in the UI
const finalUrl = (hasRequiredEnvVars && isValidUrl) ? supabaseUrl : 'https://placeholder.supabase.co';
const finalKey = hasRequiredEnvVars ? supabaseAnonKey : 'placeholder-key';

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

// Export flag to check if Supabase is properly configured
export const isSupabaseConfigured = hasRequiredEnvVars && isValidUrl;
