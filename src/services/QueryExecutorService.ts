import { QueryEngine } from '@comunica/query-sparql-rdfjs';
import { Store, Quad, DataFactory } from 'n3';
import { SparqlQuery, SparqlQueryUtils } from '../models/SparqlQuery';
import { QueryResults, QueryResultsType } from '../models/QueryResults';
import { QueryExecutionDetails } from '../models/QueryExecutionDetails';
import { BindingHelpers } from '../models/BindingHelpers';
import { GraphService } from './GraphService';

/**
 * Options for query execution
 */
export interface QueryExecutionOptions {
  /** Timeout for query execution in milliseconds */
  timeoutMs?: number;
  /** Maximum number of results to return */
  maxResults?: number;
  /** Whether to include execution metrics */
  includeMetrics?: boolean;
  /** Whether to format results for display */
  formatForDisplay?: boolean;
}

/**
 * Information about query execution
 */
export interface QueryExecutionInfo {
  /** The query that was executed */
  query: SparqlQuery;
  /** Graph URIs that were actually used */
  usedGraphs: string[];
  /** Total number of triples queried */
  totalTriples: number;
  /** Execution start time */
  startTime: Date;
  /** Execution end time (if completed) */
  endTime?: Date;
  /** Execution duration in milliseconds */
  durationMs?: number;
}

/**
 * Service for executing SPARQL queries using Comunica
 */
export class QueryExecutorService {
  private engine: QueryEngine;
  private activeExecutions = new Map<string, AbortController>();

  constructor(private graphService: GraphService) {
    this.engine = new QueryEngine();
  }

  /**
   * Execute a SPARQL query
   */
  async executeQuery(
    query: SparqlQuery,
    options: QueryExecutionOptions = {}
  ): Promise<QueryResults> {
    const executionInfo: QueryExecutionInfo = {
      query,
      usedGraphs: [],
      totalTriples: 0,
      startTime: new Date(),
    };

    const startTime = Date.now();

    try {
      // Cancel any existing execution for this query
      this.cancelExecution(query.id);

      // Create abort controller for timeout/cancellation
      const abortController = new AbortController();
      this.activeExecutions.set(query.id, abortController);

      // Set up timeout if specified
      const timeoutMs = options.timeoutMs || query.context.timeoutMs;
      let timeoutId: NodeJS.Timeout | undefined;

      if (timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          abortController.abort();
        }, timeoutMs);
      }

      // Determine which graphs to query
      const targetGraphs = this.determineTargetGraphs(query);
      executionInfo.usedGraphs = targetGraphs;


      if (targetGraphs.length === 0) {
        return this.createErrorResult(
          query,
          'No graphs found for query',
          executionInfo,
          Date.now() - startTime
        );
      }

      // Load target graphs using simplified API
      const graphs = await this.graphService.getGraphs(targetGraphs);

      // Create dataset store according to SPARQL semantics
      const datasetStore = new Store();

      const fromGraphs = query.context.fromGraphs || [];
      const fromNamedGraphs = query.context.fromNamedGraphs || [];

      if (fromGraphs.length > 0) {
        // FROM clauses: merge specified graphs into the default graph
        for (const graph of graphs) {
          if (fromGraphs.includes(graph.uri)) {
            const quads = graph.store.getQuads(null, null, null, null);
            datasetStore.addQuads(quads); // Add to default graph
          }
        }
      } else if (fromNamedGraphs.length === 0) {
        // No FROM or FROM NAMED: use current file's graph as default
        for (const graph of graphs) {
          const quads = graph.store.getQuads(null, null, null, null);
          datasetStore.addQuads(quads); // Add to default graph
        }
      }

      // FROM NAMED clauses: add as named graphs
      if (fromNamedGraphs.length > 0) {
        for (const graph of graphs) {
          if (fromNamedGraphs.includes(graph.uri)) {
            const quads = graph.store.getQuads(null, null, null, null);
            const namedQuads = quads.map(quad =>
              DataFactory.quad(quad.subject, quad.predicate, quad.object, DataFactory.namedNode(graph.uri))
            );
            datasetStore.addQuads(namedQuads);
          }
        }
      }

      executionInfo.totalTriples = datasetStore.size;

      // Execute the query
      const result = await this.executeQueryWithStore(
        query,
        datasetStore,
        options,
        abortController.signal
      );

      // Clear timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Complete execution info
      executionInfo.endTime = new Date();
      executionInfo.durationMs = Date.now() - startTime;

      // Clean up
      this.activeExecutions.delete(query.id);

      return {
        ...result,
        executionTimeMs: executionInfo.durationMs,
        usedGraphs: executionInfo.usedGraphs,
        totalTriplesQueried: executionInfo.totalTriples,
      };
    } catch (error) {
      // Clean up
      this.activeExecutions.delete(query.id);

      if (error instanceof Error && error.name === 'AbortError') {
        return this.createTimeoutResult(
          query,
          executionInfo,
          options.timeoutMs || query.context.timeoutMs
        );
      }

      return this.createErrorResult(
        query,
        error instanceof Error ? error.message : 'Unknown execution error',
        executionInfo,
        Date.now() - startTime
      );
    }
  }

  /**
   * Cancel a running query execution
   */
  cancelExecution(queryId: string): boolean {
    const controller = this.activeExecutions.get(queryId);
    if (controller) {
      controller.abort();
      this.activeExecutions.delete(queryId);
      return true;
    }
    return false;
  }

  /**
   * Check if a query is currently executing
   */
  isExecuting(queryId: string): boolean {
    return this.activeExecutions.has(queryId);
  }

  /**
   * Get all currently executing queries
   */
  getActiveExecutions(): string[] {
    return Array.from(this.activeExecutions.keys());
  }

  /**
   * Execute query with a specific N3 store
   */
  private async executeQueryWithStore(
    query: SparqlQuery,
    store: Store,
    options: QueryExecutionOptions,
    abortSignal: AbortSignal
  ): Promise<QueryResults> {
    if (!query.parsedQuery) {
      throw new Error('Query must be parsed before execution');
    }

    // Extract query type from parsed query - sparqljs uses queryType property
    const parsedQuery = query.parsedQuery as {
      queryType?: string;
      type?: string;
    };
    const queryType = (
      parsedQuery.queryType || parsedQuery.type
    )?.toUpperCase() as QueryResultsType;

    // Create context for Comunica following their documentation example
    const context: { sources: Store[] } = {
      sources: [store],
    };

    try {
      switch (queryType) {
        case 'SELECT':
          return await this.executeSelectQuery(
            query,
            context,
            options,
            abortSignal
          );
        case 'CONSTRUCT':
          return await this.executeConstructQuery(
            query,
            context,
            options,
            abortSignal
          );
        case 'DESCRIBE':
          return await this.executeDescribeQuery(
            query,
            context,
            options,
            abortSignal
          );
        case 'ASK':
          return await this.executeAskQuery(
            query,
            context,
            options,
            abortSignal
          );
        default:
          throw new Error(`Unsupported query type: ${queryType}`);
      }
    } catch (error) {
      if (abortSignal.aborted) {
        throw new Error('Query execution was cancelled');
      }
      throw error;
    }
  }

  /**
   * Execute SELECT query
   */
  private async executeSelectQuery(
    query: SparqlQuery,
    context: { sources: Store[] },
    options: QueryExecutionOptions,
    abortSignal: AbortSignal
  ): Promise<QueryResults> {

    // Following Comunica documentation example: pass Store directly in sources array
    const bindingsStream = await this.engine.queryBindings(query.queryString, {
      sources: context.sources as [Store, ...Store[]],
      signal: abortSignal,
    });

    const bindings: Record<
      string,
      { type: string; value: string; datatype?: string; language?: string }
    >[] = [];
    const maxResults = options.maxResults || query.context.maxResults;
    let count = 0;

    return new Promise((resolve, reject) => {
      bindingsStream.on('data', binding => {
        if (abortSignal.aborted) {
          bindingsStream.destroy();
          reject(new Error('Query execution was cancelled'));
          return;
        }

        if (count >= maxResults) {
          bindingsStream.destroy();
          resolve({
            status: 'completed',
            queryType: 'SELECT',
            bindings,
            resultCount: bindings.length,
            truncated: true,
          });
          return;
        }

        // Process the binding using our helper
        const bindingObj = BindingHelpers.processBinding(binding);
        bindings.push(bindingObj);
        count++;
      });

      bindingsStream.on('end', () => {
        resolve({
          status: 'completed',
          queryType: 'SELECT',
          bindings,
          resultCount: bindings.length,
          truncated: false,
        });
      });

      bindingsStream.on('error', error => {
        reject(error);
      });
    });
  }

  /**
   * Execute CONSTRUCT query
   */
  private async executeConstructQuery(
    query: SparqlQuery,
    context: { sources: Store[] },
    options: QueryExecutionOptions,
    abortSignal: AbortSignal
  ): Promise<QueryResults> {
    const quadStream = await this.engine.queryQuads(query.queryString, {
      sources: context.sources as [Store, ...Store[]],
      signal: abortSignal,
    });

    const quads: Quad[] = [];

    return new Promise((resolve, reject) => {
      quadStream.on('data', quad => {
        if (abortSignal.aborted) {
          quadStream.destroy();
          reject(new Error('Query execution was cancelled'));
          return;
        }

        quads.push(quad);
      });

      quadStream.on('end', async () => {
        // Convert quads to turtle format
        const turtleContent = await this.quadsToTurtle(quads);

        resolve({
          status: 'completed',
          queryType: 'CONSTRUCT',
          turtle: turtleContent,
          resultCount: quads.length,
          truncated: false,
        });
      });

      quadStream.on('error', error => {
        reject(error);
      });
    });
  }

  /**
   * Execute DESCRIBE query
   */
  private async executeDescribeQuery(
    query: SparqlQuery,
    context: { sources: Store[] },
    options: QueryExecutionOptions,
    abortSignal: AbortSignal
  ): Promise<QueryResults> {
    // DESCRIBE queries are handled similarly to CONSTRUCT
    return this.executeConstructQuery(query, context, options, abortSignal);
  }

  /**
   * Execute ASK query
   */
  private async executeAskQuery(
    query: SparqlQuery,
    context: { sources: Store[] },
    options: QueryExecutionOptions,
    abortSignal: AbortSignal
  ): Promise<QueryResults> {
    const result = await this.engine.queryBoolean(query.queryString, {
      sources: context.sources as [Store, ...Store[]],
      signal: abortSignal,
    });

    return {
      status: 'completed',
      queryType: 'ASK',
      boolean: result,
      resultCount: 1,
      truncated: false,
    };
  }

  /**
   * Determine which graphs should be queried based on FROM clauses
   */
  private determineTargetGraphs(query: SparqlQuery): string[] {
    const fromGraphs = query.context.fromGraphs;
    const fromNamedGraphs = query.context.fromNamedGraphs;

    // If explicit FROM clauses are specified, use only those
    if (fromGraphs.length > 0 || fromNamedGraphs.length > 0) {
      const allFromGraphs = [...fromGraphs, ...fromNamedGraphs];
      const resolvedGraphs: string[] = [];

      for (const graphUri of allFromGraphs) {
        const resolved = this.graphService.resolveVaultUri(graphUri);
        resolvedGraphs.push(...resolved);
      }

      return resolvedGraphs;
    }

    // If no FROM clauses, use the current file's graph
    const currentFileGraph = this.graphService.getGraphUriForFile(
      query.location.file.path
    );
    // Always return the current file graph - lazy loading will handle loading it
    return [currentFileGraph];
  }

  /**
   * Convert N3 quads to turtle string
   */
  private async quadsToTurtle(quads: Quad[]): Promise<string> {
    if (quads.length === 0) {
      return '';
    }

    // Simple turtle serialization
    // In a more complete implementation, you'd use N3.js Writer
    const lines: string[] = [];

    for (const quad of quads) {
      const subject = this.formatTerm(quad.subject);
      const predicate = this.formatTerm(quad.predicate);
      const object = this.formatTerm(quad.object);

      lines.push(`${subject} ${predicate} ${object} .`);
    }

    return lines.join('\n');
  }

  /**
   * Format an RDF term for turtle output
   */
  private formatTerm(
    term: Quad['subject'] | Quad['predicate'] | Quad['object']
  ): string {
    switch (term.termType) {
      case 'NamedNode':
        return `<${term.value}>`;
      case 'BlankNode':
        return `_:${term.value}`;
      case 'Literal':
        if (
          term.datatype &&
          term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string'
        ) {
          return `"${term.value}"^^<${term.datatype.value}>`;
        } else if (term.language) {
          return `"${term.value}"@${term.language}`;
        } else {
          return `"${term.value}"`;
        }
      default:
        return term.value;
    }
  }

  /**
   * Create error result
   */
  private createErrorResult(
    query: SparqlQuery,
    error: string,
    executionInfo: QueryExecutionInfo,
    durationMs: number
  ): QueryResults {
    return {
      status: 'error',
      queryType:
        (query.parsedQuery?.type.toUpperCase() as QueryResultsType) || 'SELECT',
      error,
      resultCount: 0,
      truncated: false,
      executionTimeMs: durationMs,
      usedGraphs: executionInfo.usedGraphs,
      totalTriplesQueried: executionInfo.totalTriples,
    };
  }

  /**
   * Create timeout result
   */
  private createTimeoutResult(
    query: SparqlQuery,
    executionInfo: QueryExecutionInfo,
    timeoutMs: number
  ): QueryResults {
    return {
      status: 'timeout',
      queryType:
        (query.parsedQuery?.type.toUpperCase() as QueryResultsType) || 'SELECT',
      error: `Query timed out after ${timeoutMs}ms`,
      resultCount: 0,
      truncated: false,
      executionTimeMs: timeoutMs,
      usedGraphs: executionInfo.usedGraphs,
      totalTriplesQueried: executionInfo.totalTriples,
    };
  }

  /**
   * Generate detailed execution information for a query
   */
  async generateExecutionDetails(
    query: SparqlQuery,
    options: QueryExecutionOptions = {}
  ): Promise<QueryExecutionDetails> {
    const startTime = Date.now();
    const parseStartTime = Date.now();

    // Parse the query if not already parsed
    if (!query.parsedQuery) {
      throw new Error(
        'Query must be parsed before generating execution details'
      );
    }

    const parseTimeMs = Date.now() - parseStartTime;
    const graphResolutionStartTime = Date.now();

    // Determine target graphs
    const targetGraphs = this.determineTargetGraphs(query);
    const graphResolutionTimeMs = Date.now() - graphResolutionStartTime;

    // Get graphs and collect basic information
    const graphs = await this.graphService.getGraphs(targetGraphs);
    const usedGraphs = graphs.map(graph => ({
      uri: graph.uri,
      filePath: graph.filePath,
      tripleCount: graph.tripleCount,
      estimatedSizeBytes: graph.tripleCount * 200, // Simple estimation
    }));

    const totalTriplesQueried = usedGraphs.reduce(
      (sum, g) => sum + g.tripleCount,
      0
    );

    // Execute the query and measure execution time
    const queryExecutionStartTime = Date.now();
    let queryResults: QueryResults;
    let status: 'success' | 'error' | 'timeout' = 'success';
    let error: string | undefined;

    try {
      queryResults = await this.executeQuery(query, options);
      if (queryResults.status === 'error') {
        status = 'error';
        error = queryResults.error;
      } else if (queryResults.status === 'timeout') {
        status = 'timeout';
        error = queryResults.error;
      }
    } catch (err) {
      status = 'error';
      error = err instanceof Error ? err.message : 'Unknown execution error';
      // Create a dummy result for analysis
      queryResults = {
        status: 'error',
        queryType: 'SELECT' as QueryResultsType,
        error,
        resultCount: 0,
        truncated: false,
      };
    }

    const queryExecutionTimeMs = Date.now() - queryExecutionStartTime;
    const totalExecutionTimeMs = Date.now() - startTime;

    // Analyze query complexity
    const complexityMetrics = this.analyzeQueryComplexity(query);

    // Calculate memory usage
    const graphMemoryBytes = usedGraphs.reduce(
      (sum, g) => sum + g.estimatedSizeBytes,
      0
    );
    const resultMemoryBytes = this.estimateResultMemoryUsage(queryResults);
    const totalMemoryBytes = graphMemoryBytes + resultMemoryBytes;

    // Collect warnings
    const warnings: string[] = [];
    if (totalTriplesQueried > 100000) {
      warnings.push(
        'Large dataset - consider using more specific FROM clauses'
      );
    }
    if (complexityMetrics.complexityScore > 7) {
      warnings.push('Complex query - execution may be slow');
    }
    if (queryResults.truncated) {
      warnings.push('Results were truncated due to limit');
    }

    return {
      queryString: query.queryString,
      queryType: query.parsedQuery
        ? SparqlQueryUtils.extractQueryType(query.parsedQuery)
        : 'UNKNOWN',
      executionTimeMs: totalExecutionTimeMs,
      parseTimeMs,
      graphResolutionTimeMs,
      queryExecutionTimeMs,
      usedGraphs,
      totalTriplesQueried,
      resultStatistics: {
        resultCount: queryResults.resultCount || 0,
        truncated: queryResults.truncated || false,
        maxResults: options.maxResults || query.context.maxResults,
      },
      memoryUsage: {
        graphMemoryBytes,
        resultMemoryBytes,
        totalMemoryBytes,
      },
      complexityMetrics,
      status,
      error,
      warnings,
      executionTimestamp: new Date(),
    };
  }

  /**
   * Analyze query complexity
   */
  private analyzeQueryComplexity(
    query: SparqlQuery
  ): QueryExecutionDetails['complexityMetrics'] {
    const queryStr = query.queryString.toLowerCase();

    // Count variables
    const variableMatches = query.queryString.match(/\?[\w\d]+/g);
    const variableCount = variableMatches ? new Set(variableMatches).size : 0;

    // Estimate triple patterns (rough heuristic)
    const triplePatternCount = Math.max(
      1,
      (queryStr.match(/\./g) || []).length
    );

    // Check for advanced features
    const hasOptional = queryStr.includes('optional');
    const hasUnion = queryStr.includes('union');
    const hasFilters = queryStr.includes('filter');
    const hasSubqueries =
      queryStr.includes('{') && queryStr.split('{').length > 2;

    // Calculate complexity score (1-10)
    let complexityScore = 1;
    complexityScore += Math.min(2, variableCount * 0.2);
    complexityScore += Math.min(2, triplePatternCount * 0.1);
    if (hasOptional) complexityScore += 1.5;
    if (hasUnion) complexityScore += 1.5;
    if (hasFilters) complexityScore += 1;
    if (hasSubqueries) complexityScore += 2;

    complexityScore = Math.min(10, Math.max(1, Math.round(complexityScore)));

    return {
      triplePatternCount,
      variableCount,
      hasOptional,
      hasUnion,
      hasFilters,
      hasSubqueries,
      complexityScore,
    };
  }

  /**
   * Estimate memory usage for query results
   */
  private estimateResultMemoryUsage(results: QueryResults): number {
    if (results.status !== 'completed') {
      return 0;
    }

    switch (results.queryType) {
      case 'SELECT':
        // Estimate ~200 bytes per binding
        return (results.resultCount || 0) * 200;
      case 'CONSTRUCT':
      case 'DESCRIBE':
        // Estimate ~300 bytes per triple
        return (results.resultCount || 0) * 300;
      case 'ASK':
        return 4; // Just a boolean
      default:
        return 0;
    }
  }

  /**
   * Clean up all active executions
   */
  cleanup(): void {
    for (const controller of this.activeExecutions.values()) {
      controller.abort();
    }
    this.activeExecutions.clear();
  }
}
