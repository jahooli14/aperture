# Wizard of Oz 🪄

A baby growth photo alignment app that automatically aligns your newborn's eyes in daily photos, creating a seamless timelapse showing how they grow over time.

## 🚨 DEBUGGING? READ THIS FIRST

**Before debugging any issue in this project:**
1. Read `DEBUGGING.md` in this directory (2 min)
2. Read `/META_DEBUGGING_PROTOCOL.md` in repo root (5 min)

**Why?** Following the protocol saves 90+ minutes of wasted debugging time.

## Features

- 📸 **Daily Photo Capture** - Upload or take a photo each day
- 👁️ **Automatic Eye Detection** - Powered by MediaPipe (client-side, privacy-first)
- 🎯 **Perfect Alignment** - Eyes stay centered frame-to-frame for smooth timelapse
- 📊 **Growth Timeline** - Visual gallery of aligned photos
- 🔒 **100% Private** - All processing happens in your browser, photos never sent to external APIs
- 📱 **Mobile-First** - Optimized for daily phone uploads
- ⚡ **Blazing Fast** - Client-side alignment using Canvas API (no server wait)

## Tech Stack

### Frontend
- **React 19** with **TypeScript**
- **Vite** for blazing-fast development
- **Tailwind CSS** for styling
- **Framer Motion** for smooth animations
- **Zustand** for state management

### Backend
- **Vercel Functions** (serverless Node.js for API routes)
- **Supabase** (Postgres database + Storage + Auth)
- **MediaPipe Face Landmarker** for eye detection (runs in browser via WebAssembly)
- **Canvas API** for client-side image alignment (no server processing needed)

## Project Structure

```
wizard-of-oz/
├── src/
│   ├── components/          # React components
│   │   ├── AuthForm.tsx     # Magic link authentication
│   │   ├── UploadPhoto.tsx  # Daily photo upload interface
│   │   └── PhotoGallery.tsx # Timeline of aligned photos
│   ├── stores/              # Zustand state management
│   │   ├── useAuthStore.ts  # Authentication state
│   │   └── usePhotoStore.ts # Photos CRUD operations
│   ├── lib/
│   │   └── supabase.ts      # Supabase client
│   ├── types/
│   │   └── database.ts      # TypeScript types for database
│   └── App.tsx              # Main app component
├── api/                     # Vercel serverless functions
│   └── delete-photo.ts      # Photo deletion endpoint
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Database schema
└── vercel.json              # Vercel deployment config
```

## Setup Instructions

### Prerequisites

- Node.js >= 18
- A Supabase account ([supabase.com](https://supabase.com))
- A Vercel account for deployment (optional for local dev)

**Note**: No AI API keys needed! Eye detection runs entirely in the browser using MediaPipe.

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd Aperture
npm install
```

### 2. Supabase Setup

1. **Create a new Supabase project** at [supabase.com](https://supabase.com)

2. **Run the migration**:
   - Go to your Supabase dashboard → SQL Editor
   - Copy the contents of `supabase/migrations/001_initial_schema.sql`
   - Run the SQL

3. **Create storage buckets**:
   - Go to Storage in Supabase dashboard
   - Create three public buckets:
     - `originals` (for uploaded photos)
     - `aligned` (for processed photos)
     - `videos` (for timelapse videos)

4. **Configure storage policies**:
   - For each bucket, add RLS policies:
   ```sql
   -- Allow authenticated users to upload to their own folder
   CREATE POLICY "Users can upload to own folder"
   ON storage.objects FOR INSERT
   WITH CHECK (
     bucket_id = 'originals' AND
     (storage.foldername(name))[1] = auth.uid()::text
   );

   -- Allow users to read their own files
   CREATE POLICY "Users can read own files"
   ON storage.objects FOR SELECT
   USING (
     bucket_id = 'originals' AND
     (storage.foldername(name))[1] = auth.uid()::text
   );
   ```

5. **Get your credentials**:
   - Go to Settings → API
   - Copy `Project URL` and `anon public` key

### 3. Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
# Supabase (required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# For Vercel Functions only (get from Supabase Settings → API)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Run Locally

```bash
# Start development server
npm run dev

# Open http://localhost:5173
```

The app works fully in development mode! Eye detection and alignment happen client-side.

### 5. Deploy to Vercel

1. **Push code to GitHub**

2. **Import project to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository

3. **Add environment variables** in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (for delete-photo API only)

4. **Deploy**! Vercel will automatically build and deploy

## How It Works

### Upload Flow (Client-Side Processing)

1. **User selects photo** → File loaded in browser
2. **MediaPipe detects eyes** → Runs in browser via WebAssembly (~200ms)
3. **Canvas API aligns photo** → Client-side transformation (~100ms)
4. **Aligned photo uploaded** → Single upload to Supabase Storage
5. **Photo record created** → Database row with metadata and eye coordinates
6. **Gallery updates** → User sees aligned photo immediately

### Eye Alignment Algorithm

```typescript
1. Load MediaPipe Face Landmarker model (once per session)
2. Detect 478 facial landmarks including iris centers
3. Calculate eye positions and rotation angle
4. Create 1080x1350 canvas (4:5 aspect ratio)
5. Apply affine transformation:
   - Translate to position eyes at target (33%, 40%) and (67%, 40%)
   - Rotate to level eyes horizontally
   - Scale to match target eye distance
   - Rotate 180° to correct orientation
6. Export as JPEG and upload to Supabase
```

### Cost Estimate

- **MediaPipe**: $0 (runs in browser, no API calls)
- **Supabase**: Free tier (500MB storage, 2GB bandwidth)
- **Vercel**: Free tier (100GB bandwidth)

**Total**: $0 with free tiers! 🎉

## Usage

1. **Sign in** with email magic link
2. **Upload daily photo** (camera or gallery)
3. **Eyes detected automatically** (instant, in browser)
4. **Photo aligned and uploaded** (~1-2 seconds total)
5. **View aligned photo** in gallery immediately
6. **Repeat daily** to build your timelapse

## Future Enhancements

- [ ] **Timelapse video generation** (FFmpeg)
- [ ] **Daily reminder system** (Vercel Cron)
- [ ] **Multi-child support**
- [ ] **Advanced filters** (smile detection, milestones)
- [ ] **Social sharing** (Twitter, Instagram)
- [ ] **Export as GIF/MP4**
- [ ] **Date/milestone overlays**
- [ ] **Mobile app** (React Native)

## Troubleshooting

### "Low confidence eye detection" error
- Ensure good lighting
- Make sure baby's face is clearly visible
- Try to have eyes open and facing camera
- Avoid extreme angles

### Photos not aligning properly
- Ensure good lighting and clear face visibility
- Check browser console for MediaPipe errors
- Try rotating the photo manually before upload if needed

### Upload fails
- Verify Supabase storage buckets exist and are public
- Check storage policies allow authenticated uploads
- Ensure file size is under 10MB

## License

MIT

## Credits

Built with ❤️ for capturing precious moments of your baby's growth journey.

---

**Questions or issues?** Open an issue on GitHub!
