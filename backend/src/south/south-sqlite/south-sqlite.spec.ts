import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import { DateTime } from 'luxon';

import type { OIBusContent } from '../../../shared/model/common/content.model';
import type { SouthItemSettings, SouthSQLiteItemSettings, SouthSQLiteSettings } from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type * as Utils from '../../service/utils';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { buildSouthEntity, createMock, mockModule, reloadModule, seq } from '../../tests/utils/test-utils';
import type SouthSQLiteClass from './south-sqlite';

const nodeRequire = createRequire(import.meta.url);

const trackedItemSettings = (query: string): SouthSQLiteItemSettings => ({
  query,
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
});

const configuration = buildSouthEntity<SouthSQLiteSettings, SouthSQLiteItemSettings>('sqlite', { databasePath: './database.db' }, [
  trackedItemSettings('SELECT * FROM table WHERE timestamp > @StartTime and timestamp < @EndTime'),
  { query: 'query 2', trackingInstant: { trackInstant: false } },
  trackedItemSettings('query 3')
]);
const dbPath = path.resolve(configuration.settings.databasePath);

/** A `prepare` implementation returning, call after call, a statement whose `all()` gives each of these row sets. */
const statements = (...rowSets: Array<Array<unknown>>) => seq(...rowSets.map(rows => () => ({ all: () => rows })));

describe('SouthSQLite', () => {
  let SouthSQLite: typeof SouthSQLiteClass;
  let south: SouthSQLiteClass;

  let logger: PinoLogger;
  let addContentCallback: Mock<
    (southId: string, data: OIBusContent, queryTime: string, items: Array<SouthConnectorItemEntity<SouthItemSettings>>) => Promise<void>
  >;
  let database: { prepare: Mock<(sql: string) => unknown>; close: Mock<() => void> };

  const realUtils: typeof Utils = nodeRequire('../../service/utils');
  const createUtilsMocks = () => ({
    formatInstant: mock.fn((instant: unknown) => instant),
    convertDateTimeToInstant: mock.fn((instant: unknown) => instant),
    logQuery: mock.fn(),
    extractDiscoveryQuery: mock.fn(realUtils.extractDiscoveryQuery)
  });
  const utilsExports = { ...realUtils, ...createUtilsMocks() };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, 'better-sqlite3', () => database);
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthSQLite = reloadModule<{ default: typeof SouthSQLiteClass }>(nodeRequire, './south-sqlite').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    addContentCallback = mock.fn(async () => undefined);
    database = { prepare: mock.fn(), close: mock.fn() };
    Object.assign(utilsExports, createUtilsMocks());
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    south = new SouthSQLite(configuration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');
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
    utilsExports.formatInstant.mock.mockImplementation(() => '2020-02-01 00:00:00.000');

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
    const foundLog = logger.info.mock.calls.find((c: { arguments: Array<unknown> }) => c.arguments[1] === 'Found 2 results in 0 ms');
    assert.ok(foundLog);
    assert.deepStrictEqual(foundLog.arguments[0], { itemId: configuration.items[0].id, itemName: configuration.items[0].name });
  });

  it('should properly run historyQuery without result', async () => {
    const startTime = testData.constants.dates.DATE_1;
    const queryDataMock = mock.method(south, 'queryData', async () => []);

    const result = await south.historyQuery([configuration.items[0]], startTime, testData.constants.dates.FAKE_NOW);
    assert.strictEqual(addContentCallback.mock.calls.length, 0);
    assert.strictEqual(queryDataMock.mock.calls.length, 1);
    assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [
      configuration.items[0],
      testData.constants.dates.DATE_1,
      testData.constants.dates.FAKE_NOW
    ]);
    assert.deepStrictEqual(result, { trackedInstant: null, value: null });
    const noResultLog = logger.debug.mock.calls.find(
      (c: { arguments: Array<unknown> }) => c.arguments[1] === 'No result found. Request done in 0 ms'
    );
    assert.ok(noResultLog);
    assert.deepStrictEqual(noResultLog.arguments[0], { itemId: configuration.items[0].id, itemName: configuration.items[0].name });
  });

  it('should get data from sqlite', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';
    const formattedStartTime = DateTime.fromISO(startTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS');
    const formattedEndTime = DateTime.fromISO(endTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS');

    database.prepare.mock.mockImplementation(
      statements([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }])
    );
    utilsExports.formatInstant.mock.mockImplementation(
      seq(
        () => formattedStartTime,
        () => formattedEndTime
      )
    );

    const result = await south.queryData(configuration.items[0], startTime, endTime);

    assert.strictEqual(utilsExports.logQuery.mock.calls.length, 1);
    assert.deepStrictEqual(utilsExports.logQuery.mock.calls[0].arguments, [
      configuration.items[0].settings.query,
      formattedStartTime,
      formattedEndTime,
      logger,
      { itemId: configuration.items[0].id, itemName: configuration.items[0].name }
    ]);

    assert.deepStrictEqual(result, [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
  });

  it('should get data from sqlite without reference', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';

    database.prepare.mock.mockImplementation(
      statements([{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }])
    );

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
    database.prepare.mock.mockImplementation(() => ({
      all: () => {
        throw new Error('query error');
      }
    }));

    assert.throws(() => south.queryData(configuration.items[1], startTime, endTime), { message: 'query error' });
  });

  it("should discover a Configuration Workflow's dedicated metadata query, with no @StartTime/@EndTime substitution", async () => {
    database.prepare.mock.mockImplementation(statements([{ column_name: 'temp', description: 'Temperature' }]));

    const result = await south.discover({ query: 'SELECT column_name, description FROM my_metadata_table' });

    assert.deepStrictEqual(utilsExports.extractDiscoveryQuery.mock.calls[0].arguments[0], {
      query: 'SELECT column_name, description FROM my_metadata_table'
    });
    assert.strictEqual(database.prepare.mock.calls[0].arguments[0], 'SELECT column_name, description FROM my_metadata_table');
    assert.strictEqual(database.close.mock.calls.length, 1);
    assert.deepStrictEqual(result, [{ column_name: 'temp', description: 'Temperature' }]);
  });

  it('should discover the item of each table checked in the explore modal, quoted and tracked as SQLite reads them', async () => {
    mock.method(south, 'explore', async (parentId: string | null) =>
      parentId === null
        ? [{ id: 'production', name: 'production', metadata: { columns: 3 }, hasChildren: true }]
        : [
            { id: `${parentId}.id`, name: 'id', metadata: { type: 'int' }, hasChildren: false },
            { id: `${parentId}.value`, name: 'value', metadata: { type: 'float' }, hasChildren: false },
            { id: `${parentId}.produced_at`, name: 'produced_at', metadata: { type: 'DATETIME' }, hasChildren: false }
          ]
    );

    const records = await south.discover({ nodeIds: ['production.value'] });

    assert.deepStrictEqual(records, [
      {
        id: 'production',
        name: 'production',
        query: 'SELECT "produced_at", "value" FROM "production" WHERE "produced_at" > @StartTime AND "produced_at" <= @EndTime',
        trackInstant: true,
        timeColumn: 'produced_at',
        dateTimeType: 'iso-string'
      }
    ]);
  });

  it('should close the database and rethrow when the discovery query fails', async () => {
    const queryError = new Error('bad query');
    database.prepare.mock.mockImplementation(() => {
      throw queryError;
    });

    await assert.rejects(south.discover({ query: 'SELECT 1' }), queryError);
    assert.strictEqual(database.close.mock.calls.length, 1);
  });

  it('should test item', async () => {
    const queryDataMock = mock.method(south, 'queryData', async () => {
      mock.timers.tick(25);
      return [
        { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
        { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
      ];
    });

    const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[0], startTime, endTime]);
    assert.strictEqual(result.queryDuration, 25);
    assert.strictEqual(result.connectionDuration, 0);
  });

  it('should test item without datetimeFields', async () => {
    const queryDataMock = mock.method(south, 'queryData', async () => {
      mock.timers.tick(25);
      return [
        { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
        { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
      ];
    });

    const result = await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[1], startTime, endTime]);
    assert.strictEqual(result.queryDuration, 25);
    assert.strictEqual(result.connectionDuration, 0);
  });

  describe('test connection', () => {
    let access: Mock<typeof fs.access>;
    let stat: Mock<(path: string) => Promise<unknown>>;

    beforeEach(() => {
      access = mock.method(fs, 'access', async () => undefined);
      stat = mock.method(fs, 'stat', async () => ({ size: 2048 }));
    });

    it('Database is reachable and has tables', async () => {
      database.prepare.mock.mockImplementation(statements([{ table_count: 21 }], [{ version: '3.39.5' }]));
      stat.mock.mockImplementation(async () => ({ size: 10240 }));

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
      database.prepare.mock.mockImplementation(statements([{ table_count: 5 }], [{}]));

      const testResult = await south.testConnection();

      assert.deepStrictEqual(testResult, {
        items: [
          { key: 'Tables', value: '5' },
          { key: 'File Size', value: '2.0 KB' }
        ]
      });
    });

    it('Database is reachable but version query throws', async () => {
      database.prepare.mock.mockImplementation(
        seq(
          () => ({ all: () => [{ table_count: 5 }] }),
          () => {
            throw new Error('version query error');
          }
        )
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
      database.prepare.mock.mockImplementation(statements([{ table_count: 5 }], [{ version: '3.39.5' }]));
      stat.mock.mockImplementation(async () => {
        throw new Error('stat error');
      });

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
      access.mock.mockImplementation(async () => {
        throw new Error(errorMessage);
      });

      await assert.rejects(south.testConnection(), { message: `Access error on "${dbPath}". ${errorMessage}` });
    });

    it('Database connection error', async () => {
      const errorMessage = `Can't query database`;
      database.prepare.mock.mockImplementation(() => {
        throw new Error(errorMessage);
      });

      await assert.rejects(south.testConnection(), { message: `Unable to query system table. ${errorMessage}` });
    });

    it('Database has no tables', async () => {
      database.prepare.mock.mockImplementation(statements([{ table_count: 0 }]));

      await assert.rejects(south.testConnection(), { message: `Database "${dbPath}" has no tables` });
    });

    it('Database does not return count of tables', async () => {
      database.prepare.mock.mockImplementation(statements([]));

      await assert.rejects(south.testConnection(), { message: `Database "${dbPath}" has no tables` });
    });
  });

  describe('explore', () => {
    it('should list every table at the root, with its column and row counts', async () => {
      database.prepare.mock.mockImplementation(
        statements(
          [{ name: 'sensors' }, { name: 'events' }], // list tables
          [{ name: 'id' }, { name: 'value' }, { name: 'timestamp' }], // PRAGMA table_info("sensors")
          [{ count: 128 }], // SELECT COUNT(*) FROM "sensors"
          [{ name: 'id' }], // PRAGMA table_info("events")
          [{ count: 0 }] // SELECT COUNT(*) FROM "events"
        )
      );

      const entries = await south.explore(null);

      assert.deepStrictEqual(entries, [
        { id: 'sensors', name: 'sensors', metadata: { columns: 3, rows: 128 }, hasChildren: true },
        { id: 'events', name: 'events', metadata: { columns: 1, rows: 0 }, hasChildren: true }
      ]);
      assert.strictEqual(database.close.mock.calls.length, 1);
    });

    it('should list columns with their type, nullability, primary-key flag and default when expanding a table', async () => {
      database.prepare.mock.mockImplementation(
        statements([
          { name: 'id', type: 'INTEGER', notnull: 1, dflt_value: null, pk: 1 },
          { name: 'label', type: 'TEXT', notnull: 0, dflt_value: "'unknown'", pk: 0 },
          { name: 'untyped', type: '', notnull: 0, dflt_value: null, pk: 0 }
        ])
      );

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
      database.prepare.mock.mockImplementation(
        seq(
          () => ({ all: () => [{ name: 'broken' }] }),
          () => ({ all: () => [{ name: 'col' }] }),
          () => ({
            all: () => {
              throw new Error('database disk image is malformed');
            }
          })
        )
      );

      const entries = await south.explore(null);

      assert.deepStrictEqual(entries, [{ id: 'broken', name: 'broken', metadata: { columns: 1 }, hasChildren: true }]);
    });

    it('should close the database even when listing columns fails', async () => {
      database.prepare.mock.mockImplementation(() => ({
        all: () => {
          throw new Error('no such table: missing');
        }
      }));

      await assert.rejects(south.explore('missing'), { message: 'no such table: missing' });
      assert.strictEqual(database.close.mock.calls.length, 1);
    });
  });
});
