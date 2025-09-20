# Alice Smith - Software Engineer

Alice is a senior software engineer specializing in semantic web technologies.

```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex: <https://example.org/> .

<alice> a foaf:Person ;
    foaf:name "Alice Smith" ;
    foaf:mbox <mailto:alice@example.org> ;
    foaf:knows <bob>, <charlie> ;
    ex:title "Senior Software Engineer" ;
    ex:department "Engineering" ;
    ex:worksOn <project-rdf>, <project-ai> ;
    ex:skill "Semantic Web", "RDF", "SPARQL", "JavaScript" .
```

## Alice's Projects Query (Cross-Vault)

This query shows all projects Alice works on across the entire vault:

```sparql
SELECT ?project ?projectName 
FROM <vault://>
WHERE {
    <alice> ex:worksOn ?project .
    ?project foaf:name ?projectName .
}
```

## Alice's Skills (Current File Only)

This query uses the relative URI `<alice>` which should resolve to `<vault://people/alice.md/alice>`:

```sparql
SELECT ?skill WHERE {
    <alice> ex:skill ?skill .
}
```

## Base URI Verification

This query verifies that Alice's URI has been properly expanded:

```sparql
SELECT ?alice ?property ?value WHERE {
    ?alice ?property ?value .
    FILTER(STR(?alice) = "vault://people/alice.md/alice")
}
LIMIT 10
```