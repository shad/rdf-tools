/**
 * Tests for PrefixManager utility
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PrefixManager } from '@/utils/prefixManager';
import { createMockPrefixContext, createCommonPrefixes } from '@tests/helpers/test-utils';

describe('PrefixManager', () => {
  let prefixManager: PrefixManager;
  let commonPrefixes: Record<string, string>;

  beforeEach(() => {
    commonPrefixes = createCommonPrefixes();
    prefixManager = new PrefixManager(commonPrefixes);
  });

  describe('constructor', () => {
    it('should initialize with global prefixes', () => {
      const globalPrefixes = prefixManager.getGlobalPrefixes();
      
      expect(globalPrefixes).toEqual(commonPrefixes);
    });

    it('should initialize with empty prefixes when none provided', () => {
      const emptyManager = new PrefixManager();
      const globalPrefixes = emptyManager.getGlobalPrefixes();
      
      expect(globalPrefixes).toEqual({});
    });
  });

  describe('updateGlobalPrefixes', () => {
    it('should replace global prefixes', () => {
      const newPrefixes = {
        test: 'http://test.org/',
        example: 'http://example.com/',
      };

      prefixManager.updateGlobalPrefixes(newPrefixes);
      const globalPrefixes = prefixManager.getGlobalPrefixes();

      expect(globalPrefixes).toEqual(newPrefixes);
      expect(globalPrefixes).not.toContain('rdf');
    });
  });

  describe('createPrefixContext', () => {
    it('should create context with all prefix types', () => {
      const localPrefixes = { local: 'http://local.org/' };
      const queryPrefixes = { query: 'http://query.org/' };

      const context = prefixManager.createPrefixContext(localPrefixes, queryPrefixes);

      expect(context.globalPrefixes).toEqual(commonPrefixes);
      expect(context.localPrefixes).toEqual(localPrefixes);
      expect(context.queryPrefixes).toEqual(queryPrefixes);
    });

    it('should handle empty local and query prefixes', () => {
      const context = prefixManager.createPrefixContext();

      expect(context.globalPrefixes).toEqual(commonPrefixes);
      expect(context.localPrefixes).toEqual({});
      expect(context.queryPrefixes).toEqual({});
    });
  });

  describe('getMergedPrefixes', () => {
    it('should merge prefixes with correct precedence (query > local > global)', () => {
      const context = createMockPrefixContext(
        { global: 'http://global.org/', shared: 'http://global-shared.org/' },
        { local: 'http://local.org/', shared: 'http://local-shared.org/' },
        { query: 'http://query.org/', shared: 'http://query-shared.org/' }
      );

      const merged = prefixManager.getMergedPrefixes(context);

      expect(merged.global).toBe('http://global.org/');
      expect(merged.local).toBe('http://local.org/');
      expect(merged.query).toBe('http://query.org/');
      expect(merged.shared).toBe('http://query-shared.org/'); // Query has highest precedence
    });
  });

  describe('expandCurie', () => {
    it('should expand valid CURIE', () => {
      const context = createMockPrefixContext();
      const result = prefixManager.expandCurie('foaf:Person', context);

      expect(result.success).toBe(true);
      expect(result.resolvedUri).toBe('http://xmlns.com/foaf/0.1/Person');
      expect(result.usedPrefix).toBe('foaf');
    });

    it('should return error for unknown prefix', () => {
      const context = createMockPrefixContext();
      const result = prefixManager.expandCurie('unknown:term', context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown prefix: unknown');
    });

    it('should return error for invalid CURIE format', () => {
      const context = createMockPrefixContext();
      const result = prefixManager.expandCurie('invalid-curie', context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not a valid CURIE format');
    });

    it('should handle already expanded URIs', () => {
      const context = createMockPrefixContext();
      const uri = 'http://example.org/resource';
      const result = prefixManager.expandCurie(uri, context);

      expect(result.success).toBe(true);
      expect(result.resolvedUri).toBe(uri);
      expect(result.usedPrefix).toBeUndefined();
    });

    it('should handle empty prefix (default namespace)', () => {
      const context = createMockPrefixContext(
        { '': 'http://default.org/' }
      );
      const result = prefixManager.expandCurie(':term', context);

      expect(result.success).toBe(true);
      expect(result.resolvedUri).toBe('http://default.org/term');
    });

    it('should respect prefix precedence', () => {
      const context = createMockPrefixContext(
        { test: 'http://global.org/' },
        { test: 'http://local.org/' },
        { test: 'http://query.org/' }
      );
      const result = prefixManager.expandCurie('test:resource', context);

      expect(result.success).toBe(true);
      expect(result.resolvedUri).toBe('http://query.org/resource'); // Query prefix wins
    });
  });

  describe('createCurie', () => {
    it('should create CURIE from full URI', () => {
      const context = createMockPrefixContext();
      const curie = prefixManager.createCurie('http://xmlns.com/foaf/0.1/Person', context);

      expect(curie).toBe('foaf:Person');
    });

    it('should return null for URI without matching prefix', () => {
      const context = createMockPrefixContext();
      const curie = prefixManager.createCurie('http://unknown.org/resource', context);

      expect(curie).toBeNull();
    });

    it('should choose longest matching namespace', () => {
      const context = createMockPrefixContext(
        {
          short: 'http://example.org/',
          long: 'http://example.org/specific/',
        }
      );
      const curie = prefixManager.createCurie('http://example.org/specific/resource', context);

      expect(curie).toBe('long:resource'); // Longer namespace should win
    });

    it('should validate local name format', () => {
      const context = createMockPrefixContext({
        test: 'http://test.org/',
      });
      
      // Valid local name
      const validCurie = prefixManager.createCurie('http://test.org/validName', context);
      expect(validCurie).toBe('test:validName');

      // Invalid local name (contains spaces)
      const invalidCurie = prefixManager.createCurie('http://test.org/invalid name', context);
      expect(invalidCurie).toBeNull();
    });
  });

  describe('extractPrefixesFromTurtle', () => {
    it('should extract prefix declarations', () => {
      const turtle = `
        @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
        @prefix foaf: <http://xmlns.com/foaf/0.1/> .
        @prefix ex: <http://example.org/> .
      `;

      const prefixes = prefixManager.extractPrefixesFromTurtle(turtle);

      expect(prefixes).toEqual({
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        foaf: 'http://xmlns.com/foaf/0.1/',
        ex: 'http://example.org/',
      });
    });

    it('should handle default prefix', () => {
      const turtle = '@prefix : <http://default.org/> .';
      const prefixes = prefixManager.extractPrefixesFromTurtle(turtle);

      expect(prefixes['']).toBe('http://default.org/');
    });

    it('should ignore non-prefix content', () => {
      const turtle = `
        # This is a comment
        @prefix ex: <http://example.org/> .
        ex:alice a foaf:Person .
      `;

      const prefixes = prefixManager.extractPrefixesFromTurtle(turtle);

      expect(Object.keys(prefixes)).toHaveLength(1);
      expect(prefixes.ex).toBe('http://example.org/');
    });

    it('should handle empty content', () => {
      const prefixes = prefixManager.extractPrefixesFromTurtle('');
      expect(prefixes).toEqual({});
    });
  });

  describe('generatePrefixDeclarations', () => {
    it('should generate turtle prefix declarations', () => {
      const prefixes = {
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        foaf: 'http://xmlns.com/foaf/0.1/',
      };

      const declarations = prefixManager.generatePrefixDeclarations(prefixes);

      expect(declarations).toContain('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .');
      expect(declarations).toContain('@prefix foaf: <http://xmlns.com/foaf/0.1/> .');
    });

    it('should handle default prefix', () => {
      const prefixes = { '': 'http://default.org/' };
      const declarations = prefixManager.generatePrefixDeclarations(prefixes);

      expect(declarations).toBe('@prefix : <http://default.org/> .');
    });

    it('should handle empty prefixes', () => {
      const declarations = prefixManager.generatePrefixDeclarations({});
      expect(declarations).toBe('');
    });
  });

  describe('resolveConflicts', () => {
    it('should detect and resolve prefix conflicts', () => {
      const existing = { shared: 'http://existing.org/', unique1: 'http://unique1.org/' };
      const incoming = { shared: 'http://incoming.org/', unique2: 'http://unique2.org/' };

      const result = prefixManager.resolveConflicts(existing, incoming);

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]).toEqual({
        prefix: 'shared',
        existing: 'http://existing.org/',
        incoming: 'http://incoming.org/',
      });

      expect(result.merged.shared).toBe('http://incoming.org/'); // Incoming wins
      expect(result.merged.unique1).toBe('http://unique1.org/');
      expect(result.merged.unique2).toBe('http://unique2.org/');
    });

    it('should handle no conflicts', () => {
      const existing = { ex1: 'http://example1.org/' };
      const incoming = { ex2: 'http://example2.org/' };

      const result = prefixManager.resolveConflicts(existing, incoming);

      expect(result.conflicts).toHaveLength(0);
      expect(result.merged).toEqual({
        ex1: 'http://example1.org/',
        ex2: 'http://example2.org/',
      });
    });
  });

  describe('static methods', () => {
    describe('getCommonPrefixes', () => {
      it('should return common RDF prefixes', () => {
        const common = PrefixManager.getCommonPrefixes();

        expect(common.rdf).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
        expect(common.rdfs).toBe('http://www.w3.org/2000/01/rdf-schema#');
        expect(common.owl).toBe('http://www.w3.org/2002/07/owl#');
        expect(common.foaf).toBe('http://xmlns.com/foaf/0.1/');
        expect(common.schema).toBe('http://schema.org/');
      });
    });
  });

  describe('utility methods', () => {
    describe('getPrefixPrecedence', () => {
      it('should return correct precedence values', () => {
        const context = createMockPrefixContext(
          { global: 'http://global.org/' },
          { local: 'http://local.org/' },
          { query: 'http://query.org/' }
        );

        expect(prefixManager.getPrefixPrecedence('global', context)).toBe(1);
        expect(prefixManager.getPrefixPrecedence('local', context)).toBe(2);
        expect(prefixManager.getPrefixPrecedence('query', context)).toBe(3);
        expect(prefixManager.getPrefixPrecedence('unknown', context)).toBe(0);
      });
    });

    describe('findPrefixesForNamespace', () => {
      it('should find all prefixes for a namespace', () => {
        const context = createMockPrefixContext(
          { prefix1: 'http://example.org/', prefix2: 'http://example.org/' },
          { prefix3: 'http://example.org/' }
        );

        const matches = prefixManager.findPrefixesForNamespace('http://example.org/', context);

        expect(matches).toHaveLength(3);
        expect(matches).toContain('prefix1');
        expect(matches).toContain('prefix2');
        expect(matches).toContain('prefix3');
      });
    });

    describe('validatePrefixDeclaration', () => {
      it('should validate valid prefix declarations', () => {
        expect(prefixManager.validatePrefixDeclaration('valid', 'http://example.org/')).toBe(true);
        expect(prefixManager.validatePrefixDeclaration('', 'http://default.org/')).toBe(true); // Default prefix
        expect(prefixManager.validatePrefixDeclaration('prefix_123', 'https://secure.org/')).toBe(true);
      });

      it('should reject invalid prefix names', () => {
        expect(prefixManager.validatePrefixDeclaration('123invalid', 'http://example.org/')).toBe(false);
        expect(prefixManager.validatePrefixDeclaration('invalid-name', 'http://example.org/')).toBe(false);
      });

      it('should reject invalid namespace URIs', () => {
        expect(prefixManager.validatePrefixDeclaration('valid', 'not-a-uri')).toBe(false);
        expect(prefixManager.validatePrefixDeclaration('valid', '')).toBe(false);
      });
    });

    describe('getSuggestionsForPrefix', () => {
      it('should suggest similar prefixes', () => {
        const context = createMockPrefixContext({
          foaf: 'http://xmlns.com/foaf/0.1/',
          food: 'http://example.org/food/',
          foo: 'http://example.org/foo/',
        });

        const suggestions = prefixManager.getSuggestionsForPrefix('foa', context);

        expect(suggestions).toContain('foaf');
        expect(suggestions).toContain('foo');
        // 'food' might be included depending on Levenshtein distance threshold
      });

      it('should limit suggestions', () => {
        const manyPrefixes: Record<string, string> = {};
        for (let i = 0; i < 10; i++) {
          manyPrefixes[`test${i}`] = `http://test${i}.org/`;
        }

        const context = createMockPrefixContext(manyPrefixes);
        const suggestions = prefixManager.getSuggestionsForPrefix('test', context);

        expect(suggestions.length).toBeLessThanOrEqual(5);
      });
    });
  });
});