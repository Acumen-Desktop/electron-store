// OLD VERSIONS - for reference only

/**
 * Deletes a nested property from an object using a dot-notation path.
 */
export function deleteProperty<T extends Record<string, any>>(
  object: T,
  propertyPath: string,
): T {
  if (typeof propertyPath !== 'string') {
    throw new TypeError('Expected propertyPath to be a string');
  }

  const pathParts = propertyPath.split('.');
  // Deep clone the object to avoid mutating the original
  const result: any = JSON.parse(JSON.stringify(object));
  let current: any = result;

  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];
    if (current === null || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) {
      break; // Property doesn't exist, nothing to delete
    }
    if (i === pathParts.length - 1) {
      delete current[part];
    } else {
      current = current[part];
    }
  }
  return result as T;
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
