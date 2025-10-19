import { GoogleGenerativeAI } from '@google/generative-ai'
import { QualityComparison, MergeResult } from './types.js'

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
    return `You are integrating new, higher-quality information into existing documentation.

**Task:** Seamlessly merge the new information into the current section while preserving all existing content.

**Current Section:**
\`\`\`markdown
${comparison.currentContent}
\`\`\`

**New Article Information:**
Title: ${comparison.article.title}
Source: ${comparison.article.source} (authority: ${comparison.article.sourceAuthority})
URL: ${comparison.article.url}
Content: ${comparison.article.content.slice(0, 1000)}

**Quality Analysis:**
- Specificity: ${comparison.specificityScore}/1.0 (${comparison.hasConcreteExample ? 'has examples' : 'no examples'})
- Implementability: ${comparison.implementabilityScore}/1.0
- Evidence: ${comparison.evidenceScore}/1.0 (${comparison.fromAuthoritativeSource ? 'authoritative' : 'non-authoritative'})
- Has quantifiable benefit: ${comparison.hasQuantifiableBenefit}

**Integration Requirements:**

1. **Preserve Everything**: All existing content must remain
2. **Seamless Integration**: New info should flow naturally, not feel bolted-on
3. **Add Value**: Only include what improves upon current content
4. **Maintain Style**: Keep consistent voice and formatting
5. **Cite Sources**: Add [Source: [Title](URL)] for new information
6. **No Duplication**: Don't repeat what's already covered well

**Specific Instructions:**
- If new info has concrete examples, add them to relevant sections
- If new info has quantifiable benefits, integrate the numbers
- If new info adds nuance to existing guidance, refine the text
- If new info provides official backing, mention the source authority
- Keep section length reasonable (max 20% growth)

**Response Format:**
Provide the complete updated section in this format:

\`\`\`json
{
  "updatedContent": "... complete markdown section ...",
  "improvementSummary": "Brief description of what was improved",
  "keyChanges": [
    "Added concrete timeout example from Anthropic",
    "Included 95% error reduction metric",
    "Added source citation"
  ]
}
\`\`\`

Generate the integration now:`
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
        sourceTitle: comparison.article.title
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

    // Check maximum growth (20%)
    const growthRatio = afterLength / beforeLength
    if (growthRatio > 1.2) {
      console.log(`  Validation failed: Section grew too much (${(growthRatio * 100).toFixed(1)}%)`)
      return false
    }

    // Check that content isn't just duplicated
    const newWords = this.extractNewWords(result.beforeContent, result.afterContent)
    if (newWords.length < 5) {
      console.log('  Validation failed: Too few new words added')
      return false
    }

    // Check that original content is preserved (at least 80% of original words should remain)
    const originalWords = new Set(result.beforeContent.toLowerCase().match(/\w+/g) || [])
    const newContentWords = new Set(result.afterContent.toLowerCase().match(/\w+/g) || [])

    let preservedWords = 0
    for (const word of originalWords) {
      if (newContentWords.has(word)) {
        preservedWords++
      }
    }

    const preservationRatio = preservedWords / originalWords.size
    if (preservationRatio < 0.8) {
      console.log(`  Validation failed: Too much original content lost (${(preservationRatio * 100).toFixed(1)}% preserved)`)
      return false
    }

    // Check for source citation
    if (!result.afterContent.includes('[Source:') && !result.afterContent.includes('Source: [')) {
      console.log('  Validation failed: No source citation found')
      return false
    }

    console.log(`  Validation passed: ${(growthRatio * 100).toFixed(1)}% growth, ${newWords.length} new words, ${(preservationRatio * 100).toFixed(1)}% preserved`)
    return true
  }

  private extractNewWords(before: string, after: string): string[] {
    const beforeWords = new Set(before.toLowerCase().match(/\w+/g) || [])
    const afterWords = after.toLowerCase().match(/\w+/g) || []

    return afterWords.filter(word => !beforeWords.has(word))
  }
}