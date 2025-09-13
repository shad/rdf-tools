/**
 * Query result types for RDF Tools
 */

export type QueryResultsType = 'SELECT' | 'CONSTRUCT' | 'DESCRIBE' | 'ASK';

export type QueryStatus = 'executing' | 'completed' | 'error' | 'timeout';

export interface QueryResults {
  status: QueryStatus;
  queryType: QueryResultsType;
  error?: string;
  resultCount: number;
  truncated: boolean;
  executionTimeMs?: number;
  usedGraphs?: string[];
  totalTriplesQueried?: number;

  // SELECT results
  bindings?: Array<
    Record<
      string,
      { type: string; value: string; datatype?: string; language?: string }
    >
  >;

  // CONSTRUCT/DESCRIBE results
  turtle?: string;

  // ASK results
  boolean?: boolean;
}
