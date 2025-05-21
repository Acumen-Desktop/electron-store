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

test('should set and get a value', async () => {
  const { default: SimpleStore } = await import('../index.js');
  const store = new SimpleStore<Record<string, any>>({ cwd: mockUserDataPath });
  store.set('foo', 'bar');
  assert.strictEqual(store.get('foo'), 'bar');
  cleanupStoreFiles();
});

test('should return undefined for non-existent keys', async () => {
  const { default: SimpleStore } = await import('../index.js');
  const store = new SimpleStore<Record<string, any>>({ cwd: mockUserDataPath });
  assert.strictEqual(store.get('nonExistent'), undefined);
  assert.strictEqual(store.get('non.existent.deep'), undefined);
  cleanupStoreFiles();
});

test('has() should check for existence', async () => {
  const { default: SimpleStore } = await import('../index.js');
  const store = new SimpleStore<Record<string, any>>({ cwd: mockUserDataPath, defaults: { a: 1 } });
  store.set('foo', 'bar');
  store.set('x.y', 'z');
  assert.ok(store.has('foo'));
  assert.ok(store.has('a'));
  assert.ok(store.has('x.y'));
  assert.ok(!store.has('nonExistent'));
  assert.ok(!store.has('x.z'));
  cleanupStoreFiles();
});

test('delete() should remove a key', async () => {
  const { default: SimpleStore } = await import('../index.js');
  const store = new SimpleStore<Record<string, any>>({ cwd: mockUserDataPath });
  store.set('foo', 'bar');
  store.set('a.b', 'c');
  assert.ok(store.has('foo'));
  store.delete('foo');
  assert.ok(!store.has('foo'));
  assert.ok(store.has('a.b'));
  store.delete('a.b');
  assert.ok(!store.has('a.b'));
  assert.ok(store.has('a'));
  store.delete('a');
  assert.ok(!store.has('a'));
  cleanupStoreFiles();
});
