# Prefix Extraction Test

This file tests that prefix extraction is working correctly for both scenarios.

## Test Data

```turtle
@prefix ex: <https://example.org/> .
@prefix test: <https://test.org/> .

<local-entity> a ex:Thing ;
    test:property "test value" ;
    ex:name "Local Entity" .
```

## Test 1: No FROM Clause (Current File Only)

This query should automatically get the `ex:` and `test:` prefixes from the turtle block above:

```sparql
SELECT ?name WHERE {
    <local-entity> ex:name ?name .
}
```

## Test 2: Current File with Different Prefix

This query uses the `test:` prefix from this file:

```sparql
SELECT ?value WHERE {
    <local-entity> test:property ?value .
}
```

## Test 3: Vault-wide Query with Mixed Prefixes

This query should get prefixes from ALL files in the vault, including `ex:` from alice.md:

```sparql
SELECT ?entity ?name
FROM <vault://>
WHERE {
    ?entity ex:name ?name .
}
```

## Expected Results

- **Test 1**: Should return "Local Entity" (using ex: prefix from current file)
- **Test 2**: Should return "test value" (using test: prefix from current file)
- **Test 3**: Should return entities from all files that use ex:name (including Alice and local-entity)

If these queries work without "Unknown prefix" errors, then the prefix extraction is working correctly.