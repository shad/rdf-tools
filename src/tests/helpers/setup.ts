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

  constructor(path: string, options: { size?: number; mtime?: number; ctime?: number } = {}) {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.extension = this.name.includes('.')
      ? this.name.split('.').pop() || ''
      : '';
    this.basename = this.name.replace(`.${this.extension}`, '');
    this.stat = {
      mtime: options.mtime || Date.now(),
      ctime: options.ctime || Date.now(),
      size: options.size || 0,
    };
  }
}

// Mock Obsidian's TFolder class for testing
export class MockTFolder {
  vault: Vault;
  parent: TFolder;
  path: string;
  name: string;
  children: any[];

  constructor(path: string, children: any[] = []) {
    this.path = path;
    this.name = path.split('/').pop() || '';
    this.children = children;
  }

  isRoot(): boolean {
    return false; // Default to false, can be overridden if needed
  }
}

// Test timeout for async operations
export const TEST_TIMEOUT = 5000;
