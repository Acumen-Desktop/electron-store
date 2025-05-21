export type Primitive = string | number | boolean | symbol | undefined | null;

export type JsonValue = Primitive | JsonObject | JsonArray;

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface JsonArray extends Array<JsonValue> {}

export type StoreData = JsonObject;

export interface SimpleStoreOptions<T extends StoreData = Record<string, any>> {
  /**
   * Default values for the store.
   * If the store file doesn't exist or is corrupted, it will be initialized with these defaults.
   */
  defaults?: Partial<T>;

  /**
   * Name of the store file (without extension).
   * @default 'config'
   */
  name?: string;

  /**
   * Extension of the configuration file.
   * @default 'json'
   */
  fileExtension?: string;

  /**
   * The directory where the configuration file will be stored.
   * Can be an absolute path or a path relative to `app.getPath('userData')`.
   * @default app.getPath('userData')
   */
  cwd?: string;

  /**
   * Enable watching of the config file for external changes.
   * @default true
   */
  watch?: boolean;

  /**
    * Access properties by dot notation.
    * @default true
    */
  accessPropertiesByDotNotation?: boolean;
}

export type OnDidChangeCallback<V> = (newValue?: V, oldValue?: V) => void;

export type OnDidAnyChangeCallback<T extends StoreData> = (
  newData?: Readonly<T>,
  oldData?: Readonly<T>,
) => void;

export type Unsubscribe = () => void;
