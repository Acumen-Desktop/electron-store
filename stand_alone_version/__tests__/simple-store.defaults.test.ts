import test from 'node:test';
import * as assert from 'node:assert/strict';
import { mockElectron, cleanupStoreFiles, ensureMockDir, mockUserDataPath } from '../test-helpers.js';

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

test('set() should correctly overwrite defaults', async (t) => {
  cleanupStoreFiles();
  ensureMockDir();
  const { default: SimpleStore } = await import('../index.js');
  const defaults = { version: 1, user: { name: 'Test' } };
  const store = new SimpleStore<{ version: number; user: { name: string }; [key: string]: any; }>({ defaults, cwd: mockUserDataPath });
  assert.strictEqual(store.get('version'), 1);
  store.set('version', 2);
  assert.strictEqual(store.get('version'), 2);
  store.set('user.name', 'Admin');
  assert.strictEqual(store.get('user.name'), 'Admin');
  cleanupStoreFiles('config.json');
});
