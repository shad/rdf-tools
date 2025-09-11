import { SparqlQuery, QueryPerformance } from './SparqlQuery';
import { Bindings } from '@comunica/types';

/**
 * Supported result formats for query output
 */
export type ResultFormat =
  | 'table'
  | 'list'
  | 'count'
  | 'json'
  | 'csv'
  | 'turtle'
  | 'custom';

/**
 * Formatting options for query results
 */
export interface ResultFormattingOptions {
  /** Desired output format */
  format: ResultFormat;
  /** Maximum number of rows/results to display */
  maxDisplayRows?: number;
  /** Whether to show execution time */
  showExecutionTime: boolean;
  /** Whether to show result count */
  showResultCount: boolean;
  /** Whether to use compact display */
  compact: boolean;
  /** Custom CSS classes for styling */
  cssClasses?: string[];
  /** Custom template for formatting (for custom format) */
  customTemplate?: string;
  /** Whether to make URIs clickable */
  linkify: boolean;
  /** Function to resolve URI display names */
  uriDisplayNameResolver?: (uri: string) => string;
}

/**
 * Formatted query results ready for display
 *
 * This wraps Comunica's result streams with our formatting options
 */
export interface FormattedQueryResults {
  /** Original query that generated these results */
  readonly query: SparqlQuery;

  /** Raw bindings from Comunica (for SELECT queries) */
  readonly bindings?: Bindings[];

  /** Boolean result (for ASK queries) */
  readonly booleanResult?: boolean;

  /** Quads (for CONSTRUCT/DESCRIBE queries) */
  readonly quads?: Array<{
    subject: any;
    predicate: any;
    object: any;
    graph?: any;
  }>;

  /** Formatting options used */
  readonly formattingOptions: ResultFormattingOptions;

  /** Formatted content ready for display */
  readonly formattedContent: string;

  /** MIME type of the formatted content */
  readonly contentType: string;

  /** Performance information */
  readonly performance: QueryPerformance;

  /** When results were generated */
  readonly generatedAt: Date;

  /** Cache key for result caching */
  readonly cacheKey: string;

  /** Whether these results are from cache */
  readonly fromCache: boolean;

  /** When cached results expire */
  readonly expiresAt?: Date;

  /** Total number of results (may be estimated for large result sets) */
  readonly totalResults: number;

  /** Whether results were truncated due to limits */
  readonly truncated: boolean;
}

/**
 * Cache entry for query results
 */
export interface ResultCacheEntry {
  /** Cache key */
  key: string;
  /** Cached results */
  results: FormattedQueryResults;
  /** When cached */
  cachedAt: Date;
  /** When cache expires */
  expiresAt: Date;
  /** Access count for LRU eviction */
  accessCount: number;
  /** Last accessed time */
  lastAccessed: Date;
  /** Size in bytes (approximate) */
  sizeBytes: number;
}

/**
 * Factory functions for query results
 */
export class QueryResultsFactory {
  /**
   * Create a cache key for results
   */
  static createCacheKey(
    query: SparqlQuery,
    options: ResultFormattingOptions
  ): string {
    const combined = query.contentHash + JSON.stringify(options);
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Create default formatting options
   */
  static createDefaultFormattingOptions(): ResultFormattingOptions {
    return {
      format: 'table',
      maxDisplayRows: 100,
      showExecutionTime: true,
      showResultCount: true,
      compact: false,
      linkify: true,
    };
  }

  /**
   * Create empty results for failed queries
   */
  static createEmptyResults(
    query: SparqlQuery,
    options: ResultFormattingOptions,
    error: string
  ): FormattedQueryResults {
    return {
      query,
      formattingOptions: options,
      formattedContent: `Error: ${error}`,
      contentType: 'text/plain',
      performance: {
        executionTimeMs: 0,
        parseTimeMs: 0,
        engineTimeMs: 0,
        formatTimeMs: 0,
        intermediateResults: 0,
      },
      generatedAt: new Date(),
      cacheKey: QueryResultsFactory.createCacheKey(query, options),
      fromCache: false,
      totalResults: 0,
      truncated: false,
    };
  }

  /**
   * Estimate size of results in bytes
   */
  static estimateResultSize(results: FormattedQueryResults): number {
    let size = results.formattedContent.length * 2; // Rough estimate for string content

    if (results.bindings) {
      size += JSON.stringify(results.bindings).length;
    }

    if (results.quads) {
      size += JSON.stringify(results.quads).length;
    }

    return size;
  }
}

/**
 * Utility functions for working with query results
 */
export class QueryResultsUtils {
  /**
   * Check if results are empty
   */
  static isEmpty(results: FormattedQueryResults): boolean {
    if (results.booleanResult !== undefined) {
      return false; // ASK queries always have a result
    }

    if (results.bindings) {
      return results.bindings.length === 0;
    }

    if (results.quads) {
      return results.quads.length === 0;
    }

    return results.totalResults === 0;
  }

  /**
   * Get result count for display
   */
  static getResultCount(results: FormattedQueryResults): number {
    if (results.booleanResult !== undefined) {
      return 1; // ASK queries always have one result
    }

    return results.totalResults;
  }

  /**
   * Get a summary string of the results
   */
  static getSummary(results: FormattedQueryResults): string {
    if (results.booleanResult !== undefined) {
      return `ASK result: ${results.booleanResult}`;
    }

    const count = results.totalResults;
    const truncated = results.truncated ? ' (truncated)' : '';

    if (results.bindings) {
      const variables = Object.keys(results.bindings[0] || {}).length;
      return `${count} results, ${variables} variables${truncated}`;
    }

    if (results.quads) {
      return `${count} triples${truncated}`;
    }

    return `${count} results${truncated}`;
  }

  /**
   * Convert bindings to simple table format (for debugging)
   */
  static bindingsToSimpleTable(bindings: Bindings[], maxRows = 10): string {
    if (!bindings || bindings.length === 0) {
      return 'No results';
    }

    // Get all variable names
    const allVariables = new Set<string>();
    bindings.forEach(binding => {
      for (const variable of Object.keys(binding)) {
        allVariables.add(variable);
      }
    });

    const variables = Array.from(allVariables).sort();

    // Create simple table
    const headers = variables.join('\t');
    const rows = bindings.slice(0, maxRows).map(binding => {
      return variables
        .map(variable => {
          const term = (binding as any)[variable];
          return term ? term.value : '';
        })
        .join('\t');
    });

    let table = headers + '\n' + rows.join('\n');

    if (bindings.length > maxRows) {
      table += `\n... and ${bindings.length - maxRows} more results`;
    }

    return table;
  }

  /**
   * Extract all unique URIs from bindings
   */
  static extractUrisFromBindings(bindings: Bindings[]): Set<string> {
    const uris = new Set<string>();

    bindings.forEach(binding => {
      for (const [, term] of Object.entries(binding)) {
        if (term.termType === 'NamedNode') {
          uris.add(term.value);
        }
      }
    });

    return uris;
  }

  /**
   * Check if bindings contain a specific URI
   */
  static bindingsContainUri(bindings: Bindings[], uri: string): boolean {
    return QueryResultsUtils.extractUrisFromBindings(bindings).has(uri);
  }

  /**
   * Get content type for a specific format
   */
  static getContentType(format: ResultFormat): string {
    switch (format) {
      case 'json':
        return 'application/json';
      case 'csv':
        return 'text/csv';
      case 'turtle':
        return 'text/turtle';
      case 'table':
      case 'list':
      case 'count':
      case 'custom':
      default:
        return 'text/html';
    }
  }

  /**
   * Count variables in bindings
   */
  static countVariables(bindings: Bindings[]): number {
    if (!bindings || bindings.length === 0) return 0;

    const allVariables = new Set<string>();
    bindings.forEach(binding => {
      for (const variable of Object.keys(binding)) {
        allVariables.add(variable);
      }
    });

    return allVariables.size;
  }

  /**
   * Get variable names from bindings
   */
  static getVariableNames(bindings: Bindings[]): string[] {
    if (!bindings || bindings.length === 0) return [];

    const allVariables = new Set<string>();
    bindings.forEach(binding => {
      for (const variable of Object.keys(binding)) {
        allVariables.add(variable);
      }
    });

    return Array.from(allVariables).sort();
  }

  /**
   * Check if results represent a boolean query (ASK)
   */
  static isBooleanResult(results: FormattedQueryResults): boolean {
    return results.booleanResult !== undefined;
  }

  /**
   * Check if results represent bindings (SELECT)
   */
  static isBindingsResult(results: FormattedQueryResults): boolean {
    return !!results.bindings;
  }

  /**
   * Check if results represent quads (CONSTRUCT/DESCRIBE)
   */
  static isQuadsResult(results: FormattedQueryResults): boolean {
    return !!results.quads;
  }
}
