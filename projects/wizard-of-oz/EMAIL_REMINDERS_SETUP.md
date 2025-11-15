# Email Reminders Setup Guide

This guide walks you through setting up daily email reminders for Wizard of Oz users who haven't uploaded a photo yet.

---

## Part 1: Resend Setup (5 minutes)

### Step 1: Create Resend Account
1. Go to [resend.com](https://resend.com)
2. Click "Start Building" or "Sign Up"
3. Sign up with GitHub (easiest) or email
4. Verify your email if needed

### Step 2: Get API Key
1. Once logged in, go to **API Keys** in the sidebar
2. Click **"Create API Key"**
3. Name it: `wizard-of-oz-production`
4. Permission: **"Sending access"** (default)
5. Click **Create**
6. **Copy the API key** (starts with `re_...`)
   - ⚠️ You can only see this once - save it now!

### Step 3: Verify Domain (Optional but Recommended)
**Option A: Use Resend's Test Domain (Quick Start)**
- Emails will come from `onboarding@resend.dev`
- Works immediately, no setup needed
- Good for testing, but less professional

**Option B: Use Your Own Domain (Recommended for Production)**
1. In Resend dashboard, go to **Domains**
2. Click **"Add Domain"**
3. Enter your domain (e.g., `wizardofoz.app` or subdomain like `mail.wizardofoz.app`)
4. Add DNS records Resend provides:
   - 3 TXT records (SPF, DKIM, DMARC)
   - 1 MX record (optional, for receiving)
5. Wait 5-30 minutes for DNS propagation
6. Click "Verify" in Resend dashboard
7. Once verified, emails will come from `noreply@yourdomain.com`

**For now**: Use test domain to get started, add custom domain later

---

## Part 2: Add API Key to Vercel (2 minutes)

### Step 1: Add Environment Variable
```bash
# From the wizard-of-oz directory
cd /Users/dancroome-horgan/Documents/GitHub/Aperture/projects/wizard-of-oz

# Add to Vercel (production)
vercel env add RESEND_API_KEY production

# When prompted, paste your API key (re_...)
# Press Enter
```

### Step 2: Add to Local Development
```bash
# Create/edit .env.local file
echo "RESEND_API_KEY=re_your_api_key_here" >> .env.local
```

⚠️ **Never commit `.env.local` to git** - it's already in `.gitignore`

### Step 3: Verify Setup
```bash
# Check Vercel has the variable
vercel env pull
# Should create .env.local with RESEND_API_KEY

# Or check in Vercel dashboard:
# https://vercel.com/your-username/aperture/settings/environment-variables
```

---

## Part 3: Configure Email Settings

### Update User Settings
Users need to provide their email and set reminder preferences. This will be handled in the UI we'll build.

### Database Schema
The `user_settings` table already has:
- `reminder_time` - Time they want reminders (default: 19:00 = 7pm)
- `timezone` - Their timezone (e.g., 'America/New_York')

We'll add:
- `reminder_email` - Email address for reminders
- `reminders_enabled` - Boolean to opt in/out

---

## Part 4: Test Email Sending

Once we implement the cron job, you can test it:

```bash
# Test the endpoint locally
curl http://localhost:3000/api/cron/send-reminders

# Or test in production
curl https://aperture-production.vercel.app/api/cron/send-reminders
```

You should receive an email if:
1. You haven't uploaded a photo today
2. Your local time matches the reminder_time
3. Reminders are enabled in your settings

---

## Part 5: Email Template Preview

**Subject**: "Don't forget today's photo! 📸"

**Body**:
```
Hi there! 👋

You haven't captured today's memory yet.

Take a quick photo to keep your daily journey going!

[Upload Today's Photo] (button/link)

---
You're receiving this because you have daily reminders enabled.
Manage your settings: [link]
```

---

## Part 6: Monitoring & Debugging

### Check Logs
- **Resend Dashboard**: See all sent emails, delivery status, opens
- **Vercel Logs**: Check cron job execution
  ```bash
  vercel logs
  ```

### Common Issues

**Emails not sending?**
1. Check API key is correct in Vercel env
2. Check Resend dashboard for errors
3. Check spam folder
4. Verify user has email set in user_settings

**Emails going to spam?**
1. Verify your domain (SPF/DKIM records)
2. Don't use spammy words in subject
3. Include unsubscribe link
4. Warm up sending (start with small volume)

**Wrong timezone?**
1. Ensure user's timezone is set correctly
2. Check server time: `new Date().toISOString()`
3. Use moment-timezone or date-fns-tz for conversions

---

## Free Tier Limits

**Resend Free Tier**:
- 3,000 emails/month
- 100 emails/day
- Perfect for personal use & early users

**Scaling**:
- If you hit limits, Resend Pro is $20/month for 50k emails
- For now, free tier is plenty

---

## Next Steps

After this setup:
1. ✅ Resend account created
2. ✅ API key added to Vercel
3. ⏳ Database migration (we'll create)
4. ⏳ Cron endpoint implementation
5. ⏳ UI for reminder settings
6. ⏳ Test & deploy

Let me know when you've completed steps 1-2, and I'll build the rest!

---

## Security Notes

- ✅ API key is server-side only (never exposed to client)
- ✅ Vercel env vars are encrypted
- ✅ Emails only sent to verified user emails from Supabase Auth
- ✅ Users can opt-out anytime

---

## Resources

- [Resend Docs](https://resend.com/docs)
- [Resend React Email Templates](https://react.email)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
