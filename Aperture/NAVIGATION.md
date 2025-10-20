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
| Debugging | .process/META_DEBUGGING_PROTOCOL.md |
| Performance | CLAUDE-APERTURE.md → Optimization |
| Quick reference | .process/QUICK_REFERENCE.md |

### System Modification
| Task | Read |
|------|------|
| Autonomous docs | scripts/autonomous-docs/FEATURE_GUIDE.md |
| Workflows | .github/workflows/README.md |

## Documentation Structure

```
Aperture/
├── Root (Navigation)
│   ├── .claude/startup.md       # Auto-read every session (thin orchestrator)
│   ├── CLAUDE.md                # Router (NUDJ vs Aperture)
│   ├── NAVIGATION.md            # This file (task-based index)
│   ├── CLAUDE-APERTURE.md       # Project conventions (read sections on-demand)
│   ├── START_HERE.md            # Onboarding guide
│   ├── NEXT_SESSION.md          # Current status
│   ├── CONTRIBUTING.md          # Contributor guide
│   └── DOCUMENTATION_INDEX.md   # Complete doc map
│
├── .process/ (Methodology)
│   ├── CAPABILITIES.md          # Patterns & how-tos
│   ├── QUICK_REFERENCE.md       # Fast lookup
│   ├── WHEN_TO_READ.md          # Reading strategy
│   ├── COMMON_MISTAKES.md       # Anti-patterns
│   ├── META_DEBUGGING_PROTOCOL.md # Debugging methodology
│   ├── SESSION_CHECKLIST.md     # Session workflow
│   ├── DEBUGGING_CHECKLIST.md   # Debug case study
│   └── [other process docs]
│
├── research/ (Frontier Research)
│   ├── FRONTIER_OPPORTUNITIES_2025.md
│   ├── INSTANT_VISUAL_TEST_GENERATOR_RESEARCH.md
│   ├── GOOGLE_CLOUD_PATTERNS_ANALYSIS.md
│   └── GEMINI_MIGRATION_CHANGES.md
│
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
