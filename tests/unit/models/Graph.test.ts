/**
 * Tests for Graph model
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Store, DataFactory } from 'n3';
import { GraphFactory, GraphUtils, type CreateGraphOptions } from '@/models/Graph';
import { createMockFile, createSampleTurtleContent } from '@tests/helpers/test-utils';

const { namedNode, literal, triple } = DataFactory;

describe('GraphFactory', () => {
  describe('createGraphUri', () => {
    it('should create vault URI from file path', () => {
      const filePath = 'notes/ontology.md';
      const uri = GraphFactory.createGraphUri(filePath);

      expect(uri).toBe('vault://notes/ontology.md');
    });

    it('should handle Windows-style paths', () => {
      const filePath = 'notes\\ontology.md';
      const uri = GraphFactory.createGraphUri(filePath);

      expect(uri).toBe('vault://notes/ontology.md');
    });

    it('should create different URIs for different paths', () => {
      const uri1 = GraphFactory.createGraphUri('file1.md');
      const uri2 = GraphFactory.createGraphUri('file2.md');

      expect(uri1).not.toBe(uri2);
      expect(uri1).toBe('vault://file1.md');
      expect(uri2).toBe('vault://file2.md');
    });
  });

  describe('createBaseUri', () => {
    it('should create base URI with trailing slash', () => {
      const baseUri = GraphFactory.createBaseUri('notes/ontology.md');

      expect(baseUri).toBe('vault://notes/ontology.md/');
    });

    it('should handle Windows paths', () => {
      const baseUri = GraphFactory.createBaseUri('notes\\ontology.md');

      expect(baseUri).toBe('vault://notes/ontology.md/');
    });
  });

  describe('createContentHash', () => {
    it('should generate consistent hash for same content', () => {
      const content = createSampleTurtleContent();
      const hash1 = GraphFactory.createContentHash(content);
      const hash2 = GraphFactory.createContentHash(content);
      
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBeGreaterThan(0);
    });

    it('should generate different hashes for different content', () => {
      const content1 = '@prefix ex: <http://example.org/> .';
      const content2 = '@prefix test: <http://test.org/> .';
      
      const hash1 = GraphFactory.createContentHash(content1);
      const hash2 = GraphFactory.createContentHash(content2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty content', () => {
      const hash = GraphFactory.createContentHash('');
      expect(typeof hash).toBe('string');
    });
  });

  describe('createInitialMetadata', () => {
    it('should create metadata with loading status', () => {
      const content = createSampleTurtleContent();
      const metadata = GraphFactory.createInitialMetadata(content);

      expect(metadata.status).toBe('loading');
      expect(metadata.lastModified).toBeInstanceOf(Date);
      expect(metadata.contentHash).toBe(GraphFactory.createContentHash(content));
    });
  });

  describe('createGraph', () => {
    it('should create a graph with all required properties', () => {
      const mockFile = createMockFile('notes/test.md');
      const turtleContent = createSampleTurtleContent();
      
      const options: CreateGraphOptions = {
        sourceFile: mockFile,
        turtleContent,
      };

      const graph = GraphFactory.createGraph(options);

      expect(graph.id).toBe('vault://notes/test.md');
      expect(graph.uri).toBe('vault://notes/test.md');
      expect(graph.baseUri).toBe('vault://notes/test.md/');
      expect(graph.sourceFile).toBe(mockFile);
      expect(graph.store).toBeInstanceOf(Store);
      expect(graph.metadata.status).toBe('loading');
      expect(graph.turtleContent).toBe(turtleContent);
      expect(graph.createdAt).toBeInstanceOf(Date);
    });

    it('should use custom base URI when provided', () => {
      const mockFile = createMockFile('test.md');
      const customBaseUri = 'http://custom.example.org/';
      
      const options: CreateGraphOptions = {
        sourceFile: mockFile,
        turtleContent: '',
        baseUri: customBaseUri,
      };

      const graph = GraphFactory.createGraph(options);

      expect(graph.baseUri).toBe(customBaseUri);
    });

    it('should create empty store initially', () => {
      const mockFile = createMockFile('test.md');
      const options: CreateGraphOptions = {
        sourceFile: mockFile,
        turtleContent: '',
      };

      const graph = GraphFactory.createGraph(options);

      expect(graph.store.size).toBe(0);
    });
  });
});

describe('GraphUtils', () => {
  let testGraph: any;

  beforeEach(() => {
    const mockFile = createMockFile('test.md');
    const options: CreateGraphOptions = {
      sourceFile: mockFile,
      turtleContent: createSampleTurtleContent(),
    };

    testGraph = GraphFactory.createGraph(options);
    
    // Add some test triples to the store
    testGraph.store.addQuad(triple(
      namedNode('http://example.org/alice'),
      namedNode('http://xmlns.com/foaf/0.1/name'),
      literal('Alice')
    ));
    testGraph.store.addQuad(triple(
      namedNode('http://example.org/bob'),
      namedNode('http://xmlns.com/foaf/0.1/name'),
      literal('Bob')
    ));
    testGraph.store.addQuad(triple(
      namedNode('http://example.org/alice'),
      namedNode('http://xmlns.com/foaf/0.1/knows'),
      namedNode('http://example.org/bob')
    ));
  });

  describe('needsUpdate', () => {
    it('should return false when content is unchanged', () => {
      const originalContent = testGraph.turtleContent;
      expect(GraphUtils.needsUpdate(testGraph, originalContent)).toBe(false);
    });

    it('should return true when content changes', () => {
      const newContent = '@prefix test: <http://test.org/> .';
      expect(GraphUtils.needsUpdate(testGraph, newContent)).toBe(true);
    });

    it('should handle whitespace changes', () => {
      const originalContent = testGraph.turtleContent;
      const newContent = originalContent + ' '; // Add space
      expect(GraphUtils.needsUpdate(testGraph, newContent)).toBe(true);
    });
  });

  describe('hasErrors', () => {
    it('should return false for graph without errors', () => {
      expect(GraphUtils.hasErrors(testGraph)).toBe(false);
    });

    it('should return true for graph with error status', () => {
      testGraph.metadata.status = 'error';
      expect(GraphUtils.hasErrors(testGraph)).toBe(true);
    });

    it('should return true for graph with parse error', () => {
      testGraph.metadata.parseError = 'Syntax error at line 5';
      expect(GraphUtils.hasErrors(testGraph)).toBe(true);
    });
  });

  describe('getTripleCount', () => {
    it('should return correct number of triples', () => {
      expect(GraphUtils.getTripleCount(testGraph)).toBe(3);
    });

    it('should return 0 for empty graph', () => {
      const emptyGraph = GraphFactory.createGraph({
        sourceFile: createMockFile('empty.md'),
        turtleContent: '',
      });
      expect(GraphUtils.getTripleCount(emptyGraph)).toBe(0);
    });
  });

  describe('getStatusDescription', () => {
    it('should return description for loading status', () => {
      testGraph.metadata.status = 'loading';
      expect(GraphUtils.getStatusDescription(testGraph)).toBe('Loading turtle data...');
    });

    it('should return description for ready status', () => {
      testGraph.metadata.status = 'ready';
      const description = GraphUtils.getStatusDescription(testGraph);
      expect(description).toContain('Ready');
    });

    it('should return description for error status', () => {
      testGraph.metadata.status = 'error';
      testGraph.metadata.parseError = 'Test error';
      const description = GraphUtils.getStatusDescription(testGraph);
      expect(description).toContain('Error');
      expect(description).toContain('Test error');
    });
  });

  describe('isEmpty', () => {
    it('should return false for graph with triples', () => {
      expect(GraphUtils.isEmpty(testGraph)).toBe(false);
    });

    it('should return true for empty graph', () => {
      const emptyGraph = GraphFactory.createGraph({
        sourceFile: createMockFile('empty.md'),
        turtleContent: '',
      });
      expect(GraphUtils.isEmpty(emptyGraph)).toBe(true);
    });
  });

  describe('getAllQuads', () => {
    it('should return all quads from the graph', () => {
      const quads = GraphUtils.getAllQuads(testGraph);
      
      expect(quads).toHaveLength(3);
      expect(quads.every(quad => quad.subject && quad.predicate && quad.object)).toBe(true);
    });

    it('should return empty array for empty graph', () => {
      const emptyGraph = GraphFactory.createGraph({
        sourceFile: createMockFile('empty.md'),
        turtleContent: '',
      });
      const quads = GraphUtils.getAllQuads(emptyGraph);
      
      expect(quads).toHaveLength(0);
    });
  });

  describe('getSubjects', () => {
    it('should return all unique subjects', () => {
      const subjects = GraphUtils.getSubjects(testGraph);
      
      expect(subjects).toHaveLength(2);
      expect(subjects).toContain('http://example.org/alice');
      expect(subjects).toContain('http://example.org/bob');
    });

    it('should return empty array for empty graph', () => {
      const emptyGraph = GraphFactory.createGraph({
        sourceFile: createMockFile('empty.md'),
        turtleContent: '',
      });
      const subjects = GraphUtils.getSubjects(emptyGraph);
      
      expect(subjects).toHaveLength(0);
    });
  });

  describe('getPredicates', () => {
    it('should return all unique predicates', () => {
      const predicates = GraphUtils.getPredicates(testGraph);
      
      expect(predicates).toHaveLength(2);
      expect(predicates).toContain('http://xmlns.com/foaf/0.1/name');
      expect(predicates).toContain('http://xmlns.com/foaf/0.1/knows');
    });
  });

  describe('getObjects', () => {
    it('should return all unique objects', () => {
      const objects = GraphUtils.getObjects(testGraph);
      
      expect(objects).toHaveLength(3);
      expect(objects).toContain('Alice');
      expect(objects).toContain('Bob');
      expect(objects).toContain('http://example.org/bob');
    });
  });
});