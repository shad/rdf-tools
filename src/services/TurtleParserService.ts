import { Parser, Store, DataFactory, Quad } from 'n3';
import { TurtleBlock, MutableTurtleBlock } from '../models/TurtleBlock';
import { PrefixService } from './PrefixService';

/**
 * Error information for turtle parsing failures
 */
export interface TurtleParseError {
  /** Human-readable error message */
  message: string;
  /** Line number where error occurred (1-based) */
  line?: number;
  /** Column number where error occurred (1-based) */
  column?: number;
  /** The specific token or text that caused the error */
  token?: string;
  /** Additional context or suggestions */
  context?: string;
}

/**
 * Result of parsing a turtle block
 */
export interface TurtleParseResult {
  /** Whether parsing was successful */
  success: boolean;
  /** The parsed RDF quads (if successful) */
  quads?: Quad[];
  /** The N3.js store containing the parsed data (if successful) */
  store?: Store;
  /** Parsing error information (if failed) */
  error?: TurtleParseError;
  /** Prefixes extracted from the turtle content */
  prefixes?: Record<string, string>;
  /** Base URI used during parsing */
  baseUri?: string;
  /** Number of triples parsed */
  tripleCount: number;
  /** Time taken to parse (in milliseconds) */
  parseTimeMs: number;
}

/**
 * Options for parsing turtle content
 */
export interface TurtleParseOptions {
  /** Base URI for relative reference resolution */
  baseUri?: string;
  /** Additional prefixes to make available during parsing */
  additionalPrefixes?: Record<string, string>;
  /** Whether to include parsing performance metrics */
  includeMetrics?: boolean;
  /** Maximum number of triples to parse (for large files) */
  maxTriples?: number;
}

/**
 * Service for parsing Turtle RDF content using N3.js
 *
 * Handles turtle syntax validation, error reporting, and RDF quad extraction
 */
export class TurtleParserService {
  constructor(private prefixService: PrefixService) {}

  /**
   * Parse turtle content from a TurtleBlock
   */
  async parseTurtleBlock(
    block: TurtleBlock,
    options: TurtleParseOptions = {}
  ): Promise<TurtleParseResult> {
    const baseUri = options.baseUri || block.baseUri;
    return this.parseTurtleContent(block.content, {
      ...options,
      baseUri,
    });
  }

  /**
   * Parse raw turtle content string
   */
  async parseTurtleContent(
    content: string,
    options: TurtleParseOptions = {}
  ): Promise<TurtleParseResult> {
    const startTime = Date.now();

    try {
      // Extract prefixes from the content
      const extractedPrefixes =
        this.prefixService.extractPrefixesFromTurtle(content);

      // Get global prefixes from the prefix service (user settings)
      const globalPrefixes = this.prefixService.getGlobalPrefixes();

      // Merge prefixes: global -> extracted -> additional (later ones override earlier ones)
      const allPrefixes = {
        ...globalPrefixes,
        ...extractedPrefixes,
        ...options.additionalPrefixes,
      };

      // Prepend global prefixes to content if they're not already there
      const prefixDeclarations = Object.entries(globalPrefixes)
        .filter(([prefix]) => !content.includes(`@prefix ${prefix}:`))
        .map(([prefix, uri]) => `@prefix ${prefix}: <${uri}> .`)
        .join('\n');

      const contentWithPrefixes = prefixDeclarations
        ? `${prefixDeclarations}\n\n${content}`
        : content;

      // Create N3.js parser with base URI
      const parser = new Parser({
        baseIRI: options.baseUri,
      });

      // Parse the content
      const quads: Quad[] = [];
      let tripleCount = 0;

      return new Promise(resolve => {
        parser.parse(contentWithPrefixes, (error, quad, prefixes) => {
          if (error) {
            const parseTimeMs = Date.now() - startTime;
            resolve({
              success: false,
              error: this.convertN3Error(error),
              tripleCount: 0,
              parseTimeMs,
            });
            return;
          }

          if (quad) {
            // Check max triples limit
            if (options.maxTriples && tripleCount >= options.maxTriples) {
              const parseTimeMs = Date.now() - startTime;
              resolve({
                success: false,
                error: {
                  message: `Maximum triple limit exceeded (${options.maxTriples})`,
                  context:
                    'Consider breaking large turtle files into smaller chunks',
                },
                tripleCount,
                parseTimeMs,
              });
              return;
            }

            quads.push(quad);
            tripleCount++;
          } else {
            // Parsing completed successfully
            const parseTimeMs = Date.now() - startTime;

            // Create N3.js store with the quads
            const store = new Store(quads);

            resolve({
              success: true,
              quads,
              store,
              prefixes: {
                ...allPrefixes,
                ...Object.fromEntries(
                  Object.entries(prefixes || {}).map(([k, v]) => [
                    k,
                    typeof v === 'string' ? v : v.value,
                  ])
                ),
              },
              baseUri: options.baseUri,
              tripleCount,
              parseTimeMs,
            });
          }
        });
      });
    } catch (error) {
      const parseTimeMs = Date.now() - startTime;
      return {
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : 'Unknown parsing error',
          context: 'Unexpected error during turtle parsing',
        },
        tripleCount: 0,
        parseTimeMs,
      };
    }
  }

  /**
   * Validate turtle syntax without full parsing (quick check)
   */
  async validateTurtleSyntax(
    content: string,
    baseUri?: string
  ): Promise<boolean> {
    try {
      const result = await this.parseTurtleContent(content, { baseUri });
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Update a mutable turtle block with parse results
   */
  updateTurtleBlockWithParseResults(
    block: MutableTurtleBlock,
    parseResult: TurtleParseResult
  ): void {
    // Update last modified time
    block.lastModified = new Date();

    // Note: Parse results are not stored in the model itself
    // They should be managed by a higher-level service
    // This method exists for potential future use
  }

  /**
   * Extract all URIs referenced in turtle content
   */
  async extractReferencedUris(
    content: string,
    baseUri?: string
  ): Promise<string[]> {
    const result = await this.parseTurtleContent(content, { baseUri });

    if (!result.success || !result.quads) {
      return [];
    }

    const uris = new Set<string>();

    for (const quad of result.quads) {
      // Add subject URI if it's a named node
      if (quad.subject.termType === 'NamedNode') {
        uris.add(quad.subject.value);
      }

      // Add predicate URI (should always be a named node)
      if (quad.predicate.termType === 'NamedNode') {
        uris.add(quad.predicate.value);
      }

      // Add object URI if it's a named node
      if (quad.object.termType === 'NamedNode') {
        uris.add(quad.object.value);
      }

      // Add graph URI if it's a named node
      if (quad.graph.termType === 'NamedNode') {
        uris.add(quad.graph.value);
      }
    }

    return Array.from(uris);
  }

  /**
   * Check if turtle content contains specific triples
   */
  async containsTriple(
    content: string,
    subject?: string,
    predicate?: string,
    object?: string,
    baseUri?: string
  ): Promise<boolean> {
    const result = await this.parseTurtleContent(content, { baseUri });

    if (!result.success || !result.store) {
      return false;
    }

    const subjectTerm = subject ? DataFactory.namedNode(subject) : null;
    const predicateTerm = predicate ? DataFactory.namedNode(predicate) : null;
    const objectTerm = object ? DataFactory.namedNode(object) : null;

    const matches = result.store.getQuads(
      subjectTerm,
      predicateTerm,
      objectTerm,
      null
    );
    return matches.length > 0;
  }

  /**
   * Get parsing statistics for turtle content
   */
  async getTurtleStats(
    content: string,
    baseUri?: string
  ): Promise<{
    valid: boolean;
    tripleCount: number;
    uniqueSubjects: number;
    uniquePredicates: number;
    uniqueObjects: number;
    prefixCount: number;
    parseTimeMs: number;
  }> {
    const result = await this.parseTurtleContent(content, { baseUri });

    if (!result.success) {
      return {
        valid: false,
        tripleCount: 0,
        uniqueSubjects: 0,
        uniquePredicates: 0,
        uniqueObjects: 0,
        prefixCount: 0,
        parseTimeMs: result.parseTimeMs,
      };
    }

    const subjects = new Set<string>();
    const predicates = new Set<string>();
    const objects = new Set<string>();

    if (result.quads) {
      for (const quad of result.quads) {
        subjects.add(quad.subject.value);
        predicates.add(quad.predicate.value);
        objects.add(quad.object.value);
      }
    }

    return {
      valid: true,
      tripleCount: result.tripleCount,
      uniqueSubjects: subjects.size,
      uniquePredicates: predicates.size,
      uniqueObjects: objects.size,
      prefixCount: Object.keys(result.prefixes || {}).length,
      parseTimeMs: result.parseTimeMs,
    };
  }

  /**
   * Convert N3.js parsing error to our error format
   */
  private convertN3Error(error: Error): TurtleParseError {
    const message = error.message || 'Unknown parsing error';

    // Try to extract line/column info from N3.js error
    const lineMatch = message.match(/line (\d+)/i);
    const columnMatch = message.match(/column (\d+)/i);

    const line = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
    const column = columnMatch ? parseInt(columnMatch[1], 10) : undefined;

    // Extract token if available
    const tokenMatch = message.match(/unexpected "([^"]+)"/i);
    const token = tokenMatch ? tokenMatch[1] : undefined;

    // Provide helpful context based on common errors
    let context: string | undefined;
    if (message.toLowerCase().includes('unexpected')) {
      context =
        'Check for missing punctuation (. ; ,) or unclosed brackets/quotes';
    } else if (message.toLowerCase().includes('prefix')) {
      context =
        'Verify prefix declarations use the format: @prefix name: <uri> .';
    } else if (message.toLowerCase().includes('uri')) {
      context = 'Ensure URIs are properly enclosed in angle brackets < >';
    }

    return {
      message,
      line,
      column,
      token,
      context,
    };
  }
}
