import { BlockLocation } from './TurtleBlock';
import { SparqlQuery as ParsedSparqlQuery } from 'sparqljs';

/**
 * Execution status of a SPARQL query
 */
export type QueryExecutionStatus =
  | 'pending'
  | 'executing'
  | 'completed'
  | 'error'
  | 'timeout'
  | 'cancelled';

/**
 * Context in which a SPARQL query executes
 */
export interface QueryContext {
  /** Base URI for resolving relative references */
  baseUri: string;

  /** Prefixes available to this query (global + local) */
  prefixes: Record<string, string>;

  /** Named graphs explicitly referenced in FROM clauses (extracted by sparqljs) */
  fromGraphs: string[];

  /** Named graphs explicitly referenced in FROM NAMED clauses (extracted by sparqljs) */
  fromNamedGraphs: string[];

  /** Default graph URIs (if no FROM clause specified) */
  defaultGraphs: string[];

  /** Maximum execution time in milliseconds */
  timeoutMs: number;

  /** Maximum number of results to return */
  maxResults: number;
}

/**
 * Information about query dependencies for live updates
 */
export interface QueryDependencies {
  /** Graph URIs that this query depends on */
  dependsOnGraphs: Set<string>;

  /** File paths that this query depends on */
  dependsOnFiles: Set<string>;

  /** Directory paths that this query depends on (for directory graphs) */
  dependsOnDirectories: Set<string>;

  /** Whether this query depends on the entire vault */
  dependsOnVault: boolean;

  /** When dependencies were last analyzed */
  lastAnalyzed: Date;
}

/**
 * Performance metrics for query execution
 */
export interface QueryPerformance {
  /** Total execution time in milliseconds */
  executionTimeMs: number;

  /** Time spent parsing the query */
  parseTimeMs: number;

  /** Time spent executing the query engine */
  engineTimeMs: number;

  /** Time spent formatting results */
  formatTimeMs: number;

  /** Number of intermediate results generated */
  intermediateResults: number;
}

/**
 * Execution metadata and history for a query
 */
export interface QueryExecutionMetadata {
  /** Current execution status */
  status: QueryExecutionStatus;

  /** Number of times this query has been executed */
  executionCount: number;

  /** When this query was last executed */
  lastExecuted?: Date;

  /** Performance metrics from the last execution */
  lastPerformance?: QueryPerformance;

  /** Average execution time over all runs */
  averageExecutionTimeMs: number;

  /** Whether results are currently cached */
  isCached: boolean;

  /** When cached results expire */
  cacheExpiresAt?: Date;

  /** Hash of query + context for cache invalidation */
  cacheKey: string;
}

/**
 * A SPARQL query code block with execution context and metadata
 *
 * Uses sparqljs for parsing and Comunica for execution
 */
export interface SparqlQuery {
  /** Unique identifier for this query */
  readonly id: string;

  /** Location of this query block in the source file */
  readonly location: BlockLocation;

  /** The raw SPARQL query string */
  readonly queryString: string;

  /** The expanded query string with injected PREFIX declarations (used for execution) */
  readonly expandedQueryString?: string;

  /** Parsed query object from sparqljs (if successfully parsed) */
  readonly parsedQuery?: ParsedSparqlQuery;

  /** Any parsing error from sparqljs */
  readonly parseError?: string;

  /** Execution context for this query */
  readonly context: QueryContext;

  /** Dependencies for live update tracking */
  readonly dependencies: QueryDependencies;

  /** Execution metadata and performance tracking */
  readonly executionMetadata: QueryExecutionMetadata;

  /** Any errors from the last execution attempt */
  readonly lastError?: string;

  /** When this query was created */
  readonly createdAt: Date;

  /** When this query was last modified */
  readonly lastModified: Date;

  /** Hash of query content for change detection */
  readonly contentHash: string;

  /** Human-readable name or description */
  readonly displayName?: string;

  /** Tags or categories for organization */
  readonly tags: string[];
}

/**
 * Mutable version for internal updates
 */
export interface MutableSparqlQuery
  extends Omit<
    SparqlQuery,
    | 'parsedQuery'
    | 'parseError'
    | 'expandedQueryString'
    | 'context'
    | 'dependencies'
    | 'executionMetadata'
    | 'lastError'
    | 'lastModified'
    | 'contentHash'
  > {
  parsedQuery?: ParsedSparqlQuery;
  parseError?: string;
  expandedQueryString?: string;
  context: QueryContext;
  dependencies: QueryDependencies;
  executionMetadata: QueryExecutionMetadata;
  lastError?: string;
  lastModified: Date;
  contentHash: string;
}

/**
 * Options for creating a new SPARQL query
 */
export interface CreateSparqlQueryOptions {
  /** Location information for the query block */
  location: BlockLocation;

  /** The SPARQL query string */
  queryString: string;

  /** Base URI for the query context */
  baseUri?: string;

  /** Available prefixes */
  prefixes?: Record<string, string>;

  /** Query execution options */
  timeoutMs?: number;
  maxResults?: number;

  /** Human-readable name */
  displayName?: string;

  /** Tags for organization */
  tags?: string[];
}

/**
 * Factory functions for SPARQL queries
 */
export class SparqlQueryFactory {
  /**
   * Generate a unique ID for a SPARQL query
   */
  static generateQueryId(_location: BlockLocation): string {
    // Use random ID to ensure uniqueness, especially for multiple queries on same page
    return `sparql-query:${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a content hash for change detection
   */
  static createContentHash(queryString: string, context: QueryContext): string {
    const combined =
      queryString + JSON.stringify(context.prefixes) + context.baseUri;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Create initial query context
   */
  static createInitialContext(options: CreateSparqlQueryOptions): QueryContext {
    return {
      baseUri:
        options.baseUri ||
        `vault://${options.location.file.path.replace(/^\/+/, '')}/`,
      prefixes: options.prefixes || {},
      fromGraphs: [],
      fromNamedGraphs: [],
      defaultGraphs: [],
      timeoutMs: options.timeoutMs || 30000,
      maxResults: options.maxResults || 1000,
    };
  }

  /**
   * Create initial dependencies
   */
  static createInitialDependencies(): QueryDependencies {
    return {
      dependsOnGraphs: new Set(),
      dependsOnFiles: new Set(),
      dependsOnDirectories: new Set(),
      dependsOnVault: false,
      lastAnalyzed: new Date(),
    };
  }

  /**
   * Create initial execution metadata
   */
  static createInitialExecutionMetadata(
    queryString: string,
    context: QueryContext
  ): QueryExecutionMetadata {
    return {
      status: 'pending',
      executionCount: 0,
      averageExecutionTimeMs: 0,
      isCached: false,
      cacheKey: SparqlQueryFactory.createContentHash(queryString, context),
    };
  }

  /**
   * Create a new SPARQL query (parsing will be done later by services)
   */
  static createSparqlQuery(
    options: CreateSparqlQueryOptions
  ): MutableSparqlQuery {
    const id = SparqlQueryFactory.generateQueryId(options.location);
    const context = SparqlQueryFactory.createInitialContext(options);
    const dependencies = SparqlQueryFactory.createInitialDependencies();
    const executionMetadata = SparqlQueryFactory.createInitialExecutionMetadata(
      options.queryString,
      context
    );
    const contentHash = SparqlQueryFactory.createContentHash(
      options.queryString,
      context
    );
    const now = new Date();

    return {
      id,
      location: options.location,
      queryString: options.queryString,
      context,
      dependencies,
      executionMetadata,
      createdAt: now,
      lastModified: now,
      contentHash,
      displayName: options.displayName,
      tags: options.tags || [],
    };
  }
}

/**
 * Utility functions for SPARQL queries
 */
export class SparqlQueryUtils {
  /**
   * Extract query type from sparqljs parsed query object
   * Handles both queryType and type properties from different versions
   */
  static extractQueryType(parsedQuery: ParsedSparqlQuery): string {
    const queryWithType = parsedQuery as unknown as {
      queryType?: string;
      type?: string;
    };
    return queryWithType.queryType || parsedQuery.type || 'UNKNOWN';
  }
}
