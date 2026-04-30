import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type http from 'node:http';
import type net from 'node:net';
import type httpProxy from 'http-proxy';
import {mockModule, reloadModule} from '../tests/utils/test-utils';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';

const nodeRequire = createRequire(import.meta.url);

// Shared mock fns for node:http — patched via mock.method in beforeEach
const httpListenMock = mock.fn((_port: number, callback: () => void) => {
  callback();
  return { on: mock.fn() };
});
const httpCreateServerMock = mock.fn(() => ({ listen: httpListenMock }));

const testIPOnFilterMock = mock.fn(() => true);
const utilsExports = { testIPOnFilter: testIPOnFilterMock };

// http-proxy is a third-party module and can be mocked via mockModule
const proxyOnMock = mock.fn();
const proxyWebMock = mock.fn();
const proxyWsMock = mock.fn();
const createProxyServerMock = mock.fn(() => ({ on: proxyOnMock, web: proxyWebMock, ws: proxyWsMock }));
mockModule(nodeRequire, 'http-proxy', {
  __esModule: true,
  default: { createProxyServer: createProxyServerMock }
});

mockModule(nodeRequire, '../service/utils', utilsExports);

import type ProxyServerClass from './proxy-server';
const { default: ProxyServer } = reloadModule<{ default: typeof ProxyServerClass }>(nodeRequire, './proxy-server');

describe('ProxyServer', () => {
  let proxyServer: ProxyServerClass;
  const loggerMock = new PinoLogger();
  const logger = loggerMock;

  beforeEach(() => {
    testIPOnFilterMock.mock.resetCalls();
    testIPOnFilterMock.mock.mockImplementation(() => true);

    proxyOnMock.mock.resetCalls();
    proxyWebMock.mock.resetCalls();
    proxyWsMock.mock.resetCalls();
    createProxyServerMock.mock.resetCalls();

    httpListenMock.mock.resetCalls();
    httpListenMock.mock.mockImplementation((_port: number, callback: () => void) => {
      callback();
      return { on: proxyOnMock };
    });
    httpCreateServerMock.mock.resetCalls();
    httpCreateServerMock.mock.mockImplementation(() => ({ listen: httpListenMock }));

    loggerMock.trace.mock.resetCalls();
    loggerMock.debug.mock.resetCalls();
    loggerMock.info.mock.resetCalls();
    loggerMock.warn.mock.resetCalls();
    loggerMock.error.mock.resetCalls();

    // Patch built-in node:http createServer via mock.method
    mock.method(nodeRequire('node:http'), 'createServer', httpCreateServerMock);

    proxyServer = new ProxyServer(logger, false);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should initialize with default IP filters', () => {
    assert.deepStrictEqual(proxyServer['ipFilters'], []);
  });

  it('should update the logger', () => {
    const newLogger = new PinoLogger();
    proxyServer.setLogger(newLogger);
    assert.strictEqual(proxyServer.logger, newLogger);
  });

  it('should update IP filters', () => {
    proxyServer.refreshIpFilters(['192.168.0.1', '10.0.0.1']);
    assert.deepStrictEqual(proxyServer['ipFilters'], ['192.168.0.1', '10.0.0.1']);
  });

  it('should initialize HTTP proxy and webserver on start', async () => {
    await proxyServer.start(9000);

    assert.strictEqual(createProxyServerMock.mock.calls.length, 1);
    assert.strictEqual(httpCreateServerMock.mock.calls.length, 1);
    assert.strictEqual(httpListenMock.mock.calls.length, 1);
    assert.deepStrictEqual(httpListenMock.mock.calls[0].arguments[0], 9000);
    assert.strictEqual(loggerMock.info.mock.calls.length, 1);
    assert.deepStrictEqual(loggerMock.info.mock.calls[0].arguments, ['Start proxy server on port 9000.']);
  });

  it('should stop the webserver', async () => {
    const mockClose = mock.fn();
    proxyServer['webServer'] = { close: mockClose } as unknown as http.Server;

    await proxyServer.stop();

    assert.strictEqual(mockClose.mock.calls.length, 1);
  });

  it("should not stop if webserver wasn't started", async () => {
    const mockClose = mock.fn();
    await proxyServer.stop();
    assert.strictEqual(mockClose.mock.calls.length, 0);
  });

  it('should allow http requests from whitelisted IPs', () => {
    const mockWriteHead = mock.fn();
    const mockEnd = mock.fn();
    const mockReq = {
      method: 'GET',
      url: 'http://example.com',
      socket: { remoteAddress: '127.0.0.1' }
    } as unknown as http.IncomingMessage;

    const mockRes = {
      writeHead: mockWriteHead,
      end: mockEnd
    } as unknown as http.ServerResponse;

    const mockWeb = mock.fn();
    proxyServer['httpProxy'] = { web: mockWeb } as unknown as httpProxy;

    proxyServer['handleHttpRequest'](mockReq, mockRes);

    assert.strictEqual(mockWriteHead.mock.calls.length, 0);
    assert.strictEqual(mockEnd.mock.calls.length, 0);
    assert.strictEqual(mockWeb.mock.calls.length, 1);
    assert.strictEqual(mockWeb.mock.calls[0].arguments[0], mockReq);
    assert.strictEqual(mockWeb.mock.calls[0].arguments[1], mockRes);
    assert.deepStrictEqual(mockWeb.mock.calls[0].arguments[2], { target: 'http://example.com' });
    assert.strictEqual(typeof mockWeb.mock.calls[0].arguments[3], 'function');
  });

  it('should block http requests from non-whitelisted IPs', () => {
    testIPOnFilterMock.mock.mockImplementationOnce(() => false);
    proxyServer.refreshIpFilters(['*.*.*.*']);

    const mockWriteHead = mock.fn();
    const mockEnd = mock.fn();
    const mockReq = {
      method: 'GET',
      url: 'http://example.com',
      socket: { remoteAddress: '192.168.0.1' }
    } as unknown as http.IncomingMessage;

    const mockRes = {
      writeHead: mockWriteHead,
      end: mockEnd
    } as unknown as http.ServerResponse;

    proxyServer['handleHttpRequest'](mockReq, mockRes);

    assert.strictEqual(testIPOnFilterMock.mock.calls.length, 1);
    assert.deepStrictEqual(testIPOnFilterMock.mock.calls[0].arguments, [['*.*.*.*'], mockReq.socket.remoteAddress]);
    assert.deepStrictEqual(mockWriteHead.mock.calls[0].arguments, [403, { 'Content-Type': 'text/plain' }]);
    assert.deepStrictEqual(mockEnd.mock.calls[0].arguments, ['Forbidden']);
  });

  it('should block http requests if remote address is not provided', () => {
    const mockWriteHead = mock.fn();
    const mockEnd = mock.fn();
    const mockReq = {
      method: 'GET',
      url: 'example.com',
      socket: { remoteAddress: null }
    } as unknown as http.IncomingMessage;

    const mockRes = {
      writeHead: mockWriteHead,
      end: mockEnd
    } as unknown as http.ServerResponse;

    proxyServer['handleHttpRequest'](mockReq, mockRes);

    assert.deepStrictEqual(mockWriteHead.mock.calls[0].arguments, [403, { 'Content-Type': 'text/plain' }]);
    assert.deepStrictEqual(mockEnd.mock.calls[0].arguments, ['Forbidden']);
  });

  it('should allow https requests from whitelisted IPs', () => {
    const mockClientWrite = mock.fn();
    const mockClientPipe = mock.fn((destStream: unknown) => destStream);
    const mockClientOn = mock.fn();
    const mockReq = {
      method: 'CONNECT',
      url: 'example.com:443',
      socket: { remoteAddress: '127.0.0.1' },
      httpVersion: '1.1'
    } as unknown as http.IncomingMessage;

    const mockClientSocket = {
      write: mockClientWrite,
      pipe: mockClientPipe,
      on: mockClientOn
    } as unknown as net.Socket;

    const mockTargetWrite = mock.fn();
    const mockTargetPipe = mock.fn((destStream: unknown) => destStream);
    const mockTargetOn = mock.fn();
    const mockTargetSocket = {
      write: mockTargetWrite,
      pipe: mockTargetPipe,
      on: mockTargetOn
    };

    let connectionCallback: (() => void) | undefined;
    mock.method(nodeRequire('node:net'), 'createConnection', (_opts: unknown, cb: () => void) => {
      connectionCallback = cb;
      return mockTargetSocket;
    });

    proxyServer['handleHttpsRequest'](mockReq, mockClientSocket, Buffer.from(''));

    connectionCallback!();

    assert.strictEqual(nodeRequire('node:net').createConnection.mock.calls.length, 1);
    assert.deepStrictEqual(nodeRequire('node:net').createConnection.mock.calls[0].arguments[0], {
      host: 'example.com',
      port: 443
    });
    assert.deepStrictEqual(mockTargetWrite.mock.calls[0].arguments[0], Buffer.from(''));
    assert.deepStrictEqual(mockClientWrite.mock.calls[0].arguments[0], 'HTTP/1.1 200 Connection established\r\n\r\n');
    assert.strictEqual(mockClientPipe.mock.calls[0].arguments[0], mockTargetSocket);
    assert.strictEqual(mockTargetPipe.mock.calls[0].arguments[0], mockClientSocket);
    assert.strictEqual(mockTargetOn.mock.calls[0].arguments[0], 'error');
    assert.strictEqual(mockClientOn.mock.calls[0].arguments[0], 'error');
  });

  it('should block https requests from non-whitelisted IPs', () => {
    testIPOnFilterMock.mock.mockImplementationOnce(() => false);

    const mockClientWrite = mock.fn();
    const mockClientEnd = mock.fn();
    const mockReq = {
      method: 'CONNECT',
      url: 'example.com:443',
      socket: { remoteAddress: '192.168.0.1' },
      httpVersion: '1.1'
    } as unknown as http.IncomingMessage;

    const mockClientSocket = {
      write: mockClientWrite,
      end: mockClientEnd
    } as unknown as net.Socket;

    proxyServer['handleHttpsRequest'](mockReq, mockClientSocket, Buffer.from(''));

    assert.strictEqual(testIPOnFilterMock.mock.calls.length, 1);
    assert.deepStrictEqual(testIPOnFilterMock.mock.calls[0].arguments, [[], mockReq.socket.remoteAddress]);
    assert.deepStrictEqual(mockClientWrite.mock.calls[0].arguments[0], 'HTTP/1.1 403 Forbidden\r\n\r\n');
    assert.strictEqual(mockClientEnd.mock.calls.length, 1);
  });

  it('should handle webserver errors', async () => {
    let errorCallback: ((error: Error) => void) | undefined;

    // Intercept the 'error' listener registration on the webServer
    const originalCreateServer = nodeRequire('node:http').createServer;
    mock.method(nodeRequire('node:http'), 'createServer', () => {
      const serverOn = mock.fn((event: string, callback: (error: Error) => void) => {
        if (event === 'error') errorCallback = callback;
      });
      return {
        listen: (_port: number, cb: () => void) => {
          cb();
          return { on: serverOn };
        }
      };
    });

    await proxyServer.start(9000);

    const error = new Error('proxy error');
    errorCallback!(error);

    assert.strictEqual(loggerMock.error.mock.calls.length, 1);
    assert.deepStrictEqual(loggerMock.error.mock.calls[0].arguments, ['proxy error']);

    void originalCreateServer;
  });

  it('should handle httpProxy errors', () => {
    const mockReq = {
      method: 'GET',
      url: 'example.com:443',
      socket: { remoteAddress: '127.0.0.1' }
    } as unknown as http.IncomingMessage;

    const mockRes = {
      writeHead: mock.fn(),
      end: mock.fn()
    } as unknown as http.ServerResponse;

    const error = new Error();
    const mockWeb = mock.fn((_req: unknown, _res: unknown, _opts: unknown, callback: (err: Error) => void) => {
      callback(error);
    });
    proxyServer['httpProxy'] = { web: mockWeb } as unknown as httpProxy;

    proxyServer['handleHttpRequest'](mockReq, mockRes);

    assert.strictEqual(loggerMock.error.mock.calls.length, 1);
    assert.deepStrictEqual(loggerMock.error.mock.calls[0].arguments, [`Proxy server error ${error}`]);
  });

  it('should only call httpProxy if the proxy server has been started', () => {
    const mockReq = {
      method: 'GET',
      url: 'example.com:443',
      socket: { remoteAddress: '127.0.0.1' }
    } as unknown as http.IncomingMessage;

    const mockRes = {
      writeHead: mock.fn(),
      end: mock.fn()
    } as unknown as http.ServerResponse;
    const mockWeb = mock.fn();

    // httpProxy is null (not started), so web should never be called
    proxyServer['handleHttpRequest'](mockReq, mockRes);

    assert.strictEqual(mockWeb.mock.calls.length, 0);
  });

  it('should handle https socket errors', () => {
    const error = new Error('error');

    const mockClientWrite = mock.fn();
    const mockClientPipe = mock.fn((destStream: unknown) => destStream);
    let clientErrorCallback: ((err: Error) => void) | undefined;
    const mockClientOn = mock.fn((_event: string, callback: (err: Error) => void) => {
      clientErrorCallback = callback;
    });
    const mockClientEnd = mock.fn();
    const mockReq = {
      method: 'CONNECT',
      url: 'example.com:443',
      socket: { remoteAddress: '127.0.0.1' },
      httpVersion: '1.1'
    } as unknown as http.IncomingMessage;

    const mockClientSocket = {
      write: mockClientWrite,
      pipe: mockClientPipe,
      on: mockClientOn,
      end: mockClientEnd
    } as unknown as net.Socket;

    const mockTargetWrite = mock.fn();
    const mockTargetPipe = mock.fn((destStream: unknown) => destStream);
    let targetErrorCallback: ((err: Error) => void) | undefined;
    const mockTargetOn = mock.fn((_event: string, callback: (err: Error) => void) => {
      targetErrorCallback = callback;
    });
    const mockTargetEnd = mock.fn();
    const mockTargetSocket = {
      write: mockTargetWrite,
      pipe: mockTargetPipe,
      on: mockTargetOn,
      end: mockTargetEnd
    };

    let connectionCallback: (() => void) | undefined;
    mock.method(nodeRequire('node:net'), 'createConnection', (_opts: unknown, cb: () => void) => {
      connectionCallback = cb;
      return mockTargetSocket;
    });

    proxyServer['handleHttpsRequest'](mockReq, mockClientSocket, Buffer.from(''));

    connectionCallback!();

    assert.strictEqual(nodeRequire('node:net').createConnection.mock.calls.length, 1);
    assert.deepStrictEqual(nodeRequire('node:net').createConnection.mock.calls[0].arguments[0], {
      host: 'example.com',
      port: 443
    });
    assert.deepStrictEqual(mockTargetWrite.mock.calls[0].arguments[0], Buffer.from(''));
    assert.deepStrictEqual(mockClientWrite.mock.calls[0].arguments[0], 'HTTP/1.1 200 Connection established\r\n\r\n');
    assert.strictEqual(mockClientPipe.mock.calls[0].arguments[0], mockTargetSocket);
    assert.strictEqual(mockTargetPipe.mock.calls[0].arguments[0], mockClientSocket);

    // fire error handlers manually after successful connection
    targetErrorCallback!(error);

    // target socket error triggers logger and client socket cleanup
    assert.deepStrictEqual(loggerMock.error.mock.calls[0].arguments, [`Proxy server error on target socket: ${error.message}`]);
    assert.deepStrictEqual(mockClientWrite.mock.calls[1].arguments[0], `HTTP/${mockReq.httpVersion} 500 Connection error\r\n\r\n`);
    assert.strictEqual(mockClientEnd.mock.calls.length, 1);

    clientErrorCallback!(error);

    // client socket error triggers logger and target socket cleanup
    assert.deepStrictEqual(loggerMock.error.mock.calls[1].arguments, [`Proxy server error on client socket: ${error.message}`]);
    assert.strictEqual(mockTargetEnd.mock.calls.length, 1);
  });

  it('should allow bad ip if ignoreIpFilter is set to true', () => {
    proxyServer = new ProxyServer(logger, true);

    const mockClientWrite = mock.fn();
    const mockClientPipe = mock.fn((destStream: unknown) => destStream);
    const mockClientOn = mock.fn();
    const mockReq = {
      method: 'CONNECT',
      url: 'example.com:443',
      socket: { remoteAddress: null },
      httpVersion: '1.1'
    } as unknown as http.IncomingMessage;

    const mockClientSocket = {
      write: mockClientWrite,
      pipe: mockClientPipe,
      on: mockClientOn
    } as unknown as net.Socket;

    const mockTargetWrite = mock.fn();
    const mockTargetPipe = mock.fn((destStream: unknown) => destStream);
    const mockTargetOn = mock.fn();
    const mockTargetSocket = {
      write: mockTargetWrite,
      pipe: mockTargetPipe,
      on: mockTargetOn
    };

    let connectionCallback: (() => void) | undefined;
    mock.method(nodeRequire('node:net'), 'createConnection', (_opts: unknown, cb: () => void) => {
      connectionCallback = cb;
      return mockTargetSocket;
    });

    proxyServer['handleHttpsRequest'](mockReq, mockClientSocket, Buffer.from(''));

    connectionCallback!();

    assert.strictEqual(nodeRequire('node:net').createConnection.mock.calls.length, 1);
    assert.deepStrictEqual(nodeRequire('node:net').createConnection.mock.calls[0].arguments[0], {
      host: 'example.com',
      port: 443
    });
    assert.deepStrictEqual(mockTargetWrite.mock.calls[0].arguments[0], Buffer.from(''));
    assert.deepStrictEqual(mockClientWrite.mock.calls[0].arguments[0], 'HTTP/1.1 200 Connection established\r\n\r\n');
  });

  it('should catch error on connection error', () => {
    proxyServer = new ProxyServer(logger, true);

    const mockReq = {
      method: 'CONNECT',
      url: 'example.com:443',
      socket: { remoteAddress: null },
      httpVersion: '1.1'
    } as unknown as http.IncomingMessage;

    const mockClientSocket = {
      write: mock.fn(),
      pipe: mock.fn((destStream: unknown) => destStream),
      on: mock.fn()
    } as unknown as net.Socket;

    mock.method(nodeRequire('node:net'), 'createConnection', () => {
      throw new Error('connection error');
    });

    proxyServer['handleHttpsRequest'](mockReq, mockClientSocket, Buffer.from(''));

    assert.strictEqual(nodeRequire('node:net').createConnection.mock.calls.length, 1);
    assert.deepStrictEqual(loggerMock.error.mock.calls[0].arguments, ['Proxy server error: connection error']);
  });
});
