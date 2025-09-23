import { Store, Parser } from 'n3';
import { TFile, App } from 'obsidian';
import { Graph } from '../models/Graph';
import { MarkdownGraphParser } from './MarkdownGraphParser';
import { PrefixService } from './PrefixService';

/**
 * Simplified service for managing RDF graphs with embedded stores
 */
export class GraphService {
  private cache = new Map<string, Graph>();

  constructor(
    private app: App,
    private prefixService: PrefixService
  ) {}

  /**
   * Get graphs for the provided URIs, loading them lazily if needed
   */
  async getGraphs(graphUris: string[]): Promise<Graph[]> {
    const graphs: Graph[] = [];
    const loadingErrors: string[] = [];

    for (const graphUri of graphUris) {
      try {
        // Check cache first
        let graph = this.cache.get(graphUri);

        if (!graph) {
          // Load lazily if not cached
          const loadedGraph = await this.loadGraph(graphUri);
          if (loadedGraph) {
            this.cache.set(graphUri, loadedGraph);
            graph = loadedGraph;
          }
        }

        if (graph) {
          graphs.push(graph);
        } else {
          loadingErrors.push(`Graph not found or failed to load: ${graphUri}`);
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        loadingErrors.push(`Error loading graph ${graphUri}: ${errorMsg}`);
      }
    }

    // If no graphs were loaded successfully, throw an error
    if (graphs.length === 0 && graphUris.length > 0) {
      throw new Error(
        `Failed to load any graphs. Errors: ${loadingErrors.join('; ')}`
      );
    }

    // If some graphs failed to load, log warnings but continue
    if (loadingErrors.length > 0) {
      console.warn('Some graphs failed to load:', loadingErrors);
    }

    return graphs;
  }

  /**
   * Invalidate cached graph when file changes
   */
  invalidateGraph(graphUri: string): void {
    this.cache.delete(graphUri);
  }

  /**
   * Get graph URI from file path
   */
  getGraphUriForFile(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return `vault://${normalizedPath}`;
  }

  /**
   * Resolve vault:// URIs to specific graph URIs
   */
  resolveVaultUri(vaultUri: string): string[] {
    if (!vaultUri.startsWith('vault://')) {
      return [vaultUri];
    }

    const path = vaultUri.replace('vault://', '');

    if (path === '') {
      // vault:// - all files in the vault
      return this.getAllVaultFileGraphUris();
    }

    if (path.endsWith('/')) {
      // vault://directory/ - all files in directory (recursively)
      const dirPath = path.slice(0, -1);
      return this.getDirectoryGraphUris(dirPath);
    }

    // vault://specific/file.md - specific graph
    return [vaultUri];
  }

  /**
   * Get all graph URIs for files in the vault
   */
  private getAllVaultFileGraphUris(): string[] {
    const graphUris: string[] = [];
    const allFiles = this.app.vault.getMarkdownFiles();

    for (const file of allFiles) {
      const graphUri = this.getGraphUriForFile(file.path);
      graphUris.push(graphUri);
    }

    // Also include .ttl files
    const allTtlFiles = this.app.vault
      .getFiles()
      .filter(f => f.extension === 'ttl');
    for (const file of allTtlFiles) {
      const graphUri = this.getGraphUriForFile(file.path);
      graphUris.push(graphUri);
    }

    return graphUris;
  }

  /**
   * Get graph URIs for all files in a directory (recursively)
   */
  private getDirectoryGraphUris(dirPath: string): string[] {
    const graphUris: string[] = [];

    // Get all markdown files in the directory
    const allFiles = this.app.vault.getMarkdownFiles();
    for (const file of allFiles) {
      if (file.path.startsWith(dirPath + '/') || file.path === dirPath) {
        const graphUri = this.getGraphUriForFile(file.path);
        graphUris.push(graphUri);
      }
    }

    // Also include .ttl files in the directory
    const allTtlFiles = this.app.vault
      .getFiles()
      .filter(f => f.extension === 'ttl');
    for (const file of allTtlFiles) {
      if (file.path.startsWith(dirPath + '/') || file.path === dirPath) {
        const graphUri = this.getGraphUriForFile(file.path);
        graphUris.push(graphUri);
      }
    }

    return graphUris;
  }

  /**
   * Load a single graph from file
   */
  private async loadGraph(graphUri: string): Promise<Graph | null> {
    try {
      const filePath = this.extractFilePathFromGraphUri(graphUri);
      if (!filePath) {
        console.error(`Cannot extract file path from graph URI: ${graphUri}`);
        return null;
      }

      const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
      if (!file) {
        console.error(`File not found: ${filePath}`);
        return null;
      }

      const content = await this.app.vault.read(file);
      const baseUri = this.generateBaseUri(filePath);

      const store = new Store();
      let tripleCount = 0;

      if (filePath.endsWith('.ttl')) {
        // Parse pure turtle file using N3 Parser
        const parser = new Parser({
          baseIRI: baseUri,
          blankNodePrefix: '_:b',
        });

        const quads = parser.parse(content);
        if (quads.length > 0) {
          store.addQuads(quads);
          tripleCount = quads.length;
        }
      } else {
        // Parse markdown file with turtle code blocks
        const markdownParser = new MarkdownGraphParser({
          baseUri,
          prefixes: this.prefixService.getGlobalPrefixes(),
        });

        const parseResult = await markdownParser.parse(content);
        if (!parseResult.success) {
          console.error(
            `Failed to parse graph ${graphUri}:`,
            parseResult.errors
          );
          return null;
        }

        if (parseResult.quads.length > 0) {
          store.addQuads(parseResult.quads);
          tripleCount = parseResult.quads.length;
        }
      }

      return {
        uri: graphUri,
        filePath,
        store,
        lastModified: new Date(),
        tripleCount,
      };
    } catch (error) {
      console.error(`Error loading graph ${graphUri}:`, error);
      return null;
    }
  }

  /**
   * Generate base URI from file path
   */
  private generateBaseUri(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return `vault://${normalizedPath}/`;
  }

  /**
   * Extract file path from vault:// graph URI
   */
  private extractFilePathFromGraphUri(graphUri: string): string | null {
    if (!graphUri.startsWith('vault://')) {
      return null;
    }
    return graphUri.replace('vault://', '');
  }
}
