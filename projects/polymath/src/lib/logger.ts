/**
 * Logging Utility
 * Silent in production, verbose in development
 */

const isDev = import.meta.env.DEV

export const logger = {
  // Always log errors (even in production)
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args)
  },

  // Silent in production
  debug: (...args: any[]) => {
    if (isDev) console.log('[DEBUG]', ...args)
  },

  info: (...args: any[]) => {
    if (isDev) console.info('[INFO]', ...args)
  },

  warn: (...args: any[]) => {
    if (isDev) console.warn('[WARN]', ...args)
  }
}
