import { Store, DataFactory } from 'n3';
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

    for (const graphUri of graphUris) {
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
        throw new Error(`Failed to load graph: ${graphUri}`);
      }
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
      // vault:// - all cached graphs (simplified)
      return Array.from(this.cache.keys());
    }

    if (path.endsWith('/')) {
      // vault://directory/ - all graphs in directory
      const dirPath = path.slice(0, -1);
      return Array.from(this.cache.keys()).filter(uri => {
        const graph = this.cache.get(uri);
        return graph && graph.filePath.startsWith(dirPath);
      });
    }

    // vault://specific/file.md - specific graph
    return [vaultUri];
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

      const parser = new MarkdownGraphParser({
        baseUri,
        prefixes: this.prefixService.getGlobalPrefixes(),
      });

      const parseResult = await parser.parse(content);
      if (!parseResult.success) {
        console.error(`Failed to parse graph ${graphUri}:`, parseResult.errors);
        return null;
      }

      const store = new Store();
      if (parseResult.quads.length > 0) {
        // Add quads to the default graph
        store.addQuads(parseResult.quads);
      }

      return {
        uri: graphUri,
        filePath,
        store,
        lastModified: new Date(),
        tripleCount: parseResult.quads.length,
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
