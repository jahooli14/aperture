# Wizard of Oz - Project Summary

## 📋 What We Built

A **baby growth photo alignment app** that:
1. Takes daily photos of your newborn
2. Automatically detects and aligns eyes using AI
3. Creates a seamless timelapse showing growth over time

## 🏗️ Architecture Overview

```
┌─────────────┐
│   Frontend  │  React + Vite + TypeScript
│  (Vercel)   │  Tailwind + Framer Motion + Zustand
└──────┬──────┘
       │
       ├─────────────────────────────────┐
       │                                 │
┌──────▼──────┐                   ┌─────▼──────┐
│   Supabase  │                   │   Vercel   │
│             │                   │  Functions │
│ • Auth      │                   │            │
│ • Database  │◄──────────────────┤ • detect-  │
│ • Storage   │                   │   eyes.ts  │
│             │                   │ • align-   │
│             │                   │   photo.ts │
└─────────────┘                   └─────┬──────┘
                                        │
                                  ┌─────▼──────┐
                                  │   Gemini   │
                                  │  2.0 Flash │
                                  │    API     │
                                  └────────────┘
```

## 📁 File Structure

```
Aperture/
├── src/
│   ├── components/
│   │   ├── AuthForm.tsx          # Email magic link auth UI
│   │   ├── UploadPhoto.tsx       # Daily photo upload + preview
│   │   └── PhotoGallery.tsx      # Timeline grid with aligned photos
│   │
│   ├── stores/
│   │   ├── useAuthStore.ts       # Zustand: Auth state & methods
│   │   └── usePhotoStore.ts      # Zustand: Photo CRUD & upload
│   │
│   ├── lib/
│   │   └── supabase.ts           # Supabase client initialization
│   │
│   ├── types/
│   │   └── database.ts           # TypeScript types for Supabase
│   │
│   ├── App.tsx                   # Main app with routing logic
│   ├── main.tsx                  # React entry point
│   └── index.css                 # Tailwind imports
│
├── api/
│   ├── detect-eyes.ts            # Gemini API: Eye detection
│   └── align-photo.ts            # Sharp: Image alignment
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql # Database schema
│
├── .env.example                  # Environment variable template
├── vercel.json                   # Vercel deployment config
├── README.md                     # Full documentation
├── SETUP.md                      # Quick setup guide
└── PROJECT_SUMMARY.md            # This file
```

## 🔧 Tech Stack Details

### Frontend Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `react` | 19.1.1 | UI framework |
| `react-dom` | 19.1.1 | React rendering |
| `@supabase/supabase-js` | 2.75.0 | Supabase client |
| `framer-motion` | 12.23.22 | Animations |
| `zustand` | 5.0.8 | State management |
| `tailwindcss` | 4.1.14 | CSS framework |

### Backend Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `@google/generative-ai` | 0.24.1 | Gemini API client |
| `sharp` | 0.34.4 | Image processing |
| `@vercel/node` | 5.3.26 | Vercel runtime types |

### Dev Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | 7.1.7 | Build tool |
| `typescript` | 5.9.3 | Type safety |
| `@vitejs/plugin-react` | 5.0.4 | React support |
| `eslint` | 9.36.0 | Linting |

## 🗄️ Database Schema

### `photos` table
```sql
id                 UUID         Primary key
user_id            UUID         References auth.users
upload_date        DATE         Unique per user
original_url       TEXT         Supabase Storage URL
aligned_url        TEXT         Processed photo URL
eye_coordinates    JSONB        {leftEye, rightEye, confidence}
alignment_transform JSONB       {translateX, translateY, rotation, scale}
metadata           JSONB        Additional data
created_at         TIMESTAMPTZ  Auto timestamp
```

### `user_settings` table
```sql
user_id            UUID         Primary key
target_eye_position JSONB       {x: 0.5, y: 0.4}
reminder_time      TIME         Daily reminder time
timezone           TEXT         User timezone
created_at         TIMESTAMPTZ  Auto timestamp
updated_at         TIMESTAMPTZ  Auto timestamp
```

### Storage Buckets
- **originals/**: Raw uploaded photos (`{user_id}/{timestamp}.jpg`)
- **aligned/**: Processed aligned photos (`{user_id}/{photo_id}-aligned.jpg`)
- **videos/**: Generated timelapse videos (future)

## 🔄 Data Flow

### Upload & Alignment Process

1. **User Action**: Upload photo via `UploadPhoto.tsx`
   ```typescript
   uploadPhoto(file) → Supabase Storage (originals/)
   ```

2. **Database Insert**: Create photo record
   ```sql
   INSERT INTO photos (user_id, upload_date, original_url)
   ```

3. **Eye Detection**: Call Gemini API
   ```typescript
   POST /api/detect-eyes
   → Gemini 2.0 Flash analyzes image
   → Returns {leftEye, rightEye, confidence, imageWidth, imageHeight}
   → UPDATE photos SET eye_coordinates = ...
   ```

4. **Alignment**: Process image with Sharp
   ```typescript
   POST /api/align-photo
   → Calculate rotation angle (level eyes)
   → Calculate translation (center eyes at 50%, 40%)
   → Rotate image with Sharp
   → Crop to 1080x1080 square
   → Upload to Supabase Storage (aligned/)
   → UPDATE photos SET aligned_url = ..., alignment_transform = ...
   ```

5. **UI Update**: Gallery refreshes via Zustand
   ```typescript
   fetchPhotos() → Display aligned photo in timeline
   ```

## 🎨 UI/UX Features

### Authentication Flow
- **Magic link**: Passwordless email authentication
- **Session management**: Auto-restores on page refresh
- **Sign out**: Clear session and return to login

### Upload Interface
- **Camera integration**: Mobile-first with `capture="environment"`
- **File selection**: Fallback for gallery uploads
- **Preview**: Show image before confirming upload
- **Daily limit**: One photo per day validation
- **Upload status**: Loading state with progress feedback

### Gallery View
- **Responsive grid**: 2/3/4 columns based on screen size
- **Hover effects**: Date overlay + eye position indicators
- **Processing status**: "Processing..." vs "✓ Aligned"
- **Eye visualization**: Green dots show detected eye positions
- **Smooth animations**: Stagger entrance with Framer Motion

## 🚀 Deployment Checklist

### Supabase Setup
- [ ] Create project
- [ ] Run SQL migration
- [ ] Create storage buckets (originals, aligned, videos)
- [ ] Configure RLS policies
- [ ] Get API credentials

### Gemini API
- [ ] Create API key at ai.google.dev
- [ ] Copy key to environment variables

### Vercel Deployment
- [ ] Push code to GitHub
- [ ] Import repository to Vercel
- [ ] Add environment variables
- [ ] Deploy and test

### Environment Variables Required
```env
VITE_SUPABASE_URL              # Public
VITE_SUPABASE_ANON_KEY         # Public
SUPABASE_SERVICE_ROLE_KEY      # Secret
GEMINI_API_KEY                 # Secret
```

## 💰 Cost Breakdown

### Development (Free Tiers)
- **Supabase**: 500MB storage, 2GB bandwidth, unlimited API requests
- **Vercel**: 100GB bandwidth, 100 serverless function executions/day
- **Gemini**: Free tier (60 requests/minute)

### Production (Estimated Annual Cost)
- **Gemini API**: $0.0001/photo × 365 days = **$0.04/year**
- **Supabase**: Free tier sufficient for single user
- **Vercel**: Free tier sufficient (unless viral traffic)

**Total**: **~$0/year** on free tiers for personal use

## 🔮 Future Enhancements

### Phase 1: Video Generation
- [ ] FFmpeg integration (serverless)
- [ ] Timelapse video at 12fps
- [ ] Download as MP4
- [ ] Date overlays

### Phase 2: Automation
- [ ] Vercel Cron for daily reminders
- [ ] Email notifications for missed uploads
- [ ] Weekly progress reports

### Phase 3: Advanced Features
- [ ] Multi-child support
- [ ] Smile/milestone detection (Gemini)
- [ ] Custom alignment positions
- [ ] Social sharing (Twitter, Instagram)
- [ ] Export as GIF
- [ ] Mobile app (React Native)

### Phase 4: Analytics
- [ ] Growth metrics dashboard
- [ ] Streak tracking
- [ ] Photo quality scores
- [ ] Monthly summaries

## 🐛 Known Limitations

1. **Gemini API latency**: ~3-5 seconds for eye detection
2. **Sharp processing**: ~2-3 seconds for alignment
3. **Storage costs**: Will scale with photo count (500MB free tier = ~1000 photos)
4. **Browser support**: Camera capture requires HTTPS in production
5. **Offline support**: None (requires internet for uploads)

## 📊 Performance Targets

- **Initial page load**: < 2 seconds
- **Photo upload**: < 10 seconds (including processing)
- **Gallery load**: < 1 second for 100 photos
- **Eye detection accuracy**: > 95% with good lighting
- **Alignment precision**: ± 5 pixels for eye center

## 🔒 Security Considerations

- **Row Level Security**: Users can only access own photos
- **Storage policies**: Enforce user_id in file paths
- **Service role key**: Only used server-side (Vercel Functions)
- **CORS**: Supabase auto-configures for Vercel domains
- **Rate limiting**: Gemini API has built-in limits

## 📝 Code Quality

- **TypeScript**: Strict mode enabled, no `any` types
- **ESLint**: Configured with React rules
- **File size**: All components < 200 lines
- **State management**: Centralized in Zustand stores
- **Error handling**: Try/catch with user-friendly messages

## 🎯 Success Metrics

- [ ] User can sign up and upload first photo in < 5 minutes
- [ ] 95%+ eye detection success rate
- [ ] Photos align within ± 10 pixels of target
- [ ] Gallery loads smoothly with 100+ photos
- [ ] Zero data loss (Supabase backup)

---

**Built with**: React, TypeScript, Vite, Supabase, Gemini AI, Sharp, Vercel

**License**: MIT

**Started**: October 2025

**Status**: ✅ MVP Complete - Ready for deployment
