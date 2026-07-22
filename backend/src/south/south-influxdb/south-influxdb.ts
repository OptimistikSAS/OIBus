import { InfluxDB } from '@influxdata/influxdb-client';
import { InfluxDBClient } from '@influxdata/influxdb3-client';
import { InfluxDB as InfluxDBv1 } from 'influx';
import SouthConnector from '../south-connector';
import { logQuery } from '../../service/utils';
import { encryptionService } from '../../service/encryption.service';
import { Instant } from '../../../shared/model/types';
import { SouthHistoryQuery } from '../south-interface';
import { DateTime } from 'luxon';
import { SouthInfluxDBItemSettings, SouthInfluxDBSettings, SouthItemSettings } from '../../../shared/model/south-settings.model';
import { OIBusConnectionTestResult, OIBusContent } from '../../../shared/model/engine.model';
import { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { SouthConnectorItemTestingSettings } from '../../../shared/model/south-connector.model';

export default class SouthInfluxDB extends SouthConnector<SouthInfluxDBSettings, SouthInfluxDBItemSettings> implements SouthHistoryQuery {
  constructor(
    connector: SouthConnectorEntity<SouthInfluxDBSettings, SouthInfluxDBItemSettings>,
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

  override testConnection(): Promise<OIBusConnectionTestResult> {
    const { version } = this.connector.settings;
    switch (version) {
      case '1':
        return this.testConnectionV1();
      case '2':
        return this.testConnectionV2();
      case '3':
        return this.testConnectionV3();
      default:
        return Promise.reject(new Error(`Unsupported InfluxDB version: ${version as string}`));
    }
  }

  private async testConnectionV1(): Promise<OIBusConnectionTestResult> {
    const { host, port, database, username } = this.connector.settings;
    const password = this.connector.settings.password ? encryptionService.decryptText(this.connector.settings.password) : undefined;

    const client = new InfluxDBv1({
      host: host!,
      port: port!,
      database: database!,
      username: username ?? undefined,
      password: password ?? undefined,
      protocol: this.connector.settings.protocol ?? 'http'
    });

    let pingResults: Awaited<ReturnType<typeof client.ping>>;
    try {
      pingResults = await client.ping(5000);
    } catch (error: unknown) {
      throw new Error(`Could not connect to InfluxDB v1 at ${host}:${port}. ${(error as Error).message}`);
    }

    const online = pingResults.some(p => p.online);
    if (!online) {
      throw new Error(`InfluxDB v1 at ${host}:${port} is not responding`);
    }

    const items: Array<{ key: string; value: string }> = [{ key: 'Host', value: `${host}:${port}` }];
    const version = pingResults.find(p => p.online)?.version;
    if (version) {
      items.unshift({ key: 'Version', value: String(version) });
    }

    return { items };
  }

  private async testConnectionV2(): Promise<OIBusConnectionTestResult> {
    const { url, organisation } = this.connector.settings;
    const token = this.connector.settings.token ? encryptionService.decryptText(this.connector.settings.token) : '';

    const client = new InfluxDB({ url: url!, token });
    const queryApi = client.getQueryApi(organisation!);

    let rowCount = 0;
    try {
      await new Promise<void>((resolve, reject) => {
        queryApi.queryRows('buckets()', {
          next: () => {
            rowCount++;
          },
          error: reject,
          complete: resolve
        });
      });
    } catch (error: unknown) {
      throw new Error(`Could not connect to InfluxDB v2 at ${url}. ${(error as Error).message}`);
    }

    return { items: [{ key: 'Buckets', value: String(rowCount) }] };
  }

  private async testConnectionV3(): Promise<OIBusConnectionTestResult> {
    const { url, database } = this.connector.settings;
    const token = this.connector.settings.token ? encryptionService.decryptText(this.connector.settings.token) : '';

    const client = new InfluxDBClient({ host: url!, token, database: database! });
    try {
      for await (const _ of client.query('SELECT 1', database!)) {
        break;
      }
      return {
        items: [
          { key: 'Database', value: database! },
          { key: 'Connected', value: 'true' }
        ]
      };
    } catch (error: unknown) {
      throw new Error(`Could not connect to InfluxDB v3 at ${url}. ${(error as Error).message}`);
    } finally {
      await client.close();
    }
  }

  override async testItem(
    item: SouthConnectorItemEntity<SouthInfluxDBItemSettings>,
    testingSettings: SouthConnectorItemTestingSettings
  ): Promise<OIBusContent> {
    const startTime = testingSettings.history!.startTime;
    const endTime = testingSettings.history!.endTime;
    const result = await this.queryData(item, startTime, endTime);
    const content = JSON.stringify(result);
    return { type: 'any-content', content };
  }

  async historyQuery(
    items: Array<SouthConnectorItemEntity<SouthInfluxDBItemSettings>>,
    startTime: Instant,
    endTime: Instant
  ): Promise<{ trackedInstant: Instant | null; value: unknown | null }> {
    const item = items[0];

    const startRequest = DateTime.now();
    const result = await this.queryData(item, startTime, endTime);
    const requestDuration = DateTime.now().toMillis() - startRequest.toMillis();

    if (result.length === 0) {
      this.logger.debug(`No result found for item ${item.name}. Request done in ${requestDuration} ms`);
      return { trackedInstant: null, value: null };
    }

    this.logger.info(`Found ${result.length} results for item ${item.name} in ${requestDuration} ms`);
    const maxInstant = this.extractMaxInstant(result);
    await this.addContent({ type: 'any-content', content: JSON.stringify(result) }, startRequest.toUTC().toISO(), [item]);
    return { trackedInstant: maxInstant, value: result[result.length - 1] };
  }

  // InfluxDB returns rows in ascending time order by default (InfluxQL, Flux, IOx SQL),
  // so the last row always carries the most recent timestamp.
  private extractMaxInstant(results: Array<Record<string, string | number>>): Instant | null {
    const field = this.connector.settings.version === '2' ? '_time' : 'time';
    const v = results[results.length - 1]?.[field];
    return typeof v === 'string' && v.length > 0 ? (v as Instant) : null;
  }

  queryData(
    item: SouthConnectorItemEntity<SouthInfluxDBItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Array<Record<string, string | number>>> {
    switch (this.connector.settings.version) {
      case '1':
        return this.queryDataV1(item, startTime, endTime);
      case '2':
        return this.queryDataV2(item, startTime, endTime);
      case '3':
        return this.queryDataV3(item, startTime, endTime);
      default:
        return Promise.reject(new Error(`Unsupported InfluxDB version: ${this.connector.settings.version as string}`));
    }
  }

  private async queryDataV1(
    item: SouthConnectorItemEntity<SouthInfluxDBItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Array<Record<string, string | number>>> {
    const { host, port, database, username } = this.connector.settings;
    const password = this.connector.settings.password ? encryptionService.decryptText(this.connector.settings.password) : undefined;

    logQuery(item.settings.query, startTime, endTime, this.logger);

    const query = item.settings.query.replace(/@StartTime/g, startTime).replace(/@EndTime/g, endTime);

    const client = new InfluxDBv1({
      host: host!,
      port: port!,
      database: database!,
      username: username ?? undefined,
      password: password ?? undefined,
      protocol: this.connector.settings.protocol ?? 'http',
      pool: { requestTimeout: item.settings.requestTimeout }
    });

    const results = await client.query(query);
    // influx returns timestamps as INanoDate (extends Date) — normalise to ISO strings
    return (results as unknown as Array<Record<string, unknown>>).map(row => {
      const normalised: Record<string, string | number> = {};
      for (const [key, value] of Object.entries(row)) {
        if (value instanceof Date) {
          normalised[key] = (value as Date).toISOString();
        } else if (typeof value === 'string' || typeof value === 'number') {
          normalised[key] = value;
        }
      }
      return normalised;
    });
  }

  private async queryDataV2(
    item: SouthConnectorItemEntity<SouthInfluxDBItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Array<Record<string, string | number>>> {
    const { url, organisation } = this.connector.settings;
    const token = this.connector.settings.token ? encryptionService.decryptText(this.connector.settings.token) : '';

    logQuery(item.settings.query, startTime, endTime, this.logger);

    const query = item.settings.query.replace(/@StartTime/g, startTime).replace(/@EndTime/g, endTime);

    const client = new InfluxDB({ url: url!, token });
    const queryApi = client.getQueryApi(organisation!);

    const rows: Array<Record<string, string | number>> = [];
    await new Promise<void>((resolve, reject) => {
      queryApi.queryRows(query, {
        next: (row, tableMeta) => {
          rows.push(tableMeta.toObject(row) as Record<string, string | number>);
        },
        error: reject,
        complete: resolve
      });
    });
    return rows;
  }

  private async queryDataV3(
    item: SouthConnectorItemEntity<SouthInfluxDBItemSettings>,
    startTime: Instant,
    endTime: Instant
  ): Promise<Array<Record<string, string | number>>> {
    const { url, database } = this.connector.settings;
    const token = this.connector.settings.token ? encryptionService.decryptText(this.connector.settings.token) : '';

    logQuery(item.settings.query, startTime, endTime, this.logger);

    const query = item.settings.query.replace(/@StartTime/g, startTime).replace(/@EndTime/g, endTime);

    const client = new InfluxDBClient({ host: url!, token, database: database! });
    try {
      const rows: Array<Record<string, string | number>> = [];
      for await (const row of client.query(query, database!)) {
        rows.push(row as Record<string, string | number>);
      }
      return rows;
    } finally {
      await client.close();
    }
  }
}
