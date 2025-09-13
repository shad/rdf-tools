/**
 * Base error categories for RDF Tools
 */
export type RdfErrorCategory =
  | 'parsing'
  | 'execution'
  | 'validation'
  | 'io'
  | 'network'
  | 'system'
  | 'user';

/**
 * Severity levels for errors and issues
 */
export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

/**
 * Base interface for all RDF Tools errors
 */
export interface RdfError {
  /** Unique error code for this type of error */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Error category */
  category: RdfErrorCategory;
  /** Severity level */
  severity: ErrorSeverity;
  /** When the error occurred */
  timestamp: Date;
  /** Additional context information */
  context?: Record<string, unknown>;
  /** The underlying cause error */
  cause?: Error;
  /** Suggested fixes or next steps */
  suggestions?: string[];
  /** Related documentation or help links */
  helpUrl?: string;
}

/**
 * Location information for errors that occur at specific positions
 */
export interface ErrorLocation {
  /** File path where error occurred */
  filePath: string;
  /** Line number (0-based) */
  line: number;
  /** Column number (0-based) */
  column: number;
  /** Length of the problematic text */
  length?: number;
  /** The problematic text snippet */
  snippet?: string;
  /** Surrounding context lines */
  contextLines?: string[];
}

/**
 * Error that occurred during turtle parsing
 */
export interface TurtleParseError extends RdfError {
  category: 'parsing';
  /** Specific type of parse error */
  parseErrorType: 'syntax' | 'semantic' | 'encoding' | 'incomplete';
  /** Location where error occurred */
  location?: ErrorLocation;
  /** Expected token or construct */
  expected?: string;
  /** Actual token or construct found */
  actual?: string;
}

/**
 * Error that occurred during SPARQL query execution
 */
export interface SparqlExecutionError extends RdfError {
  category: 'execution';
  /** Specific type of execution error */
  executionErrorType:
    | 'syntax'
    | 'semantic'
    | 'timeout'
    | 'memory'
    | 'unsupported';
  /** Location in query where error occurred */
  location?: ErrorLocation;
  /** Query that caused the error */
  query?: string;
  /** Execution context when error occurred */
  executionContext?: Record<string, unknown>;
}

/**
 * Error that occurred during graph operations
 */
export interface GraphError extends RdfError {
  category: 'system';
  /** Specific type of graph error */
  graphErrorType:
    | 'loading'
    | 'updating'
    | 'dependency'
    | 'uri_resolution'
    | 'storage';
  /** Graph URI that caused the error */
  graphUri?: string;
  /** File associated with the error */
  filePath?: string;
}

/**
 * Error that occurred during validation
 */
export interface ValidationError extends RdfError {
  category: 'validation';
  /** Type of validation that failed */
  validationType: 'schema' | 'constraint' | 'consistency' | 'reference';
  /** Location of validation failure */
  location?: ErrorLocation;
  /** The validation rule that was violated */
  rule?: string;
  /** Value that failed validation */
  invalidValue?: string;
  /** Expected value or format */
  expected?: string;
}

/**
 * Error that occurred during I/O operations
 */
export interface IoError extends RdfError {
  category: 'io';
  /** Type of I/O operation that failed */
  ioErrorType:
    | 'read'
    | 'write'
    | 'delete'
    | 'create'
    | 'permission'
    | 'not_found';
  /** Path that caused the error */
  path?: string;
  /** File system error code */
  fsErrorCode?: string;
}

/**
 * Error that occurred during network operations
 */
export interface NetworkError extends RdfError {
  category: 'network';
  /** Type of network error */
  networkErrorType: 'connection' | 'timeout' | 'dns' | 'ssl' | 'http' | 'cors';
  /** URL that caused the error */
  url?: string;
  /** HTTP status code (if applicable) */
  statusCode?: number;
  /** Network operation that failed */
  operation?: string;
}

/**
 * System-level error
 */
export interface SystemError extends RdfError {
  category: 'system';
  /** Type of system error */
  systemErrorType:
    | 'memory'
    | 'cpu'
    | 'disk'
    | 'permission'
    | 'configuration'
    | 'dependency';
  /** System resource involved */
  resource?: string;
  /** Current resource usage */
  usage?: Record<string, number>;
  /** Resource limits */
  limits?: Record<string, number>;
}

/**
 * User input or configuration error
 */
export interface UserError extends RdfError {
  category: 'user';
  /** Type of user error */
  userErrorType:
    | 'invalid_input'
    | 'missing_config'
    | 'permission_denied'
    | 'unsupported_operation';
  /** The invalid input or configuration */
  userInput?: string;
  /** Valid alternatives or examples */
  validAlternatives?: string[];
}

/**
 * Union type for all specific error types
 */
export type SpecificRdfError =
  | TurtleParseError
  | SparqlExecutionError
  | GraphError
  | ValidationError
  | IoError
  | NetworkError
  | SystemError
  | UserError;

/**
 * Result type that can contain either a value or an error
 */
export type Result<T, E extends RdfError = RdfError> =
  | { success: true; data: T; errors?: never }
  | { success: false; data?: never; errors: E[] };

/**
 * Result type specifically for operations that might have warnings
 */
export type ResultWithWarnings<T, E extends RdfError = RdfError> = {
  success: boolean;
  data?: T;
  errors: E[];
  warnings: E[];
};

/**
 * Validation result with detailed error information
 */
export type ValidationResult<T = unknown> = {
  valid: boolean;
  value?: T;
  errors: ValidationError[];
  warnings: ValidationError[];
};

/**
 * Factory functions for creating specific error types
 */
export class RdfErrorFactory {
  /**
   * Create a turtle parse error
   */
  static createTurtleParseError(
    message: string,
    parseErrorType: TurtleParseError['parseErrorType'],
    location?: ErrorLocation,
    options?: Partial<TurtleParseError>
  ): TurtleParseError {
    return {
      code: `TURTLE_PARSE_${parseErrorType.toUpperCase()}`,
      message,
      category: 'parsing',
      parseErrorType,
      location,
      severity: parseErrorType === 'syntax' ? 'error' : 'warning',
      timestamp: new Date(),
      ...options,
    };
  }

  /**
   * Create a SPARQL execution error
   */
  static createSparqlExecutionError(
    message: string,
    executionErrorType: SparqlExecutionError['executionErrorType'],
    query?: string,
    options?: Partial<SparqlExecutionError>
  ): SparqlExecutionError {
    return {
      code: `SPARQL_${executionErrorType.toUpperCase()}`,
      message,
      category: 'execution',
      executionErrorType,
      query,
      severity: executionErrorType === 'syntax' ? 'error' : 'warning',
      timestamp: new Date(),
      ...options,
    };
  }

  /**
   * Create a graph error
   */
  static createGraphError(
    message: string,
    graphErrorType: GraphError['graphErrorType'],
    graphUri?: string,
    options?: Partial<GraphError>
  ): GraphError {
    return {
      code: `GRAPH_${graphErrorType.toUpperCase()}`,
      message,
      category: 'system',
      graphErrorType,
      graphUri,
      severity: 'error',
      timestamp: new Date(),
      ...options,
    };
  }

  /**
   * Create a validation error
   */
  static createValidationError(
    message: string,
    validationType: ValidationError['validationType'],
    location?: ErrorLocation,
    options?: Partial<ValidationError>
  ): ValidationError {
    return {
      code: `VALIDATION_${validationType.toUpperCase()}`,
      message,
      category: 'validation',
      validationType,
      location,
      severity: 'error',
      timestamp: new Date(),
      ...options,
    };
  }

  /**
   * Create an I/O error
   */
  static createIoError(
    message: string,
    ioErrorType: IoError['ioErrorType'],
    path?: string,
    options?: Partial<IoError>
  ): IoError {
    return {
      code: `IO_${ioErrorType.toUpperCase()}`,
      message,
      category: 'io',
      ioErrorType,
      path,
      severity: 'error',
      timestamp: new Date(),
      ...options,
    };
  }

  /**
   * Create a user error
   */
  static createUserError(
    message: string,
    userErrorType: UserError['userErrorType'],
    userInput?: string,
    options?: Partial<UserError>
  ): UserError {
    return {
      code: `USER_${userErrorType.toUpperCase()}`,
      message,
      category: 'user',
      userErrorType,
      userInput,
      severity: 'error',
      timestamp: new Date(),
      ...options,
    };
  }

  /**
   * Wrap a native JavaScript error
   */
  static wrapNativeError(
    error: Error,
    category: RdfErrorCategory = 'system',
    context?: Record<string, unknown>
  ): RdfError {
    return {
      code: `NATIVE_${error.name.toUpperCase()}`,
      message: error.message,
      category,
      severity: 'error',
      timestamp: new Date(),
      cause: error,
      context,
    };
  }
}

/**
 * Utility functions for working with errors
 */
export class RdfErrorUtils {
  /**
   * Check if a result is successful
   */
  static isSuccess<T, E extends RdfError>(
    result: Result<T, E>
  ): result is { success: true; data: T } {
    return result.success;
  }

  /**
   * Check if a result is a failure
   */
  static isFailure<T, E extends RdfError>(
    result: Result<T, E>
  ): result is { success: false; errors: E[] } {
    return !result.success;
  }

  /**
   * Create a successful result
   */
  static success<T>(data: T): Result<T, never> {
    return { success: true, data };
  }

  /**
   * Create a failed result
   */
  static failure<E extends RdfError>(errors: E[]): Result<never, E> {
    return { success: false, errors };
  }

  /**
   * Create a single error failure
   */
  static error<E extends RdfError>(error: E): Result<never, E> {
    return RdfErrorUtils.failure([error]);
  }

  /**
   * Filter errors by severity
   */
  static filterBySeverity(
    errors: RdfError[],
    severity: ErrorSeverity
  ): RdfError[] {
    return errors.filter(error => error.severity === severity);
  }

  /**
   * Get the most severe error from a list
   */
  static getMostSevere(errors: RdfError[]): RdfError | undefined {
    if (errors.length === 0) return undefined;

    const severityOrder: ErrorSeverity[] = [
      'fatal',
      'error',
      'warning',
      'info',
    ];

    for (const severity of severityOrder) {
      const found = errors.find(error => error.severity === severity);
      if (found) return found;
    }

    return errors[0];
  }

  /**
   * Group errors by category
   */
  static groupByCategory(
    errors: RdfError[]
  ): Record<RdfErrorCategory, RdfError[]> {
    const groups: Record<RdfErrorCategory, RdfError[]> = {
      parsing: [],
      execution: [],
      validation: [],
      io: [],
      network: [],
      system: [],
      user: [],
    };

    errors.forEach(error => {
      groups[error.category].push(error);
    });

    return groups;
  }

  /**
   * Format error for display
   */
  static formatError(error: RdfError): string {
    let formatted = `[${error.code}] ${error.message}`;

    if ('location' in error && error.location) {
      const loc = error.location as ErrorLocation;
      formatted += ` (at ${loc.filePath}:${loc.line + 1}:${loc.column + 1})`;
    }

    if (error.suggestions && error.suggestions.length > 0) {
      formatted += `\nSuggestions: ${error.suggestions.join(', ')}`;
    }

    return formatted;
  }

  /**
   * Convert error to JSON for serialization
   */
  static toJSON(error: RdfError): Record<string, unknown> {
    return {
      code: error.code,
      message: error.message,
      category: error.category,
      severity: error.severity,
      timestamp: error.timestamp.toISOString(),
      context: error.context,
      suggestions: error.suggestions,
      helpUrl: error.helpUrl,
      // Include specific error type fields
      ...('parseErrorType' in error
        ? { parseErrorType: (error as TurtleParseError).parseErrorType }
        : {}),
      ...('executionErrorType' in error
        ? {
            executionErrorType: (error as SparqlExecutionError)
              .executionErrorType,
          }
        : {}),
      ...('graphErrorType' in error
        ? { graphErrorType: (error as GraphError).graphErrorType }
        : {}),
      ...('validationType' in error
        ? { validationType: (error as ValidationError).validationType }
        : {}),
      ...('location' in error && error.location
        ? { location: error.location }
        : {}),
    };
  }

  /**
   * Create error summary for reporting
   */
  static createSummary(errors: RdfError[]): {
    total: number;
    byCategory: Record<RdfErrorCategory, number>;
    bySeverity: Record<ErrorSeverity, number>;
    mostCommonCodes: Array<{ code: string; count: number }>;
  } {
    const byCategory: Record<RdfErrorCategory, number> = {
      parsing: 0,
      execution: 0,
      validation: 0,
      io: 0,
      network: 0,
      system: 0,
      user: 0,
    };
    const bySeverity: Record<ErrorSeverity, number> = {
      fatal: 0,
      error: 0,
      warning: 0,
      info: 0,
    };
    const codeCounts: Record<string, number> = {};

    errors.forEach(error => {
      byCategory[error.category]++;
      bySeverity[error.severity]++;
      codeCounts[error.code] = (codeCounts[error.code] || 0) + 1;
    });

    const mostCommonCodes = Object.entries(codeCounts)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total: errors.length,
      byCategory,
      bySeverity,
      mostCommonCodes,
    };
  }
}
