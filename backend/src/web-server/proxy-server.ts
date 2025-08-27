import pino from 'pino';
import http from 'node:http';
import * as stream from 'node:stream';
import net from 'node:net';
import httpProxy from 'http-proxy';
import { testIPOnFilter } from '../service/utils';

/**
 * Class Server - Provides the web client and establish socket connections.
 */
export default class ProxyServer {
  private _logger: pino.Logger;
  private webServer: http.Server | null = null;
  private httpProxy: httpProxy | null = null;
  private ipFilters: Array<string> = [];

  constructor(
    logger: pino.Logger,
    private readonly ignoreIpFilters: boolean
  ) {
    this._logger = logger;
    this.refreshIpFilters([]);
  }

  get logger(): pino.Logger {
    return this._logger;
  }

  setLogger(value: pino.Logger) {
    this._logger = value;
  }

  refreshIpFilters(ipFilters: Array<string>) {
    this.ipFilters = ipFilters;
  }

  async start(port: number): Promise<void> {
    this.initHttpProxy();
    this.initWebServer(port);
  }

  /**
   * Stop the web server
   */
  async stop(): Promise<void> {
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

    this._logger.trace(`Forward ${req.method} request to ${req.url} from IP ${req.socket.remoteAddress}`);

    this.httpProxy?.web(req, res, { target: req.url }, err => {
      this._logger.error(`Proxy server error ${err}`);
    });
  }

  private handleHttpsRequest(req: http.IncomingMessage, clientSocket: stream.Duplex, head: Buffer) {
    const ipAllowed = this.isIpAddressAllowed(req);
    if (!ipAllowed) {
      clientSocket.write(`HTTP/${req.httpVersion} 403 Forbidden\r\n\r\n`);
      clientSocket.end();
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
