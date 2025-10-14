/**
 * Structured Logging System for Wizard of Oz
 * Replaces console.log with environment-aware, structured logging
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  component?: string;
  userId?: string;
  sessionId?: string;
}

class Logger {
  private level: LogLevel;
  private isDevelopment: boolean;
  private sessionId: string;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    this.level = this.isDevelopment ? LogLevel.DEBUG : LogLevel.WARN;
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private formatLog(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    const prefix = this.getLogPrefix(entry.level);
    const timestamp = new Date(entry.timestamp).toISOString();

    if (this.isDevelopment) {
      // Development: Pretty console output
      const style = this.getLogStyle(entry.level);
      console.log(
        `%c${prefix} [${timestamp}] ${entry.component ? `[${entry.component}] ` : ''}${entry.message}`,
        style,
        entry.context || ''
      );
    } else {
      // Production: Structured JSON for monitoring
      console.log(JSON.stringify({
        ...entry,
        sessionId: this.sessionId,
        environment: 'production',
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
      }));
    }
  }

  private getLogPrefix(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return '🔍 DEBUG';
      case LogLevel.INFO: return '📋 INFO';
      case LogLevel.WARN: return '⚠️ WARN';
      case LogLevel.ERROR: return '❌ ERROR';
      default: return '📝 LOG';
    }
  }

  private getLogStyle(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: return 'color: #6b7280; font-weight: normal;';
      case LogLevel.INFO: return 'color: #059669; font-weight: normal;';
      case LogLevel.WARN: return 'color: #d97706; font-weight: bold;';
      case LogLevel.ERROR: return 'color: #dc2626; font-weight: bold; background: #fef2f2; padding: 2px 4px;';
      default: return 'color: #374151;';
    }
  }

  public debug(message: string, context?: LogContext, component?: string): void {
    this.formatLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      message,
      context,
      component,
    });
  }

  public info(message: string, context?: LogContext, component?: string): void {
    this.formatLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message,
      context,
      component,
    });
  }

  public warn(message: string, context?: LogContext, component?: string): void {
    this.formatLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      message,
      context,
      component,
    });
  }

  public error(message: string, context?: LogContext, component?: string): void {
    this.formatLog({
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message,
      context,
      component,
    });
  }

  // API-specific helpers
  public apiCall(endpoint: string, method: string, status?: number, duration?: number): void {
    this.info(`API ${method} ${endpoint}`, {
      method,
      endpoint,
      status,
      duration: duration ? `${duration}ms` : undefined,
    }, 'API');
  }

  public alignmentStep(step: string, photoId: string, data?: LogContext): void {
    this.info(`Alignment: ${step}`, {
      photoId,
      step,
      ...data,
    }, 'ALIGNMENT');
  }

  public eyeDetection(photoId: string, landmarks: { leftEye?: unknown; rightEye?: unknown; confidence?: unknown; eyesOpen?: unknown }): void {
    this.info('Eye detection complete', {
      photoId,
      leftEye: landmarks.leftEye,
      rightEye: landmarks.rightEye,
      confidence: landmarks.confidence,
      eyesOpen: landmarks.eyesOpen,
    }, 'EYE_DETECTION');
  }

  public uploadProgress(fileName: string, stage: string, progress?: number): void {
    this.debug(`Upload ${stage}: ${fileName}`, {
      fileName,
      stage,
      progress: progress ? `${progress}%` : undefined,
    }, 'UPLOAD');
  }
}

// Export singleton instance
export const logger = new Logger();

// Convenience exports for common patterns
export const logApiCall = logger.apiCall.bind(logger);
export const logAlignment = logger.alignmentStep.bind(logger);
export const logEyeDetection = logger.eyeDetection.bind(logger);
export const logUpload = logger.uploadProgress.bind(logger);

// Development helper to replace console.log gradually
export const devLog = logger.debug.bind(logger);