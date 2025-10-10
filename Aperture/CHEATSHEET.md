# Aperture Cheatsheet - One Page Reference

> Print this or keep it open during sessions

---

## 🚀 Starting New Session (Copy-Paste)

```
Read START_HERE.md and continue with the plan.
```

---

## 📂 Essential Files (Where Everything Is)

| Need | File | Location |
|------|------|----------|
| **Start new session** | START_HERE.md | Root |
| **What to do today** | NEXT_SESSION.md | Root |
| **Current project status** | plan.md | `projects/wizard-of-oz/` |
| **All decisions** | DECISION_LOG.md | `.process/` |
| **Past mistakes** | COMMON_MISTAKES.md | `.process/` |
| **How we work** | DEVELOPMENT.md | `.process/` |
| **Start Minimal principle** | ARCHITECTURE.md | `.process/` |

---

## 🎯 Core Philosophies

1. **Start Minimal**: Cost/benefit before complexity
2. **Plan First**: Use Plan Mode (Shift+Tab x2) for non-trivial tasks
3. **Fresh Context**: New session at 100K+ tokens
4. **Learn from Mistakes**: Capture immediately → detail at session end

---

## ⚡ Quick Commands

| Command | What It Does |
|---------|--------------|
| `/commit` | Generate conventional commit |
| `/test [file]` | Generate unit tests |
| `/qa [file]` | Code quality review |
| `/refactor [file]` | Clean code improvements |

---

## 📋 Session Workflow

**Start**:
1. Read START_HERE.md (2 min)
2. Read NEXT_SESSION.md (2 min)
3. Begin work

**During**:
- Use Plan Mode for complex tasks
- Capture mistakes in COMMON_MISTAKES.md
- Update plan.md as you go

**End**:
1. Update NEXT_SESSION.md
2. Update plan.md
3. Commit changes (`/commit`)

---

## 🔍 "Where Is...?"

| Question | Answer |
|----------|--------|
| Why did we choose X? | DECISION_LOG.md |
| What mistakes happened? | COMMON_MISTAKES.md |
| How do I test? | TESTING_GUIDE.md |
| How do I deploy? | DEPLOYMENT.md |
| What's the session workflow? | SESSION_CHECKLIST.md |

---

## 🚨 When to Start Fresh Context

- ✅ Token usage > 100K
- ✅ Degraded response quality
- ✅ Starting completely new feature
- ✅ Switching projects

**Handoff**: Update NEXT_SESSION.md → Commit → Start fresh

---

## 💾 Current Project: wizard-of-oz

**Status**: MVP Complete - Ready for Deployment
**Next**: User provides Supabase + Gemini credentials
**Plan**: `projects/wizard-of-oz/plan.md`

---

**Last Updated**: 2025-10-10
