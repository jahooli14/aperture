import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { format } from 'date-fns'
import { AuditEntry, ChangelogEntry, MergeResult, RelevanceAnalysis, QualityComparison } from './types.js'

export class AuditTrail {
  private auditDir: string

  constructor(repoRoot: string) {
    this.auditDir = join(repoRoot, 'knowledge-base', 'audit-trail')
    this.ensureDirectoryExists(this.auditDir)
  }

  async logMerge(
    result: MergeResult,
    comparison: QualityComparison,
    commitHash?: string
  ): Promise<void> {
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      type: 'merged',
      sourceArticle: {
        title: comparison.article.title,
        url: comparison.article.url,
        publishDate: comparison.article.publishDate.toISOString()
      },
      targetFile: result.targetFile,
      targetSection: result.targetSection,
      qualityScores: {
        specificity: comparison.specificityScore,
        implementability: comparison.implementabilityScore,
        evidence: comparison.evidenceScore,
        overall: comparison.overallScore
      },
      decision: 'merged',
      reasoning: comparison.reasoning,
      changes: {
        before: result.beforeContent,
        after: result.afterContent,
        summary: result.improvementSummary
      }
    }

    await this.saveAuditEntry(entry, 'merged')
  }

  async logRejection(
    analysis: RelevanceAnalysis,
    comparison?: QualityComparison,
    reason: string = 'Quality threshold not met'
  ): Promise<void> {
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      type: 'rejected',
      sourceArticle: {
        title: analysis.article.title,
        url: analysis.article.url,
        publishDate: analysis.article.publishDate.toISOString()
      },
      qualityScores: comparison ? {
        specificity: comparison.specificityScore,
        implementability: comparison.implementabilityScore,
        evidence: comparison.evidenceScore,
        overall: comparison.overallScore
      } : undefined,
      decision: 'rejected',
      reasoning: comparison?.reasoning || [reason]
    }

    await this.saveAuditEntry(entry, 'rejected')
  }

  async logError(error: Error, context: string): Promise<void> {
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      type: 'error',
      sourceArticle: {
        title: 'System Error',
        url: '',
        publishDate: new Date().toISOString()
      },
      decision: `Error in ${context}`,
      reasoning: [error.message, error.stack || '']
    }

    await this.saveAuditEntry(entry, 'error')
  }

  private async saveAuditEntry(entry: AuditEntry, type: string): Promise<void> {
    const today = format(new Date(), 'yyyy-MM-dd')
    const todayDir = join(this.auditDir, today)
    this.ensureDirectoryExists(todayDir)

    // Generate unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${type}-${timestamp}.json`
    const filePath = join(todayDir, filename)

    writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf-8')
  }

  async getTodaysEntries(): Promise<AuditEntry[]> {
    const today = format(new Date(), 'yyyy-MM-dd')
    const todayDir = join(this.auditDir, today)

    if (!existsSync(todayDir)) {
      return []
    }

    const fs = await import('fs/promises')
    const files = await fs.readdir(todayDir)
    const jsonFiles = files.filter(f => f.endsWith('.json'))

    const entries: AuditEntry[] = []
    for (const file of jsonFiles) {
      try {
        const content = readFileSync(join(todayDir, file), 'utf-8')
        const entry = JSON.parse(content) as AuditEntry
        entries.push(entry)
      } catch (error) {
        console.error(`Error reading audit file ${file}:`, error)
      }
    }

    return entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }

  private ensureDirectoryExists(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }
}

export class ChangelogGenerator {
  private changelogDir: string

  constructor(repoRoot: string) {
    this.changelogDir = join(repoRoot, 'knowledge-base', 'changelogs')
    this.ensureDirectoryExists(this.changelogDir)
  }

  async generateDailyChangelog(
    mergedResults: MergeResult[],
    relevantArticles: RelevanceAnalysis[],
    rejectedComparisons: QualityComparison[]
  ): Promise<void> {
    const today = format(new Date(), 'yyyy-MM-dd')

    const changelog: ChangelogEntry = {
      date: today,
      summary: {
        articlesAnalyzed: relevantArticles.length,
        relevant: relevantArticles.filter(a => a.isRelevant).length,
        merged: mergedResults.length,
        rejected: rejectedComparisons.length,
        filesUpdated: new Set(mergedResults.map(r => r.targetFile)).size
      },
      mergedImprovements: mergedResults.map(result => ({
        title: result.sourceTitle,
        sourceUrl: result.sourceUrl,
        targetFile: result.targetFile,
        targetSection: result.targetSection,
        benefit: result.improvementSummary,
        qualityScores: {
          specificity: 0, // Would need to pass this through
          implementability: 0,
          evidence: 0
        },
        changeDescription: this.summarizeChanges(result.beforeContent, result.afterContent)
      })),
      rejectedFindings: rejectedComparisons.map(comp => ({
        title: comp.article.title,
        reason: comp.reasoning.join('; '),
        qualityScores: {
          specificity: comp.specificityScore,
          implementability: comp.implementabilityScore,
          evidence: comp.evidenceScore
        }
      })),
      stats: {
        averageMergeQuality: mergedResults.length > 0
          ? rejectedComparisons.reduce((sum, c) => sum + c.overallScore, 0) / rejectedComparisons.length
          : 0,
        averageRejectQuality: rejectedComparisons.length > 0
          ? rejectedComparisons.reduce((sum, c) => sum + c.overallScore, 0) / rejectedComparisons.length
          : 0,
        documentationGrowth: this.calculateGrowth(mergedResults)
      }
    }

    // Generate markdown
    const markdown = this.generateMarkdown(changelog)

    // Save changelog
    const filename = `${today}.md`
    const filePath = join(this.changelogDir, filename)
    writeFileSync(filePath, markdown, 'utf-8')

    console.log(`Generated changelog: ${filePath}`)
  }

  private generateMarkdown(changelog: ChangelogEntry): string {
    return `# Autonomous Documentation Updates - ${changelog.date}

## Summary
- **Articles analyzed**: ${changelog.summary.articlesAnalyzed}
- **Relevant**: ${changelog.summary.relevant}
- **Merged**: ${changelog.summary.merged}
- **Rejected**: ${changelog.summary.rejected}
- **Files updated**: ${changelog.summary.filesUpdated}

## Merged Improvements

${changelog.mergedImprovements.length === 0 ? 'No improvements merged today.' : changelog.mergedImprovements.map((improvement, index) => `
### ${index + 1}. ${improvement.targetSection} (${improvement.targetFile.split('/').pop()})
**Source**: [${improvement.title}](${improvement.sourceUrl})
**Change**: ${improvement.changeDescription}
**Benefit**: ${improvement.benefit}

`).join('')}

## Rejected Findings

${changelog.rejectedFindings.length === 0 ? 'No articles rejected today.' : changelog.rejectedFindings.map((rejected, index) => `
### ${index + 1}. ${rejected.title}
**Reason**: ${rejected.reason}
**Quality scores**: Specificity ${rejected.qualityScores.specificity.toFixed(2)}, Implementability ${rejected.qualityScores.implementability.toFixed(2)}, Evidence ${rejected.qualityScores.evidence.toFixed(2)}

`).join('')}

## Statistics
- **Average merge quality**: ${changelog.stats.averageMergeQuality.toFixed(2)}
- **Average rejection quality**: ${changelog.stats.averageRejectQuality.toFixed(2)}
- **Documentation growth**: ${changelog.stats.documentationGrowth}

---

*Generated by Autonomous Documentation System at ${new Date().toISOString()}*
`
  }

  private summarizeChanges(before: string, after: string): string {
    const beforeLength = before.length
    const afterLength = after.length
    const growth = ((afterLength - beforeLength) / beforeLength * 100).toFixed(1)

    const beforeWords = new Set(before.toLowerCase().match(/\w+/g) || [])
    const afterWords = after.toLowerCase().match(/\w+/g) || []
    const newWords = afterWords.filter(word => !beforeWords.has(word))

    return `Added ${newWords.length} new words (+${growth}% growth)`
  }

  private calculateGrowth(results: MergeResult[]): string {
    if (results.length === 0) return '0 words (0%)'

    const totalBefore = results.reduce((sum, r) => sum + r.beforeContent.length, 0)
    const totalAfter = results.reduce((sum, r) => sum + r.afterContent.length, 0)
    const growth = totalAfter - totalBefore
    const growthPercent = ((growth / totalBefore) * 100).toFixed(1)

    return `+${growth} characters (+${growthPercent}%)`
  }

  private ensureDirectoryExists(dir: string): void {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
  }
}

export class NotificationGenerator {
  static generateDailySummary(changelog: ChangelogEntry): string {
    const emoji = changelog.summary.merged > 0 ? '📚✅' : '📚📊'

    return `${emoji} Autonomous Documentation Update - ${changelog.date}

${changelog.summary.merged > 0 ? `✅ ${changelog.summary.merged} improvements merged` : '📊 No changes today'}
📄 Files updated: ${changelog.summary.filesUpdated}
📈 Quality scores: ${changelog.stats.averageMergeQuality.toFixed(2)} average
${changelog.summary.merged > 0 ? `📈 Documentation grew ${changelog.stats.documentationGrowth}` : ''}

${changelog.mergedImprovements.length > 0 ? `🔍 Top change:
${changelog.mergedImprovements[0].targetSection} - ${changelog.mergedImprovements[0].benefit}
Source: ${changelog.mergedImprovements[0].title}

` : ''}❌ ${changelog.summary.rejected} articles rejected (low quality/duplicates)

Full changelog: knowledge-base/changelogs/${changelog.date}.md`
  }

  static generateWeeklySummary(changelogs: ChangelogEntry[]): string {
    const totalMerged = changelogs.reduce((sum, c) => sum + c.summary.merged, 0)
    const totalRejected = changelogs.reduce((sum, c) => sum + c.summary.rejected, 0)
    const avgQuality = changelogs.reduce((sum, c) => sum + c.stats.averageMergeQuality, 0) / changelogs.length

    const topSources = new Map<string, number>()
    changelogs.forEach(c => {
      c.mergedImprovements.forEach(i => {
        const source = i.sourceUrl.includes('anthropic.com') ? 'Anthropic' :
                      i.sourceUrl.includes('googleblog.com') ? 'Google' :
                      i.sourceUrl.includes('reddit.com') ? 'Reddit' : 'Other'
        topSources.set(source, (topSources.get(source) || 0) + 1)
      })
    })

    const sortedSources = Array.from(topSources.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    return `📈 Weekly Documentation Health - ${changelogs[0]?.date} to ${changelogs[changelogs.length - 1]?.date}

Merged: ${totalMerged} improvements across ${changelogs.length} days
Rejected: ${totalRejected} low-quality findings
Avg quality: ${avgQuality.toFixed(2)}

Top sources: ${sortedSources.map(([source, count]) => `${source} (${count})`).join(', ')}

Your docs improved this week! 🚀`
  }
}