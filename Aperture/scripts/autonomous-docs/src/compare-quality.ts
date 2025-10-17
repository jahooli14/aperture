import { GoogleGenerativeAI } from '@google/generative-ai'
import { readFileSync } from 'fs'
import { join } from 'path'
import { Article, QualityComparison, DocumentationTarget } from './types.js'

export class QualityComparator {
  private genAI: GoogleGenerativeAI
  private model: any
  private documentationTargets: DocumentationTarget[]

  constructor(apiKey: string, repoRoot: string) {
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.model = this.genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" })

    // Define which sections of our docs can be auto-updated
    this.documentationTargets = [
      {
        file: join(repoRoot, 'CLAUDE-APERTURE.md'),
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
        file: join(repoRoot, '.claude/startup.md'),
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
        file: join(repoRoot, '.process/COMMON_MISTAKES.md'),
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

    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.1,
        },
      })

      const response = await result.response
      const responseText = response.text()

      const comparison = this.parseQualityResponse(responseText, article, targetSection, currentContent)

      if (comparison) {
        console.log(`  Quality scores: S:${comparison.specificityScore.toFixed(2)} I:${comparison.implementabilityScore.toFixed(2)} E:${comparison.evidenceScore.toFixed(2)} Overall:${comparison.overallScore.toFixed(2)}`)
        console.log(`  Should merge: ${comparison.shouldMerge}`)
      }

      return comparison

    } catch (error) {
      console.error('Error comparing quality:', error)
      return null
    }
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
    return `You are comparing new information against existing documentation to determine if it's objectively better.

**Current Documentation Section:**
File: ${targetSection.file}
Section: ${targetSection.section.name}

\`\`\`markdown
${currentContent.slice(0, 2000)} ${currentContent.length > 2000 ? '...' : ''}
\`\`\`

**New Article:**
Title: ${article.title}
Source: ${article.source} (authority: ${article.sourceAuthority})
URL: ${article.url}
Content: ${article.content.slice(0, 1500)} ${article.content.length > 1500 ? '...' : ''}

**Your task:** Compare the new information to existing content and score each dimension:

1. **Specificity** (0.0-1.0): How specific vs generic?
   - 1.0: Concrete examples, exact numbers, specific code
   - 0.5: Some specifics but still general advice
   - 0.0: Generic platitudes, vague recommendations

2. **Implementability** (0.0-1.0): How actionable?
   - 1.0: Copy-paste ready code, step-by-step instructions
   - 0.5: Clear guidance but needs adaptation
   - 0.0: Theoretical discussion, no implementation path

3. **Evidence** (0.0-1.0): How well-supported?
   - 1.0: Official source + benchmarks/studies + quantifiable benefits
   - 0.5: Credible source with some backing
   - 0.0: Opinion, anecdotal, or unsubstantiated

**Answer these questions:**
- hasConcreteExample: Does the article provide specific code/examples we don't have?
- hasQuantifiableBenefit: Does it cite measurable improvements (%, time, errors)?
- fromAuthoritativeSource: Is it from Anthropic, Google, or proven expert?
- contradictionsResolved: Does it contradict our existing content?

**Merge criteria:** Only recommend merge if:
- At least 2 scores are ≥ 0.7
- No unresolved contradictions
- Adds concrete value to existing content

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
  "shouldMerge": true,
  "reasoning": [
    "Adds specific timeout implementation to generic guidance",
    "Official Anthropic source with quantified benefits (95% issue reduction)",
    "Extends existing pattern without contradicting"
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
}