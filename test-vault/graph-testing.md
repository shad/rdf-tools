# Graph Scope Testing

This file contains comprehensive SPARQL queries to test different graph scopes and verify caching behavior.

## 1. Current File Only (Default Graph)

This query only searches the current file's turtle data:

```sparql
SELECT ?s ?p ?o WHERE {
    ?s ?p ?o .
} LIMIT 5
```

```turtle
@prefix test: <https://test.example.org/> .

test:localData test:inFile "graph-testing.md" ;
    test:timestamp "2024-01-20T10:00:00Z" .
```

## 2. People Directory Queries

### All People in People Directory
```sparql
SELECT ?person ?name ?title WHERE {
    ?person foaf:name ?name ;
            ex:title ?title .
}
FROM <vault://people/>
```

### Skills by Department (People Directory)
```sparql
SELECT ?dept ?skill (COUNT(?person) as ?count) WHERE {
    ?person ex:department ?dept ;
            ex:skill ?skill .
}
FROM <vault://people/>
GROUP BY ?dept ?skill
ORDER BY ?dept ?count
```

### Social Network Analysis (People Directory)
```sparql
SELECT ?person1 ?name1 ?person2 ?name2 WHERE {
    ?person1 foaf:knows ?person2 ;
             foaf:name ?name1 .
    ?person2 foaf:name ?name2 .
}
FROM <vault://people/>
ORDER BY ?name1 ?name2
```

## 3. Projects Directory Queries

### Project Overview
```sparql
SELECT ?project ?name ?status ?budget WHERE {
    ?project foaf:name ?name ;
             ex:status ?status ;
             ex:budget ?budget .
}
FROM <vault://projects/>
ORDER BY DESC(?budget)
```

### Programming Languages Used
```sparql
SELECT ?language (COUNT(?project) as ?projectCount) WHERE {
    ?project doap:programming-language ?language .
}
FROM <vault://projects/>
GROUP BY ?language
ORDER BY DESC(?projectCount)
```

## 4. Cross-Directory Queries (Vault-wide)

### People-Project Relationships
```sparql
SELECT ?person ?personName ?project ?projectName ?role WHERE {
    ?person foaf:name ?personName ;
            ex:worksOn ?project .
    ?project foaf:name ?projectName .
    OPTIONAL { ?person ex:title ?role }
}
FROM <vault://>
ORDER BY ?personName ?projectName
```

### Department-Project Matrix
```sparql
SELECT ?dept ?project ?projectName (COUNT(?person) as ?teamSize) WHERE {
    ?person ex:department ?dept ;
            ex:worksOn ?project .
    ?project foaf:name ?projectName .
}
FROM <vault://>
GROUP BY ?dept ?project ?projectName
ORDER BY ?dept DESC(?teamSize)
```

### Skill-Project Alignment
```sparql
SELECT ?skill ?project ?projectName WHERE {
    ?person ex:skill ?skill ;
            ex:worksOn ?project .
    ?project foaf:name ?projectName .
}
FROM <vault://>
ORDER BY ?skill ?projectName
```

### Event Attendee Analysis
```sparql
SELECT ?event ?eventName ?attendee ?attendeeName ?attendeeTitle WHERE {
    ?event foaf:name ?eventName ;
           ex:attendee ?attendee .
    ?attendee foaf:name ?attendeeName ;
              ex:title ?attendeeTitle .
}
FROM <vault://>
```

## 5. Specific File Queries

### Alice's Data Only
```sparql
SELECT ?s ?p ?o WHERE {
    ?s ?p ?o .
}
FROM <vault://people/alice.md>
```

### RDF Project Data Only
```sparql
SELECT ?s ?p ?o WHERE {
    ?s ?p ?o .
}
FROM <vault://projects/project-rdf.md>
```

## 6. Multi-File FROM Clauses

### Combine Alice and Bob's Data
```sparql
SELECT ?person ?name ?skill WHERE {
    ?person foaf:name ?name ;
            ex:skill ?skill .
}
FROM <vault://people/alice.md>
FROM <vault://people/bob.md>
ORDER BY ?name ?skill
```

### Combine All Project Files
```sparql
SELECT ?project ?name ?status ?language WHERE {
    ?project foaf:name ?name ;
             ex:status ?status ;
             doap:programming-language ?language .
}
FROM <vault://projects/project-rdf.md>
FROM <vault://projects/project-ai.md>
FROM <vault://projects/project-mobile.md>
FROM <vault://projects/project-nlp.md>
ORDER BY ?name ?language
```