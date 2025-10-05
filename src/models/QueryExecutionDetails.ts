/**
 * Detailed information about SPARQL query execution
 */
export interface QueryExecutionDetails {
  /** The original query string */
  queryString: string;
  /** The parsed query type (SELECT, CONSTRUCT, ASK, DESCRIBE) */
  queryType: string;
  /** Total execution time in milliseconds */
  executionTimeMs: number;
  /** Time taken to parse the query */
  parseTimeMs: number;
  /** Time taken for graph resolution */
  graphResolutionTimeMs: number;
  /** Time taken for actual query execution */
  queryExecutionTimeMs: number;
  /** Graph URIs that were used in the query */
  usedGraphs: Array<{
    uri: string;
    filePath: string;
    tripleCount: number;
    estimatedSizeBytes: number;
  }>;
  /** Total number of triples queried across all graphs */
  totalTriplesQueried: number;
  /** Query result statistics */
  resultStatistics: {
    /** Number of results returned */
    resultCount: number;
    /** Whether results were truncated */
    truncated: boolean;
    /** Maximum results limit that was applied */
    maxResults?: number;
  };
  /** Memory usage estimates */
  memoryUsage: {
    /** Estimated memory used by loaded graphs */
    graphMemoryBytes: number;
    /** Estimated memory used by query results */
    resultMemoryBytes: number;
    /** Total estimated memory usage */
    totalMemoryBytes: number;
  };
  /** Query complexity metrics */
  complexityMetrics: {
    /** Number of triple patterns in the query */
    triplePatternCount: number;
    /** Number of variables in the query */
    variableCount: number;
    /** Whether query uses OPTIONAL clauses */
    hasOptional: boolean;
    /** Whether query uses UNION clauses */
    hasUnion: boolean;
    /** Whether query uses FILTER clauses */
    hasFilters: boolean;
    /** Whether query uses subqueries */
    hasSubqueries: boolean;
    /** Estimated complexity score (1-10) */
    complexityScore: number;
  };
  /** Query execution status */
  status: 'success' | 'error' | 'timeout';
  /** Error message if execution failed */
  error?: string;
  /** Additional execution warnings */
  warnings: string[];
  /** Timestamp when the query was executed */
  executionTimestamp: Date;
}
