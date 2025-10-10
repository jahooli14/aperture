# Quick Setup Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Supabase

#### Create Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for project to finish provisioning

#### Run Database Migration
1. Go to SQL Editor in Supabase dashboard
2. Copy/paste contents of `supabase/migrations/001_initial_schema.sql`
3. Click "Run"

#### Create Storage Buckets
1. Go to Storage in sidebar
2. Create three **public** buckets:
   - `originals`
   - `aligned`
   - `videos`

#### Add Storage Policies
For each bucket, go to Policies and add:

```sql
-- Allow authenticated users to upload
CREATE POLICY "Users can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'originals' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to read their files
CREATE POLICY "Users can read own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'originals' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

Repeat for `aligned` and `videos` buckets (change `bucket_id`).

#### Get Credentials
1. Go to Settings → API
2. Copy:
   - Project URL
   - `anon` `public` key
   - `service_role` key (under "Service role")

### 3. Get Gemini API Key

1. Go to [ai.google.dev](https://ai.google.dev)
2. Click "Get API key"
3. Create new API key
4. Copy key

### 4. Configure Environment

Create `.env` file:
```bash
cp .env.example .env
```

Fill in your credentials:
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
GEMINI_API_KEY=AIzaSyXXX...
```

### 5. Run Locally

```bash
# Option 1: Frontend only (for UI development)
npm run dev

# Option 2: With API functions (requires Vercel CLI)
npm i -g vercel
vercel dev
```

Open [http://localhost:5173](http://localhost:5173)

## 📦 Deploy to Vercel

### Method 1: GitHub Integration (Recommended)

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "New Project"
4. Import your repository
5. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
6. Click "Deploy"

### Method 2: Vercel CLI

```bash
vercel
# Follow prompts
# Add environment variables when asked
```

## ✅ Verify Setup

### Test Authentication
1. Open app
2. Enter email
3. Check inbox for magic link
4. Click link → should be logged in

### Test Upload
1. Click "Take Photo" or "Choose from Gallery"
2. Select a photo with a clear face
3. Click "Upload"
4. Wait ~10 seconds
5. Photo should appear in gallery with green dots on eyes (hover to see)

## 🐛 Common Issues

### "Missing Supabase environment variables"
- Check `.env` file exists
- Verify variable names match exactly
- Restart dev server after changing `.env`

### "Storage bucket not found"
- Ensure buckets are created in Supabase Storage
- Verify buckets are **public**
- Check bucket names: `originals`, `aligned`, `videos`

### "Low confidence eye detection"
- Use photos with good lighting
- Ensure face is clearly visible
- Eyes should be open and facing camera
- Try a different photo

### API functions not working locally
- Install Vercel CLI: `npm i -g vercel`
- Use `vercel dev` instead of `npm run dev`
- Check `.env` has `GEMINI_API_KEY`

## 📊 Project Stats

- **Frontend**: ~15 files
- **Backend**: 2 API functions
- **Database**: 2 tables, 3 storage buckets
- **Dependencies**: ~420 packages
- **Build time**: ~30 seconds
- **Bundle size**: ~150KB (gzipped)

## 🎯 Next Steps

Once setup is complete:

1. **Upload first photo** - Start your growth journey
2. **Invite others** - Share magic link authentication
3. **Customize alignment** - Edit target eye position in `api/align-photo.ts`
4. **Add features** - See "Future Enhancements" in README.md

## 💡 Pro Tips

- **Daily uploads**: Set a phone reminder for same time each day
- **Consistent lighting**: Take photos in same location/lighting
- **Same angle**: Try to keep camera distance/angle consistent
- **Eyes open**: Wait for baby to have eyes open and facing camera
- **Backup**: Export photos regularly (future feature)

---

Need help? Check the [README.md](README.md) or open an issue on GitHub!
