# RDF Tools - Obsidian Community Plugin

## Project Overview

- **Target**: Obsidian Community Plugin for working with RDF data and SPARQL queries
- **Purpose**: Enable users to work with RDF data directly in their vault using Turtle code blocks and SPARQL queries with live-updating results
- **Entry point**: `src/main.ts` compiled to `main.js` and loaded by Obsidian
- **Required release artifacts**: `main.js`, `manifest.json`, and optional `styles.css`

## Environment & Tooling

- **Node.js**: Use current LTS (Node 18+ recommended)
- **Package manager**: npm (required - `package.json` defines npm scripts and dependencies)
- **Bundler**: esbuild (configured in `esbuild.config.mjs` for fast development and production builds)
- **Types**: `obsidian` type definitions + custom RDF types
- **Code Quality**: ESLint + Prettier integration with comprehensive check scripts

### Key Dependencies

- **N3.js** - RDF parsing and triple store functionality
- **Comunica** - SPARQL query execution engine
- **TypeScript** - Primary development language with strict typing
- **ESLint** - Code linting and quality enforcement
- **Prettier** - Code formatting consistency

### Installation & Setup

```bash
npm install
```

### Development Commands

```bash
npm run dev          # Start development server with watch mode
npm run build        # Production build
npm run check-all    # Format, fix lint issues, and type check (all-in-one)
npm run lint         # ESLint checking only
npm run lint:fix     # Auto-fix ESLint issues
npm run format       # Format all code with Prettier
npm run format:check # Check formatting without fixing
npm run typecheck    # TypeScript type checking only
```

## Project Structure

The project follows a layered architecture with clean separation of concerns:

```
src/
├── main.ts                 # Plugin entry point, lifecycle management
├── services/              # Core RDF processing services
│   ├── GraphService.ts     # Graph storage and management
│   ├── QueryService.ts     # SPARQL query execution
│   ├── ParsingService.ts   # Turtle parsing and validation
│   ├── PrefixService.ts    # Prefix management
│   ├── DependencyService.ts # Query dependency tracking
│   └── CacheService.ts     # Caching and optimization
├── models/                # Data models and interfaces
│   ├── Graph.ts           # Graph model and metadata
│   ├── SparqlQuery.ts     # Query model and context
│   ├── TurtleBlock.ts     # Turtle block representation
│   └── QueryResults.ts    # Result formatting and display
├── ui/                    # Obsidian UI components
│   ├── SettingsTab.ts     # Plugin configuration UI
│   ├── StatusBar.ts       # Status indicators
│   └── PostProcessor.ts   # Markdown result rendering
├── utils/                 # Helper utilities
│   ├── uriResolver.ts     # URI canonicalization
│   ├── errorHandler.ts    # Error management
│   └── performance.ts     # Performance monitoring
├── types/                 # TypeScript type definitions
│   └── index.ts           # Core type definitions
└── __tests__/             # Test files alongside source
```

## File & Folder Conventions

- **Organize code into multiple files**: Split functionality across separate modules rather than putting everything in `main.ts`
- **Source lives in `src/`**: Keep `main.ts` small and focused on plugin lifecycle (loading, unloading, registering commands)
- **Service Layer Pattern**: Each service has a specific responsibility and can be tested independently
- **Dependency Injection**: Services accept dependencies through constructors for easy mocking and testing
- **Clean Imports**: Use barrel exports from directories where appropriate

## Core Features Implementation

### RDF Data Processing
- **Turtle Block Detection**: Extract and parse `turtle` code blocks from markdown files
- **Graph Management**: Each file becomes a named graph with URI scheme `vault://path/filename.md`
- **URI Resolution**: Base URIs set as `@base <vault://path/filename.md/>` for local entity resolution

### SPARQL Query Execution  
- **Query Processing**: Execute SPARQL queries using Comunica engine
- **Graph Selection**: Support `FROM` and `FROM NAMED` clauses for targeted querying
- **Live Updates**: Query results update automatically when underlying turtle data changes
- **Result Formatting**: Table, list, count, and custom formatting options

### Performance & Scalability
- **Lazy Loading**: Load graphs on-demand to manage memory usage
- **Incremental Updates**: Only reprocess changed turtle blocks
- **Dependency Tracking**: Smart invalidation of affected queries
- **Caching Strategy**: Multi-level caching for graphs and query results

## Development Workflow

### Code Quality Standards
- **TypeScript Strict Mode**: Enforce strict typing throughout codebase
- **ESLint Rules**: Comprehensive linting with TypeScript-specific rules
- **Prettier Formatting**: Consistent code formatting (single quotes, 80-char width, 2-space tabs)
- **All-in-One Quality Check**: Use `npm run check-all` to format, fix lint issues, and type check in one command

### Testing Strategy
- **Unit Tests**: Test individual services and models with mocked dependencies
- **Integration Tests**: Test service interactions with real RDF libraries
- **Plugin Tests**: Test Obsidian integration with mocked APIs
- **Mock Strategy**: Mock N3.js and Comunica at service boundaries, test business logic

### Error Handling
- **Graceful Degradation**: Continue processing valid blocks when some fail
- **User Feedback**: Meaningful error messages and recovery guidance  
- **Partial Failures**: Handle file-level and block-level errors independently
- **Debugging Support**: Comprehensive logging and diagnostic capabilities

## Manifest Configuration

Key settings in `manifest.json`:
- `id`: "rdf-tools" (stable, never change after release)
- `isDesktopOnly`: true (RDF processing complexity requires desktop environment)
- `minAppVersion`: Set appropriately for required Obsidian API features
- `description`: Clear description of RDF and SPARQL capabilities

## Security & Privacy

- **Local Processing**: All RDF operations happen locally within the vault
- **No External Calls**: No network requests unless explicitly configured by user
- **Vault Isolation**: Restrict access to current vault only
- **Resource Limits**: Query timeouts and memory usage controls
- **Input Validation**: Comprehensive validation of SPARQL queries and turtle syntax

## Performance Considerations

- **Memory Management**: Configurable cache sizes and eviction policies
- **Query Optimization**: Query plan caching and selective graph loading
- **Background Processing**: Expensive operations don't block UI
- **Incremental Loading**: Process changes incrementally rather than full reloads

## Release Preparation

- **Build Verification**: Ensure `npm run build` produces valid artifacts
- **Quality Assurance**: Run `npm run check-all` to ensure all code is formatted, linted, and type-safe
- **Version Management**: Update `manifest.json` version before release
- **Release Assets**: Include `main.js`, `manifest.json`, and `styles.css` (if present)

## Agent Guidelines

### Development Best Practices
- **Follow Architecture**: Respect the layered service architecture
- **Test Coverage**: Write tests for new functionality using established patterns  
- **Error Handling**: Implement comprehensive error recovery
- **Performance**: Consider memory usage and query performance impacts
- **Documentation**: Update relevant documentation for API changes

### Code Quality Requirements
- **Use Check-All Command**: Always run `npm run check-all` to automatically format code, fix lint issues, and verify types
- **Single Command Workflow**: `check-all` is the primary quality assurance tool - no need for separate format/lint steps
- **Type Safety**: Maintain strict TypeScript compliance (verified as part of check-all)

### Testing Requirements
- **Mock External Dependencies**: Use dependency injection for testability
- **Test Business Logic**: Focus tests on plugin logic, not library functionality
- **Integration Testing**: Test service interactions with controlled inputs
- **Error Scenarios**: Test error handling and recovery paths

This project implements a sophisticated RDF processing system within Obsidian while maintaining clean architecture, comprehensive testing, and excellent developer experience.