# Documentation Navigation

**Purpose**: Task-based index for efficient documentation access.

## Quick Links by Task

### Implementation
| Task | Read | Section |
|------|------|---------|
| Starting feature | CLAUDE-APERTURE.md | Tool Design Philosophy |
| Using loops | CLAUDE-APERTURE.md | Loop Pattern with Safeguards |
| Multiple tools | CLAUDE-APERTURE.md | Communication Patterns |
| File operations | CLAUDE-APERTURE.md | Common Patterns |

### Review & Debug
| Task | Read |
|------|------|
| Code review | .process/COMMON_MISTAKES.md |
| Debugging | .process/COMMON_MISTAKES.md |
| Performance | CLAUDE-APERTURE.md → Optimization |

### System Modification
| Task | Read |
|------|------|
| Autonomous docs | scripts/autonomous-docs/FEATURE_GUIDE.md |
| Workflows | .github/workflows/README.md |

## Documentation Structure

```
Aperture/
├── .claude/startup.md       # Auto-read every session
├── CLAUDE.md                # Router (NUDJ vs Aperture)
├── NAVIGATION.md            # This file
├── CLAUDE-APERTURE.md       # Read sections on-demand
├── .process/
│   ├── COMMON_MISTAKES.md   # Anti-patterns
│   └── WHEN_TO_READ.md      # Reading strategy
└── scripts/autonomous-docs/
    └── FEATURE_GUIDE.md     # System documentation
```

## Autonomous Documentation System

**What**: Daily automated optimization using Gemini to analyze AI/Claude articles
**Goal**: Minimal, frontier-quality docs (replaces outdated content, no accumulation)
**Cost**: ~$0.05/day (capped at $0.25)

**Updates**:
- CLAUDE-APERTURE.md sections
- .claude/startup.md best practices
- .process/COMMON_MISTAKES.md anti-patterns
- This file (new sections)

**Integration Modes**:
- **REPLACE**: Supersede obsolete (Claude 3.5 → 4) - achieves token reduction
- **MERGE**: Consolidate complementary info
- **REFACTOR**: Same info, fewer tokens
- **NEW**: Add frontier knowledge

**Review Changes**: `knowledge-base/changelogs/YYYY-MM-DD.md`

## Cross-References

Docs link efficiently to avoid repetition:
- CLAUDE-APERTURE.md → COMMON_MISTAKES.md (anti-patterns)
- CLAUDE-APERTURE.md → FEATURE_GUIDE.md (autonomous system)
- startup.md → WHEN_TO_READ.md (lazy loading strategy)
