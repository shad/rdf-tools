# RDF Tools Architecture

## Overview

RDF Tools is architected as a layered system that bridges Obsidian's file-based note-taking with semantic web technologies. The system transforms markdown files containing Turtle code blocks into queryable knowledge graphs while providing live-updating SPARQL query results and comprehensive meta-information about vault structure.

## Architectural Layers

### 1. Plugin Integration Layer

**Purpose**: Interface between the plugin and Obsidian's APIs

**Components**:
- `RdfToolsPlugin` - Main plugin class handling lifecycle and coordination
- `main.ts` - Plugin entry point and initialization

**Responsibilities**:
- Plugin lifecycle management (load/unload)
- Service initialization and dependency injection
- Integration with Obsidian's plugin system

### 2. UI Layer

**Purpose**: User interface components and rendering

**Components**:
- `SparqlBlockProcessor` - Renders SPARQL query results within code blocks
- `RdfToolsSettingsTab` - User configuration interface
- `SparqlQueryDetailsModal` - Modal for detailed query analysis and debugging

**Responsibilities**:
- SPARQL result rendering (tables, turtle, boolean results)
- Error display and user feedback
- Settings management UI
- Query debugging and inspection interfaces

### 3. Application Service Layer

**Purpose**: Core business logic and orchestration

**Components**:
- `RdfToolsService` - Central orchestrating service coordinating all RDF processing
- `SparqlQueryTracker` - Cross-file dependency tracking and live update coordination
- `MarkdownErrorReporter` - Error reporting and user feedback

**Responsibilities**:
- Business logic coordination between all services
- File change detection and processing
- Live query update orchestration
- Error handling and recovery
- Performance optimization through debouncing and caching

### 4. RDF Processing Layer

**Purpose**: Core RDF and SPARQL functionality

**Components**:
- `GraphService` - High-level graph management and caching coordinator
- `VaultGraphService` - Vault file-based graph loading and parsing
- `MetaGraphService` - Meta-information graph generation (vault structure, file metadata)
- `QueryExecutorService` - SPARQL query execution with Comunica engine
- `SparqlParserService` - SPARQL syntax parsing and validation
- `PrefixService` - Namespace and prefix management

**Responsibilities**:
- Graph loading, caching, and invalidation
- SPARQL query parsing and execution
- Meta-information extraction and RDF generation
- Namespace resolution and prefix management
- Turtle syntax processing and validation

### 5. Data Processing Layer

**Purpose**: Low-level data extraction and parsing

**Components**:
- `MarkdownGraphParser` - Extracts and parses Turtle blocks from markdown
- `CodeBlockExtractorService` - Extracts code blocks from markdown content

**Responsibilities**:
- Markdown content analysis and extraction
- Turtle code block identification and parsing
- Base URI resolution and RDF triple generation
- Content change detection and incremental processing

### 6. Model Layer

**Purpose**: Data models and type definitions

**Components**:
- `Graph` - RDF graph representation
- `TurtleBlock` - Turtle code block model with parsing metadata
- `SparqlQuery` - SPARQL query representation with execution context
- `QueryResults` - Query result formatting and display models
- `QueryExecutionDetails` - Query performance and debugging information
- `RdfToolsSettings` - Plugin configuration model

### 7. Utility Layer

**Purpose**: Shared utilities and helper functions

**Components**:
- `parsing.ts` - Pure parsing functions for SPARQL and Turtle
- `results.ts` - Result formatting and display utilities
- `literal-formatting.ts` - RDF literal display formatting
- `planning.ts` - Query planning and optimization helpers

## Core Data Flow

### File Processing Pipeline

```
File Change Event (Obsidian)
        ↓
RdfToolsService.handleFileChange() (debounced 300ms)
        ↓
CodeBlockExtractorService.extractBlocks()
        ↓
MarkdownGraphParser.parse()
        ↓
GraphService.invalidateGraph()
        ↓
SparqlQueryTracker.findQueriesDependingOnGraph()
        ↓
Parallel Re-execution of Dependent Queries
        ↓
SparqlBlockProcessor.renderSparqlResult()
```

### SPARQL Query Execution Pipeline

```
SPARQL Code Block Rendering
        ↓
SparqlBlockProcessor.handleSparqlBlock()
        ↓
SparqlParserService.parseQuery()
        ↓
SparqlQueryTracker.registerQuery() (dependency tracking)
        ↓
QueryExecutorService.executeQuery()
        ↓
GraphService.getGraphs() (with caching)
        ↓
Comunica Query Engine Execution
        ↓
Result Formatting (by query type)
        ↓
DOM Update with Results/Errors
```

### Graph Loading Pipeline

```
Graph Request (from SPARQL FROM clause)
        ↓
GraphService.getGraphs()
        ↓
Check Cache → Return if Available
        ↓
Route to Appropriate Service:
├── VaultGraphService (vault:// URIs)
├── MetaGraphService (meta:// URIs)
        ↓
Parse/Generate RDF Triples
        ↓
Store in N3 Store with Graph Context
        ↓
Cache for Future Use
        ↓
Return Graph Objects
```

## Service Architecture

### Primary Service Dependencies

```
RdfToolsService (Central Coordinator)
├── GraphService (Graph Management)
│   ├── VaultGraphService (File-based graphs)
│   │   ├── MarkdownGraphParser
│   │   └── CodeBlockExtractorService
│   └── MetaGraphService (Meta-information graphs)
├── QueryExecutorService (SPARQL execution)
│   └── GraphService (for data access)
├── SparqlParserService (Query parsing)
├── PrefixService (Namespace management)
├── SparqlQueryTracker (Dependency tracking)
└── MarkdownErrorReporter (Error handling)

SparqlBlockProcessor (UI Component)
├── RdfToolsService (for query execution)
└── SparqlQueryDetailsModal (for debugging)
```

### Graph Service Architecture

The GraphService acts as a coordinator that delegates to specialized services:

```
GraphService
├── VaultGraphService (handles vault:// URIs)
│   - Loads RDF from Turtle blocks in markdown files
│   - Manages file-to-graph URI mapping
│   - Handles incremental updates and caching
│
└── MetaGraphService (handles meta:// URIs)
    ├── Metadata Graph (meta://)
    │   - File system structure
    │   - File metadata (size, dates, word counts)
    │   - Wikilink relationships
    │   - File type classifications
    │
    └── Ontology Graph (meta://ontology)
        - RDF Tools vocabulary definitions
        - Class and property schemas
        - Built-in ontology for vault structure
```

## Data Models

### Graph Model
- **URI**: Unique identifier for the graph
- **Store**: N3.js Store containing RDF triples
- **File Path**: Associated file (empty for meta graphs)
- **Last Modified**: Cache invalidation timestamp
- **Triple Count**: Performance and debugging information

### Turtle Block Model
- **Content**: Raw turtle text content
- **Location**: Position within markdown file
- **Base URI**: Resolved base URI for relative references
- **Parse Status**: Success/failure and error information
- **Quad Count**: Generated RDF triples count

### SPARQL Query Model
- **Query Text**: Original SPARQL query string
- **Parsed AST**: Parsed query structure
- **FROM Graphs**: Explicit graph dependencies
- **Execution Context**: File context and parameters
- **Performance Metrics**: Execution time and result count

## Caching Strategy

### Graph-Level Caching
- **Key**: Graph URI (e.g., `vault://file.md`, `meta://`)
- **Storage**: In-memory Map in GraphService
- **Invalidation**: File change events, explicit invalidation
- **Lazy Loading**: Graphs loaded on first query access

### Query Result Caching
- **Scope**: Per-query results cached in DOM elements
- **Invalidation**: When dependent graphs change
- **Update Strategy**: Background re-execution with visual loading states

### Meta Graph Caching
- **Metadata Graph**: Invalidated on any file system change
- **Ontology Graph**: Static, loaded once per session
- **Performance**: Critical for responsive query execution

## Performance Optimizations

### Incremental Processing
- **File Changes**: Only reprocess changed files
- **Query Dependencies**: Only re-execute affected queries
- **Turtle Block Parsing**: Skip unchanged blocks using content hashing

### Background Processing
- **Debounced Updates**: 300ms delay for file changes
- **Parallel Execution**: Multiple queries execute concurrently
- **Non-blocking UI**: Loading states during query execution

### Memory Management
- **Query Timeouts**: Prevent runaway queries (configurable)
- **Result Limits**: Truncate large result sets with warnings
- **Graph Size Monitoring**: Track memory usage per graph

## Extension Points

### Custom Graph Sources
- Implement graph loading interface
- Register with GraphService for custom URI schemes
- Handle caching and invalidation

### Custom Query Processors
- Extend QueryExecutorService for specialized query types
- Add custom result formatters
- Integrate with existing caching system

### Custom UI Components
- Extend SparqlBlockProcessor for custom rendering
- Add new modal components for specialized interfaces
- Integrate with Obsidian's UI framework

## Error Handling Strategy

### Layered Error Recovery
- **Parse Errors**: Individual turtle blocks fail gracefully
- **Query Errors**: Syntax errors shown to user with helpful messages
- **Graph Loading Errors**: Partial failures don't break entire queries
- **System Errors**: Comprehensive logging for debugging

### User Feedback
- **Inline Errors**: Shown directly below relevant code blocks
- **Performance Warnings**: Query timeout and memory warnings
- **Debug Information**: Available through query details modal
- **Recovery Guidance**: Actionable error messages with suggestions

## Testing Architecture

### Unit Testing
- **Service Layer**: Isolated testing with mocked dependencies
- **Model Layer**: Pure function and data structure testing
- **Utility Layer**: Comprehensive testing of parsing and formatting functions

### Integration Testing
- **Service Interactions**: Real service interactions with controlled data
- **End-to-End Flows**: Complete workflows from file change to UI update
- **Graph Loading**: Real RDF parsing and query execution

### Mock Strategy
- **Obsidian APIs**: Comprehensive mocking of app, vault, and file system
- **External Libraries**: Mock N3.js and Comunica at service boundaries
- **File System**: MockTFile and MockTFolder for testing

This architecture supports the plugin's core goals of providing seamless RDF integration with Obsidian while maintaining performance, extensibility, and robust error handling.