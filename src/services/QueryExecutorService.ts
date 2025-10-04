import { QueryEngine } from '@comunica/query-sparql-rdfjs';
import { Store, Quad, DataFactory } from 'n3';
import { SparqlQuery, SparqlQueryUtils } from '@/models';
import { QueryResults, QueryResultsType } from '@/models';
import { QueryExecutionDetails } from '@/models/QueryExecutionDetails';
import { GraphService } from './GraphService';
import {
  transformBinding,
  formatAskResults,
  quadsToTurtle,
} from '../utils/results';
import {
  createQueryPlan,
  determineTargetGraphs,
  validateQueryPlan,
  getRequiredGraphUris,
  GraphLoadSpec,
} from '../utils/planning';

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

      // Create query execution plan using pure functions
      const plan = createQueryPlan(
        query.context.fromGraphs,
        query.context.fromNamedGraphs,
        query.location.file.path,
        (uri: string) => this.graphService.resolveVaultUri(uri),
        (filePath: string) => this.graphService.getGraphUriForFile(filePath)
      );

      // Validate the query plan
      const validation = validateQueryPlan(plan);
      if (!validation.isValid) {
        return this.createErrorResult(
          query,
          `Invalid query plan: ${validation.errors.join(', ')}`,
          executionInfo,
          Date.now() - startTime
        );
      }

      // Get required graph URIs from the plan
      const targetGraphs = getRequiredGraphUris(plan);
      executionInfo.usedGraphs = [...targetGraphs];

      if (targetGraphs.length === 0) {
        return this.createErrorResult(
          query,
          'No graphs found for query',
          executionInfo,
          Date.now() - startTime
        );
      }

      // Load target graphs using simplified API
      const graphs = await this.graphService.getGraphs([...targetGraphs]);

      // Create a single store based on the execution plan
      const combinedStore = new Store();

      // Create a map of graph URI to graph for efficient lookup
      const graphMap = new Map<string, (typeof graphs)[0]>();
      for (const graph of graphs) {
        graphMap.set(graph.uri, graph);
      }

      // Group specs by their source FROM graph for proper aggregation
      const fromGraphGroups = new Map<string, GraphLoadSpec[]>();

      // For default strategy, use a single group
      if (plan.strategy === 'default') {
        fromGraphGroups.set('default', [...plan.graphSpecs]);
      } else {
        // Group specs by the original FROM/FROM NAMED graph they came from
        for (const spec of plan.graphSpecs) {
          // Find which original FROM graph this spec came from
          let originalGraphUri = spec.uri;

          // Check if this spec came from resolving a vault:// URI
          if (spec.source === 'from') {
            for (const fromGraph of plan.originalFromGraphs) {
              const resolved = this.graphService.resolveVaultUri(fromGraph);
              if (resolved.includes(spec.uri)) {
                originalGraphUri = fromGraph;
                break;
              }
            }
          } else if (spec.source === 'from_named') {
            for (const fromNamedGraph of plan.originalFromNamedGraphs) {
              const resolved =
                this.graphService.resolveVaultUri(fromNamedGraph);
              if (resolved.includes(spec.uri)) {
                originalGraphUri = fromNamedGraph;
                break;
              }
            }
          }

          if (!fromGraphGroups.has(originalGraphUri)) {
            fromGraphGroups.set(originalGraphUri, []);
          }
          fromGraphGroups.get(originalGraphUri)!.push(spec);
        }
      }

      // Process each group
      for (const [originalGraphUri, specs] of fromGraphGroups.entries()) {
        const isDefaultStrategy = originalGraphUri === 'default';

        // Determine the target graph identifier
        let targetGraphNode: ReturnType<typeof DataFactory.namedNode> | null =
          null;
        if (!isDefaultStrategy) {
          targetGraphNode = DataFactory.namedNode(originalGraphUri);
        }

        // Add all quads from this group to the target graph
        for (const spec of specs) {
          const graph = graphMap.get(spec.uri);
          if (graph) {
            const quads = graph.store.getQuads(null, null, null, null);

            for (const quad of quads) {
              if (isDefaultStrategy) {
                // Default strategy: Add to default graph (no graph identifier)
                combinedStore.addQuad(
                  quad.subject,
                  quad.predicate,
                  quad.object
                );
              } else {
                // FROM/FROM NAMED: Add to the original graph URI (e.g., vault://)
                combinedStore.addQuad(
                  quad.subject,
                  quad.predicate,
                  quad.object,
                  targetGraphNode!
                );
              }
            }
          }
        }
      }

      // Calculate total triples in the combined store
      executionInfo.totalTriples = combinedStore.size;

      // Execute the query with single combined store
      const result = await this.executeQueryWithSources(
        query,
        combinedStore,
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
   * Execute query with single store containing named graphs (the correct RDF approach)
   */
  private async executeQueryWithSources(
    query: SparqlQuery,
    store: Store,
    options: QueryExecutionOptions,
    abortSignal: AbortSignal
  ): Promise<QueryResults> {
    if (!query.parsedQuery) {
      throw new Error('Query must be parsed before execution');
    }

    if (store.size === 0) {
      throw new Error('No data available for query execution');
    }

    // Extract query type from parsed query - sparqljs uses queryType property
    const parsedQuery = query.parsedQuery as {
      queryType?: string;
      type?: string;
    };
    const queryType = (
      parsedQuery.queryType || parsedQuery.type
    )?.toUpperCase() as QueryResultsType;

    // Create context for Comunica with single store as source
    // For N3 Store, we should use the store directly as the source
    const context = {
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
    // Ensure we have sources available
    if (!context.sources || context.sources.length === 0) {
      throw new Error('No sources available for query execution');
    }

    // Use expanded query string (with PREFIX declarations) if available, otherwise fall back to original
    const queryToExecute = query.expandedQueryString || query.queryString;

    const bindingsStream = await this.engine.queryBindings(queryToExecute, {
      sources: context.sources as [Store, ...Store[]],
      signal: abortSignal,
      baseIRI: query.context.baseUri,
    });

    const bindings: Record<
      string,
      { type: string; value: string; datatype?: string; language?: string }
    >[] = [];
    const maxResults = options.maxResults || query.context.maxResults;
    let count = 0;

    return new Promise((resolve, reject) => {
      let dataReceived = false;

      bindingsStream.on('data', binding => {
        if (!dataReceived) {
          dataReceived = true;
        }
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

        // Process the binding using pure function
        const bindingObj = transformBinding(binding);
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

      // Add a timeout to detect hanging streams
      const streamTimeout = setTimeout(() => {
        if (!dataReceived) {
          resolve({
            status: 'completed',
            queryType: 'SELECT',
            bindings: [],
            resultCount: 0,
            truncated: false,
          });
        }
      }, 5000); // 5 second timeout

      // Clear timeout when stream completes
      bindingsStream.on('end', () => clearTimeout(streamTimeout));
      bindingsStream.on('error', () => clearTimeout(streamTimeout));
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
    // Use expanded query string (with PREFIX declarations) if available, otherwise fall back to original
    const queryToExecute = query.expandedQueryString || query.queryString;

    const quadStream = await this.engine.queryQuads(queryToExecute, {
      sources: context.sources as [Store, ...Store[]],
      signal: abortSignal,
      baseIRI: query.context.baseUri,
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

      quadStream.on('end', () => {
        // Convert quads to turtle format using pure function
        const turtleContent = quadsToTurtle(quads);

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
    // Use expanded query string (with PREFIX declarations) if available, otherwise fall back to original
    const queryToExecute = query.expandedQueryString || query.queryString;

    const result = await this.engine.queryBoolean(queryToExecute, {
      sources: context.sources as [Store, ...Store[]],
      signal: abortSignal,
      baseIRI: query.context.baseUri,
    });

    // Use pure function for result formatting
    return formatAskResults(result);
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

    // Determine target graphs using pure planning functions
    const targetGraphs = determineTargetGraphs(
      query.context.fromGraphs,
      query.context.fromNamedGraphs,
      query.location.file.path,
      (uri: string) => this.graphService.resolveVaultUri(uri),
      (filePath: string) => this.graphService.getGraphUriForFile(filePath)
    );
    const graphResolutionTimeMs = Date.now() - graphResolutionStartTime;

    // Get graphs and collect basic information
    const graphs = await this.graphService.getGraphs([...targetGraphs]);
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
