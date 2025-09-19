# Bob Johnson - Data Scientist

Bob specializes in knowledge graphs and machine learning.

```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex: <https://example.org/> .

<bob> a foaf:Person ;
    foaf:name "Bob Johnson" ;
    foaf:mbox <mailto:bob@example.org> ;
    foaf:knows <alice>, <diana> ;
    ex:title "Senior Data Scientist" ;
    ex:department "AI Research" ;
    ex:worksOn <project-ai>, <project-nlp> ;
    ex:skill "Machine Learning", "Knowledge Graphs", "Python", "SPARQL" .
```

## Bob's Network Query (People Directory)

This query finds Bob's connections within the people directory:

```sparql
SELECT ?person ?name WHERE {
    <bob> foaf:knows ?person .
    ?person foaf:name ?name .
}
FROM <vault://people/>
```

## Cross-Department Collaboration (Vault-wide)

```sparql
SELECT ?person ?dept ?project WHERE {
    <bob> ex:worksOn ?project .
    ?person ex:worksOn ?project .
    ?person ex:department ?dept .
    FILTER(?person != <bob>)
}
FROM <vault://>
```