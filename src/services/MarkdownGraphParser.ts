import { Parser, Quad } from 'n3';
import { extractTurtleBlocks } from '../utils/parsing';

/**
 * Error information for failed turtle block parsing
 */
export interface TurtleBlockError {
  blockIndex: number;
  startLine: number;
  endLine: number;
  content: string;
  error: string;
  context?: string;
}

/**
 * Parse result from MarkdownGraphParser
 */
export interface MarkdownParseResult {
  success: boolean;
  quads: Quad[];
  prefixes: Record<string, string>;
  errors: TurtleBlockError[];
  totalBlocks: number;
  successfulBlocks: number;
}

/**
 * Options for MarkdownGraphParser
 */
export interface MarkdownGraphParserOptions {
  baseUri?: string;
  format?: string;
  blankNodePrefix?: string;
  prefixes?: Record<string, string>;
}

/**
 * Parser that extracts turtle code blocks from markdown and parses them into RDF quads.
 * Follows the N3.Parser interface for the methods we use.
 */
export class MarkdownGraphParser {
  private options: MarkdownGraphParserOptions;

  constructor(options: MarkdownGraphParserOptions = {}) {
    this.options = {
      baseUri: options.baseUri || '',
      format: 'turtle',
      blankNodePrefix: options.blankNodePrefix || '_:b',
      prefixes: options.prefixes || {},
      ...options,
    };
  }

  /**
   * Parse markdown content and extract all turtle code blocks into RDF quads
   */
  parse(markdownContent: string): Promise<MarkdownParseResult> {
    return new Promise(resolve => {
      const result: MarkdownParseResult = {
        success: true,
        quads: [],
        prefixes: {},
        errors: [],
        totalBlocks: 0,
        successfulBlocks: 0,
      };

      try {
        // Use pure function for extraction
        const pureBlocks = extractTurtleBlocks(markdownContent);
        // Convert to format expected by rest of this method
        const turtleBlocks = pureBlocks.map((block, index) => ({
          index,
          content: block.content,
          startLine: block.startLine,
          endLine: block.endLine,
        }));
        result.totalBlocks = turtleBlocks.length;

        if (turtleBlocks.length === 0) {
          resolve(result);
          return;
        }

        let processedBlocks = 0;

        // Process each turtle block
        for (const block of turtleBlocks) {
          this.parseTurtleBlock(block, result)
            .then(() => {
              processedBlocks++;
              if (processedBlocks === turtleBlocks.length) {
                result.success = result.errors.length === 0;
                resolve(result);
              }
            })
            .catch(error => {
              console.error('Unexpected error parsing turtle block:', error);
              result.errors.push({
                blockIndex: block.index,
                startLine: block.startLine,
                endLine: block.endLine,
                content: block.content,
                error: `Unexpected error: ${error.message}`,
              });
              processedBlocks++;
              if (processedBlocks === turtleBlocks.length) {
                result.success = false;
                resolve(result);
              }
            });
        }
      } catch (error) {
        result.success = false;
        result.errors.push({
          blockIndex: -1,
          startLine: 0,
          endLine: 0,
          content: '',
          error: `Failed to extract turtle blocks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
        resolve(result);
      }
    });
  }

  /**
   * Extract turtle code blocks from markdown content
   */
  private extractTurtleBlocks(markdownContent: string): Array<{
    index: number;
    content: string;
    startLine: number;
    endLine: number;
  }> {
    const blocks: Array<{
      index: number;
      content: string;
      startLine: number;
      endLine: number;
    }> = [];

    const lines = markdownContent.split('\n');
    let inTurtleBlock = false;
    let currentBlock: string[] = [];
    let blockStartLine = -1;
    let blockIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim().startsWith('```turtle')) {
        if (inTurtleBlock) {
          // Malformed - nested blocks, end current block
          if (currentBlock.length > 0) {
            blocks.push({
              index: blockIndex++,
              content: currentBlock.join('\n'),
              startLine: blockStartLine,
              endLine: i - 1,
            });
          }
        }
        inTurtleBlock = true;
        currentBlock = [];
        blockStartLine = i + 1;
      } else if (inTurtleBlock && line.trim().startsWith('```')) {
        // End of turtle block
        blocks.push({
          index: blockIndex++,
          content: currentBlock.join('\n'),
          startLine: blockStartLine,
          endLine: i - 1,
        });
        inTurtleBlock = false;
        currentBlock = [];
        blockStartLine = -1;
      } else if (inTurtleBlock) {
        currentBlock.push(line);
      }
    }

    // Handle unclosed block
    if (inTurtleBlock && currentBlock.length > 0) {
      blocks.push({
        index: blockIndex++,
        content: currentBlock.join('\n'),
        startLine: blockStartLine,
        endLine: lines.length - 1,
      });
    }

    return blocks;
  }

  /**
   * Parse a single turtle block and add results to the overall result
   */
  private async parseTurtleBlock(
    block: {
      index: number;
      content: string;
      startLine: number;
      endLine: number;
    },
    result: MarkdownParseResult
  ): Promise<void> {
    return new Promise(resolve => {
      if (!block.content.trim()) {
        // Empty block - skip but count as successful
        result.successfulBlocks++;
        resolve();
        return;
      }

      // Prepend base URI and default prefixes
      const baseDeclaration = this.options.baseUri
        ? `@base <${this.options.baseUri}> .`
        : '';

      const prefixDeclarations = this.generatePrefixDeclarations(
        this.options.prefixes || {}
      );

      // Combine base, prefixes, and content
      const declarations = [baseDeclaration, prefixDeclarations]
        .filter(Boolean)
        .join('\n');

      const contentWithPrefixes = declarations
        ? declarations + '\n\n' + block.content
        : block.content;

      const parser = new Parser({
        baseIRI: this.options.baseUri,
        format: 'turtle',
        blankNodePrefix: this.options.blankNodePrefix,
      });

      const blockQuads: Quad[] = [];
      let parseError: string | null = null;

      parser.parse(contentWithPrefixes, (error, quad, prefixes) => {
        if (error) {
          parseError = error.message;
          result.errors.push({
            blockIndex: block.index,
            startLine: block.startLine,
            endLine: block.endLine,
            content: block.content,
            error: error.message,
            context: this.extractErrorContext(block.content, error),
          });
          resolve();
          return;
        }

        if (quad) {
          blockQuads.push(quad);
        } else {
          // End of parsing
          if (!parseError) {
            result.quads.push(...blockQuads);
            result.successfulBlocks++;

            // Merge prefixes (convert NamedNode values to strings)
            if (prefixes) {
              const stringPrefixes: Record<string, string> = {};
              for (const [prefix, value] of Object.entries(prefixes)) {
                stringPrefixes[prefix] = value.value;
              }
              result.prefixes = { ...result.prefixes, ...stringPrefixes };
            }
          }
          resolve();
        }
      });
    });
  }

  /**
   * Extract error context from parse error
   */
  private extractErrorContext(
    content: string,
    error: { line?: number; column?: number; message?: string }
  ): string | undefined {
    if (error.line !== undefined) {
      const lines = content.split('\n');
      const errorLine = error.line - 1; // Convert to 0-based
      const contextLines: string[] = [];

      // Add context lines around the error
      for (
        let i = Math.max(0, errorLine - 1);
        i <= Math.min(lines.length - 1, errorLine + 1);
        i++
      ) {
        const prefix = i === errorLine ? '>>> ' : '    ';
        contextLines.push(`${prefix}${i + 1}: ${lines[i]}`);
      }

      if (error.column !== undefined) {
        contextLines.push(
          `     ${' '.repeat(String(errorLine + 1).length + error.column)}^`
        );
      }

      return contextLines.join('\n');
    }

    return undefined;
  }

  /**
   * Get prefixes from the parsed result (N3.Parser compatibility method)
   */
  static getPrefixes(result: MarkdownParseResult): Record<string, string> {
    return result.prefixes;
  }

  /**
   * Get quads from the parsed result (N3.Parser compatibility method)
   */
  static getQuads(result: MarkdownParseResult): Quad[] {
    return result.quads;
  }

  /**
   * Generate prefix declarations in turtle format
   */
  private generatePrefixDeclarations(prefixes: Record<string, string>): string {
    const declarations: string[] = [];

    for (const [prefix, uri] of Object.entries(prefixes)) {
      if (prefix === '') {
        declarations.push(`@prefix : <${uri}> .`);
      } else {
        declarations.push(`@prefix ${prefix}: <${uri}> .`);
      }
    }

    return declarations.join('\n');
  }
}
