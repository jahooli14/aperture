import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface LogData {
  functionName: string;
  level: 'info' | 'error' | 'warn';
  message: string;
  data?: Record<string, any>;
  photoId?: string;
  userId?: string;
}

/**
 * Log to Supabase database for debugging
 * This is ALWAYS accessible via database queries, unlike Vercel logs
 */
export async function log(params: LogData) {
  try {
    // Always log to console first (backup)
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${params.level.toUpperCase()}] [${params.functionName}] ${params.message}`;

    if (params.level === 'error') {
      console.error(logMessage, params.data || '');
    } else if (params.level === 'warn') {
      console.warn(logMessage, params.data || '');
    } else {
      console.log(logMessage, params.data || '');
    }

    // Insert to database (fire and forget - don't block on logging)
    supabase
      .from('debug_logs')
      .insert({
        function_name: params.functionName,
        level: params.level,
        message: params.message,
        data: params.data || null,
        photo_id: params.photoId || null,
        user_id: params.userId || null,
      })
      .then(({ error }) => {
        if (error) {
          console.error('Failed to write to debug_logs table:', error);
        }
      });
  } catch (error) {
    // Never let logging break the application
    console.error('Logger error:', error);
  }
}

/**
 * Query logs from database
 */
export async function getLogs(options?: {
  functionName?: string;
  photoId?: string;
  limit?: number;
  since?: Date;
}) {
  let query = supabase
    .from('debug_logs')
    .select('*')
    .order('created_at', { ascending: false });

  if (options?.functionName) {
    query = query.eq('function_name', options.functionName);
  }

  if (options?.photoId) {
    query = query.eq('photo_id', options.photoId);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.since) {
    query = query.gte('created_at', options.since.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data;
}
