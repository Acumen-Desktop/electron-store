import test from 'node:test';
import * as assert from 'node:assert/strict';
import { mockElectron, cleanupStoreFiles, ensureMockDir, mockUserDataPath } from '../test-helpers.js';
import * as fs from 'node:fs';
(globalThis as any).electron = mockElectron;

test.beforeEach(() => {
  cleanupStoreFiles();
  ensureMockDir();
  (globalThis as any).electron = mockElectron;
  mockElectron.shell.openPath = async () => '';
});

test.afterEach(() => {
  cleanupStoreFiles();
});

test('should handle corrupted store file gracefully', async (t) => {
  ensureMockDir();
  const { default: SimpleStore } = await import('../index.js');
  const corruptPath = `${mockUserDataPath}/config.json`;
  fs.writeFileSync(corruptPath, '{ this is not json }');
  assert.doesNotThrow(() => {
    const store = new SimpleStore({ cwd: mockUserDataPath });
  }, 'Should not throw on corrupted file');
});

test('should handle missing directory gracefully', async () => {
  const { default: SimpleStore } = await import('../index.js');
  cleanupStoreFiles();
  assert.doesNotThrow(() => {
    const store = new SimpleStore({ cwd: mockUserDataPath });
  }, 'Should not throw if directory is missing');
});
