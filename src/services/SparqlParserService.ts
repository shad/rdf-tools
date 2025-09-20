import { Parser, SparqlQuery as ParsedSparqlQuery } from 'sparqljs';
import { SparqlQuery, MutableSparqlQuery } from '../models/SparqlQuery';
import { PrefixService } from './PrefixService';
import { parseSparqlQuery } from '../utils/parsing';

/**
 * Error information for SPARQL parsing failures
 */
export interface SparqlParseError {
  /** Human-readable error message */
  message: string;
  /** Line number where error occurred (1-based) */
  line?: number;
  /** Column number where error occurred (1-based) */
  column?: number;
  /** The specific token that caused the error */
  token?: string;
  /** Type of SPARQL error */
  errorType: 'syntax' | 'semantic' | 'unsupported' | 'unknown';
  /** Additional context or suggestions */
  context?: string;
}

/**
 * Result of parsing a SPARQL query
 */
export interface SparqlParseResult {
  /** Whether parsing was successful */
  success: boolean;
  /** The parsed query AST (if successful) */
  parsedQuery?: ParsedSparqlQuery;
  /** Parsing error information (if failed) */
  error?: SparqlParseError;
  /** Query type (SELECT, CONSTRUCT, ASK, DESCRIBE) */
  queryType?: string;
  /** Prefixes extracted from the query */
  prefixes?: Record<string, string>;
  /** FROM clause graph URIs */
  fromGraphs?: string[];
  /** FROM NAMED clause graph URIs */
  fromNamedGraphs?: string[];
  /** Time taken to parse (in milliseconds) */
  parseTimeMs: number;
  /** Whether query uses features that might need special handling */
  warnings?: string[];
}

/**
 * Options for parsing SPARQL queries
 */
export interface SparqlParseOptions {
  /** Base URI for relative reference resolution */
  baseUri?: string;
  /** Additional prefixes to merge with query prefixes */
  additionalPrefixes?: Record<string, string>;
  /** Whether to perform extended validation */
  validateExtended?: boolean;
  /** Whether to extract dependency information */
  extractDependencies?: boolean;
}

/**
 * Information about SPARQL query dependencies
 */
export interface SparqlDependencyInfo {
  /** Graph URIs referenced in FROM clauses */
  fromGraphs: string[];
  /** Named graph URIs referenced in FROM NAMED clauses */
  fromNamedGraphs: string[];
  /** Whether query uses GRAPH clauses (needs named graph support) */
  usesNamedGraphs: boolean;
  /** Whether query references external services (SERVICE clauses) */
  usesServices: boolean;
  /** Variables used in the query */
  variables: string[];
  /** Whether this is an update query (INSERT/DELETE) */
  isUpdateQuery: boolean;
}

/**
 * Service for parsing SPARQL queries using sparqljs
 *
 * Handles SPARQL syntax validation, error reporting, and query analysis
 */
export class SparqlParserService {
  private parser: InstanceType<typeof Parser>;

  constructor(private prefixService: PrefixService) {
    this.parser = new Parser();
  }

  /**
   * Parse SPARQL content from a SparqlQuery model
   */
  async parseSparqlQuery(
    query: SparqlQuery,
    options: SparqlParseOptions = {}
  ): Promise<SparqlParseResult> {
    const baseUri = options.baseUri || query.context.baseUri;

    // Merge prefixes from query context with additional prefixes
    const additionalPrefixes = {
      ...query.context.prefixes,
      ...options.additionalPrefixes,
    };

    return this.parseSparqlContent(query.queryString, {
      ...options,
      baseUri,
      additionalPrefixes,
    });
  }

  /**
   * Parse raw SPARQL query string
   */
  async parseSparqlContent(
    queryString: string,
    options: SparqlParseOptions = {}
  ): Promise<SparqlParseResult> {
    const startTime = Date.now();

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
      // Add BASE declaration if baseUri is provided and not already present
      let preprocessedQuery = queryString;
      if (options.baseUri && !queryString.toLowerCase().includes('base')) {
        preprocessedQuery = `BASE <${options.baseUri}>\n${queryString}`;
      }

      // Add common prefixes if not already present
      const expandedQuery = this.addMissingPrefixes(
        preprocessedQuery,
        options.additionalPrefixes
      );

      // Use pure parsing function instead of direct sparqljs
      const parseResult = parseSparqlQuery(expandedQuery, {
        baseUri: options.baseUri,
        additionalPrefixes: {}, // Prefixes already added above
      });

      if (!parseResult.success) {
        return {
          success: false,
          error: parseResult.error,
          parseTimeMs: parseResult.parseTimeMs,
        };
      }

      // Add service-specific warnings that the pure function doesn't handle
      const warnings: string[] = [];
      if (parseResult.queryType === 'UPDATE') {
        warnings.push('Update queries may modify data - use with caution');
      }

      return {
        success: true,
        parsedQuery: parseResult.parsedQuery,
        queryType: parseResult.queryType,
        prefixes: parseResult.prefixes,
        fromGraphs: parseResult.fromGraphs,
        fromNamedGraphs: parseResult.fromNamedGraphs,
        parseTimeMs: parseResult.parseTimeMs,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      const parseTimeMs = Date.now() - startTime;
      return {
        success: false,
        error: this.convertSparqlJsError(error),
        parseTimeMs,
      };
    }
  }

  /**
   * Validate SPARQL syntax without full parsing (quick check)
   */
  async validateSparqlSyntax(
    queryString: string,
    baseUri?: string
  ): Promise<boolean> {
    try {
      const result = await this.parseSparqlContent(queryString, { baseUri });
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Extract dependency information from a parsed SPARQL query
   */
  extractDependencies(parsedQuery: ParsedSparqlQuery): SparqlDependencyInfo {
    let fromGraphs: string[] = [];
    let fromNamedGraphs: string[] = [];
    let usesNamedGraphs = false;
    let usesServices = false;
    const variables = new Set<string>();
    const isUpdateQuery = parsedQuery.type === 'update';

    // Extract FROM clauses
    if ('from' in parsedQuery) {
      if (parsedQuery.from?.default) {
        fromGraphs = parsedQuery.from.default.map(g => g.value);
      }
      if (parsedQuery.from?.named) {
        fromNamedGraphs = parsedQuery.from.named.map(g => g.value);
        usesNamedGraphs = true;
      }
    }

    // Extract variables (basic extraction)
    const queryStr = JSON.stringify(parsedQuery);
    const variableMatches = queryStr.match(/\?\w+/g);
    if (variableMatches) {
      variableMatches.forEach(v => variables.add(v));
    }

    // Check for SERVICE clauses
    if (queryStr.includes('"service"') || queryStr.includes('SERVICE')) {
      usesServices = true;
    }

    // Check for GRAPH clauses
    if (queryStr.includes('"graph"') || queryStr.includes('GRAPH')) {
      usesNamedGraphs = true;
    }

    return {
      fromGraphs,
      fromNamedGraphs,
      usesNamedGraphs,
      usesServices,
      variables: Array.from(variables),
      isUpdateQuery,
    };
  }

  /**
   * Update a mutable SPARQL query with parse results
   */
  updateSparqlQueryWithParseResults(
    query: MutableSparqlQuery,
    parseResult: SparqlParseResult
  ): void {
    // Update parsing results
    query.parsedQuery = parseResult.parsedQuery;
    query.parseError = parseResult.error?.message;
    query.lastModified = new Date();

    // Update context with extracted information
    if (parseResult.success && parseResult.fromGraphs) {
      query.context.fromGraphs = parseResult.fromGraphs;
    }
    if (parseResult.success && parseResult.fromNamedGraphs) {
      query.context.fromNamedGraphs = parseResult.fromNamedGraphs;
    }
    if (parseResult.success && parseResult.prefixes) {
      query.context.prefixes = {
        ...query.context.prefixes,
        ...parseResult.prefixes,
      };
    }

    // Update dependencies if we have a parsed query
    if (parseResult.success && parseResult.parsedQuery) {
      const deps = this.extractDependencies(parseResult.parsedQuery);

      // Update dependency information
      query.dependencies.dependsOnGraphs.clear();
      deps.fromGraphs.forEach(g => query.dependencies.dependsOnGraphs.add(g));
      deps.fromNamedGraphs.forEach(g =>
        query.dependencies.dependsOnGraphs.add(g)
      );

      query.dependencies.lastAnalyzed = new Date();

      // Check for vault:// URIs to set file dependencies
      [...deps.fromGraphs, ...deps.fromNamedGraphs].forEach(uri => {
        if (uri.startsWith('vault://')) {
          const path = uri.replace('vault://', '').replace(/\/$/, '');
          if (path.endsWith('/')) {
            query.dependencies.dependsOnDirectories.add(path);
          } else if (path === '') {
            query.dependencies.dependsOnVault = true;
          } else {
            query.dependencies.dependsOnFiles.add(path);
          }
        }
      });
    }
  }

  /**
   * Get query statistics and analysis
   */
  async getSparqlQueryStats(queryString: string): Promise<{
    valid: boolean;
    queryType?: string;
    prefixCount: number;
    variableCount: number;
    hasFromClauses: boolean;
    hasSubqueries: boolean;
    hasOptional: boolean;
    hasUnion: boolean;
    hasFilters: boolean;
    estimatedComplexity: 'low' | 'medium' | 'high';
    parseTimeMs: number;
  }> {
    const result = await this.parseSparqlContent(queryString);

    if (!result.success) {
      return {
        valid: false,
        prefixCount: 0,
        variableCount: 0,
        hasFromClauses: false,
        hasSubqueries: false,
        hasOptional: false,
        hasUnion: false,
        hasFilters: false,
        estimatedComplexity: 'low',
        parseTimeMs: result.parseTimeMs,
      };
    }

    const queryStr = queryString.toLowerCase();
    const variableMatches = queryString.match(/\?\w+/g);
    const variableCount = variableMatches ? new Set(variableMatches).size : 0;

    // Estimate complexity based on query features
    let complexityScore = 0;
    if (queryStr.includes('optional')) complexityScore += 2;
    if (queryStr.includes('union')) complexityScore += 2;
    if (queryStr.includes('filter')) complexityScore += 1;
    if (
      queryStr.includes('subquery') ||
      (queryStr.includes('{') && queryStr.includes('}'))
    )
      complexityScore += 3;
    if (variableCount > 5) complexityScore += 1;
    if (result.fromGraphs && result.fromGraphs.length > 1) complexityScore += 1;

    let estimatedComplexity: 'low' | 'medium' | 'high' = 'low';
    if (complexityScore >= 5) {
      estimatedComplexity = 'high';
    } else if (complexityScore >= 2) {
      estimatedComplexity = 'medium';
    }

    return {
      valid: true,
      queryType: result.queryType,
      prefixCount: Object.keys(result.prefixes || {}).length,
      variableCount,
      hasFromClauses:
        (result.fromGraphs && result.fromGraphs.length > 0) ||
        (result.fromNamedGraphs && result.fromNamedGraphs.length > 0) ||
        false,
      hasSubqueries:
        queryStr.includes('subquery') ||
        (queryStr.match(/{[^}]*{/g) || []).length > 0,
      hasOptional: queryStr.includes('optional'),
      hasUnion: queryStr.includes('union'),
      hasFilters: queryStr.includes('filter'),
      estimatedComplexity,
      parseTimeMs: result.parseTimeMs,
    };
  }

  /**
   * Add global prefixes to query if not already present
   */
  private addMissingPrefixes(
    queryString: string,
    additionalPrefixes?: Record<string, string>
  ): string {
    const globalPrefixes = {
      ...this.prefixService.getGlobalPrefixes(),
      ...additionalPrefixes,
    };

    // Extract existing prefixes from query
    const existingPrefixes = new Set<string>();
    const prefixRegex = /PREFIX\s+(\w+)?:\s*</gi;
    let match;
    while ((match = prefixRegex.exec(queryString)) !== null) {
      existingPrefixes.add(match[1] || '');
    }

    // Find prefixes that are used but not defined
    const usedPrefixes = new Set<string>();
    const curieRegex = /(\w+):/g;
    while ((match = curieRegex.exec(queryString)) !== null) {
      const prefix = match[1];
      if (
        prefix !== 'http' &&
        prefix !== 'https' &&
        prefix !== 'file' &&
        prefix !== 'ftp'
      ) {
        usedPrefixes.add(prefix);
      }
    }

    // Add missing prefixes
    const missingPrefixes: string[] = [];
    for (const usedPrefix of usedPrefixes) {
      if (!existingPrefixes.has(usedPrefix) && globalPrefixes[usedPrefix]) {
        missingPrefixes.push(
          `PREFIX ${usedPrefix}: <${globalPrefixes[usedPrefix]}>`
        );
      }
    }

    if (missingPrefixes.length > 0) {
      return missingPrefixes.join('\n') + '\n\n' + queryString;
    }

    return queryString;
  }

  /**
   * Convert sparqljs parsing error to our error format
   */
  private convertSparqlJsError(error: Error): SparqlParseError {
    const message = error.message || 'Unknown SPARQL parsing error';

    // Try to extract position information
    let line: number | undefined;
    let column: number | undefined;
    let token: string | undefined;

    // Parse common sparqljs error formats
    const locationMatch = message.match(/line (\d+), column (\d+)/i);
    if (locationMatch) {
      line = parseInt(locationMatch[1], 10);
      column = parseInt(locationMatch[2], 10);
    }

    const tokenMatch =
      message.match(/unexpected token "([^"]+)"/i) ||
      message.match(/expected "([^"]+)"/i);
    if (tokenMatch) {
      token = tokenMatch[1];
    }

    // Determine error type
    let errorType: SparqlParseError['errorType'] = 'unknown';
    if (message.toLowerCase().includes('syntax')) {
      errorType = 'syntax';
    } else if (message.toLowerCase().includes('semantic')) {
      errorType = 'semantic';
    } else if (message.toLowerCase().includes('unsupported')) {
      errorType = 'unsupported';
    }

    // Provide helpful context based on common errors
    let context: string | undefined;
    if (message.toLowerCase().includes('unexpected')) {
      context =
        'Check query syntax - ensure proper punctuation and keyword usage';
    } else if (message.toLowerCase().includes('prefix')) {
      context = 'Verify prefix declarations: PREFIX name: <uri>';
    } else if (message.toLowerCase().includes('variable')) {
      context = 'Variables must start with ? or $ (e.g., ?variable)';
    } else if (message.toLowerCase().includes('expected')) {
      context = 'Missing required SPARQL keyword or syntax element';
    }

    return {
      message,
      line,
      column,
      token,
      errorType,
      context,
    };
  }
}
