import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import net from 'node:net';
import { afterEach, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type httpProxy from 'http-proxy';

import type { EngineSettings } from '../model/engine.model';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';
import { createMock, flushPromises, Mocked, mockModule, reloadModule } from '../tests/utils/test-utils';
import type ProxyServerClass from './proxy-server';

const nodeRequire = createRequire(import.meta.url);

// These objects stay the same for the whole file (the SUT keeps them): their functions are replaced in beforeEach
const utilsExports: { testIPOnFilter: Mock<(ipFilters: Array<string>, ip: string) => boolean> } = { testIPOnFilter: mock.fn() };
const httpProxyExports = { __esModule: true, default: { createProxyServer: mock.fn<() => Mocked<httpProxy>>() } };
// argon2.verify treats the stored password as plain text
const argon2Exports = { __esModule: true, default: { verify: mock.fn<(hash: string, plain: string) => Promise<boolean>>() } };
// The forward proxy password is decrypted as a pass-through
const encryptionExports = { __esModule: true, encryptionService: { decryptText: (pass: string | null | undefined) => pass ?? '' } };
let logger: PinoLogger;

mockModule(nodeRequire, 'http-proxy', httpProxyExports);
mockModule(nodeRequire, '../service/utils', utilsExports);
mockModule(nodeRequire, '../service/logger/logger.service', { loggerService: { createChildLogger: () => logger }, default: class {} });
mockModule(nodeRequire, 'argon2', argon2Exports);
mockModule(nodeRequire, '../service/encryption.service', encryptionExports);
const { default: ProxyServer } = reloadModule<{ default: typeof ProxyServerClass }>(nodeRequire, './proxy-server');

const baseProxySettings: EngineSettings['proxyServer'] = {
  enabled: true,
  port: 9000,
  forward: { enabled: false, url: null, username: null, password: null },
  username: null,
  password: null
};
const withForward = (url: string, username: string | null = null, password: string | null = null): EngineSettings['proxyServer'] => ({
  ...baseProxySettings,
  forward: { enabled: true, url, username, password }
});
const withAuth: EngineSettings['proxyServer'] = { ...baseProxySettings, username: 'admin', password: 'secret' };
const basicAuth = (credentials: string) => ({ 'proxy-authorization': `Basic ${Buffer.from(credentials).toString('base64')}` });
const PROXY_AUTH_REQUIRED = 'HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="OIBus Proxy"\r\n\r\n';

const buildRequest = (
  method: string,
  url: string,
  { remoteAddress = '127.0.0.1', headers = {} }: { remoteAddress?: string | null; headers?: http.IncomingHttpHeaders } = {}
) =>
  createMock<http.IncomingMessage>({
    method,
    url,
    headers,
    httpVersion: '1.1',
    socket: createMock<net.Socket>({ remoteAddress: remoteAddress ?? undefined })
  });

const buildSocket = () => createMock<net.Socket>({ pipe: destination => destination });

/** The listener registered with `on(event, …)` on a mocked emitter. */
const listener = (emitter: { on: Mock<(...args: Array<never>) => unknown> }, event: string) =>
  emitter.on.mock.calls.find(call => call.arguments[0] === event)!.arguments[1] as (...args: Array<unknown>) => void;

/** Mocks net.createConnection to return `socket`; `connected()` runs the connection listener given by the SUT. */
const mockCreateConnection = (socket: Mocked<net.Socket>) => {
  const createConnection = mock.method(net, 'createConnection', (_options: net.NetConnectOpts, _listener: () => void) => socket);
  return { createConnection, connected: () => (createConnection.mock.calls[0].arguments[1] as () => void)() };
};

describe('ProxyServer', () => {
  let proxyServer: ProxyServerClass;
  let webServer: Mocked<http.Server>;
  let listen: Mock<(port: number, callback: () => void) => http.Server>;
  let createServer: Mock<() => unknown>;

  beforeEach(() => {
    logger = new PinoLogger();
    utilsExports.testIPOnFilter = mock.fn(() => true);
    httpProxyExports.default.createProxyServer = mock.fn(() => createMock<httpProxy>());
    argon2Exports.default.verify = mock.fn(async (hash: string, plain: string) => hash === plain);

    webServer = createMock<http.Server>();
    listen = mock.fn((_port: number, callback: () => void) => {
      callback();
      return webServer;
    });
    createServer = mock.method(http, 'createServer', () => ({ listen }));

    proxyServer = new ProxyServer(false);
    proxyServer['settings'] = { ...baseProxySettings };
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should initialize with default IP filters', () => {
    assert.deepStrictEqual(proxyServer['ipFilters'], []);
  });

  it('should update IP filters', () => {
    proxyServer.refreshIpFilters(['192.168.0.1', '10.0.0.1']);
    assert.deepStrictEqual(proxyServer['ipFilters'], ['192.168.0.1', '10.0.0.1']);
  });

  it('should initialize HTTP proxy and webserver on start', () => {
    proxyServer.start({ ...baseProxySettings, port: 9000 });

    assert.strictEqual(httpProxyExports.default.createProxyServer.mock.calls.length, 1);
    assert.strictEqual(createServer.mock.calls.length, 1);
    assert.strictEqual(listen.mock.calls.length, 1);
    assert.deepStrictEqual(listen.mock.calls[0].arguments[0], 9000);
    assert.strictEqual(logger.info.mock.calls.length, 1);
    assert.deepStrictEqual(logger.info.mock.calls[0].arguments, ['Start proxy server on port 9000.']);
  });

  it('should not initialize HTTP proxy and webserver when disabled', () => {
    proxyServer.start({ ...baseProxySettings, enabled: false });

    assert.strictEqual(httpProxyExports.default.createProxyServer.mock.calls.length, 0);
    assert.strictEqual(createServer.mock.calls.length, 0);
  });

  it('should store settings on start', () => {
    const settings: EngineSettings['proxyServer'] = { ...baseProxySettings, username: 'user', password: 'pass' };
    proxyServer.start(settings);
    assert.deepStrictEqual(proxyServer['settings'], settings);
  });

  it('should stop the webserver', () => {
    proxyServer['webServer'] = webServer;

    proxyServer.stop();

    assert.strictEqual(webServer.close.mock.calls.length, 1);
  });

  it("should not stop if webserver wasn't started", () => {
    const mockClose = mock.fn();
    proxyServer.stop();
    assert.strictEqual(mockClose.mock.calls.length, 0);
  });

  it('should allow http requests from whitelisted IPs', async () => {
    const mockReq = buildRequest('GET', 'http://example.com');
    const mockRes = createMock<http.ServerResponse>();
    const mockHttpProxy = createMock<httpProxy>();
    proxyServer['httpProxy'] = mockHttpProxy;

    await proxyServer['handleHttpRequest'](mockReq, mockRes);

    assert.strictEqual(mockRes.writeHead.mock.calls.length, 0);
    assert.strictEqual(mockRes.end.mock.calls.length, 0);
    assert.strictEqual(mockHttpProxy.web.mock.calls.length, 1);
    assert.strictEqual(mockHttpProxy.web.mock.calls[0].arguments[0], mockReq);
    assert.strictEqual(mockHttpProxy.web.mock.calls[0].arguments[1], mockRes);
    assert.deepStrictEqual(mockHttpProxy.web.mock.calls[0].arguments[2], { target: 'http://example.com' });
    assert.strictEqual(typeof mockHttpProxy.web.mock.calls[0].arguments[3], 'function');
  });

  it('should block http requests from non-whitelisted IPs', async () => {
    utilsExports.testIPOnFilter.mock.mockImplementationOnce(() => false);
    proxyServer.refreshIpFilters(['*.*.*.*']);
    const mockReq = buildRequest('GET', 'http://example.com', { remoteAddress: '192.168.0.1' });
    const mockRes = createMock<http.ServerResponse>();

    await proxyServer['handleHttpRequest'](mockReq, mockRes);

    assert.strictEqual(utilsExports.testIPOnFilter.mock.calls.length, 1);
    assert.deepStrictEqual(utilsExports.testIPOnFilter.mock.calls[0].arguments, [['*.*.*.*'], mockReq.socket.remoteAddress]);
    assert.deepStrictEqual(mockRes.writeHead.mock.calls[0].arguments, [403, { 'Content-Type': 'text/plain' }]);
    assert.deepStrictEqual(mockRes.end.mock.calls[0].arguments, ['Forbidden']);
  });

  it('should block http requests if remote address is not provided', async () => {
    const mockRes = createMock<http.ServerResponse>();

    await proxyServer['handleHttpRequest'](buildRequest('GET', 'example.com', { remoteAddress: null }), mockRes);

    assert.deepStrictEqual(mockRes.writeHead.mock.calls[0].arguments, [403, { 'Content-Type': 'text/plain' }]);
    assert.deepStrictEqual(mockRes.end.mock.calls[0].arguments, ['Forbidden']);
  });

  it('should allow https requests from whitelisted IPs', async () => {
    const clientSocket = buildSocket();
    const targetSocket = buildSocket();
    const { createConnection, connected } = mockCreateConnection(targetSocket);

    await proxyServer['handleHttpsRequest'](buildRequest('CONNECT', 'example.com:443'), clientSocket, Buffer.from(''));
    connected();

    assert.strictEqual(createConnection.mock.calls.length, 1);
    assert.deepStrictEqual(createConnection.mock.calls[0].arguments[0], { host: 'example.com', port: 443 });
    assert.deepStrictEqual(targetSocket.write.mock.calls[0].arguments[0], Buffer.from(''));
    assert.deepStrictEqual(clientSocket.write.mock.calls[0].arguments[0], 'HTTP/1.1 200 Connection established\r\n\r\n');
    assert.strictEqual(clientSocket.pipe.mock.calls[0].arguments[0], targetSocket);
    assert.strictEqual(targetSocket.pipe.mock.calls[0].arguments[0], clientSocket);
    assert.strictEqual(targetSocket.on.mock.calls[0].arguments[0], 'error');
    assert.strictEqual(clientSocket.on.mock.calls[0].arguments[0], 'error');
  });

  it('should block https requests from non-whitelisted IPs', async () => {
    utilsExports.testIPOnFilter.mock.mockImplementationOnce(() => false);
    const mockReq = buildRequest('CONNECT', 'example.com:443', { remoteAddress: '192.168.0.1' });
    const clientSocket = buildSocket();

    await proxyServer['handleHttpsRequest'](mockReq, clientSocket, Buffer.from(''));

    assert.strictEqual(utilsExports.testIPOnFilter.mock.calls.length, 1);
    assert.deepStrictEqual(utilsExports.testIPOnFilter.mock.calls[0].arguments, [[], mockReq.socket.remoteAddress]);
    assert.deepStrictEqual(clientSocket.write.mock.calls[0].arguments[0], 'HTTP/1.1 403 Forbidden\r\n\r\n');
    assert.strictEqual(clientSocket.end.mock.calls.length, 1);
  });

  it('should handle webserver errors', () => {
    proxyServer.start({ ...baseProxySettings, port: 9000 });

    listener(webServer, 'error')(new Error('proxy error'));

    assert.strictEqual(logger.error.mock.calls.length, 1);
    assert.deepStrictEqual(logger.error.mock.calls[0].arguments, ['proxy error']);
  });

  it('should handle httpProxy errors', async () => {
    const error = new Error();
    proxyServer['httpProxy'] = createMock<httpProxy>({
      web: (_req, _res, _options, callback) => callback!(error, _req, _res)
    });

    await proxyServer['handleHttpRequest'](buildRequest('GET', 'example.com:443'), createMock<http.ServerResponse>());

    assert.strictEqual(logger.error.mock.calls.length, 1);
    assert.deepStrictEqual(logger.error.mock.calls[0].arguments, [`Proxy server error ${error}`]);
  });

  it('should only call httpProxy if the proxy server has been started', async () => {
    const mockWeb = mock.fn();

    // httpProxy is null (not started), so web should never be called
    await proxyServer['handleHttpRequest'](buildRequest('GET', 'example.com:443'), createMock<http.ServerResponse>());

    assert.strictEqual(mockWeb.mock.calls.length, 0);
  });

  it('should handle https socket errors', async () => {
    const error = new Error('error');
    const mockReq = buildRequest('CONNECT', 'example.com:443');
    const clientSocket = buildSocket();
    const targetSocket = buildSocket();
    const { createConnection, connected } = mockCreateConnection(targetSocket);

    await proxyServer['handleHttpsRequest'](mockReq, clientSocket, Buffer.from(''));
    connected();

    assert.strictEqual(createConnection.mock.calls.length, 1);
    assert.deepStrictEqual(createConnection.mock.calls[0].arguments[0], { host: 'example.com', port: 443 });
    assert.deepStrictEqual(targetSocket.write.mock.calls[0].arguments[0], Buffer.from(''));
    assert.deepStrictEqual(clientSocket.write.mock.calls[0].arguments[0], 'HTTP/1.1 200 Connection established\r\n\r\n');
    assert.strictEqual(clientSocket.pipe.mock.calls[0].arguments[0], targetSocket);
    assert.strictEqual(targetSocket.pipe.mock.calls[0].arguments[0], clientSocket);
    assert.strictEqual(targetSocket.on.mock.calls[0].arguments[0], 'error');
    assert.strictEqual(clientSocket.on.mock.calls[0].arguments[0], 'error');

    // target socket error triggers logger and client socket cleanup
    listener(targetSocket, 'error')(error);
    assert.deepStrictEqual(logger.error.mock.calls[0].arguments, [`Proxy server error on target socket: ${error.message}`]);
    assert.deepStrictEqual(clientSocket.write.mock.calls[1].arguments[0], `HTTP/${mockReq.httpVersion} 500 Connection error\r\n\r\n`);
    assert.strictEqual(clientSocket.end.mock.calls.length, 1);

    // client socket error triggers logger and target socket cleanup
    listener(clientSocket, 'error')(error);
    assert.deepStrictEqual(logger.error.mock.calls[1].arguments, [`Proxy server error on client socket: ${error.message}`]);
    assert.strictEqual(targetSocket.end.mock.calls.length, 1);
  });

  it('should allow bad ip if ignoreIpFilter is set to true', async () => {
    proxyServer = new ProxyServer(true);
    proxyServer['settings'] = { ...baseProxySettings };
    const clientSocket = buildSocket();
    const targetSocket = buildSocket();
    const { createConnection, connected } = mockCreateConnection(targetSocket);

    await proxyServer['handleHttpsRequest'](
      buildRequest('CONNECT', 'example.com:443', { remoteAddress: null }),
      clientSocket,
      Buffer.from('')
    );
    connected();

    assert.strictEqual(createConnection.mock.calls.length, 1);
    assert.deepStrictEqual(createConnection.mock.calls[0].arguments[0], { host: 'example.com', port: 443 });
    assert.deepStrictEqual(targetSocket.write.mock.calls[0].arguments[0], Buffer.from(''));
    assert.deepStrictEqual(clientSocket.write.mock.calls[0].arguments[0], 'HTTP/1.1 200 Connection established\r\n\r\n');
  });

  it('should catch error on connection error', async () => {
    proxyServer = new ProxyServer(true);
    proxyServer['settings'] = { ...baseProxySettings };
    const createConnection = mock.method(net, 'createConnection', () => {
      throw new Error('connection error');
    });

    await proxyServer['handleHttpsRequest'](
      buildRequest('CONNECT', 'example.com:443', { remoteAddress: null }),
      buildSocket(),
      Buffer.from('')
    );

    assert.strictEqual(createConnection.mock.calls.length, 1);
    assert.deepStrictEqual(logger.error.mock.calls[0].arguments, ['Proxy server error: connection error']);
  });

  describe('with an upstream proxy', () => {
    let upstreamRequest: Mocked<http.ClientRequest>;
    let request: Mock<(options: http.RequestOptions, callback?: (res: unknown) => void) => http.ClientRequest>;

    beforeEach(() => {
      upstreamRequest = createMock<http.ClientRequest>();
      request = mock.method(http, 'request', (_options: http.RequestOptions, _callback?: (res: unknown) => void) => upstreamRequest);
    });

    it('should forward http requests to upstream proxy', async () => {
      proxyServer['settings'] = withForward('http://upstream-proxy:3128');
      const mockReq = buildRequest('GET', 'http://example.com/', { headers: { host: 'example.com' } });
      const mockRes = createMock<http.ServerResponse>();

      await proxyServer['handleHttpRequest'](mockReq, mockRes);

      assert.strictEqual(request.mock.calls.length, 1);
      const opts = request.mock.calls[0].arguments[0];
      assert.strictEqual(opts.host, 'upstream-proxy');
      assert.strictEqual(opts.port, 3128);
      assert.strictEqual(opts.method, 'GET');
      assert.strictEqual(opts.path, 'http://example.com/');
      assert.strictEqual((opts.headers as Record<string, string>)['Proxy-Authorization'], undefined);
      assert.strictEqual(mockReq.pipe.mock.calls[0].arguments[0], upstreamRequest);

      const upstreamResponse = { statusCode: 200, headers: { 'content-type': 'text/html' }, pipe: mock.fn() };
      request.mock.calls[0].arguments[1]!(upstreamResponse);
      assert.deepStrictEqual(mockRes.writeHead.mock.calls[0].arguments, [200, { 'content-type': 'text/html' }]);
      assert.strictEqual(upstreamResponse.pipe.mock.calls[0].arguments[0], mockRes);
    });

    it('should forward http requests to upstream proxy with credentials', async () => {
      proxyServer['settings'] = withForward('http://upstream-proxy:3128', 'user', 'pass');

      await proxyServer['handleHttpRequest'](buildRequest('GET', 'http://example.com/'), createMock<http.ServerResponse>());

      const opts = request.mock.calls[0].arguments[0];
      const expectedCred = Buffer.from('user:pass').toString('base64');
      assert.strictEqual((opts.headers as Record<string, string>)['Proxy-Authorization'], `Basic ${expectedCred}`);
    });

    it('should handle upstream proxy http error', async () => {
      proxyServer['settings'] = withForward('http://upstream-proxy:3128');
      const mockRes = createMock<http.ServerResponse>();

      await proxyServer['handleHttpRequest'](buildRequest('GET', 'http://example.com/'), mockRes);
      listener(upstreamRequest, 'error')(new Error('upstream failed'));

      assert.deepStrictEqual(logger.error.mock.calls[0].arguments, ['Upstream proxy error: upstream failed']);
      assert.deepStrictEqual(mockRes.writeHead.mock.calls[0].arguments, [502]);
      assert.strictEqual(mockRes.end.mock.calls.length, 1);
    });

    it('should handle malformed upstream proxy URL for http forwarding', async () => {
      proxyServer['settings'] = withForward('not-a-valid-url');
      const mockRes = createMock<http.ServerResponse>();

      await proxyServer['handleHttpRequest'](buildRequest('GET', 'http://example.com/'), mockRes);

      assert.deepStrictEqual(logger.error.mock.calls[0].arguments, ['Proxy server error: Invalid URL']);
      assert.deepStrictEqual(mockRes.writeHead.mock.calls[0].arguments, [500]);
      assert.strictEqual(mockRes.end.mock.calls.length, 1);
    });

    it('should default upstream http proxy port to 80 when not specified', async () => {
      proxyServer['settings'] = withForward('http://upstream-proxy');

      await proxyServer['handleHttpRequest'](buildRequest('GET', 'http://example.com/'), createMock<http.ServerResponse>());

      assert.strictEqual(request.mock.calls[0].arguments[0].port, 80);
    });

    it('should forward https CONNECT to upstream proxy and pipe on 200', async () => {
      proxyServer['settings'] = withForward('http://upstream-proxy:3128');
      const clientSocket = buildSocket();
      const upstreamSocket = buildSocket();
      const { createConnection, connected } = mockCreateConnection(upstreamSocket);

      await proxyServer['handleHttpsRequest'](buildRequest('CONNECT', 'example.com:443'), clientSocket, Buffer.from(''));

      assert.deepStrictEqual(createConnection.mock.calls[0].arguments[0], { host: 'upstream-proxy', port: 3128 });
      connected();
      assert.deepStrictEqual(
        upstreamSocket.write.mock.calls[0].arguments[0],
        'CONNECT example.com:443 HTTP/1.1\r\nHost: example.com:443\r\n\r\n'
      );

      listener(upstreamSocket, 'data')(Buffer.from('HTTP/1.1 200 Connection established\r\n\r\n'));

      assert.ok(upstreamSocket.removeListener.mock.calls.length > 0);
      assert.deepStrictEqual(clientSocket.write.mock.calls[0].arguments[0], 'HTTP/1.1 200 Connection established\r\n\r\n');
      assert.strictEqual(clientSocket.pipe.mock.calls[0].arguments[0], upstreamSocket);
      assert.strictEqual(upstreamSocket.pipe.mock.calls[0].arguments[0], clientSocket);
    });

    it('should handle upstream proxy rejection of CONNECT', async () => {
      proxyServer['settings'] = withForward('http://upstream-proxy:3128');
      const clientSocket = buildSocket();
      const upstreamSocket = buildSocket();
      const { connected } = mockCreateConnection(upstreamSocket);

      await proxyServer['handleHttpsRequest'](buildRequest('CONNECT', 'example.com:443'), clientSocket, Buffer.from(''));
      connected();
      listener(upstreamSocket, 'data')(Buffer.from('HTTP/1.1 407 Proxy Auth Required\r\n\r\n'));

      assert.strictEqual(logger.error.mock.calls.length, 1);
      assert.deepStrictEqual(clientSocket.write.mock.calls[0].arguments[0], 'HTTP/1.1 502 Bad Gateway\r\n\r\n');
      assert.strictEqual(clientSocket.end.mock.calls.length, 1);
      assert.strictEqual(upstreamSocket.end.mock.calls.length, 1);
    });

    it('should handle upstream proxy socket error on HTTPS CONNECT', async () => {
      proxyServer['settings'] = withForward('http://upstream-proxy:3128');
      const clientSocket = buildSocket();
      const upstreamSocket = buildSocket();
      mockCreateConnection(upstreamSocket);

      await proxyServer['handleHttpsRequest'](buildRequest('CONNECT', 'example.com:443'), clientSocket, Buffer.from(''));
      listener(upstreamSocket, 'error')(new Error('upstream socket failed'));

      assert.deepStrictEqual(logger.error.mock.calls[0].arguments, ['Upstream proxy socket error: upstream socket failed']);
      assert.deepStrictEqual(clientSocket.write.mock.calls[0].arguments[0], 'HTTP/1.1 502 Bad Gateway\r\n\r\n');
      assert.strictEqual(clientSocket.end.mock.calls.length, 1);
      assert.ok(upstreamSocket.removeListener.mock.calls.length > 0);
    });

    it('should handle malformed upstream proxy URL for https CONNECT forwarding', async () => {
      proxyServer['settings'] = withForward('not-a-valid-url');

      await proxyServer['handleHttpsRequest'](buildRequest('CONNECT', 'example.com:443'), buildSocket(), Buffer.from(''));

      assert.deepStrictEqual(logger.error.mock.calls[0].arguments, ['Proxy server error: Invalid URL']);
    });

    it('should default upstream https proxy port to 80 when not specified and add credentials', async () => {
      proxyServer['settings'] = withForward('http://upstream-proxy', 'user', 'pass');
      const upstreamSocket = buildSocket();
      const { createConnection, connected } = mockCreateConnection(upstreamSocket);

      await proxyServer['handleHttpsRequest'](buildRequest('CONNECT', 'example.com:443'), buildSocket(), Buffer.from(''));
      connected();

      assert.strictEqual((createConnection.mock.calls[0].arguments[0] as net.TcpNetConnectOpts).port, 80);
      const expectedCred = Buffer.from('user:pass').toString('base64');
      assert.deepStrictEqual(
        upstreamSocket.write.mock.calls[0].arguments[0],
        ['CONNECT example.com:443 HTTP/1.1', 'Host: example.com:443', `Proxy-Authorization: Basic ${expectedCred}`, '', ''].join('\r\n')
      );
    });

    it('should buffer partial header chunks before evaluating upstream CONNECT response', async () => {
      proxyServer['settings'] = withForward('http://upstream-proxy:3128');
      const clientSocket = buildSocket();
      const upstreamSocket = buildSocket();
      mockCreateConnection(upstreamSocket);

      await proxyServer['handleHttpsRequest'](buildRequest('CONNECT', 'example.com:443'), clientSocket, Buffer.from(''));
      const onData = listener(upstreamSocket, 'data');

      // First partial chunk without a full header terminator: should be buffered, not acted upon
      onData(Buffer.from('HTTP/1.1 200 Connection'));
      assert.strictEqual(upstreamSocket.removeListener.mock.calls.length, 0);
      assert.strictEqual(clientSocket.write.mock.calls.length, 0);

      // Second chunk completes the header
      onData(Buffer.from(' established\r\n\r\n'));
      assert.strictEqual(upstreamSocket.removeListener.mock.calls.length, 1);
      assert.deepStrictEqual(clientSocket.write.mock.calls[0].arguments[0], 'HTTP/1.1 200 Connection established\r\n\r\n');
    });

    it('should end upstream socket when the client socket errors during https forwarding', async () => {
      proxyServer['settings'] = withForward('http://upstream-proxy:3128');
      const clientSocket = buildSocket();
      const upstreamSocket = buildSocket();
      mockCreateConnection(upstreamSocket);

      await proxyServer['handleHttpsRequest'](buildRequest('CONNECT', 'example.com:443'), clientSocket, Buffer.from(''));
      listener(clientSocket, 'error')(new Error('client socket failed'));

      assert.deepStrictEqual(logger.error.mock.calls[0].arguments, ['Proxy server error on client socket: client socket failed']);
      assert.strictEqual(upstreamSocket.end.mock.calls.length, 1);
    });
  });

  describe('proxy authentication', () => {
    it('should allow http request when proxy auth is not configured', async () => {
      // proxyServer.username is null by default — no auth check
      const mockHttpProxy = createMock<httpProxy>();
      proxyServer['httpProxy'] = mockHttpProxy;
      const mockRes = createMock<http.ServerResponse>();

      await proxyServer['handleHttpRequest'](buildRequest('GET', 'http://example.com'), mockRes);

      assert.strictEqual(mockHttpProxy.web.mock.calls.length, 1);
      assert.strictEqual(mockRes.writeHead.mock.calls.length, 0);
    });

    it('should allow http request with valid proxy credentials', async () => {
      proxyServer['settings'] = withAuth;
      const mockHttpProxy = createMock<httpProxy>();
      proxyServer['httpProxy'] = mockHttpProxy;
      const mockRes = createMock<http.ServerResponse>();

      await proxyServer['handleHttpRequest'](buildRequest('GET', 'http://example.com', { headers: basicAuth('admin:secret') }), mockRes);

      assert.strictEqual(mockHttpProxy.web.mock.calls.length, 1);
      assert.strictEqual(mockRes.writeHead.mock.calls.length, 0);
    });

    it('should block http request with missing Proxy-Authorization header', async () => {
      proxyServer['settings'] = withAuth;
      const mockRes = createMock<http.ServerResponse>();

      await proxyServer['handleHttpRequest'](buildRequest('GET', 'http://example.com'), mockRes);

      assert.deepStrictEqual(mockRes.writeHead.mock.calls[0].arguments, [407, { 'Proxy-Authenticate': 'Basic realm="OIBus Proxy"' }]);
      assert.deepStrictEqual(mockRes.end.mock.calls[0].arguments, ['Proxy Authentication Required']);
    });

    it('should block http request with wrong proxy credentials', async () => {
      proxyServer['settings'] = withAuth;
      const mockRes = createMock<http.ServerResponse>();

      await proxyServer['handleHttpRequest'](buildRequest('GET', 'http://example.com', { headers: basicAuth('admin:wrong') }), mockRes);

      assert.deepStrictEqual(mockRes.writeHead.mock.calls[0].arguments, [407, { 'Proxy-Authenticate': 'Basic realm="OIBus Proxy"' }]);
      assert.deepStrictEqual(mockRes.end.mock.calls[0].arguments, ['Proxy Authentication Required']);
    });

    it('should allow https CONNECT when proxy auth is not configured', async () => {
      const clientSocket = buildSocket();
      const { connected } = mockCreateConnection(buildSocket());

      await proxyServer['handleHttpsRequest'](buildRequest('CONNECT', 'example.com:443'), clientSocket, Buffer.from(''));
      connected();

      assert.deepStrictEqual(clientSocket.write.mock.calls[0].arguments[0], 'HTTP/1.1 200 Connection established\r\n\r\n');
    });

    it('should allow https CONNECT with valid proxy credentials', async () => {
      proxyServer['settings'] = withAuth;
      const clientSocket = buildSocket();
      const { connected } = mockCreateConnection(buildSocket());

      await proxyServer['handleHttpsRequest'](
        buildRequest('CONNECT', 'example.com:443', { headers: basicAuth('admin:secret') }),
        clientSocket,
        Buffer.from('')
      );
      connected();

      assert.deepStrictEqual(clientSocket.write.mock.calls[0].arguments[0], 'HTTP/1.1 200 Connection established\r\n\r\n');
    });

    it('should block https CONNECT with missing Proxy-Authorization header', async () => {
      proxyServer['settings'] = withAuth;
      const clientSocket = buildSocket();

      await proxyServer['handleHttpsRequest'](buildRequest('CONNECT', 'example.com:443'), clientSocket, Buffer.from(''));

      assert.deepStrictEqual(clientSocket.write.mock.calls[0].arguments[0], PROXY_AUTH_REQUIRED);
      assert.strictEqual(clientSocket.end.mock.calls.length, 1);
    });

    it('should block https CONNECT with wrong proxy credentials', async () => {
      proxyServer['settings'] = withAuth;
      const clientSocket = buildSocket();

      await proxyServer['handleHttpsRequest'](
        buildRequest('CONNECT', 'example.com:443', { headers: basicAuth('admin:wrong') }),
        clientSocket,
        Buffer.from('')
      );

      assert.deepStrictEqual(clientSocket.write.mock.calls[0].arguments[0], PROXY_AUTH_REQUIRED);
      assert.strictEqual(clientSocket.end.mock.calls.length, 1);
    });

    it('should reject proxy authorization header without a colon separator', async () => {
      proxyServer['settings'] = withAuth;
      const mockRes = createMock<http.ServerResponse>();

      await proxyServer['handleHttpRequest'](buildRequest('GET', 'http://example.com', { headers: basicAuth('nocolonhere') }), mockRes);

      assert.deepStrictEqual(mockRes.writeHead.mock.calls[0].arguments, [407, { 'Proxy-Authenticate': 'Basic realm="OIBus Proxy"' }]);
      assert.deepStrictEqual(mockRes.end.mock.calls[0].arguments, ['Proxy Authentication Required']);
      assert.strictEqual(argon2Exports.default.verify.mock.calls.length, 0);
    });

    it('should reject proxy authorization with a mismatched username', async () => {
      proxyServer['settings'] = withAuth;
      const mockRes = createMock<http.ServerResponse>();

      await proxyServer['handleHttpRequest'](
        buildRequest('GET', 'http://example.com', { headers: basicAuth('someoneelse:secret') }),
        mockRes
      );

      assert.deepStrictEqual(mockRes.writeHead.mock.calls[0].arguments, [407, { 'Proxy-Authenticate': 'Basic realm="OIBus Proxy"' }]);
      assert.strictEqual(argon2Exports.default.verify.mock.calls.length, 0);
    });

    it('should treat proxy authorization as invalid when argon2 verification throws', async () => {
      proxyServer['settings'] = withAuth;
      argon2Exports.default.verify.mock.mockImplementationOnce(async () => {
        throw new Error('verify failure');
      });
      const mockRes = createMock<http.ServerResponse>();

      await proxyServer['handleHttpRequest'](buildRequest('GET', 'http://example.com', { headers: basicAuth('admin:secret') }), mockRes);

      assert.deepStrictEqual(mockRes.writeHead.mock.calls[0].arguments, [407, { 'Proxy-Authenticate': 'Basic realm="OIBus Proxy"' }]);
    });
  });

  it('should log unhandled rejection from the connect event handler', async () => {
    proxyServer.start({ ...baseProxySettings });
    proxyServer['handleHttpsRequest'] = () => Promise.reject(new Error('https failure'));

    listener(webServer, 'connect')({ method: 'CONNECT' }, {}, Buffer.from(''));
    await flushPromises();

    assert.deepStrictEqual(logger.error.mock.calls[0].arguments, ['https failure']);
  });

  it('should log unhandled rejection from the request event handler', async () => {
    proxyServer.start({ ...baseProxySettings });
    proxyServer['handleHttpRequest'] = () => Promise.reject(new Error('http failure'));

    listener(webServer, 'request')({ method: 'GET' }, {});
    await flushPromises();

    assert.deepStrictEqual(logger.error.mock.calls[0].arguments, ['http failure']);
  });
});
