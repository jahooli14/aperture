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
}

class ArticleProcessor {
  private processing: Map<string, ProcessingArticle> = new Map()
  private pollInterval: number = 2000 // 2 seconds
  private maxAttempts: number = 180 // 6 minutes (2s * 180 = 360s)
  private retryDelay: number = 5000 // 5 seconds between retries

  /**
   * Start processing an article with automatic polling and retry
   */
  async startProcessing(
    articleId: string,
    url: string,
    onProgress?: (status: 'extracting' | 'retrying' | 'complete' | 'failed', article?: any) => void
  ): Promise<void> {
    console.log('[ArticleProcessor] Starting processing for:', articleId)

    // Prevent duplicate processing
    if (this.processing.has(articleId)) {
      console.log('[ArticleProcessor] Already processing:', articleId)
      return
    }

    this.processing.set(articleId, {
      id: articleId,
      url,
      startTime: Date.now(),
      attempts: 0,
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

    try {
      // Fetch latest article state
      const response = await fetch(`/api/reading?id=${articleId}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch article: ${response.status}`)
      }

      const { article } = await response.json()

      // Check if extraction is complete
      if (article.processed) {
        console.log('[ArticleProcessor] Extraction complete:', articleId)
        this.processing.delete(articleId)
        onProgress?.('complete', article)
        return
      }

      // Check if we've exceeded max attempts
      if (processing.attempts >= this.maxAttempts) {
        console.error('[ArticleProcessor] Max attempts reached, triggering retry:', articleId)
        await this.retryExtraction(articleId, processing.url, onProgress)
        return
      }

      // Continue polling with exponential backoff
      const backoff = Math.min(this.pollInterval * Math.pow(1.1, processing.attempts / 30), 5000)
      setTimeout(() => this.poll(articleId, onProgress), backoff)

    } catch (error) {
      console.error('[ArticleProcessor] Polling error:', error)

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
    console.log('[ArticleProcessor] Retrying extraction:', articleId)
    onProgress?.('retrying')

    try {
      // Delete the stuck article
      await fetch(`/api/reading?id=${articleId}`, {
        method: 'DELETE',
      })

      // Wait a bit for deletion to complete
      await new Promise(resolve => setTimeout(resolve, 1000))

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

      // Start processing the new article
      this.startProcessing(newArticle.id, url, onProgress)

    } catch (error) {
      console.error('[ArticleProcessor] Retry failed:', error)
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
