import type { Page } from '@playwright/test'
import { GeminiClient } from './gemini-client'
import type { TestRepair, SelfHealingConfig } from '../types'
import { saveRepair } from './supabase-repairs'

export class SelfHealingDriver {
  private repairs: TestRepair[] = []
  private gemini: GeminiClient
  private config: SelfHealingConfig
  private testFile: string
  private testName: string

  constructor(
    private page: Page,
    config: SelfHealingConfig,
    testFile: string,
    testName: string
  ) {
    this.gemini = new GeminiClient(config.geminiApiKey)
    this.config = config
    this.testFile = testFile
    this.testName = testName
  }

  /**
   * Click element with self-healing fallback
   */
  async click(selector: string, description: string): Promise<void> {
    try {
      await this.page.click(selector, { timeout: this.config.timeout || 5000 })
    } catch (error) {
      await this.healAndRetry('click', selector, description, error as Error)
    }
  }

  /**
   * Fill input with self-healing fallback
   */
  async fill(
    selector: string,
    value: string,
    description: string
  ): Promise<void> {
    try {
      await this.page.fill(selector, value, {
        timeout: this.config.timeout || 5000,
      })
    } catch (error) {
      await this.healAndRetry(
        'fill',
        selector,
        description,
        error as Error,
        value
      )
    }
  }

  /**
   * Hover over element with self-healing fallback
   */
  async hover(selector: string, description: string): Promise<void> {
    try {
      await this.page.hover(selector, { timeout: this.config.timeout || 5000 })
    } catch (error) {
      await this.healAndRetry('hover', selector, description, error as Error)
    }
  }

  /**
   * Core self-healing logic
   */
  private async healAndRetry(
    action: 'click' | 'fill' | 'hover' | 'scroll',
    selector: string,
    description: string,
    error: Error,
    fillValue?: string
  ): Promise<void> {
    if (this.config.enableLogging) {
      console.log(`\n🔧 Self-healing triggered for: ${description}`)
      console.log(`   Old selector: ${selector}`)
      console.log(`   Error: ${error.message}`)
    }

    // Capture screenshot
    const screenshot = await this.page.screenshot()

    // Ask Gemini for repair suggestion
    const response = await this.gemini.retryWithExponentialBackoff(() =>
      this.gemini.findElement(description, screenshot, selector, error.message)
    )

    if (response.confidence < (this.config.confidenceThreshold || 0.5)) {
      throw new Error(
        `Gemini confidence too low (${response.confidence}) for ${description}: ${response.reasoning}`
      )
    }

    // Execute suggested action
    if (response.action.coordinates) {
      const { x, y } = response.action.coordinates

      // Convert from normalized 1000x1000 grid to actual pixels
      const viewport = this.page.viewportSize() || { width: 1440, height: 900 }
      const actualX = (x / 1000) * viewport.width
      const actualY = (y / 1000) * viewport.height

      if (action === 'click') {
        await this.page.mouse.click(actualX, actualY)
      } else if (action === 'fill') {
        await this.page.mouse.click(actualX, actualY)
        await this.page.keyboard.type(fillValue!)
      } else if (action === 'hover') {
        await this.page.mouse.move(actualX, actualY)
      }

      // Log successful repair
      const repair: TestRepair = {
        id: `repair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        testFile: this.testFile,
        testName: this.testName,
        oldLocator: selector,
        newLocator: this.coordinatesToSelector(x, y),
        newCoordinates: { x, y },
        description,
        screenshot: screenshot.toString('base64'),
        timestamp: new Date(),
        action,
        fillValue,
        confidence: response.action.confidence,
        reasoning: response.reasoning,
        status: 'pending',
        errorMessage: error.message,
      }

      this.repairs.push(repair)

      // Save to database
      if (this.config.supabaseUrl && this.config.supabaseKey) {
        await saveRepair(repair, this.config)
      }

      if (this.config.enableLogging) {
        console.log(`   ✅ Repair successful`)
        console.log(`   New coordinates: (${x}, ${y})`)
        console.log(`   Confidence: ${response.action.confidence}`)
      }
    } else {
      throw new Error(
        `Gemini could not find element "${description}": ${response.reasoning}`
      )
    }
  }

  /**
   * Convert normalized coordinates to CSS selector (for logging)
   */
  private coordinatesToSelector(x: number, y: number): string {
    return `[data-x="${x}"][data-y="${y}"]`
  }

  /**
   * Get all repairs made during this test run
   */
  getRepairs(): TestRepair[] {
    return this.repairs
  }

  /**
   * Generate repair report
   */
  async generateRepairReport(): Promise<void> {
    if (this.repairs.length === 0) {
      if (this.config.enableLogging) {
        console.log('\n✅ No repairs needed - all selectors worked!')
      }
      return
    }

    console.log(`\n🔧 Self-Healing Report`)
    console.log(`   Test: ${this.testName}`)
    console.log(`   File: ${this.testFile}`)
    console.log(`   Repairs: ${this.repairs.length}`)
    console.log(`\n📝 Details:`)

    for (const repair of this.repairs) {
      console.log(`   - ${repair.description}`)
      console.log(`     Old: ${repair.oldLocator}`)
      console.log(`     New: (${repair.newCoordinates?.x}, ${repair.newCoordinates?.y})`)
      console.log(`     Confidence: ${repair.confidence}`)
      console.log(`     Status: ${repair.status}`)
      console.log('')
    }

    console.log(`\n👀 Review repairs at: http://localhost:5173/repairs`)
  }
}

/**
 * Helper to create self-healing driver from Playwright page
 */
export function createSelfHealingDriver(
  page: Page,
  config: SelfHealingConfig,
  testFile: string,
  testName: string
): SelfHealingDriver {
  return new SelfHealingDriver(page, config, testFile, testName)
}
