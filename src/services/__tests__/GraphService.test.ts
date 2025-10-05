/**
 * Tests for GraphService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Store, DataFactory } from 'n3';
import { GraphService } from '@/services/GraphService';
import { Graph } from '@/models/Graph';
import { MockTFile } from '@/tests/helpers/setup';
import { createCommonPrefixes } from '@/tests/helpers/test-utils';
import type { App } from 'obsidian';
import type { PrefixService } from '@/services/PrefixService';

// Mock dependencies
let mockApp: App;
let mockPrefixService: PrefixService;

// Mock MarkdownGraphParser
vi.mock('@/services/MarkdownGraphParser', () => ({
  MarkdownGraphParser: vi.fn().mockImplementation(() => ({
    parse: vi.fn(),
  })),
}));

// Mock console methods to avoid noise in tests
const consoleSpy = {
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
};

describe('GraphService', () => {
  let graphService: GraphService;
  let mockMarkdownParser: { parse: ReturnType<typeof vi.fn> };
  let mockLogger: any;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock Obsidian App
    mockApp = {
      vault: {
        getAbstractFileByPath: vi.fn(),
        read: vi.fn(),
        getMarkdownFiles: vi.fn().mockReturnValue([]),
        getFiles: vi.fn().mockReturnValue([]),
        getAllLoadedFiles: vi.fn().mockReturnValue([]),
      },
      metadataCache: {
        getFirstLinkpathDest: vi.fn(),
      },
    } as unknown as App;

    // Mock PrefixService
    mockPrefixService = {
      getGlobalPrefixes: vi.fn().mockReturnValue(createCommonPrefixes()),
      generatePrefixDeclarations: vi.fn().mockReturnValue(''),
    } as unknown as PrefixService;

    // Create a fresh parser mock for each test
    const { MarkdownGraphParser } = await import('@/services/MarkdownGraphParser');
    mockMarkdownParser = { parse: vi.fn() };
    (MarkdownGraphParser as any).mockImplementation(() => mockMarkdownParser);

    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      updateSettings: vi.fn(),
    } as any;
    graphService = new GraphService(mockApp, mockPrefixService, mockLogger);
  });

  afterEach(() => {
    consoleSpy.error.mockClear();
    if (mockLogger) {
      mockLogger.error.mockClear();
      mockLogger.warn.mockClear();
    }
  });

  describe('constructor', () => {
    it('should initialize with app and prefix service', () => {
      expect(graphService).toBeInstanceOf(GraphService);
      expect(graphService).toBeDefined();
    });

    it('should create instance with empty cache', async () => {
      // Cache should be empty initially - test via public interface
      const result = graphService.resolveVaultUri('vault://');
      expect(result).toEqual([]);
    });
  });

  describe('getGraphUriForFile', () => {
    it('should convert file path to vault URI', () => {
      const result = graphService.getGraphUriForFile('notes/test.md');
      expect(result).toBe('vault://notes/test.md');
    });

    it('should handle Windows-style paths', () => {
      const result = graphService.getGraphUriForFile('notes\\test.md');
      expect(result).toBe('vault://notes/test.md');
    });

    it('should handle root-level files', () => {
      const result = graphService.getGraphUriForFile('test.md');
      expect(result).toBe('vault://test.md');
    });

    it('should handle nested directories', () => {
      const result = graphService.getGraphUriForFile('deep/nested/dir/test.md');
      expect(result).toBe('vault://deep/nested/dir/test.md');
    });

    it('should handle mixed slashes', () => {
      const result = graphService.getGraphUriForFile('notes\\mixed/path\\test.md');
      expect(result).toBe('vault://notes/mixed/path/test.md');
    });
  });

  describe('resolveVaultUri', () => {
    beforeEach(async () => {
      // Add some test graphs to cache for resolution tests
      const testGraphs = [
        createMockGraph('vault://dir1/file1.md', 'dir1/file1.md'),
        createMockGraph('vault://dir1/file2.md', 'dir1/file2.md'),
        createMockGraph('vault://dir2/file3.md', 'dir2/file3.md'),
        createMockGraph('vault://root.md', 'root.md'),
      ];

      // Mock successful loading for cache setup
      setupMockSuccessfulParsing(['test content', 'test content', 'test content', 'test content']);

      for (const graph of testGraphs) {
        (mockApp.vault.getAbstractFileByPath as any).mockReturnValue(new MockTFile(graph.filePath));
        (mockApp.vault.read as any).mockResolvedValue('test content');

        await graphService.getGraphs([graph.uri]);
      }
    });

    it('should return non-vault URIs as-is', () => {
      const result = graphService.resolveVaultUri('http://example.org/graph');
      expect(result).toEqual(['http://example.org/graph']);
    });

    it('should return all cached graphs for root vault URI', () => {
      // Mock files in the vault
      const mockFiles = [
        new MockTFile('dir1/file1.md'),
        new MockTFile('dir1/file2.md'),
        new MockTFile('dir2/file3.md'),
        new MockTFile('root.md'),
      ];

      (mockApp.vault.getMarkdownFiles as any).mockReturnValue(mockFiles);
      (mockApp.vault.getFiles as any).mockReturnValue(mockFiles);

      const result = graphService.resolveVaultUri('vault://');
      expect(result).toHaveLength(4);
      expect(result).toContain('vault://dir1/file1.md');
      expect(result).toContain('vault://dir1/file2.md');
      expect(result).toContain('vault://dir2/file3.md');
      expect(result).toContain('vault://root.md');
    });

    it('should return directory-filtered graphs for directory URIs', () => {
      // Mock files in the vault
      const mockFiles = [
        new MockTFile('dir1/file1.md'),
        new MockTFile('dir1/file2.md'),
        new MockTFile('dir2/file3.md'),
        new MockTFile('root.md'),
      ];

      (mockApp.vault.getMarkdownFiles as any).mockReturnValue(mockFiles);
      (mockApp.vault.getFiles as any).mockReturnValue(mockFiles);

      const result = graphService.resolveVaultUri('vault://dir1/');
      expect(result).toHaveLength(2);
      expect(result).toContain('vault://dir1/file1.md');
      expect(result).toContain('vault://dir1/file2.md');
      expect(result).not.toContain('vault://dir2/file3.md');
    });

    it('should return specific graph for file URIs', () => {
      const result = graphService.resolveVaultUri('vault://dir1/file1.md');
      expect(result).toEqual(['vault://dir1/file1.md']);
    });

    it('should return empty array for root URI with empty cache', () => {
      // Create new service with empty cache
      const mockLogger = {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        updateSettings: vi.fn(),
      } as any;
      const emptyService = new GraphService(mockApp, mockPrefixService, mockLogger);
      const result = emptyService.resolveVaultUri('vault://');
      expect(result).toEqual([]);
    });

    it('should return empty array for directory with no matching graphs', () => {
      const result = graphService.resolveVaultUri('vault://nonexistent/');
      expect(result).toEqual([]);
    });
  });

  describe('invalidateGraph', () => {
    it('should remove graph from cache', async () => {
      const graphUri = 'vault://test.md';

      // Setup and load a graph first
      setupMockSuccessfulParsing(['test content']);
      (mockApp.vault.getAbstractFileByPath as any).mockReturnValue(new MockTFile('test.md'));
      (mockApp.vault.read as any).mockResolvedValue('test content');

      // Load the graph to cache it
      const graphs1 = await graphService.getGraphs([graphUri]);
      expect(graphs1).toHaveLength(1);

      // Invalidate the cache
      graphService.invalidateGraph(graphUri);

      // Loading again should cause a fresh load (cache miss)
      // We can verify this by ensuring the file is read again
      const readCallCount = (mockApp.vault.read as any).mock.calls.length;

      // Setup mocks for the re-load
      setupMockSuccessfulParsing(['test content']);
      (mockApp.vault.getAbstractFileByPath as any).mockReturnValue(new MockTFile('test.md'));
      (mockApp.vault.read as any).mockResolvedValue('test content');

      await graphService.getGraphs([graphUri]);
      expect((mockApp.vault.read as any).mock.calls.length).toBe(readCallCount + 1);
    });

    it('should handle invalidating non-existent graph', () => {
      // Should not throw
      expect(() => {
        graphService.invalidateGraph('vault://nonexistent.md');
      }).not.toThrow();
    });

    it('should not affect other cached graphs', async () => {
      const graphUri1 = 'vault://test1.md';
      const graphUri2 = 'vault://test2.md';

      // Setup and load both graphs
      setupMockSuccessfulParsing(['test content 1', 'test content 2']);
      (mockApp.vault.getAbstractFileByPath as any)
        .mockReturnValueOnce(new MockTFile('test1.md'))
        .mockReturnValueOnce(new MockTFile('test2.md'));
      (mockApp.vault.read as any)
        .mockResolvedValueOnce('test content 1')
        .mockResolvedValueOnce('test content 2');

      // Load both graphs
      await graphService.getGraphs([graphUri1, graphUri2]);

      // Invalidate one graph
      graphService.invalidateGraph(graphUri1);

      // When we load the graphs again, only the invalidated one should be re-read
      const initialReadCalls = (mockApp.vault.read as any).mock.calls.length;

      // Setup for the re-read of the invalidated graph
      (mockApp.vault.getAbstractFileByPath as any).mockReturnValue(new MockTFile('test1.md'));
      (mockApp.vault.read as any).mockResolvedValue('test content 1');

      // Load both graphs again - only test1.md should cause a file read
      await graphService.getGraphs([graphUri1, graphUri2]);

      // Should have one additional read call (for the invalidated graph only)
      expect((mockApp.vault.read as any).mock.calls.length).toBe(initialReadCalls + 1);
    });

    it('should cause subsequent getGraphs to reload', async () => {
      const graphUri = 'vault://test.md';

      // Setup mocks
      setupMockSuccessfulParsing(['original content', 'updated content']);
      (mockApp.vault.getAbstractFileByPath as any).mockReturnValue(new MockTFile('test.md'));
      (mockApp.vault.read as any)
        .mockResolvedValueOnce('original content')
        .mockResolvedValueOnce('updated content');

      // Load initially
      const graphs1 = await graphService.getGraphs([graphUri]);
      expect(graphs1).toHaveLength(1);

      // Invalidate
      graphService.invalidateGraph(graphUri);

      // Load again - should trigger re-parsing
      const graphs2 = await graphService.getGraphs([graphUri]);
      expect(graphs2).toHaveLength(1);

      // Verify parsing was called twice (once for each load)
      expect(mockMarkdownParser.parse).toHaveBeenCalledTimes(2);
    });
  });

  describe('getGraphs', () => {
    describe('cache hits', () => {
      it('should return cached graph when available', async () => {
        const graphUri = 'vault://test.md';

        // Setup successful parsing
        setupMockSuccessfulParsing(['test content']);
        (mockApp.vault.getAbstractFileByPath as any).mockReturnValue(new MockTFile('test.md'));
        (mockApp.vault.read as any).mockResolvedValue('test content');

        // Load once
        const graphs1 = await graphService.getGraphs([graphUri]);
        expect(graphs1).toHaveLength(1);
        expect(graphs1[0].uri).toBe(graphUri);

        // Load again - should use cache
        const graphs2 = await graphService.getGraphs([graphUri]);
        expect(graphs2).toHaveLength(1);
        expect(graphs2[0]).toBe(graphs1[0]); // Same object reference

        // Verify file was only read once
        expect(mockApp.vault.read).toHaveBeenCalledTimes(1);
      });

      it('should handle multiple URIs with mixed cache hits and misses', async () => {
        const graphUri1 = 'vault://cached.md';
        const graphUri2 = 'vault://new.md';

        // Pre-cache one graph
        setupMockSuccessfulParsing(['cached content']);
        (mockApp.vault.getAbstractFileByPath as any).mockReturnValue(new MockTFile('cached.md'));
        (mockApp.vault.read as any).mockResolvedValue('cached content');
        await graphService.getGraphs([graphUri1]);

        // Setup for second graph
        setupMockSuccessfulParsing(['cached content', 'new content']);
        (mockApp.vault.getAbstractFileByPath as any).mockReturnValue(new MockTFile('new.md'));
        (mockApp.vault.read as any).mockResolvedValue('new content');

        // Request both
        const graphs = await graphService.getGraphs([graphUri1, graphUri2]);

        expect(graphs).toHaveLength(2);
        expect(graphs[0].uri).toBe(graphUri1);
        expect(graphs[1].uri).toBe(graphUri2);

        // Verify second file was read (first was cached)
        expect(mockApp.vault.read).toHaveBeenCalledTimes(2);
      });

      it('should return graphs in correct order', async () => {
        const uris = ['vault://a.md', 'vault://b.md', 'vault://c.md'];

        // Setup all as cache misses
        setupMockSuccessfulParsing(['content a', 'content b', 'content c']);
        (mockApp.vault.getAbstractFileByPath as any)
          .mockReturnValueOnce(new MockTFile('a.md'))
          .mockReturnValueOnce(new MockTFile('b.md'))
          .mockReturnValueOnce(new MockTFile('c.md'));
        (mockApp.vault.read as any)
          .mockResolvedValueOnce('content a')
          .mockResolvedValueOnce('content b')
          .mockResolvedValueOnce('content c');

        const graphs = await graphService.getGraphs(uris);

        expect(graphs).toHaveLength(3);
        expect(graphs[0].uri).toBe('vault://a.md');
        expect(graphs[1].uri).toBe('vault://b.md');
        expect(graphs[2].uri).toBe('vault://c.md');
      });
    });

    describe('cache misses and loading', () => {
      it('should load and cache new graphs', async () => {
        const graphUri = 'vault://test.md';
        const testContent = `
          @prefix ex: <http://example.org/> .
          ex:alice ex:name "Alice" .
        `;

        // Setup successful parsing
        const quads = [
          DataFactory.quad(
            DataFactory.namedNode('http://example.org/alice'),
            DataFactory.namedNode('http://example.org/name'),
            DataFactory.literal('Alice')
          ),
        ];
        setupMockSuccessfulParsing([testContent], quads);

        (mockApp.vault.getAbstractFileByPath as any).mockReturnValue(new MockTFile('test.md'));
        (mockApp.vault.read as any).mockResolvedValue(testContent);

        const graphs = await graphService.getGraphs([graphUri]);

        expect(graphs).toHaveLength(1);
        const graph = graphs[0];
        expect(graph.uri).toBe(graphUri);
        expect(graph.filePath).toBe('test.md');
        expect(graph.tripleCount).toBe(1);
        expect(graph.store).toBeInstanceOf(Store);
        expect(graph.lastModified).toBeInstanceOf(Date);

        // Verify the quad was added to the store
        const storeQuads = graph.store.getQuads(null, null, null, null);
        expect(storeQuads).toHaveLength(1);
        expect(storeQuads[0].subject.value).toBe('http://example.org/alice');
      });

      it('should handle successful parsing with empty content', async () => {
        const graphUri = 'vault://empty.md';

        // Setup parsing that returns no quads
        setupMockSuccessfulParsing(['']);

        (mockApp.vault.getAbstractFileByPath as any).mockReturnValue(new MockTFile('empty.md'));
        (mockApp.vault.read as any).mockResolvedValue('');

        const graphs = await graphService.getGraphs([graphUri]);

        expect(graphs).toHaveLength(1);
        const graph = graphs[0];
        expect(graph.tripleCount).toBe(0);
        expect(graph.store.size).toBe(0);
      });

      it('should handle empty graphUris array', async () => {
        const graphs = await graphService.getGraphs([]);
        expect(graphs).toEqual([]);
      });

      it('should handle duplicate URIs in request', async () => {
        const graphUri = 'vault://test.md';

        setupMockSuccessfulParsing(['test content']);
        (mockApp.vault.getAbstractFileByPath as any).mockReturnValue(new MockTFile('test.md'));
        (mockApp.vault.read as any).mockResolvedValue('test content');

        const graphs = await graphService.getGraphs([graphUri, graphUri, graphUri]);

        expect(graphs).toHaveLength(3);
        // Should be same object reference since cached after first load
        expect(graphs[0]).toBe(graphs[1]);
        expect(graphs[1]).toBe(graphs[2]);

        // Should only read file once
        expect(mockApp.vault.read).toHaveBeenCalledTimes(1);
      });
    });

    describe('meta:// graph support', () => {
      it('should load meta:// metadata graph', async () => {
        const graphUri = 'meta://';

        const graphs = await graphService.getGraphs([graphUri]);

        expect(graphs).toHaveLength(1);
        const graph = graphs[0];
        expect(graph.uri).toBe('meta://');
        expect(graph.filePath).toBe('');
        expect(graph.store).toBeInstanceOf(Store);
        expect(graph.lastModified).toBeInstanceOf(Date);
      });

      it('should load meta://ontology graph', async () => {
        const graphUri = 'meta://ontology';

        const graphs = await graphService.getGraphs([graphUri]);

        expect(graphs).toHaveLength(1);
        const graph = graphs[0];
        expect(graph.uri).toBe('meta://ontology');
        expect(graph.filePath).toBe('');
        expect(graph.store).toBeInstanceOf(Store);
        expect(graph.tripleCount).toBeGreaterThan(0);
        expect(graph.lastModified).toBeInstanceOf(Date);
      });

      it('should cache meta:// graphs', async () => {
        const graphUri = 'meta://';

        // Load twice
        const graphs1 = await graphService.getGraphs([graphUri]);
        const graphs2 = await graphService.getGraphs([graphUri]);

        expect(graphs2[0]).toBe(graphs1[0]); // Same object reference (cached)
      });

      it('should cache meta://ontology graphs', async () => {
        const graphUri = 'meta://ontology';

        // Load twice
        const graphs1 = await graphService.getGraphs([graphUri]);
        const graphs2 = await graphService.getGraphs([graphUri]);

        expect(graphs2[0]).toBe(graphs1[0]); // Same object reference (cached)
      });

      it('should handle mixed vault:// and meta:// requests', async () => {
        const vaultUri = 'vault://test.md';
        const metaUri = 'meta://';
        const ontologyUri = 'meta://ontology';

        // Setup vault graph
        setupMockSuccessfulParsing(['test content']);
        (mockApp.vault.getAbstractFileByPath as any).mockReturnValue(new MockTFile('test.md'));
        (mockApp.vault.read as any).mockResolvedValue('test content');

        const graphs = await graphService.getGraphs([vaultUri, metaUri, ontologyUri]);

        expect(graphs).toHaveLength(3);
        expect(graphs[0].uri).toBe(vaultUri);
        expect(graphs[1].uri).toBe(metaUri);
        expect(graphs[2].uri).toBe(ontologyUri);
      });

      it('should invalidate meta:// graph cache', async () => {
        const graphUri = 'meta://';

        // Load and cache
        await graphService.getGraphs([graphUri]);

        // Invalidate
        graphService.invalidateGraph(graphUri);

        // Should reload on next request (can't easily test without internal access, but ensures no errors)
        const graphs = await graphService.getGraphs([graphUri]);
        expect(graphs).toHaveLength(1);
      });

      it('should resolve meta:// URI correctly', () => {
        const result = graphService.resolveVaultUri('meta://');
        expect(result).toEqual(['meta://']);
      });

      it('should resolve meta://ontology URI correctly', () => {
        const result = graphService.resolveVaultUri('meta://ontology');
        expect(result).toEqual(['meta://ontology']);
      });

      it('should handle meta:// graph alongside vault:// graphs in resolution', () => {
        // Mock some vault files
        const mockFiles = [new MockTFile('test.md')];
        (mockApp.vault.getMarkdownFiles as any).mockReturnValue(mockFiles);
        (mockApp.vault.getFiles as any).mockReturnValue(mockFiles);

        // Test that non-meta URIs still work
        const vaultResult = graphService.resolveVaultUri('vault://');
        expect(vaultResult).toContain('vault://test.md');

        // Test that meta URIs work
        const metaResult = graphService.resolveVaultUri('meta://');
        expect(metaResult).toEqual(['meta://']);
      });
    });

    describe('error scenarios', () => {
      it('should throw error when graph fails to load', async () => {
        const graphUri = 'vault://invalid.md';

        // Setup file not found
        (mockApp.vault.getAbstractFileByPath as any).mockReturnValue(null);

        await expect(graphService.getGraphs([graphUri])).rejects.toThrow(
          'Failed to load any graphs'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'File not found or is not a file: invalid.md'
        );
      });

      it('should throw error for invalid graph URI', async () => {
        const graphUri = 'invalid-uri';

        await expect(graphService.getGraphs([graphUri])).rejects.toThrow(
          'Failed to load any graphs'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Cannot extract file path from graph URI: invalid-uri'
        );
      });

      it('should throw error when parsing fails', async () => {
        const graphUri = 'vault://invalid-turtle.md';

        // Setup parsing failure
        mockMarkdownParser.parse.mockResolvedValue({
          success: false,
          errors: [{ error: 'Invalid turtle syntax' }],
          quads: [],
          prefixes: {},
          totalBlocks: 1,
          successfulBlocks: 0,
        });

        (mockApp.vault.getAbstractFileByPath as any).mockReturnValue(new MockTFile('invalid-turtle.md'));
        (mockApp.vault.read as any).mockResolvedValue('invalid turtle');

        await expect(graphService.getGraphs([graphUri])).rejects.toThrow(
          'Failed to load any graphs'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Failed to parse vault graph vault://invalid-turtle.md:',
          [{ error: 'Invalid turtle syntax' }]
        );
      });

      it('should throw error when file read fails', async () => {
        const graphUri = 'vault://unreadable.md';

        (mockApp.vault.getAbstractFileByPath as any).mockReturnValue(new MockTFile('unreadable.md'));
        (mockApp.vault.read as any).mockRejectedValue(new Error('Permission denied'));

        await expect(graphService.getGraphs([graphUri])).rejects.toThrow(
          'Failed to load any graphs'
        );

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error loading vault graph vault://unreadable.md:',
          expect.any(Error)
        );
      });

      it('should handle partial failures in multi-graph request', async () => {
        const validUri = 'vault://valid.md';
        const invalidUri = 'vault://invalid.md';

        // Setup one success, one failure
        setupMockSuccessfulParsing(['valid content']);
        (mockApp.vault.getAbstractFileByPath as any)
          .mockReturnValueOnce(new MockTFile('valid.md'))
          .mockReturnValueOnce(null); // File not found
        (mockApp.vault.read as any).mockResolvedValue('valid content');

        // Should succeed with partial results and log warnings
        const result = await graphService.getGraphs([validUri, invalidUri]);
        expect(result).toHaveLength(1);
        expect(result[0].uri).toBe(validUri);
      });
    });
  });

  // Helper functions
  function createMockGraph(uri: string, filePath: string): Graph {
    return {
      uri,
      filePath,
      store: new Store(),
      lastModified: new Date(),
      tripleCount: 0,
    };
  }

  function setupMockSuccessfulParsing(contents: string[], quads: any[] = []) {
    contents.forEach((content, index) => {
      mockMarkdownParser.parse.mockResolvedValueOnce({
        success: true,
        quads: index < quads.length ? [quads[index]] : [],
        prefixes: {},
        errors: [],
        totalBlocks: 1,
        successfulBlocks: 1,
      });
    });
  }
});