import {
  App,
  Editor,
  MarkdownView,
  Notice,
  Plugin,
  TFile,
} from 'obsidian';

import { RdfToolsSettings, DEFAULT_RDF_SETTINGS } from './types';
import { RdfToolsSettingsTab } from './ui/RdfToolsSettingsTab';
import { SampleModal } from './ui/SampleModal';

export class RdfToolsPlugin extends Plugin {
  settings: RdfToolsSettings;

  async onload() {
    await this.loadSettings();

    // This creates an icon in the left ribbon for RDF Tools
    const ribbonIconEl = this.addRibbonIcon(
      'database',
      'RDF Tools',
      (evt: MouseEvent) => {
        new Notice('RDF Tools - Ready to process turtle and SPARQL!');
      }
    );
    ribbonIconEl.addClass('rdf-tools-ribbon-class');

    // Status bar item for RDF Tools
    const statusBarItemEl = this.addStatusBarItem();
    statusBarItemEl.setText('RDF Tools: Ready');

    // Command to open sample modal (will be replaced with RDF-specific modals)
    this.addCommand({
      id: 'open-rdf-sample-modal',
      name: 'Open RDF Tools sample modal',
      callback: () => {
        new SampleModal(this.app).open();
      },
    });

    // Editor command for processing turtle blocks (placeholder)
    this.addCommand({
      id: 'process-turtle-block',
      name: 'Process turtle block at cursor',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        const selection = editor.getSelection();
        if (selection) {
          // TODO: Implement turtle block processing
          new Notice(`Processing turtle block: ${selection.substring(0, 50)}...`);
        } else {
          new Notice('Select a turtle code block to process');
        }
      },
    });

    // Command to execute SPARQL query (placeholder)
    this.addCommand({
      id: 'execute-sparql-query',
      name: 'Execute SPARQL query at cursor',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        const selection = editor.getSelection();
        if (selection) {
          // TODO: Implement SPARQL query execution
          new Notice(`Executing SPARQL query: ${selection.substring(0, 50)}...`);
        } else {
          new Notice('Select a SPARQL query block to execute');
        }
      },
    });

    // Complex command that checks for markdown view
    this.addCommand({
      id: 'refresh-rdf-graphs',
      name: 'Refresh RDF graphs in current note',
      checkCallback: (checking: boolean) => {
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (markdownView) {
          if (!checking) {
            // TODO: Implement graph refresh logic
            new Notice('Refreshing RDF graphs in current note...');
          }
          return true;
        }
      },
    });

    // Add settings tab
    this.addSettingTab(new RdfToolsSettingsTab(this.app, this));

    // Register for file changes to detect turtle block modifications
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          // TODO: Check if file contains turtle blocks and update graphs
          if (this.settings.enableDebugLogging) {
            console.log(`RDF Tools: File modified: ${file.path}`);
          }
        }
      })
    );

    // Register for file creation to detect new turtle content
    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          if (this.settings.enableDebugLogging) {
            console.log(`RDF Tools: File created: ${file.path}`);
          }
        }
      })
    );

    // Register for file deletion to clean up graphs
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          // TODO: Remove graphs associated with deleted file
          if (this.settings.enableDebugLogging) {
            console.log(`RDF Tools: File deleted: ${file.path}`);
          }
        }
      })
    );

    // Register for file rename to update graph URIs
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        if (file instanceof TFile && file.extension === 'md') {
          // TODO: Update graph URIs when files are renamed
          if (this.settings.enableDebugLogging) {
            console.log(`RDF Tools: File renamed: ${oldPath} -> ${file.path}`);
          }
        }
      })
    );

    if (this.settings.enableDebugLogging) {
      console.log('RDF Tools plugin loaded successfully');
    }
  }

  onunload() {
    if (this.settings.enableDebugLogging) {
      console.log('RDF Tools plugin unloaded');
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_RDF_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * Get the base URI for a given file path
   */
  getBaseUri(filePath: string): string {
    return `vault://${filePath}/`;
  }

  /**
   * Get the named graph URI for a given file path
   */
  getNamedGraphUri(filePath: string): string {
    return `vault://${filePath}`;
  }

  /**
   * Check if debug logging is enabled
   */
  isDebugEnabled(): boolean {
    return this.settings.enableDebugLogging;
  }

  /**
   * Log debug message if debug logging is enabled
   */
  debug(message: string, ...args: any[]) {
    if (this.isDebugEnabled()) {
      console.log(`[RDF Tools] ${message}`, ...args);
    }
  }
}