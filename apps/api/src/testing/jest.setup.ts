import { jest } from '@jest/globals';
import { resolve } from 'node:path';

Object.assign(globalThis, {
  jest,
  __dirname: resolve(process.cwd(), 'src/platform'),
});
