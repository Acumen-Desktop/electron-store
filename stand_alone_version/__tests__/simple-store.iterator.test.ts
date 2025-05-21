import test from 'node:test';
import * as assert from 'node:assert/strict';
import { mockElectron, cleanupStoreFiles, ensureMockDir, mockUserDataPath } from '../test-helpers.js';

// Set up the mock electron environment
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

test('store should be iterable with for...of loops', async () => {
  const { default: SimpleStore } = await import('../index.js');
  const store = new SimpleStore<Record<string, any>>({ cwd: mockUserDataPath });
  
  // Set some test data
  store.set('a', 1);
  store.set('b', 2);
  store.set('c', 3);
  
  // Test iteration with for...of
  const entries: [string, any][] = [];
  for (const entry of store) {
    entries.push(entry);
  }
  
  // Verify results
  assert.equal(entries.length, 3, 'Should iterate over 3 entries');
  
  // Convert entries to an object for easier comparison
  const entriesObj = Object.fromEntries(entries);
  assert.deepStrictEqual(entriesObj, { a: 1, b: 2, c: 3 }, 'Iterated entries should match the store content');
  
  // Test spread operator with iterator
  const entriesSpread = [...store];
  assert.equal(entriesSpread.length, 3, 'Should work with spread operator');
  
  // Test with nested objects
  store.clear();
  store.set('user', { name: 'Test', age: 30 });
  store.set('settings', { theme: 'dark' });
  
  const entriesWithObjects: [string, any][] = [];
  for (const entry of store) {
    entriesWithObjects.push(entry);
  }
  
  assert.equal(entriesWithObjects.length, 2, 'Should iterate over 2 entries with objects');
  
  // Only top-level keys should be iterated
  const keys = entriesWithObjects.map(([key]) => key);
  assert.deepStrictEqual(keys.sort(), ['settings', 'user'], 'Should iterate over top-level keys only');
});
