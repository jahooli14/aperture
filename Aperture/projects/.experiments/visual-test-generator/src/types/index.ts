// Core types for self-healing test system

export interface GeminiAction {
  type: 'click_at' | 'hover_at' | 'type_text_at' | 'scroll_at' | 'drag_and_drop' | 'key_combination'
  coordinates?: {
    x: number
    y: number
  }
  text?: string
  confidence: 'high' | 'medium' | 'low'
  reasoning?: string
}

export interface TestRepair {
  id: string
  testFile: string
  testName: string
  oldLocator: string
  newLocator: string
  newCoordinates?: {
    x: number
    y: number
  }
  description: string
  screenshot: string // base64
  timestamp: Date
  action: 'click' | 'fill' | 'hover' | 'scroll'
  fillValue?: string
  confidence: 'high' | 'medium' | 'low'
  reasoning?: string
  status: 'pending' | 'approved' | 'rejected'
  errorMessage: string
}

export interface RepairReport {
  testRunId: string
  totalTests: number
  failedTests: number
  repairedTests: number
  repairs: TestRepair[]
  timestamp: Date
  duration: number
}

export interface SelfHealingConfig {
  geminiApiKey: string
  supabaseUrl: string
  supabaseKey: string
  autoApprove?: boolean
  autoApproveHighConfidence?: boolean
  confidenceThreshold?: number
  maxRetries?: number
  timeout?: number
  screenshotOnFailure?: boolean
  enableLogging?: boolean
}

export interface GeminiComputerUseResponse {
  action: GeminiAction
  reasoning: string
  confidence: number
}
