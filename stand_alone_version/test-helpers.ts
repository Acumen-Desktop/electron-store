// test-helpers.ts
// Contains Electron mocks and file cleanup helpers for tests.
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export const mockUserDataPath = path.join(os.tmpdir(), 'simple-store-tests');

// Save original process.type for restoration
const originalProcessType = (process as any).type;

export function setProcessType(type: 'main' | 'renderer') {
  (process as any).type = type;
}

export function restoreProcessType() {
  (process as any).type = originalProcessType;
}

export const mockElectron = {
  app: {
    getPath: (name: string): string => {
      if (name === 'userData') return mockUserDataPath;
      if (name === 'appData') return path.join(os.tmpdir(), 'appData');
      if (name === 'desktop') return path.join(os.homedir(), 'Desktop');
      return path.join(mockUserDataPath, name);
    },
    isReady: () => true,
  },
  ipcMain: {
    handle: (_channel: string, _listener: (event: any, ...args: any[]) => any): void => {},
    removeHandler: (_channel: string): void => {},
  },
  ipcRenderer: {
    invoke: async (channel: string, ...args: any[]): Promise<any> => {
      if (channel === '__SIMPLE_STORE_IPC_CHANNEL_RENDERER_TO_MAIN__') {
        const [pathName] = args;
        return mockElectron.app.getPath(pathName as string);
      }
      if (channel === 'simple-store-get-data') {
        return { defaultCwd: mockUserDataPath };
      }
      return Promise.resolve();
    },
    sendSync: (channel: string, ..._args: any[]): any => {
      if (channel === 'simple-store-get-user-data-path-sync') {
        return mockUserDataPath;
      }
      return undefined;
    },
  },
  shell: {
    openPath: async (_filePath: string): Promise<string> => Promise.resolve(''),
  },
};

export function cleanupStoreFiles(storeName = 'config.json') {
  // Recursively remove all files and subdirectories in the mock directory
  function removeAll(dir: string) {
    if (!fs.existsSync(dir)) return;
    try {
      for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      try {
        const stat = fs.lstatSync(fullPath);
        if (stat.isDirectory()) {
          removeAll(fullPath);
          fs.rmdirSync(fullPath);
        } else {
          try {
  fs.unlinkSync(fullPath);
} catch (err: any) {
  if (err.code !== 'ENOENT') {
    console.warn('[cleanupStoreFiles] Failed to unlink', fullPath, err);
  }
}
        }
      } catch (err) {
        console.warn('[cleanupStoreFiles] Failed to remove', fullPath, err);
      }
    }
    } catch (err) {
      // Directory might have been deleted during iteration
      if (err.code !== 'ENOENT') throw err;
    }
  }
  if (fs.existsSync(mockUserDataPath)) {
    removeAll(mockUserDataPath);
    try {
      fs.rmdirSync(mockUserDataPath);
    } catch (err) {
      // If still not empty, log remaining files
      if (fs.existsSync(mockUserDataPath)) {
        const remaining = fs.readdirSync(mockUserDataPath);
        console.warn('[cleanupStoreFiles] Directory not empty after cleanup:', mockUserDataPath, remaining);
      }
    }
  }
}

export function ensureMockDir() {
  if (!fs.existsSync(mockUserDataPath)) {
    fs.mkdirSync(mockUserDataPath, { recursive: true });
  }
}
