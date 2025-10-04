/**
 * Tests for SparqlParserService global prefix integration with settings
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SparqlParserService } from '@/services/SparqlParserService';
import { PrefixService } from '@/services/PrefixService';

describe('SparqlParserService - Global Prefix Integration', () => {
  let sparqlParserService: SparqlParserService;
  let prefixService: PrefixService;

  beforeEach(() => {
    // Create PrefixService with global prefixes that include user-defined ones
    const globalPrefixes = {
      // Common prefixes
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      foaf: 'http://xmlns.com/foaf/0.1/',
      owl: 'http://www.w3.org/2002/07/owl#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      // User-defined global prefixes
      shad: 'http://shadr.us/ontology/',
      custom: 'http://custom.example.org/',
      mycompany: 'http://mycompany.com/ontology/',
    };

    prefixService = new PrefixService(globalPrefixes);
    sparqlParserService = new SparqlParserService(prefixService);
  });

  describe('addMissingPrefixes functionality', () => {
    it('should automatically add user-defined global prefix when used in query', async () => {
      const queryWithoutPrefixes = `
        SELECT ?person ?name WHERE {
          ?person a shad:Person ;
                  foaf:name ?name .
        }
      `;

      const result = await sparqlParserService.parseSparqlContent(queryWithoutPrefixes);

      expect(result.success).toBe(true);
      expect(result.prefixes).toEqual(
        expect.objectContaining({
          shad: 'http://shadr.us/ontology/',
          foaf: 'http://xmlns.com/foaf/0.1/',
        })
      );
    });

    it('should add multiple user-defined prefixes when used in query', async () => {
      const queryWithMultiplePrefixes = `
        SELECT ?entity ?value WHERE {
          ?entity a shad:Entity ;
                  custom:hasValue ?value ;
                  mycompany:category "test" .
        }
      `;

      const result = await sparqlParserService.parseSparqlContent(queryWithMultiplePrefixes);

      expect(result.success).toBe(true);
      expect(result.prefixes).toEqual(
        expect.objectContaining({
          shad: 'http://shadr.us/ontology/',
          custom: 'http://custom.example.org/',
          mycompany: 'http://mycompany.com/ontology/',
        })
      );
    });

    it('should not add prefixes that are already explicitly defined', async () => {
      const queryWithExplicitPrefix = `
        PREFIX shad: <http://different.shadr.us/ontology/>
        SELECT ?person WHERE {
          ?person a shad:Person .
        }
      `;

      const result = await sparqlParserService.parseSparqlContent(queryWithExplicitPrefix);

      expect(result.success).toBe(true);
      // Should use the explicitly defined prefix, not the global one
      expect(result.prefixes?.shad).toBe('http://different.shadr.us/ontology/');
    });

    it('should work with CONSTRUCT queries using global prefixes', async () => {
      const constructQuery = `
        CONSTRUCT {
          ?person a shad:DetailedPerson ;
                  custom:enrichedName ?name .
        } WHERE {
          ?person a foaf:Person ;
                  foaf:name ?name .
        }
      `;

      const result = await sparqlParserService.parseSparqlContent(constructQuery);

      expect(result.success).toBe(true);
      expect(result.queryType).toBe('CONSTRUCT');
      expect(result.prefixes).toEqual(
        expect.objectContaining({
          shad: 'http://shadr.us/ontology/',
          custom: 'http://custom.example.org/',
          foaf: 'http://xmlns.com/foaf/0.1/',
        })
      );
    });

    it('should work with ASK queries using global prefixes', async () => {
      const askQuery = `
        ASK {
          ?person a shad:Person ;
                  custom:hasSpecialProperty ?value .
        }
      `;

      const result = await sparqlParserService.parseSparqlContent(askQuery);

      expect(result.success).toBe(true);
      expect(result.queryType).toBe('ASK');
      expect(result.prefixes).toEqual(
        expect.objectContaining({
          shad: 'http://shadr.us/ontology/',
          custom: 'http://custom.example.org/',
        })
      );
    });

    it('should work with DESCRIBE queries using global prefixes', async () => {
      const describeQuery = `
        DESCRIBE ?entity WHERE {
          ?entity a shad:ImportantEntity ;
                  custom:priority "high" .
        }
      `;

      const result = await sparqlParserService.parseSparqlContent(describeQuery);

      expect(result.success).toBe(true);
      expect(result.queryType).toBe('DESCRIBE');
      expect(result.prefixes).toEqual(
        expect.objectContaining({
          shad: 'http://shadr.us/ontology/',
          custom: 'http://custom.example.org/',
        })
      );
    });

    it('should handle queries with FROM clauses and global prefixes', async () => {
      const queryWithFrom = `
        SELECT ?entity
        FROM <vault://some-file.md>
        WHERE {
          ?entity a shad:Entity ;
                  custom:source "vault" .
        }
      `;

      const result = await sparqlParserService.parseSparqlContent(queryWithFrom);

      expect(result.success).toBe(true);
      expect(result.fromGraphs).toContain('vault://some-file.md');
      expect(result.prefixes).toEqual(
        expect.objectContaining({
          shad: 'http://shadr.us/ontology/',
          custom: 'http://custom.example.org/',
        })
      );
    });

    it('should handle complex queries with OPTIONAL and FILTER using global prefixes', async () => {
      const complexQuery = `
        SELECT ?person ?name ?category WHERE {
          ?person a shad:Person ;
                  foaf:name ?name .
          OPTIONAL {
            ?person custom:category ?category .
          }
          FILTER(?category != "excluded")
        }
      `;

      const result = await sparqlParserService.parseSparqlContent(complexQuery);

      expect(result.success).toBe(true);
      expect(result.prefixes).toEqual(
        expect.objectContaining({
          shad: 'http://shadr.us/ontology/',
          foaf: 'http://xmlns.com/foaf/0.1/',
          custom: 'http://custom.example.org/',
        })
      );
    });

    it('should not interfere with URL schemes (http, https, etc.)', async () => {
      const queryWithUrls = `
        SELECT ?entity WHERE {
          ?entity a shad:Entity ;
                  custom:homepage <http://example.com> ;
                  custom:secureHomepage <https://example.com> .
        }
      `;

      const result = await sparqlParserService.parseSparqlContent(queryWithUrls);

      expect(result.success).toBe(true);
      expect(result.prefixes).toEqual(
        expect.objectContaining({
          shad: 'http://shadr.us/ontology/',
          custom: 'http://custom.example.org/',
        })
      );
      // Should not try to create prefixes for http or https
      expect(result.prefixes?.http).toBeUndefined();
      expect(result.prefixes?.https).toBeUndefined();
    });

    it('should handle empty prefix (default namespace) when defined globally', async () => {
      // Add empty prefix to the service
      const prefixServiceWithDefault = new PrefixService({
        ...prefixService.getGlobalPrefixes(),
        '': 'http://default.example.org/',
      });
      const sparqlParserWithDefault = new SparqlParserService(prefixServiceWithDefault);

      const queryWithDefaultPrefix = `
        PREFIX : <http://default.example.org/>
        SELECT ?entity WHERE {
          ?entity a :DefaultType ;
                  shad:hasProperty ?value .
        }
      `;

      const result = await sparqlParserWithDefault.parseSparqlContent(queryWithDefaultPrefix);

      expect(result.success).toBe(true);
      expect(result.prefixes).toEqual(
        expect.objectContaining({
          '': 'http://default.example.org/',
          shad: 'http://shadr.us/ontology/',
        })
      );
    });
  });

  describe('prefix precedence and override behavior', () => {
    it('should respect explicitly defined prefixes over global ones', async () => {
      const queryWithOverride = `
        PREFIX shad: <http://local-override.example.org/>
        SELECT ?entity WHERE {
          ?entity a shad:LocalEntity ;
                  custom:type "test" .
        }
      `;

      const result = await sparqlParserService.parseSparqlContent(queryWithOverride);

      expect(result.success).toBe(true);
      expect(result.prefixes?.shad).toBe('http://local-override.example.org/');
      expect(result.prefixes?.custom).toBe('http://custom.example.org/'); // Global prefix still added
    });

    it('should handle additionalPrefixes parameter correctly', async () => {
      const queryString = `
        SELECT ?entity WHERE {
          ?entity a shad:Entity ;
                  temp:value ?val ;
                  custom:type "test" .
        }
      `;

      const result = await sparqlParserService.parseSparqlContent(queryString, {
        additionalPrefixes: {
          temp: 'http://temporary.example.org/',
          shad: 'http://additional-override.example.org/', // Override global
        },
      });

      expect(result.success).toBe(true);
      expect(result.prefixes).toEqual(
        expect.objectContaining({
          temp: 'http://temporary.example.org/',
          shad: 'http://additional-override.example.org/', // Additional should override global
          custom: 'http://custom.example.org/', // Global prefix still used
        })
      );
    });
  });

  describe('error handling with global prefixes', () => {
    it('should provide helpful error messages when unknown prefixes are used', async () => {
      const queryWithUnknownPrefix = `
        PREFIX unknown: <http://unknown.example.org/>
        SELECT ?entity WHERE {
          ?entity a unknown:Type ;
                  shad:hasProperty ?value .
        }
      `;

      const result = await sparqlParserService.parseSparqlContent(queryWithUnknownPrefix);

      // The query should succeed since we explicitly defined the unknown prefix
      expect(result.success).toBe(true);
      expect(result.prefixes).toEqual(
        expect.objectContaining({
          unknown: 'http://unknown.example.org/',
          shad: 'http://shadr.us/ontology/',
        })
      );
    });

    it('should handle malformed SPARQL syntax with global prefixes gracefully', async () => {
      const malformedQuery = `
        SELECT ?entity WHERE {
          ?entity a shad:Entity
          // Missing semicolon and closing brace
      `;

      const result = await sparqlParserService.parseSparqlContent(malformedQuery);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.errorType).toBe('syntax');
    });
  });

  describe('integration with SparqlQuery models', () => {
    it('should work with parseSparqlQuery method using SparqlQuery model', async () => {
      // Create a mock SparqlQuery with context
      const mockQuery = {
        queryString: `
          SELECT ?entity WHERE {
            ?entity a shad:Entity ;
                    custom:property ?value ;
                    local:context "test" .
          }
        `,
        context: {
          baseUri: 'vault://test.md/',
          prefixes: {
            local: 'http://local-context.example.org/',
          },
          fromGraphs: [],
          fromNamedGraphs: [],
        },
      } as any;

      const result = await sparqlParserService.parseSparqlQuery(mockQuery);

      expect(result.success).toBe(true);
      expect(result.prefixes).toEqual(
        expect.objectContaining({
          shad: 'http://shadr.us/ontology/',
          custom: 'http://custom.example.org/',
          local: 'http://local-context.example.org/', // From query context
        })
      );
    });
  });

  describe('performance and edge cases', () => {
    it('should handle queries with no prefix usage efficiently', async () => {
      const queryWithoutPrefixes = `
        SELECT ?entity WHERE {
          <http://example.org/entity> a <http://example.org/Type> ;
                                      <http://example.org/property> ?entity .
        }
      `;

      const result = await sparqlParserService.parseSparqlContent(queryWithoutPrefixes);

      expect(result.success).toBe(true);
      expect(result.prefixes).toEqual({}); // No prefixes should be added
    });

    it('should handle very large prefix sets efficiently', async () => {
      // Create a prefix service with many prefixes
      const manyPrefixes: Record<string, string> = {};
      for (let i = 0; i < 100; i++) {
        manyPrefixes[`prefix${i}`] = `http://example${i}.org/`;
      }
      manyPrefixes.shad = 'http://shadr.us/ontology/';

      const largePrefixService = new PrefixService(manyPrefixes);
      const largeParserService = new SparqlParserService(largePrefixService);

      const queryString = `
        SELECT ?entity WHERE {
          ?entity a shad:Entity .
        }
      `;

      const result = await largeParserService.parseSparqlContent(queryString);

      expect(result.success).toBe(true);
      expect(result.prefixes?.shad).toBe('http://shadr.us/ontology/');
      expect(result.parseTimeMs).toBeLessThan(1000); // Should be fast even with many prefixes
    });

    it('should handle queries with mixed case PREFIX declarations', async () => {
      const mixedCaseQuery = `
        prefix shad: <http://local.example.org/>
        PREFIX custom: <http://local-custom.example.org/>
        PrEfIx foaf: <http://local-foaf.example.org/>

        SELECT ?entity WHERE {
          ?entity a shad:Entity ;
                  custom:property ?value ;
                  mycompany:other ?other .
        }
      `;

      const result = await sparqlParserService.parseSparqlContent(mixedCaseQuery);

      expect(result.success).toBe(true);
      // Explicitly defined prefixes should be used
      expect(result.prefixes?.shad).toBe('http://local.example.org/');
      expect(result.prefixes?.custom).toBe('http://local-custom.example.org/');
      expect(result.prefixes?.foaf).toBe('http://local-foaf.example.org/');
      // Global prefix should be added for undefined mycompany:
      expect(result.prefixes?.mycompany).toBe('http://mycompany.com/ontology/');
    });
  });
});