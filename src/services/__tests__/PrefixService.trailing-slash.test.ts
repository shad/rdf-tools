import { describe, it, expect } from 'vitest';
import { PrefixService } from '../PrefixService';

describe('PrefixService - Trailing Slash Handling', () => {
  it('should handle prefix without trailing slash for URIs with slash', () => {
    const prefixService = new PrefixService();

    // This simulates the common case where users define:
    // PREFIX : <vault://hellboy-universe.md>
    // but URIs in the data are like vault://hellboy-universe.md/BPRD
    const prefixContext = prefixService.createPrefixContext(
      {}, // localPrefixes
      { '': 'vault://hellboy-universe.md' } // queryPrefixes - no trailing slash
    );

    const uri1 = 'vault://hellboy-universe.md/BPRD';
    const uri2 = 'vault://hellboy-universe.md/NaziOccultProgram';

    const curie1 = prefixService.createCurie(uri1, prefixContext);
    const curie2 = prefixService.createCurie(uri2, prefixContext);

    expect(curie1).toBe(':BPRD');
    expect(curie2).toBe(':NaziOccultProgram');
  });

  it('should still work normally when prefix already has trailing slash', () => {
    const prefixService = new PrefixService();

    const prefixContext = prefixService.createPrefixContext(
      {}, // localPrefixes
      { '': 'vault://hellboy-universe.md/' } // queryPrefixes - with trailing slash
    );

    const uri = 'vault://hellboy-universe.md/BPRD';
    const curie = prefixService.createCurie(uri, prefixContext);

    expect(curie).toBe(':BPRD');
  });

  it('should prefer longer matches correctly with trailing slash logic', () => {
    const prefixService = new PrefixService();

    const prefixContext = prefixService.createPrefixContext(
      {}, // localPrefixes
      {
        base: 'vault://hellboy-universe.md',  // shorter, no slash
        specific: 'vault://hellboy-universe.md/characters/' // longer, with slash
      }
    );

    const uri1 = 'vault://hellboy-universe.md/BPRD'; // should match 'base' with auto slash
    const uri2 = 'vault://hellboy-universe.md/characters/hellboy'; // should match 'specific'

    const curie1 = prefixService.createCurie(uri1, prefixContext);
    const curie2 = prefixService.createCurie(uri2, prefixContext);

    expect(curie1).toBe('base:BPRD');
    expect(curie2).toBe('specific:hellboy');
  });

  it('should handle standard prefixes with and without trailing slashes', () => {
    const prefixService = new PrefixService();

    // Test both ways that foaf might be defined
    const prefixContext1 = prefixService.createPrefixContext(
      {}, // localPrefixes
      { foaf: 'http://xmlns.com/foaf/0.1' } // no trailing slash
    );

    const prefixContext2 = prefixService.createPrefixContext(
      {}, // localPrefixes
      { foaf: 'http://xmlns.com/foaf/0.1/' } // with trailing slash
    );

    const uri = 'http://xmlns.com/foaf/0.1/name';

    const curie1 = prefixService.createCurie(uri, prefixContext1);
    const curie2 = prefixService.createCurie(uri, prefixContext2);

    // Both should work and produce the same result
    expect(curie1).toBe('foaf:name');
    expect(curie2).toBe('foaf:name');
  });
});