import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type { OIBusContent } from '../../../shared/model/engine.model';
import type { SouthItemSettings } from '../../../shared/model/south-settings.model';
import type { SouthInfluxDBItemSettings, SouthInfluxDBSettings } from '../../../shared/model/south-settings.model';
import type SouthInfluxDBClass from './south-influxdb';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';

const nodeRequire = createRequire(import.meta.url);

// — v1 mock (influx package) —
// Note: mock.fn() cannot be used as a constructor with `new`, so we use plain functions
// and attach mock.fn() instances as the methods they return.
let influxV1QueryMock = mock.fn(async (_q: string) => [{ time: '2020-02-01T00:00:00Z', value: 1 }] as unknown);
let influxV1PingMock = mock.fn(async () => [{ online: true, version: '1.8.10', url: 'http://localhost:8086' }] as unknown);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MockInfluxDBv1(this: any) {
  this.query = influxV1QueryMock;
  this.ping = influxV1PingMock;
}
const influxV1Exports = { InfluxDB: MockInfluxDBv1 };

// — v2 mock (@influxdata/influxdb-client) —
let queryRowsMock = mock.fn(
  (
    _query: string,
    {
      next,
      complete
    }: {
      next: (row: Array<unknown>, meta: { toObject: (r: Array<unknown>) => Record<string, unknown> }) => void;
      error: (e: Error) => void;
      complete: () => void;
    }
  ) => {
    next(['2020-02-01T00:00:00Z', '1'], { toObject: (r: Array<unknown>) => ({ _time: r[0], _value: r[1] }) });
    complete();
  }
);
let getQueryApiMock = mock.fn((_org: string) => ({ queryRows: queryRowsMock }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MockInfluxDBv2(this: any) {
  this.getQueryApi = getQueryApiMock;
}
const influxV2Exports = { InfluxDB: MockInfluxDBv2 };

// — v3 mock (@influxdata/influxdb3-client) —
let influxV3QueryMock = mock.fn((_query: string, _database?: string) =>
  (async function* () {
    yield { time: '2020-02-01T00:00:00Z', value: 1 } as Record<string, unknown>;
  })()
);
let influxV3CloseMock = mock.fn(async () => undefined);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MockInfluxDBv3(this: any) {
  this.query = influxV3QueryMock;
  this.close = influxV3CloseMock;
}
const influxV3Exports = { InfluxDBClient: MockInfluxDBv3 };

// — utils mock —
const utilsExports = {
  generateRandomId: mock.fn(() => 'random-id'),
  sanitizeFilename: mock.fn((name: unknown) => name),
  logQuery: mock.fn()
};

describe('SouthInfluxDB', () => {
  let SouthInfluxDB: typeof SouthInfluxDBClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn(
    async (_southId: string, _data: OIBusContent, _queryTime: string, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>) =>
      undefined
  );
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
  let southCacheService: SouthCacheServiceMock;

  let fsMock: { writeFile: ReturnType<typeof mock.fn> };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, 'influx', influxV1Exports);
    mockModule(nodeRequire, '@influxdata/influxdb-client', influxV2Exports);
    mockModule(nodeRequire, '@influxdata/influxdb3-client', influxV3Exports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: new EncryptionServiceMock('', '')
    });
    mockModule(nodeRequire, '../../service/south-cache.service', {
      __esModule: true,
      default: function () {
        return southCacheService;
      }
    });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: mock.fn(() => logger) },
      default: class {}
    });
    SouthInfluxDB = reloadModule<{ default: typeof SouthInfluxDBClass }>(nodeRequire, './south-influxdb').default;
  });

  beforeEach(() => {
    southCacheService = new SouthCacheServiceMock();
    addContentCallback.mock.resetCalls();

    influxV1QueryMock = mock.fn(async (_q: string) => [{ time: '2020-02-01T00:00:00Z', value: 1 }] as unknown);
    influxV1PingMock = mock.fn(async () => [{ online: true, version: '1.8.10', url: 'http://localhost:8086' }] as unknown);

    queryRowsMock = mock.fn(
      (
        _query: string,
        {
          next,
          complete
        }: {
          next: (row: Array<unknown>, meta: { toObject: (r: Array<unknown>) => Record<string, unknown> }) => void;
          error: (e: Error) => void;
          complete: () => void;
        }
      ) => {
        next(['2020-02-01T00:00:00Z', '1'], { toObject: (r: Array<unknown>) => ({ _time: r[0], _value: r[1] }) });
        complete();
      }
    );
    getQueryApiMock = mock.fn((_org: string) => ({ queryRows: queryRowsMock }));

    influxV3QueryMock = mock.fn((_query: string, _database?: string) =>
      (async function* () {
        yield { time: '2020-02-01T00:00:00Z', value: 1 } as Record<string, unknown>;
      })()
    );
    influxV3CloseMock = mock.fn(async () => undefined);

    utilsExports.generateRandomId = mock.fn(() => 'random-id');
    utilsExports.sanitizeFilename = mock.fn((name: unknown) => name);
    utilsExports.logQuery = mock.fn();

    fsMock = { writeFile: mock.method(fs, 'writeFile', async () => undefined) as unknown as ReturnType<typeof mock.fn> };

    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

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
    overlap: 0,
    createdBy: '',
    updatedBy: '',
    createdAt: '',
    updatedAt: ''
  };

  // ——————————————————————————————————————————————————
  // InfluxDB v1
  // ——————————————————————————————————————————————————
  describe('InfluxDB v1', () => {
    let south: SouthInfluxDBClass;
    const configV1: SouthConnectorEntity<SouthInfluxDBSettings, SouthInfluxDBItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'influxdb',
      description: 'my influxdb v1 connector',
      enabled: true,
      settings: {
        version: '1',
        host: 'localhost',
        port: 8086,
        protocol: 'http',
        database: 'mydb',
        username: 'admin',
        password: 'pass'
      },
      groups: [],
      items: [baseItem],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    beforeEach(() => {
      south = new SouthInfluxDB(configV1, addContentCallback, southCacheRepository, 'cacheFolder');
    });

    it('should test connection successfully', async () => {
      const result = await south.testConnection();
      assert.ok(result.items.some(i => i.key === 'Version'));
      assert.equal(result.items.find(i => i.key === 'Version')?.value, '1.8.10');
    });

    it('should test connection without version info in ping result', async () => {
      influxV1PingMock = mock.fn(async () => [{ online: true }] as unknown);
      const result = await south.testConnection();
      assert.ok(!result.items.some(i => i.key === 'Version'));
      assert.ok(result.items.some(i => i.key === 'Host'));
    });

    it('should test connection with no password, no username and default protocol', async () => {
      const southNoAuth = new SouthInfluxDB(
        { ...configV1, settings: { version: '1', host: 'localhost', port: 8086, database: 'mydb' } },
        addContentCallback,
        southCacheRepository,
        'cacheFolder'
      );
      const result = await southNoAuth.testConnection();
      assert.ok(result.items.some(i => i.key === 'Version'));
    });

    it('should throw when ping fails', async () => {
      influxV1PingMock = mock.fn(async () => {
        throw new Error('Connection refused');
      });
      await assert.rejects(south.testConnection(), /Could not connect to InfluxDB v1/);
    });

    it('should throw when no host is online', async () => {
      influxV1PingMock = mock.fn(async () => [{ online: false }] as unknown);
      await assert.rejects(south.testConnection(), /is not responding/);
    });

    it('should run historyQuery, write JSON file and call addContent', async () => {
      const queryDataMock = mock.method(
        south,
        'queryData',
        mock.fn(async () => [{ time: '2020-02-01T00:00:00Z', value: 1 }])
      );
      const result = await south.historyQuery([baseItem], testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(queryDataMock.mock.calls.length, 1);
      assert.equal(fsMock.writeFile.mock.calls.length, 1);
      assert.equal(addContentCallback.mock.calls.length, 1);
      const content = addContentCallback.mock.calls[0].arguments[1] as { type: string; filePath: string };
      assert.equal(content.type, 'any');
      assert.ok(content.filePath.includes('random-id.json'));
      assert.notEqual(result.value, null);
    });

    it('should not write file or call addContent when no results', async () => {
      mock.method(
        south,
        'queryData',
        mock.fn(async () => [])
      );
      const result = await south.historyQuery([baseItem], testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(fsMock.writeFile.mock.calls.length, 0);
      assert.equal(addContentCallback.mock.calls.length, 0);
      assert.equal(result.trackedInstant, null);
      assert.equal(result.value, null);
    });

    it('should track max instant automatically from the time field', async () => {
      mock.method(
        south,
        'queryData',
        mock.fn(async () => [{ time: testData.constants.dates.DATE_2, value: 1 }])
      );
      const result = await south.historyQuery([baseItem], testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(result.trackedInstant, testData.constants.dates.DATE_2);
    });

    it('should return JSON content in testItem', async () => {
      mock.method(
        south,
        'queryData',
        mock.fn(async () => [{ time: '2020-02-01T00:00:00Z', value: 1 }])
      );
      const result = await south.testItem(baseItem, {
        history: { startTime: testData.constants.dates.DATE_1, endTime: testData.constants.dates.DATE_2 }
      });
      assert.equal(result.type, 'any');
      assert.ok(result.content?.startsWith('['));
      assert.ok(JSON.parse(result.content!).length === 1);
    });

    it('should execute v1 query via queryData', async () => {
      const result = await south.queryData(baseItem, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.ok(Array.isArray(result));
    });

    it('should substitute @StartTime and @EndTime in query', async () => {
      let capturedQuery = '';
      influxV1QueryMock = mock.fn(async (q: string) => {
        capturedQuery = q;
        return [];
      });
      await south.queryData(baseItem, '2020-01-01T00:00:00.000Z', '2020-02-01T00:00:00.000Z');
      assert.ok(!capturedQuery.includes('@StartTime'), 'Query should not contain @StartTime');
      assert.ok(!capturedQuery.includes('@EndTime'), 'Query should not contain @EndTime');
    });

    it('should convert Date objects in v1 results to ISO strings', async () => {
      const ts = new Date('2021-01-01T00:00:00.000Z');
      influxV1QueryMock = mock.fn(async (_q: string) => [{ time: ts, value: 23.5 }] as unknown);
      const result = await south.queryData(baseItem, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(result[0].time, '2021-01-01T00:00:00.000Z');
      assert.equal(result[0].value, 23.5);
    });

    it('should run v1 queryData without password, username or protocol', async () => {
      const southMinimal = new SouthInfluxDB(
        { ...configV1, settings: { version: '1', host: 'localhost', port: 8086, database: 'mydb' } },
        addContentCallback,
        southCacheRepository,
        'cacheFolder'
      );
      influxV1QueryMock = mock.fn(async () => []);
      const result = await southMinimal.queryData(baseItem, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(result.length, 0);
    });

    it('should throw for unsupported version', async () => {
      const southBadVersion = new SouthInfluxDB(
        { ...configV1, settings: { ...configV1.settings, version: 'invalid' as '1' } },
        addContentCallback,
        southCacheRepository,
        'cacheFolder'
      );
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
    const configV2: SouthConnectorEntity<SouthInfluxDBSettings, SouthInfluxDBItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'influxdb',
      description: 'my influxdb v2 connector',
      enabled: true,
      settings: {
        version: '2',
        url: 'http://localhost:8086',
        token: 'my-token',
        organisation: 'my-org',
        bucket: 'my-bucket'
      },
      groups: [],
      items: [baseItem],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    beforeEach(() => {
      south = new SouthInfluxDB(configV2, addContentCallback, southCacheRepository, 'cacheFolder');
    });

    it('should test connection and return bucket count', async () => {
      queryRowsMock = mock.fn(
        (
          _query: string,
          {
            next,
            complete
          }: {
            next: (r: Array<unknown>, m: { toObject: (r: Array<unknown>) => Record<string, unknown> }) => void;
            error: (e: Error) => void;
            complete: () => void;
          }
        ) => {
          next([], { toObject: () => ({ name: 'bucket1' }) });
          next([], { toObject: () => ({ name: 'bucket2' }) });
          complete();
        }
      );
      getQueryApiMock = mock.fn(() => ({ queryRows: queryRowsMock }));
      const result = await south.testConnection();
      assert.equal(result.items.find(i => i.key === 'Buckets')?.value, '2');
    });

    it('should throw when v2 query fails on connection test', async () => {
      queryRowsMock = mock.fn((_query: string, { error }: { next: unknown; error: (e: Error) => void; complete: unknown }) => {
        error(new Error('Unauthorized'));
      });
      getQueryApiMock = mock.fn(() => ({ queryRows: queryRowsMock }));
      await assert.rejects(south.testConnection(), /Could not connect to InfluxDB v2/);
    });

    it('should run v2 query and return rows', async () => {
      queryRowsMock = mock.fn(
        (
          _query: string,
          {
            next,
            complete
          }: {
            next: (row: Array<unknown>, meta: { toObject: (r: Array<unknown>) => Record<string, unknown> }) => void;
            error: (e: Error) => void;
            complete: () => void;
          }
        ) => {
          next(['2020-02-01T00:00:00Z', '42'], { toObject: (r: Array<unknown>) => ({ _time: r[0], _value: r[1] }) });
          complete();
        }
      );
      getQueryApiMock = mock.fn(() => ({ queryRows: queryRowsMock }));
      const result = await south.queryData(baseItem, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(result.length, 1);
    });

    it('should throw when v2 data query fails', async () => {
      queryRowsMock = mock.fn((_query: string, { error }: { next: unknown; error: (e: Error) => void; complete: unknown }) => {
        error(new Error('Query failed'));
      });
      getQueryApiMock = mock.fn(() => ({ queryRows: queryRowsMock }));
      await assert.rejects(south.queryData(baseItem, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2), /Query failed/);
    });

    it('should test connection and run queryData without token', async () => {
      const southNoToken = new SouthInfluxDB(
        { ...configV2, settings: { ...configV2.settings, token: null } },
        addContentCallback,
        southCacheRepository,
        'cacheFolder'
      );
      queryRowsMock = mock.fn(
        (
          _query: string,
          {
            next,
            complete
          }: {
            next: (r: Array<unknown>, m: { toObject: (r: Array<unknown>) => Record<string, unknown> }) => void;
            error: (e: Error) => void;
            complete: () => void;
          }
        ) => {
          next([], { toObject: () => ({}) });
          complete();
        }
      );
      getQueryApiMock = mock.fn(() => ({ queryRows: queryRowsMock }));
      const connResult = await southNoToken.testConnection();
      assert.equal(connResult.items.find(i => i.key === 'Buckets')?.value, '1');

      const itemNoTracking = { ...baseItem, settings: { ...baseItem.settings, trackingInstant: { trackInstant: false } } };
      queryRowsMock = mock.fn(
        (
          _query: string,
          {
            next,
            complete
          }: {
            next: (row: Array<unknown>, meta: { toObject: (r: Array<unknown>) => Record<string, unknown> }) => void;
            error: (e: Error) => void;
            complete: () => void;
          }
        ) => {
          next([], { toObject: () => ({ _time: '2020-02-01T00:00:00Z' }) });
          complete();
        }
      );
      getQueryApiMock = mock.fn(() => ({ queryRows: queryRowsMock }));
      const queryResult = await southNoToken.queryData(itemNoTracking, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(queryResult.length, 1);
    });
  });

  // ——————————————————————————————————————————————————
  // InfluxDB v3
  // ——————————————————————————————————————————————————
  describe('InfluxDB v3', () => {
    let south: SouthInfluxDBClass;
    const configV3: SouthConnectorEntity<SouthInfluxDBSettings, SouthInfluxDBItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'influxdb',
      description: 'my influxdb v3 connector',
      enabled: true,
      settings: {
        version: '3',
        url: 'https://eu-central-1-1.aws.cloud3.influxdata.com',
        token: 'my-token-v3',
        database: 'mydb'
      },
      groups: [],
      items: [baseItem],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    beforeEach(() => {
      south = new SouthInfluxDB(configV3, addContentCallback, southCacheRepository, 'cacheFolder');
    });

    it('should test connection successfully', async () => {
      influxV3QueryMock = mock.fn((_query: string, _database?: string) =>
        (async function* () {
          yield { name: 'measurement1' } as Record<string, unknown>;
        })()
      );
      influxV3CloseMock = mock.fn(async () => undefined);
      const result = await south.testConnection();
      assert.ok(result.items.some(i => i.key === 'Database'));
      assert.equal(result.items.find(i => i.key === 'Connected')?.value, 'true');
    });

    it('should throw and always close client when v3 connection test fails', async () => {
      let closeCalled = false;
      influxV3QueryMock = mock.fn(
        (_query: string, _database?: string) =>
          (async function* () {
            throw new Error('Forbidden');
          })() as AsyncGenerator<Record<string, unknown>, void, unknown>
      );
      influxV3CloseMock = mock.fn(async () => {
        closeCalled = true;
      });
      await assert.rejects(south.testConnection(), /Could not connect to InfluxDB v3/);
      assert.ok(closeCalled, 'close() should be called even after error');
    });

    it('should run v3 query and return rows', async () => {
      influxV3QueryMock = mock.fn((_query: string, _database?: string) =>
        (async function* () {
          yield { time: '2020-02-01T00:00:00Z', value: 99 };
        })()
      );
      influxV3CloseMock = mock.fn(async () => undefined);
      const result = await south.queryData(baseItem, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(result.length, 1);
    });

    it('should always close client even when v3 query throws', async () => {
      let closeCalled = false;
      influxV3QueryMock = mock.fn(
        (_query: string, _database?: string) =>
          (async function* () {
            throw new Error('Query error');
          })() as AsyncGenerator<Record<string, unknown>, void, unknown>
      );
      influxV3CloseMock = mock.fn(async () => {
        closeCalled = true;
      });
      await assert.rejects(south.queryData(baseItem, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2));
      assert.ok(closeCalled, 'close() should be called even after query error');
    });

    it('should test connection and run queryData without token', async () => {
      const southNoToken = new SouthInfluxDB(
        { ...configV3, settings: { ...configV3.settings, token: null } },
        addContentCallback,
        southCacheRepository,
        'cacheFolder'
      );
      influxV3QueryMock = mock.fn((_query: string, _database?: string) =>
        (async function* () {
          yield { name: 'measurement1' } as Record<string, unknown>;
        })()
      );
      influxV3CloseMock = mock.fn(async () => undefined);
      const connResult = await southNoToken.testConnection();
      assert.equal(connResult.items.find(i => i.key === 'Connected')?.value, 'true');

      influxV3QueryMock = mock.fn((_query: string, _database?: string) =>
        (async function* () {
          yield { time: '2020-02-01T00:00:00Z', value: 42 } as Record<string, unknown>;
        })()
      );
      influxV3CloseMock = mock.fn(async () => undefined);
      const queryResult = await southNoToken.queryData(baseItem, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(queryResult.length, 1);
    });

    it('should handle empty results for both testConnection and queryData', async () => {
      influxV3QueryMock = mock.fn(
        (_query: string, _database?: string) =>
          (async function* () {
            // empty — for await loop body never entered
          })() as AsyncGenerator<Record<string, unknown>, void, unknown>
      );
      influxV3CloseMock = mock.fn(async () => undefined);
      const connResult = await south.testConnection();
      assert.equal(connResult.items.find(i => i.key === 'Connected')?.value, 'true');

      influxV3QueryMock = mock.fn(
        (_query: string, _database?: string) =>
          (async function* () {
            // empty
          })() as AsyncGenerator<Record<string, unknown>, void, unknown>
      );
      influxV3CloseMock = mock.fn(async () => undefined);
      const queryResult = await south.queryData(baseItem, testData.constants.dates.DATE_1, testData.constants.dates.DATE_2);
      assert.equal(queryResult.length, 0);
    });
  });
});
