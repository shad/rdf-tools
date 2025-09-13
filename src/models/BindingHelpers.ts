import { Term, Variable } from 'n3';

/**
 * Binding result in the format expected by our UI
 */
export interface ProcessedBinding {
  type: string;
  value: string;
  datatype?: string;
  language?: string;
}

/**
 * Interface for Comunica binding entries (Immutable.js Map)
 */
interface ComunicaBindingEntries {
  readonly size: number;
  entrySeq(): Iterable<[Variable, Term]>;
}

/**
 * Interface for binding objects from Comunica
 */
interface ComunicaBinding {
  entries: ComunicaBindingEntries | Map<string, Term> | Record<string, Term>;
}

/**
 * Helper functions for processing SPARQL query bindings from Comunica
 */
export class BindingHelpers {
  /**
   * Convert a Comunica binding object to our processed binding format
   */
  static processBinding(binding: unknown): Record<string, ProcessedBinding> {
    const bindingObj: Record<string, ProcessedBinding> = {};
    const comunicaBinding = binding as ComunicaBinding;

    if (!comunicaBinding?.entries) {
      return bindingObj;
    }

    // Handle Immutable.js Map (used by Comunica)
    if (this.isComunicaBindingEntries(comunicaBinding.entries)) {
      for (const [variable, term] of comunicaBinding.entries.entrySeq()) {
        const varName = variable.value || variable.toString();
        bindingObj[varName] = this.formatTerm(term);
      }
    } else if (comunicaBinding.entries instanceof Map) {
      // Standard JavaScript Map
      for (const [variable, term] of comunicaBinding.entries.entries()) {
        bindingObj[variable] = this.formatTerm(term);
      }
    } else if (typeof comunicaBinding.entries === 'object') {
      // Plain object fallback
      for (const [varName, term] of Object.entries(comunicaBinding.entries)) {
        if (term && typeof term === 'object' && 'value' in term) {
          bindingObj[varName] = this.formatTerm(term);
        }
      }
    }

    return bindingObj;
  }

  /**
   * Type guard for Comunica binding entries
   */
  private static isComunicaBindingEntries(
    entries: ComunicaBindingEntries | Map<string, Term> | Record<string, Term>
  ): entries is ComunicaBindingEntries {
    return (
      typeof entries === 'object' &&
      'size' in entries &&
      'entrySeq' in entries &&
      typeof entries.entrySeq === 'function'
    );
  }

  /**
   * Format an N3.js Term for our binding result format
   */
  private static formatTerm(term: Term): ProcessedBinding {
    return {
      type: this.getTermType(term),
      value: term.value,
      datatype: 'datatype' in term ? term.datatype?.value : undefined,
      language: 'language' in term ? term.language : undefined,
    };
  }

  /**
   * Get term type for binding results using N3.js term types
   */
  private static getTermType(term: Term): string {
    switch (term.termType) {
      case 'NamedNode':
        return 'uri';
      case 'BlankNode':
        return 'bnode';
      case 'Literal':
        return 'literal';
      default:
        return 'unknown';
    }
  }
}
