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

### Step 2: Categorize Changes

**Based on changed files, identify documentation needs:**

| Files Changed | Documentation to Update |
|---------------|------------------------|
| `src/**/*.{ts,tsx,js,jsx}` | NEXT_SESSION.md, project README |
| `api/**/*` | NEXT_SESSION.md, API documentation |
| `package.json` | NEXT_SESSION.md (note dependency changes) |
| `.env.example` | projects/[name]/DEPLOYMENT.md |
| Configuration files | NEXT_SESSION.md, relevant process docs |

### Step 3: Check Current Documentation Status

Read and assess current state:

```bash
# Check when docs were last updated
git log -1 --format="%cr" NEXT_SESSION.md

# Check if docs mention recent changes
grep -i "[recent feature name]" NEXT_SESSION.md
```

### Step 4: Prompt for Updates

**Ask user**:

```
📝 Documentation Update Needed

Changed files detected:
  - src/components/PhotoUpload.tsx
  - api/upload-photo.ts

Documentation to update:
  1. NEXT_SESSION.md - Add note about photo upload improvements
  2. projects/wizard-of-oz/README.md - Update features list (optional)

Would you like to:
  a) Update now (I'll help)
  b) Skip (add to git commit message instead)
  c) Cancel commit (update manually first)
```

### Step 5: Guide Updates

**If user chooses (a) - Update now:**

1. Read current NEXT_SESSION.md
2. Identify insertion point (Recent Improvements section)
3. Draft update based on git diff
4. Show user, get approval
5. Update file

**If user chooses (b) - Skip:**
- Add reminder to commit message
- Warn that pre-commit hook will flag this

**If user chooses (c) - Cancel:**
- Don't proceed with commit
- Let user update manually

### Step 6: Validate Completeness

Before finishing:

- [ ] NEXT_SESSION.md updated (if code changed)
- [ ] Project-specific docs updated (if needed)
- [ ] Last Updated date refreshed
- [ ] Changes are accurate and complete

---

## Example Workflow

**Scenario**: User added photo editing feature

```
User: /update-docs

Claude:
📊 Analyzing changes since last commit...

Changed files (3):
  ✓ src/components/PhotoBottomSheet.tsx (53 lines added)
  ✓ src/stores/usePhotoStore.ts (1 function added: updatePhotoNote)
  ✓ NEXT_SESSION.md (already updated)

✅ Documentation appears up to date!
  - NEXT_SESSION.md mentions "note editing feature"
  - Changes logged in "Recent Improvements" section
  - Last updated: 2 hours ago

No additional updates needed.
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

**Files checked**:
- `NEXT_SESSION.md` - Always
- `projects/*/NEXT_SESSION.md` - If project-specific changes
- `README.md` - If public API changed
- `.process/*.md` - If process/methodology changed

**Sensitivity levels**:
- High: src/, api/, lib/ changes → MUST update docs
- Medium: config changes → SHOULD update docs
- Low: test/tooling changes → OPTIONAL update docs

---

**Last Updated**: 2025-10-20
**Related**: `.scripts/pre-commit`, `.github/workflows/doc-check.yml`
