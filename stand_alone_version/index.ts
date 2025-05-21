import * as fs from 'node:fs';
import * as path from 'node:path';
import { homedir } from 'node:os';
import type { StoreData, SimpleStoreOptions, OnDidChangeCallback, OnDidAnyChangeCallback, Unsubscribe } from './types_store.js';
import { atomicWriteFileSync, getProperty, setProperty, hasProperty, deleteProperty, isDeepStrictEqual } from './utils.js';

// Minimal Electron detection for production
let app: Electron.App | undefined;
try {
  // Support both ESM and CJS
  const electron = (require('electron')?.default || require('electron')) as typeof import('electron');
  app = electron.app;
} catch {
  app = undefined;
}

// Helper to determine if running in renderer or main process (optional, if needed)
const isRenderer = (): boolean => {
  try {
    return process?.type === 'renderer';
  } catch {
    return false;
  }
};

/**
 * Simple class for managing user-specific application data, similar to electron-store.
 * Handles data persistence in a JSON file and provides methods for data manipulation and observation.
 */
export default class SimpleStore<T extends StoreData = Record<string, any>> {
  readonly path: string;
  private readonly options: SimpleStoreOptions<T>;
  private readonly onDidChangeListeners = new Map<string, Array<OnDidChangeCallback<any>>>();
  private readonly onDidAnyChangeListeners: Array<OnDidAnyChangeCallback<T>> = [];

  constructor(options: SimpleStoreOptions<T> = {}) {
    this.options = { ...options };
    const projectName = this.options.name || 'config';
    let baseDir = app?.getPath('userData') || path.join(homedir(), `.${projectName}`);
    if (options.cwd) baseDir = options.cwd;
    this.path = path.resolve(baseDir, `${projectName}.json`);
    // Write defaults if provided
    if (options.defaults && Object.keys(options.defaults).length > 0) {
      this.store = { ...options.defaults, ...this.store };
    }
  }

  get store(): T {
    let parsed: T;
    try {
      const fileContent = fs.readFileSync(this.path, 'utf8');
      parsed = JSON.parse(fileContent) as T;
      console.log('[SimpleStore:store getter] Read from disk:', JSON.stringify(parsed));
      return parsed;
    } catch (error: any) {
      // File not found or corrupted: fallback to defaults or empty
      const initial = (this.options.defaults ? { ...this.options.defaults } : {}) as T;
      try {
        fs.mkdirSync(path.dirname(this.path), { recursive: true });
        atomicWriteFileSync(this.path, JSON.stringify(initial, null, '\t'));
        console.log('[SimpleStore:store getter] File missing/corrupt. Wrote defaults:', JSON.stringify(initial));
      } catch {}
      return initial;
    }
  
    try {
      const fileContent = fs.readFileSync(this.path, 'utf8');
      const parsed = JSON.parse(fileContent) as T;
      // console.log('[SimpleStore:get] Read from', this.path, 'value:', parsed);
      return parsed;
    } catch (error: any) {
      // File not found or corrupted: fallback to defaults or empty
      const initial = (this.options.defaults ? { ...this.options.defaults } : {}) as T;
      try {
        fs.mkdirSync(path.dirname(this.path), { recursive: true });
        atomicWriteFileSync(this.path, JSON.stringify(initial, null, '\t'));
        // console.log('[SimpleStore:get] File missing/corrupt. Wrote defaults to', this.path, 'value:', initial);
      } catch {}
      return initial;
    }
  }
  set store(value: T) {
    console.log('[SimpleStore:store setter] Writing to disk:', JSON.stringify(value));
    try {
      fs.mkdirSync(path.dirname(this.path), { recursive: true });
      atomicWriteFileSync(this.path, JSON.stringify(value, null, '\t'));
      // console.log('[SimpleStore:set] Wrote to', this.path, 'value:', value);
    } catch (e) {
      // console.log('[SimpleStore:set] Error writing to', this.path, e);
    }
  }

  // --- Store manipulation methods ---
  get<Key extends keyof T>(key: Key): T[Key] | undefined;
  get<Key extends keyof T>(key: Key, defaultValue: Required<T>[Key]): Required<T>[Key];
  get<Key extends keyof T>(key: Key, defaultValue?: T[Key]): T[Key] | undefined {
  console.log('[SimpleStore:get] Store before get:', JSON.stringify(this.store));
    const currentValue = this.store;
    return getProperty(currentValue, key as string, defaultValue);
  }

  set<Key extends keyof T>(key: Key, value: T[Key]): void;
  set(object: Partial<T>): void;
  set<Key extends keyof T>(keyOrObject: Key | Partial<T>, value?: T[Key]): void {
    // Always operate on a single fresh instance of the store
    const storeInstance = this.store;
    const oldStore = JSON.parse(JSON.stringify(storeInstance)); // deep clone for change detection
    let updated: T;
    if (typeof keyOrObject === 'string') {
      updated = setProperty(storeInstance, keyOrObject as string, value);
    } else {
      updated = { ...storeInstance, ...(keyOrObject as Partial<T>) };
    }
    this.store = updated;
    this._handlePossibleChange(oldStore);
  }

  has<Key extends keyof T>(key: Key): boolean {
    const storeInstance = this.store;
    const result = hasProperty(storeInstance, key as string);
    return result;
  }

  delete<Key extends keyof T>(key: Key): void {
    const storeInstance = this.store;
    const oldStore = JSON.parse(JSON.stringify(storeInstance)); // deep clone for change detection
    const newStore = deleteProperty(storeInstance, key as string);
    this.store = newStore;
    this._handlePossibleChange(oldStore);
  }

  clear(): void {
    const oldStore = { ...this.store };
    this.store = {} as T;
    this._handlePossibleChange(oldStore);
  }

  private _handlePossibleChange(oldStore: T): void {
    const newStore = this.store;
    if (!isDeepStrictEqual(oldStore, newStore)) {
      for (const listener of this.onDidAnyChangeListeners) {
        listener(newStore, oldStore);
      }
    }
    for (const [key, listeners] of this.onDidChangeListeners) {
      const oldValue = getProperty(oldStore, key);
      const newValue = getProperty(newStore, key);
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
}

/*
// Advanced/optional features (move to separate file if needed):
// openInEditor(): void { ... }
// static initRenderer(...) { ... }
// static cleanupMain(...) { ... }
*/

// Export the types for external use
export type { StoreData, SimpleStoreOptions, OnDidChangeCallback, OnDidAnyChangeCallback, Unsubscribe };
