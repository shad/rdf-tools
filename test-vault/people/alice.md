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

## Alice's Projects Query

This query shows all projects Alice works on:

```sparql
SELECT ?project ?projectName WHERE {
    <alice> ex:worksOn ?project .
    ?project foaf:name ?projectName .
}
```

## Alice's Skills (Current File Only)

```sparql
SELECT ?skill WHERE {
    <alice> ex:skill ?skill .
}
```