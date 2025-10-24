# Meta Debugging Protocol

> **Universal debugging methodology for all Aperture projects**
>
> **Purpose**: Prevent wasting hours debugging the wrong thing
>
> **Core insight**: 80% of bugs are input/assumption issues, not algorithm issues

---

## Two Core Principles

### Principle 1: Verify Inputs First

**The Problem**: Developers waste hours debugging "perfect" algorithms applied to wrong inputs.

**The Solution**: Always verify your assumptions about the data BEFORE debugging transformation logic.

#### Input Verification Template

```javascript
// ✅ ALWAYS START DEBUGGING WITH THIS
console.log('═══ INPUT VERIFICATION ═══');
console.log('Input:', JSON.stringify(input, null, 2));
console.log('Type:', typeof input, Array.isArray(input) ? '(Array)' : '');
console.log('Keys:', Object.keys(input));
console.log('Expected format:', expectedFormat);
console.log('Actual vs Expected:', {
  expected: expectedFormat,
  actual: describeStructure(input)
});
console.log('═══════════════════════════');
```

#### Common Input Issues

| Issue | Symptom | Check |
|-------|---------|-------|
| **Scaling mismatch** | Off by 2x/4x/etc | Units match? (px vs %, retina vs standard) |
| **Coordinate system** | Upside down, mirrored | Origin location (top-left vs bottom-left) |
| **Data type** | NaN, undefined, null | Type checking, default values |
| **Format mismatch** | Parsing errors | Expected vs actual structure |
| **Timezone/locale** | Off by hours/days | UTC vs local time |

#### Red Flags That Mean "Check Inputs First"

🚩 **"It worked before"** → Something about the input changed
🚩 **"The math is perfect"** → Probably applying perfect math to wrong input
🚩 **"The algorithm is simple"** → Simple algorithms don't fail mysteriously
🚩 **"I tested the function in isolation"** → Real input differs from test input
🚩 **"The logs show it should work"** → Logs might be showing wrong data
🚩 **"It's only off by a constant factor"** → Scaling/unit conversion issue
🚩 **"It's off by exactly 2x/4x/etc"** → Almost always a scaling mismatch

**When you see these: STOP. Go verify inputs.**

---

### Principle 2: Systematic Reduction

> **Source**: [How to Fix Any Bug - Dan Abramov](https://overreacted.io/how-to-fix-any-bug/)
>
> **Core insight**: Treat bug-fixing like "well-founded recursion" - always make the problem smaller and more manageable.

#### The Four-Step Method

##### Step 1: Find a Reproducible Case (Repro)

**Goal**: Get a reliable sequence of steps that demonstrates the bug.

**A good repro**:
- ✅ Runs consistently (works every time)
- ✅ Runs quickly (seconds, not minutes)
- ✅ Shows clear expected vs actual behavior
- ✅ Is minimal (no unnecessary complexity)

**Examples**:

```bash
# ❌ BAD REPRO: Too vague
"Photo alignment sometimes doesn't work"

# ✅ GOOD REPRO: Specific and testable
"When uploading baby-2025-01-15.jpg (1024x768),
eyes are detected at (200, 300) and (400, 300),
but aligned photo shows eyes 50px lower than expected"
```

**Tactics**:
- Use specific test data (exact files, exact inputs)
- Document the environment (browser, OS, network conditions)
- Capture before/after screenshots or data dumps
- Note what success looks like

##### Step 2: Narrow the Repro

**Goal**: Transform the repro to its simplest form while preserving the bug.

**Process**:
1. Run current repro (verify it still fails)
2. Simplify one aspect (smaller file, fewer params, simpler case)
3. Run modified repro
4. **If bug persists**: Keep the simplification
5. **If bug disappears**: Revert and try different simplification
6. Repeat until minimal

**Example progression**:

```
Original: "1000-photo gallery with complex filters fails on page 47"
         ↓
Narrowed: "100-photo gallery fails on page 5"
         ↓
Narrowed: "10-photo gallery fails on page 2"
         ↓
Narrowed: "Pagination fails when offset=10, limit=10"
         ↓
Minimal:  "Array slice(10, 20) returns wrong items when array.length=15"
```

**Key principle**: "Always be making incremental progress"

**Verification questions**:
- Does this repro still capture the core problem?
- Can I demonstrate both "broken" and "working" states?
- Is this simpler than before?

##### Step 3: Remove Everything Else

**Goal**: Strip away all code/components not essential to reproducing the bug.

**Disciplined process**:

```
1. Run repro (verify bug exists)
2. Remove/comment out something
3. Run repro again
4. If bug STILL happens:
   → Commit the removal (wasn't needed)
5. If bug DISAPPEARS:
   → Reset and try smaller removal
6. Repeat until minimal
```

**What to remove** (in order):

1. **External dependencies** (can you repro without DB? without API?)
2. **UI components** (can you repro in console? in test?)
3. **Features** (can you remove auth? validation? error handling?)
4. **Conditional logic** (can you hardcode some paths?)
5. **Abstraction layers** (can you inline functions?)

**Example**:

```typescript
// Original: 200-line component with bug
<PhotoGallery
  photos={photos}
  filters={complexFilters}
  sorting={advancedSort}
  onSelect={handleSelect}
  theme={customTheme}
/>

// After removal: 20-line repro
const photos = [mockPhoto1, mockPhoto2]
const Gallery = () => photos.map(p => <img src={p.url} />)
// Bug: Second image shows first image's URL
```

**Key principle**: "Repeat until it works" (you've removed the bug) or "you hit the minimal repro"

##### Step 4: Find Root Cause

**Goal**: Understand WHY the bug happens, not just WHERE.

**At this point you have**:
- Minimal reproducible case
- No extraneous code
- Clear expected vs actual behavior

**Now investigate**:

1. **Read the minimal code carefully**
   - What does it actually do (vs what you think it does)?
   - What are the implicit assumptions?
   - What are the edge cases?

2. **Trace the data flow**
   - Where does the input come from?
   - How is it transformed?
   - Where does the output go?

3. **Check the boundary conditions**
   - What if input is empty? null? undefined?
   - What if it's very large? very small?
   - What if it's the wrong type?

4. **Look for off-by-one errors**
   - Array indices (0-based vs 1-based)
   - Inclusive vs exclusive bounds
   - Fencepost errors (N items, N+1 boundaries)

5. **Verify your mental model**
   - Add assertions for what you think is true
   - Print intermediate values
   - Check documentation for API behavior

**Root cause checklist**:

```javascript
// ✅ Found root cause when you can answer:
- What assumption was wrong?
- Why does the code behave this way?
- What would prevent this in the future?
- Can I write a test that captures this?
```

**Example root cause analysis**:

```typescript
// BUG: Photos sometimes show wrong image
<img src={photos[currentPage * pageSize]} />

// INVESTIGATION:
// - currentPage starts at 1 (user-facing)
// - Array indices start at 0
// - When currentPage=1, we access photos[10] (wrong!)
// - Should be: photos[(currentPage - 1) * pageSize]

// ROOT CAUSE: Mixed 1-based and 0-based indexing

// FIX:
<img src={photos[(currentPage - 1) * pageSize]} />

// PREVENTION: Use offset/limit pattern instead:
const offset = (currentPage - 1) * pageSize
<img src={photos[offset]} />
```

---

## Complete Debugging Workflow

**When you encounter a bug, follow this exact sequence**:

### Phase 1: Infrastructure & Inputs (10 minutes max)

```bash
# 1. Check infrastructure first
/verify-infra [project-name]

# 2. Check production logs
/vercel-logs [function-name] 20

# 3. Verify database state
.scripts/query-logs.sh [function-name] [limit]

# 4. Verify your input assumptions
console.log('═══ INPUT VERIFICATION ═══', input)
```

**If infrastructure or inputs are wrong → Fix those first**

### Phase 2: Systematic Reduction (variable time)

```bash
# Only start this phase if infrastructure and inputs are correct

# 1. Find repro (5-15 min)
#    - Reliable steps to reproduce
#    - Clear expected vs actual
#    - Minimal complexity

# 2. Narrow repro (10-30 min)
#    - Simplify while preserving bug
#    - Verify after each change
#    - Make incremental progress

# 3. Remove everything else (15-45 min)
#    - Disciplined removal process
#    - Commit when bug persists
#    - Reset when bug disappears

# 4. Find root cause (10-30 min)
#    - Understand the why
#    - Verify mental model
#    - Write test to prevent regression
```

**Total time budget**: 1-2 hours for most bugs

**If you're taking longer**: You're probably debugging the wrong thing. Go back to Phase 1.

---

## Real-World Case Study: Photo Alignment Bug

**Context**: Wizard of Oz project, eyes detected correctly but alignment was wrong.

### ❌ What We Did Wrong (90 minutes wasted)

1. Started debugging alignment algorithm immediately
2. Assumed eye coordinates were correct
3. Spent time optimizing canvas transforms
4. Added complex logging to alignment function
5. Reviewed Canvas API documentation

### ✅ What We Should Have Done (10 minutes)

1. **Verify inputs first**:
   ```javascript
   console.log('Eye coords from DB:', eyeCoords)
   console.log('Image dimensions:', actualImage.width, actualImage.height)
   console.log('DB image dimensions:', dbImageWidth, dbImageHeight)
   // → FOUND: Coordinates stored for 768x1024, actual image is 1536x2048!
   ```

2. **Root cause**: Coordinate scaling mismatch
   - Database stores coordinates for downscaled images (768x1024)
   - Must scale coordinates to match actual image dimensions
   - Simple fix: `scaledX = dbX * (actualWidth / dbWidth)`

### Lessons Learned

🚩 **Red flag we ignored**: "It's off by exactly 2x" → Scaling issue
✅ **Fix**: Always verify input assumptions first
✅ **Prevention**: Document coordinate system in schema

---

## Prevention > Detection

**After fixing a bug**:

### 1. Write a Test

```typescript
// Capture the repro as a test
test('pagination works when offset=10 and array.length=15', () => {
  const photos = Array(15).fill(mockPhoto)
  const page = paginate(photos, { offset: 10, limit: 10 })
  expect(page).toHaveLength(5) // Not 10!
})
```

### 2. Add Assertions

```typescript
// Prevent the same class of bug
function paginate(items, { offset, limit }) {
  console.assert(offset >= 0, 'offset must be non-negative')
  console.assert(offset < items.length, 'offset must be < items.length')
  return items.slice(offset, offset + limit)
}
```

### 3. Document the Gotcha

```typescript
// Warn future developers
/**
 * IMPORTANT: currentPage is 1-based (user-facing)
 * but array indices are 0-based. Always subtract 1.
 */
const offset = (currentPage - 1) * pageSize
```

### 4. Update This Protocol

If you discovered a new class of bug, add it to the relevant section:
- New input issue → Add to "Common Input Issues" table
- New red flag → Add to "Red Flags" section
- New workflow step → Update "Complete Debugging Workflow"

---

## Quick Reference

| Time Spent | Action |
|------------|--------|
| **0-10 min** | Check infrastructure, logs, verify inputs |
| **10-30 min** | Find repro, narrow it down |
| **30-60 min** | Remove extraneous code |
| **60-90 min** | Find root cause, write test |
| **> 90 min** | 🚨 Stop! You're debugging the wrong thing. Go back to input verification. |

---

## Success Metrics

**Good debugging session** (< 30 min):
- ✅ Followed the two-phase workflow
- ✅ Verified infrastructure and inputs first
- ✅ Found minimal repro
- ✅ Understood root cause
- ✅ Wrote test to prevent regression

**Bad debugging session** (> 90 min wasted):
- ❌ Started debugging algorithm immediately
- ❌ Assumed inputs were correct
- ❌ Didn't follow systematic reduction
- ❌ Ignored red flags
- ❌ Fixed symptom, not root cause

---

## Related Documentation

- **Project-specific guides**:
  - `projects/wizard-of-oz/DEBUGGING.md` - Wizard of Oz debugging workflow
  - (Other projects should create similar guides)

- **Process documentation**:
  - `.process/OBSERVABILITY.md` - Logging best practices
  - `.process/COMMON_MISTAKES.md` - Lessons learned

- **External resources**:
  - [How to Fix Any Bug - Dan Abramov](https://overreacted.io/how-to-fix-any-bug/)
  - [Anthropic - Writing Tools for Agents](https://www.anthropic.com/engineering/writing-tools-for-agents)

---

**Last Updated**: 2025-01-21
**Applies To**: All Aperture projects
**Next Review**: When we discover new debugging patterns
