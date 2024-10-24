import SouthConnector from '../south-connector';
import EncryptionService from '../../service/encryption.service';
import pino from 'pino';
import { Instant } from '../../../shared/model/types';
import { DateTime } from 'luxon';
import { QueriesHistory } from '../south-interface';
import { SouthOracleSettings, SouthPIItemSettings, SouthPISettings } from '../../../shared/model/south-settings.model';
import fetch from 'node-fetch';
import { OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity, SouthThrottlingSettings } from '../../model/south-connector.model';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import ScanModeRepository from '../../repository/config/scan-mode.repository';

/**
 * Class SouthPI - Run a PI Agent to connect to a PI server.
 * This connector communicates with the Agent through a HTTP connection
 */
export default class SouthPI extends SouthConnector<SouthPISettings, SouthPIItemSettings> implements QueriesHistory {
  private connected = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    connector: SouthConnectorEntity<SouthPISettings, SouthPIItemSettings>,
    engineAddContentCallback: (southId: string, data: OIBusContent) => Promise<void>,
    encryptionService: EncryptionService,
    southConnectorRepository: SouthConnectorRepository,
    southCacheRepository: SouthCacheRepository,
    scanModeRepository: ScanModeRepository,
    logger: pino.Logger,
    baseFolder: string
  ) {
    super(
      connector,
      engineAddContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      baseFolder
    );
  }

  async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      const headers: Record<string, string> = {};
      headers['Content-Type'] = 'application/json';
      const fetchOptions = {
        method: 'PUT',
        headers
      };

      await fetch(`${this.connector.settings.agentUrl}/api/pi/${this.connector.id}/connect`, fetchOptions);
      this.connected = true;
      await super.connect();
    } catch (error) {
      this.logger.error(
        `Error while sending connection HTTP request into agent. Reconnecting in ${this.connector.settings.retryInterval} ms. ${error}`
      );
      if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
        await this.disconnect();
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
    }
  }

  async testConnection(): Promise<void> {
    const headers: Record<string, string> = {};
    headers['Content-Type'] = 'application/json';
    const fetchOptions = {
      method: 'PUT',
      headers
    };
    const response = await fetch(`${this.connector.settings.agentUrl!}/api/pi/${this.connector.id}/connect`, fetchOptions);
    if (response.status === 200) {
      await fetch(`${this.connector.settings.agentUrl}/api/pi/${this.connector.id}/disconnect`, { method: 'DELETE' });
    } else if (response.status === 400) {
      const errorMessage = await response.text();
      throw new Error(`Error occurred when sending connect command to remote agent with status ${response.status}. ${errorMessage}`);
    } else {
      throw new Error(`Error occurred when sending connect command to remote agent with status ${response.status}`);
    }
  }

  override async testItem(item: SouthConnectorItemEntity<SouthPIItemSettings>, callback: (data: OIBusContent) => void): Promise<void> {
    await this.connect();
    const content: OIBusContent = { type: 'time-values', content: [] };

    const startTime = DateTime.now()
      .minus(600 * 1000)
      .toUTC()
      .toISO() as Instant;
    const endTime = DateTime.now().toUTC().toISO() as Instant;

    const headers: Record<string, string> = {};
    headers['Content-Type'] = 'application/json';
    const fetchOptions = {
      method: 'PUT',
      body: JSON.stringify({
        startTime,
        endTime,
        items: [
          {
            name: item.name,
            type: item.settings.type,
            piPoint: item.settings.piPoint,
            piQuery: item.settings.piQuery
          }
        ]
      }),
      headers
    };
    const response = await fetch(`${this.connector.settings.agentUrl}/api/pi/${this.connector.id}/read`, fetchOptions);
    if (response.status === 200) {
      const result: {
        recordCount: number;
        content: Array<OIBusTimeValue>;
        maxInstantRetrieved: Instant;
      } = (await response.json()) as {
        recordCount: number;
        content: Array<OIBusTimeValue>;
        maxInstantRetrieved: string;
      };
      content.content = result.content;
      await this.disconnect();
    } else {
      await this.disconnect();
      throw new Error(`Error occurred when sending connect command to remote agent. ${response.status}`);
    }
    callback(content);
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into the cache and send it to the engine.
   */
  async historyQuery(items: Array<SouthConnectorItemEntity<SouthPIItemSettings>>, startTime: Instant, endTime: Instant): Promise<Instant> {
    let updatedStartTime = startTime;
    this.logger.debug(`Requesting ${items.length} items between ${startTime} and ${endTime}`);
    const startRequest = DateTime.now().toMillis();
    const headers: Record<string, string> = {};
    headers['Content-Type'] = 'application/json';
    const fetchOptions = {
      method: 'PUT',
      body: JSON.stringify({
        startTime,
        endTime,
        items: items.map(item => ({
          name: item.name,
          type: item.settings.type,
          piPoint: item.settings.piPoint,
          piQuery: item.settings.piQuery
        }))
      }),
      headers
    };
    const response = await fetch(`${this.connector.settings.agentUrl}/api/pi/${this.connector.id}/read`, fetchOptions);
    if (response.status === 200) {
      const result: {
        recordCount: number;
        content: Array<OIBusTimeValue>;
        logs: Array<string>;
        maxInstantRetrieved: Instant;
      } = (await response.json()) as {
        recordCount: number;
        content: Array<OIBusTimeValue>;
        logs: Array<string>;
        maxInstantRetrieved: string;
      };
      const requestDuration = DateTime.now().toMillis() - startRequest;

      if (result.logs.length > 0) {
        for (const log of result.logs) {
          this.logger.warn(log);
        }
      }
      if (result.content.length > 0) {
        this.logger.debug(`Found ${result.recordCount} results for ${items.length} items in ${requestDuration} ms`);
        await this.addContent({ type: 'time-values', content: result.content });
        if (result.maxInstantRetrieved > updatedStartTime) {
          updatedStartTime = result.maxInstantRetrieved;
        }
      } else {
        this.logger.debug(`No result found. Request done in ${requestDuration} ms`);
      }
    } else if (response.status === 400) {
      const errorMessage = await response.text();
      throw new Error(`Error occurred when querying remote agent with status ${response.status}: ${errorMessage}`);
    } else {
      throw new Error(`Error occurred when querying remote agent with status ${response.status}`);
    }
    return updatedStartTime;
  }

  getThrottlingSettings(settings: SouthPISettings): SouthThrottlingSettings {
    return {
      maxReadInterval: settings.throttling.maxReadInterval,
      readDelay: settings.throttling.readDelay
    };
  }

  getMaxInstantPerItem(settings: SouthPISettings): boolean {
    return settings.throttling.maxInstantPerItem;
  }

  getOverlap(settings: SouthPISettings): number {
    return settings.throttling.overlap;
  }

  async disconnect(): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.connected) {
      try {
        const fetchOptions = { method: 'DELETE' };
        await fetch(`${this.connector.settings.agentUrl}/api/pi/${this.connector.id}/disconnect`, fetchOptions);
      } catch (error) {
        this.logger.error(`Error while sending disconnection HTTP request into agent. ${error}`);
      }
    }
    this.connected = false;
    await super.disconnect();
    this.disconnecting = false;
  }
}
