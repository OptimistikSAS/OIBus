import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type { SouthItemSettings, SouthOLEDBItemSettings, SouthOLEDBSettings } from '../../../shared/model/south-settings.model';
import type { OIBusContent } from '../../../shared/model/engine.model';
import type SouthOLEDBClass from './south-oledb';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';

const nodeRequire = createRequire(import.meta.url);

/**
 * Stands in for the real `@oibus/oledb-windows` package (which spawns a native child process) —
 * south-oledb.ts's own behavior is what's under test here, not the package's process-management or
 * multi-connection concurrency logic, which has its own dedicated spec (native/oledb-windows/src/index.spec.ts).
 */
class FakeOleDbConnection {
  static instances: Array<FakeOleDbConnection> = [];
  static connectMock = mock.fn(async (_connectionString: string): Promise<FakeOleDbConnection> => {
    const instance = new FakeOleDbConnection();
    FakeOleDbConnection.instances.push(instance);
    return instance;
  });

  read = mock.fn(async (_sql: string, _readTimeout?: number) => [] as Array<Record<string, unknown>>);
  disconnect = mock.fn(async () => undefined);

  static connect(connectionString: string): Promise<FakeOleDbConnection> {
    return FakeOleDbConnection.connectMock(connectionString);
  }

  static latest(): FakeOleDbConnection {
    return FakeOleDbConnection.instances[FakeOleDbConnection.instances.length - 1];
  }
}

describe('SouthOLEDB', () => {
  let SouthOLEDB: typeof SouthOLEDBClass;
  let south: SouthOLEDBClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn(
    async (_southId: string, _data: OIBusContent, _queryTime: string, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>) =>
      undefined
  );
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;

  const utilsExports = {
    groupItemsByGroup: mock.fn((_type: unknown, items: Array<unknown>) => [items]),
    convertDateTimeToInstant: mock.fn((instant: unknown) => instant),
    formatInstant: mock.fn((instant: unknown) => instant),
    logQuery: mock.fn(),
    getErrorMessage: mock.fn((error: unknown) => {
      if (error instanceof Error) return error.message;
      if (typeof error === 'string') return error;
      if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
        return (error as { message: string }).message;
      }
      return String(error);
    }),
    // Mirrors the real implementation in service/utils.ts — kept in sync manually since it's a
    // handful of lines and some tests assert the exact { itemId/itemName } / { groupId/groupName } shape.
    workUnitLogCtx: mock.fn((items: Array<{ id: string; name: string; group?: { id: string; name: string } | null }>) => {
      if (items.length === 0) return {};
      if (items.length === 1) return { itemId: items[0].id, itemName: items[0].name };
      const lead = items[0];
      return lead.group ? { groupId: lead.group.id, groupName: lead.group.name } : {};
    })
  };

  const configuration: SouthConnectorEntity<SouthOLEDBSettings, SouthOLEDBItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'oledb',
    description: 'my test connector',
    enabled: true,
    settings: {
      connectionString: 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes',
      password: 'encrypted-password',
      connectionTimeout: 1000,
      retryInterval: 1000,
      requestTimeout: 1000
    },
    groups: [],
    items: [
      {
        id: 'id1',
        name: 'item1',
        enabled: true,
        settings: {
          query: 'SELECT * FROM table WHERE timestamp > @StartTime AND timestamp < @EndTime',
          trackingInstant: {
            trackInstant: true,
            fieldName: 'timestamp',
            dateTimeInput: { type: 'string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss.SSS', locale: 'en-US' }
          }
        },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 0,
        startTimeOffset: 0,
        endTimeOffset: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'id2',
        name: 'item2',
        enabled: true,
        settings: { query: 'query2', trackingInstant: { trackInstant: false } },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: 3600,
        readDelay: 0,
        startTimeOffset: 0,
        endTimeOffset: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      }
    ],
    createdBy: '',
    updatedBy: '',
    createdAt: '',
    updatedAt: ''
  };

  const connectionStringWithPassword = 'Driver={SQL Server};SERVER=127.0.0.1;TrustServerCertificate=yes;Password=encrypted-password;';

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, '@oibus/oledb-windows', { OleDbConnection: FakeOleDbConnection });
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: new EncryptionServiceMock('', '')
    });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: mock.fn(() => logger) },
      default: class {}
    });

    SouthOLEDB = reloadModule<{ default: typeof SouthOLEDBClass }>(nodeRequire, './south-oledb').default;
  });

  beforeEach(() => {
    FakeOleDbConnection.instances = [];
    FakeOleDbConnection.connectMock = mock.fn(async (_connectionString: string) => {
      const instance = new FakeOleDbConnection();
      FakeOleDbConnection.instances.push(instance);
      return instance;
    });
    utilsExports.convertDateTimeToInstant = mock.fn((instant: unknown) => instant);
    utilsExports.formatInstant = mock.fn((instant: unknown) => instant);
    utilsExports.logQuery = mock.fn();
    addContentCallback.mock.resetCalls();
    for (const fn of [logger.trace, logger.debug, logger.info, logger.warn, logger.error]) {
      fn.mock.resetCalls();
    }
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthOLEDB(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('connects with the decrypted password appended', async () => {
    await south.connect();

    assert.strictEqual(FakeOleDbConnection.connectMock.mock.calls.length, 1);
    assert.strictEqual(FakeOleDbConnection.connectMock.mock.calls[0].arguments[0], connectionStringWithPassword);
  });

  it('connects without a password when not provided', async () => {
    const configurationWithoutPassword: SouthConnectorEntity<SouthOLEDBSettings, SouthOLEDBItemSettings> = {
      ...configuration,
      settings: { ...configuration.settings, password: null }
    };
    const southWithoutPassword = new SouthOLEDB(configurationWithoutPassword, addContentCallback, southCacheRepository, 'cacheFolder');

    await southWithoutPassword.connect();
    assert.strictEqual(FakeOleDbConnection.connectMock.mock.calls[0].arguments[0], configurationWithoutPassword.settings.connectionString);
  });

  it('avoids adding a duplicate semicolon when the connection string already ends with one', async () => {
    const configurationWithTrailingSemicolon: SouthConnectorEntity<SouthOLEDBSettings, SouthOLEDBItemSettings> = {
      ...configuration,
      settings: { ...configuration.settings, connectionString: `${configuration.settings.connectionString};` }
    };
    const southWithTrailingSemicolon = new SouthOLEDB(
      configurationWithTrailingSemicolon,
      addContentCallback,
      southCacheRepository,
      'cacheFolder'
    );

    await southWithTrailingSemicolon.connect();
    assert.strictEqual(
      FakeOleDbConnection.connectMock.mock.calls[0].arguments[0],
      `${configurationWithTrailingSemicolon.settings.connectionString}Password=encrypted-password;`
    );
  });

  it('reconnects after retryInterval when the connection fails', async () => {
    let callCount = 0;
    FakeOleDbConnection.connectMock = mock.fn(async (_connectionString: string) => {
      callCount++;
      if (callCount === 1) throw new Error('connection failed');
      const instance = new FakeOleDbConnection();
      FakeOleDbConnection.instances.push(instance);
      return instance;
    });

    await south.connect();
    assert.strictEqual(callCount, 1);

    mock.timers.tick(configuration.settings.retryInterval);
    // flush microtasks so the async connect callback can reach the connection
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(callCount, 2);
  });

  it('clears the reconnect timeout on disconnect and does not retry afterwards', async () => {
    let callCount = 0;
    FakeOleDbConnection.connectMock = mock.fn(async (_connectionString: string) => {
      callCount++;
      throw new Error('connection failed');
    });

    await south.connect();
    await south.disconnect();
    mock.timers.tick(configuration.settings.retryInterval);
    await Promise.resolve();
    assert.strictEqual(callCount, 1, 'no reconnect attempt after disconnect cleared the timer');
  });

  it('connects and disconnects a throwaway connection for testConnection', async () => {
    await assert.doesNotReject(south.testConnection());
    const connection = FakeOleDbConnection.latest();
    assert.strictEqual(connection.disconnect.mock.calls.length, 1);
  });

  it('propagates a connection failure from testConnection', async () => {
    FakeOleDbConnection.connectMock = mock.fn(async (_connectionString: string) => {
      throw new Error('provider not registered');
    });

    await assert.rejects(south.testConnection(), { message: 'provider not registered' });
  });

  it('throws from queryData when not connected', async () => {
    await assert.rejects(south.queryData(configuration.items[0], '2020-01-01', '2020-01-02'), {
      message: 'OLE DB source is not connected'
    });
  });

  it('queries through the connection with the adapted @StartTime/@EndTime and returns raw rows', async () => {
    const startTime = testData.constants.dates.DATE_1;
    const endTime = testData.constants.dates.FAKE_NOW;
    await south.connect();
    const connection = FakeOleDbConnection.latest();
    connection.read = mock.fn(async () => [{ timestamp: '2020-03-01T00:00:00.000Z', value: 1 }]);
    let formatCallCount = 0;
    utilsExports.formatInstant = mock.fn(() => {
      formatCallCount++;
      return formatCallCount === 1 ? '2020-01-01 00:00:00.000' : '2020-06-01 00:00:00.000';
    });

    const result = await south.queryData(configuration.items[0], startTime, endTime);

    assert.deepStrictEqual(result, [{ timestamp: '2020-03-01T00:00:00.000Z', value: 1 }]);
    assert.strictEqual(connection.read.mock.calls.length, 1);
    assert.deepStrictEqual(connection.read.mock.calls[0].arguments, [
      'SELECT * FROM table WHERE timestamp > 2020-01-01 00:00:00.000 AND timestamp < 2020-06-01 00:00:00.000',
      configuration.settings.requestTimeout
    ]);
    assert.strictEqual((utilsExports.logQuery as ReturnType<typeof mock.fn>).mock.calls.length, 1);
  });

  it('does not format @StartTime/@EndTime when the item does not track an instant', async () => {
    const startTime = testData.constants.dates.DATE_1;
    const endTime = testData.constants.dates.FAKE_NOW;
    await south.connect();
    const connection = FakeOleDbConnection.latest();
    connection.read = mock.fn(async () => []);

    await south.queryData(configuration.items[1], startTime, endTime);

    assert.strictEqual((utilsExports.formatInstant as ReturnType<typeof mock.fn>).mock.calls.length, 0);
    assert.deepStrictEqual(connection.read.mock.calls[0].arguments, ['query2', configuration.settings.requestTimeout]);
  });

  it('runs testItem through queryData and wraps the result as record-list content', async () => {
    const queryDataMock = mock.method(
      south,
      'queryData',
      mock.fn(async () => {
        mock.timers.tick(25);
        return [{ timestamp: '2020-02-01T00:00:00.000Z', value: 123 }];
      })
    );

    const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[0], startTime, endTime]);
    assert.deepStrictEqual(result.result, { type: 'record-list', content: [{ timestamp: '2020-02-01T00:00:00.000Z', value: 123 }] });
    assert.strictEqual(result.queryDuration, 25);
    assert.strictEqual(result.connectionDuration, 0);
  });

  it('runs historyQuery, adds record-list content and tracks the max instant', async () => {
    const startTime = testData.constants.dates.DATE_1;
    const queryDataMock = mock.method(
      south,
      'queryData',
      mock.fn(async () => [
        { timestamp: '2020-03-01T00:00:00.000Z', value: 456 },
        { timestamp: '2020-02-01T00:00:00.000Z', value: 123 }
      ])
    );

    const result = await south.historyQuery([configuration.items[0]], startTime, testData.constants.dates.FAKE_NOW);

    assert.strictEqual(queryDataMock.mock.calls.length, 1);
    assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[0], startTime, testData.constants.dates.FAKE_NOW]);
    assert.strictEqual(addContentCallback.mock.calls.length, 1);
    assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
      type: 'record-list',
      content: [
        { timestamp: '2020-03-01T00:00:00.000Z', value: 456 },
        { timestamp: '2020-02-01T00:00:00.000Z', value: 123 }
      ]
    });
    assert.deepStrictEqual(result, {
      trackedInstant: '2020-03-01T00:00:00.000Z',
      value: { timestamp: '2020-02-01T00:00:00.000Z', value: 123 }
    });
  });

  it('runs historyQuery without adding content when no rows are found', async () => {
    const startTime = testData.constants.dates.DATE_1;
    mock.method(
      south,
      'queryData',
      mock.fn(async () => [])
    );

    const result = await south.historyQuery([configuration.items[0]], startTime, testData.constants.dates.FAKE_NOW);

    assert.strictEqual(addContentCallback.mock.calls.length, 0);
    assert.deepStrictEqual(result, { trackedInstant: null, value: null });
    assert.ok(
      logger.debug.mock.calls.some(
        (c: { arguments: Array<unknown> }) => typeof c.arguments[1] === 'string' && c.arguments[1].includes('No result found')
      )
    );
  });

  it('does nothing on disconnect when never connected', async () => {
    await assert.doesNotReject(south.disconnect());
  });

  it('disconnects the active connection and clears it', async () => {
    await south.connect();
    const connection = FakeOleDbConnection.latest();

    await south.disconnect();
    assert.strictEqual(connection.disconnect.mock.calls.length, 1);
    await assert.rejects(south.queryData(configuration.items[0], '2020-01-01', '2020-01-02'), {
      message: 'OLE DB source is not connected'
    });
  });
});
