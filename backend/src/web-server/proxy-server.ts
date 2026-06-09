import http from 'node:http';
import * as stream from 'node:stream';
import net from 'node:net';
import httpProxy from 'http-proxy';
import { testIPOnFilter } from '../service/utils';
import type { ILogger } from '../model/logger.model';

interface ForwardProxy {
  url: string | null;
  username: string | null;
  password: string | null;
}

interface ProxyAuth {
  username: string | null;
  password: string | null;
}

/**
 * Class Server - Provides the web client and establish socket connections.
 */
export default class ProxyServer {
  private _logger: ILogger;
  private webServer: http.Server | null = null;
  private httpProxy: httpProxy | null = null;
  private ipFilters: Array<string> = [];
  private forwardProxyUrl: string | null = null;
  private forwardProxyUsername: string | null = null;
  private forwardProxyPassword: string | null = null;
  private proxyAuth: ProxyAuth = { username: null, password: null };

  constructor(
    logger: ILogger,
    private readonly ignoreIpFilters: boolean
  ) {
    this._logger = logger;
    this.refreshIpFilters([]);
  }

  get logger(): ILogger {
    return this._logger;
  }

  setLogger(value: ILogger) {
    this._logger = value;
  }

  refreshIpFilters(ipFilters: Array<string>) {
    this.ipFilters = ipFilters;
  }

  start(port: number, forwardProxy?: ForwardProxy, proxyAuth?: ProxyAuth): void {
    this.forwardProxyUrl = forwardProxy?.url ?? null;
    this.forwardProxyUsername = forwardProxy?.username ?? null;
    this.forwardProxyPassword = forwardProxy?.password ?? null;
    this.proxyAuth = proxyAuth ?? { username: null, password: null };
    this.initHttpProxy();
    this.initWebServer(port);
  }

  /**
   * Stop the web server
   */
  stop(): void {
    this.webServer?.close();
  }

  /**
   * Initialize HTTP proxy
   */
  private initHttpProxy() {
    this.httpProxy = httpProxy.createProxyServer();
  }

  /**
   * Initialize webserver
   */
  private initWebServer(port: number) {
    this.webServer = http.createServer().listen(port, () => {
      this._logger.info(`Start proxy server on port ${port}.`);
    });

    this.webServer.on('request', this.handleHttpRequest.bind(this));
    this.webServer.on('connect', this.handleHttpsRequest.bind(this));

    // Listen for the `error` event on `webserver`.
    this.webServer.on('error', (err: Error) => {
      this._logger.error(err.message);
    });
  }

  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const ipAllowed = this.isIpAddressAllowed(req);
    if (!ipAllowed) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    if (!this.isClientAuthenticated(req)) {
      res.writeHead(407, { 'Proxy-Authenticate': 'Basic realm="OIBus Proxy"' });
      res.end('Proxy Authentication Required');
      return;
    }

    this._logger.trace(`Forward ${req.method} request to ${req.url} from IP ${req.socket.remoteAddress}`);

    if (this.forwardProxyUrl) {
      this.handleHttpRequestViaUpstreamProxy(req, res);
      return;
    }

    this.httpProxy?.web(req, res, { target: req.url }, err => {
      this._logger.error(`Proxy server error ${err}`);
    });
  }

  private handleHttpRequestViaUpstreamProxy(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      const proxyUrl = new URL(this.forwardProxyUrl!);
      const headers: http.OutgoingHttpHeaders = { ...req.headers };
      if (this.forwardProxyUsername) {
        const cred = Buffer.from(`${this.forwardProxyUsername}:${this.forwardProxyPassword ?? ''}`).toString('base64');
        headers['Proxy-Authorization'] = `Basic ${cred}`;
      }
      const options: http.RequestOptions = {
        host: proxyUrl.hostname,
        port: Number(proxyUrl.port || 80),
        method: req.method,
        path: req.url,
        headers
      };
      const upstreamReq = http.request(options, upstreamRes => {
        res.writeHead(upstreamRes.statusCode!, upstreamRes.headers);
        upstreamRes.pipe(res);
      });
      upstreamReq.on('error', error => {
        this._logger.error(`Upstream proxy error: ${error.message}`);
        res.writeHead(502);
        res.end();
      });
      req.pipe(upstreamReq);
    } catch (error: unknown) {
      this._logger.error(`Proxy server error: ${(error as Error).message}`);
      res.writeHead(500);
      res.end();
    }
  }

  private handleHttpsRequest(req: http.IncomingMessage, clientSocket: stream.Duplex, head: Buffer) {
    const ipAllowed = this.isIpAddressAllowed(req);
    if (!ipAllowed) {
      clientSocket.write(`HTTP/${req.httpVersion} 403 Forbidden\r\n\r\n`);
      clientSocket.end();
      return;
    }

    if (!this.isClientAuthenticated(req)) {
      clientSocket.write(
        `HTTP/${req.httpVersion} 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="OIBus Proxy"\r\n\r\n`
      );
      clientSocket.end();
      return;
    }

    if (this.forwardProxyUrl) {
      this.handleHttpsRequestViaUpstreamProxy(req, clientSocket, head);
      return;
    }

    try {
      const [targetDomain, targetPort] = req.url!.split(':');
      this._logger.trace(`Forward ${req.method} request to ${req.url} from IP ${req.socket.remoteAddress}`);

      // Create a new secure socket connection to the target
      const targetSocket = net.createConnection({ host: targetDomain, port: Number(targetPort) }, () => {
        targetSocket.write(head);
        // Let the client know the connection is established
        clientSocket.write(`HTTP/${req.httpVersion} 200 Connection established\r\n\r\n`);

        // Use pipe to handle data flow in both directions
        clientSocket.pipe(targetSocket).pipe(clientSocket);
      });

      targetSocket.on('error', error => {
        this._logger.error(`Proxy server error on target socket: ${error.message}`);
        clientSocket.write(`HTTP/${req.httpVersion} 500 Connection error\r\n\r\n`);
        clientSocket.end();
      });
      clientSocket.on('error', error => {
        this._logger.error(`Proxy server error on client socket: ${error.message}`);
        targetSocket.end();
      });
    } catch (error: unknown) {
      this._logger.error(`Proxy server error: ${(error as Error).message}`);
    }
  }

  private handleHttpsRequestViaUpstreamProxy(req: http.IncomingMessage, clientSocket: stream.Duplex, head: Buffer) {
    try {
      const proxyUrl = new URL(this.forwardProxyUrl!);
      this._logger.trace(`Forward ${req.method} request to ${req.url} via upstream proxy ${this.forwardProxyUrl}`);

      const upstreamSocket = net.createConnection({ host: proxyUrl.hostname, port: Number(proxyUrl.port || 80) }, () => {
        let authHeader = '';
        if (this.forwardProxyUsername) {
          const cred = Buffer.from(`${this.forwardProxyUsername}:${this.forwardProxyPassword ?? ''}`).toString('base64');
          authHeader = `Proxy-Authorization: Basic ${cred}\r\n`;
        }
        upstreamSocket.write(`CONNECT ${req.url} HTTP/1.1\r\nHost: ${req.url}\r\n${authHeader}\r\n`);
      });

      let headerBuffer = '';
      const onData = (chunk: Buffer) => {
        headerBuffer += chunk.toString('binary');
        const headerEnd = headerBuffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;
        upstreamSocket.removeListener('data', onData);
        if (headerBuffer.startsWith('HTTP/') && headerBuffer.includes(' 200 ')) {
          clientSocket.write(`HTTP/${req.httpVersion} 200 Connection established\r\n\r\n`);
          upstreamSocket.write(head);
          clientSocket.pipe(upstreamSocket).pipe(clientSocket);
        } else {
          this._logger.error(`Upstream proxy rejected CONNECT to ${req.url}`);
          clientSocket.write(`HTTP/${req.httpVersion} 502 Bad Gateway\r\n\r\n`);
          clientSocket.end();
          upstreamSocket.end();
        }
      };
      upstreamSocket.on('data', onData);

      upstreamSocket.on('error', error => {
        upstreamSocket.removeListener('data', onData);
        this._logger.error(`Upstream proxy socket error: ${error.message}`);
        clientSocket.write(`HTTP/${req.httpVersion} 502 Bad Gateway\r\n\r\n`);
        clientSocket.end();
      });
      clientSocket.on('error', error => {
        this._logger.error(`Proxy server error on client socket: ${error.message}`);
        upstreamSocket.end();
      });
    } catch (error: unknown) {
      this._logger.error(`Proxy server error: ${(error as Error).message}`);
    }
  }

  private isClientAuthenticated(req: http.IncomingMessage): boolean {
    if (!this.proxyAuth.username) {
      return true;
    }
    const authHeader = req.headers['proxy-authorization'];
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return false;
    }
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) {
      return false;
    }
    const username = decoded.slice(0, colonIndex);
    const password = decoded.slice(colonIndex + 1);
    return username === this.proxyAuth.username && password === (this.proxyAuth.password ?? '');
  }

  private isIpAddressAllowed(req: http.IncomingMessage) {
    const clientIpAddress = req.socket.remoteAddress;

    if (this.ignoreIpFilters) {
      return true;
    }
    // IP Address filtering
    if (!clientIpAddress) {
      this._logger.trace(`Client IP address is not provided. HTTP incoming message ${req.method} to ${req.url} is ignored `);
      return false;
    }

    const allowed = testIPOnFilter(this.ipFilters, clientIpAddress);
    if (!allowed) {
      this._logger.trace(`Ignore ${req.method} request to ${req.url} from IP ${clientIpAddress}`);
      return false;
    }

    return true;
  }
}
