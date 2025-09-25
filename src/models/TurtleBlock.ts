import { TFile } from 'obsidian';

/**
 * Location information for a code block within a markdown file
 */
export interface BlockLocation {
  /** The source file containing this block */
  readonly file: TFile;
  /** Starting line number (0-based) */
  readonly startLine: number;
  /** Ending line number (0-based) */
  readonly endLine: number;
  /** Starting column within the start line (0-based) */
  readonly startColumn: number;
  /** Ending column within the end line (0-based) */
  readonly endColumn: number;
}

/**
 * A turtle code block found in a markdown file
 *
 * This is a simple container - actual parsing is handled by N3.js
 */
export interface TurtleBlock {
  /** Unique identifier for this block */
  readonly id: string;

  /** Location of this block in the source file */
  readonly location: BlockLocation;

  /** The raw turtle content within the code block */
  readonly content: string;

  /** Base URI for resolving relative references in this block */
  readonly baseUri: string;

  /** When this block was first discovered */
  readonly createdAt: Date;

  /** When this block was last modified */
  readonly lastModified: Date;

  /** Hash of the current content for change detection */
  readonly contentHash: string;
}

/**
 * Mutable version of TurtleBlock for internal updates
 */
export interface MutableTurtleBlock
  extends Omit<TurtleBlock, 'lastModified' | 'contentHash'> {
  lastModified: Date;
  contentHash: string;
}

/**
 * Options for creating a new turtle block
 */
export interface CreateTurtleBlockOptions {
  /** Location information for the block */
  location: BlockLocation;
  /** The turtle content */
  content: string;
  /** Base URI for relative reference resolution */
  baseUri?: string;
}

/**
 * Factory and utility functions for turtle blocks
 */
export class TurtleBlockFactory {
  /**
   * Generate a unique ID for a turtle block
   */
  static generateBlockId(location: BlockLocation): string {
    const filePath = location.file.path;
    const position = `${location.startLine}-${location.startColumn}`;
    return `turtle-block:${filePath}:${position}`;
  }

  /**
   * Create a content hash for change detection
   */
  static createContentHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Generate base URI from file path
   */
  static generateBaseUri(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
    return `vault://${normalizedPath}/`;
  }

  /**
   * Create a new turtle block
   */
  static createTurtleBlock(
    options: CreateTurtleBlockOptions
  ): MutableTurtleBlock {
    const id = TurtleBlockFactory.generateBlockId(options.location);
    const baseUri =
      options.baseUri ||
      TurtleBlockFactory.generateBaseUri(options.location.file.path);
    const contentHash = TurtleBlockFactory.createContentHash(options.content);
    const now = new Date();

    return {
      id,
      location: options.location,
      content: options.content,
      baseUri,
      createdAt: now,
      lastModified: now,
      contentHash,
    };
  }
}

/**
 * Utility functions for working with turtle blocks
 */
export class TurtleBlockUtils {
  /**
   * Check if a turtle block needs to be reparsed
   */
  static needsReparse(block: TurtleBlock, newContent: string): boolean {
    const newHash = TurtleBlockFactory.createContentHash(newContent);
    return block.contentHash !== newHash;
  }

  /**
   * Check if the turtle block is at a specific location
   */
  static isAtLocation(
    block: TurtleBlock,
    line: number,
    column: number
  ): boolean {
    const loc = block.location;
    return (
      line >= loc.startLine &&
      line <= loc.endLine &&
      (line !== loc.startLine || column >= loc.startColumn) &&
      (line !== loc.endLine || column <= loc.endColumn)
    );
  }

  /**
   * Create a location string for debugging
   */
  static getLocationString(block: TurtleBlock): string {
    const loc = block.location;
    return `${loc.file.path}:${loc.startLine + 1}:${loc.startColumn + 1}`;
  }

  /**
   * Check if content appears to contain valid turtle syntax (basic check)
   */
  static looksLikeTurtle(content: string): boolean {
    const trimmed = content.trim();
    if (!trimmed) return false;

    // Basic heuristics for turtle content
    return (
      trimmed.includes('@prefix') ||
      trimmed.includes('@base') ||
      trimmed.includes('<') ||
      trimmed.includes(':') ||
      /^\w+:\w+/.test(trimmed) // Looks like a CURIE
    );
  }
}
