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

test('should set and get a nested value using dot notation', async (t) => {
  cleanupStoreFiles();
  ensureMockDir();
  const { default: SimpleStore } = await import('../index.js');
  const store = new SimpleStore<Record<string, any>>({ cwd: mockUserDataPath });
  store.set('a.b.c', 'deep');
  assert.strictEqual(store.get('a.b.c'), 'deep');
  assert.deepStrictEqual(store.get('a.b'), { c: 'deep' });
  assert.deepStrictEqual(store.get('a'), { b: { c: 'deep' } });
  cleanupStoreFiles();
});
