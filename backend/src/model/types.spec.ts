import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NotFoundError, OIBusValidationError, OIBusTestingError } from './types';

describe('NotFoundError', () => {
  it('constructs without a message', () => {
    const error = new NotFoundError();
    assert.ok(error instanceof Error);
    assert.ok(error instanceof NotFoundError);
  });

  it('constructs with a message', () => {
    const error = new NotFoundError('not found');
    assert.equal(error.message, 'not found');
    assert.ok(error instanceof NotFoundError);
  });
});

describe('OIBusValidationError', () => {
  it('constructs without a message', () => {
    const error = new OIBusValidationError();
    assert.ok(error instanceof Error);
    assert.ok(error instanceof OIBusValidationError);
  });

  it('constructs with a message', () => {
    const error = new OIBusValidationError('invalid');
    assert.equal(error.message, 'invalid');
    assert.ok(error instanceof OIBusValidationError);
  });
});

describe('OIBusTestingError', () => {
  it('constructs without a message', () => {
    const error = new OIBusTestingError();
    assert.ok(error instanceof Error);
    assert.ok(error instanceof OIBusTestingError);
  });

  it('constructs with a message', () => {
    const error = new OIBusTestingError('testing failed');
    assert.equal(error.message, 'testing failed');
    assert.ok(error instanceof OIBusTestingError);
  });
});
