# Update Documentation Command

**Purpose**: Check what changed and prompt for documentation updates

**Usage**: `/update-docs` or `/update-docs [project-name]`

---

## What This Command Does

1. **Analyzes recent changes** using git diff
2. **Identifies affected documentation** based on file changes
3. **Prompts for updates** to keep docs synchronized with code
4. **Validates completeness** before you commit

---

## When to Use

- Before committing code changes
- At end of development session
- After completing a feature
- When CI/CD flags outdated docs

---

## Execution Steps

### Step 1: Analyze Recent Changes

Check what files have changed since last commit:

```bash
# Show uncommitted changes
git diff --name-status

# Show changes since last commit on current branch
git diff HEAD --name-status

# Show last 3 commits
git log -3 --oneline --name-status
```

### Step 2: Detect Which Projects Changed

**Multi-project repository - identify affected projects:**

```bash
# Detect projects with changes
if git diff --cached --name-only | grep -q "^projects/wizard-of-oz/"; then
  echo "Wizard of Oz changed"
fi

if git diff --cached --name-only | grep -q "^projects/memory-os/"; then
  echo "MemoryOS changed"
fi

if git diff --cached --name-only | grep -q "^projects/visual-test-generator/"; then
  echo "Visual Test Generator changed"
fi

if git diff --cached --name-only | grep -q "^scripts/autonomous-docs/"; then
  echo "Autonomous Docs changed"
fi
```

### Step 3: Categorize Changes Per Project

**Based on changed files, identify documentation needs:**

| Project Changed | Files Changed | Documentation to Update |
|----------------|---------------|------------------------|
| **projects/wizard-of-oz/** | `src/`, `api/`, `*.ts` | `projects/wizard-of-oz/NEXT_SESSION.md` (required) |
| **projects/memory-os/** | `src/`, `api/`, `*.ts` | `projects/memory-os/NEXT_SESSION.md` (required) |
| **projects/visual-test-generator/** | `src/`, `*.ts` | `projects/visual-test-generator/NEXT_SESSION.md` (required) |
| **scripts/autonomous-docs/** | `src/`, `*.ts` | `scripts/autonomous-docs/NEXT_SESSION.md` (required) |
| **Root level** | Any code files | `NEXT_SESSION.md` (root - required) |
| **Any project** | `package.json` | Project's NEXT_SESSION.md + note dependencies |
| **Any project** | `.env.example` | Project's DEPLOYMENT.md/README.md |

### Step 4: Check Current Documentation Status

Read and assess current state **for each project**:

```bash
# For Wizard of Oz changes
git log -1 --format="%cr" projects/wizard-of-oz/NEXT_SESSION.md

# For MemoryOS changes
git log -1 --format="%cr" projects/memory-os/NEXT_SESSION.md

# For root changes
git log -1 --format="%cr" NEXT_SESSION.md
```

### Step 5: Prompt for Updates (Project-Specific)

**Example for Wizard of Oz:**

```
📝 Documentation Update Needed

📁 Project: projects/wizard-of-oz

Changed files detected:
  - projects/wizard-of-oz/src/components/PhotoUpload.tsx
  - projects/wizard-of-oz/api/upload-photo.ts

Documentation to update:
  1. projects/wizard-of-oz/NEXT_SESSION.md (REQUIRED)
  2. projects/wizard-of-oz/README.md (optional - if public API changed)

Would you like to:
  a) Update now (I'll help)
  b) Skip (add to git commit message instead)
  c) Cancel commit (update manually first)
```

**Example for multiple projects:**

```
📝 Documentation Update Needed

📁 Projects affected:
  - projects/wizard-of-oz (3 files)
  - projects/memory-os (2 files)

Documentation to update:
  1. projects/wizard-of-oz/NEXT_SESSION.md (REQUIRED)
  2. projects/memory-os/NEXT_SESSION.md (REQUIRED)
  3. NEXT_SESSION.md (root - optional, for cross-project summary)

Would you like to update each project's docs? (y/n)
```

### Step 6: Guide Updates (Project-Aware)

**If user chooses (a) - Update now:**

1. Read current project's NEXT_SESSION.md (e.g., `projects/wizard-of-oz/NEXT_SESSION.md`)
2. Identify insertion point (Recent Improvements section)
3. Draft update based on git diff for that project only
4. Show user, get approval
5. Update project-specific file

**For multiple projects:**
- Process each project separately
- Update each project's NEXT_SESSION.md
- Optionally update root NEXT_SESSION.md with summary

**If user chooses (b) - Skip:**
- Add reminder to commit message
- Warn that pre-commit hook will flag this

**If user chooses (c) - Cancel:**
- Don't proceed with commit
- Let user update manually

### Step 7: Validate Completeness (Per Project)

Before finishing, verify for EACH project:

- [ ] Project's NEXT_SESSION.md updated (e.g., `projects/wizard-of-oz/NEXT_SESSION.md`)
- [ ] Root NEXT_SESSION.md updated if multiple projects changed
- [ ] Last Updated date refreshed in each file
- [ ] Changes accurately describe what was done in that project
- [ ] Cross-project impacts noted (if any)

---

## Example Workflow

**Scenario 1**: User added photo editing feature to Wizard of Oz

```
User: /update-docs

Claude:
📊 Analyzing changes since last commit...

📁 Project: projects/wizard-of-oz

Changed files (3):
  ✓ projects/wizard-of-oz/src/components/PhotoBottomSheet.tsx (53 lines added)
  ✓ projects/wizard-of-oz/src/stores/usePhotoStore.ts (1 function added)
  ✓ projects/wizard-of-oz/NEXT_SESSION.md (already updated)

✅ Documentation appears up to date!
  - projects/wizard-of-oz/NEXT_SESSION.md mentions "note editing feature"
  - Changes logged in "Recent Improvements" section
  - Last updated: 2 hours ago

No additional updates needed.
```

**Scenario 2**: Changes to multiple projects

```
User: /update-docs

Claude:
📊 Analyzing changes since last commit...

📁 Projects affected (2):

1. projects/wizard-of-oz
   - src/components/PhotoUpload.tsx
   ⚠️ projects/wizard-of-oz/NEXT_SESSION.md NOT updated

2. scripts/autonomous-docs
   - src/index.ts
   ✅ scripts/autonomous-docs/NEXT_SESSION.md already updated

📝 Action needed:
  - Update projects/wizard-of-oz/NEXT_SESSION.md

Proceed with update? (y/n)
```

---

## Integration with Pre-Commit Hook

This command complements the pre-commit hook:

**Pre-commit hook**: Catches forgotten doc updates (blocks commits)
**This command**: Proactive check before commit (helps you update)

**Workflow**:
1. Make code changes
2. Run `/update-docs` (proactive)
3. Commit (pre-commit hook validates)

---

## Related Commands

- `/commit` - Generate conventional commit message
- `/vercel-logs` - Check production after deployment
- `/verify-infra` - Validate infrastructure

---

## Configuration

**Files checked (project-aware)**:
- `projects/wizard-of-oz/NEXT_SESSION.md` - If Wizard of Oz code changed
- `projects/memory-os/NEXT_SESSION.md` - If MemoryOS code changed
- `projects/visual-test-generator/NEXT_SESSION.md` - If Visual Test Generator changed
- `projects/self-healing-tests/README.md` - If Self-Healing Tests changed (no NEXT_SESSION)
- `scripts/autonomous-docs/NEXT_SESSION.md` - If Autonomous Docs changed
- `NEXT_SESSION.md` (root) - If root-level code changed OR multi-project summary needed
- `README.md` - If public API changed
- `.process/*.md` - If process/methodology changed

**Sensitivity levels**:
- High: src/, api/, lib/ changes → MUST update docs
- Medium: config changes → SHOULD update docs
- Low: test/tooling changes → OPTIONAL update docs

---

**Last Updated**: 2025-10-20
**Related**: `.scripts/pre-commit`, `.github/workflows/doc-check.yml`
