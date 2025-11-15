# Polymath API Review & Improvement Recommendations

**Review Date:** November 10, 2025
**Scope:** All API endpoints in `/api` directory
**Status:** Comprehensive analysis with prioritized recommendations

---

## Executive Summary

The Polymath app has a well-organized API structure with 4 main endpoints covering memories, projects, reading, connections, and analytics. The code is generally clean but has several areas for improvement in error handling, performance, security, and maintainability.

### Key Strengths
✅ Good consolidation of related endpoints
✅ Proper use of Supabase for database operations
✅ Integration with Gemini AI for embeddings and reasoning
✅ Background processing for heavy operations
✅ Retry logic for external API calls

### Critical Issues (P0 - Fix Immediately)
🔴 **Missing authentication checks** - getUserId() doesn't validate user
🔴 **SQL injection risk** - Dynamic query construction in connections.ts
🔴 **API key exposure risk** - No validation of environment variables
🔴 **Rate limiting missing** - No protection against abuse

---

## 1. Architecture & Organization

### Current Structure
```
api/
├── memories.ts       (1153 lines) - Memories, transcription, search, processing
├── projects.ts       (1559 lines) - Projects, suggestions, bedtime, knowledge map
├── reading.ts        (1181 lines) - Articles, RSS feeds, highlights
├── connections.ts    (1191 lines) - Auto-suggest, sparks, threads
├── analytics.ts      (1180 lines) - Patterns, evolution, opportunities
└── lib/
    ├── supabase.ts
    ├── auth.ts
    ├── gemini-embeddings.ts
    ├── gemini-chat.ts
    ├── map-generation.ts
    └── map-suggestions.ts
```

### 🎯 Improvement: Break Down Monolithic Files

**Problem:** Several API files exceed 1000 lines, making them hard to maintain.

**Solution:** Split into domain-specific modules

```typescript
// Example: Split projects.ts into:
api/
├── projects/
│   ├── index.ts              // Main handler (routing only)
│   ├── crud.ts               // GET, POST, PUT, DELETE
│   ├── suggestions.ts        // Project suggestions
│   ├── bedtime.ts           // Bedtime prompts
│   ├── daily-queue.ts       // Daily queue scoring
│   ├── knowledge-map.ts     // Knowledge map
│   └── embeddings.ts        // Embedding generation
```

**Benefits:**
- Easier to navigate and test
- Better code organization
- Clearer responsibilities
- Faster PR reviews

---

## 2. Error Handling & Reliability

### Critical Issues

#### 2.1 Inconsistent Error Responses

**Current Problem:**
```typescript
// Some endpoints return detailed errors
return res.status(500).json({
  error: 'Failed to save article',
  details: error instanceof Error ? error.message : 'Unknown error'
})

// Others return generic errors
return res.status(500).json({ error: 'Internal server error' })
```

**✅ Solution: Standardized Error Handler**

```typescript
// api/lib/error-handler.ts
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: any
  ) {
    super(message)
  }
}

export function handleError(error: unknown, res: VercelResponse) {
  console.error('[API Error]', error)

  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      error: error.message,
      code: error.code,
      details: process.env.NODE_ENV === 'development' ? error.details : undefined
    })
  }

  // Supabase errors
  if (error && typeof error === 'object' && 'code' in error) {
    const dbError = error as any
    return res.status(dbError.status || 500).json({
      error: 'Database error',
      code: dbError.code,
      details: process.env.NODE_ENV === 'development' ? dbError.message : undefined
    })
  }

  // Unknown errors - never expose internal details in production
  return res.status(500).json({
    error: 'Internal server error',
    requestId: generateRequestId() // For debugging
  })
}

// Usage in endpoints:
try {
  // ... API logic
} catch (error) {
  return handleError(error, res)
}
```

#### 2.2 Missing Validation

**Problem:** No input validation on most endpoints

```typescript
// Current code - no validation
const { transcript, body } = req.body
if (!transcript && !body) {
  return res.status(400).json({ error: 'transcript or body required' })
}
```

**✅ Solution: Use Zod for Validation**

```typescript
// api/lib/validators.ts
import { z } from 'zod'

export const CreateMemorySchema = z.object({
  transcript: z.string().min(1).max(10000).optional(),
  body: z.string().min(1).max(10000).optional(),
  source_reference: z.object({
    type: z.enum(['article', 'project', 'url']),
    id: z.string().optional(),
    url: z.string().url().optional()
  }).optional()
}).refine(
  data => data.transcript || data.body,
  { message: 'Either transcript or body is required' }
)

export const CreateProjectSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(['creative', 'technical', 'learning']),
  status: z.enum(['active', 'upcoming', 'dormant', 'completed']).default('active'),
  tags: z.array(z.string()).max(10).optional(),
  estimated_next_step_time: z.number().min(0).max(480).optional()
})

// Usage:
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const data = CreateMemorySchema.parse(req.body)
    // ... proceed with validated data
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      })
    }
    return handleError(error, res)
  }
}
```

#### 2.3 No Timeout Protection

**Problem:** Long-running AI calls can hang requests

**✅ Solution: Add Timeouts**

```typescript
// api/lib/timeout.ts
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new ApiError(408, errorMessage, 'TIMEOUT')), timeoutMs)
  )
  return Promise.race([promise, timeout])
}

// Usage:
const embedding = await withTimeout(
  generateEmbedding(content),
  10000, // 10 second timeout
  'Embedding generation timed out'
)
```

---

## 3. Performance & Scalability

### 3.1 N+1 Query Problem

**Problem:** Multiple database calls in loops

```typescript
// connections.ts - line 892-907
const connections = await Promise.all(
  allConnections.map(async (conn: any) => {
    const relatedItem = await fetchItemByTypeAndId(conn.related_type, conn.related_id)
    // ...
  })
)
```

**✅ Solution: Batch Fetch Items**

```typescript
async function batchFetchItems(items: Array<{ type: string; id: string }>) {
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = []
    acc[item.type].push(item.id)
    return acc
  }, {} as Record<string, string[]>)

  const results = await Promise.all(
    Object.entries(grouped).map(async ([type, ids]) => {
      const table = getTableForType(type)
      const { data } = await supabase
        .from(table)
        .select('*')
        .in('id', ids)
      return { type, items: data || [] }
    })
  )

  // Build lookup map
  const itemMap = new Map<string, any>()
  results.forEach(({ type, items }) => {
    items.forEach(item => itemMap.set(`${type}:${item.id}`, item))
  })

  return itemMap
}
```

### 3.2 Missing Caching

**Problem:** Repeated API calls for same data

**✅ Solution: Add Redis/Memory Cache**

```typescript
// api/lib/cache.ts
import { Redis } from '@upstash/redis'

const redis = process.env.UPSTASH_REDIS_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_URL,
      token: process.env.UPSTASH_REDIS_TOKEN!
    })
  : null

export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 300 // 5 minutes default
): Promise<T> {
  if (!redis) return fetcher() // No cache available

  // Try cache first
  const cached = await redis.get<T>(key)
  if (cached) return cached

  // Fetch and cache
  const data = await fetcher()
  await redis.setex(key, ttl, JSON.stringify(data))
  return data
}

// Usage:
const projects = await cached(
  `user:${userId}:projects:active`,
  () => supabase.from('projects').select('*').eq('user_id', userId).eq('status', 'active'),
  300 // Cache for 5 minutes
)
```

### 3.3 Inefficient Embedding Generation

**Problem:** Sequential embedding generation

**✅ Solution: Already implemented!** ✅

Good work on `batchGenerateEmbeddings` in connections.ts. Consider using this everywhere:

```typescript
// Replace this pattern:
const embeddings = []
for (const item of items) {
  embeddings.push(await generateEmbedding(item.content))
}

// With batch generation:
const embeddings = await batchGenerateEmbeddings(
  items.map(item => item.content)
)
```

---

## 4. Security Issues

### 4.1 CRITICAL: Authentication Not Enforced

**Problem:** getUserId() doesn't validate the user exists

```typescript
// api/lib/auth.ts (current)
export function getUserId(): string {
  return 'user_abc123' // Always returns same ID!
}
```

**✅ Solution: Proper Auth Validation**

```typescript
// api/lib/auth.ts (improved)
import { VercelRequest } from '@vercel/node'

export function getUserId(req: VercelRequest): string {
  // Option 1: JWT token in Authorization header
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const decoded = verifyJWT(token) // Implement JWT verification
    return decoded.userId
  }

  // Option 2: Supabase auth
  const supabaseAuth = req.headers['x-supabase-auth']
  if (supabaseAuth) {
    const user = verifySupabaseAuth(supabaseAuth)
    return user.id
  }

  throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED')
}

export function requireAuth(req: VercelRequest): string {
  const userId = getUserId(req)
  if (!userId) {
    throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED')
  }
  return userId
}
```

### 4.2 SQL Injection Risk

**Problem:** String interpolation in queries

```typescript
// connections.ts:1349 - DANGEROUS!
.or(`and(source_type.eq.${sourceType},source_id.eq.${sourceId},...)`)
```

**✅ Solution: Use Parameterized Queries**

```typescript
// Instead of string interpolation:
const { data } = await supabase
  .from('connections')
  .select('*')
  .eq('source_type', sourceType)
  .eq('source_id', sourceId)
```

### 4.3 Missing Rate Limiting

**Problem:** No protection against abuse

**✅ Solution: Add Rate Limiting**

```typescript
// api/lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!
})

// 10 requests per 10 seconds per IP
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 s')
})

export async function checkRateLimit(identifier: string) {
  const { success, limit, remaining, reset } = await ratelimit.limit(identifier)

  return {
    success,
    headers: {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': reset.toString()
    }
  }
}

// Usage in middleware:
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const identifier = req.headers['x-forwarded-for'] || 'anonymous'
  const { success, headers } = await checkRateLimit(identifier)

  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value)
  })

  if (!success) {
    return res.status(429).json({ error: 'Too many requests' })
  }

  // ... rest of handler
}
```

### 4.4 Environment Variable Validation

**Problem:** No validation of required env vars

**✅ Solution: Validate on Startup**

```typescript
// api/lib/config.ts
import { z } from 'zod'

const ConfigSchema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  UPSTASH_REDIS_URL: z.string().url().optional(),
  UPSTASH_REDIS_TOKEN: z.string().optional()
})

export const config = ConfigSchema.parse({
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  UPSTASH_REDIS_URL: process.env.UPSTASH_REDIS_URL,
  UPSTASH_REDIS_TOKEN: process.env.UPSTASH_REDIS_TOKEN
})

// This will throw on startup if any required var is missing
```

---

## 5. Code Quality & Maintainability

### 5.1 Duplicate Code

**Problem:** Similar patterns repeated across files

**Example:** Embedding generation + connection finding repeated 3 times:
- reading.ts:1025-1180 (generateArticleEmbeddingAndConnect)
- projects.ts:1171-1252 (generateProjectEmbeddingAndConnect)
- memories.ts (embedded in processing)

**✅ Solution: Create Shared Service**

```typescript
// api/lib/embedding-service.ts
interface EmbeddingItem {
  type: 'project' | 'thought' | 'article'
  id: string
  content: string
  userId: string
}

export async function generateAndLinkEmbedding(item: EmbeddingItem) {
  // 1. Generate embedding
  const embedding = await generateEmbedding(item.content)

  // 2. Store embedding
  await storeEmbedding(item.type, item.id, embedding)

  // 3. Find related items
  const candidates = await findSimilarItems(embedding, item.type, item.id, item.userId)

  // 4. Auto-link high similarity (>85%)
  const autoLinked = []
  const suggestions = []

  for (const candidate of candidates) {
    if (candidate.similarity > 0.85) {
      await createConnection(item, candidate)
      autoLinked.push(candidate)
    } else if (candidate.similarity > 0.55) {
      suggestions.push(candidate)
    }
  }

  // 5. Store suggestions
  if (suggestions.length > 0) {
    await storeSuggestions(item, suggestions)
  }

  return { autoLinked: autoLinked.length, suggested: suggestions.length }
}

// Usage:
await generateAndLinkEmbedding({
  type: 'article',
  id: savedArticle.id,
  content: `${article.title}\n\n${article.excerpt}`,
  userId
})
```

### 5.2 Magic Numbers

**Problem:** Hardcoded thresholds throughout code

```typescript
// Various places:
if (similarity > 0.55) // Why 0.55?
if (similarity > 0.85) // Why 0.85?
if (daysSinceActive >= 14 && daysSinceActive <= 30) // Why these numbers?
```

**✅ Solution: Configuration Constants**

```typescript
// api/lib/constants.ts
export const SIMILARITY_THRESHOLDS = {
  AUTO_LINK: 0.85,      // >85% = automatically create connection
  SUGGEST: 0.55,        // 55-85% = suggest to user
  MIN_RELEVANCE: 0.3,   // <30% = ignore
} as const

export const PROJECT_SCORING = {
  HOT_STREAK_DAYS: 2,
  STALENESS_MIN_DAYS: 7,
  STALENESS_MAX_DAYS: 60,
  FRESHNESS_MAX_DAYS: 14,
} as const

export const AI_LIMITS = {
  MAX_EMBEDDING_BATCH_SIZE: 100,
  EMBEDDING_TIMEOUT_MS: 10000,
  REASONING_TIMEOUT_MS: 15000,
  MAX_SUGGESTIONS: 5,
} as const
```

### 5.3 Commented Out Code

**Problem:** Large blocks of unused code

```typescript
// memories.ts:127-169 - Unused repairIncompleteJSON function
/* UNUSED - kept for reference
 * Attempt to repair incomplete JSON from Gemini
 */
```

**✅ Solution: Delete or Move to Documentation**

If you need to keep for reference, document in a separate file or git history is sufficient.

---

## 6. API-Specific Improvements

### 📄 **reading.ts**

#### Issues:
1. ✅ **FIXED**: Now uses markdown format (great fix!)
2. ⚠️ Still missing retry on RSS feed parsing
3. ⚠️ No pagination on article list

#### Recommendations:

```typescript
// Add pagination
if (req.method === 'GET' && !resource) {
  const {
    status,
    limit = 50,
    offset = 0,  // ADD THIS
    sort = 'created_at',  // ADD THIS
    order = 'desc'  // ADD THIS
  } = req.query

  let query = supabase
    .from('reading_queue')
    .select('*', { count: 'exact' })  // Get total count
    .eq('user_id', userId)
    .order(sort, { ascending: order === 'asc' })
    .range(Number(offset), Number(offset) + Number(limit) - 1)

  const { data, error, count } = await query

  return res.status(200).json({
    articles: data || [],
    pagination: {
      total: count,
      limit: Number(limit),
      offset: Number(offset),
      hasMore: count > Number(offset) + Number(limit)
    }
  })
}
```

### 📝 **memories.ts**

#### Issues:
1. ⚠️ `handleCapture` is 238 lines - too long
2. ⚠️ Inline AI processing blocks response
3. ⚠️ No cleanup of old transcription temp files

#### Recommendations:

```typescript
// 1. Return immediately, process async
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST' && capture) {
    // Save basic memory first
    const memory = await createPlaceholderMemory(req.body)

    // Return immediately to client
    res.status(201).json({
      success: true,
      memory,
      message: 'Voice note saved! AI processing in background...'
    })

    // Process in background (fire and forget)
    processMemoryAsync(memory.id).catch(err =>
      console.error('[memories] Background processing failed:', err)
    )
    return
  }
}

// 2. Move AI processing to separate function
async function processMemoryAsync(memoryId: string) {
  const { processMemory } = await import('../lib/process-memory.js')
  await processMemory(memoryId)
}
```

### 🎯 **projects.ts**

#### Issues:
1. ⚠️ Daily queue scoring is recalculated on every request
2. ⚠️ Bedtime prompts logic should be in a cron job
3. ⚠️ Knowledge map generation blocks the request

#### Recommendations:

```typescript
// 1. Cache daily queue for 1 hour
const queue = await cached(
  `daily-queue:${userId}:${new Date().toISOString().split('T')[0]}`,
  async () => {
    const scores = projects.map(p => scoreProject(p, context))
    return selectDailyQueue(scores)
  },
  3600 // 1 hour cache
)

// 2. Move bedtime prompts to cron job
// api/cron/generate-bedtime-prompts.ts
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow from Vercel cron
  if (req.headers['x-vercel-cron'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const users = await getAllActiveUsers()
  for (const user of users) {
    await generateBedtimePrompts(user.id)
  }

  return res.status(200).json({ success: true })
}
```

### 🔗 **connections.ts**

#### Issues:
1. ⚠️ Lazy loading Gemini imports is clever but inconsistent
2. ⚠️ No deduplication check before creating connections
3. ⚠️ `fetchItemByTypeAndId` could use batch fetching

#### Recommendations:

Already covered in N+1 query solution above.

### 📊 **analytics.ts**

#### Issues:
1. ⚠️ Heavy AI processing for synthesis evolution
2. ⚠️ No caching of expensive analytics
3. ⚠️ Timeline patterns recalculated on every request

#### Recommendations:

```typescript
// Cache expensive analytics for 24 hours
const patterns = await cached(
  `timeline-patterns:${userId}`,
  () => getTimelinePatterns(),
  86400 // 24 hours
)

// Add incremental updates instead of full recalculation
const synthesis = await cached(
  `synthesis-evolution:${userId}:${getLatestMemoryTimestamp()}`,
  () => getSynthesisEvolution(),
  43200 // 12 hours
)
```

---

## 7. Testing Recommendations

### Current State
❌ No tests found

### Recommendations

```typescript
// tests/api/reading.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createMocks } from 'node-mocks-http'
import handler from '../api/reading'

describe('Reading API', () => {
  describe('POST /api/reading', () => {
    it('should save a new article', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          url: 'https://example.com/article'
        }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(201)
      expect(res._getJSONData()).toMatchObject({
        success: true,
        article: expect.objectContaining({
          url: 'https://example.com/article'
        })
      })
    })

    it('should reject invalid URLs', async () => {
      const { req, res } = createMocks({
        method: 'POST',
        body: { url: 'not-a-url' }
      })

      await handler(req, res)

      expect(res._getStatusCode()).toBe(400)
    })
  })
})
```

---

## 8. Implementation Priority

### Phase 1: Critical Security (This Week)
- [ ] Fix authentication validation
- [ ] Add rate limiting
- [ ] Fix SQL injection in connections.ts
- [ ] Validate environment variables on startup

### Phase 2: Error Handling (Next Week)
- [ ] Implement standardized error handler
- [ ] Add Zod validation to all endpoints
- [ ] Add timeout protection for AI calls
- [ ] Improve error logging

### Phase 3: Performance (Week 3)
- [ ] Add caching layer (Redis/memory)
- [ ] Fix N+1 queries with batch fetching
- [ ] Add pagination to all list endpoints
- [ ] Optimize embedding generation

### Phase 4: Code Quality (Week 4)
- [ ] Extract shared embedding service
- [ ] Break down monolithic files
- [ ] Remove duplicate code
- [ ] Add comprehensive tests

### Phase 5: Features (Ongoing)
- [ ] Add API documentation (OpenAPI/Swagger)
- [ ] Add request/response logging
- [ ] Add metrics/monitoring
- [ ] Add API versioning

---

## 9. Monitoring & Observability

### Add Health Check Endpoint

```typescript
// api/health.ts
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const checks = {
    database: await checkDatabase(),
    gemini: await checkGemini(),
    redis: await checkRedis()
  }

  const allHealthy = Object.values(checks).every(check => check.healthy)

  return res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  })
}
```

### Add Structured Logging

```typescript
// api/lib/logger.ts
export const logger = {
  info: (message: string, meta?: any) => {
    console.log(JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      ...meta
    }))
  },
  error: (message: string, error: any, meta?: any) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: {
        message: error.message,
        stack: error.stack,
        ...error
      },
      timestamp: new Date().toISOString(),
      ...meta
    }))
  }
}
```

---

## 10. Summary

### Overall Assessment: **B+ (Good, needs security improvements)**

**Strengths:**
- Clean, readable code
- Good use of modern features (async/await, TypeScript)
- Well-organized domain separation
- Good AI integration

**Critical Improvements Needed:**
1. **Security**: Fix authentication and add rate limiting
2. **Error Handling**: Standardize error responses
3. **Performance**: Add caching and fix N+1 queries
4. **Validation**: Add input validation with Zod
5. **Testing**: Add comprehensive tests

**Estimated Effort:**
- Phase 1 (Security): 2-3 days
- Phase 2 (Error Handling): 3-4 days
- Phase 3 (Performance): 5-7 days
- Phase 4 (Code Quality): 7-10 days
- Phase 5 (Features): Ongoing

**ROI Priority:**
1. Security fixes (High risk if not fixed)
2. Error handling (Better debugging and UX)
3. Performance (Better scalability)
4. Code quality (Long-term maintainability)

---

## Questions?

- Need help prioritizing improvements?
- Want detailed implementation examples for any section?
- Need architecture diagrams?

Let me know which areas you'd like to tackle first!
