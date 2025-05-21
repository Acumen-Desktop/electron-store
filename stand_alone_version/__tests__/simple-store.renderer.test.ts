import test from 'node:test';
import * as assert from 'node:assert/strict';
import { mockElectron, cleanupStoreFiles, ensureMockDir, mockUserDataPath } from '../test-helpers.js';

// Temporary event storage for mocking IPC
let ipcEventHandlers: Record<string, (event: any, ...args: any[]) => void> = {};
let appData = { defaultCwd: mockUserDataPath, appVersion: '1.0.0' };

// Mock versions of ipcMain and ipcRenderer
const mockIpcMain = {
  on: (channel: string, handler: (event: any, ...args: any[]) => void) => {
    ipcEventHandlers[channel] = handler;
    return mockIpcMain;
  },
  removeAllListeners: (channel: string) => {
    delete ipcEventHandlers[channel];
    return mockIpcMain;
  }
};

const mockIpcRenderer = {
  sendSync: (channel: string, ...args: any[]) => {
    if (ipcEventHandlers[channel]) {
      const event = { returnValue: undefined };
      ipcEventHandlers[channel](event, ...args);
      return event.returnValue;
    }
    return undefined;
  }
};

// Extended mock electron object with IPC support
const extendedMockElectron = {
  ...mockElectron,
  app: {
    ...mockElectron.app,
    getVersion: () => '1.0.0',
  },
  ipcMain: mockIpcMain,
  ipcRenderer: mockIpcRenderer
};

// Process type mock
const originalProcessType = process.type;
Object.defineProperty(process, 'type', {
  configurable: true,
  get: function() { return 'renderer'; }
});

// Reset mocks after tests
test.afterEach(() => {
  cleanupStoreFiles();
  ipcEventHandlers = {};
});

test.after(() => {
  // Reset process.type if needed
  if (originalProcessType) {
    Object.defineProperty(process, 'type', {
      configurable: true,
      get: function() { return originalProcessType; }
    });
  } else {
    delete (process as any).type;
  }
});

test('initRenderer should set up IPC handler', async () => {
  // Replace global electron mock with our extended version
  (globalThis as any).electron = extendedMockElectron;
  
  const { default: SimpleStore } = await import('../index.js');
  
  // Initialize renderer support
  const result = SimpleStore.initRenderer();
  
  // Check if IPC handler was registered
  assert.ok(ipcEventHandlers['simple-store-get-data'], 'IPC handler should be registered');
  assert.deepStrictEqual(result, appData, 'Should return app data');
  
  // Calling again should not register a duplicate handler
  const secondResult = SimpleStore.initRenderer();
  assert.deepStrictEqual(secondResult, appData, 'Should return app data on second call');
  
  // Clean up
  SimpleStore.cleanupMain();
  assert.equal(ipcEventHandlers['simple-store-get-data'], undefined, 'IPC handler should be removed');
});

test('Constructor should use renderer IPC in renderer process', async () => {
  // Replace global electron mock with our extended version
  (globalThis as any).electron = extendedMockElectron;
  
  const { default: SimpleStore } = await import('../index.js');
  
  // Initialize renderer support
  SimpleStore.initRenderer();
  
  try {
    // Create a store instance
    const store = new SimpleStore();
    assert.ok(store, 'Should create store in renderer process');
    
    // Test with version from IPC
    assert.ok(store.projectVersion, 'Should get project version from IPC');
    assert.equal(store.projectVersion, '1.0.0', 'Should get correct version');
  } finally {
    // Clean up
    SimpleStore.cleanupMain();
  }
});

test('Constructor should throw if SimpleStore not initialized in renderer', async () => {
  // Replace global electron mock with minimal version that will cause the error
  (globalThis as any).electron = {
    ...extendedMockElectron,
    // Remove the app property to force failure
    app: undefined,
    // Make sure ipcRenderer exists but sendSync throws an error
    ipcRenderer: {
      sendSync: () => {
        throw new Error('Could not get app data from main process');
      }
    }
  };
  
  // Remove handlers to simulate uninitialized state
  ipcEventHandlers = {};
  
  const { default: SimpleStore } = await import('../index.js');
  
  assert.throws(() => {
    new SimpleStore();
  }, /Could not get app data from main process/);
});
