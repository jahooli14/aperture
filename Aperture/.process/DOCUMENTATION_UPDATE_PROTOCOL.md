# Documentation Update Protocol

> **Purpose**: Ensure documentation stays synchronized with code changes through automated enforcement

**Last Updated**: 2025-10-20

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

## 🔄 The Feedback Loop

### 1. **During Development**

**As you code**:
- Update NEXT_SESSION.md after completing each feature/fix
- Use `/update-docs` command before committing

### 2. **Before Commit** (Pre-Commit Hook)

**Automated check**:
```bash
Code changed? → Check if docs updated → Prompt/block if missing
```

**What it checks**:
- Any `.ts`, `.tsx`, `.js`, `.jsx` files in `src/`, `api/`, `lib/`
- `package.json` changes (dependencies)
- Whether `NEXT_SESSION.md` or other docs were staged

**Actions**:
- ✅ Docs updated → Proceed with commit
- ⚠️ No docs → Prompt user (y/n/skip)
- ❌ User declines → Block commit

**To bypass** (use sparingly):
```bash
git commit --no-verify
```

### 3. **On Push** (GitHub Actions)

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

### 4. **Daily** (Autonomous Docs)

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

**Example**:
```
User: /update-docs

Claude:
📊 Changes detected:
  - src/components/PhotoUpload.tsx
  - api/upload-photo.ts

📝 Documentation needed:
  - NEXT_SESSION.md (required)
  - README.md (optional)

Current status: NEXT_SESSION.md not updated
Proceed with update? (y/n)
```

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

## 📋 What to Update When

### Code Changes

| Type of Change | Update Required |
|----------------|-----------------|
| **New feature** | NEXT_SESSION.md (mandatory), README.md (if public-facing) |
| **Bug fix** | NEXT_SESSION.md (mandatory) |
| **Refactor** | NEXT_SESSION.md (what/why) |
| **API change** | NEXT_SESSION.md + API docs |
| **Dependencies** | NEXT_SESSION.md (note version bumps) |
| **Configuration** | NEXT_SESSION.md + relevant process doc |

### Non-Code Changes

| Type of Change | Update Required |
|----------------|-----------------|
| **Process improvement** | `.process/[relevant].md` |
| **Architecture decision** | `.process/DECISION_LOG.md` |
| **Lesson learned** | `.process/COMMON_MISTAKES.md` |
| **New pattern** | `.process/CAPABILITIES.md` |

---

## ✅ Checklist: Did I Update Docs?

**Before every commit, verify**:

- [ ] Code changes reflected in NEXT_SESSION.md
- [ ] "Last Updated" date refreshed
- [ ] Breaking changes noted (if any)
- [ ] Project-specific docs updated (if needed)
- [ ] README updated (if public API changed)

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
> **Last Updated**: 2025-10-20
```

---

## 🔍 Troubleshooting

### "Pre-commit hook keeps blocking me"

**Check**:
1. Did you update NEXT_SESSION.md?
2. Did you stage it? (`git add NEXT_SESSION.md`)
3. If legitimately no doc update needed, use `--no-verify`

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

**Installation**: See "Setup" section above
**Questions**: Check `/update-docs` command or ask in session
**Exceptions**: Use `--no-verify` sparingly, with good reason in commit message
