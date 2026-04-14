## Summary

<!-- What does this PR do? One paragraph max. -->

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that causes existing behavior to change)
- [ ] Documentation update
- [ ] Refactor / cleanup (no behavior change)
- [ ] CI / tooling

## Related issue

Fixes # <!-- issue number, if applicable -->

## How to test

<!-- Describe how a reviewer can verify this works. Include commands if relevant. -->

```bash
npm test
# or specific test:
npm test -- <test-file>
```

## Checklist

- [ ] Tests pass locally (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] TypeScript compiles without errors (`npx tsc --noEmit`)
- [ ] No new dependencies added (or justified in summary if added)
- [ ] No secrets, tokens, or credentials in the diff
- [ ] Hooks still wrapped in try/catch and cannot crash
- [ ] CHANGELOG.md updated (for non-trivial changes)

## Notes for reviewer

<!-- Anything the reviewer should pay special attention to? -->
