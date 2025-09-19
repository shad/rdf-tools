# Performance and Edge Case Testing

This file contains queries to test performance, edge cases, and error handling.

## Large Result Sets

### All Triples (Stress Test)
```sparql
SELECT ?s ?p ?o WHERE {
    ?s ?p ?o .
}
FROM <vault://>
```

### All Relationships
```sparql
SELECT ?subject ?predicate ?object WHERE {
    ?subject ?predicate ?object .
    FILTER(isURI(?object))
}
FROM <vault://>
```

## Complex Queries

### Multi-hop Relationships
```sparql
SELECT ?person1 ?person2 ?sharedProject WHERE {
    ?person1 foaf:knows ?person2 .
    ?person1 ex:worksOn ?sharedProject .
    ?person2 ex:worksOn ?sharedProject .
}
FROM <vault://>
```

### Aggregation with Filtering
```sparql
SELECT ?dept (AVG(?budget) as ?avgBudget) (COUNT(?project) as ?projectCount) WHERE {
    ?person ex:department ?dept ;
            ex:worksOn ?project .
    ?project ex:budget ?budget .
    FILTER(?budget > 50000)
}
FROM <vault://>
GROUP BY ?dept
HAVING (COUNT(?project) > 1)
ORDER BY DESC(?avgBudget)
```

## Error Handling Tests

### Non-existent File
```sparql
SELECT ?s ?p ?o WHERE {
    ?s ?p ?o .
}
FROM <vault://nonexistent/file.md>
```

### Non-existent Directory
```sparql
SELECT ?s ?p ?o WHERE {
    ?s ?p ?o .
}
FROM <vault://nonexistent-directory/>
```

### Malformed URI
```sparql
SELECT ?s ?p ?o WHERE {
    ?s ?p ?o .
}
FROM <invalid-uri>
```

## Edge Cases

### Empty Directory Query
```sparql
SELECT ?s ?p ?o WHERE {
    ?s ?p ?o .
}
FROM <vault://empty-directory/>
```

### Query with No Results
```sparql
SELECT ?nonexistent WHERE {
    ?nonexistent <http://example.org/does-not-exist> "nothing" .
}
FROM <vault://>
```

### Large String Values
```sparql
SELECT ?project ?description WHERE {
    ?project doap:description ?description .
    FILTER(strlen(?description) > 50)
}
FROM <vault://projects/>
```

## ASK Queries

### Check if Alice exists
```sparql
ASK {
    <alice> foaf:name "Alice Smith" .
}
FROM <vault://people/>
```

### Check if high-budget projects exist
```sparql
ASK {
    ?project ex:budget ?budget .
    FILTER(?budget > 100000)
}
FROM <vault://projects/>
```

## CONSTRUCT Queries

### Build a simple knowledge graph
```sparql
CONSTRUCT {
    ?person <http://example.org/summary> ?summary .
} WHERE {
    ?person foaf:name ?name ;
            ex:title ?title ;
            ex:department ?dept .
    BIND(CONCAT(?name, " is a ", ?title, " in ", ?dept) as ?summary)
}
FROM <vault://people/>
```

### Extract project-person relationships
```sparql
CONSTRUCT {
    ?project <http://example.org/hasTeamMember> ?person .
    ?person <http://example.org/contributesTo> ?project .
} WHERE {
    ?person ex:worksOn ?project .
}
FROM <vault://>
```

## DESCRIBE Queries

### Describe Alice
```sparql
DESCRIBE <alice>
FROM <vault://people/alice.md>
```

### Describe all projects
```sparql
DESCRIBE ?project WHERE {
    ?project a doap:Project .
}
FROM <vault://projects/>
```

---

## Test Data for Complex Scenarios

```turtle
@prefix test: <https://test.example.org/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

# Complex nested data
test:complexData a test:TestCase ;
    test:hasNestedStructure [
        test:level1 [
            test:level2 [
                test:level3 "Deep nesting test"
            ]
        ]
    ] ;
    test:multipleValues "value1", "value2", "value3" ;
    test:numericData 42, 3.14159, -100 ;
    test:dateData "2024-01-20"^^<http://www.w3.org/2001/XMLSchema#date> ;
    test:booleanData true, false ;
    rdfs:comment "This is test data for complex query scenarios" .

# Unicode and special characters
test:unicodeData test:emoji "🚀🔧💡" ;
    test:specialChars "Special: !@#$%^&*()_+-=[]{}|;':\",./<>?" ;
    test:multiline """This is a
    multiline string
    with various content""" .
```