/**
 * Tests for VaultGraphService integration with global prefixes in turtle parsing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VaultGraphService } from '@/services/VaultGraphService';
import { PrefixService } from '@/services/PrefixService';
import { MarkdownGraphParser } from '@/services/MarkdownGraphParser';
import { Logger } from '@/utils/Logger';

// Mock dependencies
vi.mock('obsidian', () => ({
  TFile: class {},
}));

vi.mock('n3', () => ({
  Store: vi.fn().mockImplementation(() => ({
    addQuads: vi.fn(),
    size: 2, // Mock store with 2 quads
  })),
  Parser: vi.fn(),
}));

vi.mock('@/services/MarkdownGraphParser');

describe('VaultGraphService - Global Prefix Integration', () => {
  let vaultGraphService: VaultGraphService;
  let mockApp: any;
  let mockPrefixService: PrefixService;
  let mockLogger: Logger;
  let MockMarkdownGraphParser: any;

  beforeEach(() => {
    MockMarkdownGraphParser = vi.mocked(MarkdownGraphParser);
    MockMarkdownGraphParser.mockClear();

    mockApp = {
      vault: {
        getAbstractFileByPath: vi.fn(),
        read: vi.fn(),
      },
    };

    // Create a real PrefixService with test prefixes
    const globalPrefixes = {
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      foaf: 'http://xmlns.com/foaf/0.1/',
      shad: 'http://shadr.us/ontology/',
      custom: 'http://custom.example.org/',
    };
    mockPrefixService = new PrefixService(globalPrefixes);

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    vaultGraphService = new VaultGraphService(mockApp, mockPrefixService, mockLogger);
  });

  describe('loadGraph', () => {
    it('should pass global prefixes to MarkdownGraphParser for .md files', async () => {
      const mockFile = {
        path: 'test.md',
        extension: 'md',
        stat: { ctime: 0, mtime: 0, size: 0 },
      };

      const markdownContent = `
# Test File

\`\`\`turtle
@prefix ex: <http://example.org/> .
shad:TestEntity a ex:Entity ;
    foaf:name "Test" .
\`\`\`
      `;

      // Mock the parser instance
      const mockParserInstance = {
        parse: vi.fn().mockResolvedValue({
          success: true,
          quads: [],
          prefixes: {},
          errors: [],
          totalBlocks: 1,
          successfulBlocks: 1,
        }),
      };
      MockMarkdownGraphParser.mockImplementation(() => mockParserInstance);

      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue(markdownContent);

      await vaultGraphService.loadGraph('vault://test.md');

      // Verify MarkdownGraphParser was constructed with global prefixes
      expect(MockMarkdownGraphParser).toHaveBeenCalledWith({
        baseUri: 'vault://test.md/',
        prefixes: {
          rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
          rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
          foaf: 'http://xmlns.com/foaf/0.1/',
          shad: 'http://shadr.us/ontology/',
          custom: 'http://custom.example.org/',
        },
        logger: mockLogger,
      });

      // Verify parser was called
      expect(mockParserInstance.parse).toHaveBeenCalledWith(markdownContent);
    });

    it('should not use MarkdownGraphParser for .ttl files', async () => {
      const mockFile = {
        path: 'test.ttl',
        extension: 'ttl',
        stat: { ctime: 0, mtime: 0, size: 0 },
      };

      const turtleContent = `
@prefix ex: <http://example.org/> .
@prefix shad: <http://shadr.us/ontology/> .

shad:TestEntity a ex:Entity ;
    ex:name "Test" .
      `;

      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue(turtleContent);

      await vaultGraphService.loadGraph('vault://test.ttl');

      // MarkdownGraphParser should not be used for .ttl files
      expect(MockMarkdownGraphParser).not.toHaveBeenCalled();
    });

    it('should handle parsing failures gracefully', async () => {
      const mockFile = {
        path: 'test.md',
        extension: 'md',
        stat: { ctime: 0, mtime: 0, size: 0 },
      };

      const mockParserInstance = {
        parse: vi.fn().mockResolvedValue({
          success: false,
          quads: [],
          prefixes: {},
          errors: [
            {
              blockIndex: 0,
              startLine: 3,
              endLine: 6,
              content: 'invalid turtle',
              error: 'Unknown prefix: invalidPrefix',
            },
          ],
          totalBlocks: 1,
          successfulBlocks: 0,
        }),
      };
      MockMarkdownGraphParser.mockImplementation(() => mockParserInstance);

      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue('```turtle\ninvalidPrefix:test a ex:Entity .\n```');

      const result = await vaultGraphService.loadGraph('vault://test.md');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse vault graph'),
        expect.any(Array)
      );
    });

    it('should return graph with correct metadata when parsing succeeds', async () => {
      const mockFile = {
        path: 'test.md',
        extension: 'md',
        stat: { ctime: 0, mtime: 0, size: 0 },
      };

      // Mock N3 Quad objects (they need to be realistic enough for Store.addQuads)
      const mockQuads = [
        { subject: { value: 'http://shadr.us/ontology/Test' }, predicate: { value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' }, object: { value: 'http://example.org/Entity' } },
        { subject: { value: 'http://shadr.us/ontology/Test' }, predicate: { value: 'http://xmlns.com/foaf/0.1/name' }, object: { value: 'Test Entity' } },
      ];

      const mockParserInstance = {
        parse: vi.fn().mockResolvedValue({
          success: true,
          quads: mockQuads,
          prefixes: {
            shad: 'http://shadr.us/ontology/',
            ex: 'http://example.org/',
          },
          errors: [],
          totalBlocks: 1,
          successfulBlocks: 1,
        }),
      };
      MockMarkdownGraphParser.mockImplementation(() => mockParserInstance);

      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockResolvedValue('```turtle\nshad:Test a ex:Entity .\n```');

      const result = await vaultGraphService.loadGraph('vault://test.md');

      expect(result).not.toBeNull();
      expect(result?.uri).toBe('vault://test.md');
      expect(result?.filePath).toBe('test.md');
      expect(result?.tripleCount).toBe(2);
      expect(result?.lastModified).toBeInstanceOf(Date);
      expect(result?.store).toBeDefined();
    });
  });

  describe('prefix context validation', () => {
    it('should provide all necessary prefixes for common turtle patterns', () => {
      const globalPrefixes = mockPrefixService.getGlobalPrefixes();

      // Common RDF prefixes should be available
      expect(globalPrefixes.rdf).toBeDefined();
      expect(globalPrefixes.rdfs).toBeDefined();
      expect(globalPrefixes.foaf).toBeDefined();

      // User-defined prefixes should be available
      expect(globalPrefixes.shad).toBe('http://shadr.us/ontology/');
      expect(globalPrefixes.custom).toBe('http://custom.example.org/');
    });

    it('should allow prefix expansion for user-defined prefixes', () => {
      const globalPrefixes = mockPrefixService.getGlobalPrefixes();
      const context = mockPrefixService.createPrefixContext();

      // Test user-defined prefix expansion
      const result = mockPrefixService.expandCurie('shad:TestEntity', context);
      expect(result.success).toBe(true);
      expect(result.resolvedUri).toBe('http://shadr.us/ontology/TestEntity');

      // Test common prefix expansion still works
      const foafResult = mockPrefixService.expandCurie('foaf:Person', context);
      expect(foafResult.success).toBe(true);
      expect(foafResult.resolvedUri).toBe('http://xmlns.com/foaf/0.1/Person');
    });
  });

  describe('error handling', () => {
    it('should handle file read errors', async () => {
      const mockFile = {
        path: 'test.md',
        extension: 'md',
        stat: { ctime: 0, mtime: 0, size: 0 },
      };

      mockApp.vault.getAbstractFileByPath.mockReturnValue(mockFile);
      mockApp.vault.read.mockRejectedValue(new Error('File read error'));

      const result = await vaultGraphService.loadGraph('vault://test.md');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error loading vault graph'),
        expect.any(Error)
      );
    });

    it('should handle missing file', async () => {
      mockApp.vault.getAbstractFileByPath.mockReturnValue(null);

      const result = await vaultGraphService.loadGraph('vault://nonexistent.md');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('File not found or is not a file')
      );
    });
  });
});