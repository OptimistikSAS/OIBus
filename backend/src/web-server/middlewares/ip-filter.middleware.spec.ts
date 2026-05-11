import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mockModule, reloadModule } from '../../tests/utils/test-utils';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type IpFilterMiddlewareType from './ip-filter.middleware';

const nodeRequire = createRequire(import.meta.url);

let mockUtils: Record<string, ReturnType<typeof mock.fn>>;
let IpFilterMiddleware: typeof IpFilterMiddlewareType;

before(() => {
  mockUtils = { testIPOnFilter: mock.fn(() => true) };
  mockModule(nodeRequire, '../../service/utils', mockUtils);
  const mod = reloadModule<{ default: typeof IpFilterMiddlewareType }>(nodeRequire, './ip-filter.middleware');
  IpFilterMiddleware = mod.default;
});

describe('IpFilterMiddleware', () => {
  let logger: PinoLogger;
  let mockReq: { ip: string };
  let mockRes: { status: ReturnType<typeof mock.fn>; send: ReturnType<typeof mock.fn> };
  let mockNext: ReturnType<typeof mock.fn>;

  beforeEach(() => {
    logger = new PinoLogger();
    mockReq = { ip: '192.168.1.1' };
    mockRes = { status: mock.fn(), send: mock.fn() };
    mockRes.status = mock.fn(() => mockRes);
    mockNext = mock.fn();
    mockUtils.testIPOnFilter = mock.fn(() => true);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should call next() when IP filters are disabled', () => {
    const middleware = new IpFilterMiddleware([], logger, true);

    middleware.middleware()(mockReq as any, mockRes as any, mockNext as any);

    assert.strictEqual(mockNext.mock.calls.length, 1);
    assert.strictEqual(mockUtils.testIPOnFilter.mock.calls.length, 0);
  });

  it('should call next() when the IP is on the whitelist', () => {
    mockUtils.testIPOnFilter = mock.fn(() => true);
    const middleware = new IpFilterMiddleware(['192.168.1.0/24'], logger, false);

    middleware.middleware()(mockReq as any, mockRes as any, mockNext as any);

    assert.strictEqual(mockNext.mock.calls.length, 1);
    assert.strictEqual(mockUtils.testIPOnFilter.mock.calls.length, 1);
    assert.deepStrictEqual(mockUtils.testIPOnFilter.mock.calls[0].arguments, [['192.168.1.0/24'], '192.168.1.1']);
  });

  it('should return 401 and log error when IP is not on the whitelist', () => {
    mockUtils.testIPOnFilter = mock.fn(() => false);
    const middleware = new IpFilterMiddleware(['10.0.0.0/8'], logger, false);

    middleware.middleware()(mockReq as any, mockRes as any, mockNext as any);

    assert.strictEqual(mockNext.mock.calls.length, 0);
    assert.strictEqual(mockRes.status.mock.calls[0].arguments[0], 401);
    assert.strictEqual(mockRes.send.mock.calls.length, 1);
    assert.ok((mockRes.send.mock.calls[0].arguments[0] as string).includes('192.168.1.1'));
    assert.strictEqual((logger.error as ReturnType<typeof mock.fn>).mock.calls.length, 1);
  });

  it('should return 401 when req.ip is undefined and IP is not on whitelist', () => {
    mockUtils.testIPOnFilter = mock.fn(() => false);
    const reqWithoutIp = { ip: undefined };
    const middleware = new IpFilterMiddleware([], logger, false);

    middleware.middleware()(reqWithoutIp as any, mockRes as any, mockNext as any);

    assert.strictEqual(mockNext.mock.calls.length, 0);
    assert.strictEqual(mockRes.status.mock.calls[0].arguments[0], 401);
  });
});
