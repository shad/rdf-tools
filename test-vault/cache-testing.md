# Cache Invalidation Testing

This file helps test cache invalidation when data changes. Make changes to other files and watch these queries update automatically.

## Real-time Team Monitoring

This query should update immediately when you modify people files:

```sparql
PREFIX ex: <https://example.com/>

SELECT ?person ?name ?dept ?project 
FROM <vault://people/>
WHERE {
    ?person foaf:name ?name ;
            ex:department ?dept ;
            ex:worksOn ?project .
}
ORDER BY ?dept ?name
```

## Project Budget Tracking

This query monitors project budgets and should update when project files change:

```sparql
PREFIX ex: <https://example.com/>

SELECT ?project ?name ?budget ?status 
FROM <vault://projects/>
WHERE {
    ?project foaf:name ?name ;
             ex:budget ?budget ;
             ex:status ?status .
}
ORDER BY DESC(?budget)
```

## Live Skills Inventory

Watch this update as you add/remove skills from people files:

```sparql
PREFIX ex: <https://example.com/>

SELECT ?skill (COUNT(?person) as ?peopleCount)
FROM <vault://people/>
WHERE {
    ?person ex:skill ?skill .
}
GROUP BY ?skill
ORDER BY DESC(?peopleCount) ?skill
```

## Cross-Directory Dependencies

This vault-wide query should reflect all changes across directories:

```sparql
PREFIX ex: <https://example.com/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>

SELECT ?person ?personName ?projectName ?eventName WHERE {
    ?person foaf:name ?personName .
    OPTIONAL {
        ?person ex:worksOn ?project .
        ?project foaf:name ?projectName .
    }
    OPTIONAL {
        ?event ex:attendee ?person ;
               foaf:name ?eventName .
    }
}
ORDER BY ?personName
```

---

## Cache Testing Instructions

1. **Start with baseline**: Open this file and note the query results
2. **Modify a person**: Edit alice.md and add a new skill like "GraphQL"
3. **Watch for updates**: The skills inventory should show the new skill
4. **Add project relationship**: In bob.md, add `ex:worksOn <project-mobile>`
5. **Verify cross-updates**: Team monitoring should show Bob on mobile project
6. **Change project budget**: Modify project-ai.md budget from 120000 to 150000
7. **Check budget tracking**: Budget query should reflect the change
8. **Add new person**: Create a new person file in people/ directory
9. **Verify directory inclusion**: All people queries should include new person
10. **Test file deletion**: Delete a person file and verify it disappears from queries
11. **Test file rename**: Rename a project file and verify references update

## Performance Testing

### Heavy Query (Test Caching Performance)
```sparql
SELECT ?s ?p ?o 
FROM <vault://>
WHERE {
    ?s ?p ?o .
}
LIMIT 100
```

### Repeated Query (Should Use Cache)
```sparql
SELECT ?person ?name 
FROM <vault://people/>
WHERE {
    ?person foaf:name ?name .
}
```
