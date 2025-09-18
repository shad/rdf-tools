# RDF Tools - Development Notes

## Project Overview

RDF Tools is an Obsidian community plugin that enables working with RDF data and SPARQL queries directly within your vault. Users can write Turtle code blocks to define RDF data and SPARQL code blocks to query that data with live-updating results.

## Current Status: ✅ Complete - Ready for Community Submission

The core functionality is implemented and tested:

- **Turtle Code Blocks** - Parse and validate `turtle` code blocks with error reporting
- **SPARQL Query Blocks** - Execute `sparql` code blocks with live results
- **Cross-File Dependencies** - Queries automatically update when referenced turtle data changes
- **Named Graph System** - Each file becomes `<vault://path/filename.md>` graph
- **URI Resolution** - Base URIs set as `@base <vault://path/filename.md/>`
- **FROM Clause Support** - Query specific files or directories with `FROM <vault://...>`
- **Live Update System** - Real-time query result updates across files
- **Performance Optimized** - Lazy loading, caching, and debounced updates

## Implementation Status

### ✅ Completed Features
- Core RDF processing with N3.js integration
- SPARQL execution with Comunica engine
- Live dependency tracking and updates
- Markdown post-processing for results
- Settings panel and configuration
- Error handling and user feedback
- Comprehensive test suite
- Build system and development tooling

## Architecture Overview

The plugin follows a layered service architecture:

### Core Services

**RdfToolsService** - Central orchestrating service that coordinates all RDF processing
**GraphService** - Manages named graphs with lazy loading and caching
**QueryExecutorService** - Executes SPARQL queries using Comunica engine
**SparqlQueryTracker** - Tracks cross-file dependencies for live updates
**TurtleParserService** - Handles Turtle parsing and validation with N3.js
**SparqlParserService** - Handles SPARQL parsing and validation with sparqljs
**PrefixService** - Manages namespace prefixes and URI resolution

### UI Components

**CodeBlockProcessor** - Processes markdown code blocks and renders results
**RdfToolsSettingsTab** - Plugin settings interface
**SparqlQueryDetailsModal** - Modal for detailed query analysis and debugging

### Models

**Graph** - Named graph with URI, file path, and N3 store
**SparqlQuery** - Query object with parsed AST and execution context
**QueryResults** - Query results with formatting and execution metadata
**TurtleBlock** - Turtle block with location and parsing information

## Development Approach

### Development Timeline (Completed)

1. ✅ **Project Setup** - TypeScript, esbuild, ESLint, Prettier configuration
2. ✅ **Core Models** - Graph, SparqlQuery, QueryResults, and helper types
3. ✅ **RDF Processing** - N3.js integration for parsing and triple storage
4. ✅ **SPARQL Engine** - Comunica integration for query execution
5. ✅ **File System Integration** - Obsidian file monitoring and markdown processing
6. ✅ **Live Updates** - Cross-file dependency tracking and automatic re-execution
7. ✅ **UI Integration** - Markdown post-processing and result rendering
8. ✅ **Settings & Error Handling** - Configuration panel and user feedback
9. ✅ **Testing & Quality** - Comprehensive test suite with mocking strategies

### Technology Stack

- **TypeScript** - Primary language with strict typing enabled
- **N3.js** - RDF parsing, serialization, and triple store
- **Comunica** - SPARQL query execution engine with RDF/JS compatibility
- **sparqljs** - SPARQL parsing and validation
- **esbuild** - Fast bundling for development and production
- **Vitest** - Modern testing framework with great TypeScript support
- **ESLint + Prettier** - Code quality and consistent formatting

## Testing Strategy

The project uses Vitest for modern, fast testing with comprehensive coverage:

**Unit Tests** - Individual services and models tested in isolation
- Mock N3.js and Comunica at service boundaries
- Focus on business logic and error handling
- Test data builders for consistent fixtures

**Integration Tests** - Service interactions with real RDF libraries
- Use fixture data for reproducible test scenarios
- Mock file system and Obsidian APIs
- Test complete processing pipelines

**Mock Strategy** - Comprehensive mocking for external dependencies
- Obsidian APIs completely mocked for isolated testing
- RDF libraries mocked at service boundaries
- File system operations mocked for consistency

### Code Quality Standards

- **TypeScript Strict Mode** - All code uses strict typing with no `any` types
- **ESLint + Prettier** - Automated code quality and formatting
- **100% Test Coverage** - Core services have comprehensive test coverage
- **Continuous Integration** - Quality checks run on all commits

## URI Resolution Strategy

**Base URIs** - Each file gets `@base <vault://path/filename.md/>` for local entity resolution

**Global Entities** - Use `vault:` prefix for entities shared across files

**Identity Management** - Handle entity identity across files with canonical definitions and `owl:sameAs` assertions

## Key Design Decisions

- **File-as-Graph** - Each markdown file becomes a named graph `<vault://path/file.md>`
- **Live Update System** - Cross-file dependency tracking with automatic query re-execution
- **Lazy Loading** - Graphs loaded on-demand with intelligent caching
- **Service-Oriented Architecture** - Clean separation of concerns with dependency injection
- **Performance First** - Debounced updates, parallel processing, and memory management
- **Error Isolation** - Graceful degradation with per-file and per-query error boundaries

## Build and Development

### Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Development server with watch mode
npm run build        # Production build
npm run test         # Run test suite
npm run check-all    # Format, lint, and type check (pre-commit)
```

### Release Process

1. Update version in `manifest.json` and `package.json`
2. Run `npm run build` to create production artifacts
3. Create GitHub release with `main.js`, `manifest.json`, `styles.css`
4. Submit to Obsidian community plugins

## Additional Documentation

- `docs/architecture.md` - Detailed system architecture and data flow
- `docs/additional-considerations.md` - Performance, security, and deployment notes
- `README.md` - User-focused documentation and examples

## Community Release Status

✅ **Ready for Community Submission** - All core features implemented and tested.
