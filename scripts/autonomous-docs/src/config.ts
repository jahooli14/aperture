import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface ValidationRules {
  minFactPreservation?: number
  maxGrowth: number
  allowTokenReduction?: boolean
  requireTokenReduction?: boolean
}

export interface IntegrationMode {
  description: string
  minEvidenceScore: number
  validation: ValidationRules
}

export interface Config {
  version: string
  optimizationGoal: string
  description: string
  integrationModes: {
    replace: IntegrationMode
    merge: IntegrationMode
    refactor: IntegrationMode
    newSection: IntegrationMode
    skip: IntegrationMode
  }
  supersessionDetection: {
    enabled: boolean
    patterns: {
      versionUpgrade: string[]
      officialUpdate: string[]
      quantifiableImprovement: string[]
    }
  }
  crossReferencing: {
    enabled: boolean
    minRepetitionLength: number
    preferLinkOver: string
  }
  budget: {
    dailyCapUSD: number
    tokenLimits: {
      relevanceFilter: number
      qualityComparison: number
      integration: number
    }
  }
  thresholds: {
    relevance: number
    quality: number
    minHighDimensions: number
  }
  documentationTargets: string[]
  metrics: {
    trackTokenDelta: boolean
    trackInformationDensity: boolean
    trackSourceConsolidation: boolean
    reportingEnabled: boolean
  }
}

// Load config from JSON file
const configPath = join(__dirname, '..', 'config.json')
export const config: Config = JSON.parse(readFileSync(configPath, 'utf-8'))

// Validate config on load
function validateConfig(cfg: Config): void {
  if (!cfg.version) {
    throw new Error('Config missing version')
  }

  if (!cfg.integrationModes || !cfg.integrationModes.replace) {
    throw new Error('Config missing integration modes')
  }

  if (cfg.budget.dailyCapUSD <= 0 || cfg.budget.dailyCapUSD > 1) {
    console.warn(`Warning: Daily budget ${cfg.budget.dailyCapUSD} USD is outside recommended range (0.1-1.0)`)
  }

  console.log(`Loaded config v${cfg.version}: ${cfg.optimizationGoal}`)
}

validateConfig(config)
