/**
 * Retry utility with exponential backoff for Vercel serverless functions
 *
 * Usage:
 *   const result = await retryWithBackoff(
 *     () => fetch(url),
 *     { retries: 3, baseDelay: 1000 }
 *   );
 */

interface RetryOptions {
  retries?: number;          // Maximum retry attempts (default: 3)
  baseDelay?: number;        // Initial delay in ms (default: 1000)
  maxDelay?: number;         // Maximum delay in ms (default: 10000)
  factor?: number;           // Exponential backoff factor (default: 2)
  jitter?: boolean;          // Add randomization to prevent thundering herd (default: true)
  shouldRetry?: (error: Error, attempt: number) => boolean; // Custom retry logic
  onRetry?: (error: Error, attempt: number, delay: number) => void; // Callback on retry
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    factor = 2,
    jitter = true,
    shouldRetry,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on last attempt
      if (attempt === retries) {
        break;
      }

      // Check custom retry logic
      if (shouldRetry && !shouldRetry(lastError, attempt)) {
        throw lastError;
      }

      // Calculate exponential backoff delay
      let delay = Math.min(baseDelay * Math.pow(factor, attempt), maxDelay);

      // Add jitter to prevent thundering herd
      if (jitter) {
        delay = delay * (0.5 + Math.random() * 0.5); // 50-100% of calculated delay
      }

      // Call retry callback
      if (onRetry) {
        onRetry(lastError, attempt + 1, delay);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Retry logic specifically for HTTP requests
 * - Retries on 5xx errors and network failures
 * - Does NOT retry on 4xx client errors
 */
export async function retryHttpRequest(
  fn: () => Promise<Response>,
  options: RetryOptions = {}
): Promise<Response> {
  return retryWithBackoff(fn, {
    ...options,
    shouldRetry: (error, attempt) => {
      // Don't retry if custom logic says no
      if (options.shouldRetry && !options.shouldRetry(error, attempt)) {
        return false;
      }

      // Check if error has status code (fetch errors)
      const statusMatch = error.message.match(/status:?\s*(\d+)/i);
      if (statusMatch) {
        const status = parseInt(statusMatch[1]);
        // Only retry on 5xx server errors, not 4xx client errors
        return status >= 500 && status < 600;
      }

      // Retry on network errors (no status code)
      return true;
    },
  });
}
