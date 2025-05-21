import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';
import type { StoreData, SimpleStoreOptions, OnDidChangeCallback, OnDidAnyChangeCallback, Unsubscribe } from './types_store.js';
import { atomicWriteFileSync, getProperty, setProperty, hasProperty, deleteProperty, isDeepStrictEqual } from './utils.js';

// Minimal Electron detection for production
let app: Electron.App | undefined;
let ipcMain: Electron.IpcMain | undefined;
let ipcRenderer: Electron.IpcRenderer | undefined;

try {
  // Support both ESM and CJS
  const electron = (require('electron')?.default || require('electron')) as typeof import('electron');
  app = electron.app;
  ipcMain = electron.ipcMain;
  ipcRenderer = electron.ipcRenderer;
} catch {
  app = undefined;
  ipcMain = undefined;
  ipcRenderer = undefined;
}

// Track initialization state
let isInitialized = false;

// Helper to determine if running in renderer or main process
const isRenderer = (): boolean => {
  try {
    // For test environments, check if process.type is explicitly set
    if (process && typeof process === 'object' && 'type' in process) {
      return process.type === 'renderer';
    }
    
    // Backup detection for real Electron environments
    return (
      typeof process !== 'undefined' &&
      typeof process === 'object' &&
      typeof (process as any).versions === 'object' &&
      !!(process as any).versions.electron &&
      typeof window !== 'undefined' &&
      (process as any).type === 'renderer'
    );
  } catch {
    return false;
  }
};

/**
 * Simple class for managing user-specific application data, similar to electron-store.
 * Handles data persistence in a JSON file and provides methods for data manipulation and observation.
 */
/**
 * A simple, dependency-free store for Electron applications
 * @template T The type of data stored in the store
 */
export default class SimpleStore<T extends StoreData = Record<string, any>> implements Iterable<[string, any]> {
  /**
   * Sets up the IPC communication between the main and renderer processes.
   * Call this method from the main process before using SimpleStore in a renderer process.
   * 
   * @example
   * ```typescript
   * // In your main process file
   * import SimpleStore from './simple-store';
   * SimpleStore.initRenderer();
   * ```
   * 
   * @returns An object containing the app data path and version for debugging/information.
   */
  static initRenderer(): { defaultCwd: string; appVersion: string } {
    // Check for test environment
    const isTestEnv = typeof (globalThis as any).electron !== 'undefined' && 
                      typeof (globalThis as any).electron.ipcMain !== 'undefined';
    
    // Use either real Electron or mocked Electron
    const actualIpcMain = isTestEnv ? (globalThis as any).electron.ipcMain : ipcMain;
    const actualApp = isTestEnv ? (globalThis as any).electron.app : app;
    
    if (!actualIpcMain || !actualApp) {
      throw new Error('SimpleStore: Cannot initialize renderer support. This method must be called from the main process.');
    }
    
    const appData = {
      defaultCwd: actualApp.getPath('userData'),
      appVersion: actualApp.getVersion ? actualApp.getVersion() : '1.0.0'
    };
    
    // Only set up the event handler once
    if (isInitialized) {
      return appData;
    }
    
    // Set up IPC handler for renderer process requests
    actualIpcMain.on('simple-store-get-data', (event: any) => {
      event.returnValue = appData;
    });
    
    isInitialized = true;
    return appData;
  }
  
  /**
   * Removes the IPC event listeners set up by initRenderer.
   * Call this when you're done with SimpleStore instances in renderer processes.
   */
  static cleanupMain(): void {
    // Check for test environment
    const isTestEnv = typeof (globalThis as any).electron !== 'undefined' && 
                      typeof (globalThis as any).electron.ipcMain !== 'undefined';
    
    // Use either real Electron or mocked Electron
    const actualIpcMain = isTestEnv ? (globalThis as any).electron.ipcMain : ipcMain;
    
    if (actualIpcMain) {
      actualIpcMain.removeAllListeners('simple-store-get-data');
      isInitialized = false;
    }
  }
  readonly path: string;
  protected readonly options: SimpleStoreOptions<T>;
  private readonly onDidChangeListeners = new Map<string, Array<OnDidChangeCallback<any>>>();
  private readonly onDidAnyChangeListeners: Array<OnDidAnyChangeCallback<T>> = [];
  private _store: T = {} as T; // Add internal store property

  constructor(options: SimpleStoreOptions<T> = {}) {
    this.options = { ...options };
    const projectName = this.options.name || 'config';
    
    // Handle path resolution differently based on process type
    let baseDir: string;
    let appVersion: string | undefined;
    
    // If in renderer process, get data from main process via IPC
    if (isRenderer()) {
      // In test environment, check global mock first
      const mockIpcRenderer = (globalThis as any).electron?.ipcRenderer;
      const actualIpcRenderer = mockIpcRenderer || ipcRenderer;
      
      if (!actualIpcRenderer) {
        throw new Error('SimpleStore: electron.ipcRenderer is not available. Make sure you are running in an Electron environment.');
      }
      
      try {
        // Request data from main process
        const appData = actualIpcRenderer.sendSync('simple-store-get-data');
        
        if (!appData) {
          throw new Error(
            'SimpleStore: Could not get app data from main process. ' +
            'Make sure to call SimpleStore.initRenderer() in the main process before using SimpleStore in a renderer process.'
          );
        }
        
        // Use data from main process
        baseDir = appData.defaultCwd;
        appVersion = appData.appVersion;
      } catch (error) {
        // In test environment, we may not have actual IPC setup
        if ((globalThis as any).electron?.app?.getPath) {
          baseDir = (globalThis as any).electron.app.getPath('userData');
          appVersion = (globalThis as any).electron.app.getVersion?.() || '1.0.0';
        } else {
          throw error;
        }
      }
    } else {
      // In main process, use app directly if available
      baseDir = app?.getPath('userData') || path.join(homedir(), `.${projectName}`);
    }
    
    // Override baseDir if cwd option is provided
    if (options.cwd) {
      baseDir = path.isAbsolute(options.cwd) ? options.cwd : path.join(baseDir, options.cwd);
    }
    
    // Save project version if provided or use app version
    if (!this.options.projectVersion && appVersion) {
      this.options.projectVersion = appVersion;
    }
    
    // Set file path
    this.path = path.resolve(baseDir, `${projectName}.json`);
    
    // Initialize the store by merging defaults with disk data
    this.initializeStore();
  }
  
  /**
   * Get the project version defined in options or determined from the app
   */
  get projectVersion(): string | undefined {
    return this.options.projectVersion;
  }
  
  /**
   * Initialize the store by reading from disk and applying defaults
   * This ensures the store starts with the correct initial state
   */
  private initializeStore(): void {
    // Read from disk first
    let diskData: T;
    let fileExists = false;
    
    try {
      // Check if store file exists
      if (fs.existsSync(this.path)) {
        fileExists = true;
        const fileContent = fs.readFileSync(this.path, 'utf8');
        diskData = JSON.parse(fileContent) as T;
      } else {
        diskData = {} as T;
      }
    } catch (error) {
      // File is corrupted or unreadable
      diskData = {} as T;
    }
    
    // If we have defaults, merge them with the disk data
    if (this.options.defaults && Object.keys(this.options.defaults).length > 0) {
      // Start with defaults
      const mergedData = JSON.parse(JSON.stringify(this.options.defaults)) as T;
      
      // Override with disk data if it exists
      if (fileExists && diskData && typeof diskData === 'object') {
        for (const key in diskData) {
          if (Object.prototype.hasOwnProperty.call(diskData, key)) {
            (mergedData as any)[key] = diskData[key];
          }
        }
      }
      
      // Write the merged data to disk
      try {
        fs.mkdirSync(path.dirname(this.path), { recursive: true });
        atomicWriteFileSync(this.path, JSON.stringify(mergedData, null, '\t'));
      } catch (error) {
        // Handle error silently
      }
      
      // Use the merged data as our initial store
      this._store = mergedData;
    } else if (fileExists) {
      // No defaults, but file exists - use the disk data
      this._store = diskData;
    } else {
      // No defaults and no file - start with empty object
      this._store = {} as T;
      try {
        fs.mkdirSync(path.dirname(this.path), { recursive: true });
        atomicWriteFileSync(this.path, JSON.stringify({}, null, '\t'));
      } catch {}
    }
  }

  get store(): T {
    try {
      const fileContent = fs.readFileSync(this.path, 'utf8');
      const parsed = JSON.parse(fileContent) as T;
      this._store = parsed; // Update internal store with disk contents

      console.log('[SimpleStore:store getter] Read from disk:', JSON.stringify(parsed));
      return this._store;
    } catch (error: any) {
      // File not found or corrupted: fallback to defaults or empty
      const initial = (this.options.defaults ? { ...this.options.defaults } : {}) as T;
      try {
        fs.mkdirSync(path.dirname(this.path), { recursive: true });
        atomicWriteFileSync(this.path, JSON.stringify(initial, null, '\t'));
        console.log('[SimpleStore:store getter] File missing/corrupt. Wrote defaults:', JSON.stringify(initial));
      } catch {}
      this._store = initial; // Update internal store with defaults
      return this._store;
    }
  }
  set store(value: T) {
    console.log('[SimpleStore:store setter] Writing to disk:', JSON.stringify(value));
    try {
      fs.mkdirSync(path.dirname(this.path), { recursive: true });
      atomicWriteFileSync(this.path, JSON.stringify(value, null, '\t'));
      // Update internal store after successful write
      this._store = value;
    } catch (e) {
      // console.log('[SimpleStore:set] Error writing to', this.path, e);
    }
  }

  // --- Store manipulation methods ---
  get<Key extends keyof T>(key: Key): T[Key] | undefined;
  get<Key extends keyof T>(key: Key, defaultValue: Required<T>[Key]): Required<T>[Key];
  get<Key extends keyof T>(key: Key, defaultValue?: T[Key]): T[Key] | undefined {
    console.log('[SimpleStore:get] Store before get:', JSON.stringify(this._store));
    
    // For best performance, first check the in-memory cache
    if (Object.keys(this._store).length > 0) {
      const valueFromCache = getProperty(this._store, key as string, undefined);
      
      // If the value exists in cache, return it
      if (valueFromCache !== undefined) {
        return valueFromCache;
      }
    }
    
    // If not in cache or cache is empty, read from disk
    try {
      const fileContent = fs.readFileSync(this.path, 'utf8');
      const fromDisk = JSON.parse(fileContent) as T;
      
      // Update the cache with the latest from disk
      this._store = fromDisk;
      
      // Get the value from the disk data
      return getProperty(fromDisk, key as string, defaultValue);
    } catch (error) {
      // If any error occurs, return the default value
      return defaultValue;
    }
  }

  set<Key extends keyof T>(key: Key, value: T[Key]): void;
  set(object: Partial<T>): void;
  set<Key extends keyof T>(keyOrObject: Key | Partial<T>, value?: T[Key]): void {
    // Always get the latest store data from disk first
    const latestStore = this.store;
    
    // Keep a copy of the original store for change detection
    const oldStore = JSON.parse(JSON.stringify(latestStore));
    
    // Create an updated version of the store
    let updated: T;
    
    if (typeof keyOrObject === 'string') {
      // When using dot notation keys (e.g., 'user.name')
      const path = keyOrObject as string;
      
      if (path.includes('.')) {
        // For nested properties, use the setProperty utility
        updated = setProperty(latestStore, path, value);
      } else {
        // For top-level properties, direct assignment is more reliable
        updated = { ...latestStore };
        (updated as any)[path] = value;
      }
    } else {
      // For object updates, merge with the current store
      updated = { ...latestStore };
      
      // Apply each property from the object
      const updateObj = keyOrObject as Partial<T>;
      for (const key in updateObj) {
        if (Object.prototype.hasOwnProperty.call(updateObj, key)) {
          (updated as any)[key] = updateObj[key];
        }
      }
    }
    
    // Write the updated data to disk and update internal state
    this._store = updated; // Update in-memory cache first
    
    // Force synchronous write to disk
    try {
      fs.mkdirSync(path.dirname(this.path), { recursive: true });
      atomicWriteFileSync(this.path, JSON.stringify(updated, null, '\t'));
    } catch (e) {
      console.error('Error updating store:', e);
    }
    
    // Notify listeners of changes
    this._handlePossibleChange(oldStore);
  }

  has<Key extends keyof T>(key: Key): boolean {
    const storeInstance = this.store;
    const result = hasProperty(storeInstance, key as string);
    return result;
  }

  delete<Key extends keyof T>(key: Key): boolean {
    // Get a fresh copy of the store
    const storeInstance = JSON.parse(JSON.stringify(this.store)); // deep clone for safe mutation
    const oldStore = JSON.parse(JSON.stringify(storeInstance)); // deep clone for change detection
    
    // Check if the property exists using the key path
    if (!hasProperty(storeInstance, key as string)) {
      return false;
    }
    
    // Delete the property and update the store
    const [newStore, deleted] = deleteProperty(storeInstance, key as string);
    this.store = newStore;
    this._handlePossibleChange(oldStore);
    return true; // If we got here and the property existed, the deletion was successful
  }

  clear(): void {
    // Keep a reference to the old store for change detection
    const oldStore = JSON.parse(JSON.stringify(this.store));
    
    // Create a completely empty object
    const emptyStore = {} as T;
    
    // Write the empty object to disk using the store setter
    this.store = emptyStore;
    
    // Force a sync from disk to ensure the changes are reflected everywhere
    // This also helps clear any caching issues
    setTimeout(() => {
      try {
        // Make sure the file actually exists and is empty
        const exists = fs.existsSync(this.path);
        if (exists) {
          const content = fs.readFileSync(this.path, 'utf8');
          const parsed = JSON.parse(content);
          if (Object.keys(parsed).length > 0) {
            // If somehow not empty, force it to be empty
            atomicWriteFileSync(this.path, JSON.stringify({}, null, '\t'));
          }
        }
      } catch (e) {
        // If error, try once more to write empty object
        try {
          atomicWriteFileSync(this.path, JSON.stringify({}, null, '\t'));
        } catch {}
      }
    }, 0);
    
    // Notify listeners of change
    this._handlePossibleChange(oldStore);
  }

  private _handlePossibleChange(oldStore: T): void {
    // Get a fresh copy of the store directly from disk to ensure we have the latest data
    const freshStore = {
      ...this._store // Start with our cached copy
    };
    
    try {
      // Read the latest data from disk in case it was modified elsewhere
      const fileContent = fs.readFileSync(this.path, 'utf8');
      const parsed = JSON.parse(fileContent) as T;
      // Use the disk data as our source of truth
      Object.assign(freshStore, parsed);
    } catch {
      // If reading fails, just use what we have in memory
    }
    
    // Check for changes to any properties in the store
    if (!isDeepStrictEqual(oldStore, freshStore)) {
      for (const listener of this.onDidAnyChangeListeners) {
        listener(freshStore, oldStore);
      }
    }
    
    // Check for specific key changes
    for (const [key, listeners] of this.onDidChangeListeners.entries()) {
      const oldValue = getProperty(oldStore, key);
      const newValue = getProperty(freshStore, key);
      
      if (!isDeepStrictEqual(oldValue, newValue)) {
        for (const listener of listeners) {
          listener(newValue, oldValue);
        }
      }
    }
  }

  onDidChange<Key extends keyof T>(key: Key, callback: OnDidChangeCallback<T[Key]>): Unsubscribe {
    const keyString = key as string;
    if (!this.onDidChangeListeners.has(keyString)) {
      this.onDidChangeListeners.set(keyString, []);
    }
    this.onDidChangeListeners.get(keyString)!.push(callback);
    return () => {
      const listeners = this.onDidChangeListeners.get(keyString);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index !== -1) listeners.splice(index, 1);
        if (listeners.length === 0) this.onDidChangeListeners.delete(keyString);
      }
    };
  }

  onDidAnyChange(callback: OnDidAnyChangeCallback<T>): Unsubscribe {
    this.onDidAnyChangeListeners.push(callback);
    return () => {
      const index = this.onDidAnyChangeListeners.indexOf(callback);
      if (index !== -1) this.onDidAnyChangeListeners.splice(index, 1);
    };
  }

  /**
   * Opens the store file in the default editor for the user's system.
   * @returns A promise that resolves when the file is opened, or rejects with an error.
   */
  /**
   * Implements the iterable protocol, allowing the store to be used with for...of loops.
   * Yields key-value pairs from the store.
   * 
   * @example
   * ```ts
   * const store = new SimpleStore();
   * for (const [key, value] of store) {
   *   console.log(key, value);
   * }
   * ```
   */
  *[Symbol.iterator](): Generator<[string, any]> {
    // Get the current store data
    const storeData = this.store;
    
    // Return only top-level properties for iteration
    for (const key in storeData) {
      if (Object.prototype.hasOwnProperty.call(storeData, key)) {
        yield [key, storeData[key]];
      }
    }
  }

  /**
   * Opens the store file in the default editor for the user's system.
   * @returns A promise that resolves when the file is opened, or rejects with an error.
   */
  async openInEditor(): Promise<void> {
    try {
      // Try to access electron or the global mock in test environments
      let electronShell: any;
      
      // First check if there's a global mock (for testing)
      if (typeof globalThis !== 'undefined' && 
          (globalThis as any).electron && 
          (globalThis as any).electron.shell && 
          typeof (globalThis as any).electron.shell.openPath === 'function') {
        electronShell = (globalThis as any).electron.shell;
      } else {
        // If no mock is found, try to require the actual electron module
        try {
          const electron = (require('electron')?.default || require('electron'));
          electronShell = electron.shell;
        } catch (e) {
          throw new Error('Unable to access electron.shell. Make sure Electron is available.');
        }
      }
      
      if (!electronShell) {
        throw new Error('Unable to access electron.shell. Make sure Electron is available.');
      }
      
      // Try to open the file with the default application
      const result = await electronShell.openPath(this.path);
      
      // If there's an error message, throw it
      if (result && result.trim().length > 0) {
        throw new Error(`Failed to open store file: ${result}`);
      }
    } catch (error: any) {
      throw new Error(`Error opening file in editor: ${error.message}`);
    }
  }
}

// Export the types for external use
export type { StoreData, SimpleStoreOptions, OnDidChangeCallback, OnDidAnyChangeCallback, Unsubscribe };
