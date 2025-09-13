import { App, Component, MarkdownPostProcessorContext, Plugin } from 'obsidian';
import {
  TurtleParseResult,
  TurtleParseError,
} from '../services/TurtleParserService';
import {
  SparqlParseResult,
  SparqlParseError,
} from '../services/SparqlParserService';
import { QueryResults } from '../models/QueryResults';

/**
 * Options for rendering code block results
 */
export interface RenderOptions {
  /** Whether to show detailed error information */
  showDetailedErrors?: boolean;
  /** Whether to show performance metrics */
  showMetrics?: boolean;
  /** Maximum number of result rows to display */
  maxResultRows?: number;
  /** Whether to enable syntax highlighting */
  enableSyntaxHighlighting?: boolean;
}

/**
 * Callback for turtle block processing
 */
export type TurtleBlockCallback = (
  source: string,
  container: HTMLElement,
  ctx: MarkdownPostProcessorContext
) => Promise<void>;

/**
 * Callback for SPARQL block processing
 */
export type SparqlBlockCallback = (
  source: string,
  container: HTMLElement,
  ctx: MarkdownPostProcessorContext
) => Promise<void>;

/**
 * Handles the UI aspects of displaying turtle/SPARQL code blocks and their results
 */
export class CodeBlockProcessor extends Component {
  private turtleCallback?: TurtleBlockCallback;
  private sparqlCallback?: SparqlBlockCallback;

  constructor(
    private app: App,
    private plugin: Plugin
  ) {
    super();
  }

  /**
   * Set the callback for turtle block processing
   */
  setTurtleCallback(callback: TurtleBlockCallback): void {
    this.turtleCallback = callback;
  }

  /**
   * Set the callback for SPARQL block processing
   */
  setSparqlCallback(callback: SparqlBlockCallback): void {
    this.sparqlCallback = callback;
  }

  /**
   * Register Obsidian markdown post-processor to find and enhance existing code blocks
   */
  register(): void {
    console.log('CodeBlockProcessor: Registering markdown post-processor');

    // Register post-processor that runs after native markdown rendering
    this.plugin.registerMarkdownPostProcessor((el, ctx) => {
      console.log('CodeBlockProcessor: Post-processor callback triggered!', {
        sourcePath: ctx.sourcePath,
        elementTag: el.tagName,
      });
      this.processMarkdownContent(el, ctx);
    });

    console.log('CodeBlockProcessor: Post-processor registration complete');

    // ALSO register direct code block processors as a fallback test
    console.log(
      'CodeBlockProcessor: Also registering direct code block processors'
    );

    this.plugin.registerMarkdownCodeBlockProcessor(
      'sparql',
      async (source, el, ctx) => {
        console.log('CodeBlockProcessor: Direct SPARQL processor called!', {
          source: source.substring(0, 50),
        });

        // Restore the original code block (since registerMarkdownCodeBlockProcessor replaces it)
        el.innerHTML = '';
        const preEl = el.ownerDocument.createElement('pre');
        preEl.classList.add('language-sparql');
        const codeEl = el.ownerDocument.createElement('code');
        codeEl.classList.add('language-sparql');
        codeEl.textContent = source;
        preEl.appendChild(codeEl);
        el.appendChild(preEl);

        if (this.sparqlCallback) {
          // Create a container for the results with proper internal structure
          const container = el.ownerDocument.createElement('div');
          container.classList.add('rdf-sparql-results-container');

          // Create the result element that the callback expects
          const resultEl = el.ownerDocument.createElement('div');
          resultEl.classList.add('rdf-sparql-result');
          container.appendChild(resultEl);

          el.appendChild(container);

          console.log(
            'CodeBlockProcessor: Created SPARQL container with result element'
          );
          await this.sparqlCallback(source, container, ctx);
        }
      }
    );
  }

  /**
   * Process rendered markdown content to find and enhance code blocks
   */
  private async processMarkdownContent(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): Promise<void> {
    console.log('CodeBlockProcessor: processMarkdownContent called', {
      sourcePath: ctx.sourcePath,
      elementTag: el.tagName,
      elementClasses: el.className,
      childrenCount: el.children.length,
    });

    // Debug: log all code elements found
    const allCodeElements = Array.from(el.querySelectorAll('code'));
    console.log(
      `CodeBlockProcessor: Found ${allCodeElements.length} total code elements`
    );
    allCodeElements.forEach((code, index) => {
      console.log(`CodeBlockProcessor: Code element ${index}:`, {
        className: code.className,
        textLength: code.textContent?.length || 0,
        parentTag: code.parentElement?.tagName,
        textPreview: (code.textContent || '').substring(0, 50),
      });
    });

    // Find turtle code blocks
    const turtleBlocks = Array.from(
      el.querySelectorAll('pre > code.language-turtle')
    );
    console.log(
      `CodeBlockProcessor: Found ${turtleBlocks.length} turtle blocks`
    );

    for (const codeEl of turtleBlocks) {
      const source = codeEl.textContent || '';
      const preEl = codeEl.parentElement as HTMLElement;
      console.log(
        `CodeBlockProcessor: Processing turtle block with ${source.length} chars`
      );
      await this.processTurtleBlock(source, preEl, ctx);
    }

    // Find SPARQL code blocks
    const sparqlBlocks = Array.from(
      el.querySelectorAll('pre > code.language-sparql')
    );
    console.log(
      `CodeBlockProcessor: Found ${sparqlBlocks.length} SPARQL blocks`
    );

    for (const codeEl of sparqlBlocks) {
      const source = codeEl.textContent || '';
      const preEl = codeEl.parentElement as HTMLElement;
      console.log(
        `CodeBlockProcessor: Processing SPARQL block with ${source.length} chars`
      );
      await this.processSparqlBlock(source, preEl, ctx);
    }
  }

  /**
   * Process a turtle code block
   */
  private async processTurtleBlock(
    source: string,
    preEl: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): Promise<void> {
    // Check if we've already processed this block
    if (
      preEl.nextElementSibling?.classList.contains(
        'rdf-turtle-results-container'
      )
    ) {
      return;
    }

    // Create a container for our results after the native code block
    const container = preEl.ownerDocument.createElement('div');
    container.classList.add('rdf-turtle-results-container');

    // Create placeholder for parse results
    const resultEl = container.appendChild(
      preEl.ownerDocument.createElement('div')
    );
    resultEl.classList.add('rdf-turtle-result');

    // Add data attributes for later processing
    container.setAttribute('data-turtle-content', source);
    container.setAttribute('data-file-path', ctx.sourcePath);

    // Insert after the pre element
    preEl.parentNode?.insertBefore(container, preEl.nextSibling);

    // Call the callback if set
    if (this.turtleCallback) {
      try {
        await this.turtleCallback(source, container, ctx);
      } catch (error) {
        console.error('Error in turtle block callback:', error);
      }
    }
  }

  /**
   * Process a SPARQL code block
   */
  private async processSparqlBlock(
    source: string,
    preEl: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): Promise<void> {
    // Check if we've already processed this block
    if (
      preEl.nextElementSibling?.classList.contains(
        'rdf-sparql-results-container'
      )
    ) {
      return;
    }

    // Create a container for our results after the native code block
    const container = preEl.ownerDocument.createElement('div');
    container.classList.add('rdf-sparql-results-container');

    // Create placeholder for parse/execution results
    const resultEl = container.appendChild(
      preEl.ownerDocument.createElement('div')
    );
    resultEl.classList.add('rdf-sparql-result');

    // Add data attributes for later processing
    container.setAttribute('data-sparql-content', source);
    container.setAttribute('data-file-path', ctx.sourcePath);

    // Insert after the pre element
    preEl.parentNode?.insertBefore(container, preEl.nextSibling);

    // Call the callback if set
    if (this.sparqlCallback) {
      try {
        await this.sparqlCallback(source, container, ctx);
      } catch (error) {
        console.error('Error in SPARQL block callback:', error);
      }
    }
  }

  /**
   * Render turtle parse results
   */
  renderTurtleResult(
    container: HTMLElement,
    result: TurtleParseResult,
    options: RenderOptions = {}
  ): void {
    const resultEl = container.querySelector(
      '.rdf-turtle-result'
    ) as HTMLElement;
    if (!resultEl) {
      console.warn(
        'CodeBlockProcessor: Could not find .rdf-turtle-result element'
      );
      return;
    }

    // Clear previous results
    resultEl.innerHTML = '';
    console.log('CodeBlockProcessor: Rendering turtle result', {
      success: result.success,
    });

    if (result.success) {
      this.renderTurtleSuccess(resultEl, result, options);
    } else {
      this.renderTurtleError(resultEl, result.error!, options);
    }
  }

  /**
   * Render SPARQL parse/execution results
   */
  renderSparqlResult(
    container: HTMLElement,
    parseResult: SparqlParseResult,
    queryResults?: QueryResults,
    options: RenderOptions = {}
  ): void {
    const resultEl = container.querySelector(
      '.rdf-sparql-result'
    ) as HTMLElement;
    if (!resultEl) {
      console.warn(
        'CodeBlockProcessor: Could not find .rdf-sparql-result element'
      );
      return;
    }

    // Clear previous results
    resultEl.innerHTML = '';
    console.log('CodeBlockProcessor: Rendering SPARQL result', {
      parseSuccess: parseResult.success,
      hasQueryResults: !!queryResults,
    });

    // Show parse errors first if any
    if (!parseResult.success) {
      this.renderSparqlError(resultEl, parseResult.error!, options);
      return;
    }

    // Show successful parse info
    if (parseResult.success && !queryResults) {
      this.renderSparqlParseSuccess(resultEl, parseResult, options);
      return;
    }

    // Show query execution results
    if (queryResults) {
      this.renderQueryResults(resultEl, queryResults, options);
    }
  }

  /**
   * Render successful turtle parse
   */
  private renderTurtleSuccess(
    el: HTMLElement,
    result: TurtleParseResult,
    options: RenderOptions
  ): void {
    const successEl = el.createDiv({ cls: 'rdf-result-success' });

    const icon = successEl.createSpan({ cls: 'rdf-result-icon' });
    icon.innerHTML = '✓';

    const message = successEl.createSpan({ cls: 'rdf-result-message' });
    message.textContent = `Parsed ${result.tripleCount} triple${result.tripleCount !== 1 ? 's' : ''}`;

    if (options.showMetrics && result.parseTimeMs !== undefined) {
      const metrics = successEl.createSpan({ cls: 'rdf-result-metrics' });
      metrics.textContent = ` (${result.parseTimeMs}ms)`;
    }

    // Show prefix information if available
    if (result.prefixes && Object.keys(result.prefixes).length > 0) {
      const prefixInfo = el.createDiv({ cls: 'rdf-prefix-info' });
      prefixInfo.textContent = `Prefixes: ${Object.keys(result.prefixes).join(', ')}`;
    }
  }

  /**
   * Render turtle parse error
   */
  private renderTurtleError(
    el: HTMLElement,
    error: TurtleParseError,
    options: RenderOptions
  ): void {
    const errorEl = el.createDiv({ cls: 'rdf-result-error' });

    const icon = errorEl.createSpan({ cls: 'rdf-result-icon' });
    icon.innerHTML = '✗';

    const message = errorEl.createSpan({ cls: 'rdf-result-message' });
    message.textContent = error.message;

    // Show line/column if available
    if (error.line !== undefined && options.showDetailedErrors) {
      const location = errorEl.createDiv({ cls: 'rdf-error-location' });
      location.textContent = `Line ${error.line}${error.column ? `, Column ${error.column}` : ''}`;
    }

    // Show context/suggestions if available
    if (error.context && options.showDetailedErrors) {
      const context = errorEl.createDiv({ cls: 'rdf-error-context' });
      context.textContent = error.context;
    }
  }

  /**
   * Render successful SPARQL parse
   */
  private renderSparqlParseSuccess(
    el: HTMLElement,
    result: SparqlParseResult,
    options: RenderOptions
  ): void {
    const successEl = el.createDiv({ cls: 'rdf-result-success' });

    const icon = successEl.createSpan({ cls: 'rdf-result-icon' });
    icon.innerHTML = '✓';

    const message = successEl.createSpan({ cls: 'rdf-result-message' });
    message.textContent = `Valid ${result.queryType?.toUpperCase()} query`;

    if (options.showMetrics && result.parseTimeMs !== undefined) {
      const metrics = successEl.createSpan({ cls: 'rdf-result-metrics' });
      metrics.textContent = ` (${result.parseTimeMs}ms)`;
    }

    // Show FROM clauses if any
    if (result.fromGraphs && result.fromGraphs.length > 0) {
      const fromInfo = el.createDiv({ cls: 'rdf-from-info' });
      fromInfo.textContent = `FROM: ${result.fromGraphs.join(', ')}`;
    }

    if (result.fromNamedGraphs && result.fromNamedGraphs.length > 0) {
      const fromNamedInfo = el.createDiv({ cls: 'rdf-from-named-info' });
      fromNamedInfo.textContent = `FROM NAMED: ${result.fromNamedGraphs.join(', ')}`;
    }

    // Show warnings if any
    if (result.warnings && result.warnings.length > 0) {
      const warningsEl = el.createDiv({ cls: 'rdf-warnings' });
      for (const warning of result.warnings) {
        const warningEl = warningsEl.createDiv({ cls: 'rdf-warning' });
        warningEl.textContent = `⚠ ${warning}`;
      }
    }
  }

  /**
   * Render SPARQL parse error
   */
  private renderSparqlError(
    el: HTMLElement,
    error: SparqlParseError,
    options: RenderOptions
  ): void {
    const errorEl = el.createDiv({ cls: 'rdf-result-error' });

    const icon = errorEl.createSpan({ cls: 'rdf-result-icon' });
    icon.innerHTML = '✗';

    const message = errorEl.createSpan({ cls: 'rdf-result-message' });
    message.textContent = error.message;

    // Show error type
    if (options.showDetailedErrors) {
      const errorType = errorEl.createDiv({ cls: 'rdf-error-type' });
      errorType.textContent = `Type: ${error.errorType}`;
    }

    // Show line/column if available
    if (error.line !== undefined && options.showDetailedErrors) {
      const location = errorEl.createDiv({ cls: 'rdf-error-location' });
      location.textContent = `Line ${error.line}${error.column ? `, Column ${error.column}` : ''}`;
    }

    // Show problematic token if available
    if (error.token && options.showDetailedErrors) {
      const token = errorEl.createDiv({ cls: 'rdf-error-token' });
      token.textContent = `Token: "${error.token}"`;
    }

    // Show context/suggestions if available
    if (error.context && options.showDetailedErrors) {
      const context = errorEl.createDiv({ cls: 'rdf-error-context' });
      context.textContent = error.context;
    }
  }

  /**
   * Render query execution results
   */
  private renderQueryResults(
    el: HTMLElement,
    results: QueryResults,
    options: RenderOptions
  ): void {
    // Show loading state if executing
    if (results.status === 'executing') {
      const loadingEl = el.createDiv({ cls: 'rdf-result-loading' });
      loadingEl.innerHTML = '⏳ Executing query...';
      return;
    }

    // Show execution error
    if (results.status === 'error') {
      const errorEl = el.createDiv({ cls: 'rdf-result-error' });
      const icon = errorEl.createSpan({ cls: 'rdf-result-icon' });
      icon.innerHTML = '✗';
      const message = errorEl.createSpan({ cls: 'rdf-result-message' });
      message.textContent = results.error || 'Query execution failed';
      return;
    }

    // Show successful results based on query type
    if (results.status === 'completed') {
      this.renderCompletedQueryResults(el, results, options);
    }
  }

  /**
   * Render completed query results based on type
   */
  private renderCompletedQueryResults(
    el: HTMLElement,
    results: QueryResults,
    options: RenderOptions
  ): void {
    const maxRows = options.maxResultRows || 100;

    switch (results.queryType) {
      case 'SELECT': {
        this.renderSelectResults(el, results, maxRows);
        break;
      }
      case 'CONSTRUCT':
      case 'DESCRIBE': {
        this.renderConstructResults(el, results, options);
        break;
      }
      case 'ASK': {
        this.renderAskResults(el, results);
        break;
      }
      default: {
        const unknownEl = el.createDiv({ cls: 'rdf-result-info' });
        unknownEl.textContent = 'Query completed';
        break;
      }
    }

    // Show execution metrics if requested
    if (options.showMetrics && results.executionTimeMs) {
      const metricsEl = el.createDiv({ cls: 'rdf-result-metrics' });
      metricsEl.textContent = `Executed in ${results.executionTimeMs}ms`;
    }
  }

  /**
   * Render SELECT query results as a table
   */
  private renderSelectResults(
    el: HTMLElement,
    results: QueryResults,
    maxRows: number
  ): void {
    if (!results.bindings || results.bindings.length === 0) {
      const emptyEl = el.createDiv({ cls: 'rdf-result-empty' });
      emptyEl.textContent = 'No results';
      return;
    }

    const tableEl = el.createEl('table', { cls: 'rdf-results-table' });

    // Create header
    const headerEl = tableEl.createEl('thead');
    const headerRowEl = headerEl.createEl('tr');

    // Get column names from first result
    const variables = Object.keys(results.bindings[0]);
    for (const variable of variables) {
      const thEl = headerRowEl.createEl('th');
      thEl.textContent = variable;
    }

    // Create body
    const bodyEl = tableEl.createEl('tbody');
    const displayRows = Math.min(results.bindings.length, maxRows);

    for (let i = 0; i < displayRows; i++) {
      const binding = results.bindings[i];
      const rowEl = bodyEl.createEl('tr');

      for (const variable of variables) {
        const tdEl = rowEl.createEl('td');
        const value = binding[variable];
        if (value) {
          tdEl.textContent = this.formatRdfTerm(value);
          if (value.type === 'uri') {
            tdEl.addClass('rdf-uri');
          }
        }
      }
    }

    // Show truncation notice if needed
    if (results.bindings.length > maxRows) {
      const truncationEl = el.createDiv({ cls: 'rdf-truncation-notice' });
      truncationEl.textContent = `Showing first ${maxRows} of ${results.bindings.length} results`;
    }
  }

  /**
   * Render CONSTRUCT/DESCRIBE query results as turtle
   */
  private renderConstructResults(
    el: HTMLElement,
    results: QueryResults,
    options: RenderOptions
  ): void {
    if (!results.turtle) {
      const emptyEl = el.createDiv({ cls: 'rdf-result-empty' });
      emptyEl.textContent = 'No triples returned';
      return;
    }

    const codeEl = el.createEl('pre', { cls: 'rdf-construct-result' });
    const codeContent = codeEl.createEl('code');
    codeContent.textContent = results.turtle;

    if (options.enableSyntaxHighlighting) {
      codeEl.addClass('language-turtle');
    }
  }

  /**
   * Render ASK query results
   */
  private renderAskResults(el: HTMLElement, results: QueryResults): void {
    const resultEl = el.createDiv({ cls: 'rdf-ask-result' });
    const value = results.boolean !== undefined ? results.boolean : false;

    resultEl.textContent = value ? 'true' : 'false';
    resultEl.addClass(value ? 'rdf-ask-true' : 'rdf-ask-false');
  }

  /**
   * Format an RDF term for display
   */
  private formatRdfTerm(term: {
    type: string;
    value: string;
    datatype?: string;
    language?: string;
  }): string {
    if (!term) return '';

    switch (term.type) {
      case 'uri':
        return `<${term.value}>`;
      case 'literal':
        if (
          term.datatype &&
          term.datatype !== 'http://www.w3.org/2001/XMLSchema#string'
        ) {
          return `"${term.value}"^^<${term.datatype}>`;
        } else if (term.language) {
          return `"${term.value}"@${term.language}`;
        } else {
          return `"${term.value}"`;
        }
      case 'bnode':
        return `_:${term.value}`;
      default:
        return term.value || '';
    }
  }
}
