/**
 * Test utilities and helpers for RDF Tools testing
 */

import { MockTFile } from './setup';
import type { BlockLocation } from '@/models/TurtleBlock';
import type { PrefixContext } from '@/services/PrefixService';

/**
 * Create a mock TFile for testing
 */
export function createMockFile(path: string): MockTFile {
  return new MockTFile(path);
}

/**
 * Create a mock BlockLocation for testing
 */
export function createMockBlockLocation(
  filePath: string = 'test.md',
  startLine: number = 0,
  endLine: number = 2,
  startColumn: number = 0,
  endColumn: number = 10
): BlockLocation {
  return {
    file: createMockFile(filePath),
    startLine,
    endLine,
    startColumn,
    endColumn,
  };
}

/**
 * Create sample turtle content for testing
 */
export function createSampleTurtleContent(): string {
  return `@prefix ex: <http://example.org/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

ex:alice a foaf:Person ;
    foaf:name "Alice" ;
    foaf:knows ex:bob .

ex:bob a foaf:Person ;
    foaf:name "Bob" .`;
}

/**
 * Create a mock prefix context for testing
 */
export function createMockPrefixContext(
  globalPrefixes: Record<string, string> = {},
  localPrefixes: Record<string, string> = {},
  queryPrefixes: Record<string, string> = {}
): PrefixContext {
  return {
    globalPrefixes: {
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
      foaf: 'http://xmlns.com/foaf/0.1/',
      ...globalPrefixes,
    },
    localPrefixes,
    queryPrefixes,
  };
}

/**
 * Create common RDF prefixes for testing
 */
export function createCommonPrefixes(): Record<string, string> {
  return {
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    owl: 'http://www.w3.org/2002/07/owl#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    foaf: 'http://xmlns.com/foaf/0.1/',
    dc: 'http://purl.org/dc/elements/1.1/',
    dcterms: 'http://purl.org/dc/terms/',
    skos: 'http://www.w3.org/2004/02/skos/core#',
    schema: 'http://schema.org/',
    ex: 'http://example.org/',
  };
}
