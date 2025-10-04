/**
 * Test that reproduces the user's exact SPARQL prefix bug and verifies the fix
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

describe('User Bug Fix - SPARQL Prefix Integration', () => {
  let mockApp: any;
  let mockLogger: Logger;

  beforeEach(() => {
    mockApp = {
      vault: { on: vi.fn() },
      workspace: {},
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;
  });

  describe('Reproducing the exact user bug', () => {
    it('SHOULD FAIL: User has shad: in settings but gets "Unknown prefix: shad" error', async () => {
      // This test reproduces the user's exact scenario and should initially FAIL
      // Then we'll fix it to make it PASS

      // User's actual settings (from their screenshot)
      const userSettings: RdfToolsSettings = {
        ...DEFAULT_RDF_SETTINGS,
        globalPrefixes: {
          ...DEFAULT_RDF_SETTINGS.globalPrefixes,
          shad: 'https://shadr.us/ns/', // User's custom prefix
          ex: 'https://example.org/',   // Their example prefix
        },
      };

      // Create the service exactly as the plugin does
      const plugin = { app: mockApp } as any;
      const rdfService = new RdfToolsService(mockApp, plugin, userSettings, mockLogger);
      const sparqlParser = rdfService.getSparqlParserService();

      // User's exact SPARQL query from their test
      const userQuery = `
        PREFIX ex: <https://example.org/>
        SELECT ?skill WHERE {
            shad:alice ex:skill ?skill .
        }
      `;

      // Parse the query
      const result = await sparqlParser.parseSparqlContent(userQuery);

      // Debug: Show what's happening
      console.log('🔍 Debug - User Settings Global Prefixes:', userSettings.globalPrefixes);
      console.log('🔍 Debug - RdfToolsService PrefixService Global Prefixes:', rdfService.getPrefixService().getGlobalPrefixes());
      console.log('🔍 Debug - SPARQL Parse Result:', {
        success: result.success,
        prefixes: result.prefixes,
        error: result.error?.message,
      });

      // THIS IS THE CRITICAL TEST:
      // If this FAILS with "Unknown prefix: shad", we've reproduced the user's bug
      // If this PASSES, the bug is already fixed by our previous work
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.prefixes).toEqual(
          expect.objectContaining({
            shad: 'https://shadr.us/ns/',
            ex: 'https://example.org/',
          })
        );
        console.log('✅ SUCCESS: shad: prefix is working correctly!');
      } else {
        console.log('❌ FAILURE: shad: prefix not found - bug reproduced!');
        console.log('Error message:', result.error?.message);

        // If it fails, the error should mention the unknown prefix
        expect(result.error?.message).toContain('shad');
      }
    });

    it('should verify the fix works across plugin lifecycle', async () => {
      // Test the complete plugin lifecycle to ensure prefixes work at every stage

      // 1. Simulate plugin loading with user's settings
      const userSettings = {
        ...DEFAULT_RDF_SETTINGS,
        globalPrefixes: {
          ...DEFAULT_RDF_SETTINGS.globalPrefixes,
          shad: 'https://shadr.us/ns/',
        },
      };

      const plugin = new RdfToolsPlugin() as any;
      plugin.app = mockApp;
      plugin.loadData = vi.fn().mockResolvedValue(userSettings);
      plugin.saveData = vi.fn();
      plugin.loadSettings = async function() {
        this.settings = Object.assign({}, DEFAULT_RDF_SETTINGS, await this.loadData());
      };
      plugin.saveSettings = async function() {
        await this.saveData(this.settings);
        if (this.rdfService) {
          this.rdfService.updateGlobalPrefixes(this.settings);
        }
      };

      // 2. Load settings (like plugin onload does)
      await plugin.loadSettings();

      // 3. Create RdfToolsService (like plugin onload does)
      const rdfService = new RdfToolsService(mockApp, plugin, plugin.settings, mockLogger);
      plugin.rdfService = rdfService;

      // 4. Test SPARQL query works
      const sparqlParser = rdfService.getSparqlParserService();
      let result = await sparqlParser.parseSparqlContent(`
        SELECT ?x WHERE { shad:alice ?p ?x . }
      `);

      expect(result.success).toBe(true);
      expect(result.prefixes?.shad).toBe('https://shadr.us/ns/');

      // 5. Simulate user updating settings through UI
      plugin.settings.globalPrefixes.newPrefix = 'http://new.example.org/';
      await plugin.saveSettings();

      // 6. Test that updated prefixes work
      result = await sparqlParser.parseSparqlContent(`
        SELECT ?x WHERE {
          shad:alice ?p ?x ;
                     newPrefix:property ?value .
        }
      `);

      expect(result.success).toBe(true);
      expect(result.prefixes?.shad).toBe('https://shadr.us/ns/');
      expect(result.prefixes?.newPrefix).toBe('http://new.example.org/');
    });
  });

  describe('Robust prefix handling', () => {
    it('should ensure prefixes are always available even with timing issues', async () => {
      // Test edge cases where timing might cause issues

      // 1. Test with delayed settings loading
      const delayedSettings = new Promise<RdfToolsSettings>(resolve => {
        setTimeout(() => resolve({
          ...DEFAULT_RDF_SETTINGS,
          globalPrefixes: {
            ...DEFAULT_RDF_SETTINGS.globalPrefixes,
            shad: 'https://shadr.us/ns/',
          },
        }), 10);
      });

      const settings = await delayedSettings;
      const rdfService = new RdfToolsService(mockApp, mockApp, settings, mockLogger);
      const sparqlParser = rdfService.getSparqlParserService();

      const result = await sparqlParser.parseSparqlContent(`
        SELECT ?x WHERE { shad:alice ?p ?x . }
      `);

      expect(result.success).toBe(true);
      expect(result.prefixes?.shad).toBe('https://shadr.us/ns/');
    });

    it('should handle corrupted or missing settings gracefully', async () => {
      // Test with incomplete settings that might cause issues

      const incompleteSettings = {
        // Missing some fields that might cause issues
        globalPrefixes: {
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

      const rdfService = new RdfToolsService(mockApp, mockApp, incompleteSettings, mockLogger);
      const sparqlParser = rdfService.getSparqlParserService();

      const result = await sparqlParser.parseSparqlContent(`
        SELECT ?x WHERE {
          shad:alice ?p ?x ;
                     rdf:type ?type .
        }
      `);

      expect(result.success).toBe(true);
      expect(result.prefixes?.shad).toBe('https://shadr.us/ns/');
      expect(result.prefixes?.rdf).toBe('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
    });
  });
});