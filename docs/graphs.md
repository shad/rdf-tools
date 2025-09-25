# Available Graphs

RDF Tools provides several types of graphs that you can query with SPARQL. Each graph represents a different aspect of your Obsidian vault or the RDF data within it.

## Graph Types

### 1. Vault File Graphs (`vault://`)

Each markdown file containing Turtle code blocks becomes a named graph. These graphs contain the RDF data you've authored in your notes.

#### URI Patterns

- **Specific file**: `vault://path/to/file.md`
  - Contains RDF data from turtle blocks in that specific file
  - Example: `FROM <vault://people/contacts.md>`

- **Directory**: `vault://path/to/directory/`
  - Contains RDF data from all files in that directory (recursive)
  - Example: `FROM <vault://projects/>`

- **Root vault**: `vault://`
  - Contains RDF data from all files in your vault
  - Example: `FROM <vault://>`

#### Base URI Resolution

Each file graph uses its own base URI for relative references:

```turtle
# In file: vault://people/contacts.md
@base <vault://people/contacts.md/> .

<alice> foaf:name "Alice Smith" .  # Expands to vault://people/contacts.md/alice
```

#### Default Graph Behavior

When no `FROM` clause is specified in a SPARQL query:
- Query runs against the current file's graph only
- Other files are not included automatically
- Use explicit `FROM` clauses for cross-file queries

### 2. Meta Graphs (`meta://`)

Meta graphs provide metadata about your vault structure and files. These are automatically generated and updated.

#### Metadata Graph (`meta://`)

Contains information about:
- File and directory structure
- File metadata (size, creation/modification dates)
- Word counts for markdown files
- Wikilink relationships between files
- File type classifications

```sparql
# Query file metadata
SELECT ?file ?name ?size ?wordCount
FROM <meta://>
WHERE {
    ?file a vault:Note ;
          vault:name ?name ;
          vault:size ?size ;
          vault:wordCount ?wordCount .
}
ORDER BY DESC(?wordCount)
```

#### Ontology Graph (`meta://ontology`)

Contains the RDF Tools ontology schema (classes and properties):
- Class hierarchy definitions
- Property domains and ranges
- Labels and documentation

```sparql
# Query available classes
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?class ?label ?comment
FROM <meta://ontology>
WHERE {
    ?class a rdfs:Class ;
           rdfs:label ?label .
    OPTIONAL { ?class rdfs:comment ?comment }
}
ORDER BY ?label
```

## Graph Loading and Caching

### Performance Features

- **Lazy Loading**: Graphs are loaded only when needed
- **Smart Caching**: Parsed graphs are cached in memory
- **Incremental Updates**: Only changed files are reprocessed
- **Automatic Invalidation**: Cache is invalidated when files change

### Memory Management

- Query timeouts prevent runaway queries
- Result size limits protect against memory issues
- Background processing keeps UI responsive

## Query Examples

### Single File Query
```sparql
# Query data from a specific file
SELECT ?person ?name
FROM <vault://people/team.md>
WHERE {
    ?person a foaf:Person ;
            foaf:name ?name .
}
```

### Multi-File Query
```sparql
# Query data from multiple files
SELECT ?person ?name
FROM <vault://people/team.md>
FROM <vault://people/contacts.md>
WHERE {
    ?person a foaf:Person ;
            foaf:name ?name .
}
```

### Directory Query
```sparql
# Query all files in a directory
SELECT ?person ?project
FROM <vault://projects/>
WHERE {
    ?person schema:worksOn ?project .
}
```

### Vault-Wide Query
```sparql
# Query across entire vault
SELECT ?subject ?predicate ?object
FROM <vault://>
WHERE {
    ?subject ?predicate ?object .
}
LIMIT 100
```

### Meta Graph Queries

#### File Statistics
```sparql
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>

SELECT ?type (COUNT(?file) AS ?count) (AVG(?size) AS ?avgSize)
FROM <meta://>
WHERE {
    ?file a ?type ;
          vault:size ?size .
    FILTER(?type IN (vault:Note, vault:Attachment))
}
GROUP BY ?type
```

#### Link Analysis
```sparql
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>

# Find most connected files
SELECT ?file ?linkCount
FROM <meta://>
WHERE {
    {
        SELECT ?file (COUNT(?target) AS ?linkCount)
        WHERE {
            ?file vault:linksTo ?target .
        }
        GROUP BY ?file
    }
}
ORDER BY DESC(?linkCount)
LIMIT 10
```

#### Directory Structure
```sparql
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>

# Show directory tree
SELECT ?dir ?file ?name
FROM <meta://>
WHERE {
    ?dir a vault:Directory ;
         vault:contains ?file .
    ?file vault:name ?name .
}
ORDER BY ?dir ?name
```

### Combined Queries

```sparql
# Combine content and metadata
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>

SELECT ?person ?name ?file ?wordCount
FROM <vault://people/>
FROM <meta://>
WHERE {
    # Content data
    ?person a foaf:Person ;
            foaf:name ?name .

    # Metadata
    ?file a vault:Note ;
          vault:wordCount ?wordCount .

    # Connect via base URI pattern
    FILTER(STRSTARTS(STR(?person), STR(?file)))
}
```

## Graph URI Resolution

The RDF Tools system resolves graph URIs as follows:

1. **Exact matches**: `vault://file.md` → single file graph
2. **Directory patterns**: `vault://dir/` → all files in directory
3. **Root pattern**: `vault://` → all files in vault
4. **Meta patterns**: `meta://` → metadata, `meta://ontology` → schema
5. **Invalid patterns**: Non-existent files or invalid URIs cause errors

## Error Handling

### Graph Loading Errors
- Missing files: Queries will exclude unavailable graphs
- Parse errors: Individual turtle blocks that fail are skipped
- Permission errors: Files that can't be read are logged and skipped

### Query Errors
- Syntax errors: Shown below query blocks
- Timeout errors: Queries exceeding time limits are terminated
- Memory errors: Large result sets are truncated with warnings

### Recovery Strategies
- Fix turtle syntax errors to include data in queries
- Use `LIMIT` clauses for large result sets
- Check file paths in `FROM` clauses for typos
- Monitor query performance and optimize as needed

## Best Practices

### Performance
- Use specific `FROM` clauses instead of `vault://` when possible
- Add `LIMIT` clauses to exploratory queries
- Use `DISTINCT` only when necessary
- Index commonly queried properties in your data design

### Organization
- Group related RDF data in the same file/directory
- Use consistent URI schemes across your vault
- Document your custom vocabularies and prefixes
- Separate metadata queries from content queries

### Maintenance
- Regularly review query performance
- Clean up unused turtle blocks
- Validate turtle syntax to avoid parse errors
- Use version control for important RDF data files