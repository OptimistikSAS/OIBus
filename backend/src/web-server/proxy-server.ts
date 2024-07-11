import pino from 'pino';
import http from 'node:http';
import * as stream from 'node:stream';
import net from 'node:net';
import httpProxy from 'http-proxy';

/**
 * Class Server - Provides the web client and establish socket connections.
 */
export default class ProxyServer {
  private _logger: pino.Logger;
  private webServer: http.Server | null = null;
  private httpProxy: httpProxy | null = null;
  private ipFilter: Array<string> = [];

  constructor(logger: pino.Logger) {
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
    this.ipFilter = ['127.0.0.1', '::1', '::ffff:127.0.0.1', ...ipFilters];
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
    this.webServer.on('error', (err: Error, _req: http.IncomingMessage, res: http.ServerResponse) => {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(err);
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

    const [targetDomain, targetPort] = req.headers.host!.split(':');

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
      this._logger.error(`Proxy server error on target socket: ${error}`);
      clientSocket.write(`HTTP/${req.httpVersion} 500 Connection error\r\n\r\n`);
      clientSocket.end();
    });

    clientSocket.on('error', error => {
      this._logger.error(`Proxy server error on client socket: ${error}`);
      targetSocket.end();
    });
  }

  private isIpAddressAllowed(req: http.IncomingMessage) {
    const clientIpAddress = req.socket.remoteAddress;

    // IP Address filtering
    if (!clientIpAddress || !this.ipFilter.includes(clientIpAddress)) {
      this._logger.trace(`Ignore ${req.method} request to ${req.url} from IP ${clientIpAddress}`);
      return false;
    }

    return true;
  }
}
