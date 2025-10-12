# Observability Guide

> **Purpose**: Enable self-sufficient debugging - Claude should never ask users to check external logs.
>
> **Last Updated**: 2025-10-12

---

## Core Principle

**Claude must debug autonomously without requiring users to check Vercel, Supabase, or any external service logs.**

### The Problem

Traditional workflow:
```
Claude: "Can you check the Vercel logs for the align-photo function?"
User: [Switches to browser, finds logs, copies, pastes back]
Claude: "I see the issue, let me fix it"
```

**Issues**:
- User becomes bottleneck
- Breaks flow state
- Slow feedback loop
- User frustration

### The Solution

**Two-Path Strategy**:

1. **Path A (Preferred)**: Programmatic log access via APIs
2. **Path B (Current)**: Comprehensive in-code logging

We use **Path B** until Path A becomes necessary.

---

## Path B: Comprehensive Logging (Current Implementation)

### When to Add Logging

**Mandatory logging for**:
- ✅ All new features (APIs, components, utilities)
- ✅ All bug fixes that required debugging
- ✅ All external integrations (APIs, databases, storage)
- ✅ All async operations (promises, timeouts, retries)

**Optional logging for**:
- Pure utility functions (if they're well-tested)
- Simple UI components (unless they have complex logic)
- Configuration files

### Logging Template

```typescript
export default async function myFeature(req: Request, res: Response) {
  try {
    // 1. ENTRY POINT - Always log function entry
    console.log('=== MY_FEATURE START ===');
    console.log('Request:', {
      method: req.method,
      body: req.body,
      params: req.params,
    });

    // 2. INPUT VALIDATION - Log validation results
    if (!req.body.requiredField) {
      console.error('❌ Validation failed: missing requiredField');
      return res.status(400).json({ error: 'Missing required field' });
    }
    console.log('✅ Validation passed');

    // 3. BUSINESS LOGIC - Log key decision points
    const data = await fetchData(req.body.id);
    console.log('Data fetched:', {
      id: data.id,
      status: data.status,
      hasRequiredFields: !!data.requiredField,
    });

    if (data.status === 'inactive') {
      console.log('⚠️ Data is inactive, applying special handling');
      // Special handling...
    }

    // 4. EXTERNAL CALLS - Log before and after
    console.log('Calling external API:', {
      url: EXTERNAL_API_URL,
      method: 'POST',
      payloadSize: JSON.stringify(payload).length,
    });

    const externalResponse = await fetch(EXTERNAL_API_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    console.log('External API response:', {
      status: externalResponse.status,
      ok: externalResponse.ok,
      statusText: externalResponse.statusText,
    });

    const externalData = await externalResponse.json();
    console.log('External API data:', {
      success: externalData.success,
      dataKeys: Object.keys(externalData),
    });

    // 5. SUCCESS PATH - Log completion
    console.log('✅ MY_FEATURE COMPLETE');
    console.log('Result:', {
      processedCount: results.length,
      totalTime: Date.now() - startTime,
    });

    return res.status(200).json({ success: true, data: results });

  } catch (error) {
    // 6. ERROR PATH - Log with full context
    console.error('❌ MY_FEATURE FAILED');
    console.error('Error:', error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('Context:', {
      requestBody: req.body,
      currentState: data,
      timestamp: new Date().toISOString(),
    });

    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
```

---

## Logging Best Practices

### 1. Use Semantic Prefixes

Visual markers for quick scanning:

| Prefix | Meaning | Example |
|--------|---------|---------|
| `===` | Section marker | `=== ALIGNMENT START ===` |
| `✅` | Success/completion | `✅ Upload successful` |
| `❌` | Error/failure | `❌ Database query failed` |
| `⚠️` | Warning/special case | `⚠️ Using fallback behavior` |
| `🎯` | Important milestone | `🎯 Reached checkpoint 3` |
| `🔄` | Retry/loop | `🔄 Retrying (attempt 2/3)` |
| `📊` | Data/metrics | `📊 Processed 150 items in 2.3s` |

### 2. Structure Your Logs

**Good** (structured, parseable):
```typescript
console.log('Action:', 'photo_upload', {
  userId: user.id,
  fileName: file.name,
  fileSize: file.size,
  mimeType: file.type,
  timestamp: Date.now(),
});
```

**Bad** (unstructured text blob):
```typescript
console.log(`User ${user.id} uploaded ${file.name} which is ${file.size} bytes`);
```

### 3. Log External Calls Comprehensively

**Every external call needs**:
- Request details (URL, method, payload summary)
- Response status (HTTP code, ok/not ok)
- Response data (keys, not full payload)
- Timing information (if relevant)

```typescript
console.log('Calling Gemini API:', {
  model: 'gemini-2.0-flash-exp',
  imageSize: imageBase64.length,
  promptLength: prompt.length,
});

const response = await model.generateContent([prompt, image]);

console.log('Gemini API response:', {
  hasText: !!response.response.text(),
  textLength: response.response.text().length,
  candidates: response.response.candidates?.length || 0,
});
```

### 4. Log Timing for Performance

```typescript
const startTime = Date.now();

// ... do work ...

console.log('Operation timing:', {
  duration: Date.now() - startTime,
  itemsProcessed: items.length,
  avgTimePerItem: (Date.now() - startTime) / items.length,
});
```

### 5. Avoid Logging Sensitive Data

**Never log**:
- Passwords or tokens
- Credit card numbers
- Personal Identifiable Information (PII) in full
- API keys or secrets
- Session IDs or auth cookies

**Safe alternatives**:
```typescript
// Bad
console.log('User credentials:', { email, password });

// Good
console.log('User credentials:', {
  email: email.substring(0, 3) + '***',
  passwordLength: password.length,
  passwordHasSpecialChars: /[!@#$%^&*]/.test(password),
});
```

---

## Logging Lifecycle

### Stage 1: Development
**Goal**: Add comprehensive logging for self-debugging

```typescript
// Add all 6 logging points:
// 1. Entry
// 2. Validation
// 3. Decision points
// 4. External calls
// 5. Success
// 6. Errors
```

### Stage 2: Deploy
**Goal**: Push to production with logs intact

**DO NOT** remove logs before UAT. They are debugging tools, not technical debt.

### Stage 3: Debug (If Needed)
**Goal**: Claude uses logs to identify and fix issues

**Claude should**:
- Check Vercel dashboard for logs
- Analyze log output to identify issue
- Fix code based on logged information
- Redeploy and verify

**Claude should NOT**:
- Ask user to check logs
- Ask user to copy/paste logs
- Make blind guesses without log data

### Stage 4: UAT (User Acceptance Testing)
**Goal**: User validates feature works correctly

**User responsibilities**:
- Test the feature thoroughly
- Report any issues found
- Approve when feature works as expected

### Stage 5: Cleanup
**Goal**: Remove debug logs, keep production logs

**After UAT approval**, clean up logs:

**REMOVE** (debug logs):
```typescript
// Remove verbose step-by-step logs
console.log('Step 1: Validating input');
console.log('Step 2: Fetching data');
console.log('Step 3: Processing');

// Remove intermediate calculations
console.log('Intermediate value:', x);
console.log('Calculated result:', y);
```

**KEEP** (production logs):
```typescript
// Keep error logs
console.error('❌ Feature failed:', error);

// Keep security events
console.log('⚠️ Unauthorized access attempt:', { ip, userId });

// Keep business-critical operations
console.log('Payment processed:', { amount, userId, timestamp });

// Keep performance metrics (if needed)
console.log('Query took:', duration, 'ms');
```

### Stage 6: Redeploy
**Goal**: Deploy production-ready code with minimal logging

Run `npm run build` locally, commit, and push.

---

## Debugging Without Logs

If logs are insufficient, use these techniques:

### 1. Add More Granular Logging
```typescript
// Before: Single log for entire operation
console.log('Processing data');
processData(data);

// After: Log each step
console.log('Step 1: Validating data format');
const valid = validateFormat(data);
console.log('Step 1 result:', { valid, dataKeys: Object.keys(data) });

console.log('Step 2: Transforming data');
const transformed = transformData(data);
console.log('Step 2 result:', { transformedKeys: Object.keys(transformed) });
```

### 2. Add Checkpoint Logging
```typescript
const checkpoint = (name: string, data: any) => {
  console.log(`🎯 CHECKPOINT: ${name}`, {
    timestamp: Date.now(),
    data,
  });
};

checkpoint('after_validation', { isValid, errors });
checkpoint('after_fetch', { recordCount: records.length });
checkpoint('before_external_call', { payload });
```

### 3. Add Request Tracing
```typescript
// Generate unique ID for each request
const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
console.log('=== REQUEST START ===', { requestId });

// Log with ID throughout
console.log('Processing:', { requestId, step: 'validation' });
console.log('External call:', { requestId, api: 'gemini' });
console.log('=== REQUEST END ===', { requestId, duration });
```

---

## Anti-Patterns

### ❌ Don't: Silent Failures
```typescript
// Bad: Errors hidden
try {
  await doSomething();
} catch (error) {
  // Silent - no log
}

// Good: Log all errors
try {
  await doSomething();
} catch (error) {
  console.error('❌ doSomething failed:', error);
  throw error; // Re-throw or handle
}
```

### ❌ Don't: Logging Inside Loops
```typescript
// Bad: Logs 1000 times
for (const item of items) {
  console.log('Processing item:', item); // DON'T DO THIS
  processItem(item);
}

// Good: Log summary
console.log('Processing batch:', { itemCount: items.length });
for (const item of items) {
  processItem(item);
}
console.log('Batch complete:', { processed: items.length });
```

### ❌ Don't: Mixing Logs with Logic
```typescript
// Bad: Log determines behavior
if (console.log('Checking condition') || condition) {
  // This is bad
}

// Good: Separate logs from logic
console.log('Condition check:', { condition });
if (condition) {
  console.log('Condition is true, proceeding');
  // ...
}
```

---

## Path A: Programmatic Log Access - ✅ IMPLEMENTED (2025-10-12)

Vercel API integration enables Claude to fetch logs directly without user intervention.

### Usage

```bash
# Fetch all recent logs
/vercel-logs

# Fetch logs for specific function
/vercel-logs align-photo-v2

# Fetch more logs for thorough debugging
/vercel-logs detect-eyes 200
```

### Implementation

**Files**:
- `.scripts/vercel-logs.sh` - Bash script for Vercel API calls
- `.claude/commands/vercel-logs.md` - Slash command documentation

**How it works**:
1. Authenticates with Vercel API using bearer token
2. Fetches latest deployment ID for project
3. Retrieves runtime logs from deployment
4. Filters by function name (optional)
5. Color-codes output (errors red, success green, warnings yellow)

**Authentication**:
- Token stored in script (secured)
- Project ID: `prj_rkI3NQOI5SfBle7lflFkwFkj0eYd`
- Bearer token authentication

### Log Retention

| Plan | Retention | Use Case |
|------|-----------|----------|
| Hobby | 1 hour | Real-time debugging only |
| Pro | 1 day | Async debugging supported |
| Enterprise | 3 days | Production debugging |

**Current Plan**: Hobby (1-hour retention)
- Sufficient for active debugging sessions
- User reports issue → Claude fetches logs → Fix within 1 hour
- For historical issues (> 1 hour old), comprehensive logging is the fallback

### Example Workflow

```
User: "Photos aren't aligning correctly"
Claude: /vercel-logs align-photo-v2 200
Claude: [Analyzes PREDICTED vs EXPECTED eye positions]
Claude: "Found it - ERROR shows 5px drift due to rotation math. Fixing..."
```

---

## Metrics & Success Criteria

### How to Measure Success

| Metric | Target | Current |
|--------|--------|---------|
| Times Claude asks for logs | 0 per session | TBD |
| Self-sufficient debugging | 100% | TBD |
| UAT pass rate (first try) | > 80% | TBD |
| Log-related redeployments | < 2 per feature | TBD |

### Success Indicators
- ✅ Claude identifies issues from logs without user help
- ✅ All bugs are reproducible via logs
- ✅ UAT passes with minimal iterations
- ✅ Users never need to check external dashboards

### Failure Indicators
- ❌ Claude frequently asks "Can you check the logs?"
- ❌ Multiple redeploys to add missing logs
- ❌ Issues are not reproducible from logs
- ❌ User spends time copy/pasting log data

---

## Examples from Wizard of Oz Project

### Good Example: align-photo-v2.ts

```typescript
console.log('=== ALIGNMENT V2 START ===');
console.log('Photo ID:', photoId);
console.log('Input dimensions:', landmarks.imageWidth, 'x', landmarks.imageHeight);

// ... processing ...

console.log('PREDICTED final eye positions:', {
  left: { x: finalLeftEye.x.toFixed(2), y: finalLeftEye.y.toFixed(2) },
  right: { x: finalRightEye.x.toFixed(2), y: finalRightEye.y.toFixed(2) },
});
console.log('EXPECTED final eye positions:', {
  left: TARGET_LEFT_EYE,
  right: TARGET_RIGHT_EYE,
});
console.log('ERROR (should be ~0):', {
  left: {
    x: (finalLeftEye.x - TARGET_LEFT_EYE.x).toFixed(2),
    y: (finalLeftEye.y - TARGET_LEFT_EYE.y).toFixed(2)
  },
});

console.log('=== ALIGNMENT V2 COMPLETE ===');
```

**Why this is good**:
- Clear section markers (`===`)
- Prediction vs. expected (enables verification)
- Error calculation (identifies algorithm issues)
- Structured data (easy to parse)

---

## Quick Reference

### Logging Checklist

For every new feature, ask:

- [ ] Entry point logged?
- [ ] All decision points logged?
- [ ] All external calls logged (before + after)?
- [ ] All errors logged with context?
- [ ] Success case logged?
- [ ] Semantic prefixes used (`✅`, `❌`, etc.)?
- [ ] No sensitive data logged?
- [ ] Structured format (not just text blobs)?

### When to Clean Up Logs

- [ ] Feature deployed
- [ ] Claude debugged successfully using logs
- [ ] User completed UAT
- [ ] User explicitly approved feature
- [ ] Error logs remain (critical paths)
- [ ] Debug logs removed (verbose steps)
- [ ] Local build tested
- [ ] Redeployed to production

---

**Next Review**: After next feature requiring debugging (evaluate if Path A is needed)
**Related Docs**: `.process/DEVELOPMENT.md`, `SESSION_CHECKLIST.md`, `CONTRIBUTING.md`
