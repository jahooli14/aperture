# Testing API Endpoints & Services

> Patterns for testing backend services, API clients, and serverless functions

## API Client Testing

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchUser, createUser } from './api/users';

vi.mock('./lib/supabase');

describe('User API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch user by ID', async () => {
    const mockUser = { id: '123', name: 'John' };
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockUser, error: null }),
        }),
      }),
    });

    const user = await fetchUser('123');

    expect(user).toEqual(mockUser);
    expect(supabase.from).toHaveBeenCalledWith('users');
  });

  it('should throw error when user not found', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Not found' },
          }),
        }),
      }),
    });

    await expect(fetchUser('invalid')).rejects.toThrow('Not found');
  });
});
```

## Vercel Function Testing

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from './api/detect-eyes';

describe('POST /api/detect-eyes', () => {
  let req: Partial<VercelRequest>;
  let res: Partial<VercelResponse>;

  beforeEach(() => {
    req = {
      method: 'POST',
      body: { photoId: '123' },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  it('should return 405 for non-POST methods', async () => {
    req.method = 'GET';

    await handler(req as VercelRequest, res as VercelResponse);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });

  it('should detect eyes and return coordinates', async () => {
    vi.mocked(detectEyes).mockResolvedValue({
      leftEye: { x: 100, y: 150 },
      rightEye: { x: 200, y: 150 },
      confidence: 0.95,
    });

    await handler(req as VercelRequest, res as VercelResponse);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        landmarks: expect.any(Object),
      })
    );
  });
});
```

## Supabase Mocking

```typescript
vi.mock('./lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(),
      })),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        download: vi.fn(),
        getPublicUrl: vi.fn(),
      })),
    },
    auth: {
      signInWithOtp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
  },
}));
```

## External API Mocking

```typescript
// Mock fetch globally
global.fetch = vi.fn();

describe('Gemini API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call Gemini API with correct payload', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ landmarks: { ... } }),
    } as Response);

    await detectEyes(imageBuffer);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('generativelanguage.googleapis.com'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': expect.any(String),
        }),
      })
    );
  });
});
```

---

**See Also**: `testing-core.md`
