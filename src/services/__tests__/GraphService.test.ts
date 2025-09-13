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
import type { MarkdownGraphParser, MarkdownParseResult } from '@/services/MarkdownGraphParser';

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

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock Obsidian App
    mockApp = {
      vault: {
        getAbstractFileByPath: vi.fn(),
        read: vi.fn(),
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

    graphService = new GraphService(mockApp, mockPrefixService);
  });

  afterEach(() => {
    consoleSpy.error.mockClear();
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
      const result = graphService.resolveVaultUri('vault://');
      expect(result).toHaveLength(4);
      expect(result).toContain('vault://dir1/file1.md');
      expect(result).toContain('vault://dir1/file2.md');
      expect(result).toContain('vault://dir2/file3.md');
      expect(result).toContain('vault://root.md');
    });

    it('should return directory-filtered graphs for directory URIs', () => {
      const result = graphService.resolveVaultUri('vault://dir1/');
      expect(result).toHaveLength(2);
      expect(result).toContain('vault://dir1/file1.md');
      expect(result).toContain('vault://dir1/file2.md');
    });

    it('should return specific graph for file URIs', () => {
      const result = graphService.resolveVaultUri('vault://dir1/file1.md');
      expect(result).toEqual(['vault://dir1/file1.md']);
    });

    it('should return empty array for root URI with empty cache', () => {
      // Create new service with empty cache
      const emptyService = new GraphService(mockApp, mockPrefixService);
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

      await graphService.getGraphs([graphUri]);

      // Verify it's cached
      let allGraphs = graphService.resolveVaultUri('vault://');
      expect(allGraphs).toContain(graphUri);

      // Invalidate and verify it's removed
      graphService.invalidateGraph(graphUri);
      allGraphs = graphService.resolveVaultUri('vault://');
      expect(allGraphs).not.toContain(graphUri);
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

      await graphService.getGraphs([graphUri1, graphUri2]);

      // Invalidate one
      graphService.invalidateGraph(graphUri1);

      // Verify only the invalidated one is removed
      const allGraphs = graphService.resolveVaultUri('vault://');
      expect(allGraphs).not.toContain(graphUri1);
      expect(allGraphs).toContain(graphUri2);
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

    describe('error scenarios', () => {
      it('should throw error when graph fails to load', async () => {
        const graphUri = 'vault://invalid.md';

        // Setup file not found
        (mockApp.vault.getAbstractFileByPath as any).mockReturnValue(null);

        await expect(graphService.getGraphs([graphUri])).rejects.toThrow(
          'Failed to load graph: vault://invalid.md'
        );

        expect(consoleSpy.error).toHaveBeenCalledWith(
          'File not found: invalid.md'
        );
      });

      it('should throw error for invalid graph URI', async () => {
        const graphUri = 'invalid-uri';

        await expect(graphService.getGraphs([graphUri])).rejects.toThrow(
          'Failed to load graph: invalid-uri'
        );

        expect(consoleSpy.error).toHaveBeenCalledWith(
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
          'Failed to load graph: vault://invalid-turtle.md'
        );

        expect(consoleSpy.error).toHaveBeenCalledWith(
          'Failed to parse graph vault://invalid-turtle.md:',
          [{ error: 'Invalid turtle syntax' }]
        );
      });

      it('should throw error when file read fails', async () => {
        const graphUri = 'vault://unreadable.md';

        (mockApp.vault.getAbstractFileByPath as any).mockReturnValue(new MockTFile('unreadable.md'));
        (mockApp.vault.read as any).mockRejectedValue(new Error('Permission denied'));

        await expect(graphService.getGraphs([graphUri])).rejects.toThrow(
          'Failed to load graph: vault://unreadable.md'
        );

        expect(consoleSpy.error).toHaveBeenCalledWith(
          'Error loading graph vault://unreadable.md:',
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

        await expect(graphService.getGraphs([validUri, invalidUri])).rejects.toThrow(
          'Failed to load graph: vault://invalid.md'
        );
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