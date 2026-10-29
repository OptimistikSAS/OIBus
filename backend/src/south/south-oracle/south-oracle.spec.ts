import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { OIBusContent } from '../../../shared/model/common/content.model';
import type { SouthItemSettings, SouthOracleItemSettings, SouthOracleSettings } from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type * as Utils from '../../service/utils';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type SouthOracleClass from './south-oracle';

const nodeRequire = createRequire(import.meta.url);

// Error codes handled by the test connection function
const ERROR_CODES = {
  'NJS-515': 'Please check host and port.',
  'NJS-503': 'Please check host and port.',
  'ORA-01017': 'Please check username and password.',
  'NJS-518': `Cannot connect to database "db". Service is not registered.`,
  DEFAULT: 'Unexpected error.'
} as const;
type ErrorCodes = keyof typeof ERROR_CODES;

class OracleDBError extends Error {
  constructor(
    message: string,
    private code: string
  ) {
    super();
    this.name = 'SouthOracleError';
    this.message = message;
    this.code = code;
  }
}

const trackedItemSettings = (query: string): SouthOracleItemSettings => ({
  query,
  requestTimeout: 1000,
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

const buildItem = (
  id: string,
  settings: SouthOracleItemSettings,
  scanMode = testData.scanMode.list[0]
): SouthConnectorItemEntity<SouthOracleItemSettings> => ({
  id,
  name: id.replace('id', 'item'),
  enabled: true,
  settings,
  scanMode,
  group: null,
  syncWithGroup: false,
  maxReadInterval: 3600,
  readDelay: 0,
  startTimeOffset: 0,
  endTimeOffset: null,
  recoveryStrategy: null,
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
});

const buildConfiguration = (
  settings: Partial<SouthOracleSettings>,
  items: Array<SouthConnectorItemEntity<SouthOracleItemSettings>>
): SouthConnectorEntity<SouthOracleSettings, SouthOracleItemSettings> => ({
  id: 'southId',
  name: 'south',
  type: 'oracle',
  description: 'my test connector',
  enabled: true,
  settings: {
    host: 'localhost',
    port: 1521,
    database: 'db',
    username: 'username',
    password: 'password',
    connectionTimeout: 1000,
    thickMode: false,
    ...settings
  },
  groups: [],
  items,
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
});

const items = [
  buildItem('id1', trackedItemSettings('query1')),
  buildItem('id2', { query: 'query2', requestTimeout: 1000, trackingInstant: { trackInstant: false } })
];

describe('SouthOracle', () => {
  let SouthOracle: typeof SouthOracleClass;

  let logger: PinoLogger;
  let addContentCallback: Mock<
    (southId: string, data: OIBusContent, queryTime: string, items: Array<SouthConnectorItemEntity<SouthItemSettings>>) => Promise<void>
  >;
  let ping: Mock<() => void>;
  let close: Mock<() => void>;
  let execute: Mock<(sql: string, params?: unknown) => Promise<unknown>>;
  let getConnection: Mock<(config: unknown) => Promise<unknown>>;
  let initOracleClient: Mock<(options: unknown) => void>;

  const oracledbExports: Record<string, unknown> = {
    __esModule: true,
    outFormat: 0,
    OUT_FORMAT_OBJECT: 4001
  };
  oracledbExports.default = oracledbExports;

  const realUtils: typeof Utils = nodeRequire('../../service/utils');
  const createUtilsMocks = () => ({
    convertDateTimeToInstant: mock.fn((instant: unknown) => instant),
    formatInstant: mock.fn((instant: unknown) => instant),
    generateReplacementParameters: mock.fn((): unknown => []),
    logQuery: mock.fn(),
    extractDiscoveryQuery: mock.fn(realUtils.extractDiscoveryQuery)
  });
  const utilsExports = { ...realUtils, ...createUtilsMocks() };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, 'oracledb', oracledbExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: new EncryptionServiceMock('', '')
    });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthOracle = reloadModule<{ default: typeof SouthOracleClass }>(nodeRequire, './south-oracle').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    addContentCallback = mock.fn(async () => undefined);
    ping = mock.fn();
    close = mock.fn();
    execute = mock.fn(async () => ({ rows: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }] }));
    getConnection = mock.fn(async () => ({ ping, close, execute, callTimeout: 0 }));
    initOracleClient = mock.fn();
    Object.assign(oracledbExports, { getConnection, initOracleClient, oracleClientVersion: undefined });
    Object.assign(utilsExports, createUtilsMocks());
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('SouthOracle with authentication', () => {
    let south: SouthOracleClass;
    const configuration = buildConfiguration({ thickMode: true }, [
      ...items,
      buildItem('id3', trackedItemSettings('query3'), testData.scanMode.list[1])
    ]);

    beforeEach(() => {
      south = new SouthOracle(configuration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');
    });

    it('should properly run historyQuery', async () => {
      const startTime = testData.constants.dates.DATE_1;
      const queryDataMock = mock.method(
        south,
        'queryData',
        mock.fn(async () => [
          { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 },
          { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 }
        ])
      );
      utilsExports.formatInstant.mock.mockImplementation(() => '2020-02-01 00:00:00.000');

      const result = await south.historyQuery([configuration.items[0]], startTime, testData.constants.dates.FAKE_NOW);
      assert.strictEqual(addContentCallback.mock.calls.length, 1);
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments[1], {
        type: 'record-list',
        content: [
          { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 },
          { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 }
        ]
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
      const foundLog = logger.info.mock.calls.find(
        (c: { arguments: Array<unknown> }) => typeof c.arguments[1] === 'string' && c.arguments[1].includes('Found 2 results')
      );
      assert.ok(foundLog);
      assert.deepStrictEqual(foundLog.arguments[0], { itemId: configuration.items[0].id, itemName: configuration.items[0].name });
    });

    it('should properly run historyQuery without result', async () => {
      const startTime = testData.constants.dates.DATE_1;
      const queryDataMock = mock.method(
        south,
        'queryData',
        mock.fn(async () => [])
      );

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
        (c: { arguments: Array<unknown> }) => typeof c.arguments[1] === 'string' && c.arguments[1].includes('No result found')
      );
      assert.ok(noResultLog);
      assert.deepStrictEqual(noResultLog.arguments[0], { itemId: configuration.items[0].id, itemName: configuration.items[0].name });
    });

    it('should get data from Oracle', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      const formattedStart = '2020-01-01 00:00:00.000';
      const formattedEnd = '2022-01-01 00:00:00.000';

      let formatCallCount = 0;
      utilsExports.formatInstant.mock.mockImplementation(() => {
        formatCallCount++;
        if (formatCallCount === 1) return formattedStart;
        if (formatCallCount === 2) return formattedEnd;
        return startTime;
      });

      const replacementParams = { startTime: formattedStart, endTime: formattedEnd };
      utilsExports.generateReplacementParameters.mock.mockImplementation(() => replacementParams);

      const result = await south.queryData(configuration.items[0], startTime, endTime);

      assert.strictEqual(utilsExports.formatInstant.mock.calls.length, 2);
      assert.strictEqual(utilsExports.logQuery.mock.calls.length, 1);
      assert.deepStrictEqual(utilsExports.logQuery.mock.calls[0].arguments[0], configuration.items[0].settings.query);

      assert.strictEqual(getConnection.mock.calls.length, 1);
      assert.deepStrictEqual(getConnection.mock.calls[0].arguments[0], {
        user: configuration.settings.username,
        password: 'password',
        connectString: `${configuration.settings.host}:${configuration.settings.port}/${configuration.settings.database}?connect_timeout=${configuration.settings.connectionTimeout}ms`
      });

      assert.strictEqual(utilsExports.generateReplacementParameters.mock.calls.length, 1);
      assert.deepStrictEqual(utilsExports.generateReplacementParameters.mock.calls[0].arguments, [
        configuration.items[0].settings.query,
        formattedStart,
        formattedEnd
      ]);

      assert.strictEqual(execute.mock.calls.length, 1);
      assert.deepStrictEqual(
        execute.mock.calls[0].arguments[0],
        configuration.items[0].settings.query.replace(/@StartTime/g, ':date1').replace(/@EndTime/g, ':date2')
      );
      assert.deepStrictEqual(execute.mock.calls[0].arguments[1], replacementParams);

      assert.strictEqual(close.mock.calls.length, 1);
      assert.deepStrictEqual(result, [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
    });

    it('should get data from Oracle when rows is null', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      execute.mock.mockImplementation(async () => ({ rows: null }));

      const result = await south.queryData(configuration.items[0], startTime, endTime);
      assert.deepStrictEqual(result, []);
      assert.strictEqual(close.mock.calls.length, 1);
    });

    it('should get data from Oracle without datetime reference', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      const result = await south.queryData(configuration.items[1], startTime, endTime);

      assert.strictEqual(utilsExports.formatInstant.mock.calls.length, 0);
      assert.strictEqual(utilsExports.logQuery.mock.calls.length, 1);
      assert.deepStrictEqual(utilsExports.logQuery.mock.calls[0].arguments[0], configuration.items[1].settings.query);
      assert.deepStrictEqual(result, [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
    });

    it('should manage query error', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      const replacementParams = { startTime, endTime };
      utilsExports.generateReplacementParameters.mock.mockImplementation(() => replacementParams);
      execute.mock.mockImplementation(async () => {
        throw new Error('query error');
      });

      await assert.rejects(south.queryData(configuration.items[0], startTime, endTime), new Error('query error'));

      assert.strictEqual(execute.mock.calls.length, 1);
      assert.deepStrictEqual(
        execute.mock.calls[0].arguments[0],
        configuration.items[0].settings.query.replace(/@StartTime/g, ':date1').replace(/@EndTime/g, ':date2')
      );
      assert.deepStrictEqual(execute.mock.calls[0].arguments[1], replacementParams);
      assert.strictEqual(close.mock.calls.length, 1);
    });

    it('should test item', async () => {
      const queryDataMock = mock.method(
        south,
        'queryData',
        mock.fn(async () => {
          mock.timers.tick(25);
          return [
            { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
            { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
          ];
        })
      );

      const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
      const { startTime, endTime } = testData.south.itemTestingSettings.history!;
      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[0], startTime, endTime]);
      assert.strictEqual(result.queryDuration, 25);
      assert.strictEqual(result.connectionDuration, 0);
    });

    it('should test item without datetimeFields', async () => {
      const queryDataMock = mock.method(
        south,
        'queryData',
        mock.fn(async () => {
          mock.timers.tick(25);
          return [
            { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
            { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
          ];
        })
      );

      const result = await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
      const { startTime, endTime } = testData.south.itemTestingSettings.history!;
      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[1], startTime, endTime]);
      assert.strictEqual(result.queryDuration, 25);
      assert.strictEqual(result.connectionDuration, 0);
    });

    it("should discover a Configuration Workflow's dedicated metadata query, with no @StartTime/@EndTime substitution", async () => {
      execute.mock.mockImplementation(async () => ({ rows: [{ column_name: 'temp', description: 'Temperature' }] }));

      const result = await south.discover({ query: 'SELECT column_name, description FROM my_metadata_table' });

      assert.deepStrictEqual(utilsExports.extractDiscoveryQuery.mock.calls[0].arguments[0], {
        query: 'SELECT column_name, description FROM my_metadata_table'
      });
      assert.strictEqual(execute.mock.calls.length, 1);
      assert.strictEqual(execute.mock.calls[0].arguments[0], 'SELECT column_name, description FROM my_metadata_table');
      assert.strictEqual(close.mock.calls.length, 1);
      assert.deepStrictEqual(result, [{ column_name: 'temp', description: 'Temperature' }]);
    });

    it('should discover as an empty array when the metadata query returns no rows', async () => {
      execute.mock.mockImplementation(async () => ({ rows: null }));

      const result = await south.discover({ query: 'SELECT 1' });

      assert.deepStrictEqual(result, []);
    });

    it('should explore the tables of the schema of the user, then the columns of a table', async () => {
      execute.mock.mockImplementation(async query =>
        query.includes('USER_TABLES')
          ? { rows: [{ tableName: 'PRODUCTION', rowCount: 1200, columnCount: 2 }] }
          : {
              rows: [
                { name: 'ID', type: 'NUMBER', nullable: 'N', primaryKey: 1 },
                { name: 'PRODUCED_AT', type: 'TIMESTAMP(6)', nullable: 'Y', primaryKey: 0 }
              ]
            }
      );

      assert.deepStrictEqual(await south.explore(null), [
        {
          id: 'PRODUCTION',
          name: 'PRODUCTION',
          metadata: { columns: 2, rows: 1200, select: 'SELECT * FROM "PRODUCTION"' },
          hasChildren: true
        }
      ]);
      assert.deepStrictEqual(await south.explore('PRODUCTION'), [
        { id: 'PRODUCTION.ID', name: 'ID', metadata: { nullable: 'no', type: 'NUMBER', primaryKey: 'yes' }, hasChildren: false },
        { id: 'PRODUCTION.PRODUCED_AT', name: 'PRODUCED_AT', metadata: { nullable: 'yes', type: 'TIMESTAMP(6)' }, hasChildren: false }
      ]);
      assert.deepStrictEqual(execute.mock.calls[1].arguments[1], { tableName: 'PRODUCTION' });
      assert.strictEqual(close.mock.calls.length, 2);
    });

    it('should discover the item of each table checked in the explore modal, quoted and tracked as Oracle reads them', async () => {
      mock.method(south, 'explore', async (parentId: string | null) =>
        parentId === null
          ? [{ id: 'PRODUCTION', name: 'PRODUCTION', metadata: { columns: 3 }, hasChildren: true }]
          : [
              { id: `${parentId}.id`, name: 'id', metadata: { type: 'int' }, hasChildren: false },
              { id: `${parentId}.value`, name: 'value', metadata: { type: 'float' }, hasChildren: false },
              { id: `${parentId}.produced_at`, name: 'produced_at', metadata: { type: 'TIMESTAMP(6)' }, hasChildren: false }
            ]
      );

      const records = await south.discover({ nodeIds: ['PRODUCTION.value'] });

      assert.deepStrictEqual(records, [
        {
          id: 'PRODUCTION',
          name: 'PRODUCTION',
          query: 'SELECT "produced_at", "value" FROM "PRODUCTION" WHERE "produced_at" > @StartTime AND "produced_at" <= @EndTime',
          plainQuery: 'SELECT "produced_at", "value" FROM "PRODUCTION"',
          trackInstant: true,
          timeColumn: 'produced_at',
          dateTimeType: 'date-time'
        }
      ]);
    });

    it('should close the connection and rethrow when the discovery query fails', async () => {
      const queryError = new Error('bad query');
      execute.mock.mockImplementation(async () => {
        throw queryError;
      });

      await assert.rejects(south.discover({ query: 'SELECT 1' }), queryError);
      assert.strictEqual(close.mock.calls.length, 1);
    });
  });

  describe('SouthOracle without authentication but with thick mode', () => {
    let south: SouthOracleClass;
    const configuration = buildConfiguration(
      { username: null, password: null, connectionTimeout: 0, thickMode: true, oracleClient: 'path' },
      items
    );

    beforeEach(() => {
      south = new SouthOracle(configuration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');
    });

    it('should call initOracleClient when thick mode is enabled and oracleClientVersion is not set', () => {
      assert.strictEqual(initOracleClient.mock.calls.length, 1);
      assert.deepStrictEqual(initOracleClient.mock.calls[0].arguments[0], {
        libDir: path.resolve(configuration.settings.oracleClient!)
      });
    });

    it('should manage connection error', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      getConnection.mock.mockImplementation(() => {
        throw new Error('connection error');
      });

      await assert.rejects(south.queryData(configuration.items[0], startTime, endTime), new Error('connection error'));

      assert.strictEqual(getConnection.mock.calls.length, 1);
      assert.deepStrictEqual(getConnection.mock.calls[0].arguments[0], {
        user: undefined,
        password: undefined,
        connectString: `${configuration.settings.host}:${configuration.settings.port}/${configuration.settings.database}`
      });
    });
  });

  describe('SouthOracle thick mode initialization failure', () => {
    it('should log an error and fall back to thin mode when initOracleClient throws', () => {
      initOracleClient.mock.mockImplementation(() => {
        throw new Error('thick mode init error');
      });
      const south = new SouthOracle(
        buildConfiguration({ username: null, password: null, connectionTimeout: 0, thickMode: true, oracleClient: 'path' }, []),
        addContentCallback,
        createMock<SouthCacheRepository>(),
        'cacheFolder'
      );
      assert.ok(south);
      assert.ok(
        logger.error.mock.calls.some(
          c =>
            (c.arguments[0] as string).includes('FATAL: Failed to initialize Oracle Thick mode') &&
            (c.arguments[0] as string).includes('thick mode init error')
        )
      );
    });
  });

  describe('SouthOracle test connection', () => {
    let south: SouthOracleClass;
    const configuration = buildConfiguration({}, []);

    beforeEach(() => {
      south = new SouthOracle(configuration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');
    });

    it('Database is reachable and has tables', async () => {
      execute.mock.mockImplementation(async () => ({ rows: [{ TABLE_COUNT: 21 }] }));

      const result = await south.testConnection();

      assert.deepStrictEqual(result, { items: [] });
      assert.deepStrictEqual(getConnection.mock.calls[0].arguments, [
        { user: 'username', password: 'password', connectString: 'localhost:1521/db?connect_timeout=1000ms' }
      ]);
      assert.strictEqual(ping.mock.calls.length, 1);
      assert.strictEqual(execute.mock.calls.length, 1);
      assert.strictEqual(close.mock.calls.length, 1);
    });

    it('Database is reachable but returns no tables', async () => {
      execute.mock.mockImplementation(async () => ({ rows: [{ TABLE_COUNT: 0 }] }));

      await assert.rejects(south.testConnection(), new Error(`No tables in the "${configuration.settings.username}" schema`));
      assert.ok(close.mock.calls.length > 0);
    });

    it('Unable to create connection', async () => {
      const errorMessage = 'Error creating connection';

      for (const code of Object.keys(ERROR_CODES) as Array<ErrorCodes>) {
        getConnection.mock.mockImplementation(() => {
          throw new OracleDBError(errorMessage, code);
        });
        await assert.rejects(south.testConnection(), new Error(`${ERROR_CODES[code]} ${errorMessage}`));
      }
    });

    it('Unable to ping database', async () => {
      const errorMessage = 'Error pinging database';

      for (const [index, code] of (Object.keys(ERROR_CODES) as Array<ErrorCodes>).entries()) {
        ping.mock.mockImplementation(() => {
          throw new OracleDBError(errorMessage, code);
        });
        await assert.rejects(south.testConnection(), new Error(`${ERROR_CODES[code]} ${errorMessage}`));
        assert.strictEqual(close.mock.calls.length, index + 1);
      }
    });

    it('System table unreachable', async () => {
      const errorMessage = 'ALL_TABLES does not exist';
      execute.mock.mockImplementation(async () => {
        throw new Error(errorMessage);
      });

      await assert.rejects(
        south.testConnection(),
        new Error(`Unable to read tables in database "${configuration.settings.database}": ${errorMessage}`)
      );
      assert.ok(close.mock.calls.length > 0);
    });

    it('Database does not return count of tables', async () => {
      execute.mock.mockImplementation(async () => ({ rows: [] }));

      await assert.rejects(south.testConnection(), new Error(`No tables in the "${configuration.settings.username}" schema`));
      assert.ok(close.mock.calls.length > 0);
    });

    it('Unable to ping database without password', async () => {
      south = new SouthOracle(
        buildConfiguration({ username: '', password: '' }, []),
        addContentCallback,
        createMock<SouthCacheRepository>(),
        'cacheFolder'
      );
      const errorMessage = 'Error pinging database';

      for (const [index, code] of (Object.keys(ERROR_CODES) as Array<ErrorCodes>).entries()) {
        ping.mock.mockImplementation(() => {
          throw new OracleDBError(errorMessage, code);
        });
        await assert.rejects(south.testConnection(), new Error(`${ERROR_CODES[code]} ${errorMessage}`));
        // An empty username and password are not sent to the driver
        assert.deepStrictEqual(getConnection.mock.calls[index].arguments, [
          { user: undefined, password: undefined, connectString: 'localhost:1521/db?connect_timeout=1000ms' }
        ]);
        assert.strictEqual(close.mock.calls.length, index + 1);
      }
    });
  });
});
