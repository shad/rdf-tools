# RDF Tools Ontology Overview

The RDF Tools ontology provides a comprehensive vocabulary for describing Obsidian vault structure, content, and metadata as RDF. This ontology is automatically available in the `meta://ontology` graph.

## Namespace

```turtle
@prefix vault: <http://shadr.us/ns/rdf-tools/v1#> .
```

## Class Hierarchy

### Core Resource Classes

```
vault:Resource (base class)
├── vault:File
│   ├── vault:Note (markdown files)
│   └── vault:Attachment (images, PDFs, etc.)
└── vault:Directory
```

#### vault:Resource
**Base class for all vault items**
- Description: Any resource within the vault (files, directories, etc.)
- Properties: `vault:path`, `vault:name`, `vault:created`, `vault:modified`

#### vault:File
**Physical files in the vault**
- Subclass of: `vault:Resource`
- Additional properties: `vault:size`
- Description: Represents any file stored in the file system

#### vault:Note
**Markdown note files**
- Subclass of: `vault:File`
- Additional properties: `vault:wordCount`, `vault:hasTag`, `vault:hasProperty`, `vault:linksTo`
- Description: Markdown files that can contain text, links, and frontmatter

#### vault:Attachment
**Binary files and attachments**
- Subclass of: `vault:File`
- Description: Images, PDFs, audio files, and other binary attachments

#### vault:Directory
**Folder containers**
- Subclass of: `vault:Resource`
- Additional properties: `vault:contains`
- Description: Directories that contain other resources

### Link and Reference Classes

```
vault:Link (base class)
├── vault:WikiLink ([[internal links]])
└── vault:ExternalLink (URLs)
```

#### vault:Link
**Base class for all link types**
- Description: Represents connections between resources

#### vault:WikiLink
**Obsidian-style internal links**
- Subclass of: `vault:Link`
- Description: `[[wikilinks]]` that connect vault files

#### vault:ExternalLink
**External URLs**
- Subclass of: `vault:Link`
- Description: HTTP/HTTPS links to external resources

### Content Structure Classes

```
vault:Section (base class)
├── vault:Heading (# ## ### etc.)
├── vault:Paragraph
├── vault:ListItem
│   └── vault:TodoItem (- [ ] tasks)
└── vault:Tag (#hashtags)
```

#### vault:Section
**Document structure elements**
- Properties: `vault:lineNumber`
- Description: Structural elements within documents

#### vault:Heading
**Markdown headings**
- Subclass of: `vault:Section`
- Properties: `vault:headingLevel`, `vault:headingText`
- Description: Document headings from H1 (`#`) to H6 (`######`)

#### vault:Paragraph
**Text paragraphs**
- Description: Blocks of text content

#### vault:ListItem
**List items**
- Description: Items in bulleted or numbered lists

#### vault:TodoItem
**Task items**
- Subclass of: `vault:ListItem`
- Properties: `vault:todoStatus`, `vault:todoText`
- Description: Checkable todo items `- [ ]` or `- [x]`

#### vault:Tag
**Hashtags**
- Description: `#hashtags` used for categorization

#### vault:Property
**Frontmatter properties**
- Description: YAML frontmatter key-value pairs

## Core Properties

### Basic Metadata

#### vault:path
- **Domain**: `vault:Resource`
- **Range**: `xsd:string`
- **Description**: File system path relative to vault root
- **Example**: `"people/contacts.md"`

#### vault:name
- **Domain**: `vault:Resource`
- **Range**: `xsd:string`
- **Description**: Resource name (filename or directory name)
- **Example**: `"contacts.md"`

#### vault:created
- **Domain**: `vault:Resource`
- **Range**: `xsd:dateTime`
- **Description**: Creation timestamp
- **Example**: `"2024-01-15T10:30:00Z"`

#### vault:modified
- **Domain**: `vault:Resource`
- **Range**: `xsd:dateTime`
- **Description**: Last modification timestamp
- **Example**: `"2024-01-20T15:45:30Z"`

#### vault:size
- **Domain**: `vault:File`
- **Range**: `xsd:integer`
- **Description**: File size in bytes
- **Example**: `1024`

### Relationship Properties

#### vault:linksTo
- **Domain**: `vault:Note`
- **Range**: `vault:Resource`
- **Description**: Direct link from one note to another resource
- **Inverse**: `vault:backlinkedFrom`

#### vault:backlinkedFrom
- **Domain**: `vault:Resource`
- **Range**: `vault:Note`
- **Description**: Indicates which notes link to this resource
- **Inverse**: `vault:linksTo`

#### vault:contains
- **Domain**: `vault:Directory`
- **Range**: `vault:Resource`
- **Description**: Directory contains a resource
- **Inverse**: `vault:parentDirectory`

#### vault:parentDirectory
- **Domain**: `vault:Resource`
- **Range**: `vault:Directory`
- **Description**: Parent directory of a resource
- **Inverse**: `vault:contains`

### Content Properties

#### vault:wordCount
- **Domain**: `vault:Note`
- **Range**: `xsd:integer`
- **Description**: Number of words in the note content
- **Example**: `342`

#### vault:hasTag
- **Domain**: `vault:Note`
- **Range**: `vault:Tag`
- **Description**: Associates a note with a tag

#### vault:hasProperty
- **Domain**: `vault:Note`
- **Range**: `vault:Property`
- **Description**: Associates a note with a frontmatter property

### Structure Properties

#### vault:hasSection
- **Domain**: `vault:Note`
- **Range**: `vault:Section`
- **Description**: Note contains a structural section

#### vault:headingLevel
- **Domain**: `vault:Heading`
- **Range**: `xsd:integer`
- **Description**: Heading level (1-6)
- **Example**: `2` (for `## Heading`)

#### vault:headingText
- **Domain**: `vault:Heading`
- **Range**: `xsd:string`
- **Description**: Text content of the heading
- **Example**: `"Introduction"`

#### vault:lineNumber
- **Domain**: `vault:Section`, `vault:ListItem`
- **Range**: `xsd:integer`
- **Description**: Line number where element appears in file

#### vault:todoStatus
- **Domain**: `vault:TodoItem`
- **Range**: `xsd:string`
- **Description**: Completion status of todo item
- **Values**: `"incomplete"`, `"complete"`

#### vault:todoText
- **Domain**: `vault:TodoItem`
- **Range**: `xsd:string`
- **Description**: Text content of the todo item

### Extended Metadata Properties

#### vault:aliases
- **Domain**: `vault:Note`
- **Range**: `xsd:string`
- **Description**: Alternative names for the note (from frontmatter)

#### vault:cssclass
- **Domain**: `vault:Note`
- **Range**: `xsd:string`
- **Description**: CSS class for custom styling (from frontmatter)

## Usage Examples

### Query the Ontology

```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>

# List all classes with their labels
SELECT ?class ?label ?comment
FROM <meta://ontology>
WHERE {
    ?class a rdfs:Class ;
           rdfs:label ?label .
    OPTIONAL { ?class rdfs:comment ?comment }
}
ORDER BY ?label
```

### Explore Properties

```sparql
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>

# Show all properties with domains and ranges
SELECT ?property ?label ?domain ?range
FROM <meta://ontology>
WHERE {
    ?property a rdf:Property ;
              rdfs:label ?label .
    OPTIONAL { ?property rdfs:domain ?domain }
    OPTIONAL { ?property rdfs:range ?range }
}
ORDER BY ?label
```

### Validate Data Against Schema

```sparql
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>

# Find instances of each class
SELECT ?class ?label (COUNT(?instance) AS ?count)
FROM <meta://>
FROM <meta://ontology>
WHERE {
    ?class a rdfs:Class ;
           rdfs:label ?label .
    OPTIONAL {
        ?instance a ?class .
    }
}
GROUP BY ?class ?label
ORDER BY DESC(?count)
```

## Practical Applications

### File System Analysis

Use the ontology to analyze your vault structure:

```sparql
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>

# Find largest files by type
SELECT ?type (MAX(?size) AS ?maxSize) (AVG(?size) AS ?avgSize) (COUNT(?file) AS ?count)
FROM <meta://>
WHERE {
    ?file a ?type ;
          vault:size ?size .
    FILTER(?type IN (vault:Note, vault:Attachment))
}
GROUP BY ?type
```

### Content Metrics

Analyze your writing patterns:

```sparql
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>

# Word count statistics
SELECT
    (COUNT(?note) AS ?totalNotes)
    (SUM(?wordCount) AS ?totalWords)
    (AVG(?wordCount) AS ?avgWords)
    (MAX(?wordCount) AS ?longestNote)
FROM <meta://>
WHERE {
    ?note a vault:Note ;
          vault:wordCount ?wordCount .
}
```

### Link Analysis

Understanding your knowledge graph:

```sparql
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>

# Most connected notes
SELECT ?note ?name (COUNT(?target) AS ?linkCount)
FROM <meta://>
WHERE {
    ?note a vault:Note ;
          vault:name ?name ;
          vault:linksTo ?target .
}
GROUP BY ?note ?name
ORDER BY DESC(?linkCount)
LIMIT 10
```

## Extending the Ontology

While the base ontology covers common Obsidian structures, you can extend it for your specific needs:

### Custom Classes

```turtle
@prefix vault: <http://shadr.us/ns/rdf-tools/v1#> .
@prefix my: <vault://ontologies/my-vocab.md/> .

# Custom document types
my:Meeting a rdfs:Class ;
    rdfs:subClassOf vault:Note ;
    rdfs:label "Meeting Note" .

my:Project a rdfs:Class ;
    rdfs:subClassOf vault:Note ;
    rdfs:label "Project" .
```

### Custom Properties

```turtle
my:attendee a rdf:Property ;
    rdfs:domain my:Meeting ;
    rdfs:range foaf:Person ;
    rdfs:label "Meeting attendee" .

my:dueDate a rdf:Property ;
    rdfs:domain my:Project ;
    rdfs:range xsd:date ;
    rdfs:label "Project due date" .
```

### Integration with External Vocabularies

```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix schema: <https://schema.org/> .
@prefix dc: <http://purl.org/dc/terms/> .

# Map vault concepts to standard vocabularies
vault:Note rdfs:subClassOf schema:CreativeWork .
vault:linksTo rdfs:subPropertyOf dc:relation .
vault:created rdfs:subPropertyOf dc:created .
```

## Best Practices

### Querying the Ontology

1. **Explore incrementally**: Start with basic class and property listings
2. **Use OPTIONAL patterns**: Not all resources have all properties
3. **Combine with data**: Join ontology queries with actual data from `meta://`
4. **Check constraints**: Understand domains and ranges before creating data

### Schema Evolution

1. **Extend, don't modify**: Add new classes/properties rather than changing existing ones
2. **Document extensions**: Use `rdfs:comment` for custom vocabulary
3. **Maintain compatibility**: Ensure new definitions don't conflict with core ontology
4. **Version control**: Track changes to custom ontology extensions

### Performance Considerations

1. **Cache ontology queries**: The schema changes infrequently
2. **Use specific predicates**: Avoid broad `?p ?o` patterns in ontology queries
3. **Index frequently used paths**: Consider common query patterns in your data design