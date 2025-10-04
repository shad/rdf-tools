## 🐛 Critical Bug Fix: SPARQL Default Prefix Recognition

Fixed a critical bug where **user-defined global prefixes** configured in settings were not recognized during SPARQL query execution, causing "Unknown prefix" errors.

### What's Fixed
- ✅ Custom prefixes (like `shad:`, `ex:`, etc.) defined in settings now work correctly in SPARQL queries
- ✅ PREFIX declarations are automatically injected into queries before execution
- ✅ All global prefixes from settings are properly recognized by the SPARQL engine

### Example
If you have `shad: https://shadr.us/ns/` in your settings, this query now works:
```sparql
SELECT ?name WHERE {
    shad:alice foaf:name ?name .
}
```

---

## ✅ Obsidian Community Compliance

- **Non-minified code** - Main bundle is now readable for Obsidian review (required for community plugins)
- **Security improvements** - Replaced `innerHTML` with safer `textContent` for DOM manipulation
- **Type safety** - Added robust type guards for Obsidian file system objects

---

## 🧪 Testing

- Added **67 comprehensive tests** for prefix handling
- All **289 tests passing** ✅
- Extensive coverage of edge cases and error scenarios

---

## 📦 Installation

Download the release assets below and place them in `.obsidian/plugins/rdf-tools/` in your vault:
- `main.js` (3.2 MB)
- `manifest.json`
- `styles.css`

Then enable the plugin in **Settings → Community Plugins**.

---

## 📚 Documentation

- See [CHANGELOG.md](https://github.com/shad/rdf-tools/blob/main/CHANGELOG.md) for full version history
- See [RELEASE_NOTES_1.0.2.md](https://github.com/shad/rdf-tools/blob/main/RELEASE_NOTES_1.0.2.md) for detailed release notes

---

**Full Changelog**: https://github.com/shad/rdf-tools/compare/1.0.1...1.0.2
