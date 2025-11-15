# wizard-of-oz Implementation Plan

**Status**: ✅ MVP Complete - Ready for Deployment
**Last Updated**: 2025-10-10

---

## Current State

### ✅ Completed

- [x] **Project Setup**
  - [x] Vite + React + TypeScript initialized
  - [x] Tailwind CSS configured
  - [x] Dependencies installed (Framer Motion, Zustand, Supabase client, Gemini SDK, Sharp)

- [x] **Frontend (React)**
  - [x] AuthForm component (email magic links)
  - [x] UploadPhoto component (camera/gallery integration)
  - [x] PhotoGallery component (timeline grid view)
  - [x] Zustand stores (auth, photos)
  - [x] Main App component with routing logic

- [x] **Backend (Vercel Functions)**
  - [x] `/api/detect-eyes.ts` - Gemini API integration
  - [x] `/api/align-photo.ts` - Sharp image processing

- [x] **Database (Supabase)**
  - [x] Schema designed (`photos`, `user_settings` tables)
  - [x] Migration SQL written
  - [x] TypeScript types generated

- [x] **Documentation**
  - [x] README.md (comprehensive guide)
  - [x] SETUP.md (quick start)
  - [x] PROJECT_SUMMARY.md (technical deep-dive)

---

## Next Steps (User Action Required)

### 🔑 Setup Required

1. **Supabase Configuration**
   - [ ] Create Supabase project
   - [ ] Run migration (`supabase/migrations/001_initial_schema.sql`)
   - [ ] Create storage buckets (originals, aligned, videos)
   - [ ] Configure RLS policies
   - [ ] Get credentials (URL, anon key, service role key)

2. **Gemini API**
   - [ ] Get API key from ai.google.dev
   - [ ] Add to environment variables

3. **Environment Variables**
   - [ ] Create `.env` file
   - [ ] Add Supabase credentials
   - [ ] Add Gemini API key

4. **Local Testing**
   - [ ] Run `npm run dev` or `vercel dev`
   - [ ] Test authentication flow
   - [ ] Test photo upload
   - [ ] Verify eye detection works
   - [ ] Check alignment quality

5. **Deployment**
   - [ ] Push to GitHub
   - [ ] Connect to Vercel
   - [ ] Add environment variables in Vercel
   - [ ] Deploy to production
   - [ ] Test live app

---

## Future Enhancements (Backlog)

### Phase 2: Video Generation
- [ ] FFmpeg integration (serverless)
- [ ] Timelapse video at 12fps
- [ ] Download as MP4
- [ ] Date overlays on frames
- [ ] Background music (optional)

### Phase 3: Automation
- [ ] Daily reminder system (Vercel Cron)
- [ ] Email notifications for missed uploads
- [ ] Weekly progress reports
- [ ] Streak tracking

### Phase 4: Advanced Features
- [ ] Multi-child support
- [ ] Smile/milestone detection (Gemini)
- [ ] Custom alignment positions (user-configurable)
- [ ] Social sharing (Twitter, Instagram)
- [ ] Export as GIF
- [ ] Mobile app (React Native port)

### Phase 5: Analytics & Insights
- [ ] Growth metrics dashboard
- [ ] Photo quality scores
- [ ] Monthly summaries (AI-generated)
- [ ] Developmental milestone tracking

---

## Blockers & Risks

### Current Blockers
- None (MVP complete, waiting for user setup)

### Known Risks
1. **Gemini API accuracy**: Untested with actual baby photos
   - **Mitigation**: Add confidence threshold check (already implemented: 0.7)
   - **Fallback**: Manual eye position adjustment (future feature)

2. **Sharp processing performance**: Alignment might be slow for high-res images
   - **Mitigation**: Vercel function max duration set to 60s
   - **Monitoring**: Check function logs after deployment

3. **Storage costs**: Could scale with photo count
   - **Mitigation**: Supabase free tier = 500MB (~1000 photos)
   - **Plan**: Monitor usage, upgrade if needed

---

## Technical Debt
- None yet (greenfield project)
- Watch for: Duplicated alignment logic if we add preview feature

---

## Testing Notes

### Manual Testing Checklist
- [ ] Auth: Magic link email sent and works
- [ ] Upload: Photo uploads to Supabase Storage
- [ ] Eye Detection: Gemini returns coordinates
- [ ] Alignment: Sharp generates aligned photo
- [ ] Gallery: Photos display with eye indicators
- [ ] Daily Limit: Only one upload per day enforced

### Edge Cases to Test
- [ ] Low-light photos
- [ ] Baby looking away
- [ ] Multiple faces in photo
- [ ] Blurry photos
- [ ] Extreme angles

---

## Performance Targets (To Validate)

| Metric | Target | Actual (Post-Deploy) |
|--------|--------|----------------------|
| Initial page load | < 2s | TBD |
| Photo upload | < 10s | TBD |
| Eye detection | < 5s | TBD |
| Alignment processing | < 3s | TBD |
| Gallery load (100 photos) | < 1s | TBD |
| Eye detection accuracy | > 95% | TBD |

---

## Decision Points (Review Regularly)

### Now
- ✅ Use Gemini API (over MediaPipe) - **Decided**: See `decisions.md`
- ✅ Serverless functions (over traditional backend) - **Decided**: Fits use case

### Later (When Needed)
- 🔮 Add real-time preview with MediaPipe? - **Evaluate**: After user feedback
- 🔮 Implement caching layer? - **Evaluate**: If performance issues emerge
- 🔮 Add image compression? - **Evaluate**: If storage costs become concern

---

**Next Session Goal**: Deploy to production and validate with real photos

---

## Session Log

### Session 1: 2025-10-10 - Process Framework Build

**Goal**: Build Aperture process framework based on Gemini deep research

**Completed**:
- ✅ Created Aperture two-layer architecture (process + projects)
- ✅ Built `.process/` documentation (7 core docs)
- ✅ Created `.claude/commands/` (4 slash commands)
- ✅ Built `knowledge-base/testing/` (3 testing guides)
- ✅ Created `SESSION_CHECKLIST.md` for continuous improvement
- ✅ Restructured wizard-of-oz into `projects/` directory
- ✅ Created this `plan.md` file
- ✅ Documented context management philosophy
- ✅ Created `NEXT_SESSION.md` for efficient handoffs

**Key Philosophies Established**:
- **Start Minimal**: Cost/benefit before complexity (testing agent anti-pattern)
- **Continuous Improvement**: Capture mistakes immediately, detail at session end
- **Context Efficiency**: Fresh context > degraded performance (start fresh at 100K+ tokens)
- **Plan First**: Separate thinking from doing (Plan Mode discipline)

**Learned**:
- AI performance degrades in long contexts (> 100K tokens)
- Well-documented state beats trying to preserve context
- Session handoffs need clear protocols (NEXT_SESSION.md)
- Process framework scales when flexible and cross-referential

**Next**: Complete remaining 5 documentation files (README, CONTRIBUTING, SUBAGENTS, architecture, decisions)

**Blockers**: None for framework completion; wizard-of-oz deployment waiting on user credentials

**Token Usage**: ~115K (recommend starting fresh context next session)

