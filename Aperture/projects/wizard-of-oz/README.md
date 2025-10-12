# Wizard of Oz 🪄

A baby growth photo alignment app that automatically aligns your newborn's eyes in daily photos, creating a seamless timelapse showing how they grow over time.

## 🚨 DEBUGGING? READ THIS FIRST

**Before debugging any issue in this project:**
1. Read `DEBUGGING.md` in this directory (2 min)
2. Read `/META_DEBUGGING_PROTOCOL.md` in repo root (5 min)

**Why?** Following the protocol saves 90+ minutes of wasted debugging time.

## Features

- 📸 **Daily Photo Capture** - Upload or take a photo each day
- 👁️ **Automatic Eye Detection** - Powered by Google Gemini 2.0 Flash API
- 🎯 **Perfect Alignment** - Eyes stay centered frame-to-frame for smooth timelapse
- 📊 **Growth Timeline** - Visual gallery of aligned photos
- 🔒 **Secure & Private** - Authentication with Supabase, photos stored securely
- 📱 **Mobile-First** - Optimized for daily phone uploads

## Tech Stack

### Frontend
- **React 19** with **TypeScript**
- **Vite** for blazing-fast development
- **Tailwind CSS** for styling
- **Framer Motion** for smooth animations
- **Zustand** for state management

### Backend
- **Vercel Functions** (serverless Node.js)
- **Supabase** (Postgres database + Storage + Auth)
- **Google Gemini 2.0 Flash** for eye detection
- **Sharp** for image processing

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
│   ├── detect-eyes.ts       # Gemini API integration for eye detection
│   └── align-photo.ts       # Sharp-based photo alignment
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Database schema
└── vercel.json              # Vercel deployment config
```

## Setup Instructions

### Prerequisites

- Node.js >= 18
- A Supabase account ([supabase.com](https://supabase.com))
- A Google AI account with Gemini API access ([ai.google.dev](https://ai.google.dev))
- A Vercel account for deployment (optional for local dev)

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

### 3. Gemini API Setup

1. Go to [Google AI Studio](https://ai.google.dev)
2. Click "Get API key"
3. Create a new API key or use an existing one
4. Copy the API key

### 4. Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Gemini API
GEMINI_API_KEY=your-gemini-api-key

# For Vercel Functions (get from Supabase Settings → API)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 5. Run Locally

```bash
# Start development server
npm run dev

# Open http://localhost:5173
```

**Note**: For API functions to work locally, you need to:
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel dev` instead of `npm run dev`

### 6. Deploy to Vercel

1. **Push code to GitHub**

2. **Import project to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository

3. **Add environment variables** in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`

4. **Deploy**! Vercel will automatically build and deploy

## How It Works

### Upload Flow

1. **User uploads photo** → Stored in Supabase Storage (`originals/`)
2. **Photo record created** → Database row with metadata
3. **Webhook triggers** → `/api/detect-eyes` Vercel function
4. **Gemini analyzes image** → Returns eye coordinates as JSON
5. **Eye coords saved** → Updated in database
6. **Alignment triggered** → `/api/align-photo` function
7. **Sharp processes image** → Rotates, translates, crops to align eyes
8. **Aligned photo saved** → Supabase Storage (`aligned/`)
9. **Gallery updates** → User sees aligned photo in timeline

### Eye Alignment Algorithm

```typescript
1. Detect eye positions (Gemini API)
2. Calculate eye midpoint
3. Calculate rotation angle (level eyes horizontally)
4. Rotate image using Sharp
5. Translate to center eyes at target position (50% width, 40% height)
6. Crop to standard square aspect ratio (1080x1080)
7. Save aligned image
```

### Cost Estimate

- **Gemini API**: ~$0.0001/photo → ~$0.04/year (365 photos)
- **Supabase**: Free tier (500MB storage, 2GB bandwidth)
- **Vercel**: Free tier (100GB bandwidth)

**Total**: ~$0 for first year with free tiers!

## Usage

1. **Sign in** with email magic link
2. **Upload daily photo** (camera or gallery)
3. **Wait for processing** (~5-10 seconds)
4. **View aligned photo** in gallery
5. **Repeat daily** to build your timelapse

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
- Check that eyes are detected correctly (hover over photo in gallery to see green dots)
- Verify Gemini API key is valid
- Check Vercel function logs for errors

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
