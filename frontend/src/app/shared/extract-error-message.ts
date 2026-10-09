/**
 * Extracts a human-readable message from an HTTP error response. The backend's global error handler
 * uses `{ message }` for validation errors (400) and `{ error }` for not-found errors (404) - see
 * `web-server.ts`'s error-handling middleware - so both shapes are checked before falling back to the
 * generic HttpErrorResponse message.
 */
export function extractErrorMessage(error: unknown): string {
  const body = isObject(error) ? error['error'] : null;
  return stringProperty(body, 'message') || stringProperty(body, 'error') || stringProperty(error, 'message') || 'Unknown error';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringProperty(value: unknown, key: string): string | null {
  return isObject(value) && typeof value[key] === 'string' ? value[key] : null;
}
