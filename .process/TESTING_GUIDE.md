# Testing Guide

## Run Tests

```bash
npm run test           # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage
```

## Write Tests

```typescript
import { describe, it, expect } from 'vitest'

describe('MyFunction', () => {
  it('should return expected value', () => {
    const result = myFunction(input)
    expect(result).toBe(expected)
  })
})
```

## React Components

```typescript
import { render, screen } from '@testing-library/react'

it('renders correctly', () => {
  render(<MyComponent />)
  expect(screen.getByRole('button')).toBeInTheDocument()
})
```

## Mocking

```typescript
import { vi } from 'vitest'

vi.mock('./api', () => ({
  fetchData: vi.fn(() => Promise.resolve({ data: [] }))
}))
```
