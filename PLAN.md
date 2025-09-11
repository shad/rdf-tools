# RDF Tools Implementation Plan

## Project Overview

RDF Tools is an Obsidian plugin that enables working with RDF data directly within your vault. The plugin treats Turtle code blocks as knowledge graphs and provides SPARQL querying capabilities with live-updating results.

## Core Features (Target)

- **Turtle Block Processing** - Extract and parse `turtle` code blocks from markdown files
- **Graph Management** - Each file becomes a named graph with URI scheme `vault://path/filename.md`
- **SPARQL Querying** - Execute queries across graphs with `FROM` clauses and live results
- **Live Updates** - SPARQL query results update automatically when turtle data changes
- **Prefix Management** - Global and file-local prefix support with intelligent merging

## Technical Stack

- **TypeScript** - Primary language with strict typing
- **N3.js** - RDF parsing and triple store functionality (already installed)
- **Comunica** - SPARQL query execution engine (already installed)
- **esbuild** - Fast bundling and development workflow
- **Obsidian API** - Plugin integration and UI components

## Implementation Phases

### Phase 1: Foundation & Infrastructure (Weeks 1-2)

**1.1 Project Setup** ✅ *COMPLETED*
- [x] Source code reorganization (`src/` directory structure)
- [x] Build system configuration updates
- [x] Project metadata updates (package.json, manifest.json)
- [x] Directory structure for planned components

**1.2 Core Types & Models**
- [ ] Define core TypeScript interfaces:
  - `Graph` - Named graph with metadata
  - `SparqlQuery` - Query with dependencies and context
  - `TurtleBlock` - Parsed turtle block with location
  - `QueryBlock` - SPARQL code block with cached results
- [ ] Create base plugin class structure
- [ ] Set up error handling types and utilities

**1.3 Testing Infrastructure**
- [ ] Configure Jest testing framework
- [ ] Create test utilities and mock builders
- [ ] Set up fixture data for testing
- [ ] Establish testing patterns (unit, integration, plugin)

### Phase 2: RDF Processing Layer (Weeks 3-4)

**2.1 Parsing Service**
- [ ] Turtle block detection and extraction from markdown
- [ ] N3.js integration for turtle parsing
- [ ] Prefix extraction and management
- [ ] Error handling for malformed turtle
- [ ] Base URI resolution (`vault://path/file.md/`)

**2.2 Graph Service**
- [ ] In-memory graph storage using N3.Store
- [ ] Named graph management (create, update, delete)
- [ ] URI resolution and canonicalization
- [ ] Graph lifecycle management
- [ ] Change detection and incremental updates

**2.3 Prefix Service**
- [ ] Global prefix management
- [ ] File-local prefix handling
- [ ] Prefix conflict resolution
- [ ] Prefix serialization and persistence

### Phase 3: SPARQL Query Engine (Weeks 5-6)

**3.1 Query Service**
- [ ] Comunica integration for SPARQL execution
- [ ] Query parsing and validation
- [ ] Graph selection (`FROM`, `FROM NAMED` clause handling)
- [ ] Query context management (prefixes, base URI)
- [ ] Error handling for malformed queries

**3.2 Query Execution**
- [ ] Basic SELECT query execution
- [ ] Result formatting (table, list, count)
- [ ] ASK, CONSTRUCT, DESCRIBE query support
- [ ] Query optimization and planning
- [ ] Timeout and resource management

**3.3 Dependency Tracking**
- [ ] Query dependency analysis
- [ ] Graph-to-query relationship mapping
- [ ] Incremental dependency updates
- [ ] Cycle detection and prevention

### Phase 4: File System Integration (Weeks 7-8)

**4.1 File Monitoring**
- [ ] Obsidian file system event handling
- [ ] Turtle block change detection
- [ ] File rename and deletion handling
- [ ] Batch processing for bulk changes

**4.2 Change Processing**
- [ ] Incremental graph updates
- [ ] Dependency resolution for changes
- [ ] Graph invalidation and refresh
- [ ] Error recovery and graceful degradation

**4.3 Cache Management**
- [ ] Query result caching
- [ ] Graph parsing caches
- [ ] Cache invalidation strategies
- [ ] Memory management and eviction policies

### Phase 5: UI Integration (Weeks 9-10)

**5.1 Markdown Post-Processing**
- [ ] SPARQL code block detection
- [ ] Query result rendering
- [ ] Error display and user feedback
- [ ] Live update mechanisms

**5.2 Result Formatting**
- [ ] Table formatting for SELECT results
- [ ] List formatting for ordered results
- [ ] Graph visualization for CONSTRUCT
- [ ] Custom template support

**5.3 User Interface Components**
- [ ] Settings panel for configuration
- [ ] Status bar indicators
- [ ] Error notifications and feedback
- [ ] Query performance metrics

### Phase 6: Live Updates & Performance (Weeks 11-12)

**6.1 Live Query Updates**
- [ ] Dependency-based query re-execution
- [ ] Selective query updates
- [ ] UI refresh coordination
- [ ] Background processing

**6.2 Performance Optimization**
- [ ] Query optimization and caching
- [ ] Lazy loading for large graphs
- [ ] Background processing for expensive operations
- [ ] Memory usage optimization

**6.3 Error Handling & Recovery**
- [ ] Comprehensive error recovery
- [ ] Partial failure handling
- [ ] User feedback and guidance
- [ ] Debugging and diagnostic tools

### Phase 7: Advanced Features & Polish (Weeks 13-14)

**7.1 Advanced Query Features**
- [ ] Complex query patterns and optimization
- [ ] Custom SPARQL functions
- [ ] Query parameterization
- [ ] Import/export functionality

**7.2 Configuration & Settings**
- [ ] Plugin configuration system
- [ ] Performance tuning options
- [ ] User preferences
- [ ] Export/import settings

**7.3 Documentation & Examples**
- [ ] User documentation
- [ ] Example queries and use cases
- [ ] Best practices guide
- [ ] API documentation

### Phase 8: Testing & Release Preparation (Week 15)

**8.1 Comprehensive Testing**
- [ ] End-to-end testing scenarios
- [ ] Performance benchmarking
- [ ] Edge case handling
- [ ] User acceptance testing

**8.2 Release Preparation**
- [ ] Build optimization
- [ ] Release documentation
- [ ] Version management
- [ ] Community preparation

## Architecture Overview

### Service Layer Structure
```
src/
├── main.ts                 # Plugin entry point
├── services/
│   ├── GraphService.ts     # Graph storage and management
│   ├── QueryService.ts     # SPARQL query execution
│   ├── ParsingService.ts   # Turtle parsing and validation
│   ├── PrefixService.ts    # Prefix management
│   ├── DependencyService.ts # Query dependency tracking
│   └── CacheService.ts     # Caching and optimization
├── models/
│   ├── Graph.ts           # Graph model and metadata
│   ├── SparqlQuery.ts     # Query model and context
│   ├── TurtleBlock.ts     # Turtle block representation
│   └── QueryResults.ts    # Result formatting and display
├── ui/
│   ├── SettingsTab.ts     # Plugin configuration UI
│   ├── StatusBar.ts       # Status indicators
│   └── PostProcessor.ts   # Markdown result rendering
├── utils/
│   ├── uriResolver.ts     # URI canonicalization
│   ├── errorHandler.ts    # Error management
│   └── performance.ts     # Performance monitoring
└── types/
    └── index.ts           # TypeScript type definitions
```

### Data Flow Architecture
1. **File Change** → FileMonitor detects turtle block changes
2. **Graph Update** → ParsingService updates relevant graphs
3. **Dependency Resolution** → DependencyService identifies affected queries
4. **Query Re-execution** → QueryService re-runs dependent queries
5. **UI Update** → PostProcessor updates results in markdown view

## Key Design Decisions

- **Named Graphs**: Each file becomes a separate named graph for isolation
- **URI Scheme**: `vault://path/filename.md` for consistent addressing
- **Live Updates**: Dependency tracking enables real-time result updates
- **Memory Management**: Lazy loading and caching for scalability
- **Error Recovery**: Graceful degradation when parsing or queries fail
- **Testing Strategy**: Mock external libraries, test business logic
- **Plugin Architecture**: Clean separation for future extensibility

## Development Guidelines

- Follow Obsidian plugin conventions and lifecycle patterns
- Use dependency injection for testability
- Implement comprehensive error handling
- Design for incremental loading and processing
- Maintain clean API boundaries between services
- Prioritize performance and memory efficiency
- Follow TypeScript best practices with strict typing

## Success Criteria

- Successfully parse turtle blocks from markdown files
- Execute SPARQL queries against turtle data with correct results
- Update query results automatically when turtle data changes
- Handle errors gracefully with meaningful user feedback
- Maintain good performance with reasonable-sized vaults
- Provide clean, intuitive user experience within Obsidian
- Support the core URI scheme and prefix management
- Enable users to build knowledge graphs from their notes

This implementation plan provides a structured approach to building RDF Tools incrementally, with each phase building on solid foundations from previous work.