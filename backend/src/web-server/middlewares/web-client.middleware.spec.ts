import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mockModule, reloadModule } from '../../tests/utils/test-utils';

const nodeRequire = createRequire(import.meta.url);

const staticMiddlewareMock = mock.fn();
const staticFactoryMock = mock.fn(() => staticMiddlewareMock);
let webClientMiddleware: () => (req: unknown, res: unknown, next: unknown) => void;

before(() => {
  mockModule(nodeRequire, 'express', { static: staticFactoryMock });
  const mod = reloadModule<{ default: typeof webClientMiddleware }>(nodeRequire, './web-client.middleware');
  webClientMiddleware = mod.default;
});

describe('webClientMiddleware', () => {
  let mockNext: ReturnType<typeof mock.fn>;
  let mockRes: { sendFile: ReturnType<typeof mock.fn> };

  beforeEach(() => {
    mockNext = mock.fn();
    mockRes = { sendFile: mock.fn() };
    staticMiddlewareMock.mock.resetCalls();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  const makeReq = (method: string, path: string) => ({ method, path });

  it('should delegate static file requests to express.static', () => {
    const middleware = webClientMiddleware();
    const req = makeReq('GET', '/assets/app.js');

    middleware(req, mockRes, mockNext);

    assert.strictEqual(staticMiddlewareMock.mock.calls.length, 1);
    assert.strictEqual(mockRes.sendFile.mock.calls.length, 0);
    assert.strictEqual(mockNext.mock.calls.length, 0);
  });

  it('should serve index.html for non-API GET requests', () => {
    const middleware = webClientMiddleware();
    const req = makeReq('GET', '/south/connectors');

    middleware(req, mockRes, mockNext);

    assert.strictEqual(mockRes.sendFile.mock.calls.length, 1);
    assert.ok((mockRes.sendFile.mock.calls[0].arguments[0] as string).endsWith('index.html'));
    assert.strictEqual(mockNext.mock.calls.length, 0);
  });

  it('should call next() for API paths', () => {
    const middleware = webClientMiddleware();
    const req = makeReq('GET', '/api/engine');

    middleware(req, mockRes, mockNext);

    assert.strictEqual(mockNext.mock.calls.length, 1);
    assert.strictEqual(mockRes.sendFile.mock.calls.length, 0);
  });

  it('should call next() for SSE paths', () => {
    const middleware = webClientMiddleware();
    const req = makeReq('GET', '/sse/engine');

    middleware(req, mockRes, mockNext);

    assert.strictEqual(mockNext.mock.calls.length, 1);
  });

  it('should call next() for non-GET requests to non-static paths', () => {
    const middleware = webClientMiddleware();
    const req = makeReq('POST', '/some-path');

    middleware(req, mockRes, mockNext);

    assert.strictEqual(mockNext.mock.calls.length, 1);
  });

  it('should serve static files matching various extensions', () => {
    const middleware = webClientMiddleware();
    const extensions = ['app.css', 'logo.png', 'icon.ico', 'font.woff2', 'app.js.map'];

    for (const ext of extensions) {
      const req = makeReq('GET', `/${ext}`);
      staticMiddlewareMock.mock.resetCalls();
      middleware(req, mockRes, mockNext);
      assert.strictEqual(staticMiddlewareMock.mock.calls.length, 1, `Expected static for ${ext}`);
    }
  });
});
