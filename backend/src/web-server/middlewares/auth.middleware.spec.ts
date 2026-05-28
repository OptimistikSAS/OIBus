import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { authMiddleware } from './auth.middleware';
import UserServiceMock from '../../tests/__mocks__/service/user-service.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import type UserService from '../../service/user.service';
import type EncryptionService from '../../service/encryption.service';
import type { User } from '../../model/user.model';

const basicAuthHeader = (user: string, pass: string) => 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
const bearerHeader = (token: string) => `Bearer ${token}`;

const makeRes = () => {
  const res = {
    set: mock.fn(),
    status: mock.fn(),
    json: mock.fn(),
    removeHeader: mock.fn()
  } as Record<string, ReturnType<typeof mock.fn>>;
  res.status = mock.fn(() => res);
  return res;
};

const makeReq = (path: string, headers: Record<string, string> = {}, query: Record<string, string> = {}) => ({
  path,
  url: path,
  headers,
  query
});

const FAKE_USER: User = { id: 'u1', login: 'alice' } as unknown as User;
const HASHED = '$argon2id$hashed';

describe('authMiddleware', () => {
  let userService: UserServiceMock;
  let encryptionService: EncryptionServiceMock;
  let mockNext: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    userService = new UserServiceMock();
    encryptionService = new EncryptionServiceMock();
    mockNext = mock.fn();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  type LooseMiddleware = (req: unknown, res: unknown, next: unknown) => Promise<void>;
  const buildMiddleware = () => authMiddleware(userService as unknown as UserService, encryptionService as unknown as EncryptionService) as LooseMiddleware;

  describe('Basic Auth', () => {
    it('should call next() and set req.user on valid credentials', async () => {
      userService.getHashedPasswordByLogin = mock.fn(() => HASHED);
      userService.findByLogin = mock.fn(() => FAKE_USER);
      mock.method(argon2, 'verify', async () => true);

      const req = makeReq('/api/data', { authorization: basicAuthHeader('alice', 'secret') });
      const res = makeRes();
      await buildMiddleware()(req, res, mockNext);

      assert.strictEqual(mockNext.mock.calls.length, 1);
      assert.deepStrictEqual((req as Record<string, unknown>).user, { id: 'u1', login: 'alice' });
    });

    it('should return 401 when basic-auth cannot parse the header', async () => {
      const req = makeReq('/api/data', { authorization: 'Basic ' });
      const res = makeRes();
      await buildMiddleware()(req, res, mockNext);

      assert.strictEqual(mockNext.mock.calls.length, 0);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });

    it('should return 401 when user is not found', async () => {
      userService.getHashedPasswordByLogin = mock.fn(() => null);
      const req = makeReq('/api/data', { authorization: basicAuthHeader('unknown', 'pass') });
      const res = makeRes();
      await buildMiddleware()(req, res, mockNext);

      assert.strictEqual(mockNext.mock.calls.length, 0);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });

    it('should return 401 when password is wrong', async () => {
      userService.getHashedPasswordByLogin = mock.fn(() => HASHED);
      mock.method(argon2, 'verify', async () => false);
      const req = makeReq('/api/data', { authorization: basicAuthHeader('alice', 'wrong') });
      const res = makeRes();
      await buildMiddleware()(req, res, mockNext);

      assert.strictEqual(mockNext.mock.calls.length, 0);
      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });

    it('should return JWT token for valid credentials on /api/users/authentication', async () => {
      userService.getHashedPasswordByLogin = mock.fn(() => HASHED);
      mock.method(argon2, 'verify', async () => true);
      mock.method(jwt, 'sign', () => 'fake-jwt-token');
      encryptionService.getPrivateKey = mock.fn(async () => 'privateKey');

      const req = makeReq('/api/users/authentication', { authorization: basicAuthHeader('alice', 'secret') });
      const res = makeRes();
      await buildMiddleware()(req, res, mockNext);

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 200);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], { access_token: 'fake-jwt-token' });
      assert.strictEqual(mockNext.mock.calls.length, 0);
    });

    it('should return user for valid credentials on /api/users/current-user', async () => {
      userService.getHashedPasswordByLogin = mock.fn(() => HASHED);
      userService.findByLogin = mock.fn(() => FAKE_USER);
      mock.method(argon2, 'verify', async () => true);

      const req = makeReq('/api/users/current-user', { authorization: basicAuthHeader('alice', 'secret') });
      const res = makeRes();
      await buildMiddleware()(req, res, mockNext);

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 200);
      assert.deepStrictEqual(res.json.mock.calls[0].arguments[0], FAKE_USER);
    });

    it('should return 404 when user not found on /api/users/current-user', async () => {
      userService.getHashedPasswordByLogin = mock.fn(() => HASHED);
      userService.findByLogin = mock.fn(() => null as unknown as User);
      mock.method(argon2, 'verify', async () => true);

      const req = makeReq('/api/users/current-user', { authorization: basicAuthHeader('alice', 'secret') });
      const res = makeRes();
      await buildMiddleware()(req, res, mockNext);

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 404);
    });

    it('should use 403 and no WWW-Authenticate on /api/users/authentication failure', async () => {
      userService.getHashedPasswordByLogin = mock.fn(() => null);
      const req = makeReq('/api/users/authentication', { authorization: basicAuthHeader('alice', 'secret') });
      const res = makeRes();
      await buildMiddleware()(req, res, mockNext);

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
      assert.strictEqual(res.removeHeader.mock.calls.length, 1);
    });
  });

  describe('Bearer Token Auth', () => {
    it('should call next() with valid bearer token', async () => {
      userService.getHashedPasswordByLogin = mock.fn(() => HASHED);
      userService.findByLogin = mock.fn(() => FAKE_USER);
      mock.method(jwt, 'verify', () => ({ login: 'alice', password: HASHED }));

      const req = makeReq('/api/data', { authorization: bearerHeader('valid-token') });
      const res = makeRes();
      await buildMiddleware()(req, res, mockNext);

      assert.strictEqual(mockNext.mock.calls.length, 1);
    });

    it('should return 403 when jwt.verify throws', async () => {
      mock.method(jwt, 'verify', () => {
        throw new Error('invalid token');
      });

      const req = makeReq('/api/data', { authorization: bearerHeader('bad-token') });
      const res = makeRes();
      await buildMiddleware()(req, res, mockNext);

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
      assert.strictEqual(mockNext.mock.calls.length, 0);
    });

    it('should return 401 when token payload has no login', async () => {
      mock.method(jwt, 'verify', () => ({ sub: 'no-login' }));

      const req = makeReq('/api/data', { authorization: bearerHeader('token') });
      const res = makeRes();
      await buildMiddleware()(req, res, mockNext);

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });

    it('should return 401 when hashed password does not match token', async () => {
      userService.getHashedPasswordByLogin = mock.fn(() => 'different-hash');
      mock.method(jwt, 'verify', () => ({ login: 'alice', password: HASHED }));

      const req = makeReq('/api/data', { authorization: bearerHeader('token') });
      const res = makeRes();
      await buildMiddleware()(req, res, mockNext);

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });

    it('should return 401 when user not found via bearer token', async () => {
      userService.getHashedPasswordByLogin = mock.fn(() => null);
      mock.method(jwt, 'verify', () => ({ login: 'alice', password: HASHED }));

      const req = makeReq('/api/data', { authorization: bearerHeader('token') });
      const res = makeRes();
      await buildMiddleware()(req, res, mockNext);

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });
  });

  describe('SSE Token Auth', () => {
    it('should call next() with valid SSE token', async () => {
      userService.getHashedPasswordByLogin = mock.fn(() => HASHED);
      userService.findByLogin = mock.fn(() => FAKE_USER);
      mock.method(jwt, 'verify', () => ({ login: 'alice', password: HASHED }));

      const req = { ...makeReq('/sse/engine'), url: '/sse/engine?token=abc', query: { token: 'abc' } };
      const res = makeRes();
      await buildMiddleware()(req, res, mockNext);

      assert.strictEqual(mockNext.mock.calls.length, 1);
    });

    it('should return 403 when SSE jwt.verify throws', async () => {
      mock.method(jwt, 'verify', () => {
        throw new Error('expired');
      });

      const req = { ...makeReq('/sse/engine'), url: '/sse/engine?token=bad', query: { token: 'bad' } };
      const res = makeRes();
      await buildMiddleware()(req, res, mockNext);

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 403);
    });

    it('should return 401 when SSE token has no login', async () => {
      mock.method(jwt, 'verify', () => ({ sub: 'no-login' }));

      const req = { ...makeReq('/sse/engine'), url: '/sse/engine?token=t', query: { token: 't' } };
      const res = makeRes();
      await buildMiddleware()(req, res, mockNext);

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
    });
  });

  describe('No auth provided', () => {
    it('should return 401 when no authorization header is present', async () => {
      const req = makeReq('/api/data');
      const res = makeRes();
      await buildMiddleware()(req, res, mockNext);

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 401);
      assert.strictEqual(mockNext.mock.calls.length, 0);
    });
  });

  describe('Unexpected errors', () => {
    it('should return 500 when an unexpected exception is thrown', async () => {
      userService.getHashedPasswordByLogin = mock.fn(() => {
        throw new Error('db error');
      });
      const req = makeReq('/api/data', { authorization: basicAuthHeader('alice', 'secret') });
      const res = makeRes();
      await buildMiddleware()(req, res, mockNext);

      assert.strictEqual(res.status.mock.calls[0].arguments[0], 500);
      assert.strictEqual(mockNext.mock.calls.length, 0);
    });
  });
});
