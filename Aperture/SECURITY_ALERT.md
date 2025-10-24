# 🚨 SECURITY ALERT - API Key Rotation Required

**Date**: 2024-10-24
**Severity**: CRITICAL
**Status**: Action Required

---

## Issue

During documentation cleanup review, discovered that `projects/polymath/.env.production` contains real API keys and is **not currently tracked in git** (good), but may have been exposed in the past or in local environments.

**Exposed Credentials**:
1. `GEMINI_API_KEY` - Google Gemini AI API key
2. `SUPABASE_SERVICE_ROLE_KEY` - Full database admin access
3. `USER_ID` - User identifier

---

## Required Actions

### 1. Rotate Gemini API Key (HIGH PRIORITY)
- Go to https://aistudio.google.com/app/apikey
- Delete key: `AIzaSyD2lNTkxhaRgriBZoAF8V30omlhLYIq7u0`
- Generate new key
- Update Vercel environment variables

### 2. Rotate Supabase Service Role Key (HIGH PRIORITY)
- Go to Supabase project: nxkysxgaujdimrubjiln
- Settings → API → Generate new service_role key
- Update Vercel environment variables
- Revoke old key

### 3. Verify No Git History Exposure (MEDIUM)
```bash
git log --all --full-history -- "*/.env.production"
git log --all -S "AIzaSyD2lNTkxhaRgriBZoAF8V30omlhLYIq7u0"
```

If found in history, consider:
- Using BFG Repo-Cleaner to remove from history
- Or accept risk if repo is private and trusted

---

## Prevention

### Immediate
- ✅ .env.production already in .gitignore
- ✅ File not currently tracked
- ⏳ Add to pre-commit hook to block .env files

### Long-term
- Use Vercel environment variables exclusively
- Never store secrets in .env.production files
- Use .env.production for public config only (VITE_ variables)

---

## Verification

After rotating keys:
- [ ] New Gemini API key in Vercel
- [ ] New Supabase service role key in Vercel
- [ ] Old keys confirmed revoked
- [ ] Polymath deployment still works
- [ ] Delete this file after actions complete

---

**Delete this file after all actions are completed and keys are rotated.**
