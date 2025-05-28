import build from 'pino-abstract-transport';

import { LogDTO, PinoLog } from '../../../shared/model/logs.model';
import { LogLevel, ScopeType } from '../../../shared/model/engine.model';
import { HTTPRequest, ReqProxyOptions } from '../http-request.utils';

const MAX_BATCH_LOG = 500;
const MAX_BATCH_INTERVAL_S = 60;
const LEVEL_FORMAT: Record<string, LogLevel> = {
  '10': 'TRACE',
  '20': 'DEBUG',
  '30': 'INFO',
  '40': 'WARN',
  '50': 'ERROR'
};

const SCOPE_TYPE_FORMAT: Record<ScopeType, LogLevel> = {
  south: 'SOUTH',
  north: 'NORTH',
  'history-query': 'HISTORY_QUERY',
  internal: 'INTERNAL',
  'web-server': 'WEB_SERVER'
};

interface OIAnalyticsOptions {
  interval: number;
  host: string;
  token: string;
  useProxy: boolean;
  proxyUrl?: string;
  proxyUsername?: string | null;
  proxyPassword?: string | null;
  acceptUnauthorized: boolean;
  batchLimit?: number;
}

/**
 * Class to support logging to OIAnalytics
 */
class OianalyticsTransport {
  private readonly options: OIAnalyticsOptions;
  private sendOIALogsInterval: NodeJS.Timeout | null = null;
  private batchLogs: Array<LogDTO> = [];
  private stopping = false;

  constructor(options: OIAnalyticsOptions) {
    this.options = options;
    if (this.options.host.endsWith('/')) {
      this.options.host = this.options.host.slice(0, this.options.host.length - 1);
    }

    const batchInterval = this.options.interval > MAX_BATCH_INTERVAL_S ? MAX_BATCH_INTERVAL_S : this.options.interval;
    this.sendOIALogsInterval = setInterval(
      async () => {
        await this.sendOIALogs();
      },
      (batchInterval || MAX_BATCH_INTERVAL_S) * 1000
    );
  }

  /**
   * Method used to send the log to OIAnalytics
   */
  sendOIALogs = async (): Promise<void> => {
    const logUrl = new URL('/api/oianalytics/oibus/logs', this.options.host);
    const dataBuffer = JSON.stringify(this.batchLogs);
    this.batchLogs = [];

    try {
      const response = await HTTPRequest(logUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: dataBuffer,
        auth: {
          type: 'bearer',
          token: this.options.token //TODO: is this encrypted? if not, it needs to be
        },
        proxy: this.getProxyOptions()
      });
      if (response.statusCode !== 200 && response.statusCode !== 201 && response.statusCode !== 204) {
        if (response.statusCode === 401) {
          console.error(`OIAnalytics authentication error on ${logUrl}: ${response.statusCode} - ${await response.body.text()}`);
        } else {
          console.error(`OIAnalytics fetch error on ${logUrl}: ${response.statusCode} - ${response.statusCode} with payload ${dataBuffer}`);
        }
      }
    } catch (error) {
      console.error(`Error when sending logs to ${logUrl}. ${error}`);
    }
  };

  private getProxyOptions(): ReqProxyOptions | undefined {
    if (!this.options.useProxy) {
      return;
    }
    if (!this.options.proxyUrl) {
      throw new Error('Proxy URL not specified');
    }

    const options: ReqProxyOptions = {
      url: this.options.proxyUrl
    };

    if (this.options.proxyUsername) {
      options.auth = {
        type: 'url',
        username: this.options.proxyUsername,
        password: this.options.proxyPassword
      };
    }

    return options;
  }

  /**
   * Store the log in the batch log array and send them immediately if the array is full
   */
  addLogs = async (log: PinoLog): Promise<void> => {
    if (this.stopping) return;
    this.batchLogs.push({
      timestamp: log.time,
      level: LEVEL_FORMAT[log.level],
      scopeType: SCOPE_TYPE_FORMAT[log.scopeType],
      scopeId: log.scopeId || null,
      scopeName: log.scopeName || null,
      message: log.msg
    });
    const batchLimit = this.options.batchLimit || MAX_BATCH_LOG;
    if (this.batchLogs.length >= batchLimit) {
      if (this.sendOIALogsInterval) {
        clearInterval(this.sendOIALogsInterval);
        this.sendOIALogsInterval = null;
      }
      await this.sendOIALogs();

      if (!this.stopping) {
        const batchInterval = this.options.interval > MAX_BATCH_INTERVAL_S ? MAX_BATCH_INTERVAL_S : this.options.interval;
        this.sendOIALogsInterval = setInterval(async () => {
          await this.sendOIALogs();
        }, batchInterval * 1000);
      }
    }
  };

  /**
   * Clear timeout and interval and send last logs before closing the transport
   */
  end = async (): Promise<void> => {
    this.stopping = true;
    if (this.sendOIALogsInterval) {
      clearInterval(this.sendOIALogsInterval);
    }
    await this.sendOIALogs();
  };
}

const createTransport = async (opts: OIAnalyticsOptions) => {
  const oianalyticsTransport = new OianalyticsTransport(opts);
  return build(
    async source => {
      for await (const log of source) {
        await oianalyticsTransport.addLogs(log);
      }
    },
    {
      close: async () => {
        await oianalyticsTransport.end();
      }
    }
  );
};

export default createTransport;
