# RDF Tools Project

A semantic web plugin for Obsidian that enables RDF data processing and SPARQL queries.

```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex: <https://example.org/> .
@prefix doap: <http://usefulinc.com/ns/doap#> .

<project-rdf> a doap:Project ;
    foaf:name "RDF Tools for Obsidian" ;
    doap:description "Semantic web plugin enabling RDF data processing and SPARQL queries in Obsidian" ;
    doap:programming-language "TypeScript", "JavaScript" ;
    ex:status "Active" ;
    ex:priority "High" ;
    ex:startDate "2024-01-15" ;
    ex:budget 50000 ;
    ex:managedBy <diana> .
```