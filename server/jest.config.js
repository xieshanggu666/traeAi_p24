module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  collectCoverageFrom: [
    'routes/bottle.js',
    'utils/bottleLogger.js',
    'utils/bottleScheduler.js'
  ],
  coverageReporters: ['text', 'lcov', 'clover'],
  testTimeout: 30000
};
