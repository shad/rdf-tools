# Base URI Resolution Testing

This file tests that relative URIs in turtle blocks are correctly resolved using the document's graph URI as the base.

## Expected Behavior

With the base URI fix, relative URIs like `<alice>` should resolve to the document's graph URI + the relative part. For this file (`base-uri-testing.md`), the base URI should be:

```
@base <vault://base-uri-testing.md/> .
```

So `<alice>` resolves to `<vault://base-uri-testing.md/alice>`.

## Test Data with Relative URIs

```turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex: <https://example.org/> .

# These use relative URIs that should resolve to vault://base-uri-testing.md/XXX
<alice> a foaf:Person ;
    foaf:name "Alice (from base-uri-testing.md)" ;
    ex:friend <bob>, <charlie> ;
    ex:localId "alice-local" .

<bob> a foaf:Person ;
    foaf:name "Bob (from base-uri-testing.md)" ;
    ex:friend <alice> ;
    ex:localId "bob-local" .

<charlie> a foaf:Person ;
    foaf:name "Charlie (from base-uri-testing.md)" ;
    ex:friend <alice>, <bob> ;
    ex:localId "charlie-local" .

# This uses an absolute URI - should NOT be affected by base URI
<https://example.org/external-entity> foaf:name "External Entity" ;
    ex:relatedTo <alice> .
```

## Debug: Check if @base is being added

This query shows ALL triples to see the actual URIs:

```sparql
SELECT ?s ?p ?o WHERE {
    ?s ?p ?o .
}
LIMIT 20
```

## Verification Queries

### 1. Find All Local Entities (Should Show Expanded URIs)

This query should show that `<alice>`, `<bob>`, and `<charlie>` have been expanded to full URIs:

```sparql
SELECT ?localEntity ?name WHERE {
    ?localEntity foaf:name ?name .
    FILTER(STRSTARTS(STR(?localEntity), "vault://base-uri-testing.md/"))
}
ORDER BY ?name
```

### 2. Check Base URI Resolution

This query verifies that relative URIs are properly resolved:

```sparql
SELECT ?s ?p ?o WHERE {
    ?s ?p ?o .
    FILTER(
        STRSTARTS(STR(?s), "vault://base-uri-testing.md/") ||
        STRSTARTS(STR(?o), "vault://base-uri-testing.md/")
    )
}
ORDER BY ?s ?p ?o
```

### 3. Test Friendship Network

This should show friendships between locally-defined entities:

```sparql
SELECT ?person1 ?name1 ?person2 ?name2 WHERE {
    ?person1 ex:friend ?person2 ;
             foaf:name ?name1 .
    ?person2 foaf:name ?name2 .
    FILTER(STRSTARTS(STR(?person1), "vault://base-uri-testing.md/"))
    FILTER(STRSTARTS(STR(?person2), "vault://base-uri-testing.md/"))
}
ORDER BY ?name1 ?name2
```

### 4. Mixed URI Types

This query shows both local and external URIs:

```sparql
SELECT ?entity ?name ?type WHERE {
    ?entity foaf:name ?name .
    BIND(
        IF(STRSTARTS(STR(?entity), "vault://base-uri-testing.md/"),
           "Local",
           "External") as ?type
    )
}
ORDER BY ?type ?name
```

## What You Should See

If the base URI resolution is working correctly:

1. **Local entities** should have URIs like:
   - `<vault://base-uri-testing.md/alice>`
   - `<vault://base-uri-testing.md/bob>`
   - `<vault://base-uri-testing.md/charlie>`

2. **External entities** should remain unchanged:
   - `<https://example.org/external-entity>`

3. **Friendship relationships** should work between local entities using their expanded URIs

4. **Queries should return results** showing the proper URI expansion

## Troubleshooting

If queries return no results or show unexpected URIs:

1. Check if `@base <vault://base-uri-testing.md/>` is being automatically added to the turtle content
2. Verify that relative URIs like `<alice>` are being expanded properly
3. Look for any parsing errors in the turtle block
4. Check the browser console for any RDF parsing errors

This test verifies that the key requirement from the project documentation is working:

> "When defining turtle in a file, the base for urls should be <vault://somedirectory/somefile.md/>
> in `somefile.md` if I have `<test>` then the IRI would expand to <vault://somedirectory/somefile.md/test>"