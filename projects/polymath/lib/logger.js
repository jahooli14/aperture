/**
 * Structured Logging Utility
 * Provides consistent, production-ready logging across all API endpoints
 */
import pino from 'pino';
import { env } from './env.js';
/**
 * Create logger instance with appropriate configuration
 */
export const logger = pino({
    level: env.LOG_LEVEL || 'info',
    // In production, log as JSON; in development, use pretty printing
    transport: env.NODE_ENV === 'production'
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname'
            }
        }
});
/**
 * Create a child logger with additional context
 * Useful for adding endpoint-specific or request-specific context
 */
export function createLogger(context) {
    return logger.child(context);
}
/**
 * Log levels:
 * - logger.trace() - Very detailed debugging
 * - logger.debug() - Debugging information
 * - logger.info()  - General informational messages (default)
 * - logger.warn()  - Warning messages
 * - logger.error() - Error messages
 * - logger.fatal() - Fatal errors (process should exit)
 */
