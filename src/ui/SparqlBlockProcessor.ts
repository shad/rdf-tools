import {
  App,
  Component,
  MarkdownPostProcessorContext,
  Plugin,
  TFile,
  MarkdownView,
} from 'obsidian';
import {
  SparqlParseResult,
  SparqlParseError,
} from '@/services/SparqlParserService';
import { QueryResults } from '@/models';
import type { PrefixService } from '@/services/PrefixService';
import { formatLiteralForDisplay } from '@/utils/literal-formatting';

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
 * Callback for SPARQL block processing
 */
export type SparqlBlockCallback = (
  source: string,
  container: HTMLElement,
  ctx: MarkdownPostProcessorContext
) => Promise<void>;

/**
 * Handles the UI aspects of displaying SPARQL code blocks and their results
 */
export class SparqlBlockProcessor extends Component {
  private sparqlCallback?: SparqlBlockCallback;

  constructor(
    private app: App,
    private plugin: Plugin,
    private rdfService?: { getPrefixService(): PrefixService }
  ) {
    super();
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
    // Register direct code block processor for SPARQL blocks
    this.plugin.registerMarkdownCodeBlockProcessor(
      'sparql',
      async (source, el, ctx) => {
        // Hide the original code block and replace with minimal clickable area
        el.innerHTML = '';
        const container = el.ownerDocument.createElement('div');
        container.classList.add('rdf-sparql-container');

        // Create a minimal clickable header to edit the query
        const editHeader = el.ownerDocument.createElement('div');
        editHeader.classList.add('rdf-sparql-edit-header');
        editHeader.textContent = 'View query';
        editHeader.style.cursor = 'pointer';
        editHeader.title = 'Click to edit query';

        // Add click handler for edit functionality
        editHeader.addEventListener('click', () => {
          this.handleSparqlEdit(source, ctx);
        });

        container.appendChild(editHeader);

        if (this.sparqlCallback) {
          // Create a container for the results with proper internal structure
          const resultsContainer = el.ownerDocument.createElement('div');
          resultsContainer.classList.add('rdf-sparql-results-container');

          // Create the result element that the callback expects
          const resultEl = el.ownerDocument.createElement('div');
          resultEl.classList.add('rdf-sparql-result');
          resultsContainer.appendChild(resultEl);

          container.appendChild(resultsContainer);

          await this.sparqlCallback(source, resultsContainer, ctx);
        }

        el.appendChild(container);
      }
    );
  }

  /**
   * Handle clicking on a SPARQL query to edit it
   */
  private handleSparqlEdit(
    source: string,
    ctx: MarkdownPostProcessorContext
  ): void {
    // Get the active file
    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath) as TFile;
    if (!file) {
      console.error('Could not find file for editing:', ctx.sourcePath);
      return;
    }

    // Open the file for editing
    this.app.workspace
      .getLeaf()
      .openFile(file)
      .then(() => {
        // Get the active editor
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView || !activeView.editor) {
          console.error('Could not get active editor');
          return;
        }

        const editor = activeView.editor;
        const content = editor.getValue();

        // Find the SPARQL code block in the content
        const lines = content.split('\n');
        let startLine = -1;
        let endLine = -1;
        let inSparqlBlock = false;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();

          if (line.startsWith('```sparql')) {
            inSparqlBlock = true;
            startLine = i;
            continue;
          }

          if (inSparqlBlock && line.startsWith('```')) {
            endLine = i;
            const blockContent = lines.slice(startLine + 1, endLine).join('\n');

            // Check if this is the block we're looking for
            if (blockContent.trim() === source.trim()) {
              // Position cursor at the start of the SPARQL content
              editor.setCursor({ line: startLine + 1, ch: 0 });
              // Select the entire SPARQL content for easy editing
              editor.setSelection(
                { line: startLine + 1, ch: 0 },
                { line: endLine - 1, ch: lines[endLine - 1].length }
              );
              return;
            }

            inSparqlBlock = false;
            startLine = -1;
          }
        }

        console.error('Could not find SPARQL block in file content');
      });
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

    const tableContainer = el.createDiv({ cls: 'rdf-results-table-container' });
    const tableEl = tableContainer.createEl('table', {
      cls: 'rdf-results-table',
    });

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
          const formattedValue = this.formatRdfTerm(value);
          tdEl.textContent = formattedValue.text;

          // Handle multiple CSS classes by splitting and adding individually
          const cssClasses = formattedValue.cssClass.split(' ').filter(cls => cls.trim());
          for (const cssClass of cssClasses) {
            tdEl.addClass(cssClass);
          }

          if (formattedValue.title) {
            tdEl.title = formattedValue.title;
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
  }): { text: string; cssClass: string; title?: string } {
    if (!term) return { text: '', cssClass: '' };

    switch (term.type) {
      case 'uri':
        // Try to convert URI to CURIE if PrefixService is available
        if (this.rdfService) {
          try {
            const prefixService = this.rdfService.getPrefixService();
            const prefixContext = prefixService.createPrefixContext();
            const curie = prefixService.createCurie(term.value, prefixContext);

            if (curie) {
              return {
                text: curie,
                cssClass: 'rdf-curie',
                title: `<${term.value}>`, // Show full URI in tooltip
              };
            }
          } catch (error) {
            // Fall back to full URI if prefix service fails
          }
        }

        return {
          text: `<${term.value}>`,
          cssClass: 'rdf-uri',
        };

      case 'literal': {
        // Create function to convert URIs to CURIEs if possible
        const createCurie = this.rdfService
          ? (uri: string) => {
              try {
                const prefixService = this.rdfService!.getPrefixService();
                const prefixContext = prefixService.createPrefixContext();
                return prefixService.createCurie(uri, prefixContext);
              } catch (error) {
                return null;
              }
            }
          : undefined;

        // Use the new literal formatting utility
        const literalDisplay = formatLiteralForDisplay(
          term.value,
          term.datatype,
          term.language,
          createCurie
        );

        return {
          text: literalDisplay.displayText,
          cssClass: literalDisplay.cssClass,
          title: literalDisplay.fullNotation, // Show full RDF notation in tooltip
        };
      }

      case 'bnode':
        return {
          text: `_:${term.value}`,
          cssClass: 'rdf-bnode',
        };

      default:
        return {
          text: term.value || '',
          cssClass: 'rdf-literal',
        };
    }
  }
}
