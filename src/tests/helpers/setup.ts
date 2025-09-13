/**
 * Global test setup for vitest
 * This file is run once before all tests
 */
import { TFolder, Vault } from 'obsidian';

// Mock Obsidian's TFile class for testing
export class MockTFile {
  vault: Vault;
  parent: TFolder;
  path: string;
  name: string;
  basename: string;
  extension: string;
  stat: { mtime: number; ctime: number; size: number };

  constructor(path: string) {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.extension = this.name.includes('.')
      ? this.name.split('.').pop() || ''
      : '';
    this.basename = this.name.replace(`.${this.extension}`, '');
    this.stat = {
      mtime: Date.now(),
      ctime: Date.now(),
      size: 0,
    };
  }
}

// Test timeout for async operations
export const TEST_TIMEOUT = 5000;
