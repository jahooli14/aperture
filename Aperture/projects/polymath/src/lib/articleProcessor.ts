/**
 * Article Processor
 * Handles robust background polling for article extraction with retry logic
 * Prevents articles from getting stuck in "processing" state
 */

interface ProcessingArticle {
  id: string
  url: string
  startTime: number
  attempts: number
  pollInterval?: number
  lastLog?: string
  currentStage?: string
}

type LogCallback = (message: string, level: 'info' | 'error' | 'success') => void

class ArticleProcessor {
  private processing: Map<string, ProcessingArticle> = new Map()
  private pollInterval: number = 2000 // 2 seconds
  private maxAttempts: number = 180 // 6 minutes (2s * 180 = 360s)
  private retryDelay: number = 5000 // 5 seconds between retries
  private logCallbacks: Set<LogCallback> = new Set()

  /**
   * Register a log callback to receive processing logs
   */
  onLog(callback: LogCallback): () => void {
    this.logCallbacks.add(callback)
    return () => this.logCallbacks.delete(callback)
  }

  /**
   * Internal log method
   */
  private log(message: string, level: 'info' | 'error' | 'success' = 'info') {
    console.log(`[ArticleProcessor] ${message}`)
    this.logCallbacks.forEach(cb => cb(message, level))
  }

  /**
   * Start processing an article with automatic polling and retry
   */
  async startProcessing(
    articleId: string,
    url: string,
    onProgress?: (status: 'extracting' | 'retrying' | 'complete' | 'failed', article?: any) => void
  ): Promise<void> {
    this.log(`Starting processing for ${articleId.slice(0, 8)}...`, 'info')

    // Prevent duplicate processing
    if (this.processing.has(articleId)) {
      this.log(`Already processing ${articleId.slice(0, 8)}`, 'info')
      return
    }

    this.processing.set(articleId, {
      id: articleId,
      url,
      startTime: Date.now(),
      attempts: 0,
      lastLog: 'Starting extraction...',
      currentStage: 'Backend: Initializing'
    })

    onProgress?.('extracting')

    // Start polling
    this.poll(articleId, onProgress)
  }

  /**
   * Poll for article completion with exponential backoff
   */
  private async poll(
    articleId: string,
    onProgress?: (status: 'extracting' | 'retrying' | 'complete' | 'failed', article?: any) => void
  ): Promise<void> {
    const processing = this.processing.get(articleId)
    if (!processing) return

    processing.attempts++
    const elapsed = Math.floor((Date.now() - processing.startTime) / 1000)

    try {
      this.log(`Poll attempt ${processing.attempts} for ${articleId.slice(0, 8)} (${elapsed}s elapsed)`, 'info')

      // Fetch latest article state
      const response = await fetch(`/api/reading?id=${articleId}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch article: ${response.status}`)
      }

      const { article } = await response.json()

      // Check if extraction is complete
      if (article.processed) {
        this.log(`✓ Extraction complete for ${articleId.slice(0, 8)}: "${article.title}"`, 'success')
        this.processing.delete(articleId)
        onProgress?.('complete', article)
        return
      }

      // Log current state and parse backend message for stage
      processing.lastLog = article.excerpt || 'Processing...'

      // Detect which stage based on backend message - check failures first
      if (processing.lastLog.includes('failed') || processing.lastLog.includes('Failed')) {
        processing.currentStage = '❌ Backend: Extraction Failed'
      } else if (processing.lastLog.includes('blocked')) {
        processing.currentStage = '🚫 Backend: Domain Blocked'
      } else if (processing.lastLog.includes('timeout') || processing.lastLog.includes('take a moment')) {
        processing.currentStage = '⏱️ Backend: Timed Out'
      } else if (processing.lastLog.includes('JavaScript')) {
        processing.currentStage = '⚠️ Backend: Needs JS Rendering'
      } else if (processing.lastLog.includes('Extracting') || processing.lastLog.includes('extraction')) {
        processing.currentStage = '🔄 Backend: Extracting (Tier 1→2→3)'
      } else if (processing.lastLog.includes('progress')) {
        processing.currentStage = '🔄 Backend: In Progress'
      } else {
        processing.currentStage = '🔄 Backend: Processing'
      }

      this.log(`Stage: ${processing.currentStage} | ${processing.lastLog.slice(0, 40)}`, 'info')

      // Check if we've exceeded max attempts
      if (processing.attempts >= this.maxAttempts) {
        this.log(`Max attempts (${this.maxAttempts}) reached for ${articleId.slice(0, 8)}, triggering retry`, 'error')
        await this.retryExtraction(articleId, processing.url, onProgress)
        return
      }

      // Continue polling with exponential backoff
      const backoff = Math.min(this.pollInterval * Math.pow(1.1, processing.attempts / 30), 5000)
      setTimeout(() => this.poll(articleId, onProgress), backoff)

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Polling error for ${articleId.slice(0, 8)}: ${errorMsg}`, 'error')

      // If polling fails, retry after delay
      if (processing.attempts < this.maxAttempts) {
        setTimeout(() => this.poll(articleId, onProgress), this.pollInterval)
      } else {
        this.processing.delete(articleId)
        onProgress?.('failed')
      }
    }
  }

  /**
   * Retry extraction by deleting and re-creating the article
   */
  private async retryExtraction(
    articleId: string,
    url: string,
    onProgress?: (status: 'extracting' | 'retrying' | 'complete' | 'failed', article?: any) => void
  ): Promise<void> {
    this.log(`Retrying extraction for ${articleId.slice(0, 8)}`, 'info')
    onProgress?.('retrying')

    try {
      this.log('Deleting stuck article...', 'info')
      // Delete the stuck article
      await fetch(`/api/reading?id=${articleId}`, {
        method: 'DELETE',
      })

      // Wait a bit for deletion to complete
      await new Promise(resolve => setTimeout(resolve, 1000))

      this.log('Re-creating article with fresh extraction...', 'info')
      // Re-create the article
      const response = await fetch('/api/reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      if (!response.ok) {
        throw new Error('Retry failed')
      }

      const { article: newArticle } = await response.json()

      // Remove old processing entry
      this.processing.delete(articleId)

      this.log(`Starting fresh processing with new ID ${newArticle.id.slice(0, 8)}`, 'info')
      // Start processing the new article
      this.startProcessing(newArticle.id, url, onProgress)

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      this.log(`Retry failed: ${errorMsg}`, 'error')
      this.processing.delete(articleId)
      onProgress?.('failed')
    }
  }

  /**
   * Check if an article is currently being processed
   */
  isProcessing(articleId: string): boolean {
    return this.processing.has(articleId)
  }

  /**
   * Cancel processing for an article
   */
  cancelProcessing(articleId: string): void {
    this.processing.delete(articleId)
  }

  /**
   * Get processing status
   */
  getStatus(articleId: string): ProcessingArticle | undefined {
    return this.processing.get(articleId)
  }

  /**
   * Get all processing articles
   */
  getAllProcessing(): ProcessingArticle[] {
    return Array.from(this.processing.values())
  }
}

// Singleton instance
export const articleProcessor = new ArticleProcessor()
