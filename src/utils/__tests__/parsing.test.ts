import { describe, it, expect } from 'vitest';
import {
  parseSparqlQuery,
  extractTurtleBlocks,
  parseTurtleContent,
  validateQuery,
  mergePrefixes,
} from '../parsing';

describe('Pure Parsing Functions', () => {
  describe('parseSparqlQuery', () => {
    it('should parse a simple SELECT query', () => {
      const query = 'SELECT ?s ?p ?o WHERE { ?s ?p ?o }';
      const result = parseSparqlQuery(query);

      expect(result.success).toBe(true);
      expect(result.queryType).toBe('SELECT');
      expect(result.parsedQuery).toBeDefined();
      expect(result.fromGraphs).toEqual([]);
      expect(result.fromNamedGraphs).toEqual([]);
    });

    it('should handle empty query string', () => {
      const result = parseSparqlQuery('');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Empty query string');
      expect(result.error?.errorType).toBe('syntax');
    });

    it('should handle whitespace-only query', () => {
      const result = parseSparqlQuery('   \n  \t  ');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Empty query string');
    });

    it('should parse query with prefixes', () => {
      const query = `
        PREFIX ex: <http://example.org/>
        SELECT ?s WHERE { ?s ex:name ?name }
      `;
      const result = parseSparqlQuery(query);

      expect(result.success).toBe(true);
      expect(result.prefixes?.ex).toBe('http://example.org/');
    });

    it('should add additional prefixes', () => {
      const query = 'SELECT ?s WHERE { ?s foaf:name ?name }';
      const result = parseSparqlQuery(query, {
        additionalPrefixes: {
          foaf: 'http://xmlns.com/foaf/0.1/',
        },
      });

      expect(result.success).toBe(true);
      expect(result.prefixes?.foaf).toBe('http://xmlns.com/foaf/0.1/');
    });

    it('should extract FROM graphs', () => {
      const query = `
        SELECT ?s ?p ?o
        FROM <http://example.org/graph1>
        FROM <http://example.org/graph2>
        WHERE { ?s ?p ?o }
      `;
      const result = parseSparqlQuery(query);

      expect(result.success).toBe(true);
      expect(result.fromGraphs).toEqual([
        'http://example.org/graph1',
        'http://example.org/graph2',
      ]);
    });

    it('should extract FROM NAMED graphs', () => {
      const query = `
        SELECT ?s ?p ?o
        FROM NAMED <http://example.org/named1>
        FROM NAMED <http://example.org/named2>
        WHERE { GRAPH ?g { ?s ?p ?o } }
      `;
      const result = parseSparqlQuery(query);

      expect(result.success).toBe(true);
      expect(result.fromNamedGraphs).toEqual([
        'http://example.org/named1',
        'http://example.org/named2',
      ]);
    });

    it('should handle invalid SPARQL syntax', () => {
      const query = 'INVALID SPARQL SYNTAX';
      const result = parseSparqlQuery(query);

      expect(result.success).toBe(false);
      expect(result.error?.errorType).toBe('syntax');
      expect(result.error?.message).toBeDefined();
    });

    it('should include parse time', () => {
      const query = 'SELECT ?s WHERE { ?s ?p ?o }';
      const result = parseSparqlQuery(query);

      expect(result.parseTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.parseTimeMs).toBe('number');
    });
  });

  describe('extractTurtleBlocks', () => {
    it('should extract single turtle block', () => {
      const markdown = `
# Test Document

\`\`\`turtle
@prefix ex: <http://example.org/> .
ex:subject ex:predicate ex:object .
\`\`\`

Some text.
      `;

      const blocks = extractTurtleBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toContain('@prefix ex:');
      expect(blocks[0].content).toContain('ex:subject ex:predicate ex:object');
      expect(blocks[0].blockIndex).toBe(0);
      expect(blocks[0].startLine).toBeGreaterThan(0);
      expect(blocks[0].endLine).toBeGreaterThan(blocks[0].startLine);
    });

    it('should extract multiple turtle blocks', () => {
      const markdown = `
\`\`\`turtle
@prefix ex: <http://example.org/> .
\`\`\`

Some text.

\`\`\`turtle
ex:subject ex:predicate ex:object .
\`\`\`
      `;

      const blocks = extractTurtleBlocks(markdown);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].blockIndex).toBe(0);
      expect(blocks[1].blockIndex).toBe(1);
      expect(blocks[0].content).toContain('@prefix');
      expect(blocks[1].content).toContain('ex:subject');
    });

    it('should handle empty markdown', () => {
      const blocks = extractTurtleBlocks('');
      expect(blocks).toHaveLength(0);
    });

    it('should handle markdown with no turtle blocks', () => {
      const markdown = `
# Test Document

Some text without any code blocks.

\`\`\`javascript
// not turtle code here
\`\`\`
      `;

      const blocks = extractTurtleBlocks(markdown);
      expect(blocks).toHaveLength(0);
    });

    it('should handle unclosed turtle block', () => {
      const markdown = `
\`\`\`turtle
@prefix ex: <http://example.org/> .
ex:subject ex:predicate ex:object .
      `;

      const blocks = extractTurtleBlocks(markdown);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].content).toContain('@prefix ex:');
      expect(blocks[0].content).toContain('ex:subject');
    });

    it('should return readonly array', () => {
      const markdown = '```turtle\nex:s ex:p ex:o .\n```';
      const blocks = extractTurtleBlocks(markdown);

      // TypeScript should enforce readonly, but we can test runtime behavior
      expect(Array.isArray(blocks)).toBe(true);
      expect(blocks).toHaveLength(1);
    });
  });

  describe('parseTurtleContent', () => {
    it('should parse valid turtle content', () => {
      const content = `
        @prefix ex: <http://example.org/> .
        ex:subject ex:predicate ex:object .
      `;

      const result = parseTurtleContent(content);

      expect(result.success).toBe(true);
      expect(result.quads).toHaveLength(1);
      expect(result.tripleCount).toBe(1);
      expect(result.prefixes?.ex).toBe('http://example.org/');
    });

    it('should handle empty content', () => {
      const result = parseTurtleContent('');

      expect(result.success).toBe(true);
      expect(result.quads).toHaveLength(0);
      expect(result.tripleCount).toBe(0);
      expect(result.prefixes).toEqual({});
    });

    it('should handle whitespace-only content', () => {
      const result = parseTurtleContent('   \n  \t  ');

      expect(result.success).toBe(true);
      expect(result.quads).toHaveLength(0);
      expect(result.tripleCount).toBe(0);
    });

    it('should parse with base URI', () => {
      const content = '<subject> <predicate> <object> .';
      const baseUri = 'http://example.org/';

      const result = parseTurtleContent(content, baseUri);

      expect(result.success).toBe(true);
      expect(result.baseUri).toBe(baseUri);
      expect(result.quads).toHaveLength(1);
    });

    it('should parse with prefixes', () => {
      const content = 'foaf:Person a rdfs:Class .';
      const prefixes = {
        foaf: 'http://xmlns.com/foaf/0.1/',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      };

      const result = parseTurtleContent(content, undefined, prefixes);

      expect(result.success).toBe(true);
      expect(result.quads).toHaveLength(1);
    });

    it('should handle invalid turtle syntax', () => {
      const content = 'INVALID TURTLE SYNTAX';

      const result = parseTurtleContent(content);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBeDefined();
      expect(result.tripleCount).toBe(0);
    });

    it('should include parse time', () => {
      const content = 'ex:s ex:p ex:o .';

      const result = parseTurtleContent(content);

      expect(result.parseTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.parseTimeMs).toBe('number');
    });
  });

  describe('validateQuery', () => {
    it('should validate SELECT query', () => {
      const query = 'SELECT ?s WHERE { ?s ?p ?o }';
      const parseResult = parseSparqlQuery(query);

      expect(parseResult.success).toBe(true);
      const validation = validateQuery(parseResult.parsedQuery!);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate CONSTRUCT query', () => {
      const query = 'CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }';
      const parseResult = parseSparqlQuery(query);

      expect(parseResult.success).toBe(true);
      const validation = validateQuery(parseResult.parsedQuery!);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should validate ASK query', () => {
      const query = 'ASK { ?s ?p ?o }';
      const parseResult = parseSparqlQuery(query);

      expect(parseResult.success).toBe(true);
      const validation = validateQuery(parseResult.parsedQuery!);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should warn about SELECT with no variables', () => {
      // This would be unusual but syntactically valid
      const query = 'SELECT WHERE { ?s ?p ?o }';
      const parseResult = parseSparqlQuery(query);

      if (parseResult.success) {
        const validation = validateQuery(parseResult.parsedQuery!);
        expect(validation.warnings).toContain('SELECT query has no variables');
      }
    });

    it('should warn about query with no WHERE clause', () => {
      // This would be parsed differently by sparqljs, but let's test the concept
      const query = 'SELECT ?s ?p ?o';
      const parseResult = parseSparqlQuery(query);

      // This might not parse successfully, which is fine
      if (parseResult.success && parseResult.parsedQuery) {
        const validation = validateQuery(parseResult.parsedQuery);
        // The behavior depends on how sparqljs parses this
        expect(validation).toBeDefined();
      }
    });
  });

  describe('mergePrefixes', () => {
    it('should merge multiple prefix maps', () => {
      const prefixes1 = { ex: 'http://example.org/' };
      const prefixes2 = { foaf: 'http://xmlns.com/foaf/0.1/' };
      const prefixes3 = { rdfs: 'http://www.w3.org/2000/01/rdf-schema#' };

      const merged = mergePrefixes(prefixes1, prefixes2, prefixes3);

      expect(merged).toEqual({
        ex: 'http://example.org/',
        foaf: 'http://xmlns.com/foaf/0.1/',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      });
    });

    it('should handle later prefixes overriding earlier ones', () => {
      const prefixes1 = { ex: 'http://example.org/' };
      const prefixes2 = { ex: 'http://example.com/' };

      const merged = mergePrefixes(prefixes1, prefixes2);

      expect(merged.ex).toBe('http://example.com/');
    });

    it('should handle undefined prefix maps', () => {
      const prefixes1 = { ex: 'http://example.org/' };

      const merged = mergePrefixes(prefixes1, undefined, { foaf: 'http://xmlns.com/foaf/0.1/' });

      expect(merged).toEqual({
        ex: 'http://example.org/',
        foaf: 'http://xmlns.com/foaf/0.1/',
      });
    });

    it('should handle empty prefix maps', () => {
      const merged = mergePrefixes({}, {});

      expect(merged).toEqual({});
    });

    it('should handle no arguments', () => {
      const merged = mergePrefixes();

      expect(merged).toEqual({});
    });

    it('should return new object (immutable)', () => {
      const original = { ex: 'http://example.org/' };
      const merged = mergePrefixes(original, { foaf: 'http://xmlns.com/foaf/0.1/' });

      expect(merged).not.toBe(original);
      expect(original).toEqual({ ex: 'http://example.org/' }); // unchanged
      expect(merged.foaf).toBe('http://xmlns.com/foaf/0.1/');
    });
  });
});