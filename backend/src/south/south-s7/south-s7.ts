import { S7Endpoint, S7ItemGroup } from '@st-one-io/nodes7';

import SouthConnector from '../south-connector';
import { SouthDirectQuery } from '../south-interface';
import { DateTime } from 'luxon';
import {
  SouthItemSettings,
  SouthS7ItemSettings,
  SouthS7Settings,
  SouthS7SettingsConnectionType
} from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent, OIBusTimeValue } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';
import { Instant } from '../../model/types';

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

  override async connect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    try {
      this.logger.debug(`Connecting S7 endpoint into ${this.connector.settings.host}:${this.connector.settings.port}`);
      this.endpoint = new S7Endpoint({
        host: this.connector.settings.host,
        port: this.connector.settings.port,
        rack: this.connector.settings.rack,
        slot: this.connector.settings.slot,
        srcTSAP: this.getSrcTSAP(this.connector.settings.connectionType),
        autoReconnect: 0
      });
      await this.endpoint.connect();
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
    const endpoint = new S7Endpoint({
      host: this.connector.settings.host,
      port: this.connector.settings.port,
      rack: this.connector.settings.rack,
      slot: this.connector.settings.slot,
      srcTSAP: this.getSrcTSAP(this.connector.settings.connectionType),
      autoReconnect: 0
    });
    try {
      await endpoint.connect();
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
  ): Promise<OIBusContent> {
    const endpoint = new S7Endpoint({
      host: this.connector.settings.host,
      port: this.connector.settings.port,
      rack: this.connector.settings.rack,
      slot: this.connector.settings.slot,
      srcTSAP: this.getSrcTSAP(this.connector.settings.connectionType),
      autoReconnect: 0
    });
    try {
      await endpoint.connect();
      const group = new S7ItemGroup(endpoint);
      group.setTranslationCB(() => item.settings.address);
      group.addItems([item.name]);
      const values = await group.readAllItems();
      const dataValues: Array<OIBusTimeValue> = [
        {
          pointId: item.name,
          timestamp: DateTime.now().toUTC().toISO(),
          data: { value: String(values[item.name]) }
        }
      ];
      return {
        type: 'time-values',
        content: dataValues
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

  async directQuery(items: Array<SouthConnectorItemEntity<SouthS7ItemSettings>>): Promise<OIBusTimeValue | null> {
    if (!this.endpoint || !this.endpoint.isConnected) {
      throw new Error('Could not read address: S7 client not set');
    }
    const dataValues: Array<OIBusTimeValue> = [];
    try {
      const startRequest = DateTime.now();
      const timestamp = startRequest.toUTC().toISO();
      const group = new S7ItemGroup(this.endpoint);
      const addressByName = new Map<string, string>(items.map(item => [item.name, item.settings.address]));
      group.setTranslationCB(name => addressByName.get(name));
      group.addItems(items.map(item => item.name));
      const values = await group.readAllItems();
      group.destroy();

      for (const item of items) {
        dataValues.push({ pointId: item.name, timestamp, data: { value: String(values[item.name]) } });
      }

      await this.addContent({ type: 'time-values', content: dataValues }, startRequest.toUTC().toISO(), items);
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
