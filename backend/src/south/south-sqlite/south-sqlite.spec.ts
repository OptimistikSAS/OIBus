import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import testData from '../../tests/utils/test-data';
import {mockModule, reloadModule, buildSouthEntity} from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type SouthSQLiteClass from './south-sqlite';
import type {
  SouthSQLiteItemSettings,
  SouthSQLiteItemSettingsDateTimeFields,
  SouthSQLiteSettings
} from '../../../shared/model/south-settings.model';
import { DateTime } from 'luxon';

const nodeRequire = createRequire(import.meta.url);

const logger = new PinoLogger();
const addContentCallback = mock.fn();
const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
let southCacheService: SouthCacheServiceMock;

const mockDatabase = {
  prepare: mock.fn(),
  transaction: mock.fn(),
  close: mock.fn(),
  all: mock.fn()
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
  persistResults: mock.fn(async () => undefined),
  generateReplacementParameters: mock.fn(() => []),
  generateCsvContent: mock.fn(() => ''),
  generateFilenameForSerialization: mock.fn(() => 'file.csv')
};

const connectorSettings: SouthSQLiteSettings = {
  databasePath: './database.db'
};

const itemSettings: Array<SouthSQLiteItemSettings> = [
  {
    query: 'SELECT * FROM table WHERE timestamp > @StartTime and timestamp < @EndTime',
    dateTimeFields: [
      {
        fieldName: 'anotherTimestamp',
        useAsReference: false,
        type: 'unix-epoch-ms',
        timezone: null,
        format: null,
        locale: null
      } as unknown as SouthSQLiteItemSettingsDateTimeFields,
      {
        fieldName: 'timestamp',
        useAsReference: true,
        type: 'string',
        timezone: 'Europe/Paris',
        format: 'yyyy-MM-dd HH:mm:ss.SSS',
        locale: 'en-US'
      }
    ],
    serialization: {
      type: 'csv',
      filename: 'sql-@CurrentDate.csv',
      delimiter: 'COMMA',
      compression: true,
      outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
      outputTimezone: 'Europe/Paris'
    }
  },
  {
    query: 'query 2',
    dateTimeFields: null,
    serialization: {
      type: 'csv',
      filename: 'sql-@CurrentDate.csv',
      delimiter: 'COMMA',
      compression: true,
      outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
      outputTimezone: 'Europe/Paris'
    }
  },
  {
    query: 'query 3',
    dateTimeFields: [
      {
        fieldName: 'anotherTimestamp',
        useAsReference: false,
        type: 'unix-epoch-ms',
        timezone: null,
        format: null,
        locale: null
      } as unknown as SouthSQLiteItemSettingsDateTimeFields,
      {
        fieldName: 'timestamp',
        useAsReference: true,
        type: 'string',
        timezone: 'Europe/Paris',
        format: 'yyyy-MM-dd HH:mm:ss.SSS',
        locale: 'en-US'
      }
    ],
    serialization: {
      type: 'csv',
      filename: 'sql-@CurrentDate.csv',
      delimiter: 'COMMA',
      compression: true,
      outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
      outputTimezone: 'Europe/Paris'
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
    mockModule(nodeRequire, '../../service/south-cache.service', {
      __esModule: true,
      default: function () {
        return southCacheService;
      }
    });
    SouthSQLite = reloadModule<{ default: typeof SouthSQLiteClass }>(nodeRequire, './south-sqlite').default;
  });

  beforeEach(() => {
    southCacheService = new SouthCacheServiceMock();
    addContentCallback.mock.resetCalls();

    mockDatabase.prepare = mock.fn();
    mockDatabase.all = mock.fn();

    utilsExports.formatInstant = mock.fn((inst: unknown) => inst);
    utilsExports.convertDateTimeToInstant = mock.fn((inst: unknown) => inst);
    utilsExports.logQuery = mock.fn();
    utilsExports.persistResults = mock.fn(async () => undefined);
    utilsExports.generateReplacementParameters = mock.fn(() => [
      new Date(testData.constants.dates.FAKE_NOW),
      new Date(testData.constants.dates.FAKE_NOW)
    ]);

    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    south = new SouthSQLite(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
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
    const queryDataMock = mock.method(
      south as unknown as Record<string, unknown>,
      'queryData',
      mock.fn(async () => queryDataResults)
    );
    utilsExports.formatInstant = mock.fn(() => '2020-02-01 00:00:00.000');

    const result = await south.historyQuery(configuration.items, startTime, testData.constants.dates.FAKE_NOW);
    assert.strictEqual(utilsExports.persistResults.mock.calls.length, 1);
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
    assert.strictEqual(
      (logger.info as ReturnType<typeof mock.fn>).mock.calls.some(
        (c: { arguments: Array<unknown> }) => c.arguments[0] === `Found 2 results for item ${configuration.items[0].name} in 0 ms`
      ),
      true
    );
  });

  it('should properly run historyQuery without result', async () => {
    const startTime = testData.constants.dates.DATE_1;
    const queryDataMock = mock.method(
      south as unknown as Record<string, unknown>,
      'queryData',
      mock.fn(async () => [])
    );

    const result = await south.historyQuery(configuration.items, startTime, testData.constants.dates.FAKE_NOW);
    assert.strictEqual(utilsExports.persistResults.mock.calls.length, 0);
    assert.strictEqual(queryDataMock.mock.calls.length, 1);
    assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [
      configuration.items[0],
      testData.constants.dates.DATE_1,
      testData.constants.dates.FAKE_NOW
    ]);
    assert.deepStrictEqual(result, { trackedInstant: null, value: null });
    assert.strictEqual(
      (logger.debug as ReturnType<typeof mock.fn>).mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          c.arguments[0] === `No result found for item ${configuration.items[0].name}. Request done in 0 ms`
      ),
      true
    );
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
      logger
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
      logger
    ]);

    assert.deepStrictEqual(result, [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
  });

  it('should manage query error', async () => {
    const startTime = '2020-01-01T00:00:00.000Z';
    const endTime = '2022-01-01T00:00:00.000Z';
    mockDatabase.all = mock.fn(() => {
      throw new Error('query error');
    });
    mockDatabase.prepare = mock.fn(() => ({ all: mockDatabase.all }));

    await assert.rejects(south.queryData(configuration.items[1], startTime, endTime), { message: 'query error' });
  });

  it('should test item', async () => {
    const formattedInstant = '2020-01-01T00:00:00.000Z';
    utilsExports.formatInstant = mock.fn(() => formattedInstant);
    const queryDataMock = mock.method(
      south as unknown as Record<string, unknown>,
      'queryData',
      mock.fn(async () => [
        { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
        { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
      ])
    );

    await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[0], startTime, endTime]);
  });

  it('should test item without datetimeFields', async () => {
    const formattedInstant = '2020-01-01T00:00:00.000Z';
    utilsExports.formatInstant = mock.fn(() => formattedInstant);
    const queryDataMock = mock.method(
      south as unknown as Record<string, unknown>,
      'queryData',
      mock.fn(async () => [
        { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
        { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
      ])
    );

    await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
    const { startTime, endTime } = testData.south.itemTestingSettings.history!;
    assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[1], startTime, endTime]);
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
    southCacheService = new SouthCacheServiceMock();
    addContentCallback.mock.resetCalls();

    mockDatabase.prepare = mock.fn();
    mockDatabase.all = mock.fn();

    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });

    south = new SouthSQLite(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
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
