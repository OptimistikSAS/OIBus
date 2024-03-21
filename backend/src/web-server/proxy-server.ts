import pino from 'pino';
import http from 'node:http';
import httpProxy from 'http-proxy';

/**
 * Class Server - Provides the web client and establish socket connections.
 */
export default class ProxyServer {
  private _logger: pino.Logger;
  private webServer: http.Server | null = null;
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
    const proxy = httpProxy.createProxyServer({});

    this.webServer = http
      .createServer((req, res) => {
        const ip = req.socket.remoteAddress;
        if (ip && this.ipFilter.includes(ip)) {
          this._logger.trace(`Forward ${req.method} request to ${req.url} from IP ${ip}`);
          proxy.web(
            req,
            res,
            { target: req.url?.startsWith('https://') ? `https://${req.headers.host}` : `http://${req.headers.host}` },
            err => {
              this._logger.error(`Proxy server error. ${err}`);
            }
          );
        } else {
          this._logger.trace(`Ignore ${req.method} request to ${req.url} from IP ${ip}`);
        }
      })
      .listen(port, () => {
        this._logger.info(`Start proxy server on port ${port}.`);
      });
    // Listen for the `error` event on `proxy`.
    this.webServer.on('error', (err: Error, req: http.IncomingMessage, res: http.ServerResponse) => {
      res.writeHead(500, {
        'Content-Type': 'text/plain'
      });

      res.end(err);
    });
  }

  /**
   * Stop the web server
   */
  async stop(): Promise<void> {
    this.webServer?.close();
  }
}
