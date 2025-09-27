import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryExecutorService } from '../QueryExecutorService';
import { GraphService } from '../GraphService';
import { PrefixService } from '../PrefixService';
import { SparqlQuery, SparqlQueryFactory } from '../../models/SparqlQuery';
import { App, TFile } from 'obsidian';

/**
 * Regression test for FROM clause handling after pure function refactoring
 *
 * Tests the specific case where queries like:
 * ```sparql
 * SELECT * FROM <vault://hellboy-universe.md> WHERE { ?s ?p ?o }
 * ```
 * Should query the turtle data in hellboy-universe.md
 */

describe('QueryExecutorService - FROM Clause Regression Tests', () => {
  let service: QueryExecutorService;
  let graphService: GraphService;
  let prefixService: PrefixService;
  let mockApp: App;

  beforeEach(() => {
    prefixService = new PrefixService();

    // Mock the App for the integration test
    mockApp = {
      vault: {
        getAbstractFileByPath: (path: string) => {
          if (path === 'hellboy-universe.md') {
            return {
              path: 'hellboy-universe.md',
              name: 'hellboy-universe.md',
            } as TFile;
          }
          return null;
        },
        read: async (file: TFile) => {
          if (file.path === 'hellboy-universe.md') {
            return `# Hellboy Universe

## Characters and Relationships

\`\`\`turtle
@prefix : <vault://hellboy-universe.md/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

:Hellboy a foaf:Person ;
    foaf:name "Hellboy" ;
    :species "Demon" .

:Azzael a foaf:Person ;
    foaf:name "Azzael" ;
    :species "Demon" .
\`\`\``;
          }
          return '';
        },
      },
    } as unknown as App;

    const mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      updateSettings: vi.fn(),
    } as any;
    graphService = new GraphService(mockApp, prefixService, mockLogger);
    service = new QueryExecutorService(graphService);
  });

  it('should parse FROM clause and populate query context correctly', async () => {
    // Test the parsing chain that was broken during refactoring
    const queryString = `
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      PREFIX : <vault://hellboy-universe.md/>
      SELECT ?name ?species
      FROM <vault://hellboy-universe.md>
      WHERE {
        ?person foaf:name ?name ;
                :species ?species .
      }
    `;

    // Step 1: Create initial query (like real app)
    const query = SparqlQueryFactory.createSparqlQuery({
      queryString,
      location: {
        file: { path: 'hellboy-queries.md' } as TFile,
        startLine: 1,
        endLine: 8,
        startColumn: 1,
        endColumn: 1,
      },
      baseUri: 'vault://hellboy-queries.md/',
      timeoutMs: 5000,
    });

    // Initially should have empty FROM clauses
    expect(query.context.fromGraphs).toEqual([]);
    expect(query.context.fromNamedGraphs).toEqual([]);
    expect(query.parsedQuery).toBeUndefined();

    // Step 2: Parse SPARQL query (like real app)
    const { parseSparqlQuery } = await import('../../utils/parsing');
    const parseResult = parseSparqlQuery(queryString);

    // Parsing should succeed and extract FROM clause
    expect(parseResult.success).toBe(true);
    expect(parseResult.fromGraphs).toEqual(['vault://hellboy-universe.md']);
    expect(parseResult.fromNamedGraphs).toEqual([]);
    expect(parseResult.parsedQuery).toBeDefined();

    // Step 3: Update query context with parse results (like real app)
    if (parseResult.success) {
      if (parseResult.fromGraphs) {
        query.context.fromGraphs = parseResult.fromGraphs;
      }
      if (parseResult.fromNamedGraphs) {
        query.context.fromNamedGraphs = parseResult.fromNamedGraphs;
      }
      if (parseResult.parsedQuery) {
        query.parsedQuery = parseResult.parsedQuery;
      }
    }

    // Step 4: Verify query context is now populated correctly
    expect(query.context.fromGraphs).toEqual(['vault://hellboy-universe.md']);
    expect(query.context.fromNamedGraphs).toEqual([]);
    expect(query.parsedQuery).toBeDefined();

    // Step 5: Verify query planning works correctly
    const { createQueryPlan } = await import('../../utils/planning');
    const plan = createQueryPlan(
      query.context.fromGraphs,
      query.context.fromNamedGraphs,
      query.location.file.path,
      (uri: string) => [uri], // Simple resolver for test
      (filePath: string) => `vault://${filePath}`
    );

    expect(plan.strategy).toBe('from');
    expect(plan.graphSpecs).toHaveLength(1);
    expect(plan.graphSpecs[0].uri).toBe('vault://hellboy-universe.md');
    expect(plan.graphSpecs[0].asNamedGraph).toBe(false);
    expect(plan.originalFromGraphs).toEqual(['vault://hellboy-universe.md']);
  });

  it('should parse FROM NAMED clause correctly', async () => {
    // Test FROM NAMED parsing (different from FROM)
    const queryString = `
      SELECT ?s ?p ?o
      FROM NAMED <vault://hellboy-universe.md>
      WHERE { GRAPH ?g { ?s ?p ?o } }
    `;

    // Parse and verify FROM NAMED is handled correctly
    const { parseSparqlQuery } = await import('../../utils/parsing');
    const parseResult = parseSparqlQuery(queryString);

    expect(parseResult.success).toBe(true);
    expect(parseResult.fromGraphs).toEqual([]);
    expect(parseResult.fromNamedGraphs).toEqual(['vault://hellboy-universe.md']);
    expect(parseResult.parsedQuery).toBeDefined();

    // Verify planning for FROM NAMED
    const { createQueryPlan } = await import('../../utils/planning');
    const plan = createQueryPlan(
      parseResult.fromGraphs || [],
      parseResult.fromNamedGraphs || [],
      'test-file.md',
      (uri: string) => [uri],
      (filePath: string) => `vault://${filePath}`
    );

    expect(plan.strategy).toBe('from_named');
    expect(plan.graphSpecs).toHaveLength(1);
    expect(plan.graphSpecs[0].uri).toBe('vault://hellboy-universe.md');
    expect(plan.graphSpecs[0].asNamedGraph).toBe(true);
    expect(plan.originalFromNamedGraphs).toEqual(['vault://hellboy-universe.md']);
  });

  it('should handle mixed FROM and FROM NAMED clauses', async () => {
    // Test mixed FROM and FROM NAMED in same query
    const queryString = `
      SELECT ?s ?p ?o
      FROM <vault://default-graph.md>
      FROM NAMED <vault://named-graph.md>
      WHERE {
        ?s ?p ?o .
        OPTIONAL { GRAPH ?g { ?s ?p ?o } }
      }
    `;

    // Parse and verify mixed FROM handling
    const { parseSparqlQuery } = await import('../../utils/parsing');
    const parseResult = parseSparqlQuery(queryString);

    expect(parseResult.success).toBe(true);
    expect(parseResult.fromGraphs).toEqual(['vault://default-graph.md']);
    expect(parseResult.fromNamedGraphs).toEqual(['vault://named-graph.md']);

    // Verify planning for mixed strategy
    const { createQueryPlan } = await import('../../utils/planning');
    const plan = createQueryPlan(
      parseResult.fromGraphs || [],
      parseResult.fromNamedGraphs || [],
      'test-file.md',
      (uri: string) => [uri],
      (filePath: string) => `vault://${filePath}`
    );

    expect(plan.strategy).toBe('mixed');
    expect(plan.graphSpecs).toHaveLength(2);

    // Check default graph spec
    const defaultSpec = plan.graphSpecs.find(spec => !spec.asNamedGraph);
    expect(defaultSpec).toBeDefined();
    expect(defaultSpec!.uri).toBe('vault://default-graph.md');

    // Check named graph spec
    const namedSpec = plan.graphSpecs.find(spec => spec.asNamedGraph);
    expect(namedSpec).toBeDefined();
    expect(namedSpec!.uri).toBe('vault://named-graph.md');
  });

  it('should execute FROM clause query and return actual results (integration test)', async () => {
    // This is a full integration test that verifies the complete FROM clause flow
    const queryString = `
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      PREFIX : <vault://hellboy-universe.md/>
      SELECT ?name ?species
      FROM <vault://hellboy-universe.md>
      WHERE {
        ?person foaf:name ?name ;
                :species ?species .
      }
    `;

    // Create and set up query exactly like the real application does
    const query = SparqlQueryFactory.createSparqlQuery({
      queryString,
      location: {
        file: { path: 'hellboy-queries.md' } as TFile,
        startLine: 1,
        endLine: 8,
        startColumn: 1,
        endColumn: 1,
      },
      baseUri: 'vault://hellboy-queries.md/',
      timeoutMs: 5000,
    });

    // Parse SPARQL query to extract FROM clauses (like real app)
    const { parseSparqlQuery } = await import('../../utils/parsing');
    const parseResult = parseSparqlQuery(queryString);

    // Verify parsing succeeded
    expect(parseResult.success).toBe(true);
    expect(parseResult.fromGraphs).toEqual(['vault://hellboy-universe.md']);

    // Update query with parse results (like real app)
    if (parseResult.success) {
      if (parseResult.fromGraphs) {
        query.context.fromGraphs = parseResult.fromGraphs;
      }
      if (parseResult.fromNamedGraphs) {
        query.context.fromNamedGraphs = parseResult.fromNamedGraphs;
      }
      if (parseResult.parsedQuery) {
        query.parsedQuery = parseResult.parsedQuery;
      }
    }

    // Execute the query - this should now work with the FROM clause fix
    const result = await service.executeQuery(query);

    // Verify successful execution
    expect(result.status).toBe('completed');
    expect(result.queryType).toBe('SELECT');

    if (result.status === 'completed' && result.queryType === 'SELECT') {
      // Should find the characters in hellboy-universe.md
      expect(result.bindings).toBeDefined();
      expect(result.bindings!.length).toBeGreaterThan(0);

      // Should find both Hellboy and Azzael
      const names = result.bindings!.map(b => b.name?.value);
      expect(names).toContain('Hellboy');
      expect(names).toContain('Azzael');

      // Should have species data
      const species = result.bindings!.map(b => b.species?.value);
      expect(species).toContain('Demon');
    }

    // Verify the query used the correct graph
    expect(result.usedGraphs).toContain('vault://hellboy-universe.md');
    expect(result.totalTriplesQueried).toBeGreaterThan(0);
  });
});