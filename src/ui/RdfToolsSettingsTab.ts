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
