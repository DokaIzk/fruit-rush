# Security Updates Applied

**Date:** August 4, 2026

## Updated Packages

### Critical Security Updates

| Package | Old Version | New Version | Reason |
|---------|-------------|-------------|--------|
| `eslint` | 8.56.0 | 10.8.0 | Deprecated, security patches |
| `supertest` | 6.3.4 | 7.2.2 | Deprecated, memory leaks fixed |
| `@typescript-eslint/eslint-plugin` | 6.17.0 | 8.66.0 | Compatibility with ESLint 9+ |
| `@typescript-eslint/parser` | 6.17.0 | 8.66.0 | Compatibility with ESLint 9+ |

### Added Packages

| Package | Version | Reason |
|---------|---------|--------|
| `@eslint/js` | 9.16.0 | Required for ESLint 9 flat config |
| `typescript-eslint` | 8.66.0 | New unified package for TypeScript ESLint |

## Configuration Changes

### ESLint Migration (v8 → v10)

**Old:** `.eslintrc.json` (deprecated format)  
**New:** `eslint.config.mjs` (flat config format)

The new flat config is simpler and more performant:

```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    ignores: ['dist/', 'node_modules/', 'coverage/'],
  }
);
```

## Transitive Dependencies

The following warnings are from **transitive dependencies** (dependencies of dependencies):

| Warning | Package | Status |
|---------|---------|--------|
| `inflight` memory leak | From `glob@7` | ⚠️ Transitive (cannot directly fix) |
| `rimraf@3` deprecated | From various packages | ⚠️ Transitive (cannot directly fix) |
| `glob@7` security issues | From various packages | ⚠️ Transitive (cannot directly fix) |
| `uuid@10` deprecated | From `testcontainers` | ⚠️ Transitive (test-only dependency) |

### Why Can't We Fix Transitive Dependencies?

These are dependencies of other packages we use. They will be fixed when:
1. The parent packages update their own dependencies
2. Major version bumps of parent packages

### Mitigation Strategy

1. **Most transitive warnings are from dev dependencies** (test tooling) — not in production
2. **Security:** Run `npm audit` regularly and apply fixes when available
3. **Monitor:** Check for updates to parent packages (especially `testcontainers`, `jest`)
4. **Production:** These warnings don't affect production builds (only dev/test)

## Running Updated Tools

### Lint (with ESLint 10)

```bash
npm run lint
```

### Tests (with Supertest 7)

```bash
npm test
```

### Type Check

```bash
npm run typecheck
```

## Future Maintenance

### Monthly Security Audit

```bash
# Check for vulnerabilities
npm audit

# Auto-fix where possible
npm audit fix

# For breaking changes, review manually
npm audit fix --force  # Use with caution!
```

### Quarterly Dependency Updates

```bash
# Check outdated packages
npm outdated

# Update to latest within semver range
npm update

# For major version updates, test thoroughly
npm install <package>@latest --save-dev
```

### Annual Major Updates

- Review breaking changes in changelogs
- Update all dependencies to latest major versions
- Run full test suite
- Update CI/CD pipelines if needed

## Verification

After applying these updates:

1. ✅ Run `npm install` to install new packages
2. ✅ Run `npm run typecheck` to verify TypeScript compiles
3. ✅ Run `npm run lint` to verify ESLint works with new config
4. ✅ Run `npm test` to verify all tests pass
5. ✅ Run `npm run build` to verify production build

## Security Best Practices

### Development

- [ ] Never commit `node_modules/` (already in `.gitignore`)
- [ ] Use `package-lock.json` for reproducible builds
- [ ] Run `npm audit` before each release
- [ ] Use `npm ci` in CI/CD (not `npm install`)

### Production

- [ ] Use exact versions in `package.json` for critical deps
- [ ] Pin Node.js version in `Dockerfile` (e.g., `FROM node:18.19.0`)
- [ ] Use multi-stage Docker builds (separate build and runtime)
- [ ] Scan Docker images for vulnerabilities (Trivy, Snyk)

### Monitoring

- [ ] Set up Dependabot or Renovate for automated PR updates
- [ ] Configure Snyk/GitHub Security Alerts
- [ ] Review security advisories weekly
- [ ] Test updates in staging before production

## References

- [ESLint v9 Migration Guide](https://eslint.org/docs/latest/use/migrate-to-9.0.0)
- [Supertest v7 Changelog](https://github.com/ladjs/supertest/releases/tag/v7.0.0)
- [npm Audit Documentation](https://docs.npmjs.com/cli/v10/commands/npm-audit)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

**Last updated:** August 4, 2026  
**Next review:** September 1, 2026
