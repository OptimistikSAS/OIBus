import pino from 'pino';
import http from 'node:http';
import httpProxy from 'http-proxy';

/**
 * Class Server - Provides the web client and establish socket connections.
 */
export default class ProxyServer {
  private _logger: pino.Logger;
  private webServer: http.Server | null = null;

  constructor(logger: pino.Logger) {
    this._logger = logger;
  }

  get logger(): pino.Logger {
    return this._logger;
  }

  setLogger(value: pino.Logger) {
    this._logger = value;
  }

  async start(port: number): Promise<void> {
    const proxy = httpProxy.createProxyServer({});
    this.webServer = http
      .createServer((req, res) => {
        this._logger.trace(`Forward ${req.method} request to ${req.url}`);
        proxy.web(req, res, { target: req.url?.startsWith('https://') ? `https://${req.headers.host}` : `http://${req.headers.host}` });
      })
      .listen(port, () => {
        this._logger.info(`Start proxy server on port ${port}.`);
      });
  }

  /**
   * Stop the web server
   */
  async stop(): Promise<void> {
    this.webServer?.close();
  }
}
