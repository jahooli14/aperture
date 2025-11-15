# Generate Unit Tests

Generate comprehensive unit tests for the specified file, following the project's testing guidelines.

## Usage
```
/test src/components/Button.tsx
```

## Instructions

1. Read the target file: `$ARGUMENTS`
2. Read testing guidelines from `knowledge-base/testing/`
3. Generate tests that follow Test-Driven Development principles
4. Use this structure:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Import what you're testing
// Import testing utilities (e.g., React Testing Library)

describe('[ComponentName or FunctionName]', () => {
  // Setup (if needed)
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Happy path tests
  it('should [expected behavior]', () => {
    // Arrange
    // Act
    // Assert
  });

  // Edge cases
  it('should handle [edge case]', () => {
    // ...
  });

  // Error cases
  it('should throw error when [invalid condition]', () => {
    // ...
  });
});
```

## Testing Principles (from TESTING_GUIDE.md)

- **Test behavior, not implementation**: Focus on what the user sees/experiences
- **Use accessible queries**: `getByRole`, `getByLabelText`, `getByText` (in that order)
- **Mock external dependencies**: API calls, Supabase, external services
- **Clear test names**: "should do X when Y"
- **Arrange-Act-Assert pattern**: Setup → Execute → Verify

## File Naming
Save test file as: `[originalFile].test.[ext]`

Example: `Button.tsx` → `Button.test.tsx`

## Coverage Targets
- **Critical business logic**: 90%+
- **Components with state/logic**: 80%+
- **Simple display components**: Optional (test if bugs appear)

---

Now generate tests for: `$ARGUMENTS`
