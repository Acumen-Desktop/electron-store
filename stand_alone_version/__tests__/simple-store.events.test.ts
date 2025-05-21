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

test('onDidChange should fire when a key changes', async () => {
  const { default: SimpleStore } = await import('../index.js');
  const store = new SimpleStore<{ foo?: string }>({ cwd: mockUserDataPath });
  let called = false;
  store.onDidChange('foo', (newVal, oldVal) => {
    called = true;
    assert.strictEqual(oldVal, undefined);
    assert.strictEqual(newVal, 'bar');
  });
  store.set('foo', 'bar');
  assert.ok(called, 'onDidChange should be called');
});

test('onDidAnyChange should fire when any key changes', async () => {
  const { default: SimpleStore } = await import('../index.js');
  const store = new SimpleStore<{ foo?: string }>({ cwd: mockUserDataPath });
  let called = false;
  store.onDidAnyChange((newStore, oldStore) => {
    called = true;
    assert.deepStrictEqual(oldStore, {});
    assert.deepStrictEqual(newStore, { foo: 'bar' });
  });
  store.set('foo', 'bar');
  assert.ok(called, 'onDidAnyChange should be called');
});
