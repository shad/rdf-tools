/**
 * Context for prefix resolution
 */
export interface PrefixContext {
  /** Global prefixes available throughout the vault */
  globalPrefixes: Record<string, string>;
  /** File-local prefixes from turtle blocks */
  localPrefixes: Record<string, string>;
  /** Query-specific prefixes */
  queryPrefixes: Record<string, string>;
}

/**
 * Result of prefix resolution
 */
export interface PrefixResolutionResult {
  /** Whether resolution was successful */
  success: boolean;
  /** The resolved full URI (if successful) */
  resolvedUri?: string;
  /** The prefix that was used */
  usedPrefix?: string;
  /** Any error that occurred */
  error?: string;
}

/**
 * Manager for prefix definitions and CURIE expansion/contraction
 *
 * Leverages N3.js DataFactory for consistent URI handling
 */
export class PrefixService {
  private globalPrefixes: Record<string, string>;

  constructor(globalPrefixes: Record<string, string> = {}) {
    this.globalPrefixes = { ...globalPrefixes };
  }

  /**
   * Update global prefixes
   */
  updateGlobalPrefixes(prefixes: Record<string, string>): void {
    this.globalPrefixes = { ...prefixes };
  }

  /**
   * Get all global prefixes
   */
  getGlobalPrefixes(): Record<string, string> {
    return { ...this.globalPrefixes };
  }

  /**
   * Create a merged prefix context from global, local, and query prefixes
   * Later entries override earlier ones (query > local > global)
   */
  createPrefixContext(
    localPrefixes: Record<string, string> = {},
    queryPrefixes: Record<string, string> = {}
  ): PrefixContext {
    return {
      globalPrefixes: this.globalPrefixes,
      localPrefixes,
      queryPrefixes,
    };
  }

  /**
   * Get merged prefixes with proper precedence
   * Query prefixes > Local prefixes > Global prefixes
   */
  getMergedPrefixes(context: PrefixContext): Record<string, string> {
    return {
      ...context.globalPrefixes,
      ...context.localPrefixes,
      ...context.queryPrefixes,
    };
  }

  /**
   * Expand a CURIE (Compact URI) to a full URI
   */
  expandCurie(curie: string, context: PrefixContext): PrefixResolutionResult {
    // Check if it's already a full URI
    if (this.isAbsoluteUri(curie)) {
      return {
        success: true,
        resolvedUri: curie,
      };
    }

    // Parse the CURIE
    const colonIndex = curie.indexOf(':');
    if (colonIndex < 0) {
      return {
        success: false,
        error: 'Not a valid CURIE format (missing prefix)',
      };
    }

    const prefix = curie.substring(0, colonIndex);
    const localName = curie.substring(colonIndex + 1);

    // Find the namespace URI with proper precedence
    const mergedPrefixes = this.getMergedPrefixes(context);
    const namespaceUri = mergedPrefixes[prefix];

    if (!namespaceUri) {
      return {
        success: false,
        error: `Unknown prefix: ${prefix}`,
      };
    }

    // Concatenate namespace and local name to create the full URI
    const expandedUri = namespaceUri + localName;

    // Validate that the result is a proper URI
    try {
      new URL(expandedUri);
      return {
        success: true,
        resolvedUri: expandedUri,
        usedPrefix: prefix,
      };
    } catch (error) {
      return {
        success: false,
        error: `Invalid URI result: ${expandedUri}`,
      };
    }
  }

  /**
   * Create a CURIE from a full URI using available prefixes
   */
  createCurie(uri: string, context: PrefixContext): string | null {
    const mergedPrefixes = this.getMergedPrefixes(context);

    // Find the longest matching namespace
    let bestPrefix = '';
    let bestNamespace = '';

    for (const [prefix, namespace] of Object.entries(mergedPrefixes)) {
      if (
        uri.startsWith(namespace) &&
        namespace.length > bestNamespace.length
      ) {
        bestPrefix = prefix;
        bestNamespace = namespace;
      }
    }

    if (bestNamespace) {
      const localName = uri.substring(bestNamespace.length);
      // Basic validation for local name
      if (this.isValidLocalName(localName)) {
        return `${bestPrefix}:${localName}`;
      }
    }

    return null;
  }

  /**
   * Extract prefixes from turtle content
   * Uses basic regex parsing - N3.js will do the full parsing
   */
  extractPrefixesFromTurtle(turtleContent: string): Record<string, string> {
    const prefixes: Record<string, string> = {};

    // Match @prefix declarations
    const prefixRegex =
      /@prefix\s+([a-zA-Z_][a-zA-Z0-9_.-]*)?:\s*<([^>]+)>\s*\./gi;
    let match;

    while ((match = prefixRegex.exec(turtleContent)) !== null) {
      const prefix = match[1] || ''; // Handle default prefix (@prefix : <...>)
      const namespace = match[2];
      prefixes[prefix] = namespace;
    }

    return prefixes;
  }

  /**
   * Generate prefix declarations for turtle serialization
   */
  generatePrefixDeclarations(prefixes: Record<string, string>): string {
    const declarations: string[] = [];

    for (const [prefix, namespace] of Object.entries(prefixes)) {
      const prefixPart = prefix === '' ? ':' : `${prefix}:`;
      declarations.push(`@prefix ${prefixPart} <${namespace}> .`);
    }

    return declarations.join('\n');
  }

  /**
   * Resolve conflicts when merging prefixes
   */
  resolveConflicts(
    existing: Record<string, string>,
    incoming: Record<string, string>
  ): {
    merged: Record<string, string>;
    conflicts: Array<{ prefix: string; existing: string; incoming: string }>;
  } {
    const conflicts: Array<{
      prefix: string;
      existing: string;
      incoming: string;
    }> = [];
    const merged = { ...existing };

    for (const [prefix, namespace] of Object.entries(incoming)) {
      if (existing[prefix] && existing[prefix] !== namespace) {
        conflicts.push({
          prefix,
          existing: existing[prefix],
          incoming: namespace,
        });
      }
      merged[prefix] = namespace; // Incoming overrides existing
    }

    return { merged, conflicts };
  }

  /**
   * Get commonly used RDF prefixes
   * @deprecated Use RdfToolsSettings.globalPrefixes instead
   */
  static getCommonPrefixes(): Record<string, string> {
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
      void: 'http://rdfs.org/ns/void#',
    };
  }

  /**
   * Check if a string looks like an absolute URI
   */
  private isAbsoluteUri(str: string): boolean {
    try {
      const url = new URL(str);
      // Only treat as absolute URI if it has a recognized scheme and authority
      const validSchemes = ['http', 'https', 'ftp', 'file', 'urn'];
      return validSchemes.includes(url.protocol.slice(0, -1));
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate that a local name is suitable for use in a CURIE
   */
  private isValidLocalName(localName: string): boolean {
    // Basic validation - more restrictive than the full IRI spec for safety
    return /^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(localName) && localName.length > 0;
  }

  /**
   * Get prefix precedence order (higher number = higher precedence)
   */
  getPrefixPrecedence(prefix: string, context: PrefixContext): number {
    if (context.queryPrefixes[prefix]) return 3;
    if (context.localPrefixes[prefix]) return 2;
    if (context.globalPrefixes[prefix]) return 1;
    return 0;
  }

  /**
   * Find all prefixes that could expand to a given namespace
   */
  findPrefixesForNamespace(
    namespace: string,
    context: PrefixContext
  ): string[] {
    const mergedPrefixes = this.getMergedPrefixes(context);
    const matches: string[] = [];

    for (const [prefix, ns] of Object.entries(mergedPrefixes)) {
      if (ns === namespace) {
        matches.push(prefix);
      }
    }

    return matches;
  }

  /**
   * Validate that a prefix declaration is well-formed
   */
  validatePrefixDeclaration(prefix: string, namespace: string): boolean {
    // Validate prefix name (empty string is allowed for default prefix)
    if (prefix !== '' && !/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(prefix)) {
      return false;
    }

    // Validate namespace URI
    try {
      new URL(namespace);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get suggestions for unknown prefixes
   */
  getSuggestionsForPrefix(
    unknownPrefix: string,
    context: PrefixContext
  ): string[] {
    const mergedPrefixes = this.getMergedPrefixes(context);
    const suggestions: string[] = [];

    // Find similar prefixes using simple string distance
    const availablePrefixes = Object.keys(mergedPrefixes);

    for (const prefix of availablePrefixes) {
      if (this.calculateLevenshteinDistance(unknownPrefix, prefix) <= 2) {
        suggestions.push(prefix);
      }
    }

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }

  /**
   * Simple Levenshtein distance calculation for suggestions
   */
  private calculateLevenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
}
