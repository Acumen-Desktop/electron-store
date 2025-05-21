// OLD VERSION - for reference only
/**
 * Deletes a nested property from an object using a dot-notation path.
 * Returns true if the property was deleted, false otherwise.
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
