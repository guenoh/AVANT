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

  // Coverage thresholds (target 80%)
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
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
