# Verify Infrastructure Command

**Purpose**: Check that all infrastructure is properly configured before debugging code issues.

**Usage**: `/verify-infra [project-name]`

**Example**: `/verify-infra wizard-of-oz`

---

## What This Command Does

Runs infrastructure verification checks for the specified project:

### For wizard-of-oz:

1. **Supabase Database Tables**
   - [ ] `photos` table exists
   - [ ] Table has required columns: `id`, `user_id`, `upload_date`, `original_url`, `eye_coordinates`, `aligned_url`

2. **Supabase Storage Buckets**
   - [ ] `originals` bucket exists and is public
   - [ ] `aligned` bucket exists and is public
   - [ ] Bucket policies allow authenticated uploads

3. **Environment Variables (Vercel)**
   - [ ] `VITE_SUPABASE_URL` is set
   - [ ] `VITE_SUPABASE_ANON_KEY` is set (public-facing)
   - [ ] `SUPABASE_SERVICE_ROLE_KEY` is set (secret, production only)
   - [ ] `GEMINI_API_KEY` is set (secret, production only)

4. **Vercel Deployment Settings**
   - [ ] Root directory: `projects/wizard-of-oz`
   - [ ] ⚠️ **Deployment Protection DISABLED** (critical for server-to-server API calls)
     - **Check**: Vercel Dashboard → Settings → Deployment Protection
     - **Should be**: Disabled OR "All Deployments"
     - **Why**: If enabled, server-to-server calls return 401 HTML auth page
     - **Automation**: Check via Vercel API (see script below)
   - [ ] Framework preset: Vite
   - [ ] Node version: 20.x

5. **API Endpoint Health**
   - [ ] `/api/detect-eyes` responds (test with OPTIONS request)
   - [ ] `/api/align-photo` responds (test with OPTIONS request)

---

## How to Run Checks

### 1. Supabase Database
```bash
# In Supabase SQL Editor, run:
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_name = 'photos';

# Should return: id, user_id, upload_date, original_url, eye_coordinates, aligned_url, created_at
```

### 2. Supabase Storage
```bash
# Check in Supabase Dashboard:
# Storage → Buckets → Should see:
# - originals (public: true)
# - aligned (public: true)

# Check policies:
# Click each bucket → Policies tab → Should have:
# - SELECT: public
# - INSERT: authenticated users only
```

### 3. Vercel Environment Variables
```bash
# Check in Vercel Dashboard:
# Project Settings → Environment Variables

# Verify all 4 variables exist for:
# - Production
# - Preview
# - Development (optional)
```

### 4. Vercel Deployment Settings
```bash
# Check in Vercel Dashboard:
# Project Settings → General

# Verify:
# - Root Directory: projects/wizard-of-oz
# - Framework Preset: Vite
# - Node.js Version: 20.x

# Check Settings → Deployment Protection:
# - Should be DISABLED (or allow all deployments)
# - If enabled, server-to-server API calls will fail with 401
```

### 5. API Health Check
```bash
# Test APIs are reachable:
curl -I https://your-project.vercel.app/api/detect-eyes
# Should return: 200 or 405 (not 404)

curl -I https://your-project.vercel.app/api/align-photo
# Should return: 200 or 405 (not 404)
```

---

## Output Format

```
🔍 Infrastructure Verification: wizard-of-oz

✅ Supabase Database
  ✅ photos table exists
  ✅ All required columns present

✅ Supabase Storage
  ✅ originals bucket (public)
  ✅ aligned bucket (public)

✅ Environment Variables (Vercel)
  ✅ VITE_SUPABASE_URL
  ✅ VITE_SUPABASE_ANON_KEY
  ✅ SUPABASE_SERVICE_ROLE_KEY
  ✅ GEMINI_API_KEY

⚠️ Vercel Settings
  ✅ Root directory correct
  ❌ Deployment Protection ENABLED (should be DISABLED)
  ✅ Framework: Vite
  ✅ Node: 20.x

✅ API Endpoints
  ✅ /api/detect-eyes reachable
  ✅ /api/align-photo reachable

---
❌ 1 issue found: Deployment Protection blocks server-to-server calls
Fix: Vercel Dashboard → Settings → Deployment Protection → Disable
```

---

## When to Run

**ALWAYS run this BEFORE debugging** when:
- Feature "doesn't work" but no clear error
- Empty Vercel function logs despite 200 responses
- Storage uploads failing silently
- API calls returning 401/403
- Starting work on dormant project (> 1 week)

**Rule**: If debugging > 10 minutes without progress → run `/verify-infra`

---

## Automated Deployment Protection Check

**Script to check Vercel Deployment Protection via API**:

```bash
#!/bin/bash
# Save as: .scripts/check-vercel-protection.sh

# Requires: VERCEL_TOKEN environment variable
# Get token: https://vercel.com/account/tokens

PROJECT_ID="your-project-id"  # Get from Vercel dashboard URL
VERCEL_TOKEN="${VERCEL_TOKEN:-}"

if [ -z "$VERCEL_TOKEN" ]; then
  echo "❌ VERCEL_TOKEN not set"
  echo "Get token from: https://vercel.com/account/tokens"
  echo "Export: export VERCEL_TOKEN=your_token"
  exit 1
fi

echo "🔍 Checking Deployment Protection..."

RESPONSE=$(curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v9/projects/$PROJECT_ID")

PROTECTION=$(echo "$RESPONSE" | grep -o '"protectionBypass":{[^}]*}' || echo "not_found")

if echo "$PROTECTION" | grep -q '"scope":"all"'; then
  echo "✅ Deployment Protection: DISABLED (all deployments allowed)"
elif echo "$PROTECTION" | grep -q '"scope":"none"'; then
  echo "❌ Deployment Protection: ENABLED (blocks server-to-server calls)"
  echo ""
  echo "Fix: Vercel Dashboard → Settings → Deployment Protection → Disable"
  exit 1
else
  echo "⚠️  Cannot determine protection status"
  echo "Check manually: Vercel Dashboard → Settings → Deployment Protection"
fi
```

**Usage**:
```bash
chmod +x .scripts/check-vercel-protection.sh
export VERCEL_TOKEN=your_token_here
.scripts/check-vercel-protection.sh
```

---

## Adding New Projects

When creating a new project, update this command with its infrastructure requirements.

Template:
```markdown
### For [project-name]:
1. **Database Tables**: [list required tables]
2. **Storage Buckets**: [list required buckets]
3. **Environment Variables**: [list required vars]
4. **Deployment Settings**: [special requirements]
5. **API Endpoints**: [list endpoints to check]
```
