# Testing React Components

> React-specific testing patterns using React Testing Library

## Setup

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
```

## Query Priority (Use in this order)

1. **getByRole** (most accessible)
2. **getByLabelText** (form inputs)
3. **getByPlaceholderText** (if no label)
4. **getByText** (non-interactive content)
5. **getByTestId** (last resort)

```typescript
// ✅ Good: Accessible queries
const button = screen.getByRole('button', { name: /submit/i });
const input = screen.getByLabelText(/email address/i);

// ❌ Bad: Brittle queries
const button = container.querySelector('.submit-btn');
```

## Component Test Template

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('should render children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    fireEvent.click(screen.getByText('Click'));

    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Click</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

## Testing Patterns

### Forms
```typescript
it('should submit form with valid data', async () => {
  const handleSubmit = vi.fn();
  render(<LoginForm onSubmit={handleSubmit} />);

  fireEvent.change(screen.getByLabelText(/email/i), {
    target: { value: 'test@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: 'password123' },
  });
  fireEvent.click(screen.getByRole('button', { name: /submit/i }));

  await waitFor(() => {
    expect(handleSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });
});
```

### Async Operations
```typescript
it('should display loading state while fetching', async () => {
  render(<UserProfile userId="123" />);

  expect(screen.getByText(/loading/i)).toBeInTheDocument();

  await waitFor(() => {
    expect(screen.getByText(/john doe/i)).toBeInTheDocument();
  });
});
```

### Error States
```typescript
it('should display error when fetch fails', async () => {
  vi.mocked(fetchUser).mockRejectedValue(new Error('Failed to fetch'));

  render(<UserProfile userId="123" />);

  await waitFor(() => {
    expect(screen.getByText(/error loading user/i)).toBeInTheDocument();
  });
});
```

### Conditional Rendering
```typescript
it('should show edit button when user is admin', () => {
  render(<Post isAdmin={true} />);
  expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
});

it('should hide edit button when user is not admin', () => {
  render(<Post isAdmin={false} />);
  expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
});
```

## Mocking Hooks

```typescript
vi.mock('./hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('Dashboard', () => {
  it('should display user name when authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { name: 'John' },
      loading: false,
    });

    render(<Dashboard />);
    expect(screen.getByText(/welcome, john/i)).toBeInTheDocument();
  });
});
```

## Context Providers

```typescript
import { ThemeProvider } from './ThemeContext';

const renderWithTheme = (component) => {
  return render(
    <ThemeProvider value="dark">
      {component}
    </ThemeProvider>
  );
};

it('should apply dark theme styles', () => {
  renderWithTheme(<Button>Click me</Button>);
  const button = screen.getByRole('button');
  expect(button).toHaveClass('dark-theme');
});
```

---

**See Also**: `testing-core.md`, `testing-hooks.md`
