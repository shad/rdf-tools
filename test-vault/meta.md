# Vault Metadata Queries

This file demonstrates querying vault metadata using the `meta://` graph, which contains information about files, directories, and relationships within the vault.

## All Files in Vault

List all files with their basic metadata:

```sparql
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?file ?name ?size ?created ?modified
FROM <meta://>
WHERE {
    ?file a vault:Note ;
          vault:name ?name ;
          vault:size ?size ;
          vault:created ?created ;
          vault:modified ?modified .
}
ORDER BY ?name
```

## Directory Structure

Show the directory hierarchy:

```sparql
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>

SELECT ?directory ?directoryName ?file ?fileName
FROM <meta://>
WHERE {
    ?directory a vault:Directory ;
               vault:name ?directoryName ;
               vault:contains ?file .
    ?file vault:name ?fileName .
}
ORDER BY ?directoryName ?fileName
```

## Large Files

Find files larger than 1000:

```sparql
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?file ?name ?size
FROM <meta://>
WHERE {
    ?file a vault:Note ;
          vault:name ?name ;
          vault:size ?size .
    FILTER(?size > 1000)
}
ORDER BY DESC(?size)
```

## Recently Modified Files

Show files modified in the last week (example - adjust date as needed):

```sparql
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

SELECT ?file ?name ?modified
FROM <meta://>
WHERE {
    ?file a vault:Note ;
          vault:name ?name ;
          vault:modified ?modified .
   #FILTER(?modified > "2024-09-01T00:00:00Z"^^xsd:dateTime)
}
ORDER BY DESC(?modified)
```

## Note Files with Word Count

Show markdown notes with their word counts:

```sparql
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>

SELECT ?note ?name ?wordCount
FROM <meta://>
WHERE {
    ?note a vault:Note ;
          vault:name ?name ;
          vault:wordCount ?wordCount .
}
ORDER BY DESC(?wordCount)
```

## File Relationships

Show which files link to other files:

```sparql
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>

SELECT ?sourceFile ?sourceName ?targetFile ?targetName
FROM <meta://>
WHERE {
    ?sourceFile vault:linksTo ?targetFile .
    ?sourceFile vault:name ?sourceName .
    ?targetFile vault:name ?targetName .
}
ORDER BY ?sourceName ?targetName
```

## File Type Statistics

Count files by type:

```sparql
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>

SELECT ?type (COUNT(?file) AS ?count)
FROM <meta://>
WHERE {
    ?file a ?type .
    FILTER(?type IN (vault:Note, vault:Attachment, vault:File))
}
GROUP BY ?type
ORDER BY DESC(?count)
```

## Parent-Child Directory Relationships

Show directory structure with parent relationships:

```sparql
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>

SELECT ?child ?childName ?parent ?parentName
FROM <meta://>
WHERE {
    ?child vault:parentDirectory ?parent .
    ?child vault:name ?childName .
    ?parent vault:name ?parentName .
}
ORDER BY ?parentName ?childName
```

## Mixed Graph Query Test

Test querying both metadata and content graphs together:

```sparql
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>
PREFIX ex: <http://shadr.us/ns/example#>

SELECT ?file ?name ?size ?contentTriple
FROM <meta://>
FROM <vault://hellboy-universe.md>
WHERE {
    # Get file metadata from meta:// graph
    ?file a vault:Note ;
          vault:name ?name ;
          vault:size ?size .
    FILTER(?name = "hellboy-universe.md")

    # Get content data from vault:// graph
    OPTIONAL {
        ?entity ?property ?value .
        BIND(CONCAT(STR(?entity), " ", STR(?property), " ", STR(?value)) AS ?contentTriple)
    }
}
LIMIT 5
```

## Files Without Links

Find isolated files that don't link to anything and aren't linked from anywhere:

```sparql
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>

SELECT ?file ?name
FROM <meta://>
WHERE {
    ?file a vault:Note ;
          vault:name ?name .

    # File doesn't link to anything
    OPTIONAL { ?file vault:linksTo ?target1 }
    FILTER(!BOUND(?target1))

    # File isn't linked from anything
    OPTIONAL { ?source vault:linksTo ?file }
    FILTER(!BOUND(?source))
}
ORDER BY ?name
```

## Files in People Directory

Show all files in the people directory:

```sparql
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>

SELECT ?file ?name ?size
FROM <meta://>
WHERE {
    ?file vault:path ?path ;
          vault:name ?name ;
          vault:size ?size .
    FILTER(STRSTARTS(?path, "people/"))
}
ORDER BY ?name
```

## Ontology Exploration

Query the ontology to see all classes defined:

```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?class ?label ?comment
FROM <meta://ontology>
WHERE {
    ?class rdf:type rdfs:Class ;
           rdfs:label ?label .
    OPTIONAL { ?class rdfs:comment ?comment }
}
ORDER BY ?label
```

## Ontology Properties

Query the ontology to see all properties and their domains:

```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?property ?label ?domain ?range
FROM <meta://ontology>
WHERE {
    ?property rdf:type rdf:Property ;
              rdfs:label ?label .
    OPTIONAL { ?property rdfs:domain ?domain }
    OPTIONAL { ?property rdfs:range ?range }
}
ORDER BY ?label
```

## Mixed Ontology and Metadata Query

Query both ontology and metadata together to validate file types against ontology:

```sparql
PREFIX vault: <http://shadr.us/ns/rdf-tools/v1#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?file ?name ?type ?typeLabel
FROM <meta://>
FROM <meta://ontology>
WHERE {
    # Get files and their types from metadata
    ?file rdf:type ?type ;
          vault:name ?name .

    # Get type labels from ontology
    ?type rdfs:label ?typeLabel .
}
ORDER BY ?typeLabel ?name
LIMIT 10
```