/**
 * Integration tests for RdfToolsService SPARQL prefix handling with global settings
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RdfToolsService } from '@/services/RdfToolsService';
import type { RdfToolsSettings } from '@/models/RdfToolsSettings';
import { Logger } from '@/utils/Logger';

// Mock dependencies
vi.mock('obsidian', () => ({
  Component: class {},
}));

vi.mock('@/services/CodeBlockExtractorService');
vi.mock('@/services/GraphService');
vi.mock('@/services/QueryExecutorService');
vi.mock('@/services/SparqlQueryTracker');
vi.mock('@/ui/SparqlBlockProcessor');
vi.mock('@/services/MarkdownErrorReporter');

describe('RdfToolsService - SPARQL Global Prefix Integration', () => {
  let mockApp: any;
  let mockPlugin: any;
  let mockLogger: Logger;
  let settingsWithGlobalPrefixes: RdfToolsSettings;

  beforeEach(() => {
    mockApp = {
      vault: {
        on: vi.fn(),
      },
      workspace: {},
    };

    mockPlugin = {};

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    settingsWithGlobalPrefixes = {
      globalPrefixes: {
        // Common prefixes
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        foaf: 'http://xmlns.com/foaf/0.1/',
        // User-defined global prefixes
        shad: 'http://shadr.us/ontology/',
        custom: 'http://custom.example.org/',
        corp: 'http://corporation.internal/',
      },
      maxGraphCacheSize: 100,
      maxQueryCacheSize: 50,
      queryTimeout: 30000,
      maxQueryResults: 1000,
      defaultResultFormat: 'table' as const,
      showQueryExecutionTime: true,
      autoExecuteQueries: true,
      showDetailedErrors: true,
      enableDebugLogging: false,
    };
  });

  describe('SPARQL parser integration with global prefixes', () => {
    it('should automatically inject user-defined global prefixes into SPARQL queries', async () => {
      const rdfService = new RdfToolsService(mockApp, mockPlugin, settingsWithGlobalPrefixes, mockLogger);
      const sparqlParser = rdfService.getSparqlParserService();

      const queryWithoutPrefixes = `
        SELECT ?person ?name WHERE {
          ?person a shad:Person ;
                  foaf:name ?name ;
                  corp:department ?dept .
        }
      `;

      const result = await sparqlParser.parseSparqlContent(queryWithoutPrefixes);

      expect(result.success).toBe(true);
      expect(result.prefixes).toEqual(
        expect.objectContaining({
          shad: 'http://shadr.us/ontology/',
          foaf: 'http://xmlns.com/foaf/0.1/',
          corp: 'http://corporation.internal/',
        })
      );
    });

    it('should handle CONSTRUCT queries with global prefixes from settings', async () => {
      const rdfService = new RdfToolsService(mockApp, mockPlugin, settingsWithGlobalPrefixes, mockLogger);
      const sparqlParser = rdfService.getSparqlParserService();

      const constructQuery = `
        CONSTRUCT {
          ?person a corp:Employee ;
                  shad:processedBy "rdf-tools" ;
                  custom:derivedFrom ?original .
        } WHERE {
          ?person a foaf:Person ;
                  custom:sourceType ?original .
        }
      `;

      const result = await sparqlParser.parseSparqlContent(constructQuery);

      expect(result.success).toBe(true);
      expect(result.queryType).toBe('CONSTRUCT');
      expect(result.prefixes).toEqual(
        expect.objectContaining({
          corp: 'http://corporation.internal/',
          shad: 'http://shadr.us/ontology/',
          custom: 'http://custom.example.org/',
          foaf: 'http://xmlns.com/foaf/0.1/',
        })
      );
    });

    it('should work with complex queries using FROM clauses and global prefixes', async () => {
      const rdfService = new RdfToolsService(mockApp, mockPlugin, settingsWithGlobalPrefixes, mockLogger);
      const sparqlParser = rdfService.getSparqlParserService();

      const complexQuery = `
        SELECT ?entity ?value ?category
        FROM <vault://entities.md>
        FROM <vault://metadata.md>
        WHERE {
          ?entity a shad:Entity ;
                  custom:hasValue ?value .
          OPTIONAL {
            ?entity corp:category ?category .
          }
          FILTER(EXISTS { ?entity foaf:name ?name })
        }
      `;

      const result = await sparqlParser.parseSparqlContent(complexQuery);

      expect(result.success).toBe(true);
      expect(result.fromGraphs).toEqual(['vault://entities.md', 'vault://metadata.md']);
      expect(result.prefixes).toEqual(
        expect.objectContaining({
          shad: 'http://shadr.us/ontology/',
          custom: 'http://custom.example.org/',
          corp: 'http://corporation.internal/',
          foaf: 'http://xmlns.com/foaf/0.1/',
        })
      );
    });
  });

  describe('settings updates affecting SPARQL parsing', () => {
    it('should update SPARQL parser when global prefixes are changed', async () => {
      const rdfService = new RdfToolsService(mockApp, mockPlugin, settingsWithGlobalPrefixes, mockLogger);
      const sparqlParser = rdfService.getSparqlParserService();

      // Initial state - shad prefix should work
      let result = await sparqlParser.parseSparqlContent(`
        SELECT ?entity WHERE { ?entity a shad:Entity . }
      `);
      expect(result.success).toBe(true);
      expect(result.prefixes?.shad).toBe('http://shadr.us/ontology/');

      // Update settings with new prefix definition
      const updatedSettings: RdfToolsSettings = {
        ...settingsWithGlobalPrefixes,
        globalPrefixes: {
          ...settingsWithGlobalPrefixes.globalPrefixes,
          shad: 'http://updated-shadr.us/ontology/',
          newprefix: 'http://new-prefix.example.org/',
        },
      };

      rdfService.updateGlobalPrefixes(updatedSettings);

      // Test updated prefix
      result = await sparqlParser.parseSparqlContent(`
        SELECT ?entity WHERE {
          ?entity a shad:Entity ;
                  newprefix:property ?value .
        }
      `);
      expect(result.success).toBe(true);
      expect(result.prefixes?.shad).toBe('http://updated-shadr.us/ontology/');
      expect(result.prefixes?.newprefix).toBe('http://new-prefix.example.org/');
    });

    it('should handle removal of global prefixes', async () => {
      const rdfService = new RdfToolsService(mockApp, mockPlugin, settingsWithGlobalPrefixes, mockLogger);
      const sparqlParser = rdfService.getSparqlParserService();

      // Initial state - corp prefix should work
      let result = await sparqlParser.parseSparqlContent(`
        SELECT ?entity WHERE { ?entity a corp:Entity . }
      `);
      expect(result.success).toBe(true);
      expect(result.prefixes?.corp).toBe('http://corporation.internal/');

      // Update settings removing corp prefix
      const updatedSettings: RdfToolsSettings = {
        ...settingsWithGlobalPrefixes,
        globalPrefixes: {
          shad: 'http://shadr.us/ontology/',
          custom: 'http://custom.example.org/',
          // corp prefix removed
        },
      };

      rdfService.updateGlobalPrefixes(updatedSettings);

      // Test removed prefix - should not be automatically added anymore
      result = await sparqlParser.parseSparqlContent(`
        SELECT ?entity WHERE {
          ?entity a shad:Entity ;
                  rdf:type ?type .
        }
      `);
      expect(result.success).toBe(true);
      expect(result.prefixes?.shad).toBe('http://shadr.us/ontology/');
      expect(result.prefixes?.rdf).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#'); // From common prefixes
    });
  });

  describe('precedence and override behavior', () => {
    it('should allow explicit PREFIX declarations to override global prefixes', async () => {
      const rdfService = new RdfToolsService(mockApp, mockPlugin, settingsWithGlobalPrefixes, mockLogger);
      const sparqlParser = rdfService.getSparqlParserService();

      const queryWithOverride = `
        PREFIX shad: <http://local-override.example.org/>
        SELECT ?entity WHERE {
          ?entity a shad:LocalEntity ;
                  custom:type "test" .
        }
      `;

      const result = await sparqlParser.parseSparqlContent(queryWithOverride);

      expect(result.success).toBe(true);
      // Explicit PREFIX should override global
      expect(result.prefixes?.shad).toBe('http://local-override.example.org/');
      // Other global prefixes should still be added when used
      expect(result.prefixes?.custom).toBe('http://custom.example.org/');
    });

    it('should handle mixed explicit and automatic prefix injection', async () => {
      const rdfService = new RdfToolsService(mockApp, mockPlugin, settingsWithGlobalPrefixes, mockLogger);
      const sparqlParser = rdfService.getSparqlParserService();

      const mixedQuery = `
        PREFIX explicit: <http://explicit.example.org/>
        SELECT ?entity WHERE {
          ?entity a explicit:Type ;
                  shad:property ?value ;
                  custom:category ?cat ;
                  corp:department ?dept .
        }
      `;

      const result = await sparqlParser.parseSparqlContent(mixedQuery);

      expect(result.success).toBe(true);
      expect(result.prefixes).toEqual(
        expect.objectContaining({
          explicit: 'http://explicit.example.org/', // Explicit
          shad: 'http://shadr.us/ontology/', // Global auto-injected
          custom: 'http://custom.example.org/', // Global auto-injected
          corp: 'http://corporation.internal/', // Global auto-injected
        })
      );
    });
  });

  describe('query types and advanced features', () => {
    it('should handle ASK queries with global prefixes', async () => {
      const rdfService = new RdfToolsService(mockApp, mockPlugin, settingsWithGlobalPrefixes, mockLogger);
      const sparqlParser = rdfService.getSparqlParserService();

      const askQuery = `
        ASK {
          ?person a shad:Person ;
                  corp:hasAccess "true"^^<http://www.w3.org/2001/XMLSchema#boolean> ;
                  custom:isActive ?active .
        }
      `;

      const result = await sparqlParser.parseSparqlContent(askQuery);

      expect(result.success).toBe(true);
      expect(result.queryType).toBe('ASK');
      expect(result.prefixes).toEqual(
        expect.objectContaining({
          shad: 'http://shadr.us/ontology/',
          corp: 'http://corporation.internal/',
          custom: 'http://custom.example.org/',
        })
      );
    });

    it('should handle DESCRIBE queries with global prefixes', async () => {
      const rdfService = new RdfToolsService(mockApp, mockPlugin, settingsWithGlobalPrefixes, mockLogger);
      const sparqlParser = rdfService.getSparqlParserService();

      const describeQuery = `
        DESCRIBE ?entity WHERE {
          ?entity a shad:ImportantEntity ;
                  corp:priority "high" ;
                  custom:needsDescription "true" .
        }
      `;

      const result = await sparqlParser.parseSparqlContent(describeQuery);

      expect(result.success).toBe(true);
      expect(result.queryType).toBe('DESCRIBE');
      expect(result.prefixes).toEqual(
        expect.objectContaining({
          shad: 'http://shadr.us/ontology/',
          corp: 'http://corporation.internal/',
          custom: 'http://custom.example.org/',
        })
      );
    });

    it('should handle queries with subqueries and global prefixes', async () => {
      const rdfService = new RdfToolsService(mockApp, mockPlugin, settingsWithGlobalPrefixes, mockLogger);
      const sparqlParser = rdfService.getSparqlParserService();

      const subqueryExample = `
        SELECT ?person ?avgScore WHERE {
          ?person a shad:Person ;
                  corp:department ?dept .
          {
            SELECT ?dept (AVG(?score) AS ?avgScore) WHERE {
              ?emp corp:department ?dept ;
                   custom:performanceScore ?score .
            }
            GROUP BY ?dept
          }
        }
      `;

      const result = await sparqlParser.parseSparqlContent(subqueryExample);

      expect(result.success).toBe(true);
      expect(result.prefixes).toEqual(
        expect.objectContaining({
          shad: 'http://shadr.us/ontology/',
          corp: 'http://corporation.internal/',
          custom: 'http://custom.example.org/',
        })
      );
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty global prefix settings gracefully', async () => {
      const emptyPrefixSettings: RdfToolsSettings = {
        ...settingsWithGlobalPrefixes,
        globalPrefixes: {}, // No global prefixes
      };

      const rdfService = new RdfToolsService(mockApp, mockPlugin, emptyPrefixSettings, mockLogger);
      const sparqlParser = rdfService.getSparqlParserService();

      const queryString = `
        SELECT ?entity WHERE {
          ?entity a foaf:Person .
        }
      `;

      const result = await sparqlParser.parseSparqlContent(queryString);

      expect(result.success).toBe(true);
      expect(result.prefixes?.foaf).toBe('http://xmlns.com/foaf/0.1/'); // From common prefixes
    });

    it('should handle malformed SPARQL with global prefixes gracefully', async () => {
      const rdfService = new RdfToolsService(mockApp, mockPlugin, settingsWithGlobalPrefixes, mockLogger);
      const sparqlParser = rdfService.getSparqlParserService();

      const malformedQuery = `
        SELECT ?entity WHERE {
          ?entity a shad:Entity
          // Missing closing brace and semicolon
      `;

      const result = await sparqlParser.parseSparqlContent(malformedQuery);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.errorType).toBe('syntax');
    });
  });
});