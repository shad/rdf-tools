# Ontology Graph Test

This file tests the new `meta://ontology` graph functionality.

## Simple Ontology Query

Query the ontology to see all classes:

```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?class ?label
FROM <meta://ontology>
WHERE {
    ?class rdf:type rdfs:Class ;
           rdfs:label ?label .
}
ORDER BY ?label
```

## Count Classes and Properties

```sparql
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT
    (COUNT(DISTINCT ?class) AS ?classCount)
    (COUNT(DISTINCT ?property) AS ?propertyCount)
FROM <meta://ontology>
WHERE {
    OPTIONAL { ?class rdf:type rdfs:Class }
    OPTIONAL { ?property rdf:type rdf:Property }
}
```