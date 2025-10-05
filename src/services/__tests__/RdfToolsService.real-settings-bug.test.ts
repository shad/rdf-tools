/**
 * Integration test that reproduces the user's exact SPARQL prefix bug
 * User has shad: configured in settings but gets "Unknown prefix: shad" in SPARQL queries
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RdfToolsService } from '@/services/RdfToolsService';
import { RdfToolsPlugin } from '@/RdfToolsPlugin';
import type { RdfToolsSettings } from '@/models/RdfToolsSettings';
import { DEFAULT_RDF_SETTINGS } from '@/models/RdfToolsSettings';
import { Logger } from '@/utils/Logger';

// Mock Obsidian dependencies
vi.mock('obsidian', () => ({
  Component: class {},
  Plugin: class {
    loadData = vi.fn();
    saveData = vi.fn();
    addChild = vi.fn();
    addSettingTab = vi.fn();
    addCommand = vi.fn();
    registerEvent = vi.fn();
  },
  PluginSettingTab: class {},
  Modal: class {},
  TFile: class {},
  TAbstractFile: class {},
  TFolder: class {},
  Notice: class {},
}));

// Mock other services
vi.mock('@/services/CodeBlockExtractorService');
vi.mock('@/services/GraphService');
vi.mock('@/services/QueryExecutorService');
vi.mock('@/services/SparqlQueryTracker');
vi.mock('@/ui/SparqlBlockProcessor');
vi.mock('@/services/MarkdownErrorReporter');

describe('RdfToolsService - Real Settings Bug Reproduction', () => {
  let mockApp: any;
  let mockPlugin: any;
  let mockLogger: Logger;

  beforeEach(() => {
    mockApp = {
      vault: {
        on: vi.fn(),
      },
      workspace: {},
    };

    mockPlugin = {
      app: mockApp,
      loadData: vi.fn(),
      saveData: vi.fn(),
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;
  });

  describe('reproducing the exact user scenario', () => {
    it('SHOULD FAIL: simulate the actual bug where shad: prefix is not available despite being in settings', async () => {
      // This test simulates what might be happening in the real environment
      // where the user's settings aren't being properly loaded/applied

      // Simulate the scenario where the plugin loads with default settings only
      // (not the user's custom settings with shad:)
      const rdfService = new RdfToolsService(mockApp, mockPlugin, DEFAULT_RDF_SETTINGS, mockLogger);
      const sparqlParser = rdfService.getSparqlParserService();

      // Test the user's exact SPARQL query
      const usersSparqlQuery = `
        PREFIX ex: <https://example.org/>
        SELECT ?skill WHERE {
            shad:alice ex:skill ?skill .
        }
      `;

      const result = await sparqlParser.parseSparqlContent(usersSparqlQuery);

      console.log('Default settings test - SPARQL Parse Result:', {
        success: result.success,
        prefixes: result.prefixes,
        error: result.error
      });

      // This SHOULD fail, proving the bug exists when settings aren't loaded
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('shad');
    });
    it('should reproduce bug: shad: prefix configured in settings but not available in SPARQL', async () => {
      // Simulate the user's actual settings data that would be saved to Obsidian storage
      const usersSavedSettings = {
        globalPrefixes: {
          // Default prefixes (these work)
          rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
          rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
          owl: 'http://www.w3.org/2002/07/owl#',
          xsd: 'http://www.w3.org/2001/XMLSchema#',
          foaf: 'http://xmlns.com/foaf/0.1/',
          dc: 'http://purl.org/dc/elements/1.1/',
          dcterms: 'http://purl.org/dc/terms/',
          // User's custom prefix (this should work but doesn't)
          shad: 'https://shadr.us/ns/',
          ex: 'https://example.org/',
        },
        // Other settings from defaults
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

      // Mock the plugin like it would be in real usage
      const plugin = new RdfToolsPlugin() as any;
      plugin.loadData = vi.fn().mockResolvedValue(usersSavedSettings);
      plugin.saveData = vi.fn().mockResolvedValue(undefined);
      plugin.app = mockApp;

      // Add the missing methods
      plugin.loadSettings = async function() {
        this.settings = Object.assign({}, DEFAULT_RDF_SETTINGS, await this.loadData());
      };
      plugin.saveSettings = async function() {
        await this.saveData(this.settings);
        if (this.rdfService) {
          this.rdfService.updateGlobalPrefixes(this.settings);
        }
      };

      // Simulate the real plugin initialization sequence
      plugin.settings = DEFAULT_RDF_SETTINGS; // Initial default settings

      // This is what happens in RdfToolsPlugin.loadSettings()
      await plugin.loadSettings();

      // Verify settings were loaded correctly
      expect(plugin.settings.globalPrefixes.shad).toBe('https://shadr.us/ns/');
      expect(plugin.settings.globalPrefixes.foaf).toBe('http://xmlns.com/foaf/0.1/');

      // Create RdfToolsService like the plugin does
      const rdfService = new RdfToolsService(mockApp, plugin, plugin.settings, mockLogger);
      const sparqlParser = rdfService.getSparqlParserService();

      // Test the exact SPARQL query from the user's scenario
      const usersSparqlQuery = `
        PREFIX ex: <https://example.org/>
        SELECT ?skill WHERE {
            shad:alice ex:skill ?skill .
        }
      `;

      // Debug: Check what prefixes are actually available
      const prefixService = rdfService.getPrefixService();
      const globalPrefixes = prefixService.getGlobalPrefixes();
      console.log('Available global prefixes:', globalPrefixes);
      console.log('shad: prefix available?', globalPrefixes.shad);

      // This should succeed since shad: is in the settings, but currently fails
      const result = await sparqlParser.parseSparqlContent(usersSparqlQuery);

      console.log('SPARQL Parse Result:', {
        success: result.success,
        prefixes: result.prefixes,
        error: result.error
      });

      // ASSERTION: This should pass but likely fails, proving the bug
      expect(result.success).toBe(true);

      if (!result.success) {
        // If it fails, log the error to understand what's happening
        console.log('SPARQL Parse Error (this proves the bug):', result.error);

        // The error should mention unknown prefix
        expect(result.error?.message).toContain('shad');
      }

      // If it succeeds, verify the prefix was properly injected
      if (result.success) {
        expect(result.prefixes).toEqual(
          expect.objectContaining({
            shad: 'https://shadr.us/ns/',
            ex: 'https://example.org/',
          })
        );
      }
    });

    it('should work with default prefixes like foaf: (proving partial functionality)', async () => {
      // Same setup as above
      const usersSavedSettings = {
        globalPrefixes: {
          rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
          rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
          foaf: 'http://xmlns.com/foaf/0.1/',
          shad: 'https://shadr.us/ns/',
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

      const plugin = new RdfToolsPlugin() as any;
      plugin.loadData = vi.fn().mockResolvedValue(usersSavedSettings);
      plugin.saveData = vi.fn().mockResolvedValue(undefined);
      plugin.app = mockApp;
      plugin.loadSettings = async function() {
        this.settings = Object.assign({}, DEFAULT_RDF_SETTINGS, await this.loadData());
      };
      plugin.saveSettings = async function() {
        await this.saveData(this.settings);
        if (this.rdfService) {
          this.rdfService.updateGlobalPrefixes(this.settings);
        }
      };
      plugin.settings = DEFAULT_RDF_SETTINGS;

      await plugin.loadSettings();

      const rdfService = new RdfToolsService(mockApp, plugin, plugin.settings, mockLogger);
      const sparqlParser = rdfService.getSparqlParserService();

      // Test with foaf: prefix (this should work)
      const foafQuery = `
        SELECT ?person ?name WHERE {
            ?person a foaf:Person ;
                    foaf:name ?name .
        }
      `;

      const result = await sparqlParser.parseSparqlContent(foafQuery);

      // This should succeed (foaf: is in default prefixes)
      expect(result.success).toBe(true);
      expect(result.prefixes?.foaf).toBe('http://xmlns.com/foaf/0.1/');
    });

    it('should simulate settings update during runtime', async () => {
      // Simulate the scenario where user adds shad: prefix through settings UI
      const initialSettings = { ...DEFAULT_RDF_SETTINGS };

      const plugin = new RdfToolsPlugin() as any;
      plugin.loadData = vi.fn().mockResolvedValue(initialSettings);
      plugin.saveData = vi.fn().mockResolvedValue(undefined);
      plugin.app = mockApp;
      plugin.loadSettings = async function() {
        this.settings = Object.assign({}, DEFAULT_RDF_SETTINGS, await this.loadData());
      };
      plugin.saveSettings = async function() {
        await this.saveData(this.settings);
        if (this.rdfService) {
          this.rdfService.updateGlobalPrefixes(this.settings);
        }
      };
      plugin.settings = initialSettings;

      await plugin.loadSettings();

      const rdfService = new RdfToolsService(mockApp, plugin, plugin.settings, mockLogger);
      plugin.rdfService = rdfService; // So saveSettings can call updateGlobalPrefixes
      const sparqlParser = rdfService.getSparqlParserService();

      // Initially, shad: should not work
      let result = await sparqlParser.parseSparqlContent(`
        SELECT ?x WHERE { shad:alice ?p ?x . }
      `);

      // This should fail initially
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('shad');

      // Now simulate user adding shad: prefix through settings UI
      const updatedSettings: RdfToolsSettings = {
        ...plugin.settings,
        globalPrefixes: {
          ...plugin.settings.globalPrefixes,
          shad: 'https://shadr.us/ns/',
        },
      };

      // Simulate saving settings (what the UI does)
      plugin.settings = updatedSettings;
      await plugin.saveSettings();

      // Now shad: should work
      result = await sparqlParser.parseSparqlContent(`
        SELECT ?x WHERE { shad:alice ?p ?x . }
      `);

      // This should succeed after settings update
      expect(result.success).toBe(true);
      expect(result.prefixes?.shad).toBe('https://shadr.us/ns/');
    });
  });

  describe('debugging the settings flow', () => {
    it('should verify that RdfToolsService receives the correct settings', () => {
      const settingsWithShad: RdfToolsSettings = {
        ...DEFAULT_RDF_SETTINGS,
        globalPrefixes: {
          ...DEFAULT_RDF_SETTINGS.globalPrefixes,
          shad: 'https://shadr.us/ns/',
        },
      };

      const rdfService = new RdfToolsService(mockApp, mockPlugin, settingsWithShad, mockLogger);
      const prefixService = rdfService.getPrefixService();
      const globalPrefixes = prefixService.getGlobalPrefixes();

      // This should pass - RdfToolsService should have the shad: prefix
      expect(globalPrefixes.shad).toBe('https://shadr.us/ns/');
      expect(globalPrefixes.foaf).toBe('http://xmlns.com/foaf/0.1/'); // From defaults
    });

    it('should verify SparqlParserService receives prefixes from RdfToolsService', () => {
      const settingsWithShad: RdfToolsSettings = {
        ...DEFAULT_RDF_SETTINGS,
        globalPrefixes: {
          ...DEFAULT_RDF_SETTINGS.globalPrefixes,
          shad: 'https://shadr.us/ns/',
        },
      };

      const rdfService = new RdfToolsService(mockApp, mockPlugin, settingsWithShad, mockLogger);

      // Get the prefix service that the SPARQL parser is using
      const prefixService = rdfService.getPrefixService();
      const globalPrefixes = prefixService.getGlobalPrefixes();

      // This should pass - the same PrefixService should be shared
      expect(globalPrefixes.shad).toBe('https://shadr.us/ns/');
    });
  });
});