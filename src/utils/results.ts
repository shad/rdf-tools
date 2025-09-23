import { Quad, Term, Variable } from 'n3';

/**
 * Pure function types and interfaces for result processing operations
 */

// Re-export types for convenience
export interface ProcessedBinding {
  type: string;
  value: string;
  datatype?: string;
  language?: string;
}

export interface SelectResult {
  status: 'completed';
  queryType: 'SELECT';
  bindings: readonly Record<string, ProcessedBinding>[];
  resultCount: number;
  truncated: boolean;
}

export interface ConstructResult {
  status: 'completed';
  queryType: 'CONSTRUCT';
  turtle: string;
  resultCount: number;
  truncated: boolean;
}

export interface AskResult {
  status: 'completed';
  queryType: 'ASK';
  boolean: boolean;
  resultCount: number;
  truncated: boolean;
}

export interface DescribeResult {
  status: 'completed';
  queryType: 'DESCRIBE';
  turtle: string;
  resultCount: number;
  truncated: boolean;
}

export type QueryResults =
  | SelectResult
  | ConstructResult
  | AskResult
  | DescribeResult;

/**
 * Interface for Comunica binding entries (Immutable.js Map)
 */
interface ComunicaBindingEntries {
  readonly size: number;
  entrySeq(): Iterable<[Variable, Term]>;
}

/**
 * Interface for binding objects from Comunica
 */
interface ComunicaBinding {
  entries: ComunicaBindingEntries | Map<string, Term> | Record<string, Term>;
}

/**
 * Options for result processing
 */
export interface ResultProcessingOptions {
  maxResults?: number;
  includePrefixes?: boolean;
  baseUri?: string;
}

/**
 * Pure function: Format SELECT query results
 * Processes raw bindings into clean result format
 */
export const formatSelectResults = (
  bindings: readonly Record<string, ProcessedBinding>[],
  options: ResultProcessingOptions = {}
): SelectResult => {
  const maxResults = options.maxResults || Number.MAX_SAFE_INTEGER;

  // Process up to maxResults bindings
  const bindingsToProcess = bindings.slice(0, maxResults);

  return {
    status: 'completed',
    queryType: 'SELECT',
    bindings: bindingsToProcess,
    resultCount: bindingsToProcess.length,
    truncated: bindings.length > maxResults,
  };
};

/**
 * Pure function: Format CONSTRUCT query results
 * Converts quads to turtle representation
 */
export const formatConstructResults = (
  quads: readonly Quad[],
  options: ResultProcessingOptions = {}
): ConstructResult => {
  const turtle = quadsToTurtle(quads, options);

  return {
    status: 'completed',
    queryType: 'CONSTRUCT',
    turtle,
    resultCount: quads.length,
    truncated: false,
  };
};

/**
 * Pure function: Format DESCRIBE query results
 * Same as CONSTRUCT but with different query type
 */
export const formatDescribeResults = (
  quads: readonly Quad[],
  options: ResultProcessingOptions = {}
): DescribeResult => {
  const turtle = quadsToTurtle(quads, options);

  return {
    status: 'completed',
    queryType: 'DESCRIBE',
    turtle,
    resultCount: quads.length,
    truncated: false,
  };
};

/**
 * Pure function: Format ASK query results
 */
export const formatAskResults = (result: boolean): AskResult => {
  return {
    status: 'completed',
    queryType: 'ASK',
    boolean: result,
    resultCount: 1,
    truncated: false,
  };
};

/**
 * Pure function: Transform Comunica binding to processed binding
 */
export const transformBinding = (
  binding: unknown
): Record<string, ProcessedBinding> => {
  const bindingObj: Record<string, ProcessedBinding> = {};
  const comunicaBinding = binding as ComunicaBinding;

  if (!comunicaBinding?.entries) {
    return {};
  }

  // Handle Immutable.js Map (used by Comunica)
  if (isComunicaBindingEntries(comunicaBinding.entries)) {
    for (const [variable, term] of comunicaBinding.entries.entrySeq()) {
      const varName = variable.value || variable.toString();
      bindingObj[varName] = formatTermForBinding(term);
    }
  } else if (comunicaBinding.entries instanceof Map) {
    // Standard JavaScript Map
    for (const [variable, term] of comunicaBinding.entries.entries()) {
      bindingObj[variable] = formatTermForBinding(term);
    }
  } else if (typeof comunicaBinding.entries === 'object') {
    // Plain object fallback
    for (const [varName, term] of Object.entries(comunicaBinding.entries)) {
      if (term && typeof term === 'object' && 'value' in term) {
        bindingObj[varName] = formatTermForBinding(term);
      }
    }
  }

  return bindingObj;
};

/**
 * Pure function: Convert quads array to turtle string
 */
export const quadsToTurtle = (
  quads: readonly Quad[],
  options: ResultProcessingOptions = {}
): string => {
  if (quads.length === 0) {
    return '';
  }

  // For pure function behavior, use simple turtle serialization
  // N3 Writer requires async callbacks which doesn't work with pure functions
  const turtleLines: string[] = [];

  // Add prefixes if requested
  if (options.includePrefixes) {
    const prefixes = extractPrefixesFromQuads(quads);
    for (const [prefix, uri] of Object.entries(prefixes)) {
      turtleLines.push(`@prefix ${prefix}: <${uri}> .`);
    }
    if (Object.keys(prefixes).length > 0) {
      turtleLines.push(''); // Empty line after prefixes
    }
  }

  // Add base URI if provided
  if (options.baseUri) {
    turtleLines.push(`@base <${options.baseUri}> .`);
    turtleLines.push(''); // Empty line after base
  }

  // Add quads
  turtleLines.push(...quads.map(quad => formatQuadAsTurtle(quad)));

  return turtleLines.join('\n');
};

/**
 * Pure function: Estimate memory usage of query results
 * Useful for performance monitoring
 */
export const estimateMemoryUsage = (results: QueryResults): number => {
  let bytes = 0;

  switch (results.queryType) {
    case 'SELECT':
      // Estimate binding size
      for (const binding of results.bindings) {
        for (const [varName, value] of Object.entries(binding)) {
          bytes += varName.length * 2; // UTF-16
          bytes += value.value.length * 2;
          bytes += (value.datatype?.length || 0) * 2;
          bytes += (value.language?.length || 0) * 2;
          bytes += 50; // Object overhead
        }
      }
      break;

    case 'CONSTRUCT':
    case 'DESCRIBE':
      bytes += results.turtle.length * 2; // UTF-16
      break;

    case 'ASK':
      bytes += 4; // Boolean value
      break;
  }

  return bytes;
};

/**
 * Pure function: Create summary statistics for results
 */
export const createResultSummary = (
  results: QueryResults
): {
  type: string;
  count: number;
  truncated: boolean;
  estimatedBytes: number;
} => {
  return {
    type: results.queryType,
    count: results.resultCount,
    truncated: results.truncated,
    estimatedBytes: estimateMemoryUsage(results),
  };
};

// Helper functions (pure)

/**
 * Type guard for Comunica binding entries
 */
const isComunicaBindingEntries = (
  entries: ComunicaBindingEntries | Map<string, Term> | Record<string, Term>
): entries is ComunicaBindingEntries => {
  return (
    typeof entries === 'object' &&
    'size' in entries &&
    'entrySeq' in entries &&
    typeof entries.entrySeq === 'function'
  );
};

/**
 * Format an N3.js Term for binding result format
 */
const formatTermForBinding = (term: Term): ProcessedBinding => {
  const binding: ProcessedBinding = {
    type: getTermType(term),
    value:
      term.termType === 'BlankNode'
        ? term.value.startsWith('_:')
          ? term.value
          : `_:${term.value}`
        : term.value,
  };

  // Only include datatype if it exists and is not a default type
  if ('datatype' in term && term.datatype?.value) {
    const datatypeValue = term.datatype.value;
    // Skip default string datatype and language string datatype
    if (
      datatypeValue !== 'http://www.w3.org/2001/XMLSchema#string' &&
      datatypeValue !== 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString'
    ) {
      binding.datatype = datatypeValue;
    }
  }

  // Only include language if it exists and has a value
  if ('language' in term && term.language) {
    binding.language = term.language;
  }

  return binding;
};

/**
 * Get term type for binding results using N3.js term types
 */
const getTermType = (term: Term): string => {
  switch (term.termType) {
    case 'NamedNode':
      return 'uri';
    case 'BlankNode':
      return 'bnode';
    case 'Literal':
      return 'literal';
    default:
      return 'unknown';
  }
};

/**
 * Format a single quad as turtle (fallback implementation)
 */
const formatQuadAsTurtle = (quad: Quad): string => {
  const subject = formatTermForTurtle(quad.subject);
  const predicate = formatTermForTurtle(quad.predicate);
  const object = formatTermForTurtle(quad.object);

  return `${subject} ${predicate} ${object} .`;
};

/**
 * Format term for turtle output
 */
const formatTermForTurtle = (term: Term): string => {
  switch (term.termType) {
    case 'NamedNode':
      return `<${term.value}>`;
    case 'BlankNode':
      return term.value.startsWith('_:') ? term.value : `_:${term.value}`;
    case 'Literal': {
      let literal = `"${term.value.replace(/"/g, '\\"')}"`;
      if ('language' in term && term.language) {
        literal += `@${term.language}`;
      } else if (
        'datatype' in term &&
        term.datatype &&
        term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string'
      ) {
        literal += `^^<${term.datatype.value}>`;
      }
      return literal;
    }
    default:
      return term.value;
  }
};

/**
 * Extract common prefixes from quads for turtle serialization
 */
const extractPrefixesFromQuads = (
  quads: readonly Quad[]
): Record<string, string> => {
  const prefixes: Record<string, string> = {};
  const namespaces = new Set<string>();

  // Collect unique namespaces
  for (const quad of quads) {
    [quad.subject, quad.predicate, quad.object].forEach(term => {
      if (term.termType === 'NamedNode') {
        const lastHash = term.value.lastIndexOf('#');
        const lastSlash = term.value.lastIndexOf('/');
        const splitIndex = Math.max(lastHash, lastSlash);

        if (splitIndex > 0) {
          const namespace = term.value.substring(0, splitIndex + 1);
          namespaces.add(namespace);
        }
      }
    });
  }

  // Generate simple prefixes
  let prefixCounter = 0;
  for (const namespace of namespaces) {
    prefixes[`ns${prefixCounter++}`] = namespace;
  }

  return prefixes;
};
