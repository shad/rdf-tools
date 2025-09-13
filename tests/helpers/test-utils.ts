/**
 * Test utilities and helpers for RDF Tools testing
 */

import { MockTFile } from './setup';
import type { BlockLocation, TurtleBlock } from '@/models/TurtleBlock';
import type { SparqlQuery } from '@/models/SparqlQuery';
import type { PrefixContext } from '@/utils/prefixManager';

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
 * Create sample SPARQL query for testing
 */
export function createSampleSparqlQuery(): string {
  return `PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX ex: <http://example.org/>

SELECT ?person ?name
WHERE {
  ?person a foaf:Person ;
          foaf:name ?name .
}`;
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

/**
 * Create sample URIs for testing
 */
export const TEST_URIS = {
  ALICE: 'http://example.org/alice',
  BOB: 'http://example.org/bob',
  PERSON_TYPE: 'http://xmlns.com/foaf/0.1/Person',
  NAME_PROP: 'http://xmlns.com/foaf/0.1/name',
  KNOWS_PROP: 'http://xmlns.com/foaf/0.1/knows',
} as const;

/**
 * Create sample CURIEs for testing
 */
export const TEST_CURIES = {
  ALICE: 'ex:alice',
  BOB: 'ex:bob',
  PERSON_TYPE: 'foaf:Person',
  NAME_PROP: 'foaf:name',
  KNOWS_PROP: 'foaf:knows',
} as const;

/**
 * Assert that a value is defined (not null or undefined)
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to be defined');
  }
}

/**
 * Create a promise that resolves after a given timeout
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a mock error for testing error handling
 */
export function createMockError(message: string, cause?: Error): Error {
  const error = new Error(message);
  if (cause) {
    error.cause = cause;
  }
  return error;
}
