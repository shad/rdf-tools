/**
 * Utilities for formatting RDF literals in a user-friendly way
 */

/**
 * Result of literal formatting
 */
export interface LiteralDisplayResult {
  /** Human-readable display text */
  displayText: string;
  /** Full RDF notation for tooltip */
  fullNotation: string;
  /** CSS class for styling */
  cssClass: string;
}

/**
 * Common XSD datatype URIs
 */
const XSD_TYPES = {
  STRING: 'http://www.w3.org/2001/XMLSchema#string',
  INTEGER: 'http://www.w3.org/2001/XMLSchema#integer',
  DECIMAL: 'http://www.w3.org/2001/XMLSchema#decimal',
  DOUBLE: 'http://www.w3.org/2001/XMLSchema#double',
  FLOAT: 'http://www.w3.org/2001/XMLSchema#float',
  BOOLEAN: 'http://www.w3.org/2001/XMLSchema#boolean',
  DATE: 'http://www.w3.org/2001/XMLSchema#date',
  DATETIME: 'http://www.w3.org/2001/XMLSchema#dateTime',
  TIME: 'http://www.w3.org/2001/XMLSchema#time',
  DURATION: 'http://www.w3.org/2001/XMLSchema#duration',
  GYEAR: 'http://www.w3.org/2001/XMLSchema#gYear',
  GMONTH: 'http://www.w3.org/2001/XMLSchema#gMonth',
  GDAY: 'http://www.w3.org/2001/XMLSchema#gDay',
  GYEARMONTH: 'http://www.w3.org/2001/XMLSchema#gYearMonth',
  GMONTHDAY: 'http://www.w3.org/2001/XMLSchema#gMonthDay',
  LONG: 'http://www.w3.org/2001/XMLSchema#long',
  INT: 'http://www.w3.org/2001/XMLSchema#int',
  SHORT: 'http://www.w3.org/2001/XMLSchema#short',
  BYTE: 'http://www.w3.org/2001/XMLSchema#byte',
  UNSIGNED_LONG: 'http://www.w3.org/2001/XMLSchema#unsignedLong',
  UNSIGNED_INT: 'http://www.w3.org/2001/XMLSchema#unsignedInt',
  UNSIGNED_SHORT: 'http://www.w3.org/2001/XMLSchema#unsignedShort',
  UNSIGNED_BYTE: 'http://www.w3.org/2001/XMLSchema#unsignedByte',
  POSITIVE_INTEGER: 'http://www.w3.org/2001/XMLSchema#positiveInteger',
  NON_NEGATIVE_INTEGER: 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger',
  NEGATIVE_INTEGER: 'http://www.w3.org/2001/XMLSchema#negativeInteger',
  NON_POSITIVE_INTEGER: 'http://www.w3.org/2001/XMLSchema#nonPositiveInteger',
} as const;

/**
 * Format a literal value for display, showing a human-readable form
 * with the full RDF notation available in tooltip
 */
export function formatLiteralForDisplay(
  value: string,
  datatype?: string,
  language?: string,
  createCurie?: (uri: string) => string | null
): LiteralDisplayResult {
  // Handle language-tagged literals
  if (language) {
    const fullNotation = `"${value}"@${language}`;
    return {
      displayText: value, // Show just the text
      fullNotation,
      cssClass: 'rdf-literal-language',
    };
  }

  // Handle typed literals
  if (datatype) {
    const displayText = formatTypedLiteralValue(value, datatype);

    // Create shortened datatype notation
    let datatypeNotation = `<${datatype}>`;
    if (createCurie) {
      const curie = createCurie(datatype);
      if (curie) {
        datatypeNotation = curie;
      }
    }

    const fullNotation = `"${value}"^^${datatypeNotation}`;

    return {
      displayText,
      fullNotation,
      cssClass: `rdf-literal-typed rdf-literal-${getTypeClass(datatype)}`,
    };
  }

  // Handle plain literals (strings)
  const fullNotation = `"${value}"`;
  return {
    displayText: value,
    fullNotation,
    cssClass: 'rdf-literal-plain',
  };
}

/**
 * Format typed literal values for human-readable display
 */
function formatTypedLiteralValue(value: string, datatype: string): string {
  switch (datatype) {
    case XSD_TYPES.BOOLEAN:
      // Show boolean as simple true/false
      return value === 'true' || value === '1' ? 'true' : 'false';

    case XSD_TYPES.INTEGER:
    case XSD_TYPES.LONG:
    case XSD_TYPES.INT:
    case XSD_TYPES.SHORT:
    case XSD_TYPES.BYTE:
    case XSD_TYPES.UNSIGNED_LONG:
    case XSD_TYPES.UNSIGNED_INT:
    case XSD_TYPES.UNSIGNED_SHORT:
    case XSD_TYPES.UNSIGNED_BYTE:
    case XSD_TYPES.POSITIVE_INTEGER:
    case XSD_TYPES.NON_NEGATIVE_INTEGER:
    case XSD_TYPES.NEGATIVE_INTEGER:
    case XSD_TYPES.NON_POSITIVE_INTEGER:
      // Show integers without quotes
      return value;

    case XSD_TYPES.DECIMAL:
    case XSD_TYPES.DOUBLE:
    case XSD_TYPES.FLOAT:
      // Show numbers without quotes, potentially with formatting
      return formatNumber(value);

    case XSD_TYPES.DATE:
      // Format dates nicely
      return formatDate(value);

    case XSD_TYPES.DATETIME:
      // Format datetime nicely
      return formatDateTime(value);

    case XSD_TYPES.TIME:
      // Format time nicely
      return formatTime(value);

    case XSD_TYPES.DURATION:
      // Format duration nicely
      return formatDuration(value);

    case XSD_TYPES.GYEAR:
      // Show year as simple number
      return value;

    case XSD_TYPES.GMONTH:
      // Format month
      return formatMonth(value);

    case XSD_TYPES.GDAY:
      // Format day
      return formatDay(value);

    case XSD_TYPES.GYEARMONTH:
      // Format year-month
      return formatYearMonth(value);

    case XSD_TYPES.GMONTHDAY:
      // Format month-day
      return formatMonthDay(value);

    default:
      // For unknown types, just show the value without quotes
      return value;
  }
}

/**
 * Get CSS class suffix for different data types
 */
function getTypeClass(datatype: string): string {
  switch (datatype) {
    case XSD_TYPES.BOOLEAN:
      return 'boolean';
    case XSD_TYPES.INTEGER:
    case XSD_TYPES.LONG:
    case XSD_TYPES.INT:
    case XSD_TYPES.SHORT:
    case XSD_TYPES.BYTE:
    case XSD_TYPES.UNSIGNED_LONG:
    case XSD_TYPES.UNSIGNED_INT:
    case XSD_TYPES.UNSIGNED_SHORT:
    case XSD_TYPES.UNSIGNED_BYTE:
    case XSD_TYPES.POSITIVE_INTEGER:
    case XSD_TYPES.NON_NEGATIVE_INTEGER:
    case XSD_TYPES.NEGATIVE_INTEGER:
    case XSD_TYPES.NON_POSITIVE_INTEGER:
      return 'integer';
    case XSD_TYPES.DECIMAL:
    case XSD_TYPES.DOUBLE:
    case XSD_TYPES.FLOAT:
      return 'decimal';
    case XSD_TYPES.DATE:
    case XSD_TYPES.DATETIME:
    case XSD_TYPES.TIME:
    case XSD_TYPES.DURATION:
    case XSD_TYPES.GYEAR:
    case XSD_TYPES.GMONTH:
    case XSD_TYPES.GDAY:
    case XSD_TYPES.GYEARMONTH:
    case XSD_TYPES.GMONTHDAY:
      return 'temporal';
    default:
      return 'other';
  }
}

/**
 * Format numbers with appropriate precision
 */
function formatNumber(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;

  // Use appropriate precision for display
  if (Number.isInteger(num)) {
    return num.toString();
  } else {
    // Limit decimal places for display
    return num.toPrecision(6).replace(/\.?0+$/, '');
  }
}

/**
 * Format ISO date strings nicely
 */
function formatDate(value: string): string {
  try {
    // For date-only strings, parse carefully to avoid timezone issues
    const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString();
    }

    // Fall back to regular Date parsing for other formats
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;

    return date.toLocaleDateString();
  } catch {
    return value;
  }
}

/**
 * Format ISO datetime strings nicely
 */
function formatDateTime(value: string): string {
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;

    return date.toLocaleString();
  } catch {
    return value;
  }
}

/**
 * Format ISO time strings nicely
 */
function formatTime(value: string): string {
  try {
    // Handle time-only strings by adding a dummy date
    const timeValue = value.includes('T') ? value : `2000-01-01T${value}`;
    const date = new Date(timeValue);
    if (isNaN(date.getTime())) return value;

    return date.toLocaleTimeString();
  } catch {
    return value;
  }
}

/**
 * Format duration strings nicely
 */
function formatDuration(value: string): string {
  // Basic duration formatting - could be enhanced
  return value; // For now, just return as-is
}

/**
 * Format month values
 */
function formatMonth(value: string): string {
  const match = value.match(/--(\d{2})/);
  if (match) {
    const monthNum = parseInt(match[1], 10);
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return months[monthNum - 1] || value;
  }
  return value;
}

/**
 * Format day values
 */
function formatDay(value: string): string {
  const match = value.match(/---(\d{2})/);
  if (match) {
    return `Day ${parseInt(match[1], 10)}`;
  }
  return value;
}

/**
 * Format year-month values
 */
function formatYearMonth(value: string): string {
  try {
    const date = new Date(value + '-01');
    if (isNaN(date.getTime())) return value;

    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
    });
  } catch {
    return value;
  }
}

/**
 * Format month-day values
 */
function formatMonthDay(value: string): string {
  try {
    const date = new Date(`2000-${value.substring(2)}`);
    if (isNaN(date.getTime())) return value;

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}
