# Testing Core Guidelines

> Universal testing rules for all Aperture projects.

## Framework

**Test Runner**: Vitest
**Assertions**: Vitest built-in (`expect`)
**Mocking**: Vitest built-in (`vi.mock`, `vi.fn`)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
```

## File Structure

```
src/
├── components/
│   ├── Button.tsx
│   └── Button.test.tsx          # Co-located
├── lib/
│   ├── utils.ts
│   └── utils.test.ts
```

**Rule**: Tests live next to code, not in separate `/tests` directory.

## Naming Conventions

### Test Files
- Pattern: `[name].test.ts` or `[name].test.tsx`
- Examples: `Button.test.tsx`, `auth.test.ts`, `utils.test.ts`

### Test Descriptions
```typescript
describe('[ComponentName or ModuleName]', () => {
  it('should [expected behavior] when [condition]', () => {
    // ...
  });
});
```

**Examples**:
- ✅ `it('should render children when provided')`
- ✅ `it('should call onClick when button is clicked')`
- ✅ `it('should throw error when input is invalid')`
- ❌ `it('works')` (too vague)
- ❌ `it('test button')` (not descriptive)

## Test Structure: Arrange-Act-Assert

```typescript
it('should calculate total price correctly', () => {
  // Arrange: Set up test data
  const items = [{ price: 10 }, { price: 20 }];

  // Act: Execute the function
  const total = calculateTotal(items);

  // Assert: Verify the result
  expect(total).toBe(30);
});
```

## Mocking Strategy

### When to Mock
- ✅ External APIs (fetch, axios)
- ✅ Database calls (Supabase)
- ✅ Third-party services (Stripe, Gemini)
- ✅ File system operations
- ✅ Time-dependent code (`Date.now()`)

### When NOT to Mock
- ❌ Internal utility functions (test the real code)
- ❌ Simple data transformations
- ❌ Pure functions without side effects

### Mock Syntax

```typescript
// Mock entire module
vi.mock('./api/client', () => ({
  fetchUser: vi.fn(() => Promise.resolve({ id: '1', name: 'Test' })),
}));

// Mock specific function
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Restore mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
```

## Lifecycle Hooks

```typescript
describe('MyComponent', () => {
  // Runs once before all tests in this describe block
  beforeAll(() => {
    // Setup expensive resources
  });

  // Runs before each test
  beforeEach(() => {
    // Clear mocks, reset state
    vi.clearAllMocks();
  });

  // Runs after each test
  afterEach(() => {
    // Cleanup
  });

  // Runs once after all tests
  afterAll(() => {
    // Teardown resources
  });
});
```

## Assertions

### Common Assertions
```typescript
// Equality
expect(value).toBe(5);                    // Strict equality (===)
expect(object).toEqual({ a: 1 });         // Deep equality

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(value).toBeDefined();

// Numbers
expect(value).toBeGreaterThan(3);
expect(value).toBeLessThan(10);
expect(value).toBeCloseTo(0.3, 2);        // Floating point

// Strings
expect(string).toContain('substring');
expect(string).toMatch(/regex/);

// Arrays
expect(array).toHaveLength(3);
expect(array).toContain(item);

// Functions
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(2);
expect(mockFn).toHaveBeenCalledWith(arg1, arg2);

// Errors
expect(() => throwError()).toThrow();
expect(() => throwError()).toThrow('Error message');
```

## Async Testing

```typescript
// Async/await (preferred)
it('should fetch user data', async () => {
  const data = await fetchUser('123');
  expect(data.id).toBe('123');
});

// Promises
it('should resolve with user data', () => {
  return fetchUser('123').then(data => {
    expect(data.id).toBe('123');
  });
});

// Rejections
it('should reject when user not found', async () => {
  await expect(fetchUser('invalid')).rejects.toThrow('User not found');
});
```

## Coverage Targets

| Code Type | Target Coverage |
|-----------|-----------------|
| Critical business logic | 90%+ |
| Complex algorithms | 85%+ |
| API endpoints | 80%+ |
| UI components with state | 80%+ |
| Simple utilities | 70%+ |
| Display-only components | Optional |

**Overall target**: 70-80% (not 100% - diminishing returns)

## Running Tests

```bash
# All tests
npm run test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Specific file
npm run test Button.test.tsx

# Update snapshots (if using)
npm run test -- -u
```

## Test Quality Checklist

Before marking tests complete:

- [ ] Tests are focused (one assertion per `it` block ideally)
- [ ] Tests are isolated (no interdependencies)
- [ ] Mocks are cleared between tests
- [ ] Async operations are properly awaited
- [ ] Error cases are tested
- [ ] Edge cases are covered
- [ ] Tests have descriptive names
- [ ] Tests are fast (< 100ms per test)

## Anti-Patterns

### ❌ Testing Implementation Details
```typescript
// Bad: Coupled to internal state
expect(component.state.count).toBe(1);

// Good: Test user-visible behavior
expect(screen.getByText('Count: 1')).toBeInTheDocument();
```

### ❌ Over-Mocking
```typescript
// Bad: Mocking internal utilities
vi.mock('./utils/format');  // Let it run!

// Good: Mock only external dependencies
vi.mock('./api/client');
```

### ❌ Interdependent Tests
```typescript
// Bad: Tests depend on order
let user;
it('should create user', () => {
  user = createUser();  // Shared state!
});
it('should update user', () => {
  updateUser(user);  // Depends on previous test
});

// Good: Self-contained tests
it('should update user', () => {
  const user = createUser();
  updateUser(user);
});
```

### ❌ Vague Test Names
```typescript
// Bad
it('works');
it('test button');

// Good
it('should disable button when loading is true');
it('should call onSubmit with form data when submitted');
```

---

**Last Updated**: 2025-10-10
**Framework**: Vitest 2.0+
**See Also**: `testing-components.md`, `testing-api.md`
