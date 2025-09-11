# Testing Guidelines for RDF-Tools

## Testing Strategy

**Unit Tests** - Test individual services and models in isolation with mocked dependencies. Mock N3.js and Comunica at service boundaries.

**Integration Tests** - Test service interactions with real RDF libraries but mocked file systems. Use fixture data for consistent test scenarios.

**Plugin Tests** - Test Obsidian integration with completely mocked Obsidian APIs. Focus on file monitoring, UI updates, and plugin lifecycle.

## Key Principles

- **Dependency Injection** - All services accept dependencies through constructors for easy mocking
- **Mock External, Test Internal** - Mock RDF libraries and Obsidian APIs, test your business logic
- **Test Data Builders** - Create programmatic helpers for generating test graphs and queries
- **Async Patterns** - Establish consistent patterns for testing promises, events, and timeouts

## Test Organization

```
tests/
  unit/           # Individual services and models
  integration/    # Service interactions with real RDF libs  
  plugin/         # Obsidian integration logic
  fixtures/       # Sample turtle files and SPARQL queries
```

## Testing Stack

- Jest with TypeScript
- Custom RDF matchers for triple assertions
- Fixture management for test data
- Performance benchmarks for critical operations

The goal is comprehensive coverage with fast, reliable tests that can run without Obsidian or external dependencies.
