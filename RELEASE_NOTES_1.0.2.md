# RDF Tools v1.0.2 Release Notes

## 🐛 Critical Bug Fixes

### SPARQL Default Prefix Recognition
Fixed a critical bug where user-defined global prefixes configured in settings were not being recognized during SPARQL query execution, resulting in "Unknown prefix" errors.

**What was broken:**
- Prefixes like `shad:`, `ex:`, or any custom prefix defined in settings would fail with "Unknown prefix" error
- The parser would inject prefixes for validation, but the executor would use the original query without PREFIX declarations
- Comunica (the SPARQL engine) would receive queries without the necessary PREFIX declarations

**What's fixed:**
- SPARQL queries now properly include all global prefixes when executed
- Added `expandedQueryString` field to store queries with PREFIX declarations
- `QueryExecutorService` now uses the expanded query string for execution
- All user-defined prefixes from settings are now correctly recognized

**Impact:** This was affecting any user who defined custom prefixes in settings and used them in SPARQL queries.

---

## ✅ Obsidian Community Compliance

### Code Readability
- **Disabled minification** in production builds - code is now fully readable for Obsidian review team
- Main bundle increased from 1.4MB (minified) to 3.2MB (readable) - this is expected and required

### Security Improvements
- Replaced remaining `innerHTML` usage with safer `textContent` for DOM manipulation
- Added comprehensive type guards for Obsidian file system objects
- Enhanced error handling with proper DOM methods

---

## 🧪 Testing & Quality

### New Test Coverage
Added **67 comprehensive tests** for prefix handling:

- **`RdfToolsService` tests** (40 tests total):
  - Prefix integration tests (12 tests)
  - SPARQL prefix integration (18 tests)
  - Real settings bug reproduction (6 tests)
  - User bug fix validation (4 tests)

- **`SparqlParserService` tests** (18 tests):
  - Prefix injection and expansion
  - Global prefix integration
  - Edge cases and error handling

- **`VaultGraphService` tests** (9 tests):
  - Prefix passing to markdown parser
  - File type handling (.md vs .ttl)
  - Error scenarios

**Test Results:** All 289 tests passing ✅

---

## 🔧 Technical Improvements

### Type Safety
Added robust TypeScript type guards:
```typescript
isTFile()           // Check if object is a TFile
isTFolder()         // Check if object is a TFolder
safeTFileFromPath() // Safely get TFile from path
safeTFolderFromPath() // Safely get TFolder from path
```

These prevent runtime errors when working with Obsidian's file system API.

### Build Configuration
- Excluded test files from production build
- Enhanced esbuild configuration with compliance comments
- Improved artifact verification

---

## 📚 Documentation

### Enhanced Project Documentation
- Expanded `CLAUDE.md` with 180 lines of comprehensive documentation
- Added detailed architecture and development guidelines
- Documented prefix handling flow and debugging procedures
- Created `CHANGELOG.md` for version tracking

---

## 🚀 Installation

### For Obsidian Users
1. Download `main.js`, `manifest.json`, and `styles.css` from this release
2. Place them in `.obsidian/plugins/rdf-tools/` in your vault
3. Enable the plugin in Obsidian Settings → Community Plugins

### For Developers
```bash
git clone https://github.com/shad/rdf-tools.git
cd rdf-tools
npm install
npm run build
```

---

## 🔗 Links

- **Repository:** https://github.com/shad/rdf-tools
- **Issues:** https://github.com/shad/rdf-tools/issues
- **Documentation:** See README.md and CLAUDE.md

---

## 📋 Full Changelog

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

---

## ⚠️ Breaking Changes

None. This release is fully backward compatible with v1.0.1.

---

## 🙏 Acknowledgments

Thanks to all users who reported the prefix recognition issue and provided detailed debugging information. Your feedback was essential in identifying and fixing this bug.
