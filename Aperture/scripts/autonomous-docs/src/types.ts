export interface Source {
  id: string
  name: string
  type: 'rss' | 'api' | 'web-scrape'
  url: string
  keywords: string[]
  authority: number
  enabled: boolean
  scrapeConfig?: {
    listSelector: string      // CSS selector for article list
    titleSelector: string      // CSS selector for title within article
    linkSelector: string       // CSS selector for link within article
    dateSelector?: string      // Optional: CSS selector for date
    contentSelector?: string   // Optional: CSS selector for content preview
  }
}

export interface SourceConfig {
  sources: Source[]
  relevanceThreshold: number
  qualityThreshold: number
  maxDailyChanges: number
  maxSectionGrowth: number
  maxArticlesPerSource: number
}

export interface Article {
  id: string
  title: string
  url: string
  content: string
  summary: string
  publishDate: Date
  source: string
  sourceAuthority: number
}

export interface RelevanceAnalysis {
  article: Article
  relevanceScore: number
  category: 'anthropic' | 'gemini' | 'patterns' | 'tools' | 'other'
  reasoning: string[]
  isRelevant: boolean
}

export interface QualityComparison {
  article: Article
  targetFile: string
  targetSection: string
  currentContent: string
  specificityScore: number
  implementabilityScore: number
  evidenceScore: number
  hasConcreteExample: boolean
  hasQuantifiableBenefit: boolean
  fromAuthoritativeSource: boolean
  contradictionsResolved: boolean
  shouldMerge: boolean
  reasoning: string[]
  overallScore: number
}

export interface MergeResult {
  targetFile: string
  targetSection: string
  beforeContent: string
  afterContent: string
  improvementSummary: string
  sourceUrl: string
  sourceTitle: string
}

export interface AuditEntry {
  timestamp: string
  type: 'merged' | 'rejected' | 'error'
  sourceArticle: {
    title: string
    url: string
    author?: string
    publishDate: string
  }
  targetFile?: string
  targetSection?: string
  qualityScores?: {
    specificity: number
    implementability: number
    evidence: number
    overall: number
  }
  decision: string
  reasoning: string[]
  changes?: {
    before: string
    after: string
    summary: string
  }
}

export interface ChangelogEntry {
  date: string
  summary: {
    articlesAnalyzed: number
    relevant: number
    merged: number
    rejected: number
    filesUpdated: number
  }
  mergedImprovements: Array<{
    title: string
    sourceUrl: string
    targetFile: string
    targetSection: string
    benefit: string
    qualityScores: {
      specificity: number
      implementability: number
      evidence: number
    }
    changeDescription: string
    diffUrl?: string
  }>
  rejectedFindings: Array<{
    title: string
    reason: string
    qualityScores: {
      specificity: number
      implementability: number
      evidence: number
    }
  }>
  stats: {
    averageMergeQuality: number
    averageRejectQuality: number
    documentationGrowth: string
  }
}

export interface DocumentationTarget {
  file: string
  sections: Array<{
    name: string
    startPattern: string
    endPattern?: string
    keywords: string[]
  }>
}