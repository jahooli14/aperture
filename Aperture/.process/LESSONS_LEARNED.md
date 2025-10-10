# Lessons Learned

> **Purpose**: Post-project reflections. What worked? What didn't? What would we do differently?
>
> **Format**: Project-based entries with key insights

---

## How to Use This File

### When to Add an Entry
- **After completing a project** (or major milestone)
- **When encountering significant challenges**
- **When discovering particularly effective patterns**

### Template
```markdown
## [Project Name] - [Date]

### What Worked Well
- [Success 1]
- [Success 2]

### What Didn't Work
- [Challenge 1]
- [Challenge 2]

### Key Insights
1. [Learning 1]
2. [Learning 2]

### Would Do Differently Next Time
- [Change 1]
- [Change 2]

### Process Updates Made
- [Updated doc 1]
- [Updated doc 2]
```

---

## Project Reflections

### wizard-of-oz - 2025-10-10 (Initial Build)

**Status**: ✅ MVP Complete - Ready for deployment

### What Worked Well
1. **Plan-first approach**: Breaking down the app into clear phases (setup → frontend → API → docs) prevented scope creep and maintained focus
2. **Tech stack decisions**: React + Vite + Supabase + Gemini was the right combo - minimal config, fast iteration
3. **Documentation-driven**: Writing README/SETUP/PROJECT_SUMMARY while building kept goals clear
4. **Gemini API choice**: Simpler than MediaPipe integration, better ROI (see `DECISION_LOG.md`)

### What Didn't Work
1. **TBD**: Haven't actually deployed yet (will update after deployment)
2. **TBD**: Haven't tested with real baby photos (accuracy unknown)

### Key Insights
1. **AI API integration is easier than expected**: Gemini API was straightforward - structured output, good documentation
2. **Vercel Functions for AI workloads**: Natural fit for sporadic, compute-heavy tasks (eye detection + alignment)
3. **Documentation breeds clarity**: Writing docs forced clear thinking about architecture
4. **Starting minimal works**: MVP has exactly what's needed, nothing more

### Would Do Differently Next Time
1. **Test API integration earlier**: We built entire frontend before testing Gemini API (should validate AI accuracy first)
2. **Consider preview environment**: Would be nice to test uploads without affecting "production" data
3. **Plan for failure modes**: What happens if Gemini is down? Need graceful degradation

### Process Updates Made
- ✅ Created Aperture process framework (`.process/`)
- ✅ Established "Start Minimal" philosophy
- ✅ Set up SESSION_CHECKLIST.md for continuous improvement
- ✅ Created placeholder strategy for advanced features

### Metrics (If Applicable)
- **Build time**: ~4 hours (setup → deployment-ready)
- **Files created**: ~25 (frontend + API + docs + process)
- **Technologies learned**: Gemini API, Sharp image processing, Supabase RLS

---

## Cross-Project Patterns (Emerging)

### Frontend Architecture
- **Zustand over Redux**: Simpler, less boilerplate (wizard-of-oz success)
- **Co-located tests**: Tests next to components works well
- **Tailwind utility-first**: Fast styling, good DX

### Backend Architecture
- **Serverless-first**: Vercel Functions for most use cases
- **Supabase for data**: Database + Auth + Storage in one place
- **AI as a service**: Call AI APIs vs running models (cost/complexity trade-off favorable)

### Development Workflow
- **Plan Mode discipline**: Critical for non-trivial features
- **Externalize memory**: plan.md, architecture.md essential for multi-session work
- **Slash commands**: Automate repeated prompts (will build library over time)

---

## Anti-Patterns Identified

### Testing Agent Over-Engineering (Pre-Aperture)
**What happened**: Built complex testing system that slowed everything down

**Root cause**: Added complexity without clear ROI analysis

**Fix**: Established "Start Minimal" philosophy (see `ARCHITECTURE.md`)

**Prevention**: Decision framework before adding complexity

---

## Evolution of Process

### What We've Learned About AI-Assisted Development
1. **Planning > Prompting**: Structured planning yields better results than clever prompts
2. **Context engineering**: Token-efficient CLAUDE.md files > verbose docs
3. **Memory externalization**: Files > chat history for long-term projects
4. **Specialization helps**: Dedicated commands/agents for repeated tasks (future)

### Process Improvements Over Time
- **Session structure**: Added pre/during/post workflow (SESSION_CHECKLIST.md)
- **Mistake tracking**: Immediate capture + detailed reflection (COMMON_MISTAKES.md)
- **Decision documentation**: ADRs for architectural choices (DECISION_LOG.md)
- **Placeholder strategy**: Awareness without premature optimization

---

## Future Experiments

### To Try Next Project
- [ ] **TDD from start**: Test-first for critical logic (API endpoints, business rules)
- [ ] **Plan Mode for everything**: Even "simple" features (test discipline)
- [ ] **Performance budgets**: Set targets upfront (load time, bundle size)
- [ ] **Automated PR previews**: Test features in production-like env before merge
- [ ] **Feature flags**: Safe deployments with gradual rollout

### To Evaluate
- 🔮 **Subagents**: Worth it after 5+ repetitions of same task?
- 🔮 **Multi-agent**: Useful for parallel work streams or coordination overhead too high?
- 🔮 **Custom SDK tools**: What's the first integration that justifies building a tool?

---

## Template for Next Project

### [Project Name] - [Date]

### What Worked Well
- [Success]

### What Didn't Work
- [Challenge]

### Key Insights
1. [Learning]

### Would Do Differently Next Time
- [Change]

### Process Updates Made
- [Update]

### Metrics
- Build time: [X hours]
- Files created: [N]
- Technologies learned: [List]

---

**Last Updated**: 2025-10-10
**Total Projects**: 1 (wizard-of-oz)
**Next Review**: After wizard-of-oz deployment + real-world usage
