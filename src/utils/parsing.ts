import { Parser, SparqlQuery as ParsedSparqlQuery } from 'sparqljs';
import { Quad, Parser as N3Parser } from 'n3';

/**
 * Pure function types and interfaces for parsing operations
 */

// Re-export types for convenience
export interface SparqlParseError {
  message: string;
  line?: number;
  column?: number;
  token?: string;
  errorType: 'syntax' | 'semantic' | 'unsupported' | 'unknown';
  context?: string;
}

export interface SparqlParseResult {
  success: boolean;
  parsedQuery?: ParsedSparqlQuery;
  error?: SparqlParseError;
  queryType?: string;
  prefixes?: Record<string, string>;
  fromGraphs?: string[];
  fromNamedGraphs?: string[];
  baseUri?: string;
  parseTimeMs: number;
}

export interface SparqlParseOptions {
  baseUri?: string;
  additionalPrefixes?: Record<string, string>;
  allowBlankNodes?: boolean;
}

export interface TurtleBlock {
  content: string;
  startLine: number;
  endLine: number;
  blockIndex: number;
}

export interface TurtleParseResult {
  success: boolean;
  quads?: Quad[];
  error?: {
    message: string;
    line?: number;
    column?: number;
    token?: string;
    context?: string;
  };
  prefixes?: Record<string, string>;
  baseUri?: string;
  tripleCount: number;
  parseTimeMs: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Pure function: Parse SPARQL query string
 * No side effects, no external dependencies, predictable output
 */
export const parseSparqlQuery = (
  queryString: string,
  options: SparqlParseOptions = {}
): SparqlParseResult => {
  const startTime = Date.now();

  // Input validation
  if (!queryString.trim()) {
    return {
      success: false,
      error: {
        message: 'Empty query string',
        errorType: 'syntax',
        context: 'Query cannot be empty',
      },
      parseTimeMs: Date.now() - startTime,
    };
  }

  try {
    // Create parser instance (pure, no shared state)
    const parser = new Parser();

    // Build query with prefixes if provided
    let queryWithPrefixes = queryString;
    if (options.additionalPrefixes) {
      const prefixDeclarations = Object.entries(options.additionalPrefixes)
        .map(([prefix, uri]) => {
          const prefixPart = prefix === '' ? '' : `${prefix}:`;
          return `PREFIX ${prefixPart} <${uri}>`;
        })
        .join('\n');

      if (prefixDeclarations) {
        queryWithPrefixes = `${prefixDeclarations}\n${queryString}`;
      }
    }

    // Parse the query (this is the main parsing logic)
    const parsedQuery = parser.parse(queryWithPrefixes) as ParsedSparqlQuery;

    // Extract information from parsed query (pure transformations)
    const queryType =
      'queryType' in parsedQuery
        ? parsedQuery.queryType?.toUpperCase()
        : undefined;
    const prefixes = extractPrefixesFromParsedQuery(parsedQuery);
    const { fromGraphs, fromNamedGraphs } = extractGraphClauses(parsedQuery);

    return {
      success: true,
      parsedQuery,
      queryType,
      prefixes,
      fromGraphs,
      fromNamedGraphs,
      baseUri: options.baseUri,
      parseTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: createParseError(error, queryString),
      parseTimeMs: Date.now() - startTime,
    };
  }
};

/**
 * Pure function: Extract turtle blocks from markdown content
 */
export const extractTurtleBlocks = (
  markdownContent: string
): readonly TurtleBlock[] => {
  const lines = markdownContent.split('\n');
  const blocks: TurtleBlock[] = [];
  let inTurtleBlock = false;
  let currentBlock: string[] = [];
  let blockStartLine = -1;
  let blockIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith('```turtle')) {
      inTurtleBlock = true;
      blockStartLine = i + 1; // Start after the opening ```turtle
      currentBlock = [];
      continue;
    }

    if (inTurtleBlock && trimmedLine.startsWith('```')) {
      // End of turtle block
      blocks.push({
        content: currentBlock.join('\n'),
        startLine: blockStartLine,
        endLine: i,
        blockIndex: blockIndex++,
      });

      inTurtleBlock = false;
      currentBlock = [];
      blockStartLine = -1;
      continue;
    }

    if (inTurtleBlock) {
      currentBlock.push(line);
    }
  }

  // Handle unclosed blocks
  if (inTurtleBlock && currentBlock.length > 0) {
    blocks.push({
      content: currentBlock.join('\n'),
      startLine: blockStartLine,
      endLine: lines.length,
      blockIndex: blockIndex++,
    });
  }

  return blocks;
};

/**
 * Pure function: Parse turtle content into quads
 */
export const parseTurtleContent = (
  content: string,
  baseUri?: string,
  prefixes: Record<string, string> = {}
): TurtleParseResult => {
  const startTime = Date.now();

  if (!content.trim()) {
    return {
      success: true,
      quads: [],
      prefixes: {},
      tripleCount: 0,
      parseTimeMs: Date.now() - startTime,
    };
  }

  try {
    const parser = new N3Parser({
      baseIRI: baseUri,
      blankNodePrefix: '_:b',
    });

    // Add prefixes to content if provided
    let contentWithPrefixes = content;
    if (Object.keys(prefixes).length > 0) {
      const prefixDeclarations = Object.entries(prefixes)
        .map(([prefix, uri]) => {
          const prefixPart = prefix === '' ? '' : `${prefix}:`;
          return `@prefix ${prefixPart} <${uri}> .`;
        })
        .join('\n');
      contentWithPrefixes = `${prefixDeclarations}\n${content}`;
    }

    const quads = parser.parse(contentWithPrefixes);
    const extractedPrefixes = extractPrefixesFromTurtle(contentWithPrefixes);

    return {
      success: true,
      quads,
      prefixes: extractedPrefixes,
      baseUri,
      tripleCount: quads.length,
      parseTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message:
          error instanceof Error ? error.message : 'Unknown parsing error',
        context: 'Turtle parsing failed',
      },
      tripleCount: 0,
      parseTimeMs: Date.now() - startTime,
    };
  }
};

/**
 * Pure function: Validate SPARQL query structure
 */
export const validateQuery = (
  parsedQuery: ParsedSparqlQuery
): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation rules
  const queryType =
    'queryType' in parsedQuery ? parsedQuery.queryType : undefined;
  if (!queryType) {
    errors.push('Query type is missing');
  }

  const validTypes = ['SELECT', 'CONSTRUCT', 'ASK', 'DESCRIBE'];
  if (queryType && !validTypes.includes(queryType.toUpperCase())) {
    errors.push(`Invalid query type: ${queryType}`);
  }

  // SELECT-specific validation
  if (queryType === 'SELECT' && 'variables' in parsedQuery) {
    if (!parsedQuery.variables || parsedQuery.variables.length === 0) {
      warnings.push('SELECT query has no variables');
    }
  }

  // WHERE clause validation
  if (
    'where' in parsedQuery &&
    (!parsedQuery.where || parsedQuery.where.length === 0)
  ) {
    warnings.push('Query has no WHERE clause');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Pure function: Merge prefix maps with precedence
 */
export const mergePrefixes = (
  ...prefixSets: readonly (Record<string, string> | undefined)[]
): Record<string, string> => {
  const result: Record<string, string> = {};

  // Later prefixes override earlier ones (last wins)
  for (const prefixSet of prefixSets) {
    if (prefixSet) {
      Object.assign(result, prefixSet);
    }
  }

  return result;
};

// Helper functions (pure)

const extractPrefixesFromParsedQuery = (
  parsedQuery: ParsedSparqlQuery
): Record<string, string> => {
  const prefixes: Record<string, string> = {};

  if (parsedQuery.prefixes) {
    Object.assign(prefixes, parsedQuery.prefixes);
  }

  return prefixes;
};

const extractGraphClauses = (
  parsedQuery: ParsedSparqlQuery
): { fromGraphs: string[]; fromNamedGraphs: string[] } => {
  const fromGraphs: string[] = [];
  const fromNamedGraphs: string[] = [];

  if ('from' in parsedQuery && parsedQuery.from) {
    if (
      'default' in parsedQuery.from &&
      Array.isArray(parsedQuery.from.default)
    ) {
      fromGraphs.push(
        ...parsedQuery.from.default.map((graph: { value?: string } | string) =>
          typeof graph === 'string' ? graph : graph.value || ''
        )
      );
    }
    if ('named' in parsedQuery.from && Array.isArray(parsedQuery.from.named)) {
      fromNamedGraphs.push(
        ...parsedQuery.from.named.map((graph: { value?: string } | string) =>
          typeof graph === 'string' ? graph : graph.value || ''
        )
      );
    }
  }

  return { fromGraphs, fromNamedGraphs };
};

const extractPrefixesFromTurtle = (content: string): Record<string, string> => {
  const prefixes: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Match @prefix statements
    const prefixMatch = trimmed.match(/^@prefix\s+([^:]*?):\s*<([^>]+)>\s*\./);
    if (prefixMatch) {
      const [, prefix, uri] = prefixMatch;
      prefixes[prefix.trim()] = uri;
    }
  }

  return prefixes;
};

const createParseError = (
  error: unknown,
  queryString: string
): SparqlParseError => {
  if (error instanceof Error) {
    // Try to extract line/column information from sparqljs errors
    const lineMatch = error.message.match(/line (\d+)/i);
    const columnMatch = error.message.match(/column (\d+)/i);
    const tokenMatch = error.message.match(/unexpected ([^,\s]+)/i);

    return {
      message: error.message,
      line: lineMatch ? parseInt(lineMatch[1], 10) : undefined,
      column: columnMatch ? parseInt(columnMatch[1], 10) : undefined,
      token: tokenMatch ? tokenMatch[1] : undefined,
      errorType: 'syntax',
      context: `Query: ${queryString.substring(0, 100)}${queryString.length > 100 ? '...' : ''}`,
    };
  }

  return {
    message: 'Unknown parsing error',
    errorType: 'unknown',
  };
};
