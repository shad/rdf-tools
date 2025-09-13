import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    // Use happy-dom for DOM simulation (lighter than jsdom)
    environment: 'happy-dom',
    
    // Test file patterns
    include: ['src/**/__tests__/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', 'main.js'],
    
    // Global test setup
    globals: true,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/**/__tests__/**/*',
        'dist/',
        'main.js',
        '*.config.*',
        'src/types/errors.ts', // Large error type definitions
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    
    // Test timeout
    testTimeout: 10000,
    
    // Reporter configuration
    reporter: ['verbose'],
    
    // Setup files
    setupFiles: ['./src/tests/helpers/setup.ts'],
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Mock obsidian package since it's not a real npm package
      'obsidian': path.resolve(__dirname, './src/tests/helpers/obsidian-mock.ts'),
    },
  },
  
  // Define global constants for tests
  define: {
    __TEST__: true,
  },
});
