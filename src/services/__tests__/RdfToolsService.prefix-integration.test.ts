/**
 * Tests for RdfToolsService global prefix integration with settings
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RdfToolsService } from '@/services/RdfToolsService';
import { PrefixService } from '@/services/PrefixService';
import type { RdfToolsSettings } from '@/models/RdfToolsSettings';
import { Logger } from '@/utils/Logger';

// Mock dependencies
vi.mock('obsidian', () => ({
  Component: class {},
}));

vi.mock('@/services/CodeBlockExtractorService');
vi.mock('@/services/SparqlParserService');
vi.mock('@/services/GraphService');
vi.mock('@/services/QueryExecutorService');
vi.mock('@/services/SparqlQueryTracker');
vi.mock('@/ui/SparqlBlockProcessor');
vi.mock('@/services/MarkdownErrorReporter');

describe('RdfToolsService - Global Prefix Integration', () => {
  let mockApp: any;
  let mockPlugin: any;
  let mockLogger: Logger;
  let baseSettings: RdfToolsSettings;

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

    baseSettings = {
      globalPrefixes: {
        // Common prefixes from settings
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        foaf: 'http://xmlns.com/foaf/0.1/',
        // User-defined global prefix
        shad: 'http://shadr.us/ontology/',
        custom: 'http://custom.example.org/',
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

  describe('initialization', () => {
    it('should merge common prefixes with global prefixes from settings', () => {
      const rdfService = new RdfToolsService(mockApp, mockPlugin, baseSettings, mockLogger);
      const prefixService = rdfService.getPrefixService();
      const globalPrefixes = prefixService.getGlobalPrefixes();

      // Should include common prefixes
      expect(globalPrefixes.rdf).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
      expect(globalPrefixes.rdfs).toBe('http://www.w3.org/2000/01/rdf-schema#');
      expect(globalPrefixes.owl).toBe('http://www.w3.org/2002/07/owl#');
      expect(globalPrefixes.foaf).toBe('http://xmlns.com/foaf/0.1/');

      // Should include user-defined global prefixes
      expect(globalPrefixes.shad).toBe('http://shadr.us/ontology/');
      expect(globalPrefixes.custom).toBe('http://custom.example.org/');
    });

    it('should allow settings to override common prefixes', () => {
      const settingsWithOverride: RdfToolsSettings = {
        ...baseSettings,
        globalPrefixes: {
          ...baseSettings.globalPrefixes,
          // Override the foaf prefix
          foaf: 'http://custom-foaf.org/',
        },
      };

      const rdfService = new RdfToolsService(mockApp, mockPlugin, settingsWithOverride, mockLogger);
      const prefixService = rdfService.getPrefixService();
      const globalPrefixes = prefixService.getGlobalPrefixes();

      // Settings should override common prefixes
      expect(globalPrefixes.foaf).toBe('http://custom-foaf.org/');
      // Other common prefixes should still be present
      expect(globalPrefixes.rdf).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
    });

    it('should handle empty global prefixes in settings', () => {
      const settingsWithEmptyPrefixes: RdfToolsSettings = {
        ...baseSettings,
        globalPrefixes: {},
      };

      const rdfService = new RdfToolsService(mockApp, mockPlugin, settingsWithEmptyPrefixes, mockLogger);
      const prefixService = rdfService.getPrefixService();
      const globalPrefixes = prefixService.getGlobalPrefixes();

      // Should still have common prefixes
      expect(globalPrefixes.rdf).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
      expect(globalPrefixes.foaf).toBe('http://xmlns.com/foaf/0.1/');

      // Should not have custom prefixes
      expect(globalPrefixes.shad).toBeUndefined();
      expect(globalPrefixes.custom).toBeUndefined();
    });
  });

  describe('updateGlobalPrefixes', () => {
    it('should update prefixes when settings change', () => {
      const rdfService = new RdfToolsService(mockApp, mockPlugin, baseSettings, mockLogger);
      let prefixService = rdfService.getPrefixService();

      // Verify initial state
      expect(prefixService.getGlobalPrefixes().shad).toBe('http://shadr.us/ontology/');
      expect(prefixService.getGlobalPrefixes().newPrefix).toBeUndefined();

      // Update settings with new prefix
      const updatedSettings: RdfToolsSettings = {
        ...baseSettings,
        globalPrefixes: {
          ...baseSettings.globalPrefixes,
          newPrefix: 'http://new-prefix.org/',
          shad: 'http://updated-shadr.us/ontology/', // Update existing
        },
      };

      rdfService.updateGlobalPrefixes(updatedSettings);

      // Verify prefixes were updated
      const updatedGlobalPrefixes = prefixService.getGlobalPrefixes();
      expect(updatedGlobalPrefixes.newPrefix).toBe('http://new-prefix.org/');
      expect(updatedGlobalPrefixes.shad).toBe('http://updated-shadr.us/ontology/');
    });

    it('should maintain common prefixes when updating', () => {
      const rdfService = new RdfToolsService(mockApp, mockPlugin, baseSettings, mockLogger);

      const updatedSettings: RdfToolsSettings = {
        ...baseSettings,
        globalPrefixes: {
          shad: 'http://shadr.us/ontology/',
          // Only include shad, not common prefixes
        },
      };

      rdfService.updateGlobalPrefixes(updatedSettings);

      const globalPrefixes = rdfService.getPrefixService().getGlobalPrefixes();

      // Should still have common prefixes
      expect(globalPrefixes.rdf).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
      expect(globalPrefixes.foaf).toBe('http://xmlns.com/foaf/0.1/');

      // Should have the user prefix
      expect(globalPrefixes.shad).toBe('http://shadr.us/ontology/');
    });

    it('should remove prefixes that are no longer in settings', () => {
      const rdfService = new RdfToolsService(mockApp, mockPlugin, baseSettings, mockLogger);

      // Verify initial state has custom prefix
      expect(rdfService.getPrefixService().getGlobalPrefixes().custom).toBe('http://custom.example.org/');

      const updatedSettings: RdfToolsSettings = {
        ...baseSettings,
        globalPrefixes: {
          // Remove custom prefix, keep only shad
          shad: 'http://shadr.us/ontology/',
        },
      };

      rdfService.updateGlobalPrefixes(updatedSettings);

      const globalPrefixes = rdfService.getPrefixService().getGlobalPrefixes();

      // custom prefix should be removed
      expect(globalPrefixes.custom).toBeUndefined();
      // shad should still be there
      expect(globalPrefixes.shad).toBe('http://shadr.us/ontology/');
      // common prefixes should still be there
      expect(globalPrefixes.rdf).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
    });

    it('should log debug information when updating prefixes', () => {
      const rdfService = new RdfToolsService(mockApp, mockPlugin, baseSettings, mockLogger);

      const updatedSettings: RdfToolsSettings = {
        ...baseSettings,
        globalPrefixes: {
          shad: 'http://shadr.us/ontology/',
        },
      };

      rdfService.updateGlobalPrefixes(updatedSettings);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Updated global prefixes from settings:',
        expect.objectContaining({
          shad: 'http://shadr.us/ontology/',
          rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        })
      );
    });
  });

  describe('prefix expansion in context', () => {
    it('should expand user-defined prefixes correctly', () => {
      const rdfService = new RdfToolsService(mockApp, mockPlugin, baseSettings, mockLogger);
      const prefixService = rdfService.getPrefixService();

      // Create a context with the global prefixes
      const context = prefixService.createPrefixContext();

      // Test expansion of user-defined prefix
      const shadResult = prefixService.expandCurie('shad:Person', context);
      expect(shadResult.success).toBe(true);
      expect(shadResult.resolvedUri).toBe('http://shadr.us/ontology/Person');
      expect(shadResult.usedPrefix).toBe('shad');

      // Test expansion of common prefix still works
      const foafResult = prefixService.expandCurie('foaf:Person', context);
      expect(foafResult.success).toBe(true);
      expect(foafResult.resolvedUri).toBe('http://xmlns.com/foaf/0.1/Person');
      expect(foafResult.usedPrefix).toBe('foaf');
    });

    it('should handle precedence correctly with global prefixes', () => {
      const rdfService = new RdfToolsService(mockApp, mockPlugin, baseSettings, mockLogger);
      const prefixService = rdfService.getPrefixService();

      // Create context with local prefixes that override global
      const context = prefixService.createPrefixContext(
        { shad: 'http://local-shadr.us/' }, // Local override
        { foaf: 'http://query-foaf.org/' }  // Query override
      );

      const mergedPrefixes = prefixService.getMergedPrefixes(context);

      // Global prefix should be overridden by local
      expect(mergedPrefixes.shad).toBe('http://local-shadr.us/');
      // Global prefix should be overridden by query
      expect(mergedPrefixes.foaf).toBe('http://query-foaf.org/');
      // Other global prefixes should remain
      expect(mergedPrefixes.rdf).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
    });
  });

  describe('integration with deprecated getCommonPrefixes', () => {
    it('should include all prefixes from getCommonPrefixes', () => {
      const rdfService = new RdfToolsService(mockApp, mockPlugin, baseSettings, mockLogger);
      const prefixService = rdfService.getPrefixService();
      const globalPrefixes = prefixService.getGlobalPrefixes();

      const commonPrefixes = PrefixService.getCommonPrefixes();

      // All common prefixes should be present in global prefixes
      for (const [prefix, uri] of Object.entries(commonPrefixes)) {
        expect(globalPrefixes[prefix]).toBeDefined();
        // If not overridden by settings, should match common prefixes
        if (!baseSettings.globalPrefixes[prefix]) {
          expect(globalPrefixes[prefix]).toBe(uri);
        }
      }
    });
  });
});