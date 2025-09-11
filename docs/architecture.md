# RDF Tools Architecture

## Overview

RDF Tools is architected as a layered system that bridges Obsidian's file-based note-taking with semantic web technologies. The system transforms markdown files containing Turtle code blocks into a queryable knowledge graph while maintaining seamless integration with Obsidian's native workflows.

## Architectural Layers

### 1. Obsidian Integration Layer

**Purpose**: Interface between the plugin and Obsidian's APIs

**Components**:
- `RDFToolsPlugin` - Main plugin class handling lifecycle and coordination
- `FileMonitor` - Watches for file changes and triggers processing
- `MarkdownPostProcessor` - Renders SPARQL query results in place of code blocks
- `SettingsTab` - User configuration interface
- `StatusBarManager` - User feedback and system status

**Responsibilities**:
- Plugin lifecycle management (load/unload)
- File system event handling
- UI rendering and user interaction
- Settings persistence
- Integration with Obsidian's workspace and editor

### 2. Application Service Layer

**Purpose**: Core business logic and orchestration

**Components**:
- `GraphManager` - Coordinates graph operations and lifecycle
- `QueryExecutor` - Manages SPARQL query execution and result formatting
- `DependencyTracker` - Tracks relationships between queries and data
- `ChangeProcessor` - Handles incremental updates and change propagation
- `ErrorHandler` - Centralized error management and user feedback

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
- `QueryService` - SPARQL query execution
- `ParsingService` - Turtle syntax parsing and validation
- `PrefixService` - Namespace and prefix management
- `SerializationService` - RDF data serialization/deserialization

**Responsibilities**:
- RDF triple storage and retrieval
- SPARQL query parsing and execution
- Turtle syntax processing
- Namespace resolution
- Data validation and error reporting

### 4. Data Access Layer

**Purpose**: Storage, caching, and persistence

**Components**:
- `CacheService` - Multi-level caching strategy
- `StorageService` - Persistent data storage
- `IndexService` - Search and retrieval optimization

**Responsibilities**:
- Query result caching
- Graph persistence for large datasets
- Performance optimization through indexing
- Memory management

## Core Data Flow

### File Processing Pipeline

```
Markdown File Change
        ↓
    FileMonitor
        ↓
    Extract Turtle Blocks
        ↓
    ParsingService
        ↓
    Validate & Parse Turtle
        ↓
    GraphService
        ↓
    Update Named Graph
        ↓
    DependencyTracker
        ↓
    Identify Affected Queries
        ↓
    QueryExecutor
        ↓
    Re-execute Dependent Queries
        ↓
    MarkdownPostProcessor
        ↓
    Update UI Results
```

### Query Execution Pipeline

```
SPARQL Code Block
        ↓
    Extract Query & Options
        ↓
    QueryService
        ↓
    Parse & Validate SPARQL
        ↓
    DependencyTracker
        ↓
    Register Dependencies
        ↓
    CacheService
        ↓
    Check Result Cache
        ↓
    Comunica Engine
        ↓
    Execute Against Graphs
        ↓
    Format Results
        ↓
    Cache & Return
        ↓
    Render in UI
```

## Component Interactions

### Service Dependencies

```
GraphManager
    ├── GraphService
    ├── ParsingService
    ├── PrefixService
    └── CacheService

QueryExecutor
    ├── QueryService
    ├── DependencyTracker
    ├── CacheService
    └── GraphService

DependencyTracker
    ├── QueryService (for query analysis)
    └── GraphService (for graph metadata)
```

### Event Flow

**File Change Events**:
1. FileMonitor detects change
2. GraphManager processes turtle blocks
3. DependencyTracker identifies affected queries
4. QueryExecutor re-runs dependent queries
5. UI updates with new results

**Query Execution Events**:
1. User modifies SPARQL block
2. QueryExecutor parses and validates
3. DependencyTracker registers dependencies
4. Query execution against relevant graphs
5. Results cached and rendered

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
