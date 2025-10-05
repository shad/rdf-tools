import { TFile } from 'obsidian';
import {
  BlockLocation,
  CreateTurtleBlockOptions,
  TurtleBlockFactory,
} from '../models/TurtleBlock';
import {
  CreateSparqlQueryOptions,
  SparqlQueryFactory,
} from '../models/SparqlQuery';

/**
 * Represents a code block found in markdown content
 */
export interface CodeBlock {
  /** The language/type of the code block */
  language: string;
  /** The content within the code block */
  content: string;
  /** Location information */
  location: BlockLocation;
}

/**
 * Options for extracting code blocks
 */
export interface ExtractCodeBlocksOptions {
  /** The file being processed */
  file: TFile;
  /** The markdown content to parse */
  content: string;
  /** Languages to extract (default: ['turtle', 'sparql']) */
  languages?: string[];
}

/**
 * Service for extracting turtle and SPARQL code blocks from markdown files
 *
 * This service focuses purely on extraction - parsing is handled by other services
 */
export class CodeBlockExtractorService {
  private readonly codeBlockRegex = /```(\w+)\n([\s\S]*?)\n```/g;

  /**
   * Extract code blocks of specified languages from markdown content
   */
  extractCodeBlocks(options: ExtractCodeBlocksOptions): CodeBlock[] {
    const { file, content, languages = ['turtle', 'sparql'] } = options;
    const blocks: CodeBlock[] = [];
    // const lines = content.split('\n'); // Not needed for regex approach

    this.codeBlockRegex.lastIndex = 0; // Reset regex state
    let match;

    while ((match = this.codeBlockRegex.exec(content)) !== null) {
      const language = match[1].toLowerCase();
      const blockContent = match[2];
      const matchStart = match.index;

      // Check if this language should be extracted
      if (!languages.includes(language)) {
        continue;
      }

      // Find the line and column positions
      const location = this.findBlockLocation(
        content,
        matchStart,
        match[0],
        file
      );

      blocks.push({
        language,
        content: blockContent,
        location,
      });
    }

    return blocks;
  }

  /**
   * Extract only turtle code blocks and convert to TurtleBlock models
   */
  extractTurtleBlocks(
    options: ExtractCodeBlocksOptions
  ): ReturnType<typeof TurtleBlockFactory.createTurtleBlock>[] {
    const codeBlocks = this.extractCodeBlocks({
      ...options,
      languages: ['turtle'],
    });

    return codeBlocks.map(block => {
      const createOptions: CreateTurtleBlockOptions = {
        location: block.location,
        content: block.content,
      };

      return TurtleBlockFactory.createTurtleBlock(createOptions);
    });
  }

  /**
   * Get the line and column positions where a code block starts and ends
   */
  private findBlockLocation(
    fullContent: string,
    matchStart: number,
    matchText: string,
    file: TFile
  ): BlockLocation {
    const lines = fullContent.split('\n');
    let charCount = 0;
    let startLine = 0;
    let startColumn = 0;

    // Find starting position
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + 1; // +1 for newline

      if (charCount + lineLength > matchStart) {
        startLine = i;
        startColumn = matchStart - charCount;
        break;
      }

      charCount += lineLength;
    }

    // Find ending position
    const matchEnd = matchStart + matchText.length;
    charCount = 0;
    let endLine = 0;
    let endColumn = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length + 1; // +1 for newline

      if (charCount + lineLength >= matchEnd) {
        endLine = i;
        endColumn = matchEnd - charCount;
        break;
      }

      charCount += lineLength;
    }

    return {
      file,
      startLine,
      endLine,
      startColumn,
      endColumn,
    };
  }

  /**
   * Create a SparqlQuery from raw content (for callback usage)
   */
  createSparqlQueryFromContent(
    queryString: string,
    file: TFile,
    startLine: number,
    endLine: number
  ): ReturnType<typeof SparqlQueryFactory.createSparqlQuery> {
    const location: BlockLocation = {
      file,
      startLine,
      endLine,
      startColumn: 0,
      endColumn: 0,
    };

    const createOptions: CreateSparqlQueryOptions = {
      location,
      queryString,
    };

    return SparqlQueryFactory.createSparqlQuery(createOptions);
  }
}
