import { App, PluginSettingTab, Setting } from 'obsidian';
import { RdfToolsPlugin } from '../RdfToolsPlugin';

export class RdfToolsSettingsTab extends PluginSettingTab {
  plugin: RdfToolsPlugin;

  constructor(app: App, plugin: RdfToolsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h2', { text: 'RDF Tools Settings' });

    // Query execution settings
    containerEl.createEl('h3', { text: 'Query Execution' });

    new Setting(containerEl)
      .setName('Query timeout')
      .setDesc(
        'Maximum time (in seconds) to wait for SPARQL queries to complete'
      )
      .addText(text =>
        text
          .setPlaceholder('30')
          .setValue(String(this.plugin.settings.queryTimeout / 1000))
          .onChange(async value => {
            const timeout = parseInt(value);
            if (!isNaN(timeout) && timeout > 0) {
              this.plugin.settings.queryTimeout = timeout * 1000;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName('Max query results')
      .setDesc('Maximum number of results to display for SPARQL queries')
      .addText(text =>
        text
          .setPlaceholder('1000')
          .setValue(String(this.plugin.settings.maxQueryResults))
          .onChange(async value => {
            const maxResults = parseInt(value);
            if (!isNaN(maxResults) && maxResults > 0) {
              this.plugin.settings.maxQueryResults = maxResults;
              await this.plugin.saveSettings();
            }
          })
      );

    // Result formatting settings
    containerEl.createEl('h3', { text: 'Result Formatting' });

    new Setting(containerEl)
      .setName('Default result format')
      .setDesc('Default format for displaying SPARQL query results')
      .addDropdown(dropdown =>
        dropdown
          .addOption('table', 'Table')
          .addOption('list', 'List')
          .addOption('count', 'Count')
          .setValue(this.plugin.settings.defaultResultFormat)
          .onChange(async value => {
            this.plugin.settings.defaultResultFormat = value as
              | 'table'
              | 'list'
              | 'count';
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Show execution time')
      .setDesc('Display query execution time in results')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.showQueryExecutionTime)
          .onChange(async value => {
            this.plugin.settings.showQueryExecutionTime = value;
            await this.plugin.saveSettings();
          })
      );

    // Cache settings
    containerEl.createEl('h3', { text: 'Performance & Caching' });

    new Setting(containerEl)
      .setName('Max graph cache size')
      .setDesc('Maximum number of parsed graphs to keep in memory')
      .addText(text =>
        text
          .setPlaceholder('100')
          .setValue(String(this.plugin.settings.maxGraphCacheSize))
          .onChange(async value => {
            const cacheSize = parseInt(value);
            if (!isNaN(cacheSize) && cacheSize > 0) {
              this.plugin.settings.maxGraphCacheSize = cacheSize;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName('Max query cache size')
      .setDesc('Maximum number of query results to cache')
      .addText(text =>
        text
          .setPlaceholder('50')
          .setValue(String(this.plugin.settings.maxQueryCacheSize))
          .onChange(async value => {
            const cacheSize = parseInt(value);
            if (!isNaN(cacheSize) && cacheSize > 0) {
              this.plugin.settings.maxQueryCacheSize = cacheSize;
              await this.plugin.saveSettings();
            }
          })
      );

    // Debug settings
    containerEl.createEl('h3', { text: 'Development & Debug' });

    new Setting(containerEl)
      .setName('Enable debug logging')
      .setDesc(
        'Log detailed information about RDF processing and SPARQL execution'
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enableDebugLogging)
          .onChange(async value => {
            this.plugin.settings.enableDebugLogging = value;
            await this.plugin.saveSettings();
          })
      );

    // Global prefixes section
    containerEl.createEl('h3', { text: 'Global Prefixes' });
    containerEl.createEl('p', {
      text: 'Define namespace prefixes that will be available in all SPARQL queries and turtle blocks.',
      cls: 'setting-item-description',
    });

    Object.entries(this.plugin.settings.globalPrefixes).forEach(
      ([prefix, uri]) => {
        new Setting(containerEl)
          .setName(`${prefix}:`)
          .addText(text =>
            text
              .setPlaceholder('Namespace URI')
              .setValue(uri)
              .onChange(async value => {
                if (value.trim()) {
                  this.plugin.settings.globalPrefixes[prefix] = value;
                } else {
                  delete this.plugin.settings.globalPrefixes[prefix];
                }
                await this.plugin.saveSettings();
              })
          )
          .addButton(button =>
            button
              .setButtonText('Remove')
              .setWarning()
              .onClick(async () => {
                delete this.plugin.settings.globalPrefixes[prefix];
                await this.plugin.saveSettings();
                this.display(); // Refresh the settings display
              })
          );
      }
    );

    // Add new prefix setting
    let newPrefixName = '';
    let newPrefixUri = '';

    new Setting(containerEl)
      .setName('Add new prefix')
      .addText(text =>
        text.setPlaceholder('Prefix name').onChange(value => {
          newPrefixName = value;
        })
      )
      .addText(text =>
        text.setPlaceholder('Namespace URI').onChange(value => {
          newPrefixUri = value;
        })
      )
      .addButton(button =>
        button
          .setButtonText('Add')
          .setCta()
          .onClick(async () => {
            if (newPrefixName.trim() && newPrefixUri.trim()) {
              this.plugin.settings.globalPrefixes[newPrefixName.trim()] =
                newPrefixUri.trim();
              await this.plugin.saveSettings();
              this.display(); // Refresh the settings display
            }
          })
      );
  }
}
