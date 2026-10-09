import { HttpErrorResponse } from '@angular/common/http';

import { describe, expect, test } from 'vitest';

import { extractErrorMessage } from './extract-error-message';

describe('extractErrorMessage', () => {
  test.each([
    { name: 'the message of the body', error: new HttpErrorResponse({ error: { message: 'Invalid name' } }), expected: 'Invalid name' },
    { name: 'the error of the body', error: new HttpErrorResponse({ error: { error: 'Not found' } }), expected: 'Not found' },
    {
      name: 'the message of the response',
      error: new HttpErrorResponse({ status: 500, statusText: 'Server Error', url: '/api/x' }),
      expected: 'Http failure response for /api/x: 500 Server Error'
    },
    { name: 'the message of an error', error: new Error('boom'), expected: 'boom' },
    { name: 'a default message for an object without message', error: { error: {} }, expected: 'Unknown error' },
    { name: 'a default message for null', error: null, expected: 'Unknown error' },
    { name: 'a default message for a string', error: 'oops', expected: 'Unknown error' }
  ])('should extract $name', ({ error, expected }) => {
    expect(extractErrorMessage(error)).toBe(expected);
  });
});
