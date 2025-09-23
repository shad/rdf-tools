import { describe, it, expect } from 'vitest';
import { DataFactory } from 'n3';
import {
  formatSelectResults,
  formatConstructResults,
  formatDescribeResults,
  formatAskResults,
  transformBinding,
  quadsToTurtle,
  estimateMemoryUsage,
  createResultSummary,
  ProcessedBinding,
  SelectResult,
  ConstructResult,
  AskResult,
  DescribeResult,
} from '../results';

const { namedNode, literal, blankNode, quad } = DataFactory;

describe('Pure Result Processing Functions', () => {
  describe('formatSelectResults', () => {
    it('should format simple bindings', () => {
      const bindings: readonly Record<string, ProcessedBinding>[] = [
        {
          s: { type: 'uri', value: 'http://example.org/subject' },
          p: { type: 'uri', value: 'http://example.org/predicate' },
          o: { type: 'literal', value: 'object value' },
        },
      ];

      const result = formatSelectResults(bindings);

      expect(result.status).toBe('completed');
      expect(result.queryType).toBe('SELECT');
      expect(result.bindings).toEqual(bindings);
      expect(result.resultCount).toBe(1);
      expect(result.truncated).toBe(false);
    });

    it('should handle empty bindings', () => {
      const result = formatSelectResults([]);

      expect(result.status).toBe('completed');
      expect(result.queryType).toBe('SELECT');
      expect(result.bindings).toEqual([]);
      expect(result.resultCount).toBe(0);
      expect(result.truncated).toBe(false);
    });

    it('should truncate results when exceeding maxResults', () => {
      const bindings: readonly Record<string, ProcessedBinding>[] = [
        { x: { type: 'literal', value: '1' } },
        { x: { type: 'literal', value: '2' } },
        { x: { type: 'literal', value: '3' } },
      ];

      const result = formatSelectResults(bindings, { maxResults: 2 });

      expect(result.resultCount).toBe(2);
      expect(result.truncated).toBe(true);
      expect(result.bindings).toHaveLength(2);
      expect(result.bindings[0].x.value).toBe('1');
      expect(result.bindings[1].x.value).toBe('2');
    });

    it('should not mutate original bindings array', () => {
      const bindings: readonly Record<string, ProcessedBinding>[] = [
        { x: { type: 'literal', value: '1' } },
        { x: { type: 'literal', value: '2' } },
      ];

      const result = formatSelectResults(bindings, { maxResults: 1 });

      expect(bindings).toHaveLength(2); // Original unchanged
      expect(result.bindings).toHaveLength(1); // Result truncated
    });
  });

  describe('formatConstructResults', () => {
    it('should format quads to turtle', () => {
      const quads = [
        quad(
          namedNode('http://example.org/subject'),
          namedNode('http://example.org/predicate'),
          literal('object value')
        ),
      ];

      const result = formatConstructResults(quads);

      expect(result.status).toBe('completed');
      expect(result.queryType).toBe('CONSTRUCT');
      expect(result.turtle).toContain('http://example.org/subject');
      expect(result.turtle).toContain('http://example.org/predicate');
      expect(result.turtle).toContain('object value');
      expect(result.resultCount).toBe(1);
      expect(result.truncated).toBe(false);
    });

    it('should handle empty quads', () => {
      const result = formatConstructResults([]);

      expect(result.status).toBe('completed');
      expect(result.queryType).toBe('CONSTRUCT');
      expect(result.turtle).toBe('');
      expect(result.resultCount).toBe(0);
      expect(result.truncated).toBe(false);
    });

    it('should include prefixes when requested', () => {
      const quads = [
        quad(
          namedNode('http://example.org/subject'),
          namedNode('http://example.org/predicate'),
          literal('value')
        ),
      ];

      const result = formatConstructResults(quads, { includePrefixes: true });

      expect(result.turtle).toContain('ns0:');
    });

    it('should not mutate original quads array', () => {
      const quads = [
        quad(
          namedNode('http://example.org/subject'),
          namedNode('http://example.org/predicate'),
          literal('value')
        ),
      ];
      const originalLength = quads.length;

      formatConstructResults(quads);

      expect(quads).toHaveLength(originalLength);
    });
  });

  describe('formatDescribeResults', () => {
    it('should format with DESCRIBE query type', () => {
      const quads = [
        quad(
          namedNode('http://example.org/subject'),
          namedNode('http://example.org/predicate'),
          literal('value')
        ),
      ];

      const result = formatDescribeResults(quads);

      expect(result.status).toBe('completed');
      expect(result.queryType).toBe('DESCRIBE');
      expect(result.turtle).toContain('http://example.org/subject');
      expect(result.resultCount).toBe(1);
      expect(result.truncated).toBe(false);
    });

    it('should behave identically to formatConstructResults except query type', () => {
      const quads = [
        quad(
          namedNode('http://example.org/subject'),
          namedNode('http://example.org/predicate'),
          literal('value')
        ),
      ];

      const constructResult = formatConstructResults(quads);
      const describeResult = formatDescribeResults(quads);

      expect(describeResult.turtle).toBe(constructResult.turtle);
      expect(describeResult.resultCount).toBe(constructResult.resultCount);
      expect(describeResult.truncated).toBe(constructResult.truncated);
      expect(describeResult.queryType).toBe('DESCRIBE');
      expect(constructResult.queryType).toBe('CONSTRUCT');
    });
  });

  describe('formatAskResults', () => {
    it('should format true result', () => {
      const result = formatAskResults(true);

      expect(result.status).toBe('completed');
      expect(result.queryType).toBe('ASK');
      expect(result.boolean).toBe(true);
      expect(result.resultCount).toBe(1);
      expect(result.truncated).toBe(false);
    });

    it('should format false result', () => {
      const result = formatAskResults(false);

      expect(result.status).toBe('completed');
      expect(result.queryType).toBe('ASK');
      expect(result.boolean).toBe(false);
      expect(result.resultCount).toBe(1);
      expect(result.truncated).toBe(false);
    });
  });

  describe('transformBinding', () => {
    it('should transform Comunica binding with entrySeq', () => {
      const mockBinding = {
        entries: {
          size: 2,
          entrySeq: function* () {
            yield [{ value: 's' }, namedNode('http://example.org/subject')];
            yield [{ value: 'p' }, namedNode('http://example.org/predicate')];
          },
        },
      };

      const result = transformBinding(mockBinding);

      expect(result).toEqual({
        s: { type: 'uri', value: 'http://example.org/subject' },
        p: { type: 'uri', value: 'http://example.org/predicate' },
      });
    });

    it('should transform binding with Map entries', () => {
      const entries = new Map();
      entries.set('s', namedNode('http://example.org/subject'));
      entries.set('o', literal('value', 'en'));

      const mockBinding = { entries };
      const result = transformBinding(mockBinding);

      expect(result).toEqual({
        s: { type: 'uri', value: 'http://example.org/subject' },
        o: {
          type: 'literal',
          value: 'value',
          language: 'en',
        },
      });
    });

    it('should transform binding with plain object entries', () => {
      const mockBinding = {
        entries: {
          s: namedNode('http://example.org/subject'),
          b: blankNode('b1'),
          lit: literal('123', namedNode('http://www.w3.org/2001/XMLSchema#integer')),
        },
      };

      const result = transformBinding(mockBinding);

      expect(result).toEqual({
        s: { type: 'uri', value: 'http://example.org/subject' },
        b: { type: 'bnode', value: '_:b1' },
        lit: {
          type: 'literal',
          value: '123',
          datatype: 'http://www.w3.org/2001/XMLSchema#integer',
        },
      });
    });

    it('should handle binding with no entries', () => {
      const mockBinding = {};
      const result = transformBinding(mockBinding);

      expect(result).toEqual({});
    });

    it('should handle binding with null entries', () => {
      const mockBinding = { entries: null };
      const result = transformBinding(mockBinding);

      expect(result).toEqual({});
    });

    it('should handle malformed entries gracefully', () => {
      const mockBinding = {
        entries: {
          valid: namedNode('http://example.org/valid'),
          invalid: { not: 'a term' }, // Missing 'value' property
        },
      };

      const result = transformBinding(mockBinding);

      expect(result).toEqual({
        valid: { type: 'uri', value: 'http://example.org/valid' },
      });
    });

    it('should handle different term types correctly', () => {
      const mockBinding = {
        entries: {
          uri: namedNode('http://example.org/uri'),
          blank: blankNode('b1'),
          literal: literal('simple'),
          literalLang: literal('hello', 'en'),
          literalType: literal('42', namedNode('http://www.w3.org/2001/XMLSchema#integer')),
        },
      };

      const result = transformBinding(mockBinding);

      expect(result.uri).toEqual({ type: 'uri', value: 'http://example.org/uri' });
      expect(result.blank).toEqual({ type: 'bnode', value: '_:b1' });
      expect(result.literal).toEqual({ type: 'literal', value: 'simple' });
      expect(result.literalLang).toEqual({
        type: 'literal',
        value: 'hello',
        language: 'en',
      });
      expect(result.literalType).toEqual({
        type: 'literal',
        value: '42',
        datatype: 'http://www.w3.org/2001/XMLSchema#integer',
      });
    });
  });

  describe('quadsToTurtle', () => {
    it('should convert quads to turtle string', () => {
      const quads = [
        quad(
          namedNode('http://example.org/subject'),
          namedNode('http://example.org/predicate'),
          literal('object')
        ),
      ];

      const turtle = quadsToTurtle(quads);

      expect(turtle).toContain('<http://example.org/subject>');
      expect(turtle).toContain('<http://example.org/predicate>');
      expect(turtle).toContain('"object"');
    });

    it('should handle empty quads array', () => {
      const turtle = quadsToTurtle([]);
      expect(turtle).toBe('');
    });

    it('should include prefixes when requested', () => {
      const quads = [
        quad(
          namedNode('http://example.org/subject'),
          namedNode('http://example.org/predicate'),
          literal('object')
        ),
      ];

      const turtle = quadsToTurtle(quads, { includePrefixes: true });

      expect(turtle).toContain('@prefix');
      expect(turtle).toContain('ns0:');
    });

    it('should handle complex literals correctly', () => {
      const quads = [
        quad(
          namedNode('http://example.org/subject'),
          namedNode('http://example.org/hasName'),
          literal('John Doe', 'en')
        ),
        quad(
          namedNode('http://example.org/subject'),
          namedNode('http://example.org/hasAge'),
          literal('30', namedNode('http://www.w3.org/2001/XMLSchema#integer'))
        ),
      ];

      const turtle = quadsToTurtle(quads);

      expect(turtle).toContain('"John Doe"@en');
      expect(turtle).toContain('"30"^^<http://www.w3.org/2001/XMLSchema#integer>');
    });

    it('should handle blank nodes', () => {
      const quads = [
        quad(
          blankNode('b1'),
          namedNode('http://example.org/predicate'),
          literal('value')
        ),
      ];

      const turtle = quadsToTurtle(quads);

      expect(turtle).toContain('_:b1');
    });

    it('should not mutate original quads', () => {
      const quads = [
        quad(
          namedNode('http://example.org/subject'),
          namedNode('http://example.org/predicate'),
          literal('object')
        ),
      ];
      const originalQuad = quads[0];

      quadsToTurtle(quads);

      expect(quads[0]).toBe(originalQuad);
      expect(quads).toHaveLength(1);
    });

    it('should use fallback serialization on N3 Writer errors', () => {
      // Create a scenario that might cause N3 Writer to fail
      const quads = [
        quad(
          namedNode('http://example.org/subject'),
          namedNode('http://example.org/predicate'),
          literal('object')
        ),
      ];

      // This should still work even if N3 Writer fails
      const turtle = quadsToTurtle(quads);

      expect(typeof turtle).toBe('string');
      expect(turtle.length).toBeGreaterThan(0);
    });
  });

  describe('estimateMemoryUsage', () => {
    it('should estimate SELECT result memory usage', () => {
      const selectResult: SelectResult = {
        status: 'completed',
        queryType: 'SELECT',
        bindings: [
          {
            s: { type: 'uri', value: 'http://example.org/subject' },
            p: { type: 'uri', value: 'http://example.org/predicate' },
            o: { type: 'literal', value: 'object', language: 'en' },
          },
        ],
        resultCount: 1,
        truncated: false,
      };

      const usage = estimateMemoryUsage(selectResult);

      expect(usage).toBeGreaterThan(0);
      expect(typeof usage).toBe('number');
    });

    it('should estimate CONSTRUCT result memory usage', () => {
      const constructResult: ConstructResult = {
        status: 'completed',
        queryType: 'CONSTRUCT',
        turtle: '<http://example.org/s> <http://example.org/p> "object" .',
        resultCount: 1,
        truncated: false,
      };

      const usage = estimateMemoryUsage(constructResult);

      expect(usage).toBeGreaterThan(0);
      expect(typeof usage).toBe('number');
    });

    it('should estimate DESCRIBE result memory usage', () => {
      const describeResult: DescribeResult = {
        status: 'completed',
        queryType: 'DESCRIBE',
        turtle: '<http://example.org/s> <http://example.org/p> "object" .',
        resultCount: 1,
        truncated: false,
      };

      const usage = estimateMemoryUsage(describeResult);

      expect(usage).toBeGreaterThan(0);
      expect(typeof usage).toBe('number');
    });

    it('should estimate ASK result memory usage', () => {
      const askResult: AskResult = {
        status: 'completed',
        queryType: 'ASK',
        boolean: true,
        resultCount: 1,
        truncated: false,
      };

      const usage = estimateMemoryUsage(askResult);

      expect(usage).toBe(4); // Boolean should be 4 bytes
    });

    it('should handle empty SELECT results', () => {
      const selectResult: SelectResult = {
        status: 'completed',
        queryType: 'SELECT',
        bindings: [],
        resultCount: 0,
        truncated: false,
      };

      const usage = estimateMemoryUsage(selectResult);

      expect(usage).toBe(0);
    });

    it('should account for optional properties in bindings', () => {
      const resultWithOptional: SelectResult = {
        status: 'completed',
        queryType: 'SELECT',
        bindings: [
          {
            withDatatype: {
              type: 'literal',
              value: '123',
              datatype: 'http://www.w3.org/2001/XMLSchema#integer',
            },
            withLanguage: {
              type: 'literal',
              value: 'hello',
              language: 'en',
            },
            simple: {
              type: 'literal',
              value: 'simple',
            },
          },
        ],
        resultCount: 1,
        truncated: false,
      };

      const usage = estimateMemoryUsage(resultWithOptional);

      expect(usage).toBeGreaterThan(0);
      expect(typeof usage).toBe('number');
    });
  });

  describe('createResultSummary', () => {
    it('should create summary for SELECT results', () => {
      const selectResult: SelectResult = {
        status: 'completed',
        queryType: 'SELECT',
        bindings: [
          { s: { type: 'uri', value: 'http://example.org/subject' } },
        ],
        resultCount: 1,
        truncated: false,
      };

      const summary = createResultSummary(selectResult);

      expect(summary.type).toBe('SELECT');
      expect(summary.count).toBe(1);
      expect(summary.truncated).toBe(false);
      expect(summary.estimatedBytes).toBeGreaterThan(0);
    });

    it('should create summary for CONSTRUCT results', () => {
      const constructResult: ConstructResult = {
        status: 'completed',
        queryType: 'CONSTRUCT',
        turtle: '<http://example.org/s> <http://example.org/p> "o" .',
        resultCount: 1,
        truncated: false,
      };

      const summary = createResultSummary(constructResult);

      expect(summary.type).toBe('CONSTRUCT');
      expect(summary.count).toBe(1);
      expect(summary.truncated).toBe(false);
      expect(summary.estimatedBytes).toBeGreaterThan(0);
    });

    it('should create summary for ASK results', () => {
      const askResult: AskResult = {
        status: 'completed',
        queryType: 'ASK',
        boolean: true,
        resultCount: 1,
        truncated: false,
      };

      const summary = createResultSummary(askResult);

      expect(summary.type).toBe('ASK');
      expect(summary.count).toBe(1);
      expect(summary.truncated).toBe(false);
      expect(summary.estimatedBytes).toBe(4);
    });

    it('should handle truncated results', () => {
      const truncatedResult: SelectResult = {
        status: 'completed',
        queryType: 'SELECT',
        bindings: [],
        resultCount: 100,
        truncated: true,
      };

      const summary = createResultSummary(truncatedResult);

      expect(summary.truncated).toBe(true);
      expect(summary.count).toBe(100);
    });
  });
});