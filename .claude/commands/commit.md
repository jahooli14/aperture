# Generate Conventional Commit Message

Analyze the staged changes and generate a commit message following Conventional Commits specification.

## Instructions

1. Run `git diff --staged` to see what's been staged
2. Analyze the changes and their impact
3. Generate a commit message with this structure:

```
<type>(<scope>): <subject>

<body>

<footer>
```

## Types
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation only
- **style**: Formatting, missing semicolons, etc (no code change)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvement
- **test**: Adding or updating tests
- **chore**: Build process, auxiliary tools, etc

## Rules
- Subject line: imperative mood ("add" not "added"), lowercase, no period, < 50 chars
- Body: explain WHAT and WHY (not HOW), wrap at 72 chars
- Footer: breaking changes, issue references

## Footer Template
```
Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

## Example Output
```
feat(auth): add email magic link authentication

- Implement Supabase Auth integration
- Add AuthForm component with email input
- Handle magic link redirects
- Add loading and error states

Closes #42

Generated with [Claude Code](https://claude.com/claude-code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>
```

---

Now analyze staged changes and generate the commit message.
