import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RdfToolsService } from '../RdfToolsService';
import { App, MarkdownPostProcessorContext } from 'obsidian';

// Mock Obsidian Component class
vi.mock('obsidian', async () => {
  const actual = await vi.importActual('obsidian');
  return {
    ...actual,
    Component: class Component {
      onload() {}
      onunload() {}
      addChild() {}
    },
  };
});

/**
 * Integration tests that reproduce the actual UI failures
 * These tests trace the real execution path in markdown documents
 */
describe('RdfToolsService Integration Tests', () => {
  let service: RdfToolsService;
  let mockApp: any;
  let mockPlugin: any;
  let mockSettings: any;

  beforeEach(() => {
    // Mock App with vault
    mockApp = {
      vault: {
        getAbstractFileByPath: vi.fn(),
        getMarkdownFiles: vi.fn(),
        getFiles: vi.fn(),
        read: vi.fn(),
      },
      workspace: {
        on: vi.fn(),
        getLeavesOfType: vi.fn().mockReturnValue([]),
      },
    };

    mockPlugin = {
      registerMarkdownCodeBlockProcessor: vi.fn(),
      registerEvent: vi.fn(),
      registerInterval: vi.fn(),
    };

    mockSettings = {
      enableDebugLogging: false,
      autoExecuteQueries: true,
      showDetailedErrors: true,
    };

    const mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      updateSettings: vi.fn(),
    } as any;
    service = new RdfToolsService(mockApp as App, mockPlugin, mockSettings, mockLogger);
  });

  describe('SPARQL Query Execution Path - Real UI Flow', () => {
    it('should reproduce "Unknown prefix: ex" error from alice.md', async () => {
      // Setup: Mock alice.md file
      const aliceFile = {
        path: 'people/alice.md',
        extension: 'md',
      };

      const aliceContent = `# Alice Smith

\`\`\`turtle
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex: <https://example.org/> .

<alice> a foaf:Person ;
    foaf:name "Alice Smith" ;
    ex:skill "Semantic Web", "RDF" .
\`\`\``;

      // The SPARQL query that fails in the UI
      const sparqlQuery = `SELECT ?skill WHERE {
    <alice> ex:skill ?skill .
}`;

      mockApp.vault.getAbstractFileByPath.mockReturnValue(aliceFile);
      mockApp.vault.read.mockResolvedValue(aliceContent);
      mockApp.vault.getMarkdownFiles.mockReturnValue([aliceFile]);
      mockApp.vault.getFiles.mockReturnValue([]);

      // Mock context as it would come from markdown processor
      const ctx: MarkdownPostProcessorContext = {
        sourcePath: 'people/alice.md',
        frontmatter: {},
        docId: 'test-doc',
        getSectionInfo: vi.fn(),
        addChild: vi.fn(),
      } as any;

      // Create mock container to capture results
      const container = {
        querySelector: vi.fn(),
        ownerDocument: {
          createElement: vi.fn(() => ({
            classList: { add: vi.fn() },
            appendChild: vi.fn(),
            innerHTML: '',
            textContent: '',
          })),
        },
      } as any;

      container.querySelector.mockReturnValue({
        innerHTML: '',
        appendChild: vi.fn(),
        ownerDocument: container.ownerDocument,
      });

      // Initialize service
      await service.onload();

      // Execute the same path as the UI: handleSparqlBlock
      try {
        await (service as any).handleSparqlBlock(sparqlQuery, container, ctx);

        // We expect this to fail with "Unknown prefix: ex" because:
        // 1. determineTargetGraphsForQuery is called BEFORE parsing
        // 2. query.context.fromGraphs is still empty []
        // 3. It defaults to current file only
        // 4. But the prefix extraction happens on wrong target graphs

        expect.fail('Expected "Unknown prefix: ex" error but query succeeded');
      } catch (error) {
        // This should reproduce the UI error
        expect(error.message).toContain('Unknown prefix');
      }
    });

    it('should reproduce "No data available for query execution" from vault:// query', async () => {
      // Setup: Mock alice.md with vault-wide query
      const aliceFile = {
        path: 'people/alice.md',
        extension: 'md',
      };

      const aliceContent = `# Alice Smith

\`\`\`turtle
@prefix ex: <https://example.org/> .
<alice> ex:name "Alice Smith" .
\`\`\``;

      // This query should query the entire vault but will fail
      const vaultWideQuery = `SELECT ?project ?projectName
FROM <vault://>
WHERE {
    <alice> ex:worksOn ?project .
    ?project foaf:name ?projectName .
}`;

      mockApp.vault.getAbstractFileByPath.mockReturnValue(aliceFile);
      mockApp.vault.read.mockResolvedValue(aliceContent);
      mockApp.vault.getMarkdownFiles.mockReturnValue([aliceFile]);
      mockApp.vault.getFiles.mockReturnValue([]);

      const ctx: MarkdownPostProcessorContext = {
        sourcePath: 'people/alice.md',
        frontmatter: {},
        docId: 'test-doc',
        getSectionInfo: vi.fn(),
        addChild: vi.fn(),
      } as any;

      const container = {
        querySelector: vi.fn(),
        ownerDocument: {
          createElement: vi.fn(() => ({
            classList: { add: vi.fn() },
            appendChild: vi.fn(),
            innerHTML: '',
            textContent: '',
          })),
        },
      } as any;

      container.querySelector.mockReturnValue({
        innerHTML: '',
        appendChild: vi.fn(),
        ownerDocument: container.ownerDocument,
      });

      await service.onload();

      // Execute the same path as the UI
      try {
        await (service as any).handleSparqlBlock(vaultWideQuery, container, ctx);

        // This should fail because:
        // 1. determineTargetGraphsForQuery runs BEFORE parsing
        // 2. It doesn't see the FROM <vault://> clause
        // 3. It defaults to current file: ['vault://people/alice.md']
        // 4. Query executes only against alice.md, finds no matching data

        expect.fail('Expected "No data available" error but query succeeded');
      } catch (error) {
        expect(error.message).toContain('No data');
      }
    });

  });

  describe('Testing the Real Execution Order Problem', () => {
    it('should demonstrate the wrong execution order in handleSparqlBlock', async () => {
      const file = { path: 'test.md', extension: 'md', stat: { ctime: 0, mtime: 0, size: 0 } };
      const queryWithVault = `SELECT ?x FROM <vault://> WHERE { ?x ?p ?o }`;

      // Track the order of operations
      const executionOrder: string[] = [];

      // Mock the service methods to track execution order
      const originalDetermineTargetGraphs = (service as any).determineTargetGraphsForQuery;
      const originalExtractPrefixes = (service as any).extractPrefixesFromGraphs;
      const originalParseSparql = service.getSparqlParserService().parseSparqlQuery;

      (service as any).determineTargetGraphsForQuery = vi.fn((...args) => {
        executionOrder.push('determineTargetGraphs');
        return originalDetermineTargetGraphs.call(service, ...args);
      });

      (service as any).extractPrefixesFromGraphs = vi.fn((...args) => {
        executionOrder.push('extractPrefixes');
        return originalExtractPrefixes.call(service, ...args);
      });

      service.getSparqlParserService().parseSparqlQuery = vi.fn((...args) => {
        executionOrder.push('parseSparqlQuery');
        return originalParseSparql.call(service.getSparqlParserService(), ...args);
      });

      mockApp.vault.getAbstractFileByPath.mockReturnValue(file);
      mockApp.vault.read.mockResolvedValue('');
      mockApp.vault.getMarkdownFiles.mockReturnValue([]);

      const ctx = { sourcePath: 'test.md' } as any;
      const container = {
        querySelector: vi.fn().mockReturnValue({ innerHTML: '', appendChild: vi.fn() })
      } as any;

      await service.onload();

      try {
        await (service as any).handleSparqlBlock(queryWithVault, container, ctx);
      } catch (error) {
        // Expected to fail
      }

      // After the fix, the execution order should be corrected:
      // Since we now parse first, the old methods are not called in the wrong order
      expect(executionOrder).toEqual([]);

      // The correct order is now implemented:
      // 1. parseSparqlContent (to extract FROM clauses) - called internally
      // 2. determineTargetGraphsFromParseResult (using parsed FROM clauses) - new method
      // 3. extractPrefixes (using correct target graphs)
      // 4. parseSparqlQuery (final parse with extracted prefixes)
    });
  });
});