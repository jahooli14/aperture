# 📚 Documentation Maintenance - Aperture

> **Purpose**: Comprehensive guide for maintaining and updating documentation - what to update, when, and how it's enforced
>
> **Last Updated**: 2025-10-24

---

## 🎯 Philosophy

**Documentation is not optional** - it's part of the definition of "done"

**Problem this solves**:
- Code changes without doc updates lead to drift
- Relying on memory/discipline fails at scale
- Future developers (including future you) waste time

**Solution**:
- Automated enforcement at multiple checkpoints
- Proactive tools to make updates easy
- CI/CD validation to catch gaps

---

## 🚨 CRITICAL - NEXT_SESSION.md Routing Pattern

**Root NEXT_SESSION.md is a ROUTER, not detailed content**:

**Pattern**: Root = lightweight index → Project files = actual content

### DO: Update project-specific files with detailed progress
- `projects/wizard-of-oz/NEXT_SESSION.md` ← Full details HERE
- `projects/polymath/NEXT_SESSION.md` ← Full details HERE
- `projects/visual-test-generator/NEXT_SESSION.md` ← Full details HERE
- `scripts/autonomous-docs/NEXT_SESSION.md` ← Full details HERE

### DO: Update root NEXT_SESSION.md "Last Active" (one line summary)
Example: "Session 23 (2025-10-21): Wizard of Oz - Comment chips, email reminders, build fixes"

### DON'T: Put detailed status in root file
The root file is just a router!

---

## 📋 When to Update Documentation

### After Creating a New Project

1. **Create in PROJECT_IDEAS.md**:
   ```markdown
   ### Project Name
   **Category**: Enhancement | New Project | Meta
   **Status**: Active | Incubating | Future
   **Description**: Brief description
   ```

2. **When implementing, update these files**:
   - [ ] Create `projects/[name]/README.md` (use PROJECT_TEMPLATE.md)
   - [ ] Create `projects/[name]/NEXT_SESSION.md`
   - [ ] Update `CLAUDE-APERTURE.md` (add to Projects section)
   - [ ] Update `NEXT_SESSION.md` (add to project table)
   - [ ] Update `PROJECT_IDEAS.md` (move to "Completed Ideas")
   - [ ] Update active project count in `CLAUDE-APERTURE.md`

### After Major Feature Changes

1. **Update project-specific docs**:
   - [ ] `projects/[name]/README.md` - Feature list, setup instructions
   - [ ] `projects/[name]/NEXT_SESSION.md` - Current status, what's complete
   - [ ] `projects/[name]/CHANGELOG.md` (if it exists)

2. **Update root documentation** (if needed):
   - [ ] `CLAUDE-APERTURE.md` - Update status, deployment info
   - [ ] `NEXT_SESSION.md` - Add session accomplishments

### After Extracting/Moving Code

1. **Update source project**:
   - [ ] Remove old documentation/files
   - [ ] Update CHANGELOG noting extraction
   - [ ] Add reference to new location

2. **Update destination project**:
   - [ ] Create complete README
   - [ ] Create NEXT_SESSION.md
   - [ ] Update all root documentation (see "Creating New Project" above)

---

## 📊 What to Update When

### Code Changes (Project-Specific)

| Type of Change | Update Required |
|----------------|-----------------|
| **New feature** | Project's NEXT_SESSION.md (mandatory), README.md (if public-facing) |
| **Bug fix** | Project's NEXT_SESSION.md (mandatory) |
| **Refactor** | Project's NEXT_SESSION.md (what/why) |
| **API change** | Project's NEXT_SESSION.md + API docs |
| **Dependencies** | Project's NEXT_SESSION.md (note version bumps) |
| **Configuration** | Project's NEXT_SESSION.md + relevant process doc |

**Example**:
- Changed `projects/wizard-of-oz/src/components/PhotoUpload.tsx` → Update `projects/wizard-of-oz/NEXT_SESSION.md`
- Changed `projects/polymath/src/stores/memoryStore.ts` → Update `projects/polymath/NEXT_SESSION.md`
- Changed multiple projects → Update each project's NEXT_SESSION.md + optionally root NEXT_SESSION.md

### Non-Code Changes

| Type of Change | Update Required |
|----------------|-----------------|
| **Process improvement** | `.process/[relevant].md` |
| **Architecture decision** | `.process/DECISION_LOG.md` |
| **Lesson learned** | `.process/COMMON_MISTAKES.md` |
| **New pattern** | `.process/CAPABILITIES.md` |

---

## 🔄 Enforcement Mechanisms

### 1. During Development

**As you code**:
- Update project-specific NEXT_SESSION.md after completing each feature/fix
- Use `/update-docs` command before committing

### 2. Before Commit (Pre-Commit Hook)

**Automated check**:
```bash
Code changed? → Detect which project(s) → Check project docs → Prompt/block if missing
```

**Project detection**:
- Analyzes staged files to identify which project(s) changed
- Checks for code changes in each project independently
- Prompts for the correct project-specific NEXT_SESSION.md

**What it checks**:
- Any `.ts`, `.tsx`, `.js`, `.jsx` files in project `src/`, `api/`, `lib/`
- `package.json` changes (dependencies)
- Whether project-specific `NEXT_SESSION.md` or root docs were staged

**Actions**:
- ✅ Docs updated → Proceed with commit
- ⚠️ No docs → Prompt user showing which project(s) need updates
- ❌ User declines → Block commit

**To bypass** (use sparingly):
```bash
git commit --no-verify
```

### 3. On Push (GitHub Actions)

**Automated validation**:
```yaml
# .github/workflows/doc-check.yml
- Check doc freshness (< 7 days if code actively changing)
- Validate no broken links
- Ensure required docs exist
- Check path consistency
```

**Runs on**:
- Every push to main/develop
- Every pull request

**Failures**:
- Broken links → Blocks merge
- Missing required docs → Blocks merge
- Stale docs → Warning only (doesn't block)

### 4. Daily (Autonomous Docs)

**External knowledge updates**:
- Fetches latest AI/Claude best practices
- Updates docs with frontier knowledge
- Runs at 09:00 UTC daily

**Note**: This updates external knowledge, not internal code changes

---

## 🛠️ Tools Available

### `/update-docs` Command

**When to use**: Before committing, end of session

**What it does**:
1. Analyzes `git diff` for changes
2. Identifies which docs need updates
3. Prompts for updates
4. Validates completeness

### Pre-Commit Hook

**Automatic** - runs on every `git commit`

**Installed via**:
```bash
.scripts/install-hooks.sh
```

**Checks**:
- Code changes → Requires doc updates
- Dependency changes → Warns about docs
- Interactive prompts if docs missing

### GitHub Action

**Automatic** - runs on push/PR

**Validates**:
- Documentation structure
- Link consistency
- Freshness (warning only)
- Required files exist

---

## ✅ Checklist: Did I Update Docs?

**Before every commit, verify**:

- [ ] Code changes reflected in **project-specific** NEXT_SESSION.md
- [ ] "Last Updated" date refreshed in the appropriate file(s)
- [ ] Breaking changes noted (if any)
- [ ] Each changed project has its NEXT_SESSION.md updated
- [ ] README updated (if public API changed)

**Multi-project checklist**:
- [ ] Wizard of Oz changes → `projects/wizard-of-oz/NEXT_SESSION.md` updated?
- [ ] Polymath changes → `projects/polymath/NEXT_SESSION.md` updated?
- [ ] Visual Test Generator changes → `projects/visual-test-generator/NEXT_SESSION.md` updated?
- [ ] Autonomous Docs changes → `scripts/autonomous-docs/NEXT_SESSION.md` updated?
- [ ] Root-level changes → `NEXT_SESSION.md` (root) updated?

**Use `/update-docs` to automate this check**

---

## 🚨 When to Skip Doc Updates

**Legitimate reasons**:
- Typo fixes (no behavior change)
- Comment-only changes
- Formatting/linting
- Test-only changes (usually)

**How to skip**:
```bash
git commit --no-verify -m "fix: typo in comment"
```

**Rule**: If in doubt, update docs. Over-communication > under-communication.

---

## 📁 Documentation Structure

### Root Level Documentation

| File | Purpose | Update Frequency |
|------|---------|------------------|
| `CLAUDE.md` | Router for NUDJ vs Aperture | Rarely |
| `CLAUDE-APERTURE.md` | Main Aperture project guide | Every new project or major change |
| `NEXT_SESSION.md` | Session history and quick start | Every session |
| `START_HERE.md` | Onboarding guide | Rarely |
| `PROJECT_IDEAS.md` | Idea tracking | When new ideas arise |
| `PROJECT_TEMPLATE.md` | New project template | When template improves |
| `DOCUMENTATION_MAINTENANCE.md` | This file | When doc process changes |

### Project Level Documentation

Each project should have:

| File | Purpose | Required? |
|------|---------|-----------|
| `README.md` | Complete project overview | ✅ Yes |
| `NEXT_SESSION.md` | Current status, next steps | ✅ Yes |
| `CHANGELOG.md` | Version history | Optional |
| `DEPLOYMENT.md` | Deployment guide | If deployed |
| `.env.example` | Environment template | If uses env vars |

---

## 🔧 Maintenance Checklists

### Monthly Review

- [ ] Review all project statuses in `CLAUDE-APERTURE.md`
- [ ] Update deployment URLs if changed
- [ ] Archive old session notes in `NEXT_SESSION.md`
- [ ] Review `PROJECT_IDEAS.md` and promote/reject ideas

### Quarterly Review

- [ ] Audit all README files for accuracy
- [ ] Update tech stack versions
- [ ] Consolidate duplicate documentation
- [ ] Review and update project categories

---

## 💡 Documentation Best Practices

### Keep It DRY (Don't Repeat Yourself)

- **Single source of truth**: Each piece of info should live in ONE place
- **Link, don't duplicate**: Reference other docs instead of copying
- **Canonical locations**:
  - Project overview → `projects/[name]/README.md`
  - Current status → `projects/[name]/NEXT_SESSION.md`
  - Project list → `CLAUDE-APERTURE.md`
  - Session history → Root `NEXT_SESSION.md`

### Make It Scannable

- Use headers, bullets, tables
- Put most important info first
- Use emojis sparingly for navigation (🎯 🔥 ✅ ⏳)
- Keep paragraphs short

### Keep It Current

- Date stamp updates
- Remove stale information
- Mark deprecated features
- Archive old content instead of deleting

---

## 🗺️ Documentation Map

### For Claude Starting a Session

**Auto-read**: `.claude/startup.md`
**Then read**: Root `NEXT_SESSION.md`
**Choose project**: `projects/[name]/NEXT_SESSION.md`

### For Understanding a Project

1. `projects/[name]/README.md` - What it is, how it works
2. `projects/[name]/NEXT_SESSION.md` - Current status
3. `CLAUDE-APERTURE.md` - How it fits into Aperture

### For Creating a New Project

1. Add idea to `PROJECT_IDEAS.md`
2. When ready, use `PROJECT_TEMPLATE.md`
3. Update all root docs (checklist above)

### For Debugging

1. `.process/META_DEBUGGING_PROTOCOL.md` - ALWAYS read first
2. `projects/[name]/NEXT_SESSION.md` - Known issues
3. Project-specific troubleshooting docs

---

## 🎨 Documentation Style Guide

### Headers

```markdown
# Top Level - Only One Per File
## Main Sections
### Subsections
#### Details (use sparingly)
```

### Status Indicators

- 🟢 Production / Active / Working
- 🟡 In Progress / Staging
- 🔴 Broken / Blocked
- 🆕 New
- ⏳ Pending / Planned
- ✅ Complete
- 📋 Documented / Scoped
- 🚧 Under Construction

### Code Blocks

Always specify language:
````markdown
```typescript
// TypeScript code
```

```bash
# Shell commands
```
````

### Links

Use relative links within repo:
```markdown
[Project README](projects/wizard-of-oz/README.md)
[Process Guide](.process/COMMON_MISTAKES.md)
```

Use absolute URLs for external:
```markdown
[Live Site](https://aperture-wizard-of-oz.vercel.app)
```

---

## 🔧 Setup (For New Contributors)

### 1. Install Hooks

```bash
.scripts/install-hooks.sh
```

This installs:
- Pre-commit hook (doc validation)
- Commit-msg hook (conventional commits)

### 2. Verify Installation

```bash
ls -la .git/hooks/
# Should see: pre-commit, commit-msg
```

### 3. Test It

```bash
# Make a code change without updating docs
echo "// test" >> src/test.ts
git add src/test.ts
git commit -m "test"

# Should prompt you to update docs!
```

---

## 📊 Enforcement Levels

| Mechanism | When | Action | Can Skip? |
|-----------|------|--------|-----------|
| **Pre-commit hook** | Before commit | Prompts/blocks | Yes (--no-verify) |
| **GitHub Action** | On push/PR | Validates/warns | No |
| **Session checklist** | Manual | Reminds | Yes |
| **/update-docs** | On-demand | Helps | Yes |

**Philosophy**: Multiple checkpoints with escalating enforcement

---

## 🎓 Best Practices

### 1. Update as You Go

**Good**:
```
Make feature → Update NEXT_SESSION.md → Commit both
```

**Bad**:
```
Make 5 features → Try to remember what changed → Update docs → Miss things
```

### 2. Use the Tools

```bash
# Before committing
/update-docs

# At session end
/update-docs
```

### 3. Be Specific

**Good**:
```markdown
Added photo editing feature - users can now edit notes after upload
```

**Bad**:
```markdown
Updated photo stuff
```

### 4. Update Dates

Always refresh "Last Updated" when modifying docs:
```markdown
> **Last Updated**: 2025-10-24
```

---

## 🔍 Troubleshooting

### "Pre-commit hook keeps blocking me"

**Check**:
1. Did you update the **correct project-specific** NEXT_SESSION.md?
2. Did you stage it? (`git add projects/wizard-of-oz/NEXT_SESSION.md`)
3. The hook will tell you which project's docs need updating
4. If legitimately no doc update needed, use `--no-verify`

**Example**:
```
# If you changed Wizard of Oz code:
git add projects/wizard-of-oz/NEXT_SESSION.md

# If you changed Polymath code:
git add projects/polymath/NEXT_SESSION.md

# If you changed multiple projects:
git add projects/wizard-of-oz/NEXT_SESSION.md projects/polymath/NEXT_SESSION.md
```

### "GitHub Action failing on doc check"

**Common causes**:
1. Broken links (old file paths)
2. Missing required files
3. Inconsistent paths

**Fix**:
```bash
# Check for broken references
grep -r 'SESSION_CHECKLIST\.md' *.md | grep -v "\.process/"
```

### "I don't know what docs to update"

**Use**:
```bash
/update-docs
```

It will analyze your changes and tell you what needs updating.

---

## 🔄 Template Workflow

### Adding a New Project

```bash
# 1. Add to PROJECT_IDEAS.md
# Edit PROJECT_IDEAS.md, add to "Active Ideas"

# 2. When ready to implement
mkdir -p projects/new-project/{src,api,lib,scripts}
cd projects/new-project

# 3. Copy template files
# Copy structure from PROJECT_TEMPLATE.md

# 4. Create core files
npm init -y
# Edit package.json, add tsconfig.json, vite.config.ts

# 5. Create documentation
# Create README.md from template
# Create NEXT_SESSION.md from template

# 6. Update root documentation
# Edit CLAUDE-APERTURE.md - add to Projects section
# Edit NEXT_SESSION.md - add to project table
# Edit PROJECT_IDEAS.md - move to Completed Ideas

# 7. Commit
git add .
git commit -m "feat: initialize new-project"
```

---

## 📊 Documentation Health Metrics

Check these quarterly:

- [ ] All projects have README.md
- [ ] All projects have NEXT_SESSION.md
- [ ] All deployed projects have deployment URLs documented
- [ ] No broken links in documentation
- [ ] No outdated version numbers
- [ ] PROJECT_IDEAS.md reflects current ideas
- [ ] Session history is up to date

---

## 📚 Related Documentation

- `.process/SESSION_CHECKLIST.md` - Session workflow
- `.claude/commands/update-docs.md` - Update docs command
- `.scripts/pre-commit` - Pre-commit hook implementation
- `.github/workflows/doc-check.yml` - CI/CD validation

---

## 🔄 Continuous Improvement

This protocol itself follows the same rules:

- ✅ Last Updated date at top
- ✅ Changes logged in NEXT_SESSION.md
- ✅ CI/CD validates this file exists
- ✅ Pre-commit hook applies to changes here

**Dogfooding**: We use our own documentation enforcement on our documentation system.

---

**Keep documentation alive! Update it as you build, not after.**
