import { TFile } from 'obsidian';
import { Store, Quad } from 'n3';

/**
 * Status of graph loading and parsing
 */
export type GraphStatus = 'loading' | 'ready' | 'error' | 'stale';

/**
 * Metadata about a graph's current state
 */
export interface GraphMetadata {
  /** Current status of the graph */
  status: GraphStatus;
  /** When this graph was last successfully parsed */
  lastParsed?: Date;
  /** When the source file was last modified */
  lastModified: Date;
  /** Hash of the turtle content for change detection */
  contentHash: string;
  /** Any parsing errors that occurred */
  parseError?: string;
  /** Time taken for last parse operation (ms) */
  parseTimeMs?: number;
}

/**
 * A named RDF graph backed by N3.js Store
 */
export interface Graph {
  /** Unique identifier for this graph (same as named graph URI) */
  readonly id: string;

  /** The named graph URI (e.g., vault://path/file.md) */
  readonly uri: string;

  /** Base URI for resolving relative references (e.g., vault://path/file.md/) */
  readonly baseUri: string;

  /** Reference to the source Obsidian file */
  readonly sourceFile: TFile;

  /** The N3.js store containing the triples */
  readonly store: Store;

  /** Metadata about parsing status and performance */
  readonly metadata: GraphMetadata;

  /** The raw turtle content that was parsed to create this graph */
  readonly turtleContent: string;

  /** When this graph was created */
  readonly createdAt: Date;
}

/**
 * Mutable graph for internal use during updates
 */
export interface MutableGraph extends Omit<Graph, 'metadata'> {
  metadata: GraphMetadata;
}

/**
 * Options for creating a new graph
 */
export interface CreateGraphOptions {
  /** The source file containing turtle data */
  sourceFile: TFile;
  /** The raw turtle content */
  turtleContent: string;
  /** Base URI for this graph (if not provided, will be generated from file path) */
  baseUri?: string;
}

/**
 * Factory functions for creating graphs
 */
export class GraphFactory {
  /**
   * Create a named graph URI from file path
   */
  static createGraphUri(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return `vault://${normalizedPath}`;
  }

  /**
   * Create a base URI from file path
   */
  static createBaseUri(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return `vault://${normalizedPath}/`;
  }

  /**
   * Create a content hash for change detection
   */
  static createContentHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Create initial metadata for a new graph
   */
  static createInitialMetadata(content: string): GraphMetadata {
    return {
      status: 'loading',
      lastModified: new Date(),
      contentHash: GraphFactory.createContentHash(content),
    };
  }

  /**
   * Create a new empty graph
   */
  static createGraph(options: CreateGraphOptions): MutableGraph {
    const uri = GraphFactory.createGraphUri(options.sourceFile.path);
    const baseUri =
      options.baseUri || GraphFactory.createBaseUri(options.sourceFile.path);
    const metadata = GraphFactory.createInitialMetadata(options.turtleContent);

    return {
      id: uri,
      uri,
      baseUri,
      sourceFile: options.sourceFile,
      store: new Store(),
      metadata,
      turtleContent: options.turtleContent,
      createdAt: new Date(),
    };
  }
}

/**
 * Utility functions for working with graphs
 */
export class GraphUtils {
  /**
   * Check if a graph needs to be updated based on content changes
   */
  static needsUpdate(graph: Graph, newContent: string): boolean {
    const newHash = GraphFactory.createContentHash(newContent);
    return graph.metadata.contentHash !== newHash;
  }

  /**
   * Check if a graph is in an error state
   */
  static hasErrors(graph: Graph): boolean {
    return graph.metadata.status === 'error' || !!graph.metadata.parseError;
  }

  /**
   * Get the number of triples in a graph
   */
  static getTripleCount(graph: Graph): number {
    return graph.store.size;
  }

  /**
   * Get a human-readable status description
   */
  static getStatusDescription(graph: Graph): string {
    switch (graph.metadata.status) {
      case 'loading':
        return 'Loading turtle data...';
      case 'ready':
        return `Ready (${GraphUtils.getTripleCount(graph)} triples)`;
      case 'error':
        return `Error: ${graph.metadata.parseError || 'Unknown error'}`;
      case 'stale':
        return 'Needs update';
      default:
        return 'Unknown status';
    }
  }

  /**
   * Get all quads from the graph store
   */
  static getAllQuads(graph: Graph): Quad[] {
    return graph.store.getQuads(null, null, null, null);
  }

  /**
   * Check if the graph contains any quads
   */
  static isEmpty(graph: Graph): boolean {
    return graph.store.size === 0;
  }

  /**
   * Create a directory graph URI that encompasses all files in a directory
   */
  static createDirectoryGraphUri(directoryPath: string): string {
    const normalizedPath = directoryPath.replace(/\\/g, '/').replace(/\/$/, '');
    return `vault://${normalizedPath}/`;
  }

  /**
   * Create the special vault-wide graph URI
   */
  static createVaultGraphUri(): string {
    return 'vault://';
  }

  /**
   * Check if a graph URI represents a directory or vault-wide graph
   */
  static isAggregateGraph(graphUri: string): boolean {
    return graphUri === 'vault://' || graphUri.endsWith('/');
  }

  /**
   * Extract all unique subjects from a graph
   */
  static getSubjects(graph: Graph): string[] {
    const subjects = new Set<string>();
    graph.store.forEach(quad => {
      subjects.add(quad.subject.value);
    });
    return Array.from(subjects);
  }

  /**
   * Extract all unique predicates from a graph
   */
  static getPredicates(graph: Graph): string[] {
    const predicates = new Set<string>();
    graph.store.forEach(quad => {
      predicates.add(quad.predicate.value);
    });
    return Array.from(predicates);
  }

  /**
   * Extract all unique objects from a graph
   */
  static getObjects(graph: Graph): string[] {
    const objects = new Set<string>();
    graph.store.forEach(quad => {
      objects.add(quad.object.value);
    });
    return Array.from(objects);
  }
}
