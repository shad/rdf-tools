import { Store, DataFactory, Parser } from 'n3';
import { TFile, TAbstractFile, TFolder, App } from 'obsidian';
import { Graph } from '../models/Graph';
import { PrefixService } from './PrefixService';
import ontologyContent from '../../v1.ttl?text';

const { namedNode, literal, quad } = DataFactory;

/**
 * Stateless service for generating metadata graphs about vault files and structure (meta:// URI)
 * Uses the v1.ttl ontology to describe file system metadata as RDF
 */
export class MetaGraphService {
  private readonly metaGraphUri = 'meta://';
  private readonly metaGraphNode = namedNode('meta://');
  private readonly ontologyGraphUri = 'meta://ontology';
  private readonly ontologyGraphNode = namedNode('meta://ontology');

  constructor(
    private app: App,
    private prefixService: PrefixService
  ) {}

  /**
   * Generate the metadata graph (called by GraphService)
   */
  async generateGraph(): Promise<Graph> {
    return await this.generateMetadataGraph();
  }

  /**
   * Generate the ontology graph (called by GraphService for meta://ontology)
   */
  async generateOntologyGraph(): Promise<Graph> {
    const store = new Store();
    const parser = new Parser();

    return new Promise((resolve, reject) => {
      parser.parse(ontologyContent, (error, quad, prefixes) => {
        if (error) {
          reject(new Error(`Failed to parse ontology: ${error.message}`));
          return;
        }

        if (quad) {
          // Store all ontology triples in the meta://ontology graph context
          store.addQuad(
            quad.subject,
            quad.predicate,
            quad.object,
            this.ontologyGraphNode
          );
        } else {
          // Parsing complete
          resolve({
            uri: this.ontologyGraphUri,
            filePath: '', // Not associated with a specific file
            store,
            lastModified: new Date(),
            tripleCount: store.size,
          });
        }
      });
    });
  }

  /**
   * Generate the complete metadata graph from vault file system
   */
  private async generateMetadataGraph(): Promise<Graph> {
    const store = new Store();

    // Process all files and folders in the vault
    const allFiles = this.app.vault.getAllLoadedFiles();

    // Generate triples for each file/folder
    for (const file of allFiles) {
      await this.addFileTriples(store, file);
    }

    // Add directory containment relationships
    this.addContainmentTriples(store, allFiles);

    // Add link relationships between files
    await this.addLinkTriples(store);

    return {
      uri: this.metaGraphUri,
      filePath: '', // Not associated with a specific file
      store,
      lastModified: new Date(),
      tripleCount: store.size,
    };
  }

  /**
   * Add RDF triples for a single file or folder
   */
  private async addFileTriples(
    store: Store,
    file: TAbstractFile
  ): Promise<void> {
    const normalizedPath = file.path.replace(/^\/+/, '');
    const fileUri = namedNode(`vault://${normalizedPath}`);

    // Common properties for all resources
    store.addQuad(
      quad(
        fileUri,
        namedNode('http://shadr.us/ns/rdf-tools/v1#path'),
        literal(file.path),
        this.metaGraphNode
      )
    );

    store.addQuad(
      quad(
        fileUri,
        namedNode('http://shadr.us/ns/rdf-tools/v1#name'),
        literal(file.name),
        this.metaGraphNode
      )
    );

    if ('extension' in file && 'stat' in file) {
      // File-specific properties
      const tFile = file as TFile;
      const fileType = this.getFileType(tFile);
      store.addQuad(
        quad(
          fileUri,
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode(`http://shadr.us/ns/rdf-tools/v1#${fileType}`),
          this.metaGraphNode
        )
      );

      // File metadata
      store.addQuad(
        quad(
          fileUri,
          namedNode('http://shadr.us/ns/rdf-tools/v1#size'),
          literal(
            tFile.stat.size.toString(),
            namedNode('http://www.w3.org/2001/XMLSchema#integer')
          ),
          this.metaGraphNode
        )
      );

      store.addQuad(
        quad(
          fileUri,
          namedNode('http://shadr.us/ns/rdf-tools/v1#created'),
          literal(
            new Date(tFile.stat.ctime).toISOString(),
            namedNode('http://www.w3.org/2001/XMLSchema#dateTime')
          ),
          this.metaGraphNode
        )
      );

      store.addQuad(
        quad(
          fileUri,
          namedNode('http://shadr.us/ns/rdf-tools/v1#modified'),
          literal(
            new Date(tFile.stat.mtime).toISOString(),
            namedNode('http://www.w3.org/2001/XMLSchema#dateTime')
          ),
          this.metaGraphNode
        )
      );

      // Add word count for markdown files
      if (tFile.extension === 'md') {
        try {
          const content = await this.app.vault.read(tFile);
          const wordCount = this.countWords(content);
          store.addQuad(
            quad(
              fileUri,
              namedNode('http://shadr.us/ns/rdf-tools/v1#wordCount'),
              literal(
                wordCount.toString(),
                namedNode('http://www.w3.org/2001/XMLSchema#integer')
              ),
              this.metaGraphNode
            )
          );
        } catch (error) {
          console.warn(
            `Could not read file ${file.path} for word count:`,
            error
          );
        }
      }
    } else if ('children' in file && !('extension' in file)) {
      // Folder-specific properties
      store.addQuad(
        quad(
          fileUri,
          namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
          namedNode('http://shadr.us/ns/rdf-tools/v1#Directory'),
          this.metaGraphNode
        )
      );
    }

    // Parent directory relationship
    if (file.parent) {
      const parentNormalizedPath = file.parent.path.replace(/^\/+/, '');
      const parentUri = namedNode(`vault://${parentNormalizedPath}`);
      store.addQuad(
        quad(
          fileUri,
          namedNode('http://shadr.us/ns/rdf-tools/v1#parentDirectory'),
          parentUri,
          this.metaGraphNode
        )
      );
    }
  }

  /**
   * Add directory containment relationships
   */
  private addContainmentTriples(store: Store, allFiles: TAbstractFile[]): void {
    for (const file of allFiles) {
      if ('children' in file && !('extension' in file)) {
        const tFolder = file as TFolder;
        const folderNormalizedPath = tFolder.path.replace(/^\/+/, '');
        const folderUri = namedNode(`vault://${folderNormalizedPath}`);

        // Add contains relationship for each child
        for (const child of tFolder.children) {
          const childNormalizedPath = child.path.replace(/^\/+/, '');
          const childUri = namedNode(`vault://${childNormalizedPath}`);
          store.addQuad(
            quad(
              folderUri,
              namedNode('http://shadr.us/ns/rdf-tools/v1#contains'),
              childUri,
              this.metaGraphNode
            )
          );
        }
      }
    }
  }

  /**
   * Add link relationships between files by analyzing wikilinks
   */
  private async addLinkTriples(store: Store): Promise<void> {
    const markdownFiles = this.app.vault.getMarkdownFiles();

    for (const file of markdownFiles) {
      try {
        const content = await this.app.vault.read(file);
        const links = this.extractWikiLinks(content);

        const sourceNormalizedPath = file.path.replace(/^\/+/, '');
        const sourceUri = namedNode(`vault://${sourceNormalizedPath}`);

        for (const linkTarget of links) {
          // Try to resolve the link to an actual file
          const targetFile = this.app.metadataCache.getFirstLinkpathDest(
            linkTarget,
            file.path
          );
          if (targetFile) {
            const targetNormalizedPath = targetFile.path.replace(/^\/+/, '');
            const targetUri = namedNode(`vault://${targetNormalizedPath}`);
            store.addQuad(
              quad(
                sourceUri,
                namedNode('http://shadr.us/ns/rdf-tools/v1#linksTo'),
                targetUri,
                this.metaGraphNode
              )
            );

            // Add reverse relationship
            store.addQuad(
              quad(
                targetUri,
                namedNode('http://shadr.us/ns/rdf-tools/v1#backlinkedFrom'),
                sourceUri,
                this.metaGraphNode
              )
            );
          }
        }
      } catch (error) {
        console.warn(`Could not analyze links in ${file.path}:`, error);
      }
    }
  }

  /**
   * Determine the appropriate file type based on extension
   */
  private getFileType(file: TFile): string {
    switch (file.extension) {
      case 'md':
        return 'Note';
      case 'ttl':
        return 'File'; // Could be more specific if needed
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'pdf':
        return 'Attachment';
      default:
        return 'File';
    }
  }

  /**
   * Count words in content (simple word counting)
   */
  private countWords(content: string): number {
    // Remove markdown syntax for more accurate word count
    const plainText = content
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]*`/g, '') // Remove inline code
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Convert links to just text
      .replace(/[#*_~`]/g, '') // Remove formatting characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    if (!plainText) return 0;

    return plainText.split(/\s+/).length;
  }

  /**
   * Extract wikilink targets from markdown content
   */
  private extractWikiLinks(content: string): string[] {
    const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
    const links: string[] = [];
    let match;

    while ((match = wikiLinkRegex.exec(content)) !== null) {
      links.push(match[1]);
    }

    return links;
  }

  /**
   * Get prefixes used in metadata generation
   */
  private getMetadataPrefixes(): Record<string, string> {
    return {
      vault: 'http://shadr.us/ns/rdf-tools/v1#',
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
    };
  }
}
