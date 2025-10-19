import { GoogleGenerativeAI } from '@google/generative-ai'
import { QualityComparison, MergeResult } from './types.js'
import { config } from './config.js'

export class DocumentIntegrator {
  private genAI: GoogleGenerativeAI
  private model: any

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
  }

  async generateIntegration(comparison: QualityComparison): Promise<MergeResult | null> {
    console.log(`Generating integration for: ${comparison.article.title}`)

    const prompt = this.buildIntegrationPrompt(comparison)

    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 8000,  // Increased for $0.25/day budget - allows complex multi-paragraph integrations
          temperature: 0.1,
        },
      })

      const response = await result.response
      const responseText = response.text()

      const parseResult = this.parseIntegrationResponse(responseText, comparison)

      if (parseResult) {
        console.log(`  Generated integration: ${parseResult.improvementSummary}`)

        // Validate the result
        if (this.validateIntegration(parseResult, comparison)) {
          return parseResult
        } else {
          console.log('  Integration failed validation')
          return null
        }
      }

      return null

    } catch (error) {
      console.error('Error generating integration:', error)
      return null
    }
  }

  private buildIntegrationPrompt(comparison: QualityComparison): string {
    const mode = comparison.integrationMode || 'merge'
    const targetTokens = Math.floor(comparison.currentContent.length / 4) + (comparison.expectedTokenDelta || 0)

    const modeInstructions: Record<string, string> = {
      replace: `**MODE: REPLACE** - The new information SUPERSEDES existing content.

**Your Task:**
- DELETE outdated information (${comparison.supersessionType || 'obsolete content'})
- REPLACE with new, frontier-quality content
- Preserve document structure but update facts
- Aim for FEWER tokens than before (current: ~${Math.floor(comparison.currentContent.length / 4)}, target: ~${targetTokens})

**What to Remove:**
- Old version references
- Outdated recommendations
- Superseded examples
- Lower-authority sources

**What to Keep:**
- Section headers and structure
- Still-relevant context
- Cross-references`,

      merge: `**MODE: MERGE** - New information COMPLEMENTS existing content.

**Your Task:**
- Consolidate similar concepts
- Combine redundant examples into one authoritative one
- Cite most recent/authoritative source only
- Add new information concisely

**Optimization Rules:**
- Don't add if already well-covered
- Replace vague with quantifiable
- Prefer "30s timeout" over "use timeouts"`,

      refactor: `**MODE: REFACTOR** - Same information, more efficiently.

**Your Task:**
- Reorganize for clarity
- Combine paragraphs where possible
- Remove redundant phrasing
- MUST achieve token reduction
- NO information loss allowed`,

      newSection: `**MODE: NEW SECTION** - Adding entirely new content.

**Your Task:**
- Create concise, high-density section
- Follow existing document style
- Cross-link to related sections where applicable
- Aim for ~${targetTokens} tokens`,

      skip: `**MODE: SKIP** - Content already covered adequately.`
    }

    return `You are a documentation optimizer focused on MAXIMUM INFORMATION DENSITY.

**Goal**: ${modeInstructions[mode]}

**Current Section:**
Tokens: ~${Math.floor(comparison.currentContent.length / 4)}
\`\`\`markdown
${comparison.currentContent}
\`\`\`

**New Article:**
Title: ${comparison.article.title}
Source: ${comparison.article.source} (authority: ${comparison.article.sourceAuthority})
URL: ${comparison.article.url}
Content: ${comparison.article.content.slice(0, 1000)}

**Quality Scores:**
- Specificity: ${comparison.specificityScore}/1.0
- Implementability: ${comparison.implementabilityScore}/1.0
- Evidence: ${comparison.evidenceScore}/1.0
- Expected token delta: ${comparison.expectedTokenDelta || 0}

**Optimization Principles:**
1. One source citation per concept (use most authoritative)
2. Prefer quantifiable claims ("95% reduction" vs "much better")
3. Remove hedging ("generally", "often", "typically")
4. Combine related examples
5. Use cross-links instead of repetition: [See Section](#link)

**Response Format:**
\`\`\`json
{
  "updatedContent": "... optimized markdown ...",
  "improvementSummary": "Brief description",
  "tokenDelta": -15,
  "keyChanges": [
    "Removed: Claude 3.5 references (superseded)",
    "Added: Claude 4 with 2x performance metric",
    "Consolidated: 3 timeout examples → 1 authoritative example"
  ],
  "contentRemoved": ["Old timeout approach without metrics"],
  "contentAdded": ["30s timeout reduces errors 95% (Anthropic)"]
}
\`\`\`

Generate the optimized integration now:`
  }

  private parseIntegrationResponse(response: string, comparison: QualityComparison): MergeResult | null {
    try {
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/)
      if (!jsonMatch) {
        throw new Error('No JSON found in integration response')
      }

      const parsed = JSON.parse(jsonMatch[1])

      return {
        targetFile: comparison.targetFile,
        targetSection: comparison.targetSection,
        beforeContent: comparison.currentContent,
        afterContent: parsed.updatedContent,
        improvementSummary: parsed.improvementSummary,
        sourceUrl: comparison.article.url,
        sourceTitle: comparison.article.title,
        integrationMode: comparison.integrationMode,
        tokenDelta: parsed.tokenDelta,
        contentRemoved: parsed.contentRemoved,
        contentAdded: parsed.contentAdded
      }

    } catch (error) {
      console.error('Error parsing integration response:', error)
      console.log('Raw response:', response)
      return null
    }
  }

  private validateIntegration(result: MergeResult, comparison: QualityComparison): boolean {
    const beforeLength = result.beforeContent.length
    const afterLength = result.afterContent.length
    const mode = result.integrationMode || comparison.integrationMode || 'merge'

    // Get validation rules for this mode
    const rules = config.integrationModes[mode]?.validation || config.integrationModes.merge.validation

    // Calculate metrics
    const growthRatio = afterLength / beforeLength
    const growthPercent = (growthRatio - 1) * 100
    const tokenDelta = result.tokenDelta || Math.floor((afterLength - beforeLength) / 4)

    // Check growth limit (varies by mode)
    if (growthRatio > (1 + rules.maxGrowth)) {
      console.log(`  Validation failed: Section grew too much (${growthPercent.toFixed(1)}% vs ${(rules.maxGrowth * 100).toFixed(0)}% limit for ${mode} mode)`)
      return false
    }

    // For replace/refactor modes: allow token reduction
    if (rules.allowTokenReduction && growthRatio < 1.0) {
      console.log(`  Validation passed: Token reduction achieved (${growthPercent.toFixed(1)}% = ${tokenDelta} tokens saved)`)
      return true
    }

    // For refactor mode: REQUIRE token reduction
    if (rules.requireTokenReduction && growthRatio >= 1.0) {
      console.log(`  Validation failed: Refactor mode requires token reduction, got ${growthPercent.toFixed(1)}% growth`)
      return false
    }

    // Check word preservation (varies by mode)
    const originalWords = new Set(result.beforeContent.toLowerCase().match(/\w+/g) || [])
    const newContentWords = new Set(result.afterContent.toLowerCase().match(/\w+/g) || [])

    let preservedWords = 0
    for (const word of originalWords) {
      if (newContentWords.has(word)) {
        preservedWords++
      }
    }

    const preservationRatio = preservedWords / originalWords.size
    const minPreservation = rules.minFactPreservation || 0.8

    if (preservationRatio < minPreservation) {
      console.log(`  Validation failed: Too much content lost (${(preservationRatio * 100).toFixed(1)}% preserved vs ${(minPreservation * 100).toFixed(0)}% required for ${mode} mode)`)
      return false
    }

    // Check for source citation (skip for refactor mode)
    if (mode !== 'refactor') {
      if (!result.afterContent.includes('[Source:') && !result.afterContent.includes('Source: [')) {
        console.log('  Validation failed: No source citation found')
        return false
      }
    }

    // Check minimum new content (skip for replace/refactor)
    if (mode === 'merge' || mode === 'newSection') {
      const newWords = this.extractNewWords(result.beforeContent, result.afterContent)
      if (newWords.length < 5) {
        console.log('  Validation failed: Too few new words added')
        return false
      }
    }

    console.log(`  Validation passed (${mode}): ${growthPercent.toFixed(1)}% growth (${tokenDelta >= 0 ? '+' : ''}${tokenDelta} tokens), ${(preservationRatio * 100).toFixed(1)}% preserved`)
    return true
  }

  private extractNewWords(before: string, after: string): string[] {
    const beforeWords = new Set(before.toLowerCase().match(/\w+/g) || [])
    const afterWords = after.toLowerCase().match(/\w+/g) || []

    return afterWords.filter(word => !beforeWords.has(word))
  }
}