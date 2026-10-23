import { S7Endpoint, S7ItemGroup } from '@st-one-io/nodes7';
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
import SouthConnector from '../south-connector';
import { SouthDirectQuery } from '../south-interface';

const CONNECTION_TYPE_SRC_TSAP: Record<SouthS7SettingsConnectionType, number> = {
  PG: 0x0100,
  OP: 0x0200,
  S7Basic: 0x0300
};

/**
 * Class SouthS7 - Provides instruction for Siemens S7 PLC connection using ISO-on-TCP
 */
export default class SouthS7 extends SouthConnector<SouthS7Settings, SouthS7ItemSettings> implements SouthDirectQuery {
  private endpoint: S7Endpoint | null = null;
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

  private getSrcTSAP(connectionType: SouthS7SettingsConnectionType): number {
    return CONNECTION_TYPE_SRC_TSAP[connectionType];
  }

  private createEndpoint(): S7Endpoint {
    return new S7Endpoint({
      host: this.connector.settings.host,
      port: this.connector.settings.port,
      rack: this.connector.settings.rack,
      slot: this.connector.settings.slot,
      srcTSAP: this.getSrcTSAP(this.connector.settings.connectionType),
      autoReconnect: 0,
      s7ConnOpts: { timeout: this.connector.settings.requestTimeout }
    });
  }

  /**
   * nodes7 has no connection timeout option (only a fixed 10 s one on the transport), so the connection is raced
   * against the connector's own timeout.
   */
  private async connectEndpoint(endpoint: S7Endpoint): Promise<void> {
    let timeout: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        endpoint.connect(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(
            () => reject(new Error(`Connection timeout after ${this.connector.settings.connectTimeout} ms`)),
            this.connector.settings.connectTimeout
          );
        })
      ]);
    } finally {
      clearTimeout(timeout);
    }
  }

  override async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    try {
      this.logger.debug(`Connecting S7 endpoint into ${this.connector.settings.host}:${this.connector.settings.port}`);
      this.endpoint = this.createEndpoint();
      await this.connectEndpoint(this.endpoint);
      // Detect unexpected disconnections between scan cycles (server-side
      // timeout, network interruption, etc.) and reconnect immediately so the
      // next scan cycle does not fail on a dead endpoint.
      const onUnexpectedDisconnect = async () => {
        if (this.disconnecting) return;
        this.logger.warn(`S7 endpoint disconnected unexpectedly. Reconnecting in ${this.connector.settings.retryInterval} ms`);
        await this.disconnect();
        if (this.connector.enabled) {
          this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
        }
      };
      this.endpoint.once('disconnect', onUnexpectedDisconnect);
      this.endpoint.once('error', onUnexpectedDisconnect);
      this.logger.info(`S7 endpoint connected to ${this.connector.settings.host}:${this.connector.settings.port}`);
      await super.connect();
    } catch (error: unknown) {
      this.logger.error(`S7 endpoint error: ${(error as Error).message}`);
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
    if (this.endpoint) {
      this.endpoint.removeAllListeners();
      try {
        await this.endpoint.disconnect();
      } catch (error: unknown) {
        this.logger.error(`Error while disconnecting S7 endpoint: ${(error as Error).message}`);
      }
      this.endpoint = null;
    }
    await super.disconnect();
    this.disconnecting = false;
  }

  override async testConnection(): Promise<OIBusConnectionTestResult> {
    const endpoint = this.createEndpoint();
    try {
      await this.connectEndpoint(endpoint);
      return {
        items: [{ key: 'RemoteAddress', value: `${this.connector.settings.host}:${this.connector.settings.port}` }]
      };
    } catch (error: unknown) {
      switch ((error as { code: string; message: string }).code) {
        case 'ENOTFOUND':
        case 'ECONNREFUSED':
          throw new Error(`Please check host and port: ${(error as Error).message}`);
        default:
          throw new Error(`Unable to connect: ${(error as Error).message}`);
      }
    } finally {
      await endpoint.disconnect().catch(() => undefined);
    }
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthS7ItemSettings>,
    _testingSettings: SouthConnectorItemTestingSettings
  ): Promise<SouthConnectorItemQueryResult> {
    const endpoint = this.createEndpoint();
    try {
      const connectStart = DateTime.now().toMillis();
      await this.connectEndpoint(endpoint);
      const connectionDuration = DateTime.now().toMillis() - connectStart;
      const queryStart = DateTime.now().toMillis();
      const group = new S7ItemGroup(endpoint);
      group.setTranslationCB(() => item.settings.address);
      group.addItems([item.name]);
      const values = await group.readAllItems();
      const queryDuration = DateTime.now().toMillis() - queryStart;
      const dataValues: Array<OIBusPointRecord> = [
        {
          pointId: item.name,
          timestamp: DateTime.now().toUTC().toISO(),
          value: String(values[item.name])
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
    } catch (error: unknown) {
      switch ((error as { code: string; message: string }).code) {
        case 'ENOTFOUND':
        case 'ECONNREFUSED':
          throw new Error(`Please check host and port: ${(error as Error).message}`);
        default:
          throw new Error(`Unable to connect: ${(error as Error).message}`);
      }
    } finally {
      await endpoint.disconnect().catch(() => undefined);
    }
  }

  async directQuery(items: Array<SouthConnectorItemEntity<SouthS7ItemSettings>>): Promise<OIBusPointRecord | null> {
    if (!this.endpoint || !this.endpoint.isConnected) {
      throw new Error('Could not read address: S7 client not set');
    }
    const dataValues: Array<OIBusPointRecord> = [];
    try {
      const startRequest = DateTime.now();
      const timestamp = startRequest.toUTC().toISO();
      const group = new S7ItemGroup(this.endpoint);
      const addressByName = new Map<string, string>(items.map(item => [item.name, item.settings.address]));
      group.setTranslationCB(name => addressByName.get(name));
      group.addItems(items.map(item => item.name));
      const values = await group.readAllItems();
      group.destroy();

      const readEntries = items.map(item => ({ item, value: String(values[item.name]) }));
      const cachedItems = this.applyCachingStrategy(readEntries, entry => ({
        item: entry.item,
        value: entry.value,
        timestamp: timestamp!
      }));
      for (const { item, value } of cachedItems) {
        dataValues.push({ pointId: item.name, timestamp, value });
      }

      await this.addContent(
        { type: 'record-list', content: dataValues },
        startRequest.toUTC().toISO(),
        cachedItems.map(entry => entry.item)
      );
    } catch (error: unknown) {
      await this.disconnect();
      if (!this.disconnecting && this.connector.enabled && !this.reconnectTimeout) {
        this.reconnectTimeout = setTimeout(this.connect.bind(this), this.connector.settings.retryInterval);
      }
      throw error;
    }
    return dataValues.length > 0 ? dataValues[dataValues.length - 1] : null;
  }
}
