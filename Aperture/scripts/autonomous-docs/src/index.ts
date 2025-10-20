#!/usr/bin/env node

import { readFileSync } from 'fs'
import { join } from 'path'
import { format } from 'date-fns'
import { SourceFetcher, WebScrapeFetcher } from './fetch-sources.js'
import { RelevanceFilter } from './filter-relevance.js'
import { QualityComparator } from './compare-quality.js'
import { DocumentIntegrator } from './generate-integration.js'
import { ChangeApplicator, SafetyValidator } from './apply-changes.js'
import { AuditTrail, ChangelogGenerator, NotificationGenerator } from './audit-changelog.js'
import { DocumentationScanner } from './scan-docs.js'
import { SourceConfig, Article, RelevanceAnalysis, QualityComparison, MergeResult } from './types.js'

class AutonomousDocumentationSystem {
  private config: SourceConfig
  private repoRoot: string
  private fetcher: SourceFetcher
  private relevanceFilter: RelevanceFilter
  private qualityComparator: QualityComparator
  private integrator: DocumentIntegrator
  private applicator: ChangeApplicator
  private auditTrail: AuditTrail
  private changelogGenerator: ChangelogGenerator
  private docScanner: DocumentationScanner

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot
    this.config = this.loadConfig()

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required')
    }

    this.fetcher = new WebScrapeFetcher()
    this.relevanceFilter = new RelevanceFilter(apiKey)
    this.qualityComparator = new QualityComparator(apiKey, repoRoot)
    this.integrator = new DocumentIntegrator(apiKey)
    this.applicator = new ChangeApplicator(this.config)
    this.auditTrail = new AuditTrail(repoRoot)
    this.changelogGenerator = new ChangelogGenerator(repoRoot)
    this.docScanner = new DocumentationScanner(repoRoot)
  }

  async run(): Promise<void> {
    console.log(`🤖 Autonomous Documentation System - ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}`)
    console.log('=====================================')

    try {
      // Phase 0: Scan and update documentation index
      console.log('\n📚 Phase 0: Scanning documentation...')
      const docs = await this.docScanner.scanDocumentation()
      await this.docScanner.updateDocumentationIndex(docs)

      // Phase 1: Fetch articles
      console.log('\n📡 Phase 1: Fetching articles...')
      const articles = await this.fetcher.fetchAllSources(this.config.sources, this.config.maxArticlesPerSource)

      if (articles.length === 0) {
        console.log('No new articles found. Exiting.')
        return
      }

      // Phase 2: Analyze relevance
      console.log('\n🔍 Phase 2: Analyzing relevance...')
      const relevanceAnalyses = await this.relevanceFilter.analyzeRelevance(articles)
      const relevantAnalyses = this.relevanceFilter.filterRelevant(relevanceAnalyses, this.config.relevanceThreshold)

      if (relevantAnalyses.length === 0) {
        console.log('No relevant articles found. Exiting.')
        await this.generateEmptyChangelog(relevanceAnalyses)
        return
      }

      // Phase 3: Compare quality
      console.log('\n⚖️ Phase 3: Comparing quality...')
      const qualityComparisons: QualityComparison[] = []
      const rejectedComparisons: QualityComparison[] = []

      for (const analysis of relevantAnalyses) {
        const comparison = await this.qualityComparator.compareQuality(analysis.article)
        if (comparison) {
          if (this.qualityComparator.shouldMerge(comparison, this.config.qualityThreshold)) {
            qualityComparisons.push(comparison)
          } else {
            rejectedComparisons.push(comparison)
            await this.auditTrail.logRejection(analysis, comparison)
          }
        } else {
          await this.auditTrail.logRejection(analysis, undefined, 'No relevant documentation section found')
        }
      }

      if (qualityComparisons.length === 0) {
        console.log('No articles meet quality threshold. Exiting.')
        await this.generateEmptyChangelog(relevantAnalyses, rejectedComparisons)
        return
      }

      // Phase 4: Generate integrations
      console.log('\n🔧 Phase 4: Generating integrations...')
      const mergeResults: MergeResult[] = []

      for (const comparison of qualityComparisons) {
        const result = await this.integrator.generateIntegration(comparison)
        if (result) {
          mergeResults.push(result)
        }
      }

      if (mergeResults.length === 0) {
        console.log('No valid integrations generated. Exiting.')
        await this.generateEmptyChangelog(relevantAnalyses, rejectedComparisons)
        return
      }

      // Phase 5: Validate and apply changes
      console.log('\n💾 Phase 5: Applying changes...')
      const { valid, invalid } = SafetyValidator.validateChangeBatch(mergeResults, this.config)

      if (invalid.length > 0) {
        console.log(`⚠️ ${invalid.length} changes failed validation and will be skipped`)
      }

      const { applied, skipped } = await this.applicator.applyChanges(valid)

      // Phase 6: Log audit trail
      console.log('\n📝 Phase 6: Creating audit trail...')
      for (let i = 0; i < applied.length; i++) {
        const result = applied[i]
        const comparison = qualityComparisons.find(c =>
          c.article.url === result.sourceUrl
        )
        if (comparison) {
          await this.auditTrail.logMerge(result, comparison)
        }
      }

      // Phase 7: Generate changelog
      console.log('\n📊 Phase 7: Generating changelog...')
      await this.changelogGenerator.generateDailyChangelog(
        applied,
        relevantAnalyses,
        rejectedComparisons
      )

      // Summary
      console.log('\n✅ Autonomous update completed!')
      console.log(`   Articles analyzed: ${articles.length}`)
      console.log(`   Relevant: ${relevantAnalyses.length}`)
      console.log(`   Quality approved: ${qualityComparisons.length}`)
      console.log(`   Successfully merged: ${applied.length}`)
      console.log(`   Rejected/skipped: ${rejectedComparisons.length + skipped.length}`)

      if (applied.length > 0) {
        console.log('\n📈 Your documentation has been improved!')
        console.log('   See knowledge-base/changelogs/ for details')
      }

    } catch (error) {
      console.error('\n❌ System error:', error)
      await this.auditTrail.logError(error as Error, 'main process')
      process.exit(1)
    }
  }

  private async generateEmptyChangelog(
    relevanceAnalyses: RelevanceAnalysis[],
    rejectedComparisons: QualityComparison[] = []
  ): Promise<void> {
    await this.changelogGenerator.generateDailyChangelog(
      [], // no merges
      relevanceAnalyses,
      rejectedComparisons
    )
  }

  private loadConfig(): SourceConfig {
    try {
      const configPath = join(this.repoRoot, 'knowledge-base', 'sources.json')
      const configContent = readFileSync(configPath, 'utf-8')
      return JSON.parse(configContent)
    } catch (error) {
      throw new Error(`Failed to load configuration: ${error}`)
    }
  }
}

// CLI entry point
async function main() {
  const repoRoot = process.env.GITHUB_WORKSPACE || process.cwd()

  console.log(`Repository root: ${repoRoot}`)

  const system = new AutonomousDocumentationSystem(repoRoot)
  await system.run()
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { AutonomousDocumentationSystem }