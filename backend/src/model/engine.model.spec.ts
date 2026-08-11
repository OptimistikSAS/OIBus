import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OIBusError, METADATA_FOLDER, CONTENT_FOLDER } from './engine.model';

describe('OIBusError', () => {
  it('sets message and forceRetry to true', () => {
    const error = new OIBusError('a retryable error', true);
    assert.equal(error.message, 'a retryable error');
    assert.equal(error.forceRetry, true);
    assert.equal(error._isOIBusError, true);
    assert.ok(error instanceof Error);
    assert.ok(error instanceof OIBusError);
  });

  it('sets message and forceRetry to false', () => {
    const error = new OIBusError('a non-retryable error', false);
    assert.equal(error.message, 'a non-retryable error');
    assert.equal(error.forceRetry, false);
    assert.equal(error._isOIBusError, true);
  });
});

describe('folder constants', () => {
  it('exposes the expected metadata and content folder names', () => {
    assert.equal(METADATA_FOLDER, 'metadata');
    assert.equal(CONTENT_FOLDER, 'content');
  });
});
