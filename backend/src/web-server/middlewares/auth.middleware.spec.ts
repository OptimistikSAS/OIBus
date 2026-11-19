import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';

import type { EngineSettings } from '../../model/engine.model';
import type { User } from '../../model/user.model';
import { encryptionService } from '../../service/encryption.service';
import type OIBusService from '../../service/oibus.service';
import type UserService from '../../service/user.service';
import testData from '../../tests/utils/test-data';
import { createMock, Mocked } from '../../tests/utils/test-utils';
import type { CustomExpressRequest } from '../express';
import { authMiddleware, passwordFingerprint } from './auth.middleware';
import type AuthenticationLimiter from './authentication-limiter';

const basicAuthHeader = (user: string, pass: string) => 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
const bearerHeader = (token: string) => `Bearer ${token}`;

const FAKE_USER: User = { ...testData.users.list[0], id: 'u1', login: 'alice' };
const HASHED = '$argon2id$hashed';
const FINGERPRINT = passwordFingerprint(HASHED);

describe('authMiddleware', () => {
  let userService: Mocked<UserService>;
  let getTokenSecret: Mock<() => Buffer>;
  let oIBusService: Mocked<OIBusService>;
  let authenticationLimiter: Mocked<AuthenticationLimiter>;
  let mockNext: Mock<NextFunction>;

  beforeEach(() => {
    userService = createMock<UserService>();
    getTokenSecret = mock.method(encryptionService, 'getTokenSecret', () => crypto.randomBytes(32));
    oIBusService = createMock<OIBusService>({ getEngineSettings: () => ({ webServer: { authTokenDuration: '7d' } }) as EngineSettings });
    authenticationLimiter = createMock<AuthenticationLimiter>({ retryAfter: () => 0 });
    mockNext = mock.fn();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  /** Runs the middleware on a request to `path` and returns the request and the response */
  const run = async (
    path: string,
    headers: Record<string, string> = {},
    url = path,
    query: Record<string, string> = {},
    method = 'GET'
  ) => {
    const req = createMock<CustomExpressRequest>({ path, url, headers, query, method, ip: '1.2.3.4' });
    const res = createMock<Response>();
    res.status.mock.mockImplementation(() => res);
    await authMiddleware(userService, oIBusService, authenticationLimiter)(req, res, mockNext);
    return { req, res };
  };

  describe('Basic Auth', () => {
    it('should call next() and set req.user on valid credentials', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => HASHED);
      userService.findByLogin.mock.mockImplementation(() => FAKE_USER);
      userService.verifyPassword.mock.mockImplementation(async () => true);

      const { req } = await run('/api/data', { authorization: basicAuthHeader('alice', 'secret') });

      assert.strictEqual(mockNext.mock.calls.length, 1);
      assert.deepStrictEqual(req.user, { id: 'u1', login: 'alice' });
    });

    it('should return 401 when basic-auth cannot parse the header', async () => {
      const { res } = await run('/api/data', { authorization: 'Basic ' });

      assert.strictEqual(mockNext.mock.calls.length, 0);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });

    it('should return 401 and record the failure when user is not found', async () => {
      userService.verifyPassword.mock.mockImplementation(async () => false);
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => null);

      const { res } = await run('/api/data', { authorization: basicAuthHeader('unknown', 'pass') });

      assert.deepStrictEqual(userService.verifyPassword.mock.calls[0].arguments, ['unknown', 'pass']);
      assert.strictEqual(mockNext.mock.calls.length, 0);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
      assert.deepStrictEqual(authenticationLimiter.recordFailure.mock.calls[0].arguments, ['1.2.3.4', 'unknown']);
    });

    it('should return 401 and record the failure when password is wrong', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => HASHED);
      userService.verifyPassword.mock.mockImplementation(async () => false);

      const { res } = await run('/api/data', { authorization: basicAuthHeader('alice', 'wrong') });

      assert.strictEqual(mockNext.mock.calls.length, 0);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
      assert.deepStrictEqual(authenticationLimiter.recordFailure.mock.calls[0].arguments, ['1.2.3.4', 'alice']);
    });

    it('should return 429 without verifying the password when the address or the login is blocked', async () => {
      authenticationLimiter.retryAfter.mock.mockImplementation(() => 600);

      const { res } = await run('/api/data', { authorization: basicAuthHeader('alice', 'secret') });

      assert.deepStrictEqual(authenticationLimiter.retryAfter.mock.calls[0].arguments, ['1.2.3.4', 'alice']);
      assert.strictEqual(userService.verifyPassword.mock.calls.length, 0);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 429);
      assert.deepStrictEqual(res.set.mock.calls[0].arguments, ['Retry-After', '600']);
      assert.strictEqual(mockNext.mock.calls.length, 0);
    });

    it('should not record a failure on valid credentials', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => HASHED);
      userService.findByLogin.mock.mockImplementation(() => FAKE_USER);
      userService.verifyPassword.mock.mockImplementation(async () => true);

      await run('/api/data', { authorization: basicAuthHeader('alice', 'secret') });

      assert.strictEqual(authenticationLimiter.recordFailure.mock.calls.length, 0);
      assert.strictEqual(mockNext.mock.calls.length, 1);
    });

    it('should return JWT token for valid credentials on /api/users/authentication', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => HASHED);
      userService.verifyPassword.mock.mockImplementation(async () => true);
      const signMock = mock.method(jwt, 'sign', () => 'fake-jwt-token');

      const { res } = await run('/api/users/authentication', { authorization: basicAuthHeader('alice', 'secret') });

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 200);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { access_token: 'fake-jwt-token' });
      assert.strictEqual(mockNext.mock.calls.length, 0);
      assert.strictEqual((signMock.mock.calls[0].arguments[2] as { expiresIn: string }).expiresIn, '7d');
    });

    it('should sign a fingerprint of the password hash, not the hash itself', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => HASHED);
      userService.verifyPassword.mock.mockImplementation(async () => true);
      const signMock = mock.method(jwt, 'sign', () => 'fake-jwt-token');

      await run('/api/users/authentication', { authorization: basicAuthHeader('alice', 'secret') });

      assert.deepStrictEqual(signMock.mock.calls[0].arguments[0], { login: 'alice', passwordFingerprint: FINGERPRINT });
      assert.strictEqual(FINGERPRINT, crypto.createHash('sha256').update(HASHED).digest('base64url'));
    });

    it('should sign the token with a lifetime derived from the configured authTokenDuration', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => HASHED);
      userService.verifyPassword.mock.mockImplementation(async () => true);
      const signMock = mock.method(jwt, 'sign', () => 'fake-jwt-token');
      oIBusService.getEngineSettings.mock.mockImplementation(() => ({ webServer: { authTokenDuration: '1h' } }) as EngineSettings);

      await run('/api/users/authentication', { authorization: basicAuthHeader('alice', 'secret') });

      assert.strictEqual((signMock.mock.calls[0].arguments[2] as { expiresIn: string }).expiresIn, '1h');
    });

    it('should return user for valid credentials on /api/users/current-user', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => HASHED);
      userService.findByLogin.mock.mockImplementation(() => FAKE_USER);
      userService.verifyPassword.mock.mockImplementation(async () => true);

      const { res } = await run('/api/users/current-user', { authorization: basicAuthHeader('alice', 'secret') });

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 200);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], FAKE_USER);
    });

    it('should return 404 when user not found on /api/users/current-user', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => HASHED);
      userService.findByLogin.mock.mockImplementation(() => null as unknown as User);
      userService.verifyPassword.mock.mockImplementation(async () => true);

      const { res } = await run('/api/users/current-user', { authorization: basicAuthHeader('alice', 'secret') });

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 404);
    });

    it('should use 403 and no WWW-Authenticate on /api/users/authentication failure', async () => {
      userService.verifyPassword.mock.mockImplementation(async () => false);

      const { res } = await run('/api/users/authentication', { authorization: basicAuthHeader('alice', 'secret') });

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
      assert.strictEqual(res.removeHeader.mock.calls.length, 1);
    });
  });

  describe('Password change required', () => {
    const MUST_CHANGE_USER: User = { ...FAKE_USER, mustChangePassword: true };

    beforeEach(() => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => HASHED);
      userService.findByLogin.mock.mockImplementation(() => MUST_CHANGE_USER);
      mock.method(jwt, 'verify', () => ({ login: 'alice', passwordFingerprint: FINGERPRINT }));
    });

    it('should refuse the other requests of a user who must change their password', async () => {
      const { res } = await run('/api/south', { authorization: bearerHeader('token') });

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { error: 'The password must be changed first', status: 403 });
      assert.strictEqual(mockNext.mock.calls.length, 0);
    });

    it('should refuse to change the password of another user', async () => {
      const { res } = await run('/api/users/other/password', { authorization: bearerHeader('token') }, undefined, {}, 'POST');

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
      assert.strictEqual(mockNext.mock.calls.length, 0);
    });

    it('should let a user who must change their password change it', async () => {
      await run('/api/users/u1/password', { authorization: bearerHeader('token') }, undefined, {}, 'POST');

      assert.strictEqual(mockNext.mock.calls.length, 1);
    });

    it('should let a user who must change their password read the OIBus information', async () => {
      await run('/api/engine/info', { authorization: bearerHeader('token') });

      assert.strictEqual(mockNext.mock.calls.length, 1);
    });

    it('should return the current user who must change their password', async () => {
      const { res } = await run('/api/users/current-user', { authorization: bearerHeader('token') });

      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], MUST_CHANGE_USER);
    });
  });

  describe('Bearer Token Auth', () => {
    it('should call next() with valid bearer token', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => HASHED);
      userService.findByLogin.mock.mockImplementation(() => FAKE_USER);
      mock.method(jwt, 'verify', () => ({ login: 'alice', passwordFingerprint: FINGERPRINT }));

      await run('/api/data', { authorization: bearerHeader('valid-token') });

      assert.strictEqual(mockNext.mock.calls.length, 1);
    });

    it('should return 403 when jwt.verify throws', async () => {
      mock.method(jwt, 'verify', () => {
        throw new Error('invalid token');
      });

      const { res } = await run('/api/data', { authorization: bearerHeader('bad-token') });

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
      assert.strictEqual(mockNext.mock.calls.length, 0);
    });

    it('should return 401 when token payload has no login', async () => {
      mock.method(jwt, 'verify', () => ({ sub: 'no-login' }));

      const { res } = await run('/api/data', { authorization: bearerHeader('token') });

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });

    it('should return 401 for a token carrying the password hash, issued before the fingerprint', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => HASHED);
      mock.method(jwt, 'verify', () => ({ login: 'alice', password: HASHED }));

      const { res } = await run('/api/data', { authorization: bearerHeader('token') });

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
      assert.strictEqual(mockNext.mock.calls.length, 0);
    });

    it('should accept the token it issued until the password changes', async () => {
      const tokenSecret = crypto.randomBytes(32);
      getTokenSecret.mock.mockImplementation(() => tokenSecret);
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => HASHED);
      userService.findByLogin.mock.mockImplementation(() => FAKE_USER);
      userService.verifyPassword.mock.mockImplementation(async () => true);

      const { res } = await run('/api/users/authentication', { authorization: basicAuthHeader('alice', 'secret') });
      const token = (res.json.mock.calls[0].arguments[0] as { access_token: string }).access_token;
      assert.ok(!Buffer.from(token.split('.')[1], 'base64url').toString().includes(HASHED));

      // signed with the secret of OIBus only
      assert.strictEqual(JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()).alg, 'HS256');
      await run('/api/data', { authorization: bearerHeader(token) });
      assert.strictEqual(mockNext.mock.calls.length, 1);

      userService.getHashedPasswordByLogin.mock.mockImplementation(() => '$argon2id$new-hash');
      const { res: afterChange } = await run('/api/data', { authorization: bearerHeader(token) });
      assert.strictEqual(afterChange.status.mock.calls[0].arguments[0], 401);
      assert.strictEqual(mockNext.mock.calls.length, 1);
    });

    it('should refuse a token signed with another secret, or with another algorithm', async () => {
      getTokenSecret.mock.mockImplementation(() => Buffer.from('token secret of OIBus'));
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => HASHED);
      const payload = { login: 'alice', passwordFingerprint: FINGERPRINT };
      const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

      for (const token of [
        jwt.sign(payload, 'another secret', { algorithm: 'HS256', issuer: 'oibus' }),
        jwt.sign(payload, privateKey, { algorithm: 'RS256', issuer: 'oibus' })
      ]) {
        const { res } = await run('/api/data', { authorization: bearerHeader(token) });
        assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
      }
      assert.strictEqual(mockNext.mock.calls.length, 0);
    });

    it('should return 401 when hashed password does not match token', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => 'different-hash');
      mock.method(jwt, 'verify', () => ({ login: 'alice', passwordFingerprint: FINGERPRINT }));

      const { res } = await run('/api/data', { authorization: bearerHeader('token') });

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });

    it('should return 401 when user not found via bearer token', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => null);
      mock.method(jwt, 'verify', () => ({ login: 'alice', passwordFingerprint: FINGERPRINT }));

      const { res } = await run('/api/data', { authorization: bearerHeader('token') });

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });
  });

  describe('Query string token', () => {
    it('should not authenticate a token passed in the query string', async () => {
      const verifySpy = mock.method(jwt, 'verify', () => ({ login: 'alice', passwordFingerprint: FINGERPRINT }));

      const { res } = await run('/api/engine/metrics', {}, '/api/engine/metrics?token=abc', { token: 'abc' });

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
      assert.strictEqual(verifySpy.mock.calls.length, 0);
      assert.strictEqual(mockNext.mock.calls.length, 0);
    });
  });

  describe('No auth provided', () => {
    it('should return 401 when no authorization header is present', async () => {
      const { res } = await run('/api/data');

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
      assert.strictEqual(mockNext.mock.calls.length, 0);
    });
  });

  describe('Unexpected errors', () => {
    it('should return 500 when an unexpected exception is thrown', async () => {
      const consoleError = mock.method(console, 'error', () => undefined);
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => {
        throw new Error('db error');
      });

      const { res } = await run('/api/data', { authorization: basicAuthHeader('alice', 'secret') });

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
      assert.strictEqual(mockNext.mock.calls.length, 0);
      assert.strictEqual(consoleError.mock.calls.length, 1);
    });
  });
});
