import { describe, it, expect } from 'vitest';
import { formatLiteralForDisplay } from '../literal-formatting';

describe('formatLiteralForDisplay', () => {
  describe('numeric literals', () => {
    it('should format integers without quotes', () => {
      const result = formatLiteralForDisplay(
        '42',
        'http://www.w3.org/2001/XMLSchema#integer'
      );

      expect(result.displayText).toBe('42');
      expect(result.fullNotation).toBe('"42"^^<http://www.w3.org/2001/XMLSchema#integer>');
      expect(result.cssClass).toBe('rdf-literal-typed rdf-literal-integer');
    });

    it('should format decimals without quotes', () => {
      const result = formatLiteralForDisplay(
        '3.14159',
        'http://www.w3.org/2001/XMLSchema#decimal'
      );

      expect(result.displayText).toBe('3.14159');
      expect(result.fullNotation).toBe('"3.14159"^^<http://www.w3.org/2001/XMLSchema#decimal>');
      expect(result.cssClass).toBe('rdf-literal-typed rdf-literal-decimal');
    });

    it('should format floating point numbers with appropriate precision', () => {
      const result = formatLiteralForDisplay(
        '2.00000000',
        'http://www.w3.org/2001/XMLSchema#double'
      );

      expect(result.displayText).toBe('2');
      expect(result.fullNotation).toBe('"2.00000000"^^<http://www.w3.org/2001/XMLSchema#double>');
    });
  });

  describe('boolean literals', () => {
    it('should format true boolean values', () => {
      const result = formatLiteralForDisplay(
        'true',
        'http://www.w3.org/2001/XMLSchema#boolean'
      );

      expect(result.displayText).toBe('true');
      expect(result.fullNotation).toBe('"true"^^<http://www.w3.org/2001/XMLSchema#boolean>');
      expect(result.cssClass).toBe('rdf-literal-typed rdf-literal-boolean');
    });

    it('should format false boolean values', () => {
      const result = formatLiteralForDisplay(
        'false',
        'http://www.w3.org/2001/XMLSchema#boolean'
      );

      expect(result.displayText).toBe('false');
      expect(result.fullNotation).toBe('"false"^^<http://www.w3.org/2001/XMLSchema#boolean>');
    });

    it('should handle numeric boolean representation', () => {
      const result = formatLiteralForDisplay(
        '1',
        'http://www.w3.org/2001/XMLSchema#boolean'
      );

      expect(result.displayText).toBe('true');
      expect(result.fullNotation).toBe('"1"^^<http://www.w3.org/2001/XMLSchema#boolean>');
    });
  });

  describe('temporal literals', () => {
    it('should format dates nicely', () => {
      const result = formatLiteralForDisplay(
        '2023-12-25',
        'http://www.w3.org/2001/XMLSchema#date'
      );

      // Just check that it contains the year and is a reasonable date format
      expect(result.displayText).toMatch(/2023/);
      expect(result.displayText).toMatch(/12/); // Month
      expect(result.displayText).toMatch(/25/); // Day
      expect(result.fullNotation).toBe('"2023-12-25"^^<http://www.w3.org/2001/XMLSchema#date>');
      expect(result.cssClass).toBe('rdf-literal-typed rdf-literal-temporal');
    });

    it('should format datetime values', () => {
      const result = formatLiteralForDisplay(
        '2023-12-25T14:30:00Z',
        'http://www.w3.org/2001/XMLSchema#dateTime'
      );

      expect(result.displayText).toMatch(/12\/25\/2023/); // Should contain the date
      expect(result.fullNotation).toBe('"2023-12-25T14:30:00Z"^^<http://www.w3.org/2001/XMLSchema#dateTime>');
      expect(result.cssClass).toBe('rdf-literal-typed rdf-literal-temporal');
    });

    it('should format years simply', () => {
      const result = formatLiteralForDisplay(
        '2023',
        'http://www.w3.org/2001/XMLSchema#gYear'
      );

      expect(result.displayText).toBe('2023');
      expect(result.fullNotation).toBe('"2023"^^<http://www.w3.org/2001/XMLSchema#gYear>');
    });
  });

  describe('language-tagged literals', () => {
    it('should show text without language tag in display', () => {
      const result = formatLiteralForDisplay(
        'Hello',
        undefined,
        'en'
      );

      expect(result.displayText).toBe('Hello');
      expect(result.fullNotation).toBe('"Hello"@en');
      expect(result.cssClass).toBe('rdf-literal-language');
    });

    it('should handle different languages', () => {
      const result = formatLiteralForDisplay(
        'Bonjour',
        undefined,
        'fr'
      );

      expect(result.displayText).toBe('Bonjour');
      expect(result.fullNotation).toBe('"Bonjour"@fr');
    });
  });

  describe('plain string literals', () => {
    it('should format plain strings without datatype', () => {
      const result = formatLiteralForDisplay('Hello world');

      expect(result.displayText).toBe('Hello world');
      expect(result.fullNotation).toBe('"Hello world"');
      expect(result.cssClass).toBe('rdf-literal-plain');
    });

    it('should format explicit string datatype as plain', () => {
      const result = formatLiteralForDisplay(
        'Hello world',
        'http://www.w3.org/2001/XMLSchema#string'
      );

      expect(result.displayText).toBe('Hello world');
      expect(result.fullNotation).toBe('"Hello world"^^<http://www.w3.org/2001/XMLSchema#string>');
    });
  });

  describe('CURIE creation', () => {
    it('should use CURIE when createCurie function is provided', () => {
      const createCurie = (uri: string) => {
        if (uri === 'http://www.w3.org/2001/XMLSchema#integer') {
          return 'xsd:integer';
        }
        return null;
      };

      const result = formatLiteralForDisplay(
        '42',
        'http://www.w3.org/2001/XMLSchema#integer',
        undefined,
        createCurie
      );

      expect(result.fullNotation).toBe('"42"^^xsd:integer');
    });

    it('should fall back to full URI when CURIE creation fails', () => {
      const createCurie = () => null; // Always fails

      const result = formatLiteralForDisplay(
        '42',
        'http://www.w3.org/2001/XMLSchema#integer',
        undefined,
        createCurie
      );

      expect(result.fullNotation).toBe('"42"^^<http://www.w3.org/2001/XMLSchema#integer>');
    });
  });

  describe('unknown datatypes', () => {
    it('should handle unknown datatypes gracefully', () => {
      const result = formatLiteralForDisplay(
        'some-value',
        'http://example.org/custom#myType'
      );

      expect(result.displayText).toBe('some-value');
      expect(result.fullNotation).toBe('"some-value"^^<http://example.org/custom#myType>');
      expect(result.cssClass).toBe('rdf-literal-typed rdf-literal-other');
    });
  });
});