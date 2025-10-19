# Autonomous Documentation System - Feature Guide

**Purpose**: Keep documentation minimal, current, and frontier-quality through automated optimization.

## Philosophy

**NOT**: Historical archive of every article we've seen
**IS**: Streamlined docs that replace outdated content with better information

**Goal**: Maximize information density (value per token)

## How It Works

Daily workflow (09:00 UTC):
1. **Fetch** articles from Anthropic News, Reddit, Dev.to, HackerNews
2. **Filter** relevance with Gemini (~8-12 relevant from 20-30 total)
3. **Compare** quality vs existing docs, determine integration mode
4. **Integrate** using mode-specific optimization
5. **Validate** based on mode rules
6. **Commit** if changes improve docs

## Integration Modes

### REPLACE - Supersede Obsolete Content
**When**: Version upgrades (Claude 3.5 → 4), API changes, quantifiably better practices
**Evidence required**: ≥0.85 (high bar for deletion)
**Validation**: Allows 100% growth, allows token reduction
**Example**:
- Before: "Claude 3.5 recommended, use 4096 max_tokens" (60 tokens)
- After: "Claude 4 (2x faster) recommended, 8192 max_tokens" (35 tokens)
- Result: -42% tokens, frontier knowledge

### MERGE - Consolidate Complementary Info
**When**: New info complements existing
**Evidence required**: ≥0.75
**Validation**: 40% max growth, 100% fact preservation
**Example**: Add quantifiable metric to existing advice

### REFACTOR - Optimize Without New Info
**When**: Existing content is good but verbose
**Evidence required**: ≥0.9
**Validation**: REQUIRES token reduction, no information loss
**Example**: Combine 3 paragraphs into 1, remove redundancy

### NEW SECTION - Add Frontier Knowledge
**When**: Entirely new topic (Claude Skills, new API feature)
**Evidence required**: ≥0.8
**Validation**: 100% growth allowed
**Example**: Add section about new Anthropic feature

## Configuration

**File**: `config.json`

Key settings:
```json
{
  "optimizationGoal": "minimize-tokens-maximize-value",
  "budget": {
    "dailyCapUSD": 0.25,
    "tokenLimits": {
      "relevanceFilter": 8000,
      "qualityComparison": 6000,
      "integration": 8000
    }
  }
}
```

## Modifying the System

### Change Integration Mode Aggressiveness
Edit `config.json` → `integrationModes.replace.minEvidenceScore`
- Higher (0.9) = more conservative, only replace with very strong evidence
- Lower (0.8) = more aggressive replacement

### Adjust Growth Limits
Edit `config.json` → `integrationModes.merge.validation.maxGrowth`
- Default: 0.4 (40% growth)
- Increase to allow more substantial additions

### Change Token Budget
Edit `config.json` → `budget.dailyCapUSD`
- Default: $0.25/day
- Current usage: ~$0.05/day (plenty of headroom)

### Add Documentation Target
Edit `config.json` → `documentationTargets`:
```json
"documentationTargets": [
  "Aperture/CLAUDE-APERTURE.md",
  "Aperture/.claude/startup.md",
  "Aperture/.process/COMMON_MISTAKES.md",
  "Aperture/NAVIGATION.md",
  "Aperture/YOUR_NEW_FILE.md"  // Add here
]
```

## Monitoring

**Changelogs**: `knowledge-base/changelogs/YYYY-MM-DD.md`
- What changed, why, token delta

**Audit Trail**: `knowledge-base/audit-trail/YYYY-MM-DD/`
- Full analysis logs, quality scores

**Metrics to Watch**:
- Total doc token count (should decrease or plateau)
- Token delta per integration (negative is good!)
- Source consolidation (fewer duplicate citations)

## Common Adjustments

**"System is too conservative, not making changes"**
→ Lower `minEvidenceScore` thresholds in config.json

**"System is too aggressive, deleting good content"**
→ Raise `minEvidenceScore` for replace mode
→ Increase `minFactPreservation` validation

**"Docs still growing too much"**
→ Lower `maxGrowth` limits
→ Prefer replace mode over merge

**"Need to add new file to update targets"**
→ Edit `documentationTargets` in config.json
→ Rebuild: `npm run build`
→ Test: `npm start`

## Manual Workflow Trigger

```bash
# Via GitHub CLI
gh workflow run autodoc.yml

# Via GitHub UI
Actions → Autonomous Documentation Updates → Run workflow
```

## Cost Analysis

**Typical Run**:
- 20 articles fetched
- 8 relevant (Gemini filtering)
- 2 approved for merge
- 1 actually merged

**Token Usage**:
- Relevance: 8 × 1k = 8k tokens
- Quality: 2 × 4k = 8k tokens
- Integration: 1 × 3k = 3k tokens
- **Total**: ~19k tokens

**Cost**: ~$0.005 (half a penny per run)
**Budget**: $0.25/day = 50x current usage

## Architecture

```
GitHub Actions (daily 09:00 UTC)
  ↓
fetch-sources.ts (RSS + web scraping)
  ↓
filter-relevance.ts (Gemini: 0.7+ relevance)
  ↓
compare-quality.ts (Gemini: integration mode, token delta)
  ↓
generate-integration.ts (Gemini: mode-specific optimization)
  ↓
Validation (config-based rules)
  ↓
git commit + push (if valid)
```

## Success Metrics

**Good**:
- 📉 Total doc tokens decreasing or flat
- 📈 Information density increasing
- ✅ Token delta negative (reductions)
- ✅ Sources consolidated (1 per fact)

**Bad**:
- 📈 Doc size growing >10% per quarter
- ❌ Multiple sources for same fact
- ❌ Outdated version references

## Need Help?

**Where to ask**: Create issue or check NAVIGATION.md for related docs
**Logs**: Check workflow run logs via `gh run view --log`
**Debug**: Set `DEBUG=true` in workflow file
