/**
 * Extracts a human-readable message from an HTTP error response. The backend's global error handler
 * uses `{ message }` for validation errors (400) and `{ error }` for not-found errors (404) - see
 * `web-server.ts`'s error-handling middleware - so both shapes are checked (see `bodyMessage`) before
 * falling back to the generic HttpErrorResponse message.
 */
export function extractErrorMessage(error: unknown): string {
  const body = isObject(error) ? error['error'] : null;
  return bodyMessage(body) || stringProperty(error, 'message') || 'Unknown error';
}

/**
 * The message the backend put in the body of an error response, or null if there is none:
 * - `{ message: string }` for the errors of the services;
 * - `{ error: string }` for the not-found and internal errors;
 * - `{ message: { <field>: { message } } }` when tsoa rejects the request body, listed as `<field>: <message>`.
 */
export function bodyMessage(body: unknown): string | null {
  return stringProperty(body, 'message') || stringProperty(body, 'error') || validationMessage(body);
}

/**
 * The fields tsoa rejected, keyed by their path prefixed with the name of the request parameter
 * (`command.commandPermissions.setpoint`), which means nothing to the user and is removed.
 */
function validationMessage(body: unknown): string | null {
  const fields = isObject(body) ? body['message'] : null;
  if (!isObject(fields)) {
    return null;
  }
  const messages = Object.entries(fields).map(([path, detail]) => {
    const field = path.replace(/^[^.]+\./, '');
    const message = typeof detail === 'string' ? detail : stringProperty(detail, 'message');
    return message ? `${field}: ${message}` : field;
  });
  return messages.length > 0 ? messages.join('; ') : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringProperty(value: unknown, key: string): string | null {
  return isObject(value) && typeof value[key] === 'string' ? value[key] : null;
}
