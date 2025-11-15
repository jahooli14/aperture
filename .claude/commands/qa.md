# Code Quality Review

Perform a comprehensive quality assurance review of the specified code.

## Usage
```
/qa src/components/UserProfile.tsx
```

Or for git diff:
```
/qa
```
(Reviews currently staged changes)

## Instructions

1. If `$ARGUMENTS` provided: Read the specified file(s)
2. If no arguments: Run `git diff --staged` to see staged changes
3. Perform multi-dimensional analysis:

### 1. Logic & Correctness
- [ ] Are there any logical errors?
- [ ] Are edge cases handled?
- [ ] Are error conditions properly handled?
- [ ] Are there any race conditions or async issues?

### 2. Security
- [ ] Are inputs validated?
- [ ] Are secrets hardcoded? (API keys, passwords)
- [ ] Are there SQL injection vulnerabilities?
- [ ] Are XSS vulnerabilities present?
- [ ] Is user data sanitized before logging?

### 3. Performance
- [ ] Are there unnecessary re-renders (React)?
- [ ] Are expensive operations memoized?
- [ ] Are there N+1 query issues?
- [ ] Is data fetched efficiently?

### 4. Code Quality
- [ ] Follows project conventions (see CLAUDE.md)?
- [ ] TypeScript types correct (no `any`)?
- [ ] Functions are single-purpose?
- [ ] Code is DRY (Don't Repeat Yourself)?
- [ ] Naming is clear and consistent?

### 5. Testing
- [ ] Are critical paths tested?
- [ ] Are mocks appropriate?
- [ ] Are tests actually testing behavior (not implementation)?

### 6. Documentation
- [ ] Are complex functions documented?
- [ ] Are README/docs updated if needed?
- [ ] Are breaking changes noted?

## Output Format

```markdown
## Code Quality Review

### ✅ Strengths
- [What's done well]

### ⚠️ Issues Found

#### 🔴 Critical (Must Fix)
- **[Issue]**: [Description]
  - Location: [File:Line]
  - Fix: [Suggested fix]

#### 🟡 Moderate (Should Fix)
- **[Issue]**: [Description]

#### 🟢 Minor (Nice to Have)
- **[Issue]**: [Description]

### 💡 Suggestions
- [Improvement suggestion]

### 📊 Metrics
- TypeScript coverage: [Percentage]
- Test coverage: [Percentage]
- Complexity: [High/Medium/Low]
```

## Focus Areas (Based on .process/ARCHITECTURE.md)

- **Start Minimal**: Is this the simplest implementation?
- **Cost/Benefit**: Is complexity justified?
- **Security**: No secrets, input validation, RLS
- **Type Safety**: No `any`, proper TypeScript
- **Testing**: Critical paths covered

---

Now review: `$ARGUMENTS` (or staged changes if no arguments)
