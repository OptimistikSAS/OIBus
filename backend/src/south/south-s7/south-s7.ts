import { DateTime } from 'luxon';

import { OIBusContent, OIBusPointRecord } from '../../../shared/model/common/content.model';
import {
  SouthItemSettings,
  SouthS7ItemSettings,
  SouthS7Settings,
  SouthS7SettingsConnectionType
} from '../../../shared/model/connector/south-settings.model';
import { OIBusConnectionTestResult } from '../../../shared/model/domain/engine.model';
import { SouthConnectorItemQueryResult, SouthConnectorItemTestingSettings } from '../../../shared/model/domain/south-connector.model';

import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import { Instant } from '../../model/types';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { getErrorMessage } from '../../service/utils';
import SouthConnector from '../south-connector';
import { SouthDirectQuery } from '../south-interface';
import { parseS7Address, S7Address } from './s7-client/s7-address';
import S7Client from './s7-client/s7-client';
import { remoteTSAP } from './s7-client/s7-protocol';
import { formatS7Value } from './s7-client/s7-values';

// The connection resource of the remote TSAP, high byte of the TSAP the PLC is addressed with
const CONNECTION_RESOURCES: Record<SouthS7SettingsConnectionType, number> = {
  PG: 0x01,
  OP: 0x02,
  S7Basic: 0x03
};
const LOCAL_TSAP = 0x0100;

/**
 * Class SouthS7 - Provides instruction for Siemens S7 PLC connection using ISO-on-TCP
 */
export default class SouthS7 extends SouthConnector<SouthS7Settings, SouthS7ItemSettings> implements SouthDirectQuery {
  private client: S7Client | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private disconnecting = false;

  constructor(
    connector: SouthConnectorEntity<SouthS7Settings, SouthS7ItemSettings>,
    engineAddContentCallback: (
      southId: string,
      data: OIBusContent,
      queryTime: Instant,
      items: Array<SouthConnectorItemEntity<SouthItemSettings>>
    ) => Promise<void>,
    southCacheRepository: SouthCacheRepository,
    cacheFolderPath: string
  ) {
    super(connector, engineAddContentCallback, southCacheRepository, cacheFolderPath);
  }

  private createClient(): S7Client {
    const settings = this.connector.settings;
    return new S7Client({
      host: settings.host,
      port: settings.port,
      localTSAP: LOCAL_TSAP,
      remoteTSAP: remoteTSAP(CONNECTION_RESOURCES[settings.connectionType], settings.rack, settings.slot),
      connectTimeout: settings.connectTimeout,
      requestTimeout: settings.requestTimeout
    });
  }

  override async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    try {
      this.logger.debug(`Connecting S7 client to ${this.connector.settings.host}:${this.connector.settings.port}`);
      this.client = this.createClient();
      await this.client.connect();
      // Detect unexpected disconnections between scan cycles (server-side
      // timeout, network interruption, etc.) and reconnect immediately so the
      // next scan cycle does not fail on a dead connection.
      this.client.once('disconnect', async (error: Error) => {
        if (this.disconnecting) return;
        this.logger.warn(`S7 connection lost (${error.message}). Reconnecting in ${this.connector.settings.retryInterval} ms`);
        await this.disconnect();
        if (this.connector.enabled) {
          this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
        }
      });
      this.logger.info(
        `S7 client connected to ${this.connector.settings.host}:${this.connector.settings.port} (PDU size ${this.client.pduSize})`
      );
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(`S7 connection error: ${getErrorMessage(error)}`);
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
    }
  }

  async disconnect(): Promise<void> {
    this.disconnecting = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.client) {
      this.client.removeAllListeners();
      try {
        await this.client.disconnect();
      } catch (error: unknown) {
        this.logger.error(`Error while disconnecting S7 client: ${getErrorMessage(error)}`);
      }
      this.client = null;
    }
    await super.disconnect();
    this.disconnecting = false;
  }

  /**
   * Connects a temporary client, for the connection and item tests
   */
  private async connectTestClient(): Promise<S7Client> {
    const client = this.createClient();
    try {
      await client.connect();
      return client;
    } catch (error: unknown) {
      switch ((error as { code?: string }).code) {
        case 'ENOTFOUND':
        case 'ECONNREFUSED':
          throw new Error(`Please check host and port: ${getErrorMessage(error)}`);
        default:
          throw new Error(`Unable to connect: ${getErrorMessage(error)}`);
      }
    }
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    const client = await this.connectTestClient();
    const pduSize = client.pduSize;
    await client.disconnect().catch(() => undefined);
    return {
      items: [
        { key: 'RemoteAddress', value: `${this.connector.settings.host}:${this.connector.settings.port}` },
        { key: 'PDU size', value: String(pduSize) }
      ]
    };
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthS7ItemSettings>,
    _testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemQueryResult> {
    const address = parseS7Address(item.settings.address);
    const connectStart = DateTime.now().toMillis();
    const client = await this.connectTestClient();
    try {
      const connectionDuration = DateTime.now().toMillis() - connectStart;
      const queryStart = DateTime.now().toMillis();
      const [result] = await client.read([address]);
      const queryDuration = DateTime.now().toMillis() - queryStart;
      if ('error' in result) {
        throw new Error(`Could not read address "${item.settings.address}": ${result.error}`);
      }
      const dataValues: Array<OIBusPointRecord> = [
        {
          pointId: item.name,
          timestamp: DateTime.now().toUTC().toISO()!,
          value: formatS7Value(result.value)
        }
      ];
      return {
        result: {
          type: 'record-list',
          content: dataValues
        },
        connectionDuration,
        queryDuration
      };
    } finally {
      await client.disconnect().catch(() => undefined);
    }
  }

  async directQuery(items: Array<SouthConnectorItemEntity<SouthS7ItemSettings>>): Promise<OIBusPointRecord | null> {
    if (!this.client || !this.client.isConnected) {
      throw new Error('Could not read address: S7 client not set');
    }
    const toRead: Array<{ item: SouthConnectorItemEntity<SouthS7ItemSettings>; address: S7Address }> = [];
    for (const item of items) {
      try {
        toRead.push({ item, address: parseS7Address(item.settings.address) });
      } catch (error: unknown) {
        this.logger.error(`Item "${item.name}" skipped: ${getErrorMessage(error)}`);
      }
    }

    const startRequest = DateTime.now();
    const timestamp = startRequest.toUTC().toISO()!;
    let results: Awaited<ReturnType<S7Client['read']>>;
    try {
      results = await this.client.read(toRead.map(entry => entry.address));
    } catch (error: unknown) {
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
      throw error;
    }

    const readEntries: Array<{ item: SouthConnectorItemEntity<SouthS7ItemSettings>; value: string }> = [];
    results.forEach((result, index) => {
      const { item } = toRead[index];
      if ('error' in result) {
        this.logger.error(`Could not read item "${item.name}" at address "${item.settings.address}": ${result.error}`);
      } else {
        readEntries.push({ item, value: formatS7Value(result.value) });
      }
    });
    const cachedItems = this.applyCachingStrategy(readEntries, entry => ({ item: entry.item, value: entry.value, timestamp }));
    const dataValues: Array<OIBusPointRecord> = cachedItems.map(({ item, value }) => ({ pointId: item.name, timestamp, value }));
    await this.addContent(
      { type: 'record-list', content: dataValues },
      timestamp,
      cachedItems.map(entry => entry.item)
    );
    return dataValues.length > 0 ? dataValues[dataValues.length - 1] : null;
  }
}
