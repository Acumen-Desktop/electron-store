# SimpleStore - A Dependency-Free Store for Electron

This is a simplified, dependency-free version of `electron-store`, designed to provide basic data persistence for Electron applications using only built-in Electron and Node.js APIs.

## Features

-   Stores data in a JSON file (default `config.json`) in `app.getPath('userData')`.
-   Core methods: `get()`, `set()`, `has()`, `delete()`, `clear()`.
-   Dot-notation support for accessing nested properties.
-   Atomic file writes to prevent data corruption.
-   Change watching: `onDidChange(key, callback)` and `onDidAnyChange(callback)`.
-   Works in both main and renderer processes (`SimpleStore.initRenderer()` required for renderer usage).
-   **Iterable API**: Use with `for...of` loops or spread operator (`[...store]`).
-   **Renderer Process Support**: Easy IPC communication setup via `SimpleStore.initRenderer()`.
-   **Project Version Tracking**: Store app/project version information via `projectVersion` option.
-   **Open in Editor**: `openInEditor()` method to open the store file in system's default editor.

## Excluded Features (for simplicity and no dependencies)

-   JSON Schema validation.
-   Data migrations.
-   Encryption.
-   Custom serialization formats.

## Modern TypeScript-Native Test Workflow

This project uses a clean, modern TypeScript workflow for all tests:

- **No .js files are emitted**: TypeScript is configured with `"noEmit": true`.
- **Test runner**: [`tsx`](https://github.com/esbuild-kit/tsx) runs all `.test.ts` files directly with ESM support.
- **Test isolation**: All tests use a mock user data directory to avoid polluting real user data or leaking state between tests.

### Running Tests

1. Ensure you have [`tsx`](https://github.com/esbuild-kit/tsx) installed globally:
   ```sh
   npm install -g tsx
   ```
2. Run all tests:
   ```sh
   npm test
   # or
   tsx --test __tests__/*.test.ts
   ```

### TypeScript Configuration

- See `tsconfig.json` for project settings. Key options:
  ```json
  {
    "compilerOptions": {
      "noEmit": true,
      ...
    }
  }
  ```

### Test File Structure

- All test files are TypeScript (`.test.ts`) and live in the `__tests__` directory.
- No JavaScript build artifacts are generated or needed for testing.

## Setup & Usage

1.  **Compilation**: These files are written in TypeScript (`.ts`). You need to compile them to JavaScript (e.g., using `tsc`) before use.

2.  **Main Process Initialization (if using in Renderer):**

    ```typescript
    // In your Electron main process file
    import SimpleStore from './path/to/stand_alone_version/index';

    SimpleStore.initRenderer();
    ```

3.  **Creating and Using a Store:**

    ```typescript
    import SimpleStore from './path/to/stand_alone_version/index';

    interface MyAppSettings {
      theme?: string;
      notificationsEnabled?: boolean;
      userPreferences?: Record<string, any>;
    }

    const store = new SimpleStore<MyAppSettings>({
      defaults: {
        theme: 'light',
        notificationsEnabled: true
      },
      name: 'app-preferences', // Optional: custom file name
      projectVersion: '1.0.0'  // Optional: track your app version
    });

    // Set a value
    store.set('theme', 'dark');

    // Get a value
    console.log(store.get('theme')); // Output: dark

    // Watch for changes to a specific key
    const unsubscribeThemeWatcher = store.onDidChange('theme', (newValue, oldValue) => {
      console.log(`Theme changed from ${oldValue} to ${newValue}`);
    });

    // To stop watching:
    // unsubscribeThemeWatcher();
    ```

4.  **Using Iterable API:**

    ```typescript
    // Iterate over all store entries
    for (const [key, value] of store) {
      console.log(`${key}: ${JSON.stringify(value)}`);
    }

    // Convert to array of entries using spread operator
    const entries = [...store];
    console.log(entries); // [[key1, value1], [key2, value2], ...]
    ```

5.  **Renderer Process Support:**

    ```typescript
    // In main process
    import SimpleStore from './path/to/stand_alone_version/index';
    import { app } from 'electron';

    app.whenReady().then(() => {
      // Initialize renderer support before creating BrowserWindow
      SimpleStore.initRenderer();
      
      // Create your BrowserWindow and load your app
      // ...
    });

    // Clean up when app is quitting
    app.on('will-quit', () => {
      SimpleStore.cleanupMain();
    });

    // In renderer process, use SimpleStore normally
    // No need for IPC code - it's handled automatically!
    ```

6.  **Opening Store in Editor:**

    ```typescript
    // Open the store file in the default editor
    await store.openInEditor();
    ```

## File Structure

-   `index.ts`: Main `SimpleStore` class.
-   `types_store.ts`: TypeScript type definitions.
-   `utils.ts`: Helper functions (atomic writes, dot-notation, etc.).
