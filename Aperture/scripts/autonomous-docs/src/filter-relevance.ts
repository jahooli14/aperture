import { GoogleGenerativeAI } from '@google/generative-ai'
import { Article, RelevanceAnalysis } from './types.js'

export class RelevanceFilter {
  private genAI: GoogleGenerativeAI
  private model: any

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.model = this.genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" })
  }

  async analyzeRelevance(articles: Article[]): Promise<RelevanceAnalysis[]> {
    console.log(`Analyzing relevance for ${articles.length} articles...`)

    if (articles.length === 0) return []

    // Process in batches to avoid overwhelming the API
    const batchSize = 20
    const allAnalyses: RelevanceAnalysis[] = []

    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize)
      console.log(`  Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(articles.length / batchSize)} (${batch.length} articles)`)

      const batchAnalyses = await this.analyzeBatch(batch)
      allAnalyses.push(...batchAnalyses)
    }

    const relevant = allAnalyses.filter(a => a.isRelevant)
    console.log(`  ${relevant.length}/${articles.length} articles are relevant`)
    return allAnalyses
  }

  private async analyzeBatch(articles: Article[]): Promise<RelevanceAnalysis[]> {
    const prompt = this.buildRelevancePrompt(articles)

    try {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 4000,
          temperature: 0.1,
        },
      })

      const response = await result.response
      const responseText = response.text()

      const analyses = this.parseRelevanceResponse(responseText, articles)
      return analyses

    } catch (error) {
      console.error('Error analyzing batch:', error)
      // Fallback: mark all articles as potentially relevant for manual review
      return articles.map(article => ({
        article,
        relevanceScore: 0.5,
        category: 'other' as const,
        reasoning: ['Failed to analyze - needs manual review'],
        isRelevant: true
      }))
    }
  }

  private buildRelevancePrompt(articles: Article[]): string {
    const articlesText = articles.map((article, index) =>
      `Article ${index + 1}:
Title: ${article.title}
Source: ${article.source} (authority: ${article.sourceAuthority})
URL: ${article.url}
Summary: ${article.summary.slice(0, 300)}
---`
    ).join('\n\n')

    return `You are analyzing articles for relevance to improving software development processes, specifically around:

1. **Anthropic/Claude**: API best practices, tool design patterns, agent architecture, performance optimization
2. **Google Gemini**: API features, integration patterns, comparison insights
3. **Development Patterns**: Code organization, workflow improvements, productivity tools
4. **AI Tools**: Development aids, automation, process enhancement

For each article, score its relevance (0.0-1.0) and provide:
- Category: anthropic | gemini | patterns | tools | other
- 2-3 sentence reasoning why it's relevant or not
- Focus on: actionable insights, specific techniques, measurable improvements, official recommendations

**Articles to analyze:**

${articlesText}

**Response format (JSON):**
\`\`\`json
[
  {
    "articleIndex": 1,
    "relevanceScore": 0.8,
    "category": "anthropic",
    "reasoning": ["Official Anthropic blog post about new tool design patterns", "Contains specific code examples and performance benchmarks", "Addresses current pain points in agent development"],
    "isRelevant": true
  }
]
\`\`\`

**Scoring guidelines:**
- 0.9-1.0: Highly actionable, official source, specific implementation details
- 0.7-0.8: Good insights, actionable content, credible source
- 0.5-0.6: Some useful information but generic or tangential
- 0.0-0.4: Off-topic, marketing fluff, or no actionable content

Only mark as relevant (isRelevant: true) if score >= 0.7.`
  }

  private parseRelevanceResponse(response: string, articles: Article[]): RelevanceAnalysis[] {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/)
      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const parsed = JSON.parse(jsonMatch[1])

      if (!Array.isArray(parsed)) {
        throw new Error('Response is not an array')
      }

      return parsed.map((item: any) => {
        const articleIndex = item.articleIndex - 1 // Convert to 0-based
        if (articleIndex < 0 || articleIndex >= articles.length) {
          throw new Error(`Invalid article index: ${item.articleIndex}`)
        }

        // Auto-set isRelevant based on score if not explicitly provided
        const isRelevant = item.isRelevant !== undefined
          ? item.isRelevant
          : item.relevanceScore >= 0.7

        return {
          article: articles[articleIndex],
          relevanceScore: item.relevanceScore,
          category: item.category,
          reasoning: item.reasoning,
          isRelevant
        }
      })

    } catch (error) {
      console.error('Error parsing relevance response:', error)
      console.log('Raw response:', response)

      // Fallback: return all articles with low scores
      return articles.map(article => ({
        article,
        relevanceScore: 0.3,
        category: 'other' as const,
        reasoning: ['Failed to parse analysis - needs manual review'],
        isRelevant: false
      }))
    }
  }

  filterRelevant(analyses: RelevanceAnalysis[], threshold: number = 0.7): RelevanceAnalysis[] {
    return analyses.filter(analysis =>
      analysis.isRelevant && analysis.relevanceScore >= threshold
    )
  }
}