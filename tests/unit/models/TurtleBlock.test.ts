/**
 * Tests for TurtleBlock model
 */

import { describe, it, expect } from 'vitest';
import { TurtleBlockFactory, TurtleBlockUtils } from '@/models/TurtleBlock';
import { createMockBlockLocation, createSampleTurtleContent } from '@tests/helpers/test-utils';

describe('TurtleBlockFactory', () => {
  describe('generateBlockId', () => {
    it('should generate a unique ID based on location', () => {
      const location = createMockBlockLocation('notes/test.md', 5, 10, 0, 20);
      const id = TurtleBlockFactory.generateBlockId(location);
      
      expect(id).toBe('turtle-block:notes/test.md:5-0');
    });

    it('should generate different IDs for different locations', () => {
      const location1 = createMockBlockLocation('notes/test1.md', 1, 3, 0, 10);
      const location2 = createMockBlockLocation('notes/test2.md', 2, 4, 5, 15);
      
      const id1 = TurtleBlockFactory.generateBlockId(location1);
      const id2 = TurtleBlockFactory.generateBlockId(location2);
      
      expect(id1).not.toBe(id2);
      expect(id1).toBe('turtle-block:notes/test1.md:1-0');
      expect(id2).toBe('turtle-block:notes/test2.md:2-5');
    });
  });

  describe('createContentHash', () => {
    it('should generate consistent hash for same content', () => {
      const content = createSampleTurtleContent();
      const hash1 = TurtleBlockFactory.createContentHash(content);
      const hash2 = TurtleBlockFactory.createContentHash(content);
      
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBeGreaterThan(0);
    });

    it('should generate different hashes for different content', () => {
      const content1 = '@prefix ex: <http://example.org/> .';
      const content2 = '@prefix test: <http://test.org/> .';
      
      const hash1 = TurtleBlockFactory.createContentHash(content1);
      const hash2 = TurtleBlockFactory.createContentHash(content2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty content', () => {
      const hash = TurtleBlockFactory.createContentHash('');
      expect(typeof hash).toBe('string');
    });
  });

  describe('generateBaseUri', () => {
    it('should generate vault URI from file path', () => {
      const uri = TurtleBlockFactory.generateBaseUri('notes/ontologies/test.md');
      expect(uri).toBe('vault://notes/ontologies/test.md/');
    });

    it('should handle Windows-style paths', () => {
      const uri = TurtleBlockFactory.generateBaseUri('notes\\ontologies\\test.md');
      expect(uri).toBe('vault://notes/ontologies/test.md/');
    });

    it('should handle root level files', () => {
      const uri = TurtleBlockFactory.generateBaseUri('test.md');
      expect(uri).toBe('vault://test.md/');
    });
  });

  describe('createTurtleBlock', () => {
    it('should create a valid turtle block', () => {
      const location = createMockBlockLocation('test.md', 0, 5, 0, 100);
      const content = createSampleTurtleContent();
      
      const block = TurtleBlockFactory.createTurtleBlock({
        location,
        content,
      });

      expect(block.id).toBe('turtle-block:test.md:0-0');
      expect(block.location).toBe(location);
      expect(block.content).toBe(content);
      expect(block.baseUri).toBe('vault://test.md/');
      expect(block.contentHash).toBe(TurtleBlockFactory.createContentHash(content));
      expect(block.createdAt).toBeInstanceOf(Date);
      expect(block.lastModified).toBeInstanceOf(Date);
    });

    it('should use custom base URI when provided', () => {
      const location = createMockBlockLocation();
      const customBaseUri = 'http://custom.example.org/';
      
      const block = TurtleBlockFactory.createTurtleBlock({
        location,
        content: '@prefix ex: <http://example.org/> .',
        baseUri: customBaseUri,
      });

      expect(block.baseUri).toBe(customBaseUri);
    });

    it('should set creation and modification times to same value initially', () => {
      const location = createMockBlockLocation();
      const block = TurtleBlockFactory.createTurtleBlock({
        location,
        content: '',
      });

      expect(block.createdAt.getTime()).toBe(block.lastModified.getTime());
    });
  });
});

describe('TurtleBlockUtils', () => {
  describe('needsReparse', () => {
    it('should return false when content is unchanged', () => {
      const location = createMockBlockLocation();
      const content = createSampleTurtleContent();
      const block = TurtleBlockFactory.createTurtleBlock({
        location,
        content,
      });

      expect(TurtleBlockUtils.needsReparse(block, content)).toBe(false);
    });

    it('should return true when content changes', () => {
      const location = createMockBlockLocation();
      const originalContent = '@prefix ex: <http://example.org/> .';
      const newContent = '@prefix test: <http://test.org/> .';
      
      const block = TurtleBlockFactory.createTurtleBlock({
        location,
        content: originalContent,
      });

      expect(TurtleBlockUtils.needsReparse(block, newContent)).toBe(true);
    });

    it('should handle whitespace-only changes', () => {
      const location = createMockBlockLocation();
      const originalContent = '@prefix ex: <http://example.org/> .';
      const newContent = '@prefix ex: <http://example.org/> . '; // Added space
      
      const block = TurtleBlockFactory.createTurtleBlock({
        location,
        content: originalContent,
      });

      expect(TurtleBlockUtils.needsReparse(block, newContent)).toBe(true);
    });
  });

  describe('isAtLocation', () => {
    it('should return true for positions within block bounds', () => {
      const location = createMockBlockLocation('test.md', 5, 10, 0, 20);
      const block = TurtleBlockFactory.createTurtleBlock({
        location,
        content: '',
      });

      expect(TurtleBlockUtils.isAtLocation(block, 5, 0)).toBe(true); // Start position
      expect(TurtleBlockUtils.isAtLocation(block, 7, 10)).toBe(true); // Middle
      expect(TurtleBlockUtils.isAtLocation(block, 10, 20)).toBe(true); // End position
    });

    it('should return false for positions outside block bounds', () => {
      const location = createMockBlockLocation('test.md', 5, 10, 0, 20);
      const block = TurtleBlockFactory.createTurtleBlock({
        location,
        content: '',
      });

      expect(TurtleBlockUtils.isAtLocation(block, 4, 0)).toBe(false); // Before start line
      expect(TurtleBlockUtils.isAtLocation(block, 11, 0)).toBe(false); // After end line
      expect(TurtleBlockUtils.isAtLocation(block, 5, -1)).toBe(false); // Before start column
      expect(TurtleBlockUtils.isAtLocation(block, 10, 21)).toBe(false); // After end column
    });
  });

  describe('getLocationString', () => {
    it('should format location as human-readable string', () => {
      const location = createMockBlockLocation('notes/test.md', 4, 8, 2, 15);
      const block = TurtleBlockFactory.createTurtleBlock({
        location,
        content: '',
      });

      const locationString = TurtleBlockUtils.getLocationString(block);
      expect(locationString).toBe('notes/test.md:5:3'); // 1-based line and column
    });
  });

  describe('looksLikeTurtle', () => {
    it('should return true for content with @prefix', () => {
      expect(TurtleBlockUtils.looksLikeTurtle('@prefix ex: <http://example.org/> .')).toBe(true);
    });

    it('should return true for content with @base', () => {
      expect(TurtleBlockUtils.looksLikeTurtle('@base <http://example.org/> .')).toBe(true);
    });

    it('should return true for content with URIs', () => {
      expect(TurtleBlockUtils.looksLikeTurtle('<http://example.org/alice> a <http://xmlns.com/foaf/0.1/Person> .')).toBe(true);
    });

    it('should return true for content with CURIEs', () => {
      expect(TurtleBlockUtils.looksLikeTurtle('ex:alice a foaf:Person .')).toBe(true);
    });

    it('should return true for content with colons (potential CURIEs)', () => {
      expect(TurtleBlockUtils.looksLikeTurtle('something:else')).toBe(true);
    });

    it('should return false for empty content', () => {
      expect(TurtleBlockUtils.looksLikeTurtle('')).toBe(false);
      expect(TurtleBlockUtils.looksLikeTurtle('   ')).toBe(false);
    });

    it('should return false for content that does not look like turtle', () => {
      expect(TurtleBlockUtils.looksLikeTurtle('This is just plain text.')).toBe(false);
      expect(TurtleBlockUtils.looksLikeTurtle('# This is a markdown header')).toBe(false);
    });

    it('should handle mixed content', () => {
      const content = `
        Some text before
        @prefix ex: <http://example.org/> .
        More content
      `;
      expect(TurtleBlockUtils.looksLikeTurtle(content)).toBe(true);
    });
  });
});