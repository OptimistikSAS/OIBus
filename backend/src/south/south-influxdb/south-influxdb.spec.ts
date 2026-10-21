import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { OIBusContent } from '../../../shared/model/common/content.model';
import type {
  SouthInfluxDBItemSettings,
  SouthInfluxDBSettings,
  SouthItemSettings
} from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type SouthInfluxDBClass from './south-influxdb';

const nodeRequire = createRequire(import.meta.url);

type Row = Record<string, unknown>;
interface QueryRowsObserver {
  next: (row: Array<unknown>, meta: { toObject: (row: Array<unknown>) => Row }) => void;
  error: (error: Error) => void;
  complete: () => void;
}

// v2 queryRows() implementations: stream the given rows, or fail
const streamRows =
  (...rows: Array<Row>) =>
  (_query: string, { next, complete }: QueryRowsObserver) => {
    for (const row of rows) next([], { toObject: () => row });
    complete();
  };
const failRows = (message: string) => (_query: string, observer: QueryRowsObserver) => observer.error(new Error(message));

// v3 query() implementations: yield the given rows, or fail while iterating
const yieldRows =
  (...rows: Array<Row>) =>
  (_query: string, _database?: string): AsyncGenerator<Row> =>
    (async function* () {
      yield* rows;
    })();
const failYield =
  (message: string) =>
  (_query: string, _database?: string): AsyncGenerator<Row> =>
    (async function* () {
      throw new Error(message);
    })();

const baseItem: SouthConnectorItemEntity<SouthInfluxDBItemSettings> = {
  id: 'id1',
  name: 'item1',
  enabled: true,
  settings: {
    query: "SELECT * FROM measurement WHERE time > '@StartTime' AND time <= '@EndTime'",
    requestTimeout: 15000
  },
  scanMode: testData.scanMode.list[0],
  group: null,
  syncWithGroup: false,
  maxReadInterval: 3600,
  readDelay: 0,
  startTimeOffset: 0,
  endTimeOffset: null,
  recoveryStrategy: 'oldest',
  cachingStrategy: null,
  thresholdType: null,
  threshold: null,
  rangeLow: null,
  rangeHigh: null,
  maxCachingInterval: null,
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
};

const buildConfiguration = (settings: SouthInfluxDBSettings): SouthConnectorEntity<SouthInfluxDBSettings, SouthInfluxDBItemSettings> => ({
  id: 'southId',
  name: 'south',
  type: 'influxdb',
  description: `my influxdb v${settings.version} connector`,
  enabled: true,
  settings,
  groups: [],
  items: [baseItem],
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
});

describe('SouthInfluxDB', () => {
  let SouthInfluxDB: typeof SouthInfluxDBClass;

  let logger: PinoLogger;
  let addContentCallback: Mock<
    (southId: string, data: OIBusContent, queryTime: string, items: Array<SouthConnectorItemEntity<SouthItemSettings>>) => Promise<void>
  >;

  // Clients returned by the mocked SDK constructors (a plain function, since mock.fn() cannot be used with `new`)
  let influxV1: { query: Mock<(query: string) => Promise<unknown>>; ping: Mock<() => Promise<unknown>> };
  let influxV2: { queryRows: Mock<(query: string, observer: QueryRowsObserver) => void> };
  let influxV3: { query: Mock<(query: string, database?: string) => AsyncGenerator<Row>>; close: Mock<() => Promise<void>> };

  before(() => {
    mockModule(nodeRequire, 'influx', {
      InfluxDB: function () {
        return influxV1;
      }
    });
    mockModule(nodeRequire, '@influxdata/influxdb-client', {
      InfluxDB: function () {
        return { getQueryApi: () => influxV2 };
      }
    });
    mockModule(nodeRequire, '@influxdata/influxdb3-client', {
      InfluxDBClient: function () {
        return influxV3;
      }
    });
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: new EncryptionServiceMock('', '')
    });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });
    SouthInfluxDB = reloadModule<{ default: typeof SouthInfluxDBClass }>(nodeRequire, './south-influxdb').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    addContentCallback = mock.fn(async () => undefined);
    influxV1 = {
      query: mock.fn(async () => [{ time: '2020-02-01T00:00:00Z', value: 1 }]),
      ping: mock.fn(async () => [{ online: true, version: '1.8.10', url: 'http://localhost:8086' }])
    };
    influxV2 = { queryRows: mock.fn(streamRows({ _time: '2020-02-01T00:00:00Z', _value: '1' })) };
    influxV3 = { query: mock.fn(yieldRows({ time: '2020-02-01T00:00:00Z', value: 1 })), close: mock.fn(async () => undefined) };

    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  const createSouth = (configuration: SouthConnectorEntity<SouthInfluxDBSettings, SouthInfluxDBItemSettings>) =>
    new SouthInfluxDB(configuration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');

  // ——————————————————————————————————————————————————
  // InfluxDB v1
  // ——————————————————————————————————————————————————
  describe('InfluxDB v1', () => {
    let south: SouthInfluxDBClass;
    const configV1 = buildConfiguration({
      version: '1',
      host: 'localhost',
      port: 8086,
      protocol: 'http',
      database: 'mydb',
      username: 'admin',
      password: 'pass'
    });
    const minimalConfigV1 = buildConfiguration({ version: '1', host: 'localhost', port: 8086, database: 'mydb' });

    beforeEach(() => {
      south = createSouth(configV1);
    });

    it('should test connection successfully', async () => {
      const result = await south.testConnection();
      assert.ok(result.items.some(i => i.key === 'Version'));
      assert.equal(result.items.find(i => i.key === 'Version')?.value, '1.8.10');
    });

    it('should test connection without version info in ping result', async () => {
      influxV1.ping.mock.mockImplementation(async () => [{ online: true }]);
      const result = await south.testConnection();
      assert.ok(!result.items.some(i => i.key === 'Version'));
      assert.ok(result.items.some(i => i.key === 'Host'));
    });

    it('should test connection with no password, no username and default protocol', async () => {
      const result = await createSouth(minimalConfigV1).testConnection();
      assert.ok(result.items.some(i => i.key === 'Version'));
    });

    it('should throw when ping fails', async () => {
      influxV1.ping.mock.mockImplementation(async () => {
        throw new Error('Connection refused');
      });
      await assert.rejects(south.testConnection(), /Could not connect to InfluxDB v1/);
    });

    it('should throw when no host is online', async () => {
      influxV1.ping.mock.mockImplementation(async () => [{ online: false }]);
      await assert.rejects(south.testConnection(), /is not responding/);
    });

    it('should run historyQuery, write JSON file and call addContent', async () => {
      const queryDataMock = mock.method(south, 'queryData', async () => [{ time: '2020-02-01T00:00:00Z', value: 1 }]);
      const result = await south.historyQuery([baseItem], testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(queryDataMock.mock.calls.length, 1);
      assert.equal(addContentCallback.mock.calls.length, 1);
      const content = addContentCallback.mock.calls[0].arguments[1] as { type: string; content: string };
      assert.equal(content.type, 'any-content');
      assert.ok(content.content.includes(JSON.stringify([{ time: '2020-02-01T00:00:00Z', value: 1 }])));
      assert.notEqual(result.value, null);
    });

    it('should not write file or call addContent when no results', async () => {
      const writeFileMock = mock.method(fs, 'writeFile', async () => undefined);
      mock.method(south, 'queryData', async () => []);
      const result = await south.historyQuery([baseItem], testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(writeFileMock.mock.calls.length, 0);
      assert.equal(addContentCallback.mock.calls.length, 0);
      assert.equal(result.trackedInstant, null);
      assert.equal(result.value, null);
    });

    it('should track max instant automatically from the time field', async () => {
      mock.method(south, 'queryData', async () => [{ time: testData.constants.dates.DATE_2, value: 1 }]);
      const result = await south.historyQuery([baseItem], testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(result.trackedInstant, testData.constants.dates.DATE_2);
    });

    it('should return JSON content in testItem', async () => {
      mock.method(south, 'queryData', async () => {
        mock.timers.tick(25);
        return [{ time: '2020-02-01T00:00:00Z', value: 1 }];
      });
      const result = await south.testItem(baseItem, {
        history: { startTime: testData.constants.dates.DATE_1, endTime: testData.constants.dates.DATE_2 }
      });
      assert.equal(result.result.type, 'any-content');
      assert.ok(result.result.content?.startsWith('['));
      assert.ok(JSON.parse(result.result.content!).length === 1);
      assert.strictEqual(result.queryDuration, 25);
      assert.strictEqual(result.connectionDuration, 0);
    });

    it('should execute v1 query via queryData', async () => {
      const result = await south.queryData(baseItem, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.ok(Array.isArray(result));
    });

    it('should substitute @StartTime and @EndTime in query', async () => {
      influxV1.query.mock.mockImplementation(async () => []);
      await south.queryData(baseItem, '2020-01-01T00:00:00.000Z', '2020-02-01T00:00:00.000Z');
      const capturedQuery = influxV1.query.mock.calls[0].arguments[0];
      assert.ok(!capturedQuery.includes('@StartTime'), 'Query should not contain @StartTime');
      assert.ok(!capturedQuery.includes('@EndTime'), 'Query should not contain @EndTime');
    });

    it('should convert Date objects in v1 results to ISO strings', async () => {
      influxV1.query.mock.mockImplementation(async () => [{ time: new Date('2021-01-01T00:00:00.000Z'), value: 23.5 }]);
      const result = await south.queryData(baseItem, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(result[0].time, '2021-01-01T00:00:00.000Z');
      assert.equal(result[0].value, 23.5);
    });

    it('should run v1 queryData without password, username or protocol', async () => {
      influxV1.query.mock.mockImplementation(async () => []);
      const result = await createSouth(minimalConfigV1).queryData(
        baseItem,
        testData.constants.dates.DATE_1,
        testData.constants.dates.DATE_2
      );
      assert.equal(result.length, 0);
    });

    it('should throw for unsupported version', async () => {
      const southBadVersion = createSouth({ ...configV1, settings: { ...configV1.settings, version: 'invalid' as '1' } });
      await assert.rejects(southBadVersion.testConnection(), /Unsupported InfluxDB version/);
      await assert.rejects(
        southBadVersion.queryData(baseItem, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2),
        /Unsupported InfluxDB version/
      );
    });
  });

  // ——————————————————————————————————————————————————
  // InfluxDB v2
  // ——————————————————————————————————————————————————
  describe('InfluxDB v2', () => {
    let south: SouthInfluxDBClass;
    const configV2 = buildConfiguration({
      version: '2',
      url: 'http://localhost:8086',
      token: 'my-token',
      organisation: 'my-org',
      bucket: 'my-bucket'
    });

    beforeEach(() => {
      south = createSouth(configV2);
    });

    it('should test connection and return bucket count', async () => {
      influxV2.queryRows.mock.mockImplementation(streamRows({ name: 'bucket1' }, { name: 'bucket2' }));
      const result = await south.testConnection();
      assert.equal(result.items.find(i => i.key === 'Buckets')?.value, '2');
    });

    it('should throw when v2 query fails on connection test', async () => {
      influxV2.queryRows.mock.mockImplementation(failRows('Unauthorized'));
      await assert.rejects(south.testConnection(), /Could not connect to InfluxDB v2/);
    });

    it('should run v2 query and return rows', async () => {
      influxV2.queryRows.mock.mockImplementation(streamRows({ _time: '2020-02-01T00:00:00Z', _value: '42' }));
      const result = await south.queryData(baseItem, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(result.length, 1);
    });

    it('should throw when v2 data query fails', async () => {
      influxV2.queryRows.mock.mockImplementation(failRows('Query failed'));
      await assert.rejects(south.queryData(baseItem, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2), /Query failed/);
    });

    it('should test connection and run queryData without token', async () => {
      const southNoToken = createSouth({ ...configV2, settings: { ...configV2.settings, token: null } });
      influxV2.queryRows.mock.mockImplementation(streamRows({}));
      const connResult = await southNoToken.testConnection();
      assert.equal(connResult.items.find(i => i.key === 'Buckets')?.value, '1');

      const itemNoTracking = { ...baseItem, settings: { ...baseItem.settings, trackingInstant: { trackInstant: false } } };
      influxV2.queryRows.mock.mockImplementation(streamRows({ _time: '2020-02-01T00:00:00Z' }));
      const queryResult = await southNoToken.queryData(itemNoTracking, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(queryResult.length, 1);
    });

    it('should track max instant from the _time field on v2', async () => {
      mock.method(south, 'queryData', async () => [{ _time: testData.constants.dates.DATE_2, _value: 1 }]);
      const result = await south.historyQuery([baseItem], testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(result.trackedInstant, testData.constants.dates.DATE_2);
    });

    it('should return a null trackedInstant when the time field is missing on v2', async () => {
      mock.method(south, 'queryData', async () => [{ _value: 1 }]);
      const result = await south.historyQuery([baseItem], testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(result.trackedInstant, null);
    });
  });

  // ——————————————————————————————————————————————————
  // InfluxDB v3
  // ——————————————————————————————————————————————————
  describe('InfluxDB v3', () => {
    let south: SouthInfluxDBClass;
    const configV3 = buildConfiguration({
      version: '3',
      url: 'https://eu-central-1-1.aws.cloud3.influxdata.com',
      token: 'my-token-v3',
      database: 'mydb'
    });

    beforeEach(() => {
      south = createSouth(configV3);
    });

    it('should test connection successfully', async () => {
      influxV3.query.mock.mockImplementation(yieldRows({ name: 'measurement1' }));
      const result = await south.testConnection();
      assert.ok(result.items.some(i => i.key === 'Database'));
      assert.equal(result.items.find(i => i.key === 'Connected')?.value, 'true');
    });

    it('should throw and always close client when v3 connection test fails', async () => {
      influxV3.query.mock.mockImplementation(failYield('Forbidden'));
      await assert.rejects(south.testConnection(), /Could not connect to InfluxDB v3/);
      assert.ok(influxV3.close.mock.callCount() > 0, 'close() should be called even after error');
    });

    it('should run v3 query and return rows', async () => {
      influxV3.query.mock.mockImplementation(yieldRows({ time: '2020-02-01T00:00:00Z', value: 99 }));
      const result = await south.queryData(baseItem, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(result.length, 1);
    });

    it('should always close client even when v3 query throws', async () => {
      influxV3.query.mock.mockImplementation(failYield('Query error'));
      await assert.rejects(south.queryData(baseItem, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2));
      assert.ok(influxV3.close.mock.callCount() > 0, 'close() should be called even after query error');
    });

    it('should test connection and run queryData without token', async () => {
      const southNoToken = createSouth({ ...configV3, settings: { ...configV3.settings, token: null } });
      influxV3.query.mock.mockImplementation(yieldRows({ name: 'measurement1' }));
      const connResult = await southNoToken.testConnection();
      assert.equal(connResult.items.find(i => i.key === 'Connected')?.value, 'true');

      influxV3.query.mock.mockImplementation(yieldRows({ time: '2020-02-01T00:00:00Z', value: 42 }));
      const queryResult = await southNoToken.queryData(baseItem, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(queryResult.length, 1);
    });

    it('should handle empty results for both testConnection and queryData', async () => {
      // empty — for await loop body never entered
      influxV3.query.mock.mockImplementation(yieldRows());
      const connResult = await south.testConnection();
      assert.equal(connResult.items.find(i => i.key === 'Connected')?.value, 'true');

      const queryResult = await south.queryData(baseItem, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(queryResult.length, 0);
    });
  });
});
