// import { addAuthenticationToHeaders, httpSend } from './http-request-static-functions';
import pino from 'pino';

import { HealthSignalDTO } from '../../../shared/model/engine.model';
import ProxyService from './proxy.service';
import EncryptionService from './encryption.service';
import fetch from 'node-fetch';

/**
 * Class HealthSignal - sends health signal to a remote host or into the logs
 */
export default class HealthSignalService {
  private httpSignalInterval: NodeJS.Timeout | null = null;
  private logSignalInterval: NodeJS.Timeout | null = null;

  constructor(
    private _settings: HealthSignalDTO,
    private readonly proxyService: ProxyService,
    private readonly encryptionService: EncryptionService,
    private _logger: pino.Logger
  ) {
    this.initTimers();
  }

  private initTimers() {
    this.httpSignalInterval = null;
    this.logSignalInterval = null;

    if (this._settings.http.enabled) {
      this._logger.debug(`Initializing HTTP health signal timer every ${this._settings.http.interval}s.`);
      this.httpSignalInterval = setInterval(this.prepareAndSendHttpSignal.bind(this), this._settings.http.interval * 1000);
    }
    if (this._settings.logging.enabled) {
      this._logger.debug(`Initializing logging health signal timer every ${this._settings.logging.interval}s.`);
      this.logSignalInterval = setInterval(this.sendLoggingSignal.bind(this), this._settings.logging.interval * 1000);
    }
  }

  setLogger(value: pino.Logger) {
    this._logger = value;
  }

  async setSettings(value: HealthSignalDTO): Promise<void> {
    this._settings = value;
    await this.stop();
    this.initTimers();
  }

  async prepareAndSendHttpSignal(): Promise<void> {
    const healthStatus = this.prepareStatus(this._settings.http.verbose);
    await this.sendHttpSignal(JSON.stringify(healthStatus));
  }

  /**
   * Callback to send the health signal with http.
   */
  async sendHttpSignal(data: string): Promise<void> {
    try {
      const proxyAgent = this._settings.http.proxyId ? await this.proxyService.createProxyAgent(this._settings.http.proxyId) : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      switch (this._settings.http.authentication.type) {
        case 'basic': {
          const decryptedPassword = await this.encryptionService.decryptText(this._settings.http.authentication.password);
          const basic = Buffer.from(`${this._settings.http.authentication.username}:${decryptedPassword}`).toString('base64');
          headers.authorization = `Basic ${basic}`;
          break;
        }
        case 'api-key':
          headers[this._settings.http.authentication.key] = await this.encryptionService.decryptText(
            this._settings.http.authentication.secret
          );
          break;

        case 'bearer':
          headers.authorization = `Bearer ${await this.encryptionService.decryptText(this._settings.http.authentication.token)}`;
          break;
        default:
          break;
      }

      await fetch(this._settings.http.address, {
        method: 'POST',
        headers,
        body: data,
        timeout: 10_000,
        agent: proxyAgent
      });

      this._logger.trace(`Health signal successfully sent to "${this._settings.http.address}".`);
    } catch (error) {
      this._logger.error(error);
    }
  }

  /**
   * Log the health signal (info level)
   */
  sendLoggingSignal(): void {
    const healthStatus = this.prepareStatus(true);
    this._logger.info(JSON.stringify(healthStatus));
  }

  /**
   * Retrieve status information from the engine
   */
  prepareStatus(verbose: boolean): { status: string; verbose: boolean; id: string } {
    let status = { status: 'TODO', verbose: false, id: 'id1' };
    if (verbose) {
      status = { ...status, verbose: true };
    }
    return status;
  }

  /**
   * Log and forward a healthSignal request.
   */
  async forwardRequest(data: any): Promise<void> {
    const stringData = JSON.stringify(data);
    this._logger.info(stringData);
    if (this._settings.http.enabled) {
      this._logger.trace(`Forwarding health signal to "${this._settings.http.address}".`);
      await this.sendHttpSignal(stringData);
    }
  }

  /**
   * Stop the timers for sending health signal.
   */
  stop(): void {
    if (this.httpSignalInterval) {
      clearInterval(this.httpSignalInterval);
    }
    if (this.logSignalInterval) {
      clearInterval(this.logSignalInterval);
    }
  }
}
