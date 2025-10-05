import { App, Modal, Setting } from 'obsidian';
import { QueryExecutionDetails } from '@/models/QueryExecutionDetails';

/**
 * Modal for displaying detailed SPARQL query execution information
 */
export class SparqlQueryDetailsModal extends Modal {
  constructor(
    app: App,
    private details: QueryExecutionDetails
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'SPARQL Query Details' });

    // Query Information Section
    this.renderQueryInfo(contentEl);

    // Execution Timing Section
    this.renderTimingInfo(contentEl);

    // Graph Information Section
    this.renderGraphInfo(contentEl);

    // Results Information Section
    this.renderResultsInfo(contentEl);

    // Memory Usage Section
    this.renderMemoryInfo(contentEl);

    // Query Complexity Section
    this.renderComplexityInfo(contentEl);

    // Status and Warnings Section
    this.renderStatusInfo(contentEl);

    // Close button
    new Setting(contentEl).addButton(btn => {
      btn
        .setButtonText('Close')
        .setCta()
        .onClick(() => {
          this.close();
        });
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private renderQueryInfo(container: HTMLElement): void {
    const section = container.createDiv({ cls: 'rdf-details-section' });
    section.createEl('h3', { text: 'Query Information' });

    const queryContainer = section.createDiv({ cls: 'rdf-query-container' });

    // Query type
    new Setting(queryContainer)
      .setName('Query Type')
      .setDesc(this.details.queryType.toUpperCase());

    // Query string (in a code block)
    const queryLabel = queryContainer.createEl('div', { cls: 'setting-item' });
    queryLabel.createEl('div', { cls: 'setting-item-info' });
    queryLabel.querySelector('.setting-item-info')?.createEl('div', {
      cls: 'setting-item-name',
      text: 'Query',
    });

    const queryCodeBlock = queryContainer.createEl('pre', {
      cls: 'rdf-query-code',
    });
    const queryCode = queryCodeBlock.createEl('code');
    queryCode.textContent = this.details.queryString;

    // Execution timestamp
    new Setting(queryContainer)
      .setName('Executed At')
      .setDesc(this.details.executionTimestamp.toLocaleString());
  }

  private renderTimingInfo(container: HTMLElement): void {
    const section = container.createDiv({ cls: 'rdf-details-section' });
    section.createEl('h3', { text: 'Execution Timing' });

    const timingContainer = section.createDiv({ cls: 'rdf-timing-container' });

    new Setting(timingContainer)
      .setName('Total Execution Time')
      .setDesc(`${this.details.executionTimeMs}ms`);

    new Setting(timingContainer)
      .setName('Query Parsing Time')
      .setDesc(`${this.details.parseTimeMs}ms`);

    new Setting(timingContainer)
      .setName('Graph Resolution Time')
      .setDesc(`${this.details.graphResolutionTimeMs}ms`);

    new Setting(timingContainer)
      .setName('Query Execution Time')
      .setDesc(`${this.details.queryExecutionTimeMs}ms`);

    // Timing breakdown chart (simple text representation)
    const breakdown = timingContainer.createDiv({
      cls: 'rdf-timing-breakdown',
    });
    breakdown.createEl('p', { text: 'Timing Breakdown:' });

    const parsePercent = Math.round(
      (this.details.parseTimeMs / this.details.executionTimeMs) * 100
    );
    const graphPercent = Math.round(
      (this.details.graphResolutionTimeMs / this.details.executionTimeMs) * 100
    );
    const execPercent = Math.round(
      (this.details.queryExecutionTimeMs / this.details.executionTimeMs) * 100
    );

    breakdown.createEl('div', { text: `• Parsing: ${parsePercent}%` });
    breakdown.createEl('div', { text: `• Graph Resolution: ${graphPercent}%` });
    breakdown.createEl('div', { text: `• Execution: ${execPercent}%` });
  }

  private renderGraphInfo(container: HTMLElement): void {
    const section = container.createDiv({ cls: 'rdf-details-section' });
    section.createEl('h3', { text: 'Graph Information' });

    const graphContainer = section.createDiv({ cls: 'rdf-graph-container' });

    new Setting(graphContainer)
      .setName('Graphs Queried')
      .setDesc(`${this.details.usedGraphs.length} graph(s)`);

    new Setting(graphContainer)
      .setName('Total Triples Queried')
      .setDesc(this.details.totalTriplesQueried.toLocaleString());

    // Individual graph details
    if (this.details.usedGraphs.length > 0) {
      const graphList = graphContainer.createDiv({ cls: 'rdf-graph-list' });
      graphList.createEl('p', { text: 'Graph Details:' });

      for (const graph of this.details.usedGraphs) {
        const graphItem = graphList.createDiv({ cls: 'rdf-graph-item' });
        graphItem.createEl('strong', { text: graph.uri });
        graphItem.createEl('br');
        graphItem.createEl('span', { text: `File: ${graph.filePath}` });
        graphItem.createEl('br');
        graphItem.createEl('span', {
          text: `Triples: ${graph.tripleCount.toLocaleString()}`,
        });
        graphItem.createEl('br');
        graphItem.createEl('span', {
          text: `Size: ${this.formatBytes(graph.estimatedSizeBytes)}`,
        });
      }
    }
  }

  private renderResultsInfo(container: HTMLElement): void {
    const section = container.createDiv({ cls: 'rdf-details-section' });
    section.createEl('h3', { text: 'Results Information' });

    const resultsContainer = section.createDiv({
      cls: 'rdf-results-container',
    });

    new Setting(resultsContainer)
      .setName('Result Count')
      .setDesc(this.details.resultStatistics.resultCount.toLocaleString());

    new Setting(resultsContainer)
      .setName('Results Truncated')
      .setDesc(this.details.resultStatistics.truncated ? 'Yes' : 'No');

    if (this.details.resultStatistics.maxResults) {
      new Setting(resultsContainer)
        .setName('Max Results Limit')
        .setDesc(this.details.resultStatistics.maxResults.toLocaleString());
    }
  }

  private renderMemoryInfo(container: HTMLElement): void {
    const section = container.createDiv({ cls: 'rdf-details-section' });
    section.createEl('h3', { text: 'Memory Usage' });

    const memoryContainer = section.createDiv({ cls: 'rdf-memory-container' });

    new Setting(memoryContainer)
      .setName('Graph Memory')
      .setDesc(this.formatBytes(this.details.memoryUsage.graphMemoryBytes));

    new Setting(memoryContainer)
      .setName('Result Memory')
      .setDesc(this.formatBytes(this.details.memoryUsage.resultMemoryBytes));

    new Setting(memoryContainer)
      .setName('Total Memory')
      .setDesc(this.formatBytes(this.details.memoryUsage.totalMemoryBytes));
  }

  private renderComplexityInfo(container: HTMLElement): void {
    const section = container.createDiv({ cls: 'rdf-details-section' });
    section.createEl('h3', { text: 'Query Complexity' });

    const complexityContainer = section.createDiv({
      cls: 'rdf-complexity-container',
    });

    new Setting(complexityContainer)
      .setName('Complexity Score')
      .setDesc(`${this.details.complexityMetrics.complexityScore}/10`);

    new Setting(complexityContainer)
      .setName('Triple Patterns')
      .setDesc(this.details.complexityMetrics.triplePatternCount.toString());

    new Setting(complexityContainer)
      .setName('Variables')
      .setDesc(this.details.complexityMetrics.variableCount.toString());

    // Feature usage
    const features = complexityContainer.createDiv({ cls: 'rdf-features' });
    features.createEl('p', { text: 'Query Features:' });

    const featuresList = features.createEl('ul');
    if (this.details.complexityMetrics.hasOptional) {
      featuresList.createEl('li', { text: 'Uses OPTIONAL clauses' });
    }
    if (this.details.complexityMetrics.hasUnion) {
      featuresList.createEl('li', { text: 'Uses UNION clauses' });
    }
    if (this.details.complexityMetrics.hasFilters) {
      featuresList.createEl('li', { text: 'Uses FILTER clauses' });
    }
    if (this.details.complexityMetrics.hasSubqueries) {
      featuresList.createEl('li', { text: 'Uses subqueries' });
    }
    if (!featuresList.hasChildNodes()) {
      featuresList.createEl('li', {
        text: 'Basic query (no advanced features)',
      });
    }
  }

  private renderStatusInfo(container: HTMLElement): void {
    const section = container.createDiv({ cls: 'rdf-details-section' });
    section.createEl('h3', { text: 'Status & Warnings' });

    const statusContainer = section.createDiv({ cls: 'rdf-status-container' });

    // Status
    const statusSetting = new Setting(statusContainer).setName(
      'Execution Status'
    );

    statusSetting.controlEl.createSpan({
      cls: `rdf-status-${this.details.status}`,
      text: this.details.status.toUpperCase(),
    });

    // Error if present
    if (this.details.error) {
      new Setting(statusContainer).setName('Error').setDesc(this.details.error);
    }

    // Warnings
    if (this.details.warnings.length > 0) {
      const warningsContainer = statusContainer.createDiv({
        cls: 'rdf-warnings',
      });
      warningsContainer.createEl('p', { text: 'Warnings:' });

      const warningsList = warningsContainer.createEl('ul');
      for (const warning of this.details.warnings) {
        warningsList.createEl('li', { text: warning });
      }
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
