import { App, TFile } from 'obsidian';
import { TurtleBlockError } from './MarkdownGraphParser';
import { Logger } from '@/utils/Logger';

/**
 * Service for reporting parsing errors in markdown files
 */
export class MarkdownErrorReporter {
  private app: App;
  private errorContainers = new Map<string, HTMLElement[]>();

  constructor(
    app: App,
    private logger: Logger
  ) {
    this.app = app;
  }

  /**
   * Display turtle parsing errors in a file
   */
  displayTurtleErrors(filePath: string, errors: TurtleBlockError[]): void {
    if (errors.length === 0) {
      this.clearErrors(filePath);
      return;
    }

    // Find the markdown view for this file
    const leaves = this.app.workspace.getLeavesOfType('markdown');
    const targetLeaf = leaves.find(leaf => {
      const file = (leaf.view as { file?: TFile }).file;
      return file && file.path === filePath;
    });

    if (!targetLeaf) {
      this.logger.warn(`Could not find view for file ${filePath}`);
      return;
    }

    const view = targetLeaf.view as { contentEl?: HTMLElement };
    const contentEl = view.contentEl;

    if (!contentEl) {
      this.logger.warn(`Could not find content element for file ${filePath}`);
      return;
    }

    // Clear existing errors
    this.clearErrors(filePath);

    // Create error containers for each failed block
    const containers: HTMLElement[] = [];

    for (const error of errors) {
      const container = this.createErrorContainer(error);
      containers.push(container);

      // Try to find the turtle code block and insert error after it
      const inserted = this.insertErrorAfterTurtleBlock(
        contentEl,
        error,
        container
      );

      if (!inserted) {
        // Fallback: insert at the end of the document
        contentEl.appendChild(container);
      }
    }

    this.errorContainers.set(filePath, containers);
  }

  /**
   * Clear all error displays for a file
   */
  clearErrors(filePath: string): void {
    const containers = this.errorContainers.get(filePath);
    if (containers) {
      for (const container of containers) {
        container.remove();
      }
      this.errorContainers.delete(filePath);
    }
  }

  /**
   * Clear all error displays
   */
  clearAllErrors(): void {
    for (const [filePath] of this.errorContainers) {
      this.clearErrors(filePath);
    }
  }

  /**
   * Create an error display container
   */
  private createErrorContainer(error: TurtleBlockError): HTMLElement {
    const container = document.createElement('div');
    container.classList.add('rdf-turtle-error-container');

    // Error header
    const header = container.appendChild(document.createElement('div'));
    header.classList.add('rdf-error-header');
    header.textContent = `🐢 Turtle Parse Error (Block ${error.blockIndex + 1}, Lines ${error.startLine + 1}-${error.endLine + 1})`;

    // Error message
    const message = container.appendChild(document.createElement('div'));
    message.classList.add('rdf-error-message');
    message.textContent = error.error;

    // Context if available
    if (error.context) {
      const context = container.appendChild(document.createElement('pre'));
      context.classList.add('rdf-error-context');
      context.textContent = error.context;
    }

    // Show problematic content (truncated if long)
    const contentPreview =
      error.content.length > 200
        ? error.content.substring(0, 200) + '...'
        : error.content;

    if (contentPreview.trim()) {
      const content = container.appendChild(document.createElement('details'));
      const summary = content.appendChild(document.createElement('summary'));
      summary.textContent = 'Show turtle content';

      const code = content.appendChild(document.createElement('pre'));
      code.classList.add('rdf-error-content');
      code.textContent = contentPreview;
    }

    return container;
  }

  /**
   * Try to insert an error container after the corresponding turtle block
   */
  private insertErrorAfterTurtleBlock(
    contentEl: HTMLElement,
    error: TurtleBlockError,
    errorContainer: HTMLElement
  ): boolean {
    // Find all turtle code blocks
    const turtleBlocks = Array.from(
      contentEl.querySelectorAll('pre > code.language-turtle')
    );

    if (error.blockIndex >= 0 && error.blockIndex < turtleBlocks.length) {
      const targetBlock = turtleBlocks[error.blockIndex];
      const preElement = targetBlock.parentElement;

      if (preElement && preElement.parentNode) {
        preElement.parentNode.insertBefore(
          errorContainer,
          preElement.nextSibling
        );
        return true;
      }
    }

    return false;
  }

  /**
   * Update error display when file content changes
   */
  async checkAndUpdateErrors(file: TFile): Promise<void> {
    try {
      const content = await this.app.vault.read(file);

      // Use MarkdownGraphParser to check for errors
      const { MarkdownGraphParser } = await import('./MarkdownGraphParser');
      const { PrefixService } = await import('./PrefixService');
      const defaultPrefixes = PrefixService.getCommonPrefixes();

      const parser = new MarkdownGraphParser({
        baseUri: `vault://${encodeURIComponent(file.path.replace(/^\/+/, ''))}`,
        prefixes: defaultPrefixes,
        logger: this.logger,
      });

      const result = await parser.parse(content);

      if (result.errors.length > 0) {
        this.displayTurtleErrors(file.path, result.errors);
      } else {
        this.clearErrors(file.path);
      }
    } catch (error) {
      this.logger.error(`Error checking file ${file.path}:`, error);
    }
  }
}
