# RDF Tools Architecture

## Overview

RDF Tools is architected as a layered system that bridges Obsidian's file-based note-taking with semantic web technologies. The system transforms markdown files containing Turtle code blocks into a queryable knowledge graph while maintaining seamless integration with Obsidian's native workflows.

## Architectural Layers

### 1. Obsidian Integration Layer

**Purpose**: Interface between the plugin and Obsidian's APIs

**Components**:
- `RdfToolsPlugin` - Main plugin class handling lifecycle and coordination
- `RdfToolsService` - Central orchestrating service that coordinates RDF processing
- `CodeBlockProcessor` - Renders SPARQL query results in place of code blocks
- `RdfToolsSettingsTab` - User configuration interface
- `SparqlQueryDetailsModal` - Modal for detailed query analysis

**Responsibilities**:
- Plugin lifecycle management (load/unload)
- File system event handling
- UI rendering and user interaction
- Settings persistence
- Integration with Obsidian's workspace and editor

### 2. Application Service Layer

**Purpose**: Core business logic and orchestration

**Components**:
- `RdfToolsService` - Central orchestrating service that coordinates all RDF processing
- `MarkdownErrorReporter` - Handles error reporting in markdown files
- `CodeBlockExtractorService` - Extracts code blocks from markdown content
- `MarkdownGraphParser` - Parses markdown files to extract turtle blocks

**Responsibilities**:
- Business logic coordination
- Cross-service communication
- Transaction management
- Error handling and recovery
- Performance optimization

### 3. RDF Processing Layer

**Purpose**: Core RDF and SPARQL functionality

**Components**:
- `GraphService` - Graph storage and manipulation
- `QueryExecutorService` - SPARQL query execution with Comunica engine
- `SparqlQueryTracker` - Cross-file dependency tracking and live update coordination
- `TurtleParserService` - Turtle syntax parsing and validation
- `PrefixService` - Namespace and prefix management

**Responsibilities**:
- RDF triple storage and retrieval
- SPARQL query parsing and execution
- Cross-file dependency analysis and tracking
- Live update coordination when data changes
- Turtle syntax processing
- Namespace resolution
- Data validation and error reporting

### 4. Data Access Layer

**Purpose**: Storage, caching, and persistence

**Components**:
- `GraphService` - In-memory graph storage with lazy loading and caching
- `N3 Store` - Triple storage using the N3.js library
- `File System Integration` - Direct integration with Obsidian's file system

**Responsibilities**:
- In-memory triple storage and retrieval
- Lazy loading of graphs from files
- Graph caching and invalidation
- File-to-graph URI mapping

## Core Data Flow

### File Processing Pipeline

```
Markdown File Change
        ↓
    RdfToolsService (debounced)
        ↓
    Extract & Parse Turtle Blocks
        ↓
    GraphService.invalidateGraph()
        ↓
    SparqlQueryTracker.findQueriesDependingOnGraph()
        ↓
    Parallel Re-execution of Dependent Queries
        ↓
    DOM Container Recovery (if needed)
        ↓
    QueryExecutorService
        ↓
    Update SPARQL Results in UI
```

### Query Execution Pipeline

```
SPARQL Code Block
        ↓
    SparqlParserService.parse()
        ↓
    SparqlQueryTracker.registerQuery()
        ↓
    Analyze FROM/FROM NAMED Dependencies
        ↓
    QueryExecutorService.determineTargetGraphs()
        ↓
    GraphService.getGraphs() (lazy loading)
        ↓
    Construct SPARQL Dataset (default/named graphs)
        ↓
    Comunica Engine Execution
        ↓
    Format Results by Query Type
        ↓
    Render in UI Container
```

## Component Interactions

### Service Dependencies

```
RdfToolsService
    ├── CodeBlockExtractorService
    ├── TurtleParserService
    ├── SparqlParserService
    ├── GraphService
    ├── QueryExecutorService
    ├── PrefixService
    ├── SparqlQueryTracker
    ├── CodeBlockProcessor
    └── MarkdownErrorReporter

QueryExecutorService
    ├── GraphService
    └── Comunica QueryEngine

SparqlQueryTracker
    ├── App (for file operations)
    └── SparqlQueryInfo (for dependency tracking)

GraphService
    ├── MarkdownGraphParser
    ├── TurtleParserService
    ├── PrefixService
    └── N3 Store

CodeBlockProcessor
    ├── App (for Obsidian integration)
    ├── Plugin (for registering processors)
    └── PrefixService (for URI formatting)
```

### Event Flow

**File Change Events**:
1. RdfToolsService detects change (debounced)
2. GraphService invalidates affected graph
3. SparqlQueryTracker identifies dependent queries
4. Parallel re-execution of affected queries
5. DOM container recovery if needed
6. UI updates with new results

**Query Registration Events**:
1. User creates/modifies SPARQL block
2. SparqlParserService parses and validates query
3. SparqlQueryTracker registers query and analyzes dependencies
4. QueryExecutorService executes query
5. Results rendered in UI container

**Live Update Events**:
1. Turtle data change in File A triggers graph invalidation
2. SparqlQueryTracker finds queries in Files B, C, D that depend on File A
3. Queries re-execute in parallel with timeout protection
4. DOM containers updated with fresh results

## Graph Storage Architecture

### Named Graph Organization

Each markdown file becomes a named graph with URI: `<vault://path/to/file.md>`

```
Vault Root
├── <vault://daily/2024-01-15.md>
│   └── Triples from turtle blocks in daily note
├── <vault://projects/alpha.md>
│   └── Triples from project documentation
└── <vault://people/contacts.md>
    └── Triples from contact information
```

### URI Resolution Strategy

**Base URI Assignment**:
- Each file gets: `@base <vault://path/filename.md/>`
- Relative URIs resolve within file context
- Absolute URIs for cross-file references

**Global vs Local Entities**:
```turtle
# Local entity (file-specific)
<person/alice> a foaf:Person .

# Global entity (vault-wide)
<vault://people/alice> a foaf:Person .

# External entity
<https://example.com/alice> a foaf:Person .
```

### Graph Lifecycle Management

**Creation**: New turtle blocks create/update graphs
**Updates**: Incremental triple addition/removal
**Deletion**: File deletion removes entire graph
**Versioning**: Optional graph snapshots for undo/redo

## Query Processing Architecture

### Query Analysis Phase

1. **Syntax Parsing** - Validate SPARQL syntax
2. **Dependency Extraction** - Identify required graphs
3. **Optimization** - Query rewriting and planning
4. **Security Validation** - Prevent dangerous operations

### Execution Context

**Graph Selection**:
- Explicit: `FROM <vault://specific/file.md>`
- Implicit: Query against all graphs
- Pattern-based: `FROM <vault://projects/*.md>`

**Prefix Resolution**:
- Global vault prefixes
- File-specific prefixes
- Query-local prefixes
- Automatic conflict resolution

### Result Processing

**Format Options**:
- Table (default for SELECT)
- List (ordered results)
- Count (aggregated results)
- Graph (CONSTRUCT results)
- Custom templates

**Rendering Pipeline**:
1. Raw SPARQL results
2. Format-specific processing
3. URI resolution for display
4. Markdown generation
5. Obsidian rendering

## Live Update System Architecture

### SparqlQueryTracker Service

**Purpose**: Manages cross-file dependencies between SPARQL queries and turtle data sources.

**Core Functionality**:
- **Query Registration**: Tracks all active SPARQL queries across open files
- **Dependency Analysis**: Analyzes FROM/FROM NAMED clauses to identify graph dependencies
- **Live Updates**: Coordinates automatic query re-execution when dependencies change
- **Container Management**: Maintains DOM container references for result updates

**Key Data Structures**:
```typescript
interface SparqlQueryInfo {
  id: string;                    // Unique query identifier
  query: SparqlQuery;            // Parsed SPARQL query object
  container: HTMLElement;        // DOM container for results
  file: TFile;                   // File containing the query
  dependentGraphs: string[];     // Graph URIs this query depends on
  lastExecuted: Date;            // Execution timestamp
  isExecuting: boolean;          // Execution state flag
}
```

**Lookup Optimizations**:
- `queriesByFile`: Map file paths to queries for file-based operations
- `queriesByGraph`: Map graph URIs to dependent queries for change propagation
- `queryById`: Fast query lookup by unique identifier

### Dependency Analysis Process

**FROM Clause Analysis**:
1. Extract FROM and FROM NAMED clauses from parsed SPARQL
2. Resolve `vault://` URIs using GraphService.resolveVaultUri()
3. Handle directory patterns (e.g., `vault://folder/` → all files in folder)
4. Default behavior: no FROM clauses = current file dependency only

**Query Lifecycle Management**:
1. **Registration**: Query registered when SPARQL block processed
2. **Updates**: Dependencies re-analyzed when query content changes
3. **Cleanup**: Query unregistered when file closed or block removed
4. **Container Recovery**: DOM references updated after markdown re-rendering

### Live Update Coordination

**File Change Pipeline**:
1. `RdfToolsService.onFileModified()` detects turtle data changes
2. Debounced processing (300ms) to batch rapid changes
3. `GraphService.invalidateGraph()` clears cached graph data
4. `SparqlQueryTracker.findQueriesDependingOnGraph()` finds affected queries
5. Parallel re-execution with timeout protection (10 seconds)
6. DOM container recovery for stale references
7. Fresh results rendered in UI

**Performance Optimizations**:
- **Debouncing**: Prevents excessive re-execution during rapid editing
- **Parallel Processing**: Multiple queries execute simultaneously
- **Container Recovery**: Handles Obsidian's DOM regeneration gracefully
- **Lazy Loading**: Graphs loaded only when needed for queries

### DOM Container Management

**Challenge**: Obsidian regenerates markdown DOM when files change, invalidating stored container references.

**Solution**:
1. Detect stale containers using `document.body.contains()`
2. Search for updated containers by matching query text
3. Update container references in tracking maps
4. Fallback to query unregistration if container not found

**Container Search Strategy**:
```typescript
// Find SPARQL code blocks with matching query text
const sparqlBlocks = viewContainer.querySelectorAll('[data-lang="sparql"]');
// Locate result container following the code block
const resultContainer = block.nextElementSibling;
```

## Caching Strategy

### Multi-Level Cache Architecture

**L1 Cache (Memory)**:
- Recently accessed graphs
- Frequent query results
- Parsed query objects
- Compiled prefix maps

**L2 Cache (Persistent)**:
- Serialized graph data
- Query result cache
- Dependency mappings
- Configuration snapshots

**Cache Invalidation**:
- Content-based (hash changes)
- Time-based (TTL expiration)
- Dependency-based (related data changes)
- Manual (user-triggered refresh)

### Cache Key Strategy

```
Graph Cache: hash(file-path + content-hash + prefix-context)
Query Cache: hash(sparql-query + graph-dependencies + execution-context)
Result Cache: hash(query-cache-key + format-options)
```

## Error Handling Architecture

### Error Categories

**Parsing Errors**:
- Malformed Turtle syntax
- Invalid SPARQL queries
- Namespace resolution failures

**Execution Errors**:
- Query timeout
- Memory exhaustion
- Graph inconsistencies

**System Errors**:
- File system access
- Network connectivity
- Library compatibility

### Error Recovery Strategy

**Graceful Degradation**:
- Continue processing valid blocks when some fail
- Maintain partial functionality during errors
- Provide meaningful error messages to users

**Error Isolation**:
- File-level error containment
- Query-level error handling
- Service-level exception boundaries

## Performance Considerations

### Scalability Factors

**Graph Size**: Large numbers of triples per file
**File Count**: Many files with turtle blocks
**Query Complexity**: Complex SPARQL with joins
**Update Frequency**: Rapid file modifications

### Optimization Strategies

**Lazy Loading**:
- Load graphs on first access
- Background processing for large operations
- Incremental indexing

**Query Optimization**:
- Query plan caching
- Selective graph loading
- Result streaming for large datasets

**Memory Management**:
- Graph eviction policies
- Configurable cache sizes
- Background garbage collection

## Security Architecture

### Input Validation

**SPARQL Injection Prevention**:
- Query parsing and validation
- Parameterized query support
- Whitelist-based function filtering

**Resource Protection**:
- Query timeout enforcement
- Memory usage limits
- File system access restrictions

### Data Isolation

**Vault Boundaries**:
- Restrict access to current vault only
- No external file system access
- Sandboxed query execution

## Extension Points

### Plugin Architecture

**Custom Functions**:
- SPARQL function extensions
- Result formatters
- Graph processors

**Data Connectors**:
- External SPARQL endpoints
- File format importers
- API integrations

**UI Extensions**:
- Custom result visualizations
- Query builders
- Graph explorers

### Configuration System

**Performance Tuning**:
- Cache sizes and policies
- Query timeouts
- Background processing settings

**Feature Toggles**:
- Experimental features
- Debug modes
- Integration options

This architecture provides a solid foundation for implementing RDF Tools while maintaining clear separation of concerns, testability, and extensibility for future enhancements.
