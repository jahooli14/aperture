# Workflow Improvement Plan

*Dan Croome-Horgan | February 2026*

---

## The Core Problem

You're spread across a startup job, 4 personal apps, a 4-month-old, DJing, synth learning, book writing, and Logic Pro production. The friction isn't ambition — it's that your tools aren't eliminating enough repetitive work, and context keeps leaking between sessions.

This plan is structured around **three principles**:

1. **Automate the boring** — email reviews, mongo pulls, session context
2. **Protect the sacred** — baby time is non-negotiable, not leftover
3. **Fewer things, deeper** — batching projects into focused blocks, not scattered touches

---

## Part 1: Fix the Claude Code Friction

### Problem: "I always have to remind it of things"

**Root cause**: Your memory directory at `/root/.claude/projects/-home-user-aperture/memory/` is empty. Your subprojects have no `CLAUDE.md` files. Claude starts fresh every session with only your top-level CLAUDE.md (which is a project index, not working context).

**Fix (implemented in this PR):**

1. **MEMORY.md** — persistent memory file that loads into every session's system prompt. Contains your preferences, patterns that work, things that don't, and cross-cutting context (your work projects, personal context, common mistakes).

2. **Per-project CLAUDE.md files** — each of Pupils, Polymath, Analogue, and Agentic Swarm now has its own CLAUDE.md with project-specific context, known issues, and "don't do this" guardrails. Claude reads these when you `cd` into a project.

3. **NEXT_SESSION.md discipline** — at end of every session, Claude should update NEXT_SESSION.md. Your startup.md already says "optionally update" — change "optionally" to "always". This is your handoff document.

### Problem: Worktree issues

Worktrees break Claude Code's project detection and context loading. Two approaches:

**Option A: Stop using worktrees for personal projects.** Use branches instead. Your monorepo is small enough (36MB) that branch switching is instant. Reserve worktrees for your startup where parallel PRs justify the complexity.

**Option B: If worktrees are required at work**, create a `.claude/CLAUDE.md` in each worktree root that explicitly tells Claude which project it's in and what branch conventions to follow. The `which-project` command you already have is a start — make it a session-start hook instead of an on-demand command.

### Problem: Builds and deploys break in avoidable ways

Your last 10 commits include 5 white-screen fixes (React version mismatch, Tailwind downgrade, service worker cache). These are dependency management issues.

**Fix:**
- Pin exact versions in package.json (drop `^` prefixes) for React, Tailwind, and framework deps
- Add a `preinstall` script that runs `npm run build` as a smoke test
- Use the `verify-infra` command you already built — make it part of your pre-push hook

---

## Part 2: Automate the Work Drudgery

### Problem: Manual email reviews

**What to automate with Claude:**

- **Cowork (Claude on web)**: Use it as a daily email triage assistant. Feed it your inbox summary and have it categorize into: needs reply today, needs reply this week, FYI only, ignore. Draft replies for the "today" bucket.
- **Sonnet for speed, Opus for judgment**: Use Sonnet 4 for the categorization pass (fast, cheap). Escalate to Opus 4.6 only for emails that need nuanced replies — customer escalations, investor updates, strategic decisions.
- **Template library**: Build 5-10 email reply templates for recurring patterns. Claude fills in the specifics, you review and send.

**Practical setup:**
```
Morning routine (15 min):
1. Forward inbox digest to Claude (Cowork)
2. Claude categorizes + drafts replies
3. You review, edit, send
4. Done before standup
```

### Problem: Manual MongoDB pulls

**What to automate:**

- **Build a query library**: Document your 10 most common mongo queries as named scripts. Put them in a `/scripts/mongo/` directory. Run them with `npm run mongo:daily-metrics` instead of typing them out.
- **Claude Code as query builder**: When you need ad-hoc queries, describe what you want in plain English. Claude writes the query, you review and run it. Save good ones to the library.
- **Scheduled reports**: For recurring pulls (daily metrics, weekly summaries), set up cron jobs or Vercel scheduled functions that run the query and post results to Slack/email.

**Example script structure:**
```bash
# scripts/mongo/daily-active-users.sh
mongosh "$MONGO_URI" --eval '
  db.users.countDocuments({
    lastActive: { $gte: new Date(Date.now() - 86400000) }
  })
'
```

---

## Part 3: Model Selection Strategy

Use the right model for the right job:

| Task | Model | Why |
|------|-------|-----|
| Code implementation (complex) | **Opus 4.6** via Claude Code | Best reasoning, gets architecture right |
| Code implementation (routine) | **Sonnet 4** via Claude Code | Fast, good enough for CRUD/styling/tests |
| Email triage & drafting | **Sonnet 4** via Cowork | Speed matters, judgment is straightforward |
| Strategic decisions, architecture | **Opus 4.6** via Cowork | When you need the best thinking |
| Research, summarization | **Sonnet 4** via Cowork | Good enough, saves tokens |
| Debugging complex issues | **Opus 4.6** via Claude Code | Better at holding multi-file context |
| Writing (book, docs) | **Opus 4.6** via Cowork/Analogue | Voice and nuance matter |
| Quick questions | **Sonnet 4** | Don't waste Opus tokens on trivia |

---

## Part 4: Personal Project Strategy

You have 4 apps + DJing + synth + Logic Pro + a book. That's 8 creative outlets competing for whatever time remains after work and baby. Here's how to make them all move forward without burning out.

### The Weekly Schedule

```
WEEKDAYS
────────
Morning (before work):    Protected baby time
Work hours:               Startup (use Claude aggressively to 2x output)
Lunch break:              15 min — triage personal project issues/PRs
Evening (after baby bed): 1-2 focused hours on ONE personal project
                          (rotate weekly, see below)

WEEKENDS
────────
Saturday morning:         Baby + partner time (sacred, no screens)
Saturday afternoon:       Music block (Logic Pro / synth / mixing)
Sunday morning:           Baby time
Sunday afternoon:         Code block (personal projects)
```

### The Monthly Rotation

Don't touch all 4 apps every week. Rotate focus:

```
Week 1: Analogue (book writing tool — directly serves book goal)
Week 2: Polymath (knowledge graph — serves learning/memory goal)
Week 3: Pupils (baby photos — serves family goal, also mostly done)
Week 4: Sonically Sound (serves music goal)
```

This means each app gets ~4-5 focused hours per month. That's enough to ship 1-2 meaningful features if you use Claude Code effectively during those hours.

### Music Strategy

You're trying to learn two things at once (Telepathic Instruments synth + Logic Pro) while also producing mixes. Sequence them:

1. **Now → Month 3**: Focus on the synth. Learn it physically, get comfortable with the interface. Use your DJ mixes as the creative outlet (you're already doing 1 every 2 months — that's fine).

2. **Month 3 → Month 6**: Start recording synth into Logic Pro. This naturally teaches you Logic's recording, arrangement, and mixing. You're learning Logic *through* the synth rather than learning both from zero.

3. **Month 6+**: Start making original tracks in Logic. By then you know the synth and the DAW basics. Use Claude (Cowork) to help with music theory, sound design concepts, and Logic Pro workflows.

### Book Strategy (via Analogue)

Your book needs a different cadence than code. Writing benefits from consistency over intensity.

**Daily writing habit (15-20 min):**
- Use Analogue on your phone during baby's morning nap or commute
- Don't edit, just write. Editing is a separate session.
- Target: 200-300 words/day = a draft chapter every 2-3 weeks

**Weekly editing session (Week 1 evening block):**
- Review the week's writing in Analogue
- Use Claude (Opus) as an editor — paste sections and ask for structural feedback, not line edits
- Opus is genuinely good at "does this argument hold together" and "what's missing from this section"

---

## Part 5: Making Startup Time Count

The goal is to be "super slick at pushing code and doing the right meaningful tasks."

### Before you write code, ask: "Should I be writing this?"

Use Claude (Cowork/Opus) as a strategic sounding board:
- "Here are the 5 things I could work on today. Which moves the needle most for [company goal]?"
- "Is this feature worth building or should we use an existing tool?"
- "What's the simplest version of this that validates the hypothesis?"

### When you do write code, go fast

1. **Start every Claude Code session with context**: `cd` into the right project. Let Claude read the CLAUDE.md. Tell it what you're building and why in 2 sentences.

2. **Use the agentic loop**: For well-defined tasks, give Claude the full spec and let it implement. Review the diff rather than pair-programming every line.

3. **Batch PRs by theme**: Instead of 5 small PRs across different concerns, batch related changes. Your git history shows lots of sequential fix commits (5 white-screen fixes across 5 PRs). One PR with a proper fix would have been faster.

4. **Timebox debugging**: If a bug takes more than 30 minutes, step back and describe the full problem to Claude (Opus). Fresh context often finds what you've been missing.

---

## Part 6: Protecting Baby Time

A 4-month-old changes fast. Here's the non-negotiable framework:

1. **Morning routine is baby time.** No Slack, no PRs, no "quick fixes." The startup will survive.

2. **Saturday morning is sacred.** Full presence, no screens. This is the memory-forming time.

3. **Use Pupils**: You built a baby photo app. Use it daily. The photo habit is both a product dogfooding exercise and a way to be present. Two birds.

4. **Set a hard stop in the evening.** When you sit down for your 1-2 hour personal project block, set a timer. When it rings, close the laptop. The project will be there tomorrow. The baby won't be 4 months old tomorrow.

5. **Use Claude to buy time back.** Every hour Claude saves you on email triage, mongo queries, or boilerplate code is an hour you could spend on the floor with your kid. That's the real ROI of this entire plan.

---

## Part 7: Implementation Checklist

### This Week (Infrastructure)

- [x] Create MEMORY.md with persistent context
- [x] Add per-project CLAUDE.md files
- [ ] Pin dependency versions in Pupils package.json
- [ ] Document your 10 most common mongo queries as scripts
- [ ] Set up morning email triage routine with Cowork

### This Month (Habits)

- [ ] Establish the weekly project rotation
- [ ] Start 15-min daily writing habit in Analogue
- [ ] Fix Polymath background sync (event tag mismatch)
- [ ] Complete Pupils email reminder setup (Resend)

### This Quarter (Results)

- [ ] Book: 3 draft chapters written
- [ ] Music: Comfortable with Telepathic Instruments synth
- [ ] Apps: Each app gets 1-2 meaningful features
- [ ] Work: Email + mongo workflows fully automated
- [ ] DJ: 1-2 mixes completed

---

## Summary

The plan is not about doing more. It's about:

1. **Eliminating friction** — memory files, project context, automated queries
2. **Sequencing properly** — synth before Logic, writing before editing, one app per week
3. **Protecting what matters** — baby time is scheduled first, not squeezed in
4. **Using the right tool** — Opus for thinking, Sonnet for speed, Claude Code for implementation
5. **Saying no to scattered work** — one project per evening, one music focus per quarter

The infrastructure changes in this PR (memory files, per-project CLAUDE.md) directly address your biggest Claude Code pain point: having to re-explain context every session. The rest is discipline and scheduling — which no tool can automate, but a good plan can support.
