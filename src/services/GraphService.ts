import { App } from 'obsidian';
import { Graph } from '../models/Graph';
import { VaultGraphService } from './VaultGraphService';
import { MetaGraphService } from './MetaGraphService';
import { PrefixService } from './PrefixService';
import { Logger } from '@/utils/Logger';

/**
 * Orchestrating service that routes graph requests to appropriate specialized services
 * - vault:// URIs -> VaultGraphService (file content)
 * - meta:// URI -> MetaGraphService (file metadata)
 * - meta://ontology URI -> MetaGraphService (v1.ttl ontology)
 * Handles caching and invalidation for all graph types
 */
export class GraphService {
  private cache = new Map<string, Graph>();
  private vaultGraphService: VaultGraphService;
  private metaGraphService: MetaGraphService;

  constructor(
    private app: App,
    private prefixService: PrefixService,
    private logger: Logger
  ) {
    this.vaultGraphService = new VaultGraphService(app, prefixService, logger);
    this.metaGraphService = new MetaGraphService(app, prefixService, logger);
  }

  /**
   * Get graphs for the provided URIs, with caching and lazy loading
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
      this.logger.warn('Some graphs failed to load:', loadingErrors);
    }

    return graphs;
  }

  /**
   * Load a single graph by routing to appropriate service
   */
  private async loadGraph(graphUri: string): Promise<Graph | null> {
    if (graphUri === 'meta://') {
      return await this.metaGraphService.generateGraph();
    } else if (graphUri === 'meta://ontology') {
      return await this.metaGraphService.generateOntologyGraph();
    } else {
      return await this.vaultGraphService.loadGraph(graphUri);
    }
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
    return this.vaultGraphService.getGraphUriForFile(filePath);
  }

  /**
   * Resolve vault:// URIs to specific graph URIs
   */
  resolveVaultUri(vaultUri: string): string[] {
    if (vaultUri === 'meta://') {
      return ['meta://'];
    } else if (vaultUri === 'meta://ontology') {
      return ['meta://ontology'];
    }
    return this.vaultGraphService.resolveVaultUri(vaultUri);
  }
}
