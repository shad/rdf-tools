import {
  Editor,
  Notice,
  Plugin,
  TFile,
} from 'obsidian';

import { RdfToolsSettings, DEFAULT_RDF_SETTINGS } from './models/RdfToolsSettings';
import { RdfToolsSettingsTab } from './ui/RdfToolsSettingsTab';
import { SparqlQueryDetailsModal } from './ui/SparqlQueryDetailsModal';
import { SparqlQueryFactory } from './models/SparqlQuery';
import { RdfToolsService } from './services/RdfToolsService';
import { Logger } from './utils/Logger';

export class RdfToolsPlugin extends Plugin {
  settings: RdfToolsSettings;
  statusBarItemEl: HTMLElement;
  rdfService: RdfToolsService;
  logger: Logger;

  async onload() {
    await this.loadSettings();

    // Initialize logger
    this.logger = Logger.create(this.settings);

    // Initialize services
    this.rdfService = this.addChild(new RdfToolsService(this.app, this, this.settings, this.logger));

    // Add settings tab
    this.addSettingTab(new RdfToolsSettingsTab(this.app, this));

    // Add commands
    this.registerCommands();

    // Register for file changes to detect turtle block modifications
    this.registerEvent(
      this.app.vault.on('modify', async (file) => {
        if (file instanceof TFile) {
          await this.rdfService.onFileModified(file);
        }
      })
    );

    // Register for file creation to detect new turtle content
    this.registerEvent(
      this.app.vault.on('create', async (file) => {
        if (file instanceof TFile) {
          await this.rdfService.onFileCreated(file);
        }
      })
    );

    // Register for file deletion to clean up graphs
    this.registerEvent(
      this.app.vault.on('delete', async (file) => {
        if (file instanceof TFile) {
          await this.rdfService.onFileDeleted(file);
        }
      })
    );

    // Register for file rename to update graph URIs
    this.registerEvent(
      this.app.vault.on('rename', async (file, oldPath) => {
        if (file instanceof TFile) {
          await this.rdfService.onFileRenamed(file, oldPath);
        }
      })
    );

    this.logger.info('plugin loaded successfully');
  }

  async onunload() {
    if (this.rdfService) {
      await this.rdfService.onunload();
    }

    this.logger.info('plugin unloaded');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_RDF_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    // Update global prefixes in the RDF service when settings change
    if (this.rdfService) {
      this.rdfService.updateGlobalPrefixes(this.settings);
    }
  }

  /**
   * Register plugin commands
   */
  private registerCommands(): void {
    // Copy file graph IRI command
    this.addCommand({
      id: 'copy-file-graph-iri',
      name: 'Copy file graph IRI',
      callback: () => {
        this.copyFileGraphIri();
      },
    });

    // SPARQL Query Details command
    this.addCommand({
      id: 'sparql-query-details',
      name: 'SPARQL Query Details',
      editorCallback: (editor: Editor) => {
        this.showSparqlQueryDetails(editor);
      },
    });

  }

  /**
   * Copy the current file's graph IRI to clipboard
   */
  private async copyFileGraphIri(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('No active file to copy graph IRI from');
      return;
    }

    try {
      const graphUri = this.rdfService.getGraphService().getGraphUriForFile(activeFile.path);
      await navigator.clipboard.writeText(graphUri);
      new Notice(`Copied graph IRI: ${graphUri}`);
    } catch (error) {
      this.logger.error('Failed to copy graph IRI:', error);
      new Notice('Failed to copy graph IRI to clipboard');
    }
  }

  /**
   * Show SPARQL query details modal for the query under cursor
   */
  private async showSparqlQueryDetails(editor: Editor): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('No active file');
      return;
    }

    try {
      // Extract SPARQL query from editor
      const sparqlQuery = this.extractSparqlQueryFromEditor(editor);
      if (!sparqlQuery) {
        new Notice('No SPARQL query found at cursor position');
        return;
      }

      // Parse the query
      const parseResult = await this.rdfService.getSparqlParserService().parseSparqlContent(sparqlQuery);
      if (!parseResult.success) {
        new Notice(`Query parse error: ${parseResult.error?.message}`);
        return;
      }

      // Create a SparqlQuery model using the factory
      const query = SparqlQueryFactory.createSparqlQuery({
        location: {
          file: activeFile,
          startLine: editor.getCursor().line,
          endLine: editor.getCursor().line,
          startColumn: 0,
          endColumn: 0,
        },
        queryString: sparqlQuery,
        baseUri: this.rdfService.getGraphService().getGraphUriForFile(activeFile.path),
        prefixes: parseResult.prefixes || {},
        timeoutMs: this.settings.queryTimeout,
        maxResults: this.settings.maxQueryResults,
      });

      // Set the parsed query
      query.parsedQuery = parseResult.parsedQuery;

      // Update context with FROM clauses from parse result
      if (parseResult.fromGraphs) {
        query.context.fromGraphs = parseResult.fromGraphs;
      }
      if (parseResult.fromNamedGraphs) {
        query.context.fromNamedGraphs = parseResult.fromNamedGraphs;
      }

      // Generate execution details
      const details = await this.rdfService.getQueryExecutorService().generateExecutionDetails(query);

      // Show modal
      const modal = new SparqlQueryDetailsModal(this.app, details);
      modal.open();

    } catch (error) {
      this.logger.error('Error showing SPARQL query details:', error);
      new Notice('Failed to analyze SPARQL query');
    }
  }

  /**
   * Extract SPARQL query from editor at cursor position
   */
  private extractSparqlQueryFromEditor(editor: Editor): string | null {
    const cursor = editor.getCursor();
    const content = editor.getValue();
    const lines = content.split('\n');

    // Find SPARQL code block containing the cursor
    let inSparqlBlock = false;
    let blockStartLine = -1;
    let blockEndLine = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('```sparql')) {
        inSparqlBlock = true;
        blockStartLine = i + 1;
        continue;
      }

      if (inSparqlBlock && line.startsWith('```')) {
        blockEndLine = i;

        // Check if cursor is within this block
        if (cursor.line >= blockStartLine && cursor.line < blockEndLine) {
          const queryLines = lines.slice(blockStartLine, blockEndLine);
          return queryLines.join('\n');
        }

        inSparqlBlock = false;
        blockStartLine = -1;
        blockEndLine = -1;
      }
    }

    // If we're still in a block (unclosed), check if cursor is within
    if (inSparqlBlock && blockStartLine !== -1 && cursor.line >= blockStartLine) {
      const queryLines = lines.slice(blockStartLine);
      return queryLines.join('\n');
    }

    return null;
  }
}
