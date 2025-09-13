import { TFile } from 'obsidian';
import { SparqlQuery } from '../models/SparqlQuery';
import { GraphService } from './GraphService';

/**
 * Information about a tracked SPARQL query
 */
export interface SparqlQueryInfo {
  /** Unique identifier for this query instance */
  id: string;
  /** The SPARQL query object */
  query: SparqlQuery;
  /** DOM container where results are displayed */
  container: HTMLElement;
  /** File containing this query */
  file: TFile;
  /** Graph URIs this query depends on (resolved from FROM clauses) */
  dependentGraphs: string[];
  /** When this query was last executed */
  lastExecuted: Date;
  /** Whether this query is currently being executed */
  isExecuting: boolean;
}

/**
 * Service for tracking SPARQL queries and their dependencies across all open files
 * Enables live updates when turtle content changes
 */
export class SparqlQueryTracker {
  /** Map of file path to queries in that file */
  private queriesByFile = new Map<string, SparqlQueryInfo[]>();

  /** Map of graph URI to queries that depend on it */
  private queriesByGraph = new Map<string, Set<string>>();

  /** Map of query ID to query info for fast lookup */
  private queryById = new Map<string, SparqlQueryInfo>();

  constructor(private graphService: GraphService) {}

  /**
   * Register a new SPARQL query for tracking
   */
  registerQuery(
    query: SparqlQuery,
    container: HTMLElement,
    file: TFile
  ): string {
    const queryId = this.generateQueryId(query, file);

    // Analyze dependencies
    const dependentGraphs = this.analyzeDependencies(query);

    const queryInfo: SparqlQueryInfo = {
      id: queryId,
      query,
      container,
      file,
      dependentGraphs,
      lastExecuted: new Date(),
      isExecuting: false,
    };

    // Store in all lookup maps
    this.queryById.set(queryId, queryInfo);
    this.addToFileMap(file.path, queryInfo);
    this.addToGraphMaps(dependentGraphs, queryId);

    return queryId;
  }

  /**
   * Update an existing query (when content changes)
   */
  updateQuery(queryId: string, newQuery: SparqlQuery): boolean {
    const queryInfo = this.queryById.get(queryId);
    if (!queryInfo) {
      return false;
    }

    // Remove old graph dependencies
    this.removeFromGraphMaps(queryInfo.dependentGraphs, queryId);

    // Analyze new dependencies
    const newDependentGraphs = this.analyzeDependencies(newQuery);

    // Update query info
    queryInfo.query = newQuery;
    queryInfo.dependentGraphs = newDependentGraphs;

    // Add new graph dependencies
    this.addToGraphMaps(newDependentGraphs, queryId);

    return true;
  }

  /**
   * Unregister a query (when code block is removed or file closed)
   */
  unregisterQuery(queryId: string): boolean {
    const queryInfo = this.queryById.get(queryId);
    if (!queryInfo) {
      return false;
    }

    // Remove from all maps
    this.queryById.delete(queryId);
    this.removeFromFileMap(queryInfo.file.path, queryId);
    this.removeFromGraphMaps(queryInfo.dependentGraphs, queryId);

    return true;
  }

  /**
   * Find all queries that depend on a specific graph
   */
  findQueriesDependingOnGraph(graphUri: string): SparqlQueryInfo[] {
    const queryIds = this.queriesByGraph.get(graphUri);
    if (!queryIds) {
      return [];
    }

    const queries: SparqlQueryInfo[] = [];
    for (const queryId of queryIds) {
      const queryInfo = this.queryById.get(queryId);
      if (queryInfo) {
        queries.push(queryInfo);
      }
    }

    return queries;
  }

  /**
   * Get all queries in a specific file
   */
  getQueriesInFile(filePath: string): SparqlQueryInfo[] {
    return this.queriesByFile.get(filePath) || [];
  }

  /**
   * Get query info by ID
   */
  getQueryById(queryId: string): SparqlQueryInfo | undefined {
    return this.queryById.get(queryId);
  }

  /**
   * Mark query as executing
   */
  setQueryExecuting(queryId: string, isExecuting: boolean): void {
    const queryInfo = this.queryById.get(queryId);
    if (queryInfo) {
      queryInfo.isExecuting = isExecuting;
      if (!isExecuting) {
        queryInfo.lastExecuted = new Date();
      }
    }
  }

  /**
   * Remove all queries for a file (when file is closed)
   */
  removeAllQueriesForFile(filePath: string): void {
    const queries = this.queriesByFile.get(filePath) || [];
    for (const queryInfo of queries) {
      this.unregisterQuery(queryInfo.id);
    }
  }

  /**
   * Get all tracked queries
   */
  getAllQueries(): SparqlQueryInfo[] {
    return Array.from(this.queryById.values());
  }

  /**
   * Get stats about tracked queries
   */
  getStats(): {
    totalQueries: number;
    queriesByFile: number;
    dependencyGraphs: number;
  } {
    return {
      totalQueries: this.queryById.size,
      queriesByFile: this.queriesByFile.size,
      dependencyGraphs: this.queriesByGraph.size,
    };
  }

  /**
   * Analyze a SPARQL query to determine which graphs it depends on
   */
  private analyzeDependencies(query: SparqlQuery): string[] {
    const dependencies = new Set<string>();

    // Check explicit FROM clauses
    const fromGraphs = query.context.fromGraphs || [];
    const fromNamedGraphs = query.context.fromNamedGraphs || [];
    const allFromGraphs = [...fromGraphs, ...fromNamedGraphs];

    if (allFromGraphs.length > 0) {
      // Explicit FROM clauses - resolve each one
      for (const graphUri of allFromGraphs) {
        const resolvedGraphs = this.graphService.resolveVaultUri(graphUri);
        resolvedGraphs.forEach(resolved => dependencies.add(resolved));
      }
    } else {
      // No FROM clauses - depends on current file's graph
      const currentFileGraph = this.graphService.getGraphUriForFile(
        query.location.file.path
      );
      dependencies.add(currentFileGraph);
    }

    return Array.from(dependencies);
  }

  /**
   * Generate a unique ID for a query
   */
  private generateQueryId(query: SparqlQuery, file: TFile): string {
    const location = query.location;
    return `${file.path}:${location.startLine}-${location.endLine}:${Date.now()}`;
  }

  /**
   * Add query to file lookup map
   */
  private addToFileMap(filePath: string, queryInfo: SparqlQueryInfo): void {
    if (!this.queriesByFile.has(filePath)) {
      this.queriesByFile.set(filePath, []);
    }
    this.queriesByFile.get(filePath)!.push(queryInfo);
  }

  /**
   * Remove query from file lookup map
   */
  private removeFromFileMap(filePath: string, queryId: string): void {
    const queries = this.queriesByFile.get(filePath);
    if (queries) {
      const index = queries.findIndex(q => q.id === queryId);
      if (index >= 0) {
        queries.splice(index, 1);
        if (queries.length === 0) {
          this.queriesByFile.delete(filePath);
        }
      }
    }
  }

  /**
   * Add query to graph dependency maps
   */
  private addToGraphMaps(graphUris: string[], queryId: string): void {
    for (const graphUri of graphUris) {
      if (!this.queriesByGraph.has(graphUri)) {
        this.queriesByGraph.set(graphUri, new Set());
      }
      this.queriesByGraph.get(graphUri)!.add(queryId);
    }
  }

  /**
   * Remove query from graph dependency maps
   */
  private removeFromGraphMaps(graphUris: string[], queryId: string): void {
    for (const graphUri of graphUris) {
      const querySet = this.queriesByGraph.get(graphUri);
      if (querySet) {
        querySet.delete(queryId);
        if (querySet.size === 0) {
          this.queriesByGraph.delete(graphUri);
        }
      }
    }
  }
}
