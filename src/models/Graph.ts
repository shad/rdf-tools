import { Store } from 'n3';

/**
 * Simplified Graph interface with embedded store
 */
export interface Graph {
  uri: string;
  filePath: string;
  store: Store;
  lastModified: Date;
  tripleCount: number;
}
