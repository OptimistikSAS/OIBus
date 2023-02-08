import fetch from 'node-fetch';
import build from 'pino-abstract-transport';

import { LogStreamValuesCommandDTO } from '../../../shared/model/logs.model';
import { LogLevel } from '../../../shared/model/engine.model';

const MAX_BATCH_LOG = 500;
const MAX_BATCH_INTERVAL_S = 60;
const LEVEL_FORMAT: { [key: string]: LogLevel } = {
  '10': 'trace',
  '20': 'debug',
  '30': 'info',
  '40': 'warn',
  '50': 'error',
  '60': 'fatal'
};

interface LokiOptions {
  username?: string;
  password?: string;
  tokenAddress?: string;
  address: string;
  id: string;
  interval?: number;
  batchLimit?: number;
}

interface PinoLog {
  msg: string;
  scope: string;
  time: number;
  level: string;
}

interface AccessToken {
  access_token: string;
}

/**
 * Class to support logging to a remote loki instance as a custom Pino Transport module
 */
class LokiTransport {
  private readonly options: LokiOptions;
  private token: AccessToken | null = null;
  private mustRenewToken = true;
  private mustRenewTokenTimeout: NodeJS.Timeout | null = null;
  private sendLokiLogsInterval: NodeJS.Timeout | null = null;
  private batchLogs: { [key: string]: Array<[string, string]> };
  private numberOfLogs = 0;

  constructor(options: LokiOptions) {
    this.options = options;
    this.batchLogs = {
      '60': [],
      '50': [],
      '40': [],
      '30': [],
      '20': [],
      '10': []
    };

    this.sendLokiLogsInterval = setInterval(async () => {
      await this.sendLokiLogs();
    }, (this.options.interval || MAX_BATCH_INTERVAL_S) * 1000);
  }

  /**
   * Method used to send the log to the remote loki instance
   */
  sendLokiLogs = async (): Promise<void> => {
    const streams: Array<LogStreamValuesCommandDTO> = [];
    Object.entries(this.batchLogs).forEach(([logLevel, logMessages]) => {
      if (logMessages.length > 0) {
        logMessages.forEach(logMessage => {
          const jsonMessage = JSON.parse(logMessage[1]);
          streams.push({
            stream: {
              oibus: this.options.id,
              level: LEVEL_FORMAT[logLevel],
              scope: jsonMessage.scope
            },
            values: [[logMessage[0], jsonMessage.message]]
          });
        });
      }
    });
    if (streams.length === 0) {
      return;
    }
    const dataBuffer = JSON.stringify({ streams });
    this.batchLogs = {
      '60': [],
      '50': [],
      '40': [],
      '30': [],
      '20': [],
      '10': []
    };
    this.numberOfLogs = 0;

    const fetchOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: '' },
      body: dataBuffer
    };

    if (this.options.tokenAddress) {
      if (this.mustRenewToken || !this.token) {
        await this.updateLokiToken();
      }
      if (!this.token) {
        return;
      }
      fetchOptions.headers.Authorization = `Bearer ${this.token.access_token}`;
    } else if (this.options.username && this.options.password) {
      const basicAuth = Buffer.from(`${this.options.username}:${this.options.password}`).toString('base64');
      fetchOptions.headers.Authorization = `Basic ${basicAuth}`;
    }
    try {
      const result = await fetch(this.options.address, fetchOptions);
      if (result.status !== 200 && result.status !== 201 && result.status !== 204) {
        console.error(`Loki fetch error: ${result.status} - ${result.statusText} with payload ${dataBuffer}`);
      }
    } catch (error) {
      console.error(error);
    }
  };

  /**
   * Method used to update the token if needed
   */
  updateLokiToken = async (): Promise<void> => {
    if (!this.options.tokenAddress || !this.options.username || !this.options.password) {
      return;
    }
    try {
      const basic = Buffer.from(`${this.options.username}:${this.options.password}`).toString('base64');
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basic}`
        },
        timeout: 10000
      };
      const response = await fetch(this.options.tokenAddress, fetchOptions);
      const responseData = await response.json();

      if (this.mustRenewTokenTimeout) {
        clearTimeout(this.mustRenewTokenTimeout);
      }
      this.mustRenewTokenTimeout = setTimeout(() => {
        this.mustRenewToken = true;
      }, (responseData.expires_in - 60) * 1000);
      this.token = responseData;
      this.mustRenewToken = false;
    } catch (error) {
      console.error(error);
    }
  };

  /**
   * Store the log in the batch log array and send them immediately if the array is full
   */
  addLokiLogs = async (log: PinoLog): Promise<void> => {
    this.batchLogs[log.level].push([
      (new Date(log.time).getTime() * 1000000).toString(),
      JSON.stringify({ message: log.msg, scope: log.scope })
    ]);
    this.numberOfLogs += 1;
    const batchLimit = this.options.batchLimit || MAX_BATCH_LOG;
    if (this.numberOfLogs >= batchLimit) {
      if (this.sendLokiLogsInterval) {
        clearInterval(this.sendLokiLogsInterval);
      }
      await this.sendLokiLogs();

      this.sendLokiLogsInterval = setInterval(async () => {
        await this.sendLokiLogs();
      }, (this.options.interval || MAX_BATCH_INTERVAL_S) * 1000);
    }
  };

  /**
   * Clear timeout and interval and send last logs before closing the transport
   */
  end = async (): Promise<void> => {
    if (this.sendLokiLogsInterval) {
      clearInterval(this.sendLokiLogsInterval);
    }
    await this.sendLokiLogs();
    if (this.mustRenewTokenTimeout) {
      clearTimeout(this.mustRenewTokenTimeout);
    }
  };
}

const createTransport = async (opts: LokiOptions) => {
  const lokiTransport = new LokiTransport(opts);
  return build(
    async source => {
      for await (const log of source) {
        await lokiTransport.addLokiLogs(log);
      }
    },
    {
      close: async () => {
        await lokiTransport.end();
      }
    }
  );
};

export default createTransport;
