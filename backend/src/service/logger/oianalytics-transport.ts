import build from 'pino-abstract-transport';

import { ScopeType } from '../../../shared/model/logs.model';
import { CryptoSettings } from '../../../shared/model/engine.model';
import { HTTPRequest } from '../http-request.utils';
import { encryptionService } from '../encryption.service';
import { PinoLog } from '../../model/logs.model';
import { Instant } from '../../model/types';
import { buildHttpOptions, getUrl } from '../utils-oianalytics';
import { OIAnalyticsRegistration } from '../../model/oianalytics-registration.model';

interface OIAnalyticsLog {
  message: string;
  scopeType: 'SOUTH' | 'NORTH' | 'HISTORY_QUERY' | 'INTERNAL' | 'WEB_SERVER';
  scopeId: string | null;
  scopeName: string | null;
  timestamp: Instant;
  level: 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
}

const MAX_BATCH_LOG = 500;
const MAX_BATCH_INTERVAL_S = 60;
const LEVEL_FORMAT: Record<string, 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'> = {
  '10': 'TRACE',
  '20': 'DEBUG',
  '30': 'INFO',
  '40': 'WARN',
  '50': 'ERROR'
};
const LOGS_OIANALYTICS_ENDPOINT = '/api/oianalytics/oibus/logs';

const SCOPE_TYPE_FORMAT: Record<ScopeType, 'SOUTH' | 'NORTH' | 'HISTORY_QUERY' | 'INTERNAL' | 'WEB_SERVER'> = {
  south: 'SOUTH',
  north: 'NORTH',
  'history-query': 'HISTORY_QUERY',
  internal: 'INTERNAL',
  'web-server': 'WEB_SERVER'
};

interface OIAnalyticsOptions {
  registrationSettings: OIAnalyticsRegistration;
  interval: number;
  batchLimit?: number;
  cryptoSettings: CryptoSettings;
  certsFolder: string;
}

/**
 * Class to support logging to OIAnalytics
 */
class OianalyticsTransport {
  private readonly options: OIAnalyticsOptions;
  private sendOIALogsInterval: NodeJS.Timeout | null = null;
  private batchLogs: Array<OIAnalyticsLog> = [];
  private stopping = false;

  constructor(options: OIAnalyticsOptions) {
    this.options = options;
    if (this.options.registrationSettings.host.endsWith('/')) {
      this.options.registrationSettings.host = this.options.registrationSettings.host.slice(
        0,
        this.options.registrationSettings.host.length - 1
      );
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
    const url = getUrl(LOGS_OIANALYTICS_ENDPOINT, this.options.registrationSettings.host, {
      useApiGateway: this.options.registrationSettings.useApiGateway,
      apiGatewayBaseEndpoint: this.options.registrationSettings.apiGatewayBaseEndpoint
    });
    const dataBuffer = JSON.stringify(this.batchLogs);
    this.batchLogs = [];

    const httpOptions = await buildHttpOptions('POST', true, this.options.registrationSettings, null, 30000, null);
    httpOptions.body = dataBuffer;
    (httpOptions.headers! as Record<string, string>)['Content-Type'] = 'application/json';

    try {
      const response = await HTTPRequest(url, httpOptions);
      if (response.statusCode !== 200 && response.statusCode !== 201 && response.statusCode !== 204) {
        if (response.statusCode === 401) {
          console.error(`OIAnalytics authentication error on ${url}: ${response.statusCode} - ${await response.body.text()}`);
        } else {
          console.error(`OIAnalytics fetch error on ${url}: ${response.statusCode} - ${response.statusCode} with payload ${dataBuffer}`);
        }
      }
    } catch (error) {
      console.error(`Error when sending logs to ${url}. ${error}`);
    }
  };

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
      this.sendOIALogsInterval = null;
    }
    await this.sendOIALogs();
  };
}

const createTransport = async (opts: OIAnalyticsOptions) => {
  const oianalyticsTransport = new OianalyticsTransport(opts);
  await encryptionService.init(opts.cryptoSettings, opts.certsFolder);
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
