const path = require('path');
const dotenv = require('dotenv');

const repositoryRoot = path.resolve(__dirname, '../..');
const explicitDatabaseUrl = process.env.DATABASE_URL;
dotenv.config({ path: path.join(repositoryRoot, '.env'), override: false, quiet: true });
dotenv.config({ path: path.join(repositoryRoot, '.env.test'), override: true, quiet: true });
if (explicitDatabaseUrl) {
  process.env.DATABASE_URL = explicitDatabaseUrl;
}

module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true, tsconfig: { module: 'ESNext' } }],
  },
  setupFilesAfterEnv: ['<rootDir>/src/testing/jest.setup.ts'],
  testTimeout: 30000,
  roots: ['<rootDir>/src']
};
