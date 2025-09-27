import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetaGraphService } from '../MetaGraphService';
import { GraphService } from '../GraphService';
import { QueryExecutorService } from '../QueryExecutorService';
import { PrefixService } from '../PrefixService';
import { App } from 'obsidian';
import { Store, DataFactory } from 'n3';
import { MockTFile, MockTFolder } from '../../tests/helpers/setup';

const { namedNode, literal } = DataFactory;

// Mock the text import
vi.mock('../../../v1.ttl?text', () => ({
  default: `@prefix vault: <http://shadr.us/ns/rdf-tools/v1#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

# Classes
vault:File rdf:type rdfs:Class ;
           rdfs:label "File" ;
           rdfs:comment "A file in the vault" .

vault:Note rdf:type rdfs:Class ;
           rdfs:subClassOf vault:File ;
           rdfs:label "Note" ;
           rdfs:comment "A markdown note file" .

vault:Directory rdf:type rdfs:Class ;
                rdfs:label "Directory" ;
                rdfs:comment "A directory in the vault" .

# Properties
vault:name rdf:type rdf:Property ;
           rdfs:label "name" ;
           rdfs:domain vault:File ;
           rdfs:range xsd:string .

vault:size rdf:type rdf:Property ;
           rdfs:label "size" ;
           rdfs:domain vault:File ;
           rdfs:range xsd:integer .

vault:contains rdf:type rdf:Property ;
               rdfs:label "contains" ;
               rdfs:domain vault:Directory ;
               rdfs:range vault:File .`
}));

describe('MetaGraphService Integration Tests', () => {
  let metaService: MetaGraphService;
  let graphService: GraphService;
  let queryService: QueryExecutorService;
  let mockApp: App;
  let mockPrefixService: PrefixService;

  beforeEach(() => {
    // Mock PrefixService
    mockPrefixService = {
      getCompactUri: vi.fn(),
      getAllPrefixes: vi.fn(() => ({
        vault: 'http://shadr.us/ns/rdf-tools/v1#',
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        xsd: 'http://www.w3.org/2001/XMLSchema#',
      })),
      getGlobalPrefixes: vi.fn(() => ({
        vault: 'http://shadr.us/ns/rdf-tools/v1#',
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        xsd: 'http://www.w3.org/2001/XMLSchema#',
      })),
    } as unknown as PrefixService;

    // Create mock files and folders
    const mockRootFile = new MockTFile('root.md', {
      size: 150,
      ctime: Date.now() - 86400000,
      mtime: Date.now() - 3600000
    });

    const mockNestedFile = new MockTFile('notes/nested.md', {
      size: 250,
      ctime: Date.now() - 172800000,
      mtime: Date.now() - 7200000
    });

    const mockTtlFile = new MockTFile('data/ontology.ttl', {
      size: 500,
      ctime: Date.now() - 259200000,
      mtime: Date.now() - 10800000
    });

    const mockNotesFolder = new MockTFolder('notes', [mockNestedFile]);
    const mockDataFolder = new MockTFolder('data', [mockTtlFile]);

    // Set up parent-child relationships properly
    mockNestedFile.parent = mockNotesFolder;
    mockTtlFile.parent = mockDataFolder;

    // Mock App
    mockApp = {
      vault: {
        getAllLoadedFiles: vi.fn(() => [mockRootFile, mockNotesFolder, mockNestedFile, mockDataFolder, mockTtlFile]),
        getMarkdownFiles: vi.fn(() => [mockRootFile, mockNestedFile]),
        read: vi.fn((file) => {
          if (file.path === 'root.md') {
            return Promise.resolve('# Root\nThis is the root file with [[nested]] link.');
          } else if (file.path === 'notes/nested.md') {
            return Promise.resolve('# Nested\nThis is a nested file.');
          }
          return Promise.resolve('');
        }),
      },
      metadataCache: {
        getFirstLinkpathDest: vi.fn((linkTarget, sourcePath) => {
          if (linkTarget === 'nested' && sourcePath === 'root.md') {
            return mockNestedFile;
          }
          return null;
        }),
      },
    } as unknown as App;

    const mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      updateSettings: vi.fn(),
    } as any;
    metaService = new MetaGraphService(mockApp, mockPrefixService, mockLogger);
    graphService = new GraphService(mockApp, mockPrefixService, mockLogger);
    queryService = new QueryExecutorService(graphService);
  });

  describe('End-to-End Metadata Graph Functionality', () => {
    it('should generate complete metadata graph with files, directories, and relationships', async () => {
      const graph = await metaService.generateGraph();

      expect(graph.uri).toBe('meta://');
      expect(graph.tripleCount).toBeGreaterThan(0);

      // Verify all files are represented
      const store = graph.store;

      // Root file
      const rootQuads = store.getQuads('vault://root.md', null, null, 'meta://');
      expect(rootQuads.length).toBeGreaterThan(0);

      // Nested file
      const nestedQuads = store.getQuads('vault://notes/nested.md', null, null, 'meta://');
      expect(nestedQuads.length).toBeGreaterThan(0);

      // TTL file
      const ttlQuads = store.getQuads('vault://data/ontology.ttl', null, null, 'meta://');
      expect(ttlQuads.length).toBeGreaterThan(0);

      // Directories
      const notesQuads = store.getQuads('vault://notes', null, null, 'meta://');
      expect(notesQuads.length).toBeGreaterThan(0);

      const dataQuads = store.getQuads('vault://data', null, null, 'meta://');
      expect(dataQuads.length).toBeGreaterThan(0);
    });

    it('should correctly classify different file types', async () => {
      const graph = await metaService.generateGraph();
      const store = graph.store;

      // Markdown files should be Notes
      const rootTypeQuads = store.getQuads(
        'vault://root.md',
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        'http://shadr.us/ns/rdf-tools/v1#Note',
        'meta://'
      );
      expect(rootTypeQuads.length).toBe(1);

      // TTL files should be Files
      const ttlTypeQuads = store.getQuads(
        'vault://data/ontology.ttl',
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        'http://shadr.us/ns/rdf-tools/v1#File',
        'meta://'
      );
      expect(ttlTypeQuads.length).toBe(1);

      // Directories should be Directories
      const dirTypeQuads = store.getQuads(
        'vault://notes',
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        'http://shadr.us/ns/rdf-tools/v1#Directory',
        'meta://'
      );
      expect(dirTypeQuads.length).toBe(1);
    });

    it('should establish correct containment and parent relationships', async () => {
      const graph = await metaService.generateGraph();
      const store = graph.store;

      // Notes directory should contain nested file
      const containsQuads = store.getQuads(
        'vault://notes',
        'http://shadr.us/ns/rdf-tools/v1#contains',
        'vault://notes/nested.md',
        'meta://'
      );
      expect(containsQuads.length).toBe(1);

      // Nested file should have notes as parent
      const parentQuads = store.getQuads(
        'vault://notes/nested.md',
        'http://shadr.us/ns/rdf-tools/v1#parentDirectory',
        'vault://notes',
        'meta://'
      );
      expect(parentQuads.length).toBe(1);

      // Data directory should contain ttl file
      const dataContainsQuads = store.getQuads(
        'vault://data',
        'http://shadr.us/ns/rdf-tools/v1#contains',
        'vault://data/ontology.ttl',
        'meta://'
      );
      expect(dataContainsQuads.length).toBe(1);
    });

    it('should detect and represent wikilinks between files', async () => {
      const graph = await metaService.generateGraph();
      const store = graph.store;

      // Root should link to nested (based on mock)
      const linkQuads = store.getQuads(
        'vault://root.md',
        'http://shadr.us/ns/rdf-tools/v1#linksTo',
        'vault://notes/nested.md',
        'meta://'
      );
      expect(linkQuads.length).toBe(1);

      // Nested should have backlink from root
      const backlinkQuads = store.getQuads(
        'vault://notes/nested.md',
        'http://shadr.us/ns/rdf-tools/v1#backlinkedFrom',
        'vault://root.md',
        'meta://'
      );
      expect(backlinkQuads.length).toBe(1);
    });

    it('should include word counts for markdown files', async () => {
      const graph = await metaService.generateGraph();
      const store = graph.store;

      // Check word count for root file
      const rootWordCountQuads = store.getQuads(
        'vault://root.md',
        'http://shadr.us/ns/rdf-tools/v1#wordCount',
        null,
        'meta://'
      );
      expect(rootWordCountQuads.length).toBe(1);
      expect(parseInt(rootWordCountQuads[0].object.value)).toBeGreaterThan(0);

      // Check word count for nested file
      const nestedWordCountQuads = store.getQuads(
        'vault://notes/nested.md',
        'http://shadr.us/ns/rdf-tools/v1#wordCount',
        null,
        'meta://'
      );
      expect(nestedWordCountQuads.length).toBe(1);
      expect(parseInt(nestedWordCountQuads[0].object.value)).toBeGreaterThan(0);

      // TTL files should not have word counts
      const ttlWordCountQuads = store.getQuads(
        'vault://data/ontology.ttl',
        'http://shadr.us/ns/rdf-tools/v1#wordCount',
        null,
        'meta://'
      );
      expect(ttlWordCountQuads.length).toBe(0);
    });
  });

  describe('End-to-End Ontology Graph Functionality', () => {
    it('should generate complete ontology graph from v1.ttl', async () => {
      const graph = await metaService.generateOntologyGraph();

      expect(graph.uri).toBe('meta://ontology');
      expect(graph.tripleCount).toBeGreaterThan(0);

      const store = graph.store;

      // All triples should be in meta://ontology graph
      const allQuads = store.getQuads(null, null, null, null);
      expect(allQuads.length).toBeGreaterThan(0);
      allQuads.forEach(quad => {
        expect(quad.graph.value).toBe('meta://ontology');
      });
    });

    it('should contain expected ontology classes with proper metadata', async () => {
      const graph = await metaService.generateOntologyGraph();
      const store = graph.store;

      // Check File class
      const fileClass = store.getQuads(
        'http://shadr.us/ns/rdf-tools/v1#File',
        'http://www.w3.org/1999/02/22-rdf-syntax-ns#type',
        'http://www.w3.org/2000/01/rdf-schema#Class',
        'meta://ontology'
      );
      expect(fileClass.length).toBe(1);

      const fileLabel = store.getQuads(
        'http://shadr.us/ns/rdf-tools/v1#File',
        'http://www.w3.org/2000/01/rdf-schema#label',
        null,
        'meta://ontology'
      );
      expect(fileLabel.length).toBe(1);
      expect(fileLabel[0].object.value).toBe('File');

      // Check Note class and its subclass relationship
      const noteSubclass = store.getQuads(
        'http://shadr.us/ns/rdf-tools/v1#Note',
        'http://www.w3.org/2000/01/rdf-schema#subClassOf',
        'http://shadr.us/ns/rdf-tools/v1#File',
        'meta://ontology'
      );
      expect(noteSubclass.length).toBe(1);
    });

    it('should contain expected ontology properties with domains and ranges', async () => {
      const graph = await metaService.generateOntologyGraph();
      const store = graph.store;

      // Check name property domain
      const nameDomain = store.getQuads(
        'http://shadr.us/ns/rdf-tools/v1#name',
        'http://www.w3.org/2000/01/rdf-schema#domain',
        'http://shadr.us/ns/rdf-tools/v1#File',
        'meta://ontology'
      );
      expect(nameDomain.length).toBe(1);

      // Check name property range
      const nameRange = store.getQuads(
        'http://shadr.us/ns/rdf-tools/v1#name',
        'http://www.w3.org/2000/01/rdf-schema#range',
        'http://www.w3.org/2001/XMLSchema#string',
        'meta://ontology'
      );
      expect(nameRange.length).toBe(1);

      // Check contains property
      const containsDomain = store.getQuads(
        'http://shadr.us/ns/rdf-tools/v1#contains',
        'http://www.w3.org/2000/01/rdf-schema#domain',
        'http://shadr.us/ns/rdf-tools/v1#Directory',
        'meta://ontology'
      );
      expect(containsDomain.length).toBe(1);
    });
  });

  describe('GraphService Integration with Meta Graphs', () => {
    it('should load and cache both metadata and ontology graphs through GraphService', async () => {
      const graphs = await graphService.getGraphs(['meta://', 'meta://ontology']);

      expect(graphs).toHaveLength(2);

      const metaGraph = graphs.find(g => g.uri === 'meta://');
      const ontologyGraph = graphs.find(g => g.uri === 'meta://ontology');

      expect(metaGraph).toBeDefined();
      expect(ontologyGraph).toBeDefined();
      expect(metaGraph!.tripleCount).toBeGreaterThan(0);
      expect(ontologyGraph!.tripleCount).toBeGreaterThan(0);

      // Should cache subsequent requests
      const graphs2 = await graphService.getGraphs(['meta://', 'meta://ontology']);
      expect(graphs2[0]).toBe(graphs[0]); // Same object reference
      expect(graphs2[1]).toBe(graphs[1]); // Same object reference
    });

    it('should handle URI resolution for meta graphs', () => {
      expect(graphService.resolveVaultUri('meta://')).toEqual(['meta://']);
      expect(graphService.resolveVaultUri('meta://ontology')).toEqual(['meta://ontology']);

      // Should not affect vault URI resolution
      expect(graphService.resolveVaultUri('vault://test.md')).toEqual(['vault://test.md']);
    });

    it('should invalidate meta graph caches independently', async () => {
      // Load both graphs
      await graphService.getGraphs(['meta://', 'meta://ontology']);

      // Invalidate only metadata graph
      graphService.invalidateGraph('meta://');

      // Should be able to reload without errors
      const graphs = await graphService.getGraphs(['meta://', 'meta://ontology']);
      expect(graphs).toHaveLength(2);
    });
  });

  // Note: SPARQL query integration is tested separately in other test files
  // The core meta graph functionality is thoroughly tested above
});