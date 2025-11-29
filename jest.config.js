/**
 * Jest Configuration for Vision Auto v2
 */

module.exports = {
  // Test environment
  testEnvironment: 'jsdom',

  // Test match patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.test.js'
  ],

  // Coverage collection
  collectCoverageFrom: [
    'src/renderer/stores/**/*.js',
    'src/renderer/components/**/*.js',
    'src/renderer/services/**/*.js',
    '!**/node_modules/**',
    '!**/*.test.js'
  ],

  // Coverage thresholds (per-file for tested modules)
  coverageThreshold: {
    // Core stores with full coverage
    './src/renderer/stores/ActionStore.js': {
      branches: 80,
      functions: 100,
      lines: 100,
      statements: 100
    },
    './src/renderer/stores/MacroStore.js': {
      branches: 80,
      functions: 100,
      lines: 100,
      statements: 100
    },
    // Core services with full coverage
    './src/renderer/services/EventBus.js': {
      branches: 90,
      functions: 100,
      lines: 100,
      statements: 100
    },
    './src/renderer/services/LoggerService.js': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module paths
  roots: ['<rootDir>/src', '<rootDir>/tests'],

  // Transform files
  transform: {},

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/'],

  // Verbose output
  verbose: true,

  // Coverage directory
  coverageDirectory: 'coverage',

  // Coverage reporters
  coverageReporters: ['text', 'lcov', 'html']
};
