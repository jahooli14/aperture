# Polymath - Development Backlog

> **Purpose**: Consolidated tracking for improvements, fixes, and enhancements
>
> **Last Updated**: 2025-10-24

---

## 🚨 Critical Issues

> Issues that block deployment or cause security/data risks

**Status**: ✅ All resolved (as of Oct 21, 2025)

Historical critical issues (now resolved):
- Security vulnerability with service keys in client code → Fixed
- Row-level security bypasses → Fixed with `fix-rls-public.sql`
- See `.archive/specs/CRITICAL_REVIEW.md` for full audit

---

## 🔥 High Priority

> Important improvements that significantly impact UX or maintainability

### Code Quality

**From IMPROVEMENTS.md** (Oct 21):
- [ ] Fix TODOs in synthesis engine (lib/synthesis.ts:143)
- [ ] Replace 40 console.log statements with proper logging
- [ ] Remove 15 `any` type usages
- [ ] Complete 13 TODO comments (4 unique issues)

### Performance

- [ ] Implement caching for capability extraction
- [ ] Optimize synthesis query (currently scans all suggestions)
- [ ] Add indexes for common queries

### UX Improvements

- [ ] Rating UX enhancements (see RATING_UX.md)
- [ ] Suggestion cadence optimization (see SUGGESTION_CADENCE.md)
- [ ] Improve memory onboarding flow

---

## 📋 Medium Priority

> Quality of life improvements and nice-to-haves

### Features

**From PROJECT_ENHANCEMENTS.md**:
- [ ] Daily actionable queue (see DAILY_ACTIONABLE_QUEUE.md for spec)
- [ ] Memory collision detection
- [ ] Memory tombstones (soft delete)
- [ ] Capability freshness tracking
- [ ] Refresh recipes

**From MEMORY_ENHANCEMENTS.md**:
- [ ] Context windows (time-based memory clustering)
- [ ] User daily context tracking
- [ ] Project-memory dependencies
- [ ] Synthesis constraints

**From CROSS_PILLAR_IMPROVEMENTS.md**:
- [ ] Cross-pillar synthesis enhancements
- [ ] Better capability-interest matching
- [ ] Improved novelty scoring

### Documentation

- [ ] API documentation improvements (see API_SPEC.md)
- [ ] Testing guide expansion (see TESTING_GUIDE.md)
- [ ] Deployment automation (see DEPLOYMENT.md)

---

## 🧪 Testing & Quality

**From TESTING_GUIDE.md**:
- [ ] Add unit tests for synthesis engine
- [ ] Add integration tests for API endpoints
- [ ] Add E2E tests for critical flows

---

## 📁 Source Documents

This backlog consolidates the following files:

**Active References**:
- `IMPROVEMENTS.md` - Code quality analysis (Oct 21)
- `PROJECT_ENHANCEMENTS.md` - Feature backlog (Oct 24)
- `MEMORY_ENHANCEMENTS.md` - Memory system features (Oct 24)
- `CROSS_PILLAR_IMPROVEMENTS.md` - Synthesis improvements (Oct 24)
- `DAILY_ACTIONABLE_QUEUE.md` - Queue feature spec (Oct 24)
- `MEMORY_ONBOARDING_SPEC.md` - Onboarding improvements
- `SUGGESTION_CADENCE.md` - Timing optimization (Oct 22)
- `RATING_UX.md` - Rating interface improvements

**Archived**:
- `.archive/specs/CRITICAL_REVIEW.md` - Security audit (Oct 21, resolved)
- `.archive/specs/QUICK_FIXES.md` - Critical fixes (Oct 21, resolved)
- `.archive/specs/UX_IMPROVEMENTS_STATUS.md` - Historical UX tracking

---

## 📊 Backlog Stats

- **Critical**: 0 open
- **High Priority**: ~20 items
- **Medium Priority**: ~15 items
- **Total**: ~35 backlog items

---

## 🔄 Maintenance

**When adding items**:
1. Add to appropriate priority section
2. Link to detailed spec doc if available
3. Update "Last Updated" date
4. Update backlog stats

**When completing items**:
1. Check off the item
2. Add completion date
3. Move details to CHANGELOG.md
4. Update backlog stats
