# Refactor Code

Apply clean code principles to improve code quality without changing behavior.

## Usage
```
/refactor src/lib/utils.ts
```

## Instructions

1. Read the target file: `$ARGUMENTS`
2. Analyze for refactoring opportunities
3. Apply improvements while preserving behavior
4. Explain changes made

## Refactoring Principles

### 1. Clarity
- [ ] Clear, descriptive names (variables, functions, types)
- [ ] Single Responsibility Principle (each function does one thing)
- [ ] No magic numbers (use named constants)
- [ ] Remove dead code

### 2. Simplicity
- [ ] Reduce nesting (early returns, guard clauses)
- [ ] Extract complex conditions into named functions
- [ ] Break large functions into smaller ones (< 30 lines ideal)
- [ ] DRY - eliminate duplication

### 3. Type Safety
- [ ] Replace `any` with proper types
- [ ] Add missing type annotations
- [ ] Use discriminated unions for related types
- [ ] Leverage TypeScript's type narrowing

### 4. Modern Patterns
- [ ] Use optional chaining (`?.`) and nullish coalescing (`??`)
- [ ] Prefer `const` over `let`, avoid `var`
- [ ] Use destructuring for cleaner code
- [ ] Use template literals over string concatenation

### 5. Performance
- [ ] Memoize expensive computations
- [ ] Avoid unnecessary re-renders (React)
- [ ] Use appropriate data structures
- [ ] Cache results when beneficial

## What NOT to Change
- ❌ Don't alter the public API (function signatures used elsewhere)
- ❌ Don't change behavior (this is refactoring, not fixing bugs)
- ❌ Don't optimize prematurely (only if profiled bottleneck)
- ❌ Don't add features (pure cleanup only)

## Output Format

```markdown
## Refactoring Summary

### Changes Made

1. **[Change Category]**
   - Before: [Code snippet or description]
   - After: [Improved code]
   - Benefit: [Why this is better]

2. **[Next change]**
   ...

### Metrics
- Lines of code: [Before] → [After]
- Cyclomatic complexity: [Before] → [After]
- Type coverage: [Before] → [After]

### Tests Status
- [ ] All existing tests pass
- [ ] No behavior changes
- [ ] Consider adding tests for edge cases (if any found)
```

## Example Refactorings

### Before: Magic Numbers
```typescript
if (user.age < 18) {
  return 'minor';
}
```

### After: Named Constants
```typescript
const ADULT_AGE = 18;
if (user.age < ADULT_AGE) {
  return 'minor';
}
```

### Before: Deep Nesting
```typescript
function process(data) {
  if (data) {
    if (data.items) {
      if (data.items.length > 0) {
        return data.items.map(item => item.value);
      }
    }
  }
  return [];
}
```

### After: Guard Clauses
```typescript
function process(data) {
  if (!data?.items?.length) return [];
  return data.items.map(item => item.value);
}
```

---

Now refactor: `$ARGUMENTS`
