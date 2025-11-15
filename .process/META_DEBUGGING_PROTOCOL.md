# Meta-Level Debugging Protocol

> **🧭 You are here**: Universal Debugging Principles
>
> **Purpose**: Prevent wasting hours debugging algorithms when inputs are wrong
>
> **When to read**: BEFORE debugging any issue (mandatory)

---

## 🧭 Navigation

**Where to go next**:
- If debugging specific project → `projects/[name]/DEBUGGING.md` (project-specific tips)
- If need logging guidance → `.process/OBSERVABILITY.md`
- If debugging infrastructure → Run `/verify-infra [project]` first
- If continuing work → `NEXT_SESSION.md`

**Related documentation**:
- `DEBUGGING_CHECKLIST.md` - Case study (coordinate scaling bug)
- `.process/OBSERVABILITY.md` - Logging for self-sufficient debugging
- `.process/COMMON_MISTAKES.md` - Learn from past errors

**Referenced by**:
- `START_HERE.md:42` - Read before debugging
- `NEXT_SESSION.md:149` - Mandatory before debugging
- `.claude/startup.md:82` - Step 4 if debugging

---

## The Fundamental Principle

> **"When output doesn't match expectations, verify your inputs match your assumptions BEFORE debugging the transformation logic."**

---

## The Universal Debugging Anti-Pattern

### What Happened (General Case):

1. **Observed**: Output is wrong
2. **Assumed**: Input is correct, therefore algorithm must be broken
3. **Action**: Spent hours debugging/replacing the algorithm
4. **Reality**: Input was wrong all along, algorithm was fine

### The Pattern:

```
Wrong Output → Blame Algorithm → Waste Time
              ↑
              |
    (Never checked if input matches assumptions)
```

### The Correct Pattern:

```
Wrong Output → Verify Input First → Quick Fix
              ↓
              If input correct → Then debug algorithm
```

---

## The Input Verification Protocol

### Before debugging ANY transformation/processing:

#### 1. **State Your Assumptions Explicitly**

Write down what you ASSUME about your inputs:

```javascript
// ❌ BAD - Implicit assumptions
function processData(data) {
  return transform(data);
}

// ✅ GOOD - Explicit assumptions documented
function processData(data) {
  // ASSUMPTIONS:
  // - data is an array of objects
  // - each object has {x: number, y: number}
  // - x and y are in pixels
  // - coordinates are relative to 1920x1080 reference frame
  // - origin is top-left

  return transform(data);
}
```

#### 2. **Validate Assumptions as First Step**

```javascript
// ✅ VALIDATE FIRST
function processData(data, metadata) {
  // STEP 1: Verify assumptions
  console.log('═══ INPUT VALIDATION ═══');
  console.log('Data type:', typeof data, Array.isArray(data) ? `[${data.length}]` : '');
  console.log('Expected format:', metadata.expectedFormat);
  console.log('Actual format:', detectFormat(data));

  if (metadata.expectedFormat !== detectFormat(data)) {
    throw new Error(`Format mismatch: expected ${metadata.expectedFormat}, got ${detectFormat(data)}`);
  }

  // STEP 2: Now safe to process
  return transform(data);
}
```

#### 3. **The 5 Critical Input Questions**

Before debugging logic, answer these:

1. **What format do I THINK the input is in?**
   - Write it down explicitly
   - Example: "Array of {x, y} objects where x,y are pixels"

2. **What format is the input ACTUALLY in?**
   - Log it and inspect it
   - Don't assume - verify

3. **Are there any implicit transformations/scaling?**
   - Was data processed before I received it?
   - Are there unit conversions happening?
   - Is there caching/memoization that might be stale?

4. **Am I looking at the SAME data the previous step produced?**
   - Is there a pipeline? Did something change the data?
   - Are there multiple versions/copies?

5. **What are the units and coordinate systems?**
   - Pixels? Percentages? Normalized?
   - Origin at top-left? center? bottom-left?
   - Which axis is which?

---

## The Universal Debugging Checklist

### When Something Doesn't Work:

#### Phase 1: Input Verification (DO THIS FIRST - 5 minutes)

```javascript
// ✅ ALWAYS START HERE
console.log('═══ DEBUG: INPUT VERIFICATION ═══');

// 1. What did I receive?
console.log('Input type:', typeof input);
console.log('Input value:', JSON.stringify(input, null, 2));

// 2. What did I expect?
console.log('Expected type:', 'YourExpectedType');
console.log('Expected structure:', {/* your assumption */});

// 3. Do they match?
const match = verifyMatch(input, expected);
console.log('Match:', match ? '✅' : '❌');

if (!match) {
  console.error('⚠️  INPUT MISMATCH - FIX THIS FIRST');
  console.error('Differences:', findDifferences(input, expected));
  throw new Error('Input does not match expectations');
}
```

#### Phase 2: Pipeline Verification

```javascript
// ✅ Verify the data pipeline
console.log('═══ DEBUG: PIPELINE TRACE ═══');

// Where did this data come from?
console.log('Source:', dataSource);

// Has it been transformed?
console.log('Transformations applied:', transformHistory);

// Am I using the right version?
console.log('Data version:', dataVersion);
console.log('Expected version:', expectedVersion);
```

#### Phase 3: Only Now Debug the Algorithm

```javascript
// ✅ Only after verifying inputs
console.log('═══ DEBUG: ALGORITHM ═══');
// Now debug your logic...
```

---

## Red Flags That Mean "Check Inputs First"

🚩 **"It worked before"** → Something about the input changed
🚩 **"The math is perfect"** → Probably applying perfect math to wrong input
🚩 **"The algorithm is simple"** → Simple algorithms don't fail mysteriously
🚩 **"I tested the function in isolation"** → Real input differs from test input
🚩 **"The logs show it should work"** → Logs might be showing wrong data
🚩 **"It's only off by a constant factor"** → Scaling/unit conversion issue
🚩 **"It's off by exactly 2x/4x/etc"** → Almost always a scaling mismatch

---

## The "Explain It To A Duck" Test

Before spending >15 minutes debugging:

1. **State out loud**: "I am passing X into function Y"
2. **Verify**: Print X and confirm it matches what you just said
3. **Ask**: "Does X have all the properties I expect?"
4. **Check**: "Is X in the format Y expects?"

If you can't confidently answer "yes" to all of these, **stop debugging the algorithm** and fix the input mismatch.

---

## The 80/20 Rule of Debugging

**80% of mysterious bugs that "shouldn't happen" are caused by:**
1. Input format mismatch (wrong type, wrong structure, wrong units)
2. Stale/cached data (using old data)
3. Pipeline issues (data transformed unexpectedly)
4. Version mismatch (input format changed, code didn't)

**20% are actual algorithm bugs.**

**Therefore: Spend 80% of debugging time verifying inputs, not rewriting algorithms.**

---

## Production Code Template

### Every function that processes external data should follow this pattern:

```javascript
export function processData(input, options) {
  // ═══ PHASE 1: INPUT VALIDATION (REQUIRED) ═══
  if (process.env.NODE_ENV !== 'production' || options.debug) {
    console.log('═══ INPUT VALIDATION ═══');
    console.log('Input:', JSON.stringify(input).slice(0, 200));
    console.log('Expected:', options.expectedFormat);

    // Validate structure
    const validation = validate(input, options.expectedFormat);
    if (!validation.valid) {
      throw new Error(`Input validation failed: ${validation.errors.join(', ')}`);
    }
  }

  // ═══ PHASE 2: TRANSFORMATION ═══
  try {
    const result = transform(input);

    // Validate output
    if (process.env.NODE_ENV !== 'production' || options.debug) {
      console.log('Output:', JSON.stringify(result).slice(0, 200));
    }

    return result;
  } catch (error) {
    // Log full context for debugging
    console.error('Transform failed with input:', input);
    throw error;
  }
}
```

---

## The Time-Saving Math

### Scenario: Bug in production

**Without Input Verification First:**
- 5 min: Notice bug
- 60 min: Debug algorithm
- 15 min: Try different approaches
- 10 min: Research alternative libraries
- 30 min: Implement new approach
- 5 min: Realize input was wrong all along
- 2 min: Fix input issue
- **Total: 127 minutes**

**With Input Verification First:**
- 5 min: Notice bug
- 2 min: Add input validation
- 1 min: See input mismatch
- 2 min: Fix input issue
- **Total: 10 minutes**

**Time saved: 117 minutes (91% faster)**

---

## Integration Into Development Process

### Code Review Checklist:

- [ ] Are input assumptions documented?
- [ ] Is there input validation at the entry point?
- [ ] Do error messages include input context?
- [ ] Are there unit tests with wrong input formats?

### When Adding New Features:

1. ✅ Document what input format you expect
2. ✅ Add validation that enforces it
3. ✅ Log inputs in debug mode
4. ✅ Add tests for wrong input formats

### When Debugging:

1. ✅ Verify inputs FIRST (5 min hard limit)
2. ✅ Only after verification, debug logic
3. ✅ If stuck >15 min, re-verify inputs again

---

## Key Mantras

> **"Garbage in, garbage out - check the garbage first."**

> **"Perfect algorithm + wrong input = wrong output."**

> **"The bug is usually in what you're not checking."**

> **"Assumptions are bugs waiting to happen."**

> **"If it takes >15 minutes to debug, you're probably debugging the wrong thing."**

---

## Case Study Template

When you find a bug that took too long, document it:

```markdown
## Bug: [Name]
**Date**: YYYY-MM-DD
**Time Wasted**: X hours
**Root Cause**: Input assumption violated (be specific)
**Should Have Checked**: (what validation would have caught it)
**Time To Fix Once Found**: X minutes
**Lesson**: (what meta-principle was violated)
```

---

## Summary: The Universal Pattern

```
1. State your assumptions explicitly
2. Validate inputs match assumptions (log/print/verify)
3. Only after validation passes → debug logic
4. If stuck, go back to step 2
```

**This applies to:**
- Coordinates and dimensions
- API responses
- Database queries
- File formats
- User input
- Environment variables
- Configuration
- Dependencies
- Cached data
- Pipeline transformations
- **Everything**

---

*The meta-lesson: Complex debugging is usually simple validation in disguise.*

---

*Last updated: 2025-01-12*
*Origin: Eye alignment coordinate scaling bug (90min wasted on algorithm when input was wrong)*
