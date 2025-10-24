# 📚 Documentation Guide - Aperture

> **How to maintain and update documentation across the Aperture monorepo**
>
> **Last Updated**: 2025-10-22

---

## 🎯 Purpose

This guide ensures all documentation stays current and organized across multiple projects.

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
| `DOCUMENTATION_GUIDE.md` | This file | When doc process changes |

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

## 🤝 Contributing

When adding documentation:
1. Follow this guide
2. Use templates where available
3. Update all related docs
4. Test links
5. Spell check
6. Date stamp updates

---

**Keep documentation alive! Update it as you build, not after.**
