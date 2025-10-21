# Polymath System - Improvement Plan

**Date**: 2025-10-21
**Status**: Post-deployment review

## Executive Summary

After comprehensive gap analysis and deployment fixes, this document outlines systematic improvements to enhance code quality, performance, and maintainability.

## Code Quality Analysis

**Current State**:
- 5,779 total lines of code
- 40 console.log statements across API files
- 15 `any` type usages
- 13 TODO comments (4 unique issues)
- 10 serverless functions deployed

## Priority 1: Critical Improvements (Do First)

### 1.1 Fix TODOs in Synthesis Engine

**Issue**: 4 critical TODOs in lib/synthesis.ts affecting core functionality

**TODOs to Address**:

```typescript
// lib/synthesis.ts:143
// TODO: Fix array comparison in Supabase
async function calculateNovelty(capabilityIds: string[]): Promise<number> {
  // Currently using random score - need proper implementation
  return Math.random() * 0.5 + 0.5
}
```

**Fix**: Implement proper novelty calculation using capability combinations table
- Query `capability_combinations` table
- Check if combination has been penalized
- Calculate based on times_rated_negative and penalty_score

```typescript
// lib/synthesis.ts:182
// TODO: Use actual embeddings when interests have embeddings
async function calculateInterest(capabilityIds: string[], interests: Interest[]): Promise<number> {
  // Currently uses random score
}
```

**Fix**: Use pgvector similarity search
- Generate embedding for capability combination
- Compare against interest embeddings
- Return cosine similarity score

```typescript
// lib/synthesis.ts:372, 412, 472
memoryIds: [], // TODO: Link to inspiring memories
```

**Fix**: Query memories that inspired the suggestion
- Use embedding similarity to find related memories
- Include memory IDs in suggestion metadata
- Display "Inspired by" section in UI

**Impact**: HIGH - Affects suggestion quality and personalization
**Effort**: MEDIUM - Requires database queries and embedding math
**Priority**: 🔴 **CRITICAL**

---

### 1.2 Replace `any` Types with Proper TypeScript

**Issue**: 15 uses of `any` type reduce type safety

**Files to Fix**:
1. `lib/synthesis.ts` - Entity type in reduce function
2. `src/types.ts` - Metadata fields
3. `src/stores/*` - API response types

**Example Fix**:
```typescript
// BEFORE (lib/synthesis.ts:88)
}, {} as Record<string, { entity: any; count: number }>)

// AFTER
interface EntityWithCount {
  entity: {
    id: string
    name: string
    type: string
  }
  count: number
}
}, {} as Record<string, EntityWithCount>)
```

**Impact**: MEDIUM - Prevents runtime errors, improves DX
**Effort**: LOW - Straightforward type annotations
**Priority**: 🟡 **HIGH**

---

### 1.3 Add Input Validation to All API Endpoints

**Issue**: Missing validation allows invalid data

**Current State**:
- Some endpoints have basic validation
- No consistent validation library
- Type coercion could fail silently

**Recommended**: Use Zod for schema validation

**Example Implementation**:
```typescript
// api/suggestions/[id]/rate.ts
import { z } from 'zod'

const RateRequestSchema = z.object({
  rating: z.number().int().min(-1).max(2),
  feedback: z.string().optional()
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const parseResult = RateRequestSchema.safeParse(req.body)

  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid request',
      details: parseResult.error.format()
    })
  }

  const { rating, feedback } = parseResult.data
  // ... rest of handler
}
```

**Files to Update**:
- `api/suggestions/[id]/rate.ts` - Rating validation
- `api/suggestions/[id]/build.ts` - Project data validation
- `api/capture.ts` - Webhook payload validation
- `api/process.ts` - Memory ID validation

**Impact**: HIGH - Prevents bad data, improves error messages
**Effort**: MEDIUM - Need to install Zod, add schemas
**Priority**: 🟡 **HIGH**

---

## Priority 2: Performance Optimizations

### 2.1 Optimize Database Queries

**Issue**: Multiple queries that could be batched or optimized

**Opportunities**:

1. **Batch Interest Updates** (lib/synthesis.ts:108-116)
```typescript
// BEFORE: N queries in loop
for (const interest of interests) {
  await supabase.from('entities').update({ ... }).eq('id', interest.id)
}

// AFTER: Single batch update
await supabase.from('entities')
  .upsert(
    interests.map(i => ({
      id: i.id,
      is_interest: true,
      interest_strength: i.strength
    }))
  )
```

2. **Add Database Indexes**
```sql
-- Speed up synthesis queries
CREATE INDEX IF NOT EXISTS idx_entities_created_at ON entities(created_at);
CREATE INDEX IF NOT EXISTS idx_entities_is_interest ON entities(is_interest) WHERE is_interest = true;
CREATE INDEX IF NOT EXISTS idx_project_suggestions_status ON project_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_project_suggestions_user_total ON project_suggestions(user_id, total_points DESC);
```

3. **Use SELECT Projections**
```typescript
// BEFORE: Fetch all columns
.select('*')

// AFTER: Only fetch what you need
.select('id, title, status, total_points')
```

**Impact**: MEDIUM - Faster API responses
**Effort**: LOW - Quick wins
**Priority**: 🟢 **MEDIUM**

---

### 2.2 Implement Caching

**Issue**: Expensive operations run on every request

**Caching Opportunities**:

1. **Cache Capabilities List** (rarely changes)
```typescript
let capabilitiesCache: { data: Capability[], timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getCapabilities(): Promise<Capability[]> {
  if (capabilitiesCache && Date.now() - capabilitiesCache.timestamp < CACHE_TTL) {
    return capabilitiesCache.data
  }

  const { data } = await supabase.from('capabilities').select('*')
  capabilitiesCache = { data, timestamp: Date.now() }
  return data
}
```

2. **Cache Embeddings** (expensive to generate)
- Store embeddings in database
- Only regenerate when text changes

**Impact**: HIGH - Reduces AI API calls, faster responses
**Effort**: MEDIUM - Need cache invalidation logic
**Priority**: 🟢 **MEDIUM**

---

## Priority 3: Developer Experience

### 3.1 Structured Logging

**Issue**: 40 console.log statements with inconsistent format

**Current**:
```typescript
console.log(`[capture] Received note: ${webhook.id}`)
console.error('[rate] Rating insert error:', ratingError)
```

**Improved**: Use structured logging library (pino)

```typescript
import pino from 'pino'

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
})

// Usage
logger.info({ webhook_id: webhook.id, title: webhook.title }, 'Received note')
logger.error({ error: ratingError, suggestion_id: id }, 'Rating insert failed')
```

**Benefits**:
- Structured logs queryable in Vercel
- Consistent format across all APIs
- Easy to filter by severity
- Production-ready log levels

**Impact**: MEDIUM - Better debugging, production monitoring
**Effort**: LOW - Install pino, replace console.log
**Priority**: 🟢 **MEDIUM**

---

### 3.2 Error Handling Middleware

**Issue**: Inconsistent error handling across endpoints

**Current**: Each endpoint handles errors differently

**Improved**: Centralized error handler

```typescript
// lib/error-handler.ts
export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message)
  }
}

export function handleAPIError(error: unknown, res: VercelResponse) {
  if (error instanceof APIError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code
    })
  }

  logger.error({ error }, 'Unexpected error')
  return res.status(500).json({
    error: 'Internal server error'
  })
}
```

**Usage**:
```typescript
try {
  // ... endpoint logic
} catch (error) {
  return handleAPIError(error, res)
}
```

**Impact**: MEDIUM - Consistent error responses
**Effort**: LOW - Create utility, update endpoints
**Priority**: 🟢 **MEDIUM**

---

### 3.3 API Response Types

**Issue**: Frontend doesn't have type safety for API responses

**Solution**: Shared type definitions

```typescript
// types/api.ts
export interface APIResponse<T> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

export interface SuggestionsResponse {
  suggestions: ProjectSuggestion[]
  total: number
  limit: number
  offset: number
}

export interface SynthesisResponse {
  success: boolean
  suggestions_generated: number
  timestamp: string
}
```

**Usage in Frontend**:
```typescript
// src/stores/useSuggestionStore.ts
const response = await fetch('/api/suggestions')
const data: SuggestionsResponse = await response.json()
// Now TypeScript knows the structure!
```

**Impact**: MEDIUM - Fewer runtime errors in frontend
**Effort**: LOW - Define types, export from API
**Priority**: 🟢 **MEDIUM**

---

## Priority 4: Testing & Quality

### 4.1 Add Unit Tests

**Coverage Targets**:
- `lib/synthesis.ts` - Core synthesis logic (80%+ coverage)
- `lib/process-memory.ts` - Memory processing (80%+ coverage)
- `lib/strengthen-nodes.ts` - Node strengthening (60%+ coverage)

**Example Test**:
```typescript
// lib/__tests__/synthesis.test.ts
import { describe, it, expect, vi } from 'vitest'
import { calculateNovelty } from '../synthesis'

describe('calculateNovelty', () => {
  it('returns higher score for novel combinations', async () => {
    const novel = await calculateNovelty(['cap1', 'cap2', 'cap3'])
    const common = await calculateNovelty(['cap1', 'cap2'])

    expect(novel).toBeGreaterThan(common)
  })

  it('penalizes previously rated negative combinations', async () => {
    // Mock database to return negative ratings
    // Assert lower score
  })
})
```

**Impact**: HIGH - Prevents regressions
**Effort**: HIGH - Need test infrastructure
**Priority**: 🟡 **HIGH** (for core logic)

---

### 4.2 Add Integration Tests

**Test Critical Flows**:

1. **Synthesis Flow**
   - POST /api/cron/weekly-synthesis
   - Verify suggestions created
   - Check database state

2. **Rating Flow**
   - POST /api/suggestions/[id]/rate with rating=1
   - Verify status changes to 'spark'
   - Check capability strength updated

3. **Build Flow**
   - POST /api/suggestions/[id]/build
   - Verify project created
   - Check suggestion status='built'

**Impact**: HIGH - Catch integration issues
**Effort**: MEDIUM - Need test database
**Priority**: 🟡 **HIGH**

---

## Priority 5: Architecture Improvements

### 5.1 Database Migrations System

**Issue**: Manual SQL changes are error-prone

**Solution**: Use migration tool (e.g., dbmate, Prisma)

```bash
# Create migration
dbmate new add_indexes_for_synthesis

# Apply migrations
dbmate up

# Rollback if needed
dbmate down
```

**Benefits**:
- Track schema changes in git
- Reproducible deployments
- Safe rollbacks

**Impact**: MEDIUM - Safer schema changes
**Effort**: MEDIUM - Setup migration tool
**Priority**: 🟢 **MEDIUM**

---

### 5.2 Environment Variable Validation

**Issue**: Missing env vars cause runtime errors

**Solution**: Validate on startup

```typescript
// lib/env.ts
import { z } from 'zod'

const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  USER_ID: z.string().optional(),
  CRON_SECRET: z.string().optional()
})

export const env = EnvSchema.parse(process.env)
```

**Usage**:
```typescript
import { env } from '../lib/env'

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)
```

**Impact**: HIGH - Fail fast with clear errors
**Effort**: LOW - Quick win
**Priority**: 🟡 **HIGH**

---

## Implementation Roadmap

### Phase 1: Quick Wins (1-2 days)
1. ✅ Add environment variable validation
2. ✅ Replace `any` types with proper types
3. ✅ Add input validation to critical endpoints (rate, build)
4. ✅ Add database indexes
5. ✅ Implement error handling middleware

### Phase 2: Core Improvements (3-5 days)
1. Fix TODOs in synthesis engine
   - Implement proper novelty calculation
   - Add interest embedding similarity
   - Link inspiring memories
2. Add structured logging (pino)
3. Optimize database queries (batch updates)

### Phase 3: Testing & Quality (5-7 days)
1. Add unit tests for core lib functions
2. Add integration tests for critical flows
3. Setup CI/CD with test runs

### Phase 4: Advanced Features (Optional)
1. Implement caching layer
2. Add database migration system
3. Create shared API response types
4. Add API rate limiting
5. Performance monitoring

---

## Success Metrics

After implementing improvements, track:

- **Error Rate**: < 1% of API requests fail
- **Response Time**: p95 < 2s for synthesis, p95 < 500ms for reads
- **Test Coverage**: > 70% for lib/, > 50% for api/
- **Type Safety**: 0 `any` types in production code
- **Logs**: Structured JSON logs with correlation IDs

---

## Maintenance Plan

**Weekly**:
- Review error logs in Vercel
- Check slow query logs
- Monitor synthesis success rate

**Monthly**:
- Update dependencies
- Review and close old TODOs
- Optimize database based on usage patterns

**Quarterly**:
- Security audit
- Performance review
- Architecture review

---

**Next Steps**: Proceed with Phase 1 quick wins?
