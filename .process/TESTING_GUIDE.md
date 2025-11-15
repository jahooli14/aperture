# Testing Guide

> **Philosophy**: Start minimal. Test critical paths. Automate only when ROI is proven.

> **🧭 You are here**: Testing strategy and patterns for Aperture projects
>
> **Purpose**: Define what, when, and how to test with Claude
>
> **Last Updated**: 2025-10-13

---

## 🧭 Navigation

**Where to go next**:
- If writing tests now → Use patterns in sections below (Component/API/Utility testing)
- If tests failing repeatedly → See `.process/COMMON_MISTAKES.md` (check for known issues)
- If setting up new project → Use "Tech Stack" and "Test Structure" sections below
- If tests are slowing development → Review "What to Skip Tests" section (avoid over-testing)
- If ready to deploy → See `.process/DEPLOYMENT.md` (includes test checklist)

**Related documentation**:
- `.process/DEVELOPMENT.md` - Local development workflow (when to run tests)
- `.process/CONTINUOUS_IMPROVEMENT.md` - How to learn from test failures
- `knowledge-base/testing/` - Detailed patterns for Claude's `/test` command
- `.process/COMMON_MISTAKES.md` - Known testing pitfalls and solutions

**Referenced by**:
- `.process/DEPLOYMENT.md:306` - Tests pass before deploying
- `.process/CONTINUOUS_IMPROVEMENT.md` - Testing as process improvement tool

---

## Core Principle: Avoid the Testing Agent Anti-Pattern

**Remember**: We previously built a testing system so complex it slowed everything down.

**Today's approach**: Simple, maintainable tests that provide real value.

---

## Testing Strategy

### What to Test (Priority Order)

1. **Critical Business Logic** (MUST test)
   - Authentication flows
   - Payment processing
   - Data mutations that affect user state
   - Security-sensitive operations

2. **Complex Algorithms** (SHOULD test)
   - Data transformations
   - Validation logic
   - State management

3. **UI Components** (TEST when complex)
   - Interactive components with state
   - Forms with validation
   - Components with complex conditional rendering

4. **Simple UI** (DON'T test unless bugs appear)
   - Static display components
   - Basic styling
   - Simple wrappers

### Coverage Target
- **Critical paths**: 90%+
- **Overall**: 70-80% (not 100% - diminishing returns)
- **New code**: 80% minimum

---

## Tech Stack

### Default Testing Setup
```json
{
  "Framework": "Vitest",
  "React Testing": "React Testing Library",
  "Assertions": "Vitest (built-in)",
  "Mocking": "Vitest (built-in vi.mock)"
}
```

### Why These Choices?
- **Vitest**: Fast, Jest-compatible, excellent TypeScript support
- **React Testing Library**: Encourages testing user behavior, not implementation details
- **Minimal dependencies**: Fewer moving parts = less maintenance

---

## Test Structure

### File Organization
```
src/
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx          # Co-located with component
├── lib/
│   ├── utils.ts
│   └── utils.test.ts
└── api/
    ├── auth.ts
    └── auth.test.ts
```

**Rule**: Tests live next to the code they test, not in a separate directory.

### Naming Convention
- Test files: `[name].test.tsx` or `[name].test.ts`
- Test descriptions: Use "should" format
  ```typescript
  describe('Button', () => {
    it('should render children', () => {
      // ...
    });

    it('should call onClick when clicked', () => {
      // ...
    });
  });
  ```

---

## Writing Tests with Claude

### The TDD Workflow (Recommended)

**Step 1: Generate Tests First**
```
"You are in Test-Driven Development mode.
Generate comprehensive unit tests for the UserProfile component.
Tests should fail initially since the implementation doesn't exist yet."
```

**Step 2: Confirm Failure**
```bash
npm run test
# Verify tests fail as expected
```

**Step 3: Implement to Pass**
```
"Write the minimum code to make these tests pass.
IMPORTANT: Do NOT modify the test files."
```

**Step 4: Iterate**
Claude runs tests, adjusts code until all tests pass.

**Step 5: Refactor**
Once tests are green, improve code quality.

### The Constraint: Never Modify Tests
**Always include**: "Do NOT modify the test files."

This prevents the AI from "fixing" tests to match a flawed implementation.

---

## Test Patterns

### 1. Component Testing

```typescript
// Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('should render children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

**Key Principles**:
- Test user-visible behavior, not implementation
- Use `screen` queries (accessible, resilient)
- Mock external dependencies

### 2. API/Service Testing

```typescript
// auth.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from './supabase';
import { signIn, signOut } from './auth';

vi.mock('./supabase');

describe('Authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should sign in with email', async () => {
    const mockResponse = { data: { user: { id: '123' } }, error: null };
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue(mockResponse);

    const result = await signIn('test@example.com');

    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'test@example.com',
      options: expect.any(Object),
    });
    expect(result.user.id).toBe('123');
  });
});
```

**Key Principles**:
- Mock external services (Supabase, APIs)
- Test both success and error cases
- Clear mocks between tests (`beforeEach`)

### 3. Utility/Pure Function Testing

```typescript
// utils.test.ts
import { describe, it, expect } from 'vitest';
import { formatDate, calculateAge } from './utils';

describe('Date utilities', () => {
  describe('formatDate', () => {
    it('should format date in MM/DD/YYYY format', () => {
      const date = new Date('2025-10-10');
      expect(formatDate(date)).toBe('10/10/2025');
    });

    it('should handle invalid dates', () => {
      expect(formatDate(null)).toBe('Invalid date');
    });
  });
});
```

**Key Principles**:
- Test edge cases (null, undefined, empty)
- Group related tests with `describe`
- Pure functions are easiest to test

---

## Mocking Strategies

### External API Calls
```typescript
vi.mock('./api/client', () => ({
  fetchUser: vi.fn(() => Promise.resolve({ id: '1', name: 'Test' })),
}));
```

### React Hooks
```typescript
vi.mock('./hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { id: '123' }, loading: false })),
}));
```

### Supabase Client
```typescript
vi.mock('./lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ data: [], error: null })),
    })),
  },
}));
```

---

## Test Commands

### Running Tests
```bash
# All tests
npm run test

# Watch mode (during development)
npm run test:watch

# Coverage report
npm run test:coverage

# Specific file
npm run test Button.test.tsx
```

### Using the /test Slash Command
```
/test src/components/UserProfile.tsx
```

This generates a test file following project conventions (see `knowledge-base/testing/`).

---

## Test Quality Checklist

Before marking tests as complete:

- [ ] **Covers critical paths** (happy path + error cases)
- [ ] **Uses accessible queries** (`getByRole`, `getByLabelText`)
- [ ] **Tests behavior, not implementation** (avoid testing internal state)
- [ ] **Mocks are reset** between tests (`beforeEach` with `vi.clearAllMocks()`)
- [ ] **Descriptive test names** ("should do X when Y")
- [ ] **Fast** (< 100ms per test ideally)
- [ ] **Isolated** (tests don't depend on each other)

---

## Common Pitfalls

### ❌ Testing Implementation Details
```typescript
// Bad: Testing internal state
expect(component.state.count).toBe(1);

// Good: Testing user-visible behavior
expect(screen.getByText('Count: 1')).toBeInTheDocument();
```

### ❌ Over-Mocking
```typescript
// Bad: Mocking everything
vi.mock('./utils'); // Now you're testing mocks, not real code

// Good: Mock only external dependencies
vi.mock('./api/client'); // External API
// Let internal utils run normally
```

### ❌ Brittle Selectors
```typescript
// Bad: Depends on specific text or structure
screen.getByText('Submit'); // Breaks if text changes to "Save"

// Good: Use accessible roles
screen.getByRole('button', { name: /submit|save/i });
```

---

## When to Skip Tests

It's okay to NOT write tests for:
- One-off scripts or throwaway code
- Pure UI components with no logic (during prototyping)
- Generated code (type definitions, API schemas)
- Configuration files

**Rule**: If removing it would break critical functionality, test it. Otherwise, consider the ROI.

---

## Test Maintenance

### Red Flag: Flaky Tests
If tests occasionally fail without code changes:
1. **Fix immediately** (flaky tests erode trust)
2. Common causes:
   - Async timing issues (use `waitFor` from React Testing Library)
   - Shared state between tests (ensure proper cleanup)
   - Race conditions (mock time with `vi.useFakeTimers`)

### Red Flag: Slow Tests
If test suite takes > 30 seconds:
1. Profile with `npm run test -- --reporter=verbose`
2. Common fixes:
   - Avoid actual API calls (mock them)
   - Use `vi.useFakeTimers()` for time-dependent tests
   - Reduce test data to minimum needed

---

## Advanced: Test-Specific Knowledge Base

The `knowledge-base/testing/` directory contains detailed patterns for Claude:

- `testing-core.md`: Universal rules and setup
- `testing-components.md`: React component patterns
- `testing-api.md`: API endpoint testing
- `testing-hooks.md`: Custom React hooks

When using `/test` command, Claude automatically loads these for context.

---

**Last Updated**: 2025-10-10
**Philosophy**: Test what matters. Keep it simple. High signal, low noise.
