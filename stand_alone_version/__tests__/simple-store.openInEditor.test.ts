import test from 'node:test';
import * as assert from 'node:assert/strict';
import { mockElectron, cleanupStoreFiles, ensureMockDir, mockUserDataPath } from '../test-helpers.js';

// Set up a correct mock with the shape the implementation expects
const mockShell = {
  openPath: async (path: string) => {
    return ''; // Empty string indicates success
  }
};

// Set up the mock electron environment
(globalThis as any).electron = {
  ...mockElectron,
  shell: mockShell
};

test.beforeEach(() => {
  cleanupStoreFiles();
  ensureMockDir();
  (globalThis as any).electron = mockElectron;
});

test.afterEach(() => {
  cleanupStoreFiles();
});

test('openInEditor should open the file using shell.openPath', async () => {
  // Keep track of whether openPath was called
  let openPathCalled = false;
  let pathPassedToOpenPath = '';
  
  // Override the mock with our test version
  (globalThis as any).electron.shell.openPath = async (path: string) => {
    openPathCalled = true;
    pathPassedToOpenPath = path;
    return ''; // Success
  };
  
  // Ensure the mock is properly set up before importing the module
  const { default: SimpleStore } = await import('../index.js');
  const store = new SimpleStore<Record<string, any>>({ cwd: mockUserDataPath });
  
  // Set some data to ensure the file exists
  store.set('testKey', 'testValue');
  
  // Call the method we're testing
  await store.openInEditor();
  
  // Verify that the openPath method was called
  assert.ok(openPathCalled, 'shell.openPath should be called');
  assert.ok(pathPassedToOpenPath.includes('config.json'), 'Path should include config.json');
  
  // Test error handling by making openPath return an error
  (globalThis as any).electron.shell.openPath = async () => {
    return 'Some error occurred';
  };
  
  try {
    await store.openInEditor();
    assert.fail('openInEditor should throw when shell.openPath returns an error');
  } catch (error: any) {
    assert.ok(error.message.includes('Failed to open store file'), 'Error message should include the shell error');
  }
});
