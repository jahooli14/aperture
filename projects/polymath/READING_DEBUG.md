# Reading Feature Debug Guide

## Quick Tests

### 1. Test the API Directly
```bash
# Fetch articles
curl https://polymath-bzrq1klv0-daniels-projects-ca7c7923.vercel.app/api/reading

# Save an article
curl -X POST https://polymath-bzrq1klv0-daniels-projects-ca7c7923.vercel.app/api/reading \
  -H "Content-Type: application/json" \
  -d '{"url":"https://blog.cloudflare.com/workers-ai"}'
```

### 2. Test Page
Visit: https://polymath-bzrq1klv0-daniels-projects-ca7c7923.vercel.app/test-reading.html

This page has 3 tests:
- Fetch Articles - Tests GET /api/reading
- Save Article - Tests POST /api/reading
- Check Dependencies - Verifies browser APIs

### 3. Reading Page
Visit: https://polymath-bzrq1klv0-daniels-projects-ca7c7923.vercel.app/reading

## Database Status

✅ **Tables exist and work:**
- `reading_queue` - Stores saved articles
- `article_highlights` - Stores highlights

Run locally to verify:
```bash
cd projects/polymath
npx tsx scripts/check-reading-db.ts
```

## Common Issues

### "Blank white page"
**Possible causes:**
1. JavaScript error - Check browser console (F12)
2. React component crash - Check for error boundaries
3. Supabase connection failed - Check network tab

**To debug:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for red errors
4. Share the exact error message

### "API returns 500"
**Possible causes:**
1. Jina AI rate limit
2. Invalid URL format
3. Database connection issue

**To debug:**
1. Check Vercel logs: https://vercel.com/deployments
2. Test API directly (see test commands above)

### "Articles don't save"
**Possible causes:**
1. CORS issue
2. Environment variables missing
3. RLS policies blocking

**To debug:**
1. Open Network tab in DevTools
2. Click Save Article
3. Look for failed request
4. Check response body

## Environment Variables (Vercel)

Required in production:
- `VITE_SUPABASE_URL` ✓ (set)
- `VITE_SUPABASE_ANON_KEY` ✓ (set)
- `SUPABASE_SERVICE_ROLE_KEY` ✓ (set)

## Implementation Status

✅ **Completed:**
- API endpoint for saving/fetching articles
- Jina AI extraction (with DOMPurify client-side)
- Database schema with RLS policies
- Reading page UI with article cards
- Reader view with typography controls
- Dark mode support
- Offline caching with Dexie.js/IndexedDB
- Reading progress tracking
- Image caching for offline reading

## What Should Work

1. **Navigate to /reading** - Should show reading queue page
2. **Click "Save Article"** - Should open dialog
3. **Paste URL + Save** - Should extract and save article
4. **Click article** - Should open reader view
5. **Click download icon** - Should cache for offline
6. **Scroll in article** - Should track progress

## Next Steps for Debugging

1. Visit test page and run all 3 tests
2. If API tests pass but UI doesn't work, it's a React issue
3. If API tests fail, it's a backend issue
4. Share exact error from browser console for specific help
