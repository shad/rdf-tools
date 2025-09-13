/**
 * Global test setup for vitest
 * This file is run once before all tests
 */

import { vi } from 'vitest';

// Mock Obsidian's TFile class for testing
export class MockTFile {
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

// Obsidian is mocked via vitest.config.ts alias

// Keep console.log available for debugging
// We can selectively suppress it in specific tests if needed
const originalConsole = { ...console };

// Restore console for debugging when needed
export const restoreConsole = () => {
  Object.assign(console, originalConsole);
};

// Test timeout for async operations
export const TEST_TIMEOUT = 5000;
