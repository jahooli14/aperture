import { GoogleGenerativeAI } from '@google/generative-ai'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Article, QualityComparison, DocumentationTarget } from './types.js'
import { config } from './config.js'

export class QualityComparator {
  private genAI: GoogleGenerativeAI
  private model: any
  private documentationTargets: DocumentationTarget[]
  private requestDelay = 2000 // 2 seconds between requests

  constructor(apiKey: string, repoRoot: string) {
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    // Define which sections of our docs can be auto-updated
    this.documentationTargets = [
      {
        file: join(repoRoot, 'Aperture', 'CLAUDE-APERTURE.md'),
        sections: [
          {
            name: 'Tool Design Philosophy',
            startPattern: '## Tool Design Philosophy',
            endPattern: '---',
            keywords: ['tool', 'api', 'design', 'anthropic', 'best practices']
          },
          {
            name: 'Loop Pattern with Safeguards',
            startPattern: '## Loop Pattern with Safeguards',
            endPattern: '---',
            keywords: ['loop', 'safeguards', 'timeout', 'iteration', 'retry']
          },
          {
            name: 'Communication Patterns',
            startPattern: '### Communication Patterns',
            endPattern: '---',
            keywords: ['parallel', 'tools', 'transparency', 'execution']
          },
          {
            name: 'Common Patterns',
            startPattern: '## Common Patterns',
            endPattern: '---',
            keywords: ['file operations', 'targeted', 'grep', 'search']
          }
        ]
      },
      {
        file: join(repoRoot, 'Aperture', '.claude/startup.md'),
        sections: [
          {
            name: 'Claude Code Best Practices',
            startPattern: '## Claude Code Best Practices',
            endPattern: '##',
            keywords: ['claude code', 'tools', 'parallel', 'batch']
          }
        ]
      },
      {
        file: join(repoRoot, 'Aperture', '.process/COMMON_MISTAKES.md'),
        sections: [
          {
            name: 'Common Mistakes',
            startPattern: '# Common Mistakes',
            endPattern: undefined,
            keywords: ['mistakes', 'pitfalls', 'avoid', 'antipattern']
          }
        ]
      }
    ]
  }

  async compareQuality(article: Article): Promise<QualityComparison | null> {
    console.log(`Analyzing quality for: ${article.title}`)

    // Add delay to avoid rate limiting
    await this.sleep(this.requestDelay)

    // Find relevant documentation section
    const targetSection = this.findRelevantSection(article)

    // If no existing section, evaluate as new content
    if (!targetSection) {
      console.log('  No existing section found - evaluating as new content')
      return this.evaluateNewContent(article)
    }

    const currentContent = this.extractSectionContent(
      targetSection.file,
      targetSection.section.startPattern,
      targetSection.section.endPattern
    )

    if (!currentContent) {
      console.log(`  Could not extract content from ${targetSection.file}`)
      // Treat as new content if section doesn't exist
      return this.evaluateNewContent(article)
    }

    const prompt = this.buildQualityComparisonPrompt(article, currentContent, targetSection)

    // Debug: Check prompt length
    console.log(`  Prompt length: ${prompt.length} chars, Article content: ${article.content.length} chars`)

    // Retry up to 3 times with exponential backoff
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 6000,  // Increased for $0.25/day budget - prevents MAX_TOKENS on long articles
            temperature: 0.1,
          },
        })

        const response = await result.response

        // Check for blocked content or safety filters
        if (response.promptFeedback?.blockReason) {
          console.log(`  Blocked by safety filter: ${response.promptFeedback.blockReason}`)
          return null
        }

        const responseText = response.text()

        if (!responseText || responseText.trim() === '') {
          console.log(`  Attempt ${attempt}: Empty response from Gemini`)
          console.log(`  Response candidates: ${response.candidates?.length || 0}`)
          if (response.candidates?.[0]?.finishReason) {
            console.log(`  Finish reason: ${response.candidates[0].finishReason}`)
          }
          if (attempt < 3) {
            await this.sleep(attempt * 3000)  // 3s, 6s backoff
            continue
          }
          return null
        }

        const comparison = this.parseQualityResponse(responseText, article, targetSection, currentContent)

        if (comparison) {
          console.log(`  Quality scores: S:${comparison.specificityScore.toFixed(2)} I:${comparison.implementabilityScore.toFixed(2)} E:${comparison.evidenceScore.toFixed(2)} Overall:${comparison.overallScore.toFixed(2)}`)
          console.log(`  Integration mode: ${comparison.integrationMode || 'merge'} (token delta: ${comparison.expectedTokenDelta || 0})`)
          console.log(`  Should merge: ${comparison.shouldMerge}`)
        }

        return comparison

      } catch (error) {
        console.error(`  Attempt ${attempt} error:`, error)
        if (attempt < 3) {
          await this.sleep(attempt * 3000)
        }
      }
    }

    console.log('  All retry attempts failed')
    return null
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private findRelevantSection(article: Article): { file: string; section: any } | null {
    const articleText = `${article.title} ${article.content}`.toLowerCase()

    for (const target of this.documentationTargets) {
      for (const section of target.sections) {
        const hasRelevantKeywords = section.keywords.some(keyword =>
          articleText.includes(keyword.toLowerCase())
        )

        if (hasRelevantKeywords) {
          return { file: target.file, section }
        }
      }
    }

    return null
  }

  private extractSectionContent(filePath: string, startPattern: string, endPattern?: string | null): string | null {
    try {
      const content = readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')

      let startIndex = -1
      let endIndex = lines.length

      // Find start
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(startPattern)) {
          startIndex = i
          break
        }
      }

      if (startIndex === -1) return null

      // Find end
      if (endPattern) {
        for (let i = startIndex + 1; i < lines.length; i++) {
          if (lines[i].includes(endPattern)) {
            endIndex = i
            break
          }
        }
      }

      return lines.slice(startIndex, endIndex).join('\n')

    } catch (error) {
      console.error(`Error reading ${filePath}:`, error)
      return null
    }
  }

  private buildQualityComparisonPrompt(
    article: Article,
    currentContent: string,
    targetSection: { file: string; section: any }
  ): string {
    return `You are optimizing documentation to be MINIMAL and FRONTIER-QUALITY.

**Goal**: Maximize information density. Prefer replacing outdated content over accumulating history.

**Current Documentation Section:**
File: ${targetSection.file}
Section: ${targetSection.section.name}
Current tokens: ~${Math.floor(currentContent.length / 4)}

\`\`\`markdown
${currentContent.slice(0, 2000)} ${currentContent.length > 2000 ? '...' : ''}
\`\`\`

**New Article:**
Title: ${article.title}
Source: ${article.source} (authority: ${article.sourceAuthority})
URL: ${article.url}
Content: ${article.content.slice(0, 1500)} ${article.content.length > 1500 ? '...' : ''}

**Your task:** Determine the OPTIMAL integration mode to minimize tokens while maximizing value.

**Quality Dimensions** (0.0-1.0):

1. **Specificity**: Concrete examples/numbers vs generic platitudes
2. **Implementability**: Copy-paste ready vs theoretical
3. **Evidence**: Official source + benchmarks vs opinion

**Integration Mode Analysis:**

**REPLACE** - New info makes existing content obsolete
- Evidence score must be ≥0.85 (high bar for deletion)
- Examples: Version upgrades (Claude 3.5 → 4), API changes (v1 → v2)
- Supersession indicators: "new version", "replaces", "deprecated", quantifiably better
- Result: DELETE old content, ADD new (aim for token reduction)

**MERGE** - New info complements existing
- Evidence score ≥0.75
- Consolidate similar concepts, combine examples
- Remove redundancy, cite most authoritative source only
- Result: Refine existing content (modest token growth acceptable)

**REFACTOR** - Same content, more efficient
- Existing content is good but verbose
- Reorganize for clarity, combine paragraphs
- Use cross-links instead of repetition
- Result: Token reduction required

**SKIP** - Already covered adequately
- New info doesn't add value
- Existing content is better
- Would add bloat without benefit

**Supersession Detection:**
Check if new article contains:
- Version references: ${config.supersessionDetection.patterns.versionUpgrade.join(', ')}
- Official updates: ${config.supersessionDetection.patterns.officialUpdate.join(', ')}
- Quantifiable improvements: Numbers, percentages, "X times faster"

**Response format (JSON):**
\`\`\`json
{
  "specificityScore": 0.8,
  "implementabilityScore": 0.9,
  "evidenceScore": 1.0,
  "hasConcreteExample": true,
  "hasQuantifiableBenefit": true,
  "fromAuthoritativeSource": true,
  "contradictionsResolved": true,
  "integrationMode": "replace",
  "supersessionType": "version-upgrade",
  "expectedTokenDelta": -15,
  "shouldMerge": true,
  "reasoning": [
    "Claude 4 supersedes Claude 3.5 (version upgrade)",
    "2x performance improvement is quantifiable",
    "Official Anthropic source (evidence: 1.0)",
    "Can DELETE old version references, ADD new recommendation",
    "Expected: 45 tokens → 30 tokens (-33% more efficient)"
  ],
  "overallScore": 0.9
}
\`\`\``
  }

  private parseQualityResponse(
    response: string,
    article: Article,
    targetSection: { file: string; section: any },
    currentContent: string
  ): QualityComparison | null {
    try {
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/)
      if (!jsonMatch) {
        throw new Error('No JSON found in quality comparison response')
      }

      const parsed = JSON.parse(jsonMatch[1])

      return {
        article,
        targetFile: targetSection.file,
        targetSection: targetSection.section.name,
        currentContent,
        specificityScore: parsed.specificityScore,
        implementabilityScore: parsed.implementabilityScore,
        evidenceScore: parsed.evidenceScore,
        hasConcreteExample: parsed.hasConcreteExample,
        hasQuantifiableBenefit: parsed.hasQuantifiableBenefit,
        fromAuthoritativeSource: parsed.fromAuthoritativeSource,
        contradictionsResolved: parsed.contradictionsResolved,
        integrationMode: parsed.integrationMode,
        supersessionType: parsed.supersessionType,
        expectedTokenDelta: parsed.expectedTokenDelta,
        shouldMerge: parsed.shouldMerge,
        reasoning: parsed.reasoning,
        overallScore: parsed.overallScore
      }

    } catch (error) {
      console.error('Error parsing quality comparison response:', error)
      console.log('Raw response:', response)
      return null
    }
  }

  shouldMerge(comparison: QualityComparison, qualityThreshold: number = 0.75): boolean {
    if (!comparison.shouldMerge) return false
    if (!comparison.contradictionsResolved) return false
    if (comparison.overallScore < qualityThreshold) return false

    // At least 2 dimensions must score >= 0.7
    const highScores = [
      comparison.specificityScore,
      comparison.implementabilityScore,
      comparison.evidenceScore
    ].filter(score => score >= 0.7)

    return highScores.length >= 2
  }

  private async evaluateNewContent(article: Article): Promise<QualityComparison | null> {
    const prompt = `You are evaluating NEW content to determine if it should be added to documentation.

**Article:**
Title: ${article.title}
Source: ${article.source} (authority: ${article.sourceAuthority})
URL: ${article.url}
Content: ${article.content.slice(0, 2000)} ${article.content.length > 2000 ? '...' : ''}

**Evaluation criteria:**

1. **Specificity** (0.0-1.0): How specific vs generic?
   - 1.0: Concrete examples, exact APIs, specific implementations
   - 0.5: Some specifics but general advice
   - 0.0: Generic platitudes

2. **Implementability** (0.0-1.0): How actionable for developers?
   - 1.0: Ready-to-use code, clear integration steps
   - 0.5: Clear guidance needing adaptation
   - 0.0: Theoretical with no implementation path

3. **Evidence** (0.0-1.0): How well-supported?
   - 1.0: Official source + benchmarks + quantified benefits
   - 0.5: Credible source with some backing
   - 0.0: Opinion or unsubstantiated

4. **Relevance** (0.0-1.0): How relevant to Aperture project (baby photo app using Claude Code, Supabase, React)?
   - 1.0: Directly applicable to our stack/use case
   - 0.5: Generally relevant to AI development
   - 0.0: Off-topic

**Add as NEW section if:**
- Overall score ≥ 0.75
- At least 2 dimensions ≥ 0.7
- Relevance ≥ 0.6
- Content is actionable and specific

**Suggested location:** Determine best file and section title for this content:
- Aperture/CLAUDE-APERTURE.md for Claude/AI patterns
- Aperture/.claude/startup.md for Claude Code workflows
- Aperture/.process/ for development processes

**Response format (JSON):**
\`\`\`json
{
  "specificityScore": 0.9,
  "implementabilityScore": 0.8,
  "evidenceScore": 1.0,
  "relevanceScore": 0.7,
  "hasConcreteExample": true,
  "hasQuantifiableBenefit": true,
  "fromAuthoritativeSource": true,
  "contradictionsResolved": true,
  "shouldMerge": true,
  "suggestedFile": "CLAUDE-APERTURE.md",
  "suggestedSection": "Claude Skills",
  "reasoning": [
    "Official Anthropic announcement of new feature",
    "Provides specific API examples",
    "Directly applicable to our Claude Code usage"
  ],
  "overallScore": 0.85
}
\`\`\``;

    // Debug: Check prompt length
    console.log(`  New content prompt length: ${prompt.length} chars, Article content: ${article.content.length} chars`)

    // Retry up to 3 times with exponential backoff
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await this.model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 6000,  // Increased for $0.25/day budget - prevents MAX_TOKENS on long articles
            temperature: 0.1,
          },
        })

        const response = await result.response

        // Check for blocked content or safety filters
        if (response.promptFeedback?.blockReason) {
          console.log(`  New content blocked by safety filter: ${response.promptFeedback.blockReason}`)
          return null
        }

        const responseText = response.text()

        if (!responseText || responseText.trim() === '') {
          console.log(`  Attempt ${attempt}: Empty response from Gemini (new content)`)
          console.log(`  Response candidates: ${response.candidates?.length || 0}`)
          if (response.candidates?.[0]?.finishReason) {
            console.log(`  Finish reason: ${response.candidates[0].finishReason}`)
          }
          if (attempt < 3) {
            await this.sleep(attempt * 3000)
            continue
          }
          return null
        }

        try {
          const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/)
          if (!jsonMatch) {
            console.log('  No JSON found in new content evaluation')
            if (attempt < 3) {
              await this.sleep(attempt * 3000)
              continue
            }
            return null
          }

          const parsed = JSON.parse(jsonMatch[1])

          // Must meet quality bar for new content
          if (parsed.overallScore < 0.75 || (parsed.relevanceScore || 0) < 0.6) {
            console.log(`  Below quality threshold (overall: ${parsed.overallScore}, relevance: ${parsed.relevanceScore || 0})`)
            return null
          }

          return {
            article,
            targetFile: parsed.suggestedFile || 'Aperture/CLAUDE-APERTURE.md',
            targetSection: parsed.suggestedSection || 'New Section',
            currentContent: '', // No existing content for new sections
            specificityScore: parsed.specificityScore,
            implementabilityScore: parsed.implementabilityScore,
            evidenceScore: parsed.evidenceScore,
            hasConcreteExample: parsed.hasConcreteExample,
            hasQuantifiableBenefit: parsed.hasQuantifiableBenefit,
            fromAuthoritativeSource: parsed.fromAuthoritativeSource,
            contradictionsResolved: true, // No contradictions possible with new content
            shouldMerge: parsed.shouldMerge,
            reasoning: parsed.reasoning,
            overallScore: parsed.overallScore
          }
        } catch (error) {
          console.error(`  Attempt ${attempt} parse error:`, error)
          if (attempt < 3) {
            await this.sleep(attempt * 3000)
          }
        }
      } catch (error) {
        console.error(`  Attempt ${attempt} API error:`, error)
        if (attempt < 3) {
          await this.sleep(attempt * 3000)
        }
      }
    }

    console.log('  All retry attempts failed for new content')
    return null
  }
}