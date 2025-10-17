
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
- CLAUDE-APERTURE.md for Claude/AI patterns
- .claude/startup.md for Claude Code workflows
- .process/ for development processes

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

    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.1,
        },
      })

      const response = result.response.text()
      
      try {
        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/)
        if (!jsonMatch) {
          console.log('  No JSON found in new content evaluation')
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
          targetFile: parsed.suggestedFile || 'CLAUDE-APERTURE.md',
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
        console.error('  Error parsing new content evaluation:', error)
        return null
      }
    } catch (error) {
      console.error(`  Error evaluating new content:`, error)
      return null
    }
  }
}
