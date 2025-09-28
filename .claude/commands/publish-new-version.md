## Pre-Release Checklist for RDF Tools

# 🚀 Release Preparation Checklist

- [ ] Run the `obsidian-release-validator` agent to make sure our code is in good shape for release.

- [ ] Run `npm run check-all` to make sure we're in good shape. All checks and tests should be passing.
- [ ] Build the plugin
  ```bash
  npm run build
  ```

- [ ] Update the version in `package.json` 
- [ ] Run `npm run version` to update other versions.
- [ ] Unless the user requests otherwise, please just bump the build (1.0.0 - 1.0.1)
- [ ] Verify all versions match: 
  ```bash
  grep -h version manifest.json package.json versions.json
  ```

Additional instructions: $ARGUMENTS


### 📝 Documentation

- [ ] Update `CHANGELOG.md` with:
  - [ ] New features
  - [ ] Bug fixes
  - [ ] Breaking changes
  - [ ] Migration instructions (if applicable)
- [ ] Update `README.md` if features changed
- [ ] Review and update API documentation if applicable

### 🔍 Final Checks

- [ ] No sensitive data in code (API keys, tokens)
- [ ] No debug console.log statements in production code
- [ ] License file present and correct

### 📦 Build Artifacts

- [ ] Create production build
  ```bash
  npm run build --production
  ```
- [ ] Verify `main.js` exists and is minified
- [ ] Verify `styles.css` exists (if applicable)
- [ ] Verify `manifest.json` is valid JSON

### 🏷️ Git Operations

- [ ] All changes committed
  ```bash
  git status
  ```
- [ ] Create git tag
  ```bash
  git tag -a v[VERSION] -m "Release version [VERSION]"
  ```
- [ ] Push commits
  ```bash
  git push origin main
  ```
- [ ] Push tag
  ```bash
  git push origin v[VERSION]
  ```

### 🚢 Release

#### GitHub Release
- [ ] Once the version has been published by gh action(pause until the version completes)
- [ ] Edit the description to include the changes that are in this version.
- [ ] Mark as release unless beta

#### NPM Release
- [ ] Ensure logged in to npm
  ```bash
  npm whoami
  ```
- [ ] Publish to npm
  ```bash
  npm publish --access public
  ```
- [ ] Verify package on npmjs.com

---

## Release Command Summary

```bash
# Final release command sequence
npm test
npm run check-all
npm run build

# Version bump (choose one)
npm version patch  # for bug fixes
npm version minor  # for new features
npm version major  # for breaking changes

# This will auto-commit and tag
git push origin main --tags

# Publish to npm
npm publish --access public
```

## Notes
- Obsidian plugin review may take 1-2 days
- NPM publish is immediate but can take ~15 min to be searchable
- Keep `versions.json` in sync for Obsidian auto-updates
