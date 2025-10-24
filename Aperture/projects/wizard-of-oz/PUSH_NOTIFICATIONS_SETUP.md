# Push Notifications Setup Guide

## What's Been Set Up

✅ PWA configuration with vite-plugin-pwa
✅ Service worker with push notification handlers
✅ Push notification subscription management
✅ API endpoint for sending push notifications
✅ Cron job updated to send push (preferred) then email fallback
✅ UI in settings to enable/disable push notifications
✅ Database migration for storing push subscriptions
✅ VAPID keys generated

## Setup Steps

### 1. Run Database Migration

Run the migration to add push subscription support:

```bash
# Copy the SQL from this file:
cat supabase/migrations/004_add_push_notifications.sql

# Then run it in Supabase SQL Editor
# Or use Supabase CLI:
supabase db push
```

### 2. Add Environment Variables to Vercel

Add these three environment variables in Vercel dashboard:

```bash
# Public key (exposed to client)
VITE_VAPID_PUBLIC_KEY=BNZSrRF-iXENq-MWzLBwfmt41kZg7i1ehknp7TRk5XYz7W8Sp9ZEn4lVVnjdzHowqd81EZocHHQ09MaRp-yz9iM

# Private key (secret, server-only)
VAPID_PRIVATE_KEY=vbwKog7w0I55UPrhQYdRFzku4lARkZnCsejWY1WrdWg

# Contact email
VAPID_EMAIL=mailto:your-email@example.com
```

**Where to add them:**
1. Go to Vercel dashboard → Your project → Settings → Environment Variables
2. Add all three variables
3. Select which environments (Production, Preview, Development)
4. Redeploy the app

### 3. Create PWA Icons

You need two icon files in the `public/` directory:

- `pwa-192x192.png` - 192x192px
- `pwa-512x512.png` - 512x512px

**How to create:**
1. Use any image editor (Figma, Photoshop, etc.)
2. Create a simple icon (maybe a camera or baby emoji 📸)
3. Export as PNG at those sizes
4. Place in `/public` directory

**Quick option:** Use an emoji as placeholder:
- Go to https://emoji.supply/
- Search for "camera" or "baby"
- Download at 512x512px
- Resize to 192x192px for the smaller version

### 4. Test the Setup

#### On Your Device:

1. **Deploy the app** (push to git, Vercel deploys automatically)

2. **Open on mobile device** (iOS 16.4+ or Android with Chrome)

3. **Add to Home Screen:**
   - iOS: Share button → Add to Home Screen
   - Android: Menu → Add to Home Screen

4. **Enable Push Notifications:**
   - Open the app from home screen
   - Go to Settings (gear icon)
   - Scroll to "Push Notifications"
   - Toggle it ON
   - Allow notifications when prompted

5. **Test Daily Reminder:**
   The cron job runs hourly. To test immediately, you can:
   - Trigger the cron manually in Vercel dashboard
   - Or wait until your reminder time (set in settings)

## How It Works

### Flow:
1. User enables push notifications in settings
2. Browser requests permission
3. Service worker subscribes to push service
4. Subscription saved to database
5. Cron job runs hourly checking for users who:
   - Have reminders enabled
   - Haven't uploaded today
   - Current time matches their reminder time
6. Sends push notification (preferred) or email (fallback)

### Priority:
- **Push notifications** are tried first (instant, works even when app is closed)
- **Email** is fallback if push fails or not set up

## Troubleshooting

### Push notifications not working?

1. **Check browser support:**
   - iOS: Requires 16.4+ and PWA must be installed to home screen
   - Android: Works in Chrome/Edge
   - Desktop: Works in Chrome/Edge/Firefox

2. **Check permissions:**
   - Settings → Site Settings → Notifications
   - Make sure notifications are "Allowed"

3. **Check Vercel logs:**
   - Go to Vercel dashboard → Deployments → Functions
   - Check logs for `/api/cron/send-reminders`

4. **Verify VAPID keys:**
   - Make sure all 3 env vars are set in Vercel
   - Redeploy after adding them

### Icons not showing?

1. Check files exist in `/public` directory
2. Check filenames match exactly: `pwa-192x192.png` and `pwa-512x512.png`
3. Clear cache and reinstall PWA

## Files Changed/Created

### New Files:
- `vite.config.ts` - Added PWA plugin configuration
- `public/sw-push.js` - Service worker push handlers
- `src/lib/notifications.ts` - Push notification utilities
- `api/send-push.ts` - API endpoint for sending push
- `supabase/migrations/004_add_push_notifications.sql` - Database migration
- `tools/generate-vapid-keys.cjs` - VAPID key generator

### Modified Files:
- `api/cron/send-reminders.ts` - Now sends push first, email fallback
- `src/components/PrivacySettings.tsx` - Added push notification toggle UI

## Next Steps

After setup is complete:
1. Test on your device
2. Set your reminder time in settings
3. Enable push notifications
4. Wait for your first reminder!

---

**Note:** Push notifications work best when the PWA is installed to the home screen. On iOS, this is **required** for notifications to work at all.
