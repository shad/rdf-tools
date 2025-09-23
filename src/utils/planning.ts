/**
 * Pure function types and interfaces for query planning operations
 */

/**
 * Query execution strategy based on FROM clauses
 */
export type GraphStrategy = 'default' | 'from' | 'from_named' | 'mixed';

/**
 * Graph loading specification
 */
export interface GraphLoadSpec {
  /** URI of the graph to load */
  uri: string;
  /** Whether this graph should be loaded as a named graph */
  asNamedGraph: boolean;
  /** Source FROM clause type that led to this spec */
  source: 'from' | 'from_named' | 'default';
}

/**
 * Query execution plan
 */
export interface QueryPlan {
  /** The execution strategy to use */
  strategy: GraphStrategy;
  /** Graphs that need to be loaded */
  graphSpecs: readonly GraphLoadSpec[];
  /** Whether the current file should be included */
  includeCurrentFile: boolean;
  /** Original FROM graphs from query */
  originalFromGraphs: readonly string[];
  /** Original FROM NAMED graphs from query */
  originalFromNamedGraphs: readonly string[];
  /** Current file path for default graph fallback */
  currentFilePath: string;
}

/**
 * Validation result for query plans
 */
export interface QueryPlanValidation {
  /** Whether the plan is valid and executable */
  isValid: boolean;
  /** Any validation errors */
  errors: string[];
  /** Any validation warnings */
  warnings: string[];
  /** Estimated complexity level */
  complexity: 'low' | 'medium' | 'high';
}

/**
 * Graph resolution function type
 * This allows the pure functions to work with different graph resolution strategies
 */
export type GraphResolver = (uri: string) => readonly string[];

/**
 * File-to-graph URI converter function type
 */
export type FileToGraphConverter = (filePath: string) => string;

/**
 * Pure function: Determine target graphs for a SPARQL query
 * Based on FROM and FROM NAMED clauses, determines which graphs should be queried
 */
export const determineTargetGraphs = (
  fromGraphs: readonly string[],
  fromNamedGraphs: readonly string[],
  currentFilePath: string,
  graphResolver: GraphResolver,
  fileToGraphConverter: FileToGraphConverter
): readonly string[] => {
  // If explicit FROM clauses are specified, use only those
  if (fromGraphs.length > 0 || fromNamedGraphs.length > 0) {
    const allFromGraphs = [...fromGraphs, ...fromNamedGraphs];
    const resolvedGraphs: string[] = [];

    for (const graphUri of allFromGraphs) {
      const resolved = graphResolver(graphUri);
      resolvedGraphs.push(...resolved);
    }

    return resolvedGraphs;
  }

  // If no FROM clauses, use the current file's graph
  const currentFileGraph = fileToGraphConverter(currentFilePath);
  return [currentFileGraph];
};

/**
 * Pure function: Create a query execution plan
 * Analyzes FROM clauses and determines the optimal execution strategy
 */
export const createQueryPlan = (
  fromGraphs: readonly string[],
  fromNamedGraphs: readonly string[],
  currentFilePath: string,
  graphResolver: GraphResolver,
  fileToGraphConverter: FileToGraphConverter
): QueryPlan => {
  const hasFrom = fromGraphs.length > 0;
  const hasFromNamed = fromNamedGraphs.length > 0;

  // Determine strategy
  let strategy: GraphStrategy;
  if (!hasFrom && !hasFromNamed) {
    strategy = 'default';
  } else if (hasFrom && !hasFromNamed) {
    strategy = 'from';
  } else if (!hasFrom && hasFromNamed) {
    strategy = 'from_named';
  } else {
    strategy = 'mixed';
  }

  // Create graph loading specifications
  const graphSpecs: GraphLoadSpec[] = [];

  if (strategy === 'default') {
    // Default strategy: load current file as default graph
    const currentGraphUri = fileToGraphConverter(currentFilePath);
    graphSpecs.push({
      uri: currentGraphUri,
      asNamedGraph: false,
      source: 'default',
    });
  } else {
    // FROM strategy: load all FROM graphs as default graphs
    for (const graphUri of fromGraphs) {
      const resolved = graphResolver(graphUri);
      for (const resolvedUri of resolved) {
        graphSpecs.push({
          uri: resolvedUri,
          asNamedGraph: false,
          source: 'from',
        });
      }
    }

    // FROM NAMED strategy: load all FROM NAMED graphs as named graphs
    for (const graphUri of fromNamedGraphs) {
      const resolved = graphResolver(graphUri);
      for (const resolvedUri of resolved) {
        graphSpecs.push({
          uri: resolvedUri,
          asNamedGraph: true,
          source: 'from_named',
        });
      }
    }
  }

  return {
    strategy,
    graphSpecs,
    includeCurrentFile: strategy === 'default',
    originalFromGraphs: fromGraphs,
    originalFromNamedGraphs: fromNamedGraphs,
    currentFilePath,
  };
};

/**
 * Pure function: Get unique graph URIs from a query plan
 * Extracts all unique graph URIs that need to be loaded
 */
export const getRequiredGraphUris = (plan: QueryPlan): readonly string[] => {
  const uris = new Set<string>();
  for (const spec of plan.graphSpecs) {
    uris.add(spec.uri);
  }
  return Array.from(uris);
};

/**
 * Pure function: Validate a query execution plan
 * Checks for potential issues and estimates complexity
 */
export const validateQueryPlan = (plan: QueryPlan): QueryPlanValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for empty plan
  if (plan.graphSpecs.length === 0) {
    errors.push('Query plan contains no graphs to load');
  }

  // Check for duplicate graph specifications
  const uriCounts = new Map<string, number>();
  for (const spec of plan.graphSpecs) {
    uriCounts.set(spec.uri, (uriCounts.get(spec.uri) || 0) + 1);
  }

  for (const [uri, count] of uriCounts.entries()) {
    if (count > 1) {
      warnings.push(`Graph ${uri} is loaded multiple times`);
    }
  }

  // Check for potentially expensive operations
  const totalGraphs = plan.graphSpecs.length;
  if (totalGraphs > 10) {
    warnings.push(
      `Large number of graphs (${totalGraphs}) may impact performance`
    );
  }

  // Check for vault:// root queries
  for (const spec of plan.graphSpecs) {
    if (spec.uri === 'vault://') {
      warnings.push(
        'Querying entire vault (vault://) may be slow for large vaults'
      );
    }
  }

  // Estimate complexity
  let complexity: 'low' | 'medium' | 'high' = 'low';
  if (totalGraphs > 5 || plan.strategy === 'mixed') {
    complexity = 'medium';
  }
  if (totalGraphs > 15 || plan.graphSpecs.some(s => s.uri === 'vault://')) {
    complexity = 'high';
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    complexity,
  };
};

/**
 * Pure function: Check if a query plan uses named graphs
 * Determines if the query execution will involve named graph operations
 */
export const planUsesNamedGraphs = (plan: QueryPlan): boolean => {
  return plan.graphSpecs.some(spec => spec.asNamedGraph);
};

/**
 * Pure function: Get default graphs from a plan
 * Returns specifications for graphs that should be loaded as default graphs
 */
export const getDefaultGraphSpecs = (
  plan: QueryPlan
): readonly GraphLoadSpec[] => {
  return plan.graphSpecs.filter(spec => !spec.asNamedGraph);
};

/**
 * Pure function: Get named graphs from a plan
 * Returns specifications for graphs that should be loaded as named graphs
 */
export const getNamedGraphSpecs = (
  plan: QueryPlan
): readonly GraphLoadSpec[] => {
  return plan.graphSpecs.filter(spec => spec.asNamedGraph);
};

/**
 * Pure function: Create a plan summary for debugging/logging
 * Generates a human-readable summary of the query plan
 */
export const createPlanSummary = (plan: QueryPlan): string => {
  const parts: string[] = [];

  parts.push(`Strategy: ${plan.strategy}`);
  parts.push(`Total graphs: ${plan.graphSpecs.length}`);

  const defaultGraphs = getDefaultGraphSpecs(plan);
  const namedGraphs = getNamedGraphSpecs(plan);

  if (defaultGraphs.length > 0) {
    parts.push(`Default graphs: ${defaultGraphs.length}`);
  }

  if (namedGraphs.length > 0) {
    parts.push(`Named graphs: ${namedGraphs.length}`);
  }

  if (plan.originalFromGraphs.length > 0) {
    parts.push(`FROM clauses: ${plan.originalFromGraphs.length}`);
  }

  if (plan.originalFromNamedGraphs.length > 0) {
    parts.push(`FROM NAMED clauses: ${plan.originalFromNamedGraphs.length}`);
  }

  return parts.join(', ');
};

/**
 * Pure function: Estimate memory usage for a query plan
 * Provides a rough estimate of memory requirements
 */
export const estimatePlanMemoryUsage = (
  plan: QueryPlan
): {
  estimatedGraphs: number;
  complexityScore: number;
  memoryCategory: 'light' | 'moderate' | 'heavy';
} => {
  const graphCount = plan.graphSpecs.length;

  // Base complexity from number of graphs
  let complexityScore = graphCount;

  // Add complexity for strategy type
  switch (plan.strategy) {
    case 'default':
      complexityScore += 0;
      break;
    case 'from':
    case 'from_named':
      complexityScore += 1;
      break;
    case 'mixed':
      complexityScore += 3;
      break;
  }

  // Add complexity for vault:// queries
  for (const spec of plan.graphSpecs) {
    if (spec.uri === 'vault://') {
      complexityScore += 10; // Vault root is expensive
    } else if (spec.uri.endsWith('/')) {
      complexityScore += 2; // Directory queries are moderately expensive
    }
  }

  // Determine memory category
  let memoryCategory: 'light' | 'moderate' | 'heavy';
  if (complexityScore <= 3) {
    memoryCategory = 'light';
  } else if (complexityScore <= 10) {
    memoryCategory = 'moderate';
  } else {
    memoryCategory = 'heavy';
  }

  return {
    estimatedGraphs: graphCount,
    complexityScore,
    memoryCategory,
  };
};
