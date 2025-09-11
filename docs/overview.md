# RDF Tools - Claude Development Notes

## Project Overview

RDF Tools is an Obsidian plugin that enables working with RDF data directly within your vault. The plugin treats Turtle code blocks as knowledge graphs and provides SPARQL querying capabilities with live-updating results.

## Core Features

- **Turtle Block Processing** - Extract and parse `turtle` code blocks from markdown files
- **Graph Management** - Each file becomes a named graph with URI scheme `vault://path/filename.md#`
- **SPARQL Querying** - Execute queries across the current page graph or target specific files with `FROM` and `FROM NAMED` clauses. A special graph, <vault://> queries across all files in the entire vault.  Similarly, <vault://foo/> will query all files in the foo sub-directory (and subdirectories)
- **Live Updates** - SPARQL query results update automatically when underlying turtle data changes
- **Prefix Management** - Global and file-local prefix support with intelligent merging

## Architecture Overview

### High-Level Services

**GraphService** - Manages collection of named graphs, handles CRUD operations and URI resolution

**QueryService** - Executes SPARQL queries using Comunica, manages caching and optimization

**ParsingService** - Handles Turtle parsing with N3.js, validates syntax and manages base URIs

**PrefixService** - Manages global and file-local prefix mappings and resolution

**DependencyService** - Tracks query dependencies on graphs for live update functionality

**CacheService** - Manages query result caching and graph parsing caches

### Core Models

**Graph** - Named graph with metadata (source file, modification time, parsing errors)

**SparqlQuery** - Query with metadata (dependencies, parameters, execution context)

**SparqlResults** - Query results with formatting options and execution metadata

**TurtleBlock** - Parsed turtle block with source location and extracted prefixes

**QueryBlock** - SPARQL code block with dependencies, cached results, and update timestamps

## Development Approach

### Implementation Steps

1. **Plugin Scaffolding** - Basic Obsidian plugin structure with TypeScript
2. **Turtle Detection** - File monitoring and turtle block extraction
3. **RDF Integration** - N3.js and Comunica integration with wrapper services
4. **Graph Store** - In-memory graph storage with proper URI resolution
5. **SPARQL Execution** - Basic query execution and result formatting
6. **Change Monitoring** - Incremental graph updates and dependency tracking
7. **Live Query Updates** - Automatic re-execution of dependent queries
8. **Settings & Polish** - Configuration, error handling, and optimization

### Technical Stack

- **TypeScript** - Primary language with strict typing
- **N3.js** - RDF parsing and triple store functionality
- **Comunica** - SPARQL query execution engine
- **Jest** - Testing framework with comprehensive coverage
- **Obsidian API** - Plugin integration and UI components

## Testing Strategy

**Unit Tests** - Test individual services and models in isolation with mocked dependencies. Mock N3.js and Comunica at service boundaries.

**Integration Tests** - Test service interactions with real RDF libraries but mocked file systems. Use fixture data for consistent test scenarios.

**Plugin Tests** - Test Obsidian integration with completely mocked Obsidian APIs. Focus on file monitoring, UI updates, and plugin lifecycle.

### Key Testing Principles

- **Dependency Injection** - All services accept dependencies through constructors for easy mocking
- **Mock External, Test Internal** - Mock RDF libraries and Obsidian APIs, test your business logic
- **Test Data Builders** - Create programmatic helpers for generating test graphs and queries
- **Async Patterns** - Establish consistent patterns for testing promises, events, and timeouts

### Test Organization

- unit tests should be stored along side the code in `__tests__/` directory.

## URI Resolution Strategy

**Base URIs** - By default, the base should be set as follows for local entity resolution: `@base <vault://path/filename.md/>`

## Key Design Decisions

- **Named Graphs** - Each file becomes a separate named graph for isolation and targeted querying. Each directory becomes a named graphs consisting of all contained files recursively.
- **Live Updates** - Dependency tracking enables automatic query result updates
- **Memory Management** - Lazy loading and caching strategies for large vaults
- **Error Recovery** - Graceful degradation when parsing or queries fail

