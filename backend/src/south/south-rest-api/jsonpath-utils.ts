import objectPath from 'object-path';

/**
 * Parse a JSONPath expression and extract value from object
 * Supports simple dot notation paths like "data.items[0].timestamp"
 */
export function parseJsonPath(obj: Record<string, unknown>, jsonPath: string): unknown {
  try {
    // Support JSONPath that starts with '$' or '.'
    const withoutRoot = jsonPath.startsWith('$') ? jsonPath.substring(1) : jsonPath;
    const normalizedPath = withoutRoot.startsWith('.') ? withoutRoot.substring(1) : withoutRoot;
    // Use object-path library which supports dot notation and array indices
    return objectPath.get(obj, normalizedPath);
  } catch {
    // If path doesn't exist, return undefined
    return undefined;
  }
}

/**
 * Extract date time fields from JSON result using JSONPath
 * This is a helper function that can be used for validation
 */
export function extractDateTimeFields(data: Array<Record<string, unknown>>, jsonPath: string): Array<unknown> {
  const values: Array<unknown> = [];
  for (const entry of data) {
    const value = parseJsonPath(entry, jsonPath);
    if (value !== undefined && value !== null) {
      values.push(value);
    }
  }
  return values;
}
