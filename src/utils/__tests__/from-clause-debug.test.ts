import { describe, it, expect } from 'vitest';
import { parseSparqlQuery } from '../parsing';

describe('FROM clause parsing debug', () => {
  it('should extract FROM clause from SPARQL query', () => {
    const query = `
      PREFIX foaf: <http://xmlns.com/foaf/0.1/>
      PREFIX : <vault://hellboy-universe.md/>
      SELECT ?name ?species
      FROM <vault://hellboy-universe.md>
      WHERE {
        ?person foaf:name ?name ;
                :species ?species .
      }
    `;

    const result = parseSparqlQuery(query);

    // Debug info commented out for production
    // console.log('DEBUG: parseSparqlQuery result:');
    // console.log('- success:', result.success);
    // console.log('- fromGraphs:', result.fromGraphs);
    // console.log('- fromNamedGraphs:', result.fromNamedGraphs);
    // console.log('- error:', result.error?.message);

    expect(result.success).toBe(true);
    expect(result.fromGraphs).toEqual(['vault://hellboy-universe.md']);
    expect(result.fromNamedGraphs).toEqual([]);
  });

  it('should extract FROM NAMED clause from SPARQL query', () => {
    const query = `
      SELECT ?s ?p ?o
      FROM NAMED <vault://hellboy-universe.md>
      WHERE { GRAPH ?g { ?s ?p ?o } }
    `;

    const result = parseSparqlQuery(query);

    // Debug info commented out for production
    // console.log('DEBUG: FROM NAMED result:');
    // console.log('- success:', result.success);
    // console.log('- fromGraphs:', result.fromGraphs);
    // console.log('- fromNamedGraphs:', result.fromNamedGraphs);

    expect(result.success).toBe(true);
    expect(result.fromGraphs).toEqual([]);
    expect(result.fromNamedGraphs).toEqual(['vault://hellboy-universe.md']);
  });
});