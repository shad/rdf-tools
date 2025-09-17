import {
  App,
  TFile,
  Component,
  Plugin,
  MarkdownPostProcessorContext,
} from 'obsidian';
import { CodeBlockExtractorService } from './CodeBlockExtractorService';
import { TurtleParserService } from './TurtleParserService';
import { SparqlParserService } from './SparqlParserService';
import { GraphService } from './GraphService';
import { QueryExecutorService } from './QueryExecutorService';
import { PrefixService } from './PrefixService';
import { SparqlQueryTracker, SparqlQueryInfo } from './SparqlQueryTracker';
import { CodeBlockProcessor } from '../ui/CodeBlockProcessor';
import { RdfToolsSettings } from '../models/RdfToolsSettings';
import { QueryResultsType } from '../models/QueryResults';
import { SparqlQuery } from '../models/SparqlQuery';
import { MarkdownErrorReporter } from './MarkdownErrorReporter';

/**
 * Main orchestrating service that coordinates all RDF processing
 */
export class RdfToolsService extends Component {
  // Core services
  private codeBlockExtractor: CodeBlockExtractorService;
  private turtleParser: TurtleParserService;
  private sparqlParser: SparqlParserService;
  private graphService: GraphService;
  private queryExecutor: QueryExecutorService;
  private prefixService: PrefixService;
  private sparqlQueryTracker: SparqlQueryTracker;
  private codeBlockProcessor: CodeBlockProcessor;
  private errorReporter: MarkdownErrorReporter;

  // Debouncing for file modifications
  private fileModificationTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private app: App,
    private plugin: Plugin,
    private settings: RdfToolsSettings
  ) {
    super();

    // Initialize prefix service with common prefixes
    this.prefixService = new PrefixService(PrefixService.getCommonPrefixes());

    // Initialize services
    this.codeBlockExtractor = new CodeBlockExtractorService();
    this.turtleParser = new TurtleParserService(this.prefixService);
    this.sparqlParser = new SparqlParserService(this.prefixService);
    this.graphService = new GraphService(this.app, this.prefixService);
    this.queryExecutor = new QueryExecutorService(this.graphService);
    this.sparqlQueryTracker = new SparqlQueryTracker(this.graphService);
    this.codeBlockProcessor = new CodeBlockProcessor(this.app, this.plugin);
    this.errorReporter = new MarkdownErrorReporter(this.app);
  }

  async onload() {
    super.onload();

    // Set up callbacks for code block processing
    this.codeBlockProcessor.setSparqlCallback(
      this.handleSparqlBlock.bind(this)
    );

    // Register code block processors
    this.codeBlockProcessor.register();

    // Add child components
    this.addChild(this.codeBlockProcessor);

    // Set up workspace integration for query tracking
    this.setupWorkspaceIntegration();

    console.log(
      'RdfToolsService initialized - callbacks set up and processors registered'
    );

    if (this.settings.enableDebugLogging) {
      console.log('RdfToolsService: Debug logging enabled');
    }
  }

  /**
   * Cleanup when plugin unloads
   */
  async onunload(): Promise<void> {
    // Clear all debounce timeouts
    for (const timeout of this.fileModificationTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.fileModificationTimeouts.clear();

    // Cancel all active query executions
    this.queryExecutor.cleanup();

    // Clear error displays
    this.errorReporter.clearAllErrors();

    if (this.settings.enableDebugLogging) {
      console.log('RDF Tools: Service cleanup completed');
    }
  }

  /**
   * Handle SPARQL query processing callback
   */
  private async handleSparqlBlock(
    source: string,
    container: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ): Promise<void> {
    if (this.settings.enableDebugLogging) {
      console.log('RDF Tools: Processing SPARQL block', {
        source: source.substring(0, 100) + '...',
        sourcePath: ctx.sourcePath,
      });
    }

    try {
      // Create query from current content
      const file = this.app.vault.getAbstractFileByPath(
        ctx.sourcePath
      ) as TFile;
      if (!file) return;

      // Note: Graphs are now loaded lazily at query execution time

      const query = this.codeBlockExtractor.createSparqlQueryFromContent(
        source,
        file,
        0, // line number - we'd need to track this properly
        0 // end line - we'd need to track this properly
      );

      // Parse the SPARQL query with base URI
      const baseUri = this.graphService.getGraphUriForFile(file.path);
      const parseResult = await this.sparqlParser.parseSparqlQuery(query, {
        baseUri,
      });

      // Update query with parse results
      this.sparqlParser.updateSparqlQueryWithParseResults(query, parseResult);

      // Update display with parse results
      try {
        this.codeBlockProcessor.renderSparqlResult(
          container,
          parseResult,
          undefined,
          {
            showDetailedErrors: this.settings.showDetailedErrors,
            showMetrics: this.settings.enableDebugLogging,
          }
        );
        if (this.settings.enableDebugLogging) {
          console.log('RDF Tools: Successfully rendered SPARQL parse result');
        }
      } catch (renderError) {
        console.error(
          'RDF Tools: Error rendering SPARQL parse result:',
          renderError
        );
        // Fallback: show basic error message
        const resultEl = container.querySelector(
          '.rdf-sparql-result'
        ) as HTMLElement;
        if (resultEl) {
          resultEl.innerHTML = '';
          const errorEl = resultEl.ownerDocument.createElement('div');
          errorEl.className = 'rdf-result-error';
          errorEl.textContent = `Render error: ${renderError instanceof Error ? renderError.message : 'Unknown error'}`;
          resultEl.appendChild(errorEl);
        }
      }

      // Execute the query if parsing succeeded and auto-execution is enabled
      if (parseResult.success && this.settings.autoExecuteQueries !== false) {
        // Show loading state
        try {
          this.codeBlockProcessor.renderSparqlResult(container, parseResult, {
            status: 'executing',
            queryType: (parseResult.queryType || 'SELECT') as QueryResultsType,
            resultCount: 0,
            truncated: false,
          });
        } catch (renderError) {
          console.error('RDF Tools: Error showing loading state:', renderError);
        }

        // Execute the query
        const results = await this.queryExecutor.executeQuery(query);

        // Register query with tracker for live updates (after successful execution)
        if (results.status === 'completed') {
          this.sparqlQueryTracker.registerQuery(query, container, file);
          if (this.settings.enableDebugLogging) {
            console.log(
              `RDF Tools: Registered SPARQL query for live updates in ${file.path}`
            );
          }
        }

        // Update display with results
        try {
          this.codeBlockProcessor.renderSparqlResult(
            container,
            parseResult,
            results,
            {
              showDetailedErrors: this.settings.showDetailedErrors,
              showMetrics: this.settings.enableDebugLogging,
            }
          );
          console.log(
            'RDF Tools: Successfully rendered SPARQL execution results'
          );
        } catch (renderError) {
          console.error(
            'RDF Tools: Error rendering SPARQL results:',
            renderError
          );
          // Fallback: show basic error message
          const resultEl = container.querySelector(
            '.rdf-sparql-result'
          ) as HTMLElement;
          if (resultEl) {
            resultEl.innerHTML = '';
            const errorEl = resultEl.ownerDocument.createElement('div');
            errorEl.className = 'rdf-result-error';
            errorEl.textContent = `Render error: ${renderError instanceof Error ? renderError.message : 'Unknown error'}`;
            resultEl.appendChild(errorEl);
          }
        }
      }
    } catch (error) {
      console.error('RDF Tools: Error processing SPARQL block:', error);

      // Show error in UI
      const resultEl = container.querySelector(
        '.rdf-sparql-result'
      ) as HTMLElement;
      if (resultEl) {
        resultEl.innerHTML = '';
        const errorEl = resultEl.ownerDocument.createElement('div');
        errorEl.className = 'rdf-result-error';
        errorEl.textContent = `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        resultEl.appendChild(errorEl);
      }
    }
  }

  /**
   * Handle file changes - invalidate graph cache and update dependent queries (debounced)
   */
  async onFileModified(file: TFile): Promise<void> {
    if (file.extension === 'md') {
      this.debouncedHandleFileModification(file);
    }
  }

  /**
   * Handle file creation - invalidate graph cache and update dependent queries (debounced)
   */
  async onFileCreated(file: TFile): Promise<void> {
    if (file.extension === 'md') {
      this.debouncedHandleFileModification(file);
    }
  }

  /**
   * Handle file deletion - invalidate graph cache and update dependent queries
   */
  async onFileDeleted(file: TFile): Promise<void> {
    if (file.extension === 'md') {
      const graphUri = this.graphService.getGraphUriForFile(file.path);

      // Find and update dependent queries before invalidating
      const dependentQueries =
        this.sparqlQueryTracker.findQueriesDependingOnGraph(graphUri);

      // Invalidate graph cache
      this.graphService.invalidateGraph(graphUri);

      // Remove any tracked queries from this file
      this.sparqlQueryTracker.removeAllQueriesForFile(file.path);

      // Clear error display
      this.errorReporter.clearErrors(file.path);

      // Re-execute dependent queries (they may now have errors or empty results)
      for (const queryInfo of dependentQueries) {
        await this.reExecuteSparqlQuery(queryInfo);
      }
    }
  }

  /**
   * Handle file rename - invalidate both old and new graph cache and update dependencies
   */
  async onFileRenamed(file: TFile, oldPath: string): Promise<void> {
    if (file.extension === 'md') {
      const oldGraphUri = this.graphService.getGraphUriForFile(oldPath);
      const newGraphUri = this.graphService.getGraphUriForFile(file.path);

      // Find queries that depend on the old graph URI
      const dependentQueries =
        this.sparqlQueryTracker.findQueriesDependingOnGraph(oldGraphUri);

      // Invalidate both old and new graph URIs
      this.graphService.invalidateGraph(oldGraphUri);
      this.graphService.invalidateGraph(newGraphUri);

      // Update tracker for queries that moved with the file
      const queriesInFile = this.sparqlQueryTracker.getQueriesInFile(oldPath);
      for (const queryInfo of queriesInFile) {
        // Remove old tracking
        this.sparqlQueryTracker.unregisterQuery(queryInfo.id);

        // Re-register with new file path (dependencies will be re-analyzed)
        this.sparqlQueryTracker.registerQuery(
          queryInfo.query,
          queryInfo.container,
          file
        );
      }

      // Re-execute dependent queries (old dependencies broken, may need to update)
      for (const queryInfo of dependentQueries) {
        await this.reExecuteSparqlQuery(queryInfo);
      }

      // Handle the new file as if it was modified (for new dependencies)
      await this.handleFileModificationWithDependencies(file);
    }
  }

  /**
   * Set up workspace integration for tracking query lifecycle
   */
  private setupWorkspaceIntegration(): void {
    // Clean up stale DOM references periodically (primary cleanup mechanism)
    this.plugin.registerInterval(
      window.setInterval(() => {
        this.cleanupStaleQueries();
      }, 10000) // Every 10 seconds
    );

    // Additional cleanup when layout changes
    this.plugin.registerEvent(
      this.app.workspace.on('layout-change', () => {
        // Debounce layout change cleanup
        setTimeout(() => {
          this.cleanupStaleQueries();
        }, 1000);
      })
    );
  }

  /**
   * Clean up queries whose DOM containers no longer exist
   */
  private cleanupStaleQueries(): void {
    const allQueries = this.sparqlQueryTracker.getAllQueries();
    if (allQueries.length === 0) return;

    let removedCount = 0;

    for (const queryInfo of allQueries) {
      // Check if DOM container still exists
      if (!document.body.contains(queryInfo.container)) {
        this.sparqlQueryTracker.unregisterQuery(queryInfo.id);
        removedCount++;
      }
    }

    if (removedCount > 0 && this.settings.enableDebugLogging) {
      // Debug logging would go here if needed
    }
  }

  /**
   * Debounced file modification handler to prevent excessive updates
   */
  private debouncedHandleFileModification(file: TFile): void {
    const filePath = file.path;

    // Clear existing timeout for this file
    const existingTimeout = this.fileModificationTimeouts.get(filePath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      try {
        await this.handleFileModificationWithDependencies(file);
      } catch (error) {
        console.error(
          `RDF Tools: Error handling file modification for ${filePath}:`,
          error
        );
      } finally {
        this.fileModificationTimeouts.delete(filePath);
      }
    }, 300); // 300ms debounce

    this.fileModificationTimeouts.set(filePath, timeout);
  }

  /**
   * Handle file modification with dependency-aware SPARQL query updates
   */
  private async handleFileModificationWithDependencies(
    file: TFile
  ): Promise<void> {
    const graphUri = this.graphService.getGraphUriForFile(file.path);

    // 1. Invalidate graph cache (existing behavior)
    this.graphService.invalidateGraph(graphUri);

    // 2. Find all SPARQL queries that depend on this graph
    const dependentQueries =
      this.sparqlQueryTracker.findQueriesDependingOnGraph(graphUri);

    if (this.settings.enableDebugLogging) {
      console.log(
        `RDF Tools: File ${file.path} modified (graphUri: ${graphUri}), found ${dependentQueries.length} dependent queries`
      );

      // Debug: Show which queries will be re-executed
      dependentQueries.forEach((queryInfo, i) => {
        console.log(
          `  Query ${i + 1}: in file ${queryInfo.file.path}, depends on:`,
          queryInfo.dependentGraphs
        );
      });
    }

    // 3. Re-execute dependent queries in parallel for better performance
    if (dependentQueries.length > 0) {
      const filteredQueries = dependentQueries.filter(
        queryInfo => !queryInfo.isExecuting
      );

      if (this.settings.enableDebugLogging) {
        if (this.settings.enableDebugLogging) {
          console.log(
            `RDF Tools: Re-executing ${filteredQueries.length} queries (${dependentQueries.length - filteredQueries.length} already executing)`
          );
        }
      }

      if (filteredQueries.length > 0) {
        const reExecutionPromises = filteredQueries.map(
          async (queryInfo, index) => {
            try {
              if (this.settings.enableDebugLogging) {
                if (this.settings.enableDebugLogging) {
                  console.log(
                    `RDF Tools: Starting re-execution ${index + 1}/${filteredQueries.length} for ${queryInfo.file.path}`
                  );
                }
              }
              await this.reExecuteSparqlQuery(queryInfo);
              if (this.settings.enableDebugLogging) {
                if (this.settings.enableDebugLogging) {
                  console.log(
                    `RDF Tools: Completed re-execution ${index + 1}/${filteredQueries.length} for ${queryInfo.file.path}`
                  );
                }
              }
            } catch (error) {
              console.error(
                `RDF Tools: Error re-executing query ${index + 1} in ${queryInfo.file.path}:`,
                error
              );
            }
          }
        );

        // Execute with timeout to prevent hanging
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(
            () => reject(new Error('Query re-execution timeout')),
            10000
          );
        });

        try {
          await Promise.race([
            Promise.allSettled(reExecutionPromises),
            timeoutPromise,
          ]);
        } catch (error) {
          console.error(
            'RDF Tools: Error during bulk query re-execution:',
            error
          );
        }
      }
    }

    // 4. Update errors (existing behavior)
    await this.errorReporter.checkAndUpdateErrors(file);
  }

  /**
   * Find the SPARQL container for a query after DOM regeneration
   */
  private findSparqlContainerInFile(
    file: TFile,
    targetQuery: SparqlQuery
  ): HTMLElement | null {
    try {
      // Get all markdown views for this file
      const leaves = this.app.workspace.getLeavesOfType('markdown');
      const fileLeaf = leaves.find(leaf => {
        const view = leaf.view as { file?: TFile };
        return view.file && view.file.path === file.path;
      });

      if (!fileLeaf) {
        return null;
      }

      // Get the view's container
      const viewContainer = fileLeaf.view.containerEl;
      if (!viewContainer) {
        return null;
      }

      // Find all SPARQL code blocks in this view
      const sparqlBlocks = Array.from(
        viewContainer.querySelectorAll('[data-lang="sparql"]')
      );

      if (this.settings.enableDebugLogging) {
        // Debug logging for SPARQL blocks found
      }

      for (const block of sparqlBlocks) {
        // Try to match the query by comparing the SPARQL text content
        const codeElement = block.querySelector('code');
        if (codeElement && codeElement.textContent) {
          const blockQueryText = codeElement.textContent.trim();
          const targetQueryText = targetQuery.queryString.trim();

          // If the query text matches, look for the result container
          if (blockQueryText === targetQueryText) {
            if (this.settings.enableDebugLogging) {
              // Debug logging for query match found
            }
            // Look for the result container that should be after this code block
            let resultContainer = block.nextElementSibling;
            while (resultContainer) {
              if (resultContainer.classList.contains('rdf-sparql-result')) {
                return resultContainer as HTMLElement;
              }
              resultContainer = resultContainer.nextElementSibling;
            }

            // If no result container found, check if this block has a parent with result container
            let parent = block.parentElement;
            while (parent && parent !== viewContainer) {
              const nextSibling = parent.nextElementSibling;
              if (
                nextSibling &&
                nextSibling.classList.contains('rdf-sparql-result')
              ) {
                return nextSibling as HTMLElement;
              }
              parent = parent.parentElement;
            }
          }
        }
      }

      return null;
    } catch (error) {
      if (this.settings.enableDebugLogging) {
        console.error(
          `RDF Tools: Error finding SPARQL container in ${file.path}:`,
          error
        );
      }
      return null;
    }
  }

  /**
   * Re-execute a SPARQL query and update its results display
   */
  private async reExecuteSparqlQuery(
    queryInfo: SparqlQueryInfo
  ): Promise<void> {
    if (this.settings.enableDebugLogging) {
      if (this.settings.enableDebugLogging) {
        console.log(
          `RDF Tools: reExecuteSparqlQuery called for ${queryInfo.file.path}, query ID: ${queryInfo.id}`
        );
      }
    }

    try {
      // Check if the container still exists in the DOM
      if (!document.body.contains(queryInfo.container)) {
        if (this.settings.enableDebugLogging) {
          // Debug logging for container not in DOM
        }

        // Try to find the container by looking for SPARQL code blocks in the current file
        const updatedContainer = this.findSparqlContainerInFile(
          queryInfo.file,
          queryInfo.query
        );
        if (updatedContainer) {
          if (this.settings.enableDebugLogging) {
            // Debug logging for container updated
          }
          // Update the container reference
          queryInfo.container = updatedContainer;
        } else {
          if (this.settings.enableDebugLogging) {
            // Debug logging for container not found
          }
          // Container no longer exists, unregister the query
          this.sparqlQueryTracker.unregisterQuery(queryInfo.id);
          return;
        }
      }

      // Check if the file is still open
      const leaves = this.app.workspace.getLeavesOfType('markdown');
      const fileStillOpen = leaves.some(leaf => {
        const view = leaf.view as { file?: TFile };
        return view.file && view.file.path === queryInfo.file.path;
      });

      if (!fileStillOpen) {
        // File is no longer open, unregister queries
        this.sparqlQueryTracker.removeAllQueriesForFile(queryInfo.file.path);
        return;
      }

      // Mark as executing
      this.sparqlQueryTracker.setQueryExecuting(queryInfo.id, true);

      if (this.settings.enableDebugLogging) {
        console.log(
          `RDF Tools: Re-executing SPARQL query in ${queryInfo.file.path}`
        );
      }

      // Show loading state
      try {
        this.codeBlockProcessor.renderSparqlResult(
          queryInfo.container,
          {
            success: true,
            queryType: 'SELECT',
            error: undefined,
            parseTimeMs: 0,
          },
          {
            status: 'executing',
            queryType: 'SELECT' as QueryResultsType,
            resultCount: 0,
            truncated: false,
          }
        );
      } catch (renderError) {
        console.error('RDF Tools: Error showing loading state:', renderError);
      }

      // Execute the query
      if (this.settings.enableDebugLogging) {
        // Debug logging for query execution start
      }
      const results = await this.queryExecutor.executeQuery(queryInfo.query);
      if (this.settings.enableDebugLogging) {
        // Debug logging for query execution complete
      }

      // Update display with results
      try {
        this.codeBlockProcessor.renderSparqlResult(
          queryInfo.container,
          {
            success: true,
            queryType: results.queryType,
            error: undefined,
            parseTimeMs: 0,
          },
          results,
          {
            showDetailedErrors: this.settings.showDetailedErrors,
            showMetrics: this.settings.enableDebugLogging,
          }
        );
      } catch (renderError) {
        console.error(
          'RDF Tools: Error rendering SPARQL results:',
          renderError
        );
        // Fallback: show basic error message
        const resultEl = queryInfo.container.querySelector(
          '.rdf-sparql-result'
        ) as HTMLElement;
        if (resultEl) {
          resultEl.innerHTML = '';
          const errorEl = resultEl.ownerDocument.createElement('div');
          errorEl.className = 'rdf-result-error';
          errorEl.textContent = `Render error: ${renderError instanceof Error ? renderError.message : 'Unknown error'}`;
          resultEl.appendChild(errorEl);
        }
      }
    } catch (error) {
      console.error('RDF Tools: Error re-executing SPARQL query:', error);

      // Show error in UI
      const resultEl = queryInfo.container.querySelector(
        '.rdf-sparql-result'
      ) as HTMLElement;
      if (resultEl) {
        resultEl.innerHTML = '';
        const errorEl = resultEl.ownerDocument.createElement('div');
        errorEl.className = 'rdf-result-error';
        errorEl.textContent = `Execution error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        resultEl.appendChild(errorEl);
      }
    } finally {
      // Mark as no longer executing
      this.sparqlQueryTracker.setQueryExecuting(queryInfo.id, false);
    }
  }

  /**
   * Get the graph service
   */
  getGraphService(): GraphService {
    return this.graphService;
  }

  /**
   * Get the SPARQL parser service
   */
  getSparqlParserService(): SparqlParserService {
    return this.sparqlParser;
  }

  /**
   * Get the query executor service
   */
  getQueryExecutorService(): QueryExecutorService {
    return this.queryExecutor;
  }

  /**
   * Get the SPARQL query tracker service
   */
  getSparqlQueryTracker(): SparqlQueryTracker {
    return this.sparqlQueryTracker;
  }
}
