import { App, Modal } from 'obsidian';

export class SampleModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.setText(
      'RDF Tools Sample Modal - This will be replaced with RDF-specific functionality'
    );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
