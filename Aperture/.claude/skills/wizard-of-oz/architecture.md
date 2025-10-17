# Wizard of Oz - Architecture Deep Dive

## System Architecture

```
┌─────────────┐
│   Browser   │
│  (React UI) │
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌─────────────┐   ┌──────────────┐
│  Supabase   │   │  Gemini AI   │
│  (Storage   │   │ (Eye Detect) │
│  + Database)│   │              │
└─────────────┘   └──────────────┘
       │
       ▼
┌─────────────┐
│   Vercel    │
│  (Hosting)  │
└─────────────┘
```

## Data Flow

### Photo Upload Flow

```
1. User selects photo
   ↓
2. Client-side validation & resize
   ↓
3. Upload to Supabase Storage
   ↓
4. Create database record (status: "processing")
   ↓
5. Call Gemini AI for eye detection
   ↓
6. Update record with coordinates (status: "ready")
   ↓
7. UI updates via real-time subscription
```

### Photo Alignment Flow

```
1. User requests aligned view
   ↓
2. Fetch photos with eye coordinates
   ↓
3. Calculate alignment offsets
   ↓
4. Render using Canvas API
   ↓
5. Apply transformations (translate, scale)
   ↓
6. Generate aligned preview
```

## Database Schema

### photos table

```sql
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  date DATE NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT DEFAULT 'processing',
  eye_left_x FLOAT,
  eye_left_y FLOAT,
  eye_right_x FLOAT,
  eye_right_y FLOAT,
  face_center_x FLOAT,
  face_center_y FLOAT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_photos_user_date ON photos(user_id, date DESC);
CREATE INDEX idx_photos_status ON photos(status);
```

### Row Level Security (RLS)

```sql
-- Users can only see their own photos
CREATE POLICY "Users can view own photos"
  ON photos FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own photos
CREATE POLICY "Users can insert own photos"
  ON photos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own photos
CREATE POLICY "Users can update own photos"
  ON photos FOR UPDATE
  USING (auth.uid() = user_id);
```

## Component Architecture

### Component Hierarchy

```
App.tsx
├── AuthProvider
│   └── Router
│       ├── Calendar
│       │   └── CalendarDay
│       │       └── PhotoPreview
│       ├── Upload
│       │   ├── CameraInput
│       │   └── GalleryInput
│       └── Gallery
│           ├── PhotoGrid
│           │   └── PhotoCard
│           └── PhotoDetail
│               ├── AlignedView
│               └── MetadataPanel
```

### State Management

```typescript
// Zustand store structure
interface PhotoStore {
  photos: Photo[]
  selectedDate: Date
  isUploading: boolean
  error: string | null

  // Actions
  fetchPhotos: (date: Date) => Promise<void>
  uploadPhoto: (file: File) => Promise<void>
  selectDate: (date: Date) => void
  clearError: () => void
}
```

## API Integration

### Supabase Client

```typescript
// Singleton pattern for Supabase client
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Type-safe database queries
export type Photo = Database['public']['Tables']['photos']['Row']
export type PhotoInsert = Database['public']['Tables']['photos']['Insert']
```

### Gemini AI Integration

```typescript
// Eye detection API call
async function detectEyes(imageUrl: string): Promise<EyeCoordinates> {
  const response = await fetch('https://api.gemini.google.com/v1/vision', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GEMINI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      image: { url: imageUrl },
      features: ['FACE_DETECTION']
    })
  })

  const result = await response.json()
  return extractEyeCoordinates(result)
}
```

## Build & Deployment

### Vite Configuration

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'supabase': ['@supabase/supabase-js']
        }
      }
    }
  }
})
```

### Vercel Configuration

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

## Performance Optimizations

### Image Optimization

```typescript
// Client-side image resizing before upload
async function resizeImage(file: File, maxWidth: number, maxHeight: number): Promise<File> {
  const img = await createImageBitmap(file)
  const canvas = document.createElement('canvas')

  // Calculate dimensions maintaining aspect ratio
  let { width, height } = img
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height)
    width *= ratio
    height *= ratio
  }

  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, width, height)

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(new File([blob!], file.name, { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.9)
  })
}
```

### Lazy Loading

```typescript
// React.lazy for code splitting
const Gallery = lazy(() => import('./components/Gallery'))
const Calendar = lazy(() => import('./components/Calendar'))

// Suspense boundaries
<Suspense fallback={<LoadingSpinner />}>
  <Gallery />
</Suspense>
```

### Caching Strategy

```typescript
// React Query configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: false
    }
  }
})
```

## Security Considerations

### Authentication
- Supabase Auth handles user sessions
- JWT tokens stored in httpOnly cookies
- Automatic token refresh

### Authorization
- Row Level Security (RLS) on all tables
- Users can only access their own photos
- API keys never exposed to client

### Data Protection
- HTTPS enforced everywhere
- Supabase Storage with signed URLs
- No sensitive data in URLs or logs

## Monitoring & Debugging

### Error Tracking
```typescript
// Structured error logging
function logError(context: string, error: Error, metadata?: object) {
  console.error(`[${context}] Error:`, {
    message: error.message,
    stack: error.stack,
    ...metadata
  })

  // Could integrate Sentry here
}
```

### Performance Monitoring
```typescript
// Performance marks for key operations
performance.mark('upload-start')
await uploadPhoto(file)
performance.mark('upload-end')
performance.measure('upload-duration', 'upload-start', 'upload-end')
```

## Future Architecture Considerations

### Scalability
- Consider CDN for photo delivery
- Implement image thumbnail generation
- Add server-side rendering for SEO

### Features
- Real-time collaboration (multiple users)
- Video timelapse generation
- Export to social media
- Photo editing tools

### Technical Debt
- Add comprehensive test coverage
- Implement proper error boundaries
- Add analytics tracking
- Improve offline support
