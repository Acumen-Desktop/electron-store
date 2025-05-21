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

test('clear() should remove all keys', async () => {
  const { default: SimpleStore } = await import('../index.js');
  const store = new SimpleStore<{ foo?: string; bar?: number }>({ cwd: mockUserDataPath });
  store.set('foo', 'bar');
  store.set('bar', 42);
  store.clear();
  assert.strictEqual(store.get('foo'), undefined);
  assert.strictEqual(store.get('bar'), undefined);
});
