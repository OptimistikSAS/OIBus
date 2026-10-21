import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, type Mock, mock } from 'node:test';

import argon2 from 'argon2';
import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';

import type { EngineSettings } from '../../model/engine.model';
import type { User } from '../../model/user.model';
import type EncryptionService from '../../service/encryption.service';
import type OIBusService from '../../service/oibus.service';
import type UserService from '../../service/user.service';
import testData from '../../tests/utils/test-data';
import { createMock, Mocked } from '../../tests/utils/test-utils';
import type { CustomExpressRequest } from '../express';
import { authMiddleware } from './auth.middleware';

const basicAuthHeader = (user: string, pass: string) => 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
const bearerHeader = (token: string) => `Bearer ${token}`;

const FAKE_USER: User = { ...testData.users.list[0], id: 'u1', login: 'alice' };
const HASHED = '$argon2id$hashed';

describe('authMiddleware', () => {
  let userService: Mocked<UserService>;
  let encryptionService: Mocked<EncryptionService>;
  let oIBusService: Mocked<OIBusService>;
  let mockNext: Mock<NextFunction>;

  beforeEach(() => {
    userService = createMock<UserService>();
    encryptionService = createMock<EncryptionService>({ getPrivateKey: async () => 'privateKey' });
    oIBusService = createMock<OIBusService>({ getEngineSettings: () => ({ webServer: { authTokenDuration: '7d' } }) as EngineSettings });
    mockNext = mock.fn();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  /** Runs the middleware on a request to `path` and returns the request and the response */
  const run = async (path: string, headers: Record<string, string> = {}, url = path, query: Record<string, string> = {}) => {
    const req = createMock<CustomExpressRequest>({ path, url, headers, query });
    const res = createMock<Response>();
    res.status.mock.mockImplementation(() => res);
    await authMiddleware(userService, encryptionService, oIBusService)(req, res, mockNext);
    return { req, res };
  };

  describe('Basic Auth', () => {
    it('should call next() and set req.user on valid credentials', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => HASHED);
      userService.findByLogin.mock.mockImplementation(() => FAKE_USER);
      mock.method(argon2, 'verify', async () => true);

      const { req } = await run('/api/data', { authorization: basicAuthHeader('alice', 'secret') });

      assert.strictEqual(mockNext.mock.calls.length, 1);
      assert.deepStrictEqual(req.user, { id: 'u1', login: 'alice' });
    });

    it('should return 401 when basic-auth cannot parse the header', async () => {
      const { res } = await run('/api/data', { authorization: 'Basic ' });

      assert.strictEqual(mockNext.mock.calls.length, 0);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });

    it('should return 401 when user is not found', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => null);

      const { res } = await run('/api/data', { authorization: basicAuthHeader('unknown', 'pass') });

      assert.strictEqual(mockNext.mock.calls.length, 0);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });

    it('should return 401 when password is wrong', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => HASHED);
      mock.method(argon2, 'verify', async () => false);

      const { res } = await run('/api/data', { authorization: basicAuthHeader('alice', 'wrong') });

      assert.strictEqual(mockNext.mock.calls.length, 0);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });

    it('should return JWT token for valid credentials on /api/users/authentication', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => HASHED);
      mock.method(argon2, 'verify', async () => true);
      const signMock = mock.method(jwt, 'sign', () => 'fake-jwt-token');

      const { res } = await run('/api/users/authentication', { authorization: basicAuthHeader('alice', 'secret') });

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 200);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { access_token: 'fake-jwt-token' });
      assert.strictEqual(mockNext.mock.calls.length, 0);
      assert.strictEqual((signMock.mock.calls[0].arguments[2] as { expiresIn: string }).expiresIn, '7d');
    });

    it('should sign the token with a lifetime derived from the configured authTokenDuration', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => HASHED);
      mock.method(argon2, 'verify', async () => true);
      const signMock = mock.method(jwt, 'sign', () => 'fake-jwt-token');
      oIBusService.getEngineSettings.mock.mockImplementation(() => ({ webServer: { authTokenDuration: '1h' } }) as EngineSettings);

      await run('/api/users/authentication', { authorization: basicAuthHeader('alice', 'secret') });

      assert.strictEqual((signMock.mock.calls[0].arguments[2] as { expiresIn: string }).expiresIn, '1h');
    });

    it('should return user for valid credentials on /api/users/current-user', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => HASHED);
      userService.findByLogin.mock.mockImplementation(() => FAKE_USER);
      mock.method(argon2, 'verify', async () => true);

      const { res } = await run('/api/users/current-user', { authorization: basicAuthHeader('alice', 'secret') });

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 200);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], FAKE_USER);
    });

    it('should return 404 when user not found on /api/users/current-user', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => HASHED);
      userService.findByLogin.mock.mockImplementation(() => null as unknown as User);
      mock.method(argon2, 'verify', async () => true);

      const { res } = await run('/api/users/current-user', { authorization: basicAuthHeader('alice', 'secret') });

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 404);
    });

    it('should use 403 and no WWW-Authenticate on /api/users/authentication failure', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => null);

      const { res } = await run('/api/users/authentication', { authorization: basicAuthHeader('alice', 'secret') });

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
      assert.strictEqual(res.removeHeader.mock.calls.length, 1);
    });
  });

  describe('Bearer Token Auth', () => {
    it('should call next() with valid bearer token', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => HASHED);
      userService.findByLogin.mock.mockImplementation(() => FAKE_USER);
      mock.method(jwt, 'verify', () => ({ login: 'alice', password: HASHED }));

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

    it('should return 401 when hashed password does not match token', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => 'different-hash');
      mock.method(jwt, 'verify', () => ({ login: 'alice', password: HASHED }));

      const { res } = await run('/api/data', { authorization: bearerHeader('token') });

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });

    it('should return 401 when user not found via bearer token', async () => {
      userService.getHashedPasswordByLogin.mock.mockImplementation(() => null);
      mock.method(jwt, 'verify', () => ({ login: 'alice', password: HASHED }));

      const { res } = await run('/api/data', { authorization: bearerHeader('token') });

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });
  });

  describe('Query string token', () => {
    it('should not authenticate a token passed in the query string', async () => {
      const verifySpy = mock.method(jwt, 'verify', () => ({ login: 'alice', password: HASHED }));

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
