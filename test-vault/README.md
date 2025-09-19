# RDF Tools Test Vault

This test vault contains comprehensive test data for the RDF Tools Obsidian plugin. It's designed to verify all functionality including graph scoping, caching, and SPARQL query execution.

## Directory Structure

```
test-vault/
├── people/           # Individual person data
│   ├── alice.md     # Alice Smith - Software Engineer
│   ├── bob.md       # Bob Johnson - Data Scientist
│   ├── charlie.md   # Charlie Davis - UI/UX Designer
│   └── diana.md     # Diana Wilson - Product Manager
├── projects/         # Project information
│   ├── project-rdf.md    # RDF Tools for Obsidian
│   ├── project-ai.md     # AI Research Platform
│   ├── project-mobile.md # Mobile Productivity App
│   └── project-nlp.md    # NLP Research
├── organizations/    # Organization data
│   └── acme-corp.md # ACME Corporation
├── events/          # Event information
│   └── semantic-web-meetup.md
└── testing files/   # Comprehensive test scenarios
    ├── graph-testing.md       # Graph scope testing
    ├── cache-testing.md       # Cache invalidation testing
    ├── performance-testing.md # Performance and edge cases
    └── README.md             # This file
```

## Test Scenarios

### 1. Graph Scope Testing (`graph-testing.md`)

Tests different FROM clause behaviors:
- **No FROM**: Current file only (default graph)
- **FROM <vault://people/>**: All files in people directory
- **FROM <vault://projects/>**: All files in projects directory
- **FROM <vault://>**: All files in the entire vault
- **FROM <vault://people/alice.md>**: Specific file only
- **Multiple FROM**: Combine specific files

### 2. Cache Invalidation Testing (`cache-testing.md`)

Tests that query results update when data changes:
- Real-time team monitoring
- Project budget tracking
- Skills inventory updates
- Cross-directory dependency tracking

### 3. Performance Testing (`performance-testing.md`)

Tests performance and edge cases:
- Large result sets (all triples)
- Complex multi-hop queries
- Error handling (non-existent files/directories)
- ASK, CONSTRUCT, and DESCRIBE queries
- Unicode and special character handling

## How to Use This Test Data

1. **Open in Obsidian**: Place this test-vault in your Obsidian vaults directory
2. **Install RDF Tools**: Ensure the RDF Tools plugin is installed and enabled
3. **View/Edit Mode**: Switch between edit and view modes to see SPARQL results
4. **Test Cache Invalidation**:
   - Open `cache-testing.md`
   - Note the initial query results
   - Edit a person file (add skills, change department, etc.)
   - Return to `cache-testing.md` and verify results updated automatically
5. **Test Graph Scopes**:
   - Compare results from directory-level vs vault-level queries
   - Verify file-specific queries only show data from that file
6. **Test Performance**:
   - Run large queries and observe execution times
   - Test error handling with invalid file paths

## Expected Behavior

### ✅ Working Correctly

- SPARQL blocks show "View query" header with results below
- Results appear only once (no duplication)
- Directory queries (`FROM <vault://people/>`) include all files in that directory
- Vault queries (`FROM <vault://>`) include all files in the vault
- File queries (`FROM <vault://people/alice.md>`) include only that specific file
- Cache invalidation: Results update automatically when source files change
- Query execution times are displayed
- Error messages for invalid FROM clauses

### ❌ Potential Issues to Check

- Duplicated query results (should be fixed now)
- Cache not invalidating when files change
- FROM clauses not working correctly
- Performance issues with large queries
- Plugin not working in edit vs view mode

## Sample Queries to Try

1. **Find all people**: `SELECT ?person ?name WHERE { ?person foaf:name ?name . } FROM <vault://people/>`
2. **Cross-department collaboration**: `SELECT ?p1 ?p2 ?project WHERE { ?p1 ex:worksOn ?project . ?p2 ex:worksOn ?project . FILTER(?p1 != ?p2) } FROM <vault:/>`
3. **Skills analysis**: `SELECT ?skill (COUNT(?person) as ?count) WHERE { ?person ex:skill ?skill . } FROM <vault://people/> GROUP BY ?skill ORDER BY DESC(?count)`

## Troubleshooting

If queries aren't working:
1. Check that the RDF Tools plugin is enabled
2. Verify turtle syntax is valid (no parsing errors shown)
3. Ensure file paths in FROM clauses are correct
4. Try refreshing the view or switching between edit/view modes
5. Check the browser console for any error messages