import { Store, Parser } from 'n3';
import { App } from 'obsidian';
import { Graph } from '../models/Graph';
import { MarkdownGraphParser } from './MarkdownGraphParser';
import { PrefixService } from './PrefixService';
import { Logger } from '@/utils/Logger';
import { safeTFileFromPath } from '../models/TypeGuards';

/**
 * Stateless service for generating vault content-based RDF graphs (vault:// URIs)
 * Handles markdown files with turtle code blocks and .ttl files
 */
export class VaultGraphService {
  constructor(
    private app: App,
    private prefixService: PrefixService,
    private logger: Logger
  ) {}

  /**
   * Get graph URI from file path
   */
  getGraphUriForFile(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
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
   * Load a single vault content graph from file (called by GraphService)
   */
  async loadGraph(graphUri: string): Promise<Graph | null> {
    try {
      const filePath = this.extractFilePathFromGraphUri(graphUri);
      if (!filePath) {
        this.logger.error(
          `Cannot extract file path from graph URI: ${graphUri}`
        );
        return null;
      }

      const file = safeTFileFromPath(this.app.vault, filePath);
      if (!file) {
        this.logger.error(`File not found or is not a file: ${filePath}`);
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
          logger: this.logger,
        });

        const parseResult = await markdownParser.parse(content);
        if (!parseResult.success) {
          this.logger.error(
            `Failed to parse vault graph ${graphUri}:`,
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
      this.logger.error(`Error loading vault graph ${graphUri}:`, error);
      return null;
    }
  }

  /**
   * Generate base URI from file path
   */
  private generateBaseUri(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
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
