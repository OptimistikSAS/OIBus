import type pino from 'pino';
import http from 'node:http';
import httpProxy from 'http-proxy';
import net from 'node:net';
import ProxyServer from './proxy-server';
import PinoLogger from '../tests/__mocks__/service/logger/logger.mock';

const httpMock = {
  on: jest.fn(),
  listen: jest.fn(),
  createServer: jest.fn()
};
httpMock.listen.mockImplementation((_, callback) => {
  callback();
  return { on: httpMock.on };
});
httpMock.createServer.mockReturnValue({ listen: httpMock.listen });
jest.mock('node:http', () => ({
  createServer: jest.fn(() => httpMock.createServer())
}));

jest.mock('http-proxy');
jest.mock('node:net');

const logger: pino.Logger = new PinoLogger();

describe('ProxyServer', () => {
  let proxyServer: ProxyServer;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    proxyServer = new ProxyServer(logger);
  });

  it('should initialize with default IP filters', () => {
    expect(proxyServer['ipFilter']).toEqual(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
  });

  it('should update the logger', () => {
    const newLogger = {} as pino.Logger;
    proxyServer.setLogger(newLogger);
    expect(proxyServer.logger).toBe(newLogger);
  });

  it('should update IP filters', () => {
    proxyServer.refreshIpFilters(['192.168.0.1', '10.0.0.1']);
    expect(proxyServer['ipFilter']).toEqual(['127.0.0.1', '::1', '::ffff:127.0.0.1', '192.168.0.1', '10.0.0.1']);
  });

  it('should initialize HTTP proxy and webserver on start', async () => {
    const mockCreateProxyServer = jest.spyOn(httpProxy, 'createProxyServer');

    // @ts-expect-error Override bind, to be able to test if the right functions are passed
    jest.spyOn(proxyServer['handleHttpRequest'], 'bind').mockImplementation(() => proxyServer['handleHttpRequest']);
    // @ts-expect-error Same as above
    jest.spyOn(proxyServer['handleHttpsRequest'], 'bind').mockImplementation(() => proxyServer['handleHttpsRequest']);

    await proxyServer.start(9000);

    expect(mockCreateProxyServer).toHaveBeenCalled();

    expect(httpMock.createServer).toHaveBeenCalled();
    expect(httpMock.listen).toHaveBeenCalledWith(9000, expect.any(Function));
    expect(httpMock.on.mock.calls).toEqual([
      ['request', proxyServer['handleHttpRequest']],
      ['connect', proxyServer['handleHttpsRequest']],
      ['error', expect.any(Function)]
    ]);
    expect(logger.info).toHaveBeenCalledWith('Start proxy server on port 9000.');
  });

  it('should stop the webserver', async () => {
    const mockClose = jest.fn();
    proxyServer['webServer'] = { close: mockClose } as unknown as http.Server;

    await proxyServer.stop();

    expect(mockClose).toHaveBeenCalled();
  });

  it("should not stop if webserver wasn't started", async () => {
    const mockClose = jest.fn();
    await proxyServer.stop();
    expect(mockClose).not.toHaveBeenCalled();
  });

  it('should allow http requests from whitelisted IPs', () => {
    const mockReq = {
      method: 'GET',
      url: 'http://example.com',
      socket: { remoteAddress: '127.0.0.1' }
    } as unknown as http.IncomingMessage;

    const mockRes = {
      writeHead: jest.fn(),
      end: jest.fn()
    } as unknown as http.ServerResponse;

    const mockWeb = jest.fn();
    proxyServer['httpProxy'] = { web: mockWeb } as unknown as httpProxy;

    proxyServer['handleHttpRequest'](mockReq, mockRes);

    expect(mockRes.writeHead).not.toHaveBeenCalled();
    expect(mockRes.end).not.toHaveBeenCalled();
    expect(mockWeb).toHaveBeenCalledWith(mockReq, mockRes, { target: 'http://example.com' }, expect.any(Function));
  });

  it('should block http requests from non-whitelisted IPs', () => {
    const mockReq = {
      method: 'GET',
      url: 'http://example.com',
      socket: { remoteAddress: '192.168.0.1' }
    } as unknown as http.IncomingMessage;

    const mockRes = {
      writeHead: jest.fn(),
      end: jest.fn()
    } as unknown as http.ServerResponse;

    proxyServer['handleHttpRequest'](mockReq, mockRes);

    expect(mockRes.writeHead).toHaveBeenCalledWith(403, { 'Content-Type': 'text/plain' });
    expect(mockRes.end).toHaveBeenCalledWith('Forbidden');
  });

  it('should allow https requests from whitelisted IPs', () => {
    const mockReq = {
      method: 'CONNECT',
      url: 'https://example.com',
      socket: { remoteAddress: '127.0.0.1' },
      headers: { host: 'example.com:443' },
      httpVersion: '1.1'
    } as unknown as http.IncomingMessage;

    const mockClientSocket = {
      write: jest.fn(),
      pipe: jest.fn().mockImplementation(destStream => destStream),
      on: jest.fn()
    } as unknown as net.Socket;

    const mockTargetSocket = {
      write: jest.fn(),
      pipe: jest.fn().mockImplementation(destStream => destStream),
      on: jest.fn()
    };

    let connectionCallback: () => void;

    (net.createConnection as jest.Mock).mockImplementation((options, callback) => {
      connectionCallback = callback;
      return mockTargetSocket;
    });

    proxyServer['handleHttpsRequest'](mockReq, mockClientSocket, Buffer.from(''));

    setImmediate(() => {
      connectionCallback();
    });
    jest.runAllTimers();

    expect(net.createConnection).toHaveBeenCalledWith({ host: 'example.com', port: 443 }, expect.any(Function));
    expect(mockTargetSocket.write).toHaveBeenCalledWith(Buffer.from(''));
    expect(mockClientSocket.write).toHaveBeenCalledWith('HTTP/1.1 200 Connection established\r\n\r\n');
    expect(mockClientSocket.pipe).toHaveBeenCalledWith(mockTargetSocket);
    expect(mockTargetSocket.pipe).toHaveBeenCalledWith(mockClientSocket);

    expect(mockTargetSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(mockClientSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('should block https requests from non-whitelisted IPs', () => {
    const mockReq = {
      method: 'CONNECT',
      url: 'https://example.com',
      socket: { remoteAddress: '192.168.0.1' },
      httpVersion: '1.1'
    } as unknown as http.IncomingMessage;

    const mockClientSocket = {
      write: jest.fn(),
      end: jest.fn()
    } as unknown as net.Socket;

    proxyServer['handleHttpsRequest'](mockReq, mockClientSocket, Buffer.from(''));

    expect(mockClientSocket.write).toHaveBeenCalledWith('HTTP/1.1 403 Forbidden\r\n\r\n');
    expect(mockClientSocket.end).toHaveBeenCalled();
  });

  it('should handle webserver errors', async () => {
    let errorCallback: ((error: Error, param: object, result: unknown) => void) | undefined = undefined;
    jest.spyOn(httpMock, 'on').mockImplementation((event, callback) => {
      if (event === 'error') errorCallback = callback;
    });
    const mockRes = {
      writeHead: jest.fn(),
      end: jest.fn()
    } as unknown as http.ServerResponse;
    const error = new Error();

    await proxyServer.start(9000);

    errorCallback!(error, {}, mockRes);
    expect(mockRes.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'text/plain' });
    expect(mockRes.end).toHaveBeenCalledWith(error);
  });

  it('should handle httpProxy errors', () => {
    const mockReq = {
      method: 'GET',
      url: 'http://example.com',
      socket: { remoteAddress: '127.0.0.1' }
    } as unknown as http.IncomingMessage;

    const mockRes = {
      writeHead: jest.fn(),
      end: jest.fn()
    } as unknown as http.ServerResponse;
    const error = new Error();

    const mockWeb = jest.fn().mockImplementation((_req, _res, _opts, callback) => {
      callback(error);
    });
    proxyServer['httpProxy'] = { web: mockWeb } as unknown as httpProxy;

    proxyServer['handleHttpRequest'](mockReq, mockRes);

    expect(logger.error).toHaveBeenCalledWith(`Proxy server error ${error}`);
  });

  it('should only call httpProxy if the proxy server has been started', () => {
    const mockReq = {
      method: 'GET',
      url: 'http://example.com',
      socket: { remoteAddress: '127.0.0.1' }
    } as unknown as http.IncomingMessage;

    const mockRes = {
      writeHead: jest.fn(),
      end: jest.fn()
    } as unknown as http.ServerResponse;
    const mockWeb = jest.fn();

    proxyServer['handleHttpRequest'](mockReq, mockRes);

    expect(mockWeb).not.toHaveBeenCalled();
  });

  it('should handle https socket errors', () => {
    const error = new Error();

    const mockReq = {
      method: 'CONNECT',
      url: 'https://example.com',
      socket: { remoteAddress: '127.0.0.1' },
      headers: { host: 'example.com:443' },
      httpVersion: '1.1'
    } as unknown as http.IncomingMessage;

    const mockClientSocket = {
      write: jest.fn(),
      pipe: jest.fn().mockImplementation(destStream => destStream),
      on: jest.fn().mockImplementation((_, callback) => callback(error)),
      end: jest.fn()
    } as unknown as net.Socket;

    const mockTargetSocket = {
      write: jest.fn(),
      pipe: jest.fn().mockImplementation(destStream => destStream),
      on: jest.fn().mockImplementation((_, callback) => callback(error)),
      end: jest.fn()
    };

    let connectionCallback: () => void;

    (net.createConnection as jest.Mock).mockImplementation((options, callback) => {
      connectionCallback = callback;
      return mockTargetSocket;
    });

    proxyServer['handleHttpsRequest'](mockReq, mockClientSocket, Buffer.from(''));

    setImmediate(() => {
      connectionCallback();
    });
    jest.runAllTimers();

    expect(net.createConnection).toHaveBeenCalledWith({ host: 'example.com', port: 443 }, expect.any(Function));
    expect(mockTargetSocket.write).toHaveBeenCalledWith(Buffer.from(''));
    expect(mockClientSocket.write).toHaveBeenCalledWith('HTTP/1.1 200 Connection established\r\n\r\n');
    expect(mockClientSocket.pipe).toHaveBeenCalledWith(mockTargetSocket);
    expect(mockTargetSocket.pipe).toHaveBeenCalledWith(mockClientSocket);

    expect(logger.error).toHaveBeenCalledWith(`Proxy server error on target socket: ${error}`);
    expect(mockClientSocket.write).toHaveBeenCalledWith(`HTTP/${mockReq.httpVersion} 500 Connection error\r\n\r\n`);
    expect(mockClientSocket.end).toHaveBeenCalled();

    expect(logger.error).toHaveBeenCalledWith(`Proxy server error on client socket: ${error}`);
    expect(mockTargetSocket.end).toHaveBeenCalled();
  });
});
