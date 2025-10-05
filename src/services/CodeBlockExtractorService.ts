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
   * Create a placeholder TFile for utility methods that don't need real file info
   * Note: vault is intentionally null as these placeholders are never used with vault operations
   */
  private createPlaceholderFile(): TFile {
    return {
      path: '',
      name: '',
      basename: '',
      extension: '',
      stat: { ctime: 0, mtime: 0, size: 0 },
      vault: null as unknown as never,
      parent: null,
    } as TFile;
  }

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
   * Check if content contains code blocks of specified languages
   */
  hasCodeBlocks(
    content: string,
    languages: string[] = ['turtle', 'sparql']
  ): boolean {
    const blocks = this.extractCodeBlocks({
      file: this.createPlaceholderFile(),
      content,
      languages,
    });

    return blocks.length > 0;
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
   * Update existing code block with new content, preserving location
   */
  updateCodeBlock(existingBlock: CodeBlock, newContent: string): CodeBlock {
    return {
      ...existingBlock,
      content: newContent,
    };
  }

  /**
   * Check if a position is within a code block
   */
  isPositionInCodeBlock(
    content: string,
    line: number,
    column: number,
    languages: string[] = ['turtle', 'sparql']
  ): { inBlock: boolean; block?: CodeBlock } {
    const blocks = this.extractCodeBlocks({
      file: this.createPlaceholderFile(),
      content,
      languages,
    });

    for (const block of blocks) {
      const loc = block.location;
      if (
        line >= loc.startLine &&
        line <= loc.endLine &&
        (line !== loc.startLine || column >= loc.startColumn) &&
        (line !== loc.endLine || column <= loc.endColumn)
      ) {
        return { inBlock: true, block };
      }
    }

    return { inBlock: false };
  }

  /**
   * Get statistics about code blocks in content
   */
  getCodeBlockStats(content: string): {
    totalBlocks: number;
    turtleBlocks: number;
    sparqlBlocks: number;
    otherBlocks: number;
  } {
    const allBlocks = this.extractCodeBlocks({
      file: this.createPlaceholderFile(),
      content,
      languages: [], // Extract all languages for stats
    });

    const turtleBlocks = allBlocks.filter(b => b.language === 'turtle').length;
    const sparqlBlocks = allBlocks.filter(b => b.language === 'sparql').length;
    const otherBlocks = allBlocks.length - turtleBlocks - sparqlBlocks;

    return {
      totalBlocks: allBlocks.length,
      turtleBlocks,
      sparqlBlocks,
      otherBlocks,
    };
  }

  /**
   * Create a TurtleBlock from raw content (for callback usage)
   */
  createTurtleBlockFromContent(
    content: string,
    file: TFile,
    startLine: number,
    endLine: number
  ): ReturnType<typeof TurtleBlockFactory.createTurtleBlock> {
    const location: BlockLocation = {
      file,
      startLine,
      endLine,
      startColumn: 0,
      endColumn: 0,
    };

    const createOptions: CreateTurtleBlockOptions = {
      location,
      content,
    };

    return TurtleBlockFactory.createTurtleBlock(createOptions);
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
