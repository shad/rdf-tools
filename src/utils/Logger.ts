import { RdfToolsSettings } from '../models/RdfToolsSettings';

/**
 * Centralized logging utility that respects plugin settings
 */
export class Logger {
  private enableDebugLogging: boolean;
  private readonly prefix = 'RDF Tools:';

  constructor(settings: RdfToolsSettings) {
    this.enableDebugLogging = settings.enableDebugLogging;
  }

  /**
   * Create a logger instance from settings
   */
  static create(settings: RdfToolsSettings): Logger {
    return new Logger(settings);
  }

  /**
   * Update logger settings (useful when settings change)
   * @public - Available for future use when settings change dynamically
   */
  updateSettings(settings: RdfToolsSettings): void {
    this.enableDebugLogging = settings.enableDebugLogging;
  }

  /**
   * Log info message (only when debug logging enabled)
   */
  info(message: string, ...args: unknown[]): void {
    if (this.enableDebugLogging) {
      console.log(`${this.prefix} ${message}`, ...args);
    }
  }

  /**
   * Log debug message (only when debug logging enabled)
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.enableDebugLogging) {
      console.debug(`${this.prefix} ${message}`, ...args);
    }
  }

  /**
   * Log warning message (only when debug logging enabled)
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.enableDebugLogging) {
      console.warn(`${this.prefix} ${message}`, ...args);
    }
  }

  /**
   * Log error message (always logged, regardless of debug setting)
   */
  error(message: string, ...args: unknown[]): void {
    console.error(`${this.prefix} ${message}`, ...args);
  }
}

/**
 * Null logger implementation for cases where logging is not needed
 * Extends Logger to ensure compatibility
 */
export class NullLogger extends Logger {
  constructor() {
    // Create a fake settings object to satisfy the Logger constructor
    super({ enableDebugLogging: false } as RdfToolsSettings);
  }

  /**
   * Override all methods to do nothing
   */
  updateSettings(): void {
    // No-op
  }

  info(): void {
    // No-op
  }

  debug(): void {
    // No-op
  }

  warn(): void {
    // No-op
  }

  error(): void {
    // No-op - even errors are silenced in null logger
  }

  /**
   * Create a null logger instance
   */
  static create(): NullLogger {
    return new NullLogger();
  }
}
