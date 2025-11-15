# Autonomous Documentation System

Automatically discovers, analyzes, and integrates high-quality improvements into your documentation by monitoring content sources daily.

## How It Works

1. **Daily Content Discovery**: Fetches articles from RSS feeds (Anthropic, Google AI, Hacker News, etc.)
2. **Relevance Filtering**: Claude analyzes articles for development process relevance (≥0.7 score)
3. **Quality Comparison**: Compares findings against existing documentation using objective criteria
4. **Autonomous Merging**: Auto-integrates improvements that meet quality thresholds
5. **Audit Trail**: Full reasoning and rollback capability for every decision

## Quick Start

### 1. Install Dependencies

```bash
cd scripts/autonomous-docs
npm install
```

### 2. Set API Key

```bash
export GEMINI_API_KEY="your-gemini-api-key-here"
```

### 3. Test Run

```bash
npm run dev
```

### 4. Enable Automation

The GitHub Action runs daily at 9:00 AM UTC. Ensure `GEMINI_API_KEY` is set in repository secrets.

## Configuration

Edit `knowledge-base/sources.json`:

```json
{
  "sources": [
    {
      "id": "anthropic-blog",
      "name": "Anthropic Blog",
      "url": "https://www.anthropic.com/news/rss",
      "keywords": ["claude", "ai safety", "agents"],
      "authority": 1.0,
      "enabled": true
    }
  ],
  "relevanceThreshold": 0.7,
  "qualityThreshold": 0.75,
  "maxDailyChanges": 5,
  "maxSectionGrowth": 1.2
}
```

## Merge Criteria

Articles are automatically merged only when:

- **Authority**: From Anthropic, Google, or proven expert
- **Quality**: ≥2 dimensions score 0.7+ (specificity, implementability, evidence)
- **Safety**: No contradictions, <20% section growth
- **Value**: Adds concrete examples, quantifiable benefits, or official backing

## Output Files

- `knowledge-base/changelogs/YYYY-MM-DD.md` - Daily summary of changes
- `knowledge-base/audit-trail/YYYY-MM-DD/` - Full decision reasoning
- Updated documentation files with `[Source: ...]` citations

## Monitoring

**Daily**: Check `knowledge-base/changelogs/` for what changed
**Weekly**: Review `audit-trail/` for decision patterns
**Never**: Manual review required (fully autonomous)

## Safety Features

- **Version Control**: Every change is a git commit (easy rollback)
- **Size Limits**: Max 20% section growth, max 5 changes/day
- **Validation**: Preserves 80%+ of original content
- **Conflict Detection**: Skips contradictory information

## Cost

~$0.13/day in Gemini API costs (~$4/month)
- Relevance filtering: $0.02
- Quality comparison: $0.05
- Integration generation: $0.06

## Troubleshooting

**No changes appearing?**
- Check `audit-trail/` to see what was analyzed
- Lower `qualityThreshold` in config (temporarily)
- Review `changelogs/` for rejection reasons

**Integration failed?**
- Check file permissions
- Ensure documentation structure is standard markdown
- Review target file paths in `compare-quality.ts`

**API errors?**
- Verify `GEMINI_API_KEY` is set correctly
- Check API rate limits
- Review error logs in GitHub Actions

## Development

```bash
# Build TypeScript
npm run build

# Run with debugging
npm run dev

# Run tests
npm test
```

## Architecture

```
index.ts → fetch-sources.ts → filter-relevance.ts → compare-quality.ts → generate-integration.ts → apply-changes.ts → audit-changelog.ts
```

Each stage is isolated with clear inputs/outputs and comprehensive error handling.