# Changelog

All notable changes to the RDF Tools plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.3] - 2025-10-05

### Changed
- Code cleanup and maintenance release
- Removed unused code and dependencies

## [1.0.2] - 2025-10-04

### Fixed
- **SPARQL Default Prefix Recognition** - Fixed critical bug where user-defined global prefixes (configured in settings) were not recognized during SPARQL query execution, causing "Unknown prefix" errors
  - Added `expandedQueryString` field to store queries with PREFIX declarations injected
  - Modified `QueryExecutorService` to use expanded query string when executing via Comunica
  - Prevents prefix resolution failures for custom prefixes like `shad:`, `ex:`, etc.

### Added
- **Comprehensive Prefix Integration Tests** - Added extensive test coverage for prefix handling across the plugin:
  - `RdfToolsService.prefix-integration.test.ts` (12 tests)
  - `RdfToolsService.sparql-prefix-integration.test.ts` (18 tests)
  - `RdfToolsService.real-settings-bug.test.ts` (6 tests)
  - `RdfToolsService.user-bug-fix.test.ts` (4 tests)
  - `SparqlParserService.prefix-integration.test.ts` (18 tests)
  - `VaultGraphService.prefix-integration.test.ts` (9 tests)
  - Total: 67 new tests ensuring prefix handling works correctly

- **TypeScript Type Guards** - Added robust type guards for Obsidian file system objects:
  - `isTFile()`, `isTFolder()`, `isValidAbstractFile()` type guards
  - `safeTFileFromPath()` and `safeTFolderFromPath()` utility functions
  - Prevents type-related runtime errors when working with Obsidian vault files

- **Claude AI Development Helpers** - Added AI-assisted development tools:
  - Obsidian release validator agent
  - Version publishing command
  - Improved development workflow automation

### Changed
- **Obsidian Compliance Improvements**:
  - Disabled code minification in production builds (Obsidian requires readable code for review)
  - Replaced remaining `innerHTML` usage with `textContent` for improved security
  - Enhanced error handling with proper DOM manipulation methods
  - Added comprehensive code comments explaining Obsidian compliance requirements

- **Build Configuration**:
  - Updated `tsconfig.json` to exclude test files from production build
  - Enhanced esbuild configuration with detailed compliance comments
  - Improved build artifact verification

### Documentation
- Expanded `CLAUDE.md` with comprehensive project documentation (180 lines added)
- Added detailed architecture and development guidelines
- Documented prefix handling flow and debugging procedures

## [1.0.1] - 2025-09-28

### Added
- Initial stable release
- RDF Turtle code block parsing
- SPARQL query execution with live results
- Named graph support with `vault://` URI scheme
- Global prefix configuration
- Meta graph (`meta://`) for ontology and metadata

### Features
- Parse Turtle code blocks in markdown files
- Execute SPARQL SELECT, CONSTRUCT, DESCRIBE, and ASK queries
- Live-updating query results when data changes
- Support for FROM and FROM NAMED clauses
- File-based and directory-based graph URIs
- Comprehensive error reporting
- Query performance metrics

## [1.0.0] - 2025-09-27

### Added
- Initial beta release
- Core RDF processing functionality
- Basic SPARQL query support
