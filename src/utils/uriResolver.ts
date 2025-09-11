import { RdfErrorFactory, ValidationError } from '../types/errors';

/**
 * Types of URIs supported by the RDF Tools system
 */
export type UriType = 'absolute' | 'relative' | 'vault' | 'blank' | 'invalid';

/**
 * Information about a parsed URI
 */
export interface ParsedUri {
  /** The original URI string */
  original: string;
  /** Type of URI */
  type: UriType;
  /** The resolved absolute URI */
  resolved: string;
  /** URI scheme (http, https, vault, etc.) */
  scheme?: string;
  /** Authority part (host:port) */
  authority?: string;
  /** Path component */
  path?: string;
  /** Query component */
  query?: string;
  /** Fragment component */
  fragment?: string;
  /** Whether this URI is valid */
  isValid: boolean;
  /** Any validation errors */
  errors: ValidationError[];
}

/**
 * Context for URI resolution
 */
export interface UriResolutionContext {
  /** Base URI for resolving relative references */
  baseUri: string;
  /** Available prefixes for CURIE expansion */
  prefixes: Record<string, string>;
  /** Current file path (for vault URIs) */
  currentFilePath?: string;
  /** Whether to allow external URIs */
  allowExternal: boolean;
  /** Whether to validate URI accessibility */
  validateAccessibility: boolean;
}

/**
 * Result of URI resolution
 */
export interface UriResolutionResult {
  /** Whether resolution was successful */
  success: boolean;
  /** The resolved URI (if successful) */
  resolvedUri?: string;
  /** Type of the resolved URI */
  uriType?: UriType;
  /** Any errors that occurred */
  errors: ValidationError[];
  /** Warnings about the URI */
  warnings: ValidationError[];
  /** Display name for the URI */
  displayName?: string;
}

/**
 * Utility class for resolving and manipulating URIs in the RDF Tools context
 */
export class UriResolver {
  /**
   * Parse a URI string into components
   */
  static parseUri(uriString: string): ParsedUri {
    const errors: ValidationError[] = [];

    if (!uriString || typeof uriString !== 'string') {
      errors.push(
        RdfErrorFactory.createValidationError(
          'URI string is empty or invalid',
          'reference',
          undefined,
          { invalidValue: String(uriString) }
        )
      );

      return {
        original: uriString,
        type: 'invalid',
        resolved: '',
        isValid: false,
        errors,
      };
    }

    const trimmed = uriString.trim();

    // Check for blank node
    if (trimmed.startsWith('_:')) {
      return {
        original: uriString,
        type: 'blank',
        resolved: trimmed,
        isValid: true,
        errors: [],
      };
    }

    try {
      // Try to parse as URL
      const url = new URL(trimmed);

      return {
        original: uriString,
        type: url.protocol === 'vault:' ? 'vault' : 'absolute',
        resolved: url.toString(),
        scheme: url.protocol.slice(0, -1), // Remove trailing colon
        authority: url.host || undefined,
        path: url.pathname || undefined,
        query: url.search ? url.search.slice(1) : undefined, // Remove leading ?
        fragment: url.hash ? url.hash.slice(1) : undefined, // Remove leading #
        isValid: true,
        errors: [],
      };
    } catch {
      // Not a valid absolute URL, might be relative
      return {
        original: uriString,
        type: 'relative',
        resolved: trimmed,
        path: trimmed,
        isValid: true,
        errors: [],
      };
    }
  }

  /**
   * Resolve a URI against a base URI and context
   */
  static resolveUri(
    uriString: string,
    context: UriResolutionContext
  ): UriResolutionResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Parse the input URI
    const parsed = UriResolver.parseUri(uriString);

    if (!parsed.isValid) {
      return {
        success: false,
        errors: parsed.errors,
        warnings,
      };
    }

    // Handle different URI types
    switch (parsed.type) {
      case 'blank':
        return {
          success: true,
          resolvedUri: parsed.resolved,
          uriType: 'blank',
          errors,
          warnings,
          displayName: parsed.resolved,
        };

      case 'absolute':
        return UriResolver.handleAbsoluteUri(parsed, context, errors, warnings);

      case 'vault':
        return UriResolver.handleVaultUri(parsed, context, errors, warnings);

      case 'relative':
        return UriResolver.handleRelativeUri(parsed, context, errors, warnings);

      default:
        errors.push(
          RdfErrorFactory.createValidationError(
            `Unknown URI type: ${parsed.type}`,
            'reference'
          )
        );
        return { success: false, errors, warnings };
    }
  }

  /**
   * Handle absolute URI resolution
   */
  private static handleAbsoluteUri(
    parsed: ParsedUri,
    context: UriResolutionContext,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): UriResolutionResult {
    // Check if external URIs are allowed
    if (!context.allowExternal && parsed.scheme !== 'vault') {
      errors.push(
        RdfErrorFactory.createValidationError(
          'External URIs are not allowed in this context',
          'reference',
          undefined,
          { invalidValue: parsed.original }
        )
      );
      return { success: false, errors, warnings };
    }

    return {
      success: true,
      resolvedUri: parsed.resolved,
      uriType: 'absolute',
      errors,
      warnings,
      displayName: UriResolver.createDisplayName(parsed.resolved),
    };
  }

  /**
   * Handle vault URI resolution
   */
  private static handleVaultUri(
    parsed: ParsedUri,
    context: UriResolutionContext,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): UriResolutionResult {
    // Validate vault URI format
    if (!parsed.path) {
      errors.push(
        RdfErrorFactory.createValidationError(
          'Vault URI must have a path component',
          'reference',
          undefined,
          { invalidValue: parsed.original }
        )
      );
      return { success: false, errors, warnings };
    }

    // Normalize path separators
    const normalizedPath = parsed.path.replace(/\\/g, '/');
    const resolvedUri = `vault:${normalizedPath}${parsed.fragment ? `#${parsed.fragment}` : ''}`;

    return {
      success: true,
      resolvedUri,
      uriType: 'vault',
      errors,
      warnings,
      displayName: UriResolver.createVaultDisplayName(normalizedPath),
    };
  }

  /**
   * Handle relative URI resolution
   */
  private static handleRelativeUri(
    parsed: ParsedUri,
    context: UriResolutionContext,
    errors: ValidationError[],
    warnings: ValidationError[]
  ): UriResolutionResult {
    try {
      const baseUrl = new URL(context.baseUri);
      const resolvedUrl = new URL(parsed.original, baseUrl);

      return {
        success: true,
        resolvedUri: resolvedUrl.toString(),
        uriType: resolvedUrl.protocol === 'vault:' ? 'vault' : 'absolute',
        errors,
        warnings,
        displayName: UriResolver.createDisplayName(resolvedUrl.toString()),
      };
    } catch (error) {
      errors.push(
        RdfErrorFactory.createValidationError(
          `Failed to resolve relative URI: ${error}`,
          'reference',
          undefined,
          {
            invalidValue: parsed.original,
            expected: 'Valid relative URI against base: ' + context.baseUri,
          }
        )
      );
      return { success: false, errors, warnings };
    }
  }

  /**
   * Expand a CURIE (Compact URI) using available prefixes
   */
  static expandCurie(
    curie: string,
    prefixes: Record<string, string>
  ): UriResolutionResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Check if it's a CURIE (contains colon but not at start)
    const colonIndex = curie.indexOf(':');
    if (colonIndex <= 0) {
      errors.push(
        RdfErrorFactory.createValidationError(
          'Not a valid CURIE format',
          'reference',
          undefined,
          { invalidValue: curie, expected: 'prefix:suffix format' }
        )
      );
      return { success: false, errors, warnings };
    }

    const prefix = curie.substring(0, colonIndex);
    const suffix = curie.substring(colonIndex + 1);

    // Look up prefix
    const namespace = prefixes[prefix];
    if (!namespace) {
      errors.push(
        RdfErrorFactory.createValidationError(
          `Unknown prefix: ${prefix}`,
          'reference',
          undefined,
          {
            invalidValue: curie,
          }
        )
      );
      return { success: false, errors, warnings };
    }

    const expandedUri = namespace + suffix;

    return {
      success: true,
      resolvedUri: expandedUri,
      uriType: 'absolute',
      errors,
      warnings,
      displayName: curie, // Keep CURIE as display name
    };
  }

  /**
   * Create a compact CURIE from a URI using available prefixes
   */
  static createCurie(
    uri: string,
    prefixes: Record<string, string>
  ): string | null {
    // Find the longest matching prefix
    let bestPrefix = '';
    let bestNamespace = '';

    for (const [prefix, namespace] of Object.entries(prefixes)) {
      if (
        uri.startsWith(namespace) &&
        namespace.length > bestNamespace.length
      ) {
        bestPrefix = prefix;
        bestNamespace = namespace;
      }
    }

    if (bestNamespace) {
      const suffix = uri.substring(bestNamespace.length);
      // Ensure suffix is valid for a CURIE
      if (/^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(suffix)) {
        return `${bestPrefix}:${suffix}`;
      }
    }

    return null;
  }

  /**
   * Create a display name for a URI
   */
  static createDisplayName(uri: string): string {
    try {
      const url = new URL(uri);

      if (url.protocol === 'vault:') {
        return UriResolver.createVaultDisplayName(url.pathname);
      }

      // For external URIs, show just the fragment or last path component
      if (url.hash) {
        return url.hash.slice(1); // Remove #
      }

      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length > 0) {
        return pathParts[pathParts.length - 1];
      }

      return url.host || uri;
    } catch {
      // Fallback for invalid URIs
      return uri.length > 50 ? uri.substring(0, 47) + '...' : uri;
    }
  }

  /**
   * Create a display name for vault URIs
   */
  static createVaultDisplayName(path: string): string {
    const pathParts = path.split('/').filter(Boolean);

    if (pathParts.length === 0) {
      return 'vault';
    }

    const lastPart = pathParts[pathParts.length - 1];

    // Remove .md extension for cleaner display
    if (lastPart.endsWith('.md')) {
      return lastPart.slice(0, -3);
    }

    return lastPart;
  }

  /**
   * Validate that a URI is accessible within the vault context
   */
  static validateVaultUri(
    uri: string,
    availableFiles: Set<string>
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    try {
      const url = new URL(uri);

      if (url.protocol !== 'vault:') {
        return errors; // Not a vault URI, validation not applicable
      }

      const path = url.pathname;
      if (!path) {
        errors.push(
          RdfErrorFactory.createValidationError(
            'Vault URI missing path component',
            'reference',
            undefined,
            { invalidValue: uri }
          )
        );
        return errors;
      }

      // Check if the file exists
      const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
      if (!availableFiles.has(normalizedPath)) {
        errors.push(
          RdfErrorFactory.createValidationError(
            `Referenced file not found: ${normalizedPath}`,
            'reference',
            undefined,
            { invalidValue: uri }
          )
        );
      }
    } catch (error) {
      errors.push(
        RdfErrorFactory.createValidationError(
          `Invalid vault URI format: ${error}`,
          'reference',
          undefined,
          { invalidValue: uri }
        )
      );
    }

    return errors;
  }

  /**
   * Create a base URI for a file path
   */
  static createBaseUri(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return `vault://${normalizedPath}/`;
  }

  /**
   * Create a named graph URI for a file path
   */
  static createNamedGraphUri(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return `vault://${normalizedPath}`;
  }

  /**
   * Check if two URIs are equivalent
   */
  static areEquivalent(uri1: string, uri2: string): boolean {
    try {
      const url1 = new URL(uri1);
      const url2 = new URL(uri2);
      return url1.toString() === url2.toString();
    } catch {
      // Fallback to string comparison for invalid URIs
      return uri1 === uri2;
    }
  }

  /**
   * Get the directory URI for a file URI
   */
  static getDirectoryUri(fileUri: string): string | null {
    try {
      const url = new URL(fileUri);
      if (url.protocol !== 'vault:') {
        return null;
      }

      const pathParts = url.pathname.split('/').filter(Boolean);
      if (pathParts.length <= 1) {
        return 'vault://'; // Root directory
      }

      pathParts.pop(); // Remove file name
      return `vault://${pathParts.join('/')}/`;
    } catch {
      return null;
    }
  }

  /**
   * Check if a URI represents a directory (ends with /)
   */
  static isDirectoryUri(uri: string): boolean {
    return uri.endsWith('/');
  }

  /**
   * Check if a URI is within a directory
   */
  static isWithinDirectory(fileUri: string, directoryUri: string): boolean {
    if (!UriResolver.isDirectoryUri(directoryUri)) {
      return false;
    }

    try {
      const fileUrl = new URL(fileUri);
      const dirUrl = new URL(directoryUri);

      if (fileUrl.protocol !== dirUrl.protocol) {
        return false;
      }

      return fileUrl.pathname.startsWith(dirUrl.pathname);
    } catch {
      return false;
    }
  }
}
