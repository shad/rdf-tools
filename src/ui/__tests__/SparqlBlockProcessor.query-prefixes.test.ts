import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SparqlBlockProcessor } from '../SparqlBlockProcessor';
import type { App, Plugin } from 'obsidian';
import type { PrefixService } from '@/services/PrefixService';

// Mock Obsidian Component class
vi.mock('obsidian', async () => {
  const actual = await vi.importActual('obsidian');
  return {
    ...actual,
    Component: class Component {
      onload() {}
      onunload() {}
    },
  };
});

// Mock Obsidian components
const mockApp = {} as App;
const mockPlugin = {} as Plugin;

// Mock RDF service with PrefixService
const mockPrefixService = {
  createPrefixContext: vi.fn(),
  createCurie: vi.fn(),
} as unknown as PrefixService;

const mockRdfService = {
  getPrefixService: vi.fn(() => mockPrefixService),
};

describe('SparqlBlockProcessor - Query Prefixes', () => {
  let processor: SparqlBlockProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new SparqlBlockProcessor(mockApp, mockPlugin, mockRdfService);
  });

  describe('formatRdfTerm with query prefixes', () => {
    it('should use query prefixes when creating prefix context for URIs', () => {
      const queryPrefixes = {
        '': 'vault://hellboy-universe.md/',
        foaf: 'http://xmlns.com/foaf/0.1/',
      };

      // Mock the prefix service to return a successful CURIE
      (mockPrefixService.createPrefixContext as any).mockReturnValue({
        globalPrefixes: {},
        localPrefixes: {},
        queryPrefixes,
      });
      (mockPrefixService.createCurie as any).mockReturnValue(':person');

      const term = {
        type: 'uri',
        value: 'vault://hellboy-universe.md/person',
      };

      const result = processor['formatRdfTerm'](term, queryPrefixes);

      // Verify prefix context was created with query prefixes
      expect(mockPrefixService.createPrefixContext).toHaveBeenCalledWith(
        {}, // localPrefixes
        queryPrefixes // queryPrefixes
      );

      // Verify CURIE creation was attempted
      expect(mockPrefixService.createCurie).toHaveBeenCalledWith(
        'vault://hellboy-universe.md/person',
        expect.any(Object)
      );

      // Verify result uses CURIE format
      expect(result.text).toBe(':person');
      expect(result.cssClass).toBe('rdf-curie');
      expect(result.title).toBe('<vault://hellboy-universe.md/person>');
    });

    it('should use query prefixes for datatype CURIEs in literals', () => {
      const queryPrefixes = {
        xsd: 'http://www.w3.org/2001/XMLSchema#',
        custom: 'http://example.org/datatypes#',
      };

      // Mock the prefix service to return a successful CURIE for datatype
      (mockPrefixService.createPrefixContext as any).mockReturnValue({
        globalPrefixes: {},
        localPrefixes: {},
        queryPrefixes,
      });
      (mockPrefixService.createCurie as any).mockReturnValue('custom:special');

      const term = {
        type: 'literal',
        value: '42',
        datatype: 'http://example.org/datatypes#special',
      };

      const result = processor['formatRdfTerm'](term, queryPrefixes);

      // Verify prefix context was created with query prefixes for datatype CURIE
      expect(mockPrefixService.createPrefixContext).toHaveBeenCalledWith(
        {}, // localPrefixes
        queryPrefixes // queryPrefixes
      );

      // The literal formatting utility should have been called with the createCurie function
      // which uses the query prefixes
      expect(result.text).toBe('42'); // Display value should be clean
      expect(result.title).toBe('"42"^^custom:special'); // Full notation in tooltip should use CURIE
    });

    it('should handle case when no query prefixes are provided', () => {
      // Mock the prefix service to work with empty query prefixes
      (mockPrefixService.createPrefixContext as any).mockReturnValue({
        globalPrefixes: { foaf: 'http://xmlns.com/foaf/0.1/' },
        localPrefixes: {},
        queryPrefixes: {},
      });
      (mockPrefixService.createCurie as any).mockReturnValue('foaf:name');

      const term = {
        type: 'uri',
        value: 'http://xmlns.com/foaf/0.1/name',
      };

      const result = processor['formatRdfTerm'](term); // No query prefixes

      // Verify prefix context was created with empty query prefixes
      expect(mockPrefixService.createPrefixContext).toHaveBeenCalledWith(
        {}, // localPrefixes
        {} // empty queryPrefixes
      );

      // Should still work with global prefixes
      expect(result.text).toBe('foaf:name');
      expect(result.cssClass).toBe('rdf-curie');
    });

    it('should fall back to full URI when CURIE creation fails', () => {
      const queryPrefixes = {
        '': 'vault://hellboy-universe.md/',
      };

      // Mock the prefix service to fail CURIE creation
      (mockPrefixService.createPrefixContext as any).mockReturnValue({
        globalPrefixes: {},
        localPrefixes: {},
        queryPrefixes,
      });
      (mockPrefixService.createCurie as any).mockReturnValue(null); // Failed

      const term = {
        type: 'uri',
        value: 'http://example.org/unknown',
      };

      const result = processor['formatRdfTerm'](term, queryPrefixes);

      // Should fall back to full URI display
      expect(result.text).toBe('<http://example.org/unknown>');
      expect(result.cssClass).toBe('rdf-uri');
      expect(result.title).toBeUndefined();
    });
  });
});