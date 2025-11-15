# Email Reminders - Implementation Summary

## What's Been Built

✅ **Complete email reminder system** for Wizard of Oz users who haven't uploaded their daily photo.

---

## Components

### 1. Database Migration
**File**: `supabase/migrations/003_add_email_reminders.sql`

Added fields to `user_settings`:
- `reminder_email` - Email address for reminders
- `reminders_enabled` - Boolean opt-in flag
- Optimized index for cron queries

### 2. Vercel Cron Job
**File**: `api/cron/send-reminders.ts`

- Runs every hour (configured in `vercel.json`)
- Handles all timezones automatically
- Checks if user uploaded today
- Sends beautiful HTML email if not
- Protected with `CRON_SECRET` auth

### 3. User Interface
**File**: `src/components/PrivacySettings.tsx`

Added "Daily Photo Reminders" section:
- Email input
- Time picker (default 7pm)
- Enable/disable toggle
- Save button with validation

### 4. Store Updates
**File**: `src/stores/useSettingsStore.ts`

- New `updateReminderSettings()` method
- Persists to Supabase user_settings

### 5. Type Definitions
**File**: `src/types/database.ts`

Updated with new reminder fields for type safety

---

## Setup Required

### Step 1: Resend Account
Follow `EMAIL_REMINDERS_SETUP.md` to:
1. Create Resend account (free)
2. Get API key
3. Optional: Verify custom domain

### Step 2: Environment Variables
Add to Vercel:
```bash
RESEND_API_KEY=re_...
CRON_SECRET=your-random-secret
SUPABASE_SERVICE_ROLE_KEY=your-service-key
VITE_APP_URL=https://your-app.vercel.app
```

### Step 3: Run Database Migration
```sql
-- Run in Supabase SQL Editor
-- File: supabase/migrations/003_add_email_reminders.sql
```

### Step 4: Deploy
```bash
git push  # Vercel auto-deploys
```

---

## How It Works

1. **User sets up reminders**:
   - Opens Privacy Settings
   - Enters email & preferred time
   - Toggles "Enable reminders"
   - Clicks "Save"

2. **Cron runs every hour**:
   - Checks all users with `reminders_enabled = true`
   - Filters by timezone (who is at their reminder_time now?)
   - Queries photos table (did they upload today?)
   - Sends email if no photo found

3. **User receives email**:
   - Beautiful HTML template
   - "Upload Today's Photo" button
   - Unsubscribe link to settings

---

## Email Template

**Subject**: "Don't forget today's photo! 📸"

Features:
- Gradient header with app branding
- Clear call-to-action button
- Friendly, encouraging copy
- Footer with settings link
- Mobile-responsive design

---

## Cron Schedule

`"0 * * * *"` = Every hour, on the hour

**Why hourly?**
- Handles all global timezones
- User in NYC gets email at their 7pm
- User in Tokyo gets email at their 7pm
- No need to run 24 separate cron jobs

---

## Testing

### Local Testing
```bash
# Start dev server
npm run dev

# Call cron endpoint directly
curl http://localhost:3000/api/cron/send-reminders \
  -H "Authorization: Bearer your-cron-secret"
```

### Production Testing
1. Set your own email in Privacy Settings
2. Enable reminders at current time + 5 minutes
3. Don't upload a photo
4. Wait for email

---

## Monitoring

### Resend Dashboard
- See all sent emails
- Delivery status
- Open rates
- Bounce handling

### Vercel Logs
```bash
vercel logs --follow
```

Look for:
- Cron execution every hour
- "Reminders sent successfully" messages
- Any errors

---

## Free Tier Limits

**Resend**: 3,000 emails/month (100/day)
**Vercel Cron**: Unlimited on Pro plan

For personal use, free tier is plenty!

---

## Security

- ✅ API key server-side only
- ✅ CRON_SECRET protects endpoint
- ✅ Service role key for RLS bypass
- ✅ Emails only to verified Supabase users
- ✅ Users can opt-out anytime

---

## Next Steps

1. Complete Resend setup (see `EMAIL_REMINDERS_SETUP.md`)
2. Add environment variables to Vercel
3. Run database migration
4. Deploy and test!

---

## Future Enhancements

- **Email templates**: Use React Email for better templates
- **Reminder streaks**: "You've uploaded 7 days in a row!"
- **SMS reminders**: Add Twilio for texts
- **Push notifications**: PWA support
- **Native app**: React Native with native push

For now, email reminders are a great MVP!
