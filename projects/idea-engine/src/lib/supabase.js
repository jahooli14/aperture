import { createClient } from '@supabase/supabase-js';
// Use Polymath's Supabase instance
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_KEY environment variables.');
}
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false, // API routes don't need session persistence
    },
});
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);
