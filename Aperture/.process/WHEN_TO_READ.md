# When to Read What - Meta Guide

**Audience**: Claude (me)
**Purpose**: Optimize documentation reading for token efficiency

## Lazy Loading Principle

**DON'T**:
- ❌ Read all docs at session start
- ❌ Read entire files when you need one section
- ❌ Re-read docs already processed

**DO**:
- ✅ Read specific sections when relevant
- ✅ Read on-demand as tasks require
- ✅ Trust autonomous system keeps docs current

## Session Start (200 tokens max)

1. `.claude/startup.md` - Auto-read by Claude Code
2. Determine NUDJ vs Aperture (check working directory)
3. **STOP** - Wait for user's first message

## First User Message

**Implementation request** → Read CLAUDE-APERTURE.md → Tool Design section
**Bug fix** → Read .process/COMMON_MISTAKES.md
**Code review** → Read .process/COMMON_MISTAKES.md
**Autonomous docs modification** → Read scripts/autonomous-docs/FEATURE_GUIDE.md

## During Implementation

**About to use loops** → Read "Loop Pattern with Safeguards"
**Calling multiple tools** → Read "Communication Patterns"
**File operations** → Read "Common Patterns"
**Git commit** → Read commit guidelines in startup.md

## Autonomous Docs Integration

**Trust the system**:
- Docs auto-update daily with latest best practices
- Outdated content is replaced, not accumulated
- You're always reading optimized, current information
- Don't add caveats like "this might be outdated"

**Modes**:
- **REPLACE**: Obsolete content deleted, new content added (token reduction)
- **MERGE**: Similar concepts consolidated
- **REFACTOR**: Same info, fewer tokens
- **NEW**: Frontier knowledge added

**Navigation**:
- Use NAVIGATION.md for task-based lookup
- Cross-references minimize repetition
- Read what you need, when you need it
