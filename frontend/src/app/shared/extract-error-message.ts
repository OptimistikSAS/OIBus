/**
 * Extracts a human-readable message from an HTTP error response. The backend's global error handler
 * uses `{ message }` for validation errors (400) and `{ error }` for not-found errors (404) - see
 * `web-server.ts`'s error-handling middleware - so both shapes are checked before falling back to the
 * generic HttpErrorResponse message.
 */
export function extractErrorMessage(error: unknown): string {
  const httpError = error as { error?: { message?: string; error?: string }; message?: string };
  return httpError.error?.message || httpError.error?.error || httpError.message || 'Unknown error';
}
