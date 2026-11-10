import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { OIBusExploreError } from '../model/types';
import { exploreErrorKind, toExploreError } from './explore-error';

function driverError(message: string, fields: Record<string, unknown>): Error {
  return Object.assign(new Error(message), fields);
}

describe('explore error', () => {
  it('should tell a permission error', () => {
    assert.equal(exploreErrorKind(driverError('denied', { code: 'EACCES' })), 'permission');
    assert.equal(exploreErrorKind(driverError('insufficient privilege', { code: '42501' })), 'permission');
    assert.equal(exploreErrorKind(driverError('table access denied', { code: 'ER_TABLEACCESS_DENIED_ERROR' })), 'permission');
    assert.equal(exploreErrorKind(driverError('insufficient privileges', { code: 'ORA-01031' })), 'permission');
    assert.equal(exploreErrorKind(driverError('SELECT permission denied', { code: 'EREQUEST', number: 229 })), 'permission');
    assert.equal(exploreErrorKind(driverError('no access to the database', { code: 'EREQUEST', number: 916 })), 'permission');
  });

  it('should tell a connection error', () => {
    assert.equal(exploreErrorKind(driverError('refused', { code: 'ECONNREFUSED' })), 'connection');
    assert.equal(exploreErrorKind(driverError('login failed', { code: 'ELOGIN' })), 'connection');
    assert.equal(exploreErrorKind(driverError('password authentication failed', { code: '28P01' })), 'connection');
    assert.equal(exploreErrorKind(driverError('no folder', { code: 'ENOENT' })), 'connection');
  });

  it('should look into the error a driver wraps', () => {
    assert.equal(
      exploreErrorKind(driverError('request failed', { originalError: driverError('denied', { code: 'EACCES' }) })),
      'permission'
    );
    assert.equal(exploreErrorKind(new Error('failed', { cause: driverError('refused', { code: 'ECONNREFUSED' }) })), 'connection');
  });

  it('should not tell other errors', () => {
    assert.equal(exploreErrorKind(new Error('syntax error')), null);
    assert.equal(exploreErrorKind(driverError('invalid object name', { code: 'EREQUEST', number: 208 })), null);
    assert.equal(exploreErrorKind(driverError('number without request', { code: 'OTHER', number: 229 })), null);
    assert.equal(exploreErrorKind('a string'), null);
    assert.equal(exploreErrorKind(null), null);
  });

  it('should build the explore error', () => {
    assert.deepEqual(toExploreError(driverError('denied', { code: 'EACCES' })), new OIBusExploreError('denied', 'permission'));
    assert.deepEqual(toExploreError(new Error('failed'), 'connection'), new OIBusExploreError('failed', 'connection'));
    assert.deepEqual(toExploreError(new Error('failed')), new OIBusExploreError('failed', null));
    const exploreError = new OIBusExploreError('denied', 'permission');
    assert.equal(toExploreError(exploreError, 'connection'), exploreError);
  });
});
