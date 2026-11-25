// "unit" tests need no database. "api" tests start an in-memory MongoDB (downloaded on first run).
module.exports = {
  testTimeout: 120000,
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      setupFiles: ['<rootDir>/tests/env.js'],
    },
    {
      displayName: 'api',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/api/**/*.test.js'],
      setupFiles: ['<rootDir>/tests/env.js'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    },
  ],
};
