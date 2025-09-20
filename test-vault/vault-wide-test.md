# Vault-Wide Query Test

This file tests that `FROM <vault://>` queries work correctly and have access to prefixes from all files.

## Test Data in This File

```turtle
@prefix local: <https://local-test.org/> .
@prefix ex: <https://example.org/> .

<vault-entity> a local:TestEntity ;
    ex:name "Vault Test Entity" ;
    local:createdIn "vault-wide-test.md" .
```

## Vault-Wide Query Using Mixed Prefixes

This query should:
1. Use the `ex:` prefix (available from alice.md and this file)
2. Use the `local:` prefix (available from this file)
3. Query ALL files in the vault via `FROM <vault://>`

```sparql
SELECT ?entity ?name ?location
FROM <vault://>
WHERE {
    ?entity ex:name ?name .
    OPTIONAL { ?entity local:createdIn ?location }
}
ORDER BY ?name
```

## Expected Results

If this works correctly, you should see:
- Alice Smith (from people/alice.md)
- Local Entity (from prefix-test.md)
- Vault Test Entity (from this file)

And there should be NO "Unknown prefix" errors for either `ex:` or `local:` prefixes.

## Simple Test Query

Here's a simpler test - this should find all entities with names across the entire vault:

```sparql
SELECT ?name
FROM <vault://>
WHERE {
    ?entity ex:name ?name .
}
```

This tests that:
1. `FROM <vault://>` includes data from all files
2. The `ex:` prefix is available (defined in multiple files)
3. The query execution pipeline is working end-to-end