import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Writes data to a file atomically.
 * Creates a temporary file, writes to it, then renames it to the target file.
 */
export function atomicWriteFileSync(filePath: string, data: string, options?: fs.WriteFileOptions): void {
  const tempFilePath = filePath + '.tmp' + Date.now() + Math.random().toString(36).slice(2);
  try {
    fs.writeFileSync(tempFilePath, data, options);
    fs.renameSync(tempFilePath, filePath);
  } catch (error) {
    // If rename fails, try to clean up the temp file
    try {
      fs.unlinkSync(tempFilePath);
    } catch {
      // Ignore errors cleaning up, the original error is more important
    }
    throw error;
  }
}

/**
 * Gets a nested property from an object using a dot-notation path.
 */
export function getProperty<T extends Record<string, any>, K = unknown>(
  object: T,
  propertyPath: string,
  defaultValue?: K,
): K | undefined {
  if (typeof propertyPath !== 'string') {
    throw new TypeError('Expected propertyPath to be a string');
  }

  const pathParts = propertyPath.split('.');
  let current: any = object;

  for (const part of pathParts) {
    if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) {
      return defaultValue;
    }
    current = current[part];
  }
  return current === undefined ? defaultValue : current;
}

/**
 * Sets a nested property on an object using a dot-notation path.
 */
export function setProperty<T extends Record<string, any>>(
  object: T,
  propertyPath: string,
  value: any,
): T {
  if (typeof propertyPath !== 'string') {
    throw new TypeError('Expected propertyPath to be a string');
  }

  const pathParts = propertyPath.split('.');
  let current: any = object;

  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];
    if (i === pathParts.length - 1) {
      current[part] = value;
    } else {
      if (current[part] === null || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }
  }
  return object;
}

/**
 * Checks if a nested property exists on an object using a dot-notation path.
 */
export function hasProperty<T extends Record<string, any>>(
  object: T,
  propertyPath: string,
): boolean {
  if (typeof propertyPath !== 'string') {
    throw new TypeError('Expected propertyPath to be a string');
  }

  const pathParts = propertyPath.split('.');
  let current: any = object;

  for (const part of pathParts) {
    if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) {
      return false;
    }
    current = current[part];
  }
  return true;
}

/**
 * Deletes a nested property from an object using a dot-notation path.
 */
export function deleteProperty<T extends Record<string, any>>(
  object: T,
  propertyPath: string,
): boolean {
  if (typeof propertyPath !== 'string') {
    throw new TypeError('Expected propertyPath to be a string');
  }

  const pathParts = propertyPath.split('.');
  let current: any = object;

  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];
    if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) {
      return false; // Property doesn't exist
    }
    if (i === pathParts.length - 1) {
      delete current[part];
      return true;
    }
    current = current[part];
  }
  return false; // Should not be reached if path is valid
}

/**
 * Deeply compares two objects for equality.
 * A simple implementation, not as robust as Node's `util.isDeepStrictEqual` for all edge cases
 * (e.g., TypedArrays, RegExp, Date, Map, Set, custom object types with `Symbol.iterator`).
 * Suitable for JSON-like objects.
 */
export function isDeepStrictEqual(objA: any, objB: any): boolean {
  if (objA === objB) return true;

  if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(objB, key) || !isDeepStrictEqual(objA[key], objB[key])) {
      return false;
    }
  }

  return true;
}

export function debounce<F extends (...args: any[]) => any>(
  func: F,
  waitFor: number,
): (...args: Parameters<F>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<F>): void => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => func(...args), waitFor);
  };
}
