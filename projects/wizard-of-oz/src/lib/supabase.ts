import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if environment variables are present - but don't block initialization
const hasRequiredEnvVars = Boolean(supabaseUrl && supabaseAnonKey);

if (!hasRequiredEnvVars) {
  console.warn('[Supabase] Missing environment variables:', {
    url: supabaseUrl ? 'present' : 'missing',
    key: supabaseAnonKey ? 'present' : 'missing'
  });
}

// Validate URL format if present - but don't block initialization
let isValidUrl = true; // Default to true to be more permissive
if (hasRequiredEnvVars && supabaseUrl) {
  try {
    new URL(supabaseUrl);
  } catch (error) {
    console.warn('[Supabase] Invalid URL format:', supabaseUrl);
    isValidUrl = false;
  }
}

// Use provided values or fallback to placeholders (app will handle auth errors gracefully)
const finalUrl = supabaseUrl || 'https://placeholder.supabase.co';
const finalKey = supabaseAnonKey || 'placeholder-key';

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
