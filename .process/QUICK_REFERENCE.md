# Quick Reference - Where to Find What

> **TL;DR**: Starting new session? → `START_HERE.md` → `NEXT_SESSION.md` → Start working

---

## 📍 Navigation Map

```
New Session?
    ↓
START_HERE.md ← Read this first!
    ↓
NEXT_SESSION.md ← What to do today
    ↓
Begin work
    ↓
Update files as you go
    ↓
End of session: Update NEXT_SESSION.md
```

---

## 🗂️ File Directory (What's Where)

### Root Level (Start Points)

| File | When to Use |
|------|-------------|
| **START_HERE.md** | 🚨 Every new session (instructions for Claude) |
| **NEXT_SESSION.md** | Current status, what to do next |
| **SESSION_CHECKLIST.md** | Session workflow, how to capture mistakes |
| **CONTRIBUTING.md** | Starting a new project |
| **QUICK_REFERENCE.md** | You are here (finding things fast) |

### .process/ (How We Work)

| File | Purpose |
|------|---------|
| **ARCHITECTURE.md** | Tech decisions, "Start Minimal" philosophy, tech stack |
| **DEVELOPMENT.md** | Workflow (Plan Mode, TDD, context management) |
| **TESTING_GUIDE.md** | Testing strategy and patterns |
| **DEPLOYMENT.md** | CI/CD, Vercel patterns |
| **COMMON_MISTAKES.md** | Mistakes made + fixes + prevention |
| **DECISION_LOG.md** | Major architectural decisions (ADRs) |
| **LESSONS_LEARNED.md** | Post-project reflections |
| **SUBAGENTS.md** | When/how to use subagents (placeholder) |

### .claude/commands/ (Automation)

| Command | What It Does |
|---------|--------------|
| **/commit** | Generate conventional commit message |
| **/test** | Generate unit tests for file |
| **/qa** | Code quality review |
| **/refactor** | Apply clean code principles |

### knowledge-base/ (Reference Materials)

| Path | Content |
|------|---------|
| **testing/testing-core.md** | Universal testing rules |
| **testing/testing-components.md** | React component patterns |
| **testing/testing-api.md** | API/serverless testing |

### projects/ (Individual Projects)

| File Pattern | Purpose |
|--------------|---------|
| **projects/[name]/plan.md** | Current state, next steps, blockers |
| **projects/[name]/architecture.md** | System design for this project |
| **projects/[name]/decisions.md** | Project-specific ADRs |
| **projects/[name]/README.md** | Setup and usage guide |

---

## 🔍 "Where Do I Find...?"

| Looking For | File |
|-------------|------|
| What to do today | `NEXT_SESSION.md` |
| Current project status | `projects/wizard-of-oz/plan.md` |
| Why we made a decision | `.process/DECISION_LOG.md` |
| Past mistakes and fixes | `.process/COMMON_MISTAKES.md` |
| How to use Plan Mode | `.process/DEVELOPMENT.md` |
| Testing patterns | `.process/TESTING_GUIDE.md` |
| Tech stack decisions | `.process/ARCHITECTURE.md` |
| "Start Minimal" philosophy | `.process/ARCHITECTURE.md` |
| Deployment process | `.process/DEPLOYMENT.md` |
| Session workflow | `SESSION_CHECKLIST.md` |
| How to start new project | `CONTRIBUTING.md` |
| Slash commands | `.claude/commands/` |
| Context management rules | `.process/DEVELOPMENT.md` (bottom) |

---

## 🎯 Common Scenarios

### Scenario: Starting New Session

**Read**:
1. `START_HERE.md`
2. `NEXT_SESSION.md`
3. Relevant `projects/[name]/plan.md` if working on specific project

**Time**: < 5 minutes

### Scenario: "Why did we choose X over Y?"

**Check**:
1. `.process/DECISION_LOG.md` (framework-level decisions)
2. `projects/[name]/decisions.md` (project-specific decisions)

### Scenario: "How do we handle testing?"

**Read**:
1. `.process/TESTING_GUIDE.md` (strategy)
2. `knowledge-base/testing/testing-core.md` (universal rules)
3. `knowledge-base/testing/testing-[type].md` (specific patterns)

### Scenario: "What mistakes have we made?"

**Check**:
- `.process/COMMON_MISTAKES.md`

### Scenario: "What's the current project status?"

**Read**:
- `projects/wizard-of-oz/plan.md`

### Scenario: "How should I structure this session?"

**Read**:
- `SESSION_CHECKLIST.md`

### Scenario: "When should I start a fresh context?"

**Check**:
- `.process/DEVELOPMENT.md` → "Context Window Management" section
- **TL;DR**: > 100K tokens or degraded performance

---

## 📊 Information Hierarchy

```
START_HERE.md
    ↓
NEXT_SESSION.md ← What's happening NOW
    ↓
    ├─→ .process/ ← HOW we work (universal)
    │   ├─ ARCHITECTURE.md
    │   ├─ DEVELOPMENT.md
    │   ├─ TESTING_GUIDE.md
    │   ├─ DEPLOYMENT.md
    │   ├─ COMMON_MISTAKES.md
    │   ├─ DECISION_LOG.md
    │   └─ LESSONS_LEARNED.md
    │
    └─→ projects/[name]/ ← WHAT we're building (specific)
        ├─ plan.md ← Current state
        ├─ architecture.md ← System design
        ├─ decisions.md ← Project ADRs
        └─ README.md ← Setup guide
```

---

## 💡 Pro Tips

**Don't read everything** - be targeted:
- Working on code? → Check relevant `plan.md` + `.process/DEVELOPMENT.md`
- Making architecture decision? → `.process/ARCHITECTURE.md` + `DECISION_LOG.md`
- Writing tests? → `.process/TESTING_GUIDE.md` + `knowledge-base/testing/`
- Deploying? → `.process/DEPLOYMENT.md`

**Cross-references are intentional**:
- Files point to each other to avoid duplication
- Follow the breadcrumbs
- If you see "See X.md for details" → that's by design

**Trust the system**:
- If you can't find something quickly → file might need updating
- Add to `COMMON_MISTAKES.md` if pattern emerges
- Improve docs during session

---

**Last Updated**: 2025-10-10
**Purpose**: Fast navigation for new sessions
**Bookmark This**: Keep open during sessions for quick reference
