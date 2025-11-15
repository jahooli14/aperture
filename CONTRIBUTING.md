# Contributing to Aperture

This is a personal project. If you'd like to contribute:

## Process

1. **Open an issue first** to discuss the change
2. **Fork and create a PR** with clear description
3. **Follow existing code style** (see CLAUDE-APERTURE.md)
4. **Test your changes** locally before pushing
5. **Update docs** if adding features

## Standards

### Code Quality
- TypeScript strict mode
- Functional React components
- Follow patterns in existing code
- Commit messages: Conventional Commits format

### Observability (New Features)

**All new features MUST include comprehensive logging until they pass UAT.**

#### Logging Requirements

```typescript
// 1. Entry point
console.log('=== FEATURE_NAME START ===');
console.log('Input:', { relevantParams });

// 2. Decision points
console.log('Condition:', { value, result: true/false });

// 3. External calls
console.log('Calling API:', { url, method });
const response = await fetch(...);
console.log('API response:', {
  status: response.status,
  ok: response.ok
});

// 4. Errors
catch (error) {
  console.error('❌ Feature failed:', error);
  console.error('Context:', { relevantState });
}

// 5. Success
console.log('✅ FEATURE_NAME COMPLETE');
```

#### Logging Lifecycle
1. **Development**: Add comprehensive logs
2. **Deploy**: Logs stay intact
3. **Debug**: Claude uses logs to self-debug
4. **UAT**: User tests and approves
5. **Cleanup**: Remove debug logs, keep error logs
6. **Redeploy**: Production-ready

**Why**: Claude must never ask users to check external logs. Self-sufficient debugging is mandatory.

See `.process/DEVELOPMENT.md` → Observability Requirements for full details.

## Questions?

Open an issue or check the documentation in `.process/` directory.

That's it! 🚀
