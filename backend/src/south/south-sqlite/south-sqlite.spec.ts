import { describe, it, before, beforeEach, afterEach, mock, type Mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule, buildSouthEntity } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type SouthSQLiteClass from './south-sqlite';
import type { SouthConnectorItemEntity } from '../../model/south-connector.model';
import type { OIBusContent } from '../../../shared/model/engine.model';
import type { SouthItemSettings } from '../../../shared/model/south-settings.model';
import type { SouthSQLiteItemSettings, SouthSQLiteSettings } from '../../../shared/model/south-settings.model';
import { DateTime } from 'luxon';

const nodeRequire = createRequire(import.meta.url);

const logger = new PinoLogger();
const addContentCallback = mock.fn(
  async (_southId: string, _data: OIBusContent, _queryTime: string, _items: Array<SouthConnectorItemEntity<SouthItemSettings>>) => undefined
);
const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;

const mockDatabase: {
  prepare: Mock<(_sql?: unknown) => unknown>;
  transaction: Mock<() => undefined>;
  close: Mock<() => undefined>;
  all: Mock<(_sql?: unknown) => unknown>;
} = {
  prepare: mock.fn((_sql?: unknown): unknown => undefined),
  transaction: mock.fn(),
  close: mock.fn(),
  all: mock.fn((_sql?: unknown): unknown => undefined)
};

const utilsExports = {
  checkAge: mock.fn(() => true),
  compress: mock.fn(async () => undefined),
  delay: mock.fn(async () => undefined),
  generateIntervals: mock.fn(() => []),
  groupItemsByGroup: mock.fn(() => []),
  validateCronExpression: mock.fn(() => ({ expression: '' })),
  formatInstant: mock.fn((inst: unknown) => inst),
  convertDateTimeToInstant: mock.fn((inst: unknown) => inst),
  logQuery: mock.fn(),
  generateReplacementParameters: mock.fn((): unknown => []),
  extractDiscoveryQuery: mock.fn((scope: Record<string, unknown>) => scope.query as string),
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

const connectorSettings: SouthSQLiteSettings = {
  databasePath: './database.db'
};

const itemSettings: Array<SouthSQLiteItemSettings> = [
  {
    query: 'SELECT * FROM table WHERE timestamp > @StartTime and timestamp < @EndTime',
    trackingInstant: {
      trackInstant: true,
      fieldName: 'timestamp',
      dateTimeInput: {
        type: 'string',
        timezone: 'Europe/Paris',
        format: 'yyyy-MM-dd HH:mm:ss.SSS',
        locale: 'en-US'
      }
    }
  },
  {
    query: 'query 2',
    trackingInstant: {
      trackInstant: false
    }
  },
  {
    query: 'query 3',
    trackingInstant: {
      trackInstant: true,
      fieldName: 'timestamp',
      dateTimeInput: {
        type: 'string',
        timezone: 'Europe/Paris',
        format: 'yyyy-MM-dd HH:mm:ss.SSS',
        locale: 'en-US'
      }
    }
  }
];

let SouthSQLite: typeof SouthSQLiteClass;

describe('SouthSQLite', () => {
  let south: SouthSQLiteClass;
  const configuration = buildSouthEntity<SouthSQLiteSettings, SouthSQLiteItemSettings>('sqlite', connectorSettings, itemSettings);

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, 'better-sqlite3', () => mockDatabase);
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: mock.fn(() => logger) },
      default: class {}
    });

    SouthSQLite = reloadModule<{ default: typeof SouthSQLiteClass }>(nodeRequire, './south-sqlite').default;
  });

  beforeEach(() => {
    addContentCallback.mock.resetCalls();

    mockDatabase.prepare = mock.fn();
    mockDatabase.all = mock.fn();

    utilsExports.formatInstant = mock.fn((inst: unknown) => inst);
    utilsExports.convertDateTimeToInstant = mock.fn((inst: unknown) => inst);
    utilsExports.logQuery = mock.fn();
    utilsExports.generateReplacementParameters = mock.fn(() => [
      new Date(testData.constants.dates.FAKE_NOW),
      new Date(testData.constants.dates.FAKE_NOW)
    ]);

    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    south = new SouthSQLite(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should properly run historyQuery', async () => {
    const startTime = testData.constants.dates.DATE_1;
    const queryDataResults = [
      { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 },
      { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 }
    ];
    const queryDataMock = mock.method(south, 'queryData', async () => queryDataResults);
    utilsExports.formatInstant = mock.fn(() => '2020-02-01 00:00:00.000');

    const result = await south.historyQuery([configuration.items[0]], startTime, testData.constants.dates.FAKE_NOW);
    assert.strictEqual(addContentCallback.mock.calls.length, 1);
    assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
      type: 'record-list',
      content: queryDataResults
    });
    assert.strictEqual(queryDataMock.mock.calls.length, 1);
    assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [
      configuration.items[0],
      testData.constants.dates.DATE_1,
      testData.constants.dates.FAKE_NOW
    ]);
    assert.deepStrictEqual(result, {
      trackedInstant: '2020-03-01T00:00:00.000Z',
      value: { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 }
    });
    const foundLog = (logger.info as ReturnType<typeof mock.fn>).mock.calls.find(
      (c: { arguments: Array<unknown> }) => c.arguments[1] === 'Found 2 results in 0 ms'
    );
    assert.ok(foundLog);
    assert.deepStrictEqual(foundLog.arguments[0], { itemId: configuration.items[0].id, itemName: configuration.items[0].name });
  });

  it('should properly run historyQuery without result', async () => {
    const startTime = testData.constants.dates.DATE_1;
    const queryDataMock = mock.method(south, 'queryData', async () => [] as Array<Record<string, string | number>>);

    const result = await south.historyQuery([configuration.items[0]], startTime, testData.constants.dates.FAKE_NOW);
    assert.strictEqual(addContentCallback.mock.calls.length, 0);
    assert.strictEqual(queryDataMock.mock.calls.length, 1);
    assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [
      configuration.items[0],
      testData.constants.dates.DATE_1,
      testData.constants.dates.FAKE_NOW
    ]);
    assert.deepStrictEqual(result, { trackedInstant: null, value: null });
    const noResultLog = (logger.debug as ReturnType<typeof mock.fn>).mock.calls.find(
      (c: { arguments: Array<unknown> }) => c.arguments[1] === 'No result found. Request done in 0 ms'
    );
    assert.ok(noResultLog);
    assert.deepStrictEqual(noResultLog.arguments[0], { itemId: configuration.items[0].id, itemName: configuration.items[0].name });
  });

  it('should get data from sqlite', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    mockDatabase.all = mock.fn(() => [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
    utilsExports.formatInstant = mock.fn(
      (() => {
        let callCount = 0;
        return () => {
          callCount++;
          if (callCount === 1) return DateTime.fromISO(startTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS');
          return DateTime.fromISO(endTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS');
        };
      })()
    );

    mockDatabase.prepare = mock.fn(() => ({ all: mockDatabase.all }));
    const result = await south.queryData(configuration.items[0], startTime, endTime);

    assert.strictEqual(utilsExports.logQuery.mock.calls.length, 1);
    assert.deepStrictEqual(utilsExports.logQuery.mock.calls[0].arguments, [
      configuration.items[0].settings.query,
      DateTime.fromISO(startTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS'),
      DateTime.fromISO(endTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS'),
      logger,
      { itemId: configuration.items[0].id, itemName: configuration.items[0].name }
    ]);

    assert.deepStrictEqual(result, [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
  });

  it('should get data from sqlite without reference', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    mockDatabase.all = mock.fn(() => [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
    mockDatabase.prepare = mock.fn(() => ({ all: mockDatabase.all }));

    const result = await south.queryData(configuration.items[1], startTime, endTime);
    assert.strictEqual(utilsExports.formatInstant.mock.calls.length, 0);
    assert.deepStrictEqual(utilsExports.logQuery.mock.calls[0].arguments, [
      configuration.items[1].settings.query,
      startTime,
      endTime,
      logger,
      { itemId: configuration.items[1].id, itemName: configuration.items[1].name }
    ]);

    assert.deepStrictEqual(result, [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
  });

  it('should manage query error', () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';
    mockDatabase.all = mock.fn(() => {
      throw new Error('query error');
    });
    mockDatabase.prepare = mock.fn(() => ({ all: mockDatabase.all }));

    assert.throws(() => south.queryData(configuration.items[1], startTime, endTime), { message: 'query error' });
  });

  it("should discover a Configuration Workflow's dedicated metadata query, with no @StartTime/@EndTime substitution", async () => {
    const mockAll = mock.fn(() => [{ column_name: 'temp', description: 'Temperature' }]);
    mockDatabase.prepare = mock.fn(() => ({ all: mockAll }));
    // mockDatabase.close isn't reset in this describe block's beforeEach (unlike prepare/all) - its
    // call count from earlier tests would otherwise leak into this assertion.
    mockDatabase.close.mock.resetCalls();

    const result = await south.discover({ query: 'SELECT column_name, description FROM my_metadata_table' });

    assert.deepStrictEqual(utilsExports.extractDiscoveryQuery.mock.calls[0].arguments[0], {
      query: 'SELECT column_name, description FROM my_metadata_table'
    });
    assert.strictEqual(mockDatabase.prepare.mock.calls[0].arguments[0], 'SELECT column_name, description FROM my_metadata_table');
    assert.strictEqual(mockDatabase.close.mock.calls.length, 1);
    assert.deepStrictEqual(result, [{ column_name: 'temp', description: 'Temperature' }]);
  });

  it('should close the database and rethrow when the discovery query fails', async () => {
    const queryError = new Error('bad query');
    mockDatabase.prepare = mock.fn(() => {
      throw queryError;
    });
    mockDatabase.close.mock.resetCalls();

    await assert.rejects(south.discover({ query: 'SELECT 1' }), queryError);
    assert.strictEqual(mockDatabase.close.mock.calls.length, 1);
  });

  it('should test item', async () => {
    const formattedInstant = '2020-01-01T00:00:00.000Z';
    utilsExports.formatInstant = mock.fn(() => formattedInstant);
    const queryDataMock = mock.method(south, 'queryData', async () => {
      mock.timers.tick(25);
      return [
        { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
        { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
      ] as Array<Record<string, string | number>>;
    });

    const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[0], startTime, endTime]);
    assert.strictEqual(result.queryDuration, 25);
    assert.strictEqual(result.connectionDuration, 0);
  });

  it('should test item without datetimeFields', async () => {
    const formattedInstant = '2020-01-01T00:00:00.000Z';
    utilsExports.formatInstant = mock.fn(() => formattedInstant);
    const queryDataMock = mock.method(south, 'queryData', async () => {
      mock.timers.tick(25);
      return [
        { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
        { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
      ] as Array<Record<string, string | number>>;
    });

    const result = await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[1], startTime, endTime]);
    assert.strictEqual(result.queryDuration, 25);
    assert.strictEqual(result.connectionDuration, 0);
  });
});

describe('SouthSQLite test connection', () => {
  let south: SouthSQLiteClass;
  const configuration = buildSouthEntity<SouthSQLiteSettings, SouthSQLiteItemSettings>('sqlite', connectorSettings, itemSettings);
  const dbPath = path.resolve(configuration.settings.databasePath);

  before(() => {
    // SouthSQLite is already loaded by the first describe block's before()
    // No need to reload; module is shared
  });

  beforeEach(() => {
    addContentCallback.mock.resetCalls();

    mockDatabase.prepare = mock.fn();
    mockDatabase.all = mock.fn();

    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    south = new SouthSQLite(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('Database is reachable and has tables', async () => {
    const tableCountAll = mock.fn(() => [{ table_count: 21 }]);
    const versionAll = mock.fn(() => [{ version: '3.39.5' }]);
    let prepareCallCount = 0;
    mockDatabase.prepare = mock.fn(() => {
      prepareCallCount++;
      if (prepareCallCount === 1) return { all: tableCountAll };
      return { all: versionAll };
    });
    mock.method(
      fs,
      'access',
      mock.fn(async () => undefined)
    );
    mock.method(
      fs,
      'stat',
      mock.fn(async () => ({ size: 10240 }))
    );

    const testResult = await south.testConnection();

    assert.deepStrictEqual(testResult, {
      items: [
        { key: 'SQLite Version', value: '3.39.5' },
        { key: 'Tables', value: '21' },
        { key: 'File Size', value: '10.0 KB' }
      ]
    });
  });

  it('Database is reachable but version is unavailable', async () => {
    const tableCountAll = mock.fn(() => [{ table_count: 5 }]);
    const versionAll = mock.fn(() => [{}]);
    let prepareCallCount = 0;
    mockDatabase.prepare = mock.fn(() => {
      prepareCallCount++;
      if (prepareCallCount === 1) return { all: tableCountAll };
      return { all: versionAll };
    });
    mock.method(
      fs,
      'access',
      mock.fn(async () => undefined)
    );
    mock.method(
      fs,
      'stat',
      mock.fn(async () => ({ size: 2048 }))
    );

    const testResult = await south.testConnection();

    assert.deepStrictEqual(testResult, {
      items: [
        { key: 'Tables', value: '5' },
        { key: 'File Size', value: '2.0 KB' }
      ]
    });
  });

  it('Database is reachable but version query throws', async () => {
    const tableCountAll = mock.fn(() => [{ table_count: 5 }]);
    let prepareCallCount = 0;
    mockDatabase.prepare = mock.fn(() => {
      prepareCallCount++;
      if (prepareCallCount === 1) return { all: tableCountAll };
      throw new Error('version query error');
    });
    mock.method(
      fs,
      'access',
      mock.fn(async () => undefined)
    );
    mock.method(
      fs,
      'stat',
      mock.fn(async () => ({ size: 2048 }))
    );

    const testResult = await south.testConnection();

    assert.deepStrictEqual(testResult, {
      items: [
        { key: 'Tables', value: '5' },
        { key: 'File Size', value: '2.0 KB' }
      ]
    });
  });

  it('Database is reachable but file stat throws', async () => {
    const tableCountAll = mock.fn(() => [{ table_count: 5 }]);
    const versionAll = mock.fn(() => [{ version: '3.39.5' }]);
    let prepareCallCount = 0;
    mockDatabase.prepare = mock.fn(() => {
      prepareCallCount++;
      if (prepareCallCount === 1) return { all: tableCountAll };
      return { all: versionAll };
    });
    mock.method(
      fs,
      'access',
      mock.fn(async () => undefined)
    );
    mock.method(
      fs,
      'stat',
      mock.fn(async () => {
        throw new Error('stat error');
      })
    );

    const testResult = await south.testConnection();

    assert.deepStrictEqual(testResult, {
      items: [
        { key: 'SQLite Version', value: '3.39.5' },
        { key: 'Tables', value: '5' }
      ]
    });
  });

  it('Database file does not exist', async () => {
    const errorMessage = 'File does not exist';
    mock.method(
      fs,
      'access',
      mock.fn(() => {
        throw new Error(errorMessage);
      })
    );

    await assert.rejects(south.testConnection(), { message: `Access error on "${dbPath}". ${errorMessage}` });
  });

  it('Database connection error', async () => {
    const errorMessage = `Can't query database`;
    mock.method(
      fs,
      'access',
      mock.fn(async () => undefined)
    );
    mockDatabase.prepare = mock.fn(() => {
      throw new Error(errorMessage);
    });

    await assert.rejects(south.testConnection(), { message: `Unable to query system table. ${errorMessage}` });
  });

  it('Database has no tables', async () => {
    mock.method(
      fs,
      'access',
      mock.fn(async () => undefined)
    );
    mockDatabase.all = mock.fn(() => [{ table_count: 0 }]);
    mockDatabase.prepare = mock.fn(() => ({ all: mockDatabase.all }));

    await assert.rejects(south.testConnection(), { message: `Database "${dbPath}" has no tables` });
  });

  it('Database does not return count of tables', async () => {
    mock.method(
      fs,
      'access',
      mock.fn(async () => undefined)
    );
    mockDatabase.all = mock.fn(() => []);
    mockDatabase.prepare = mock.fn(() => ({ all: mockDatabase.all }));

    await assert.rejects(south.testConnection(), { message: `Database "${dbPath}" has no tables` });
  });
});

describe('SouthSQLite explore', () => {
  let south: SouthSQLiteClass;
  const configuration = buildSouthEntity<SouthSQLiteSettings, SouthSQLiteItemSettings>('sqlite', connectorSettings, itemSettings);

  before(() => {
    // SouthSQLite is already loaded by the first describe block's before(); module is shared.
  });

  beforeEach(() => {
    mockDatabase.close = mock.fn();
    south = new SouthSQLite(configuration, addContentCallback, southCacheRepository, 'cacheFolder');
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it('should list every table at the root, with its column and row counts', async () => {
    let prepareCallCount = 0;
    mockDatabase.prepare = mock.fn(() => {
      prepareCallCount++;
      switch (prepareCallCount) {
        case 1: // list tables
          return { all: mock.fn(() => [{ name: 'sensors' }, { name: 'events' }]) };
        case 2: // PRAGMA table_info("sensors")
          return { all: mock.fn(() => [{ name: 'id' }, { name: 'value' }, { name: 'timestamp' }]) };
        case 3: // SELECT COUNT(*) FROM "sensors"
          return { all: mock.fn(() => [{ count: 128 }]) };
        case 4: // PRAGMA table_info("events")
          return { all: mock.fn(() => [{ name: 'id' }]) };
        default: // SELECT COUNT(*) FROM "events"
          return { all: mock.fn(() => [{ count: 0 }]) };
      }
    });

    const entries = await south.explore(null);

    assert.deepStrictEqual(entries, [
      { id: 'sensors', name: 'sensors', metadata: { columns: 3, rows: 128 }, hasChildren: true },
      { id: 'events', name: 'events', metadata: { columns: 1, rows: 0 }, hasChildren: true }
    ]);
    assert.strictEqual(mockDatabase.close.mock.calls.length, 1);
  });

  it('should list columns with their type, nullability, primary-key flag and default when expanding a table', async () => {
    mockDatabase.prepare = mock.fn(() => ({
      all: mock.fn(() => [
        { name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
        { name: 'label', type: 'TEXT', notnull: 0, dflt_value: "'unknown'", pk: 0 },
        { name: 'untyped', type: '', notnull: 0, dflt_value: null, pk: 0 }
      ])
    }));

    const entries = await south.explore('sensors');

    assert.deepStrictEqual(entries, [
      {
        id: 'sensors.id',
        name: 'id',
        metadata: { nullable: 'no', type: 'INTEGER', primaryKey: 'yes' },
        hasChildren: false
      },
      {
        id: 'sensors.label',
        name: 'label',
        metadata: { nullable: 'yes', type: 'TEXT', default: "'unknown'" },
        hasChildren: false
      },
      // SQLite is dynamically typed — a column can have no declared type at all, and this one has
      // never been given a default, so both are omitted rather than shown as blank/null.
      { id: 'sensors.untyped', name: 'untyped', metadata: { nullable: 'yes' }, hasChildren: false }
    ]);
  });

  it('should still list a table when its row count cannot be read (e.g. a broken table)', async () => {
    let prepareCallCount = 0;
    mockDatabase.prepare = mock.fn(() => {
      prepareCallCount++;
      if (prepareCallCount === 1) return { all: mock.fn(() => [{ name: 'broken' }]) };
      if (prepareCallCount === 2) return { all: mock.fn(() => [{ name: 'col' }]) };
      return {
        all: mock.fn(() => {
          throw new Error('database disk image is malformed');
        })
      };
    });

    const entries = await south.explore(null);

    assert.deepStrictEqual(entries, [{ id: 'broken', name: 'broken', metadata: { columns: 1 }, hasChildren: true }]);
  });

  it('should close the database even when listing columns fails', async () => {
    mockDatabase.prepare = mock.fn(() => ({
      all: mock.fn(() => {
        throw new Error('no such table: missing');
      })
    }));

    await assert.rejects(south.explore('missing'), { message: 'no such table: missing' });
    assert.strictEqual(mockDatabase.close.mock.calls.length, 1);
  });
});
