import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import { DateTime } from 'luxon';

import type { OIBusContent } from '../../../shared/model/common/content.model';
import type {
  SouthItemSettings,
  SouthPostgreSQLItemSettings,
  SouthPostgreSQLSettings,
  SouthPostgreSQLSettingsConnectionSettings
} from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import type * as Utils from '../../service/utils';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, flushPromises, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type SouthPostgreSQLClass from './south-postgresql';

const nodeRequire = createRequire(import.meta.url);

// Error messages handled by the test function
// With the expected error messages to throw
// Note: The PostgreSQL connect function throws errors with no codes,
//       so messages are used to distinguish the cases
const ERROR_MESSAGES = {
  'timeout expired': 'Please check host and port.',
  'connect ECONNREFUSED ::1:1234': 'Please check host and port.',
  'password authentication failed for user "username"': 'Please check username and password.',
  'database "db" does not exist': `Database "db" does not exist.`,
  DEFAULT: 'Unexpected error.'
} as const;

type ErrorMessages = keyof typeof ERROR_MESSAGES;

class PGError extends Error {
  constructor(message: ErrorMessages) {
    super();
    this.name = 'PGError';
    this.message = message;
  }
}

const trackedItemSettings = (query: string): SouthPostgreSQLItemSettings => ({
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
  settings: SouthPostgreSQLItemSettings,
  scanMode = testData.scanMode.list[0]
): SouthConnectorItemEntity<SouthPostgreSQLItemSettings> => ({
  id,
  name: id.replace('id', 'item'),
  description: null,
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
  emptyIntervalStrategy: null,
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
  connectionSettings: Partial<SouthPostgreSQLSettingsConnectionSettings>,
  items: Array<SouthConnectorItemEntity<SouthPostgreSQLItemSettings>>,
  maxParallelRun = 1
): SouthConnectorEntity<SouthPostgreSQLSettings, SouthPostgreSQLItemSettings> => ({
  id: 'southId',
  name: 'south',
  type: 'postgresql',
  description: 'my test connector',
  enabled: true,
  settings: {
    connectionSettings: {
      host: 'localhost',
      port: 5432,
      database: 'db',
      sslMode: false,
      username: 'username',
      password: 'password',
      connectionTimeout: 1000,
      idleTimeout: 30000,
      ...connectionSettings
    },
    maxParallelRun
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
  buildItem('id2', { query: 'query2', requestTimeout: 2000, trackingInstant: { trackInstant: false } }),
  buildItem('id3', trackedItemSettings('query3'), testData.scanMode.list[1])
];

describe('SouthPostgreSQL', () => {
  let SouthPostgreSQL: typeof SouthPostgreSQLClass;

  let logger: PinoLogger;
  let addContentCallback: Mock<
    (southId: string, data: OIBusContent, queryTime: string, items: Array<SouthConnectorItemEntity<SouthItemSettings>>) => Promise<void>
  >;
  let clientConnect: Mock<() => Promise<void>>;
  let clientQuery: Mock<(query?: unknown, params?: unknown) => Promise<unknown>>;
  let clientEnd: Mock<() => Promise<void>>;
  let Client: Mock<(config: unknown) => unknown>;

  // `import * as pg` copies the keys present when the SUT loads: Client must exist from the start
  const pgExports: Record<string, unknown> = { __esModule: true, Client: undefined, Pool: undefined };
  pgExports.default = pgExports;

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
    mockModule(nodeRequire, 'pg', pgExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: new EncryptionServiceMock('', '')
    });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthPostgreSQL = reloadModule<{ default: typeof SouthPostgreSQLClass }>(nodeRequire, './south-postgresql').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    addContentCallback = mock.fn(async () => undefined);
    clientConnect = mock.fn(async () => undefined);
    clientQuery = mock.fn(async () => ({
      rows: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]
    }));
    clientEnd = mock.fn(async () => undefined);
    Client = mock.fn(function () {
      return { connect: clientConnect, query: clientQuery, end: clientEnd };
    });
    pgExports.Client = Client;
    Object.assign(utilsExports, createUtilsMocks());
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('SouthPostgreSQL with authentication', () => {
    let south: SouthPostgreSQLClass;
    const configuration = buildConfiguration({ sslMode: true }, items);

    beforeEach(() => {
      south = new SouthPostgreSQL(configuration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');
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

    it('should get data from PostgreSQL', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      const formattedStartTime = DateTime.fromISO(startTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS');
      const formattedEndTime = DateTime.fromISO(endTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS');

      const replacementParams = { startTime: formattedStartTime, endTime: formattedEndTime };
      utilsExports.generateReplacementParameters.mock.mockImplementation(() => replacementParams);

      let formatCallCount = 0;
      utilsExports.formatInstant.mock.mockImplementation(() => {
        formatCallCount++;
        if (formatCallCount === 1) return formattedStartTime;
        if (formatCallCount === 2) return formattedEndTime;
        return startTime;
      });

      const result = await south.queryData(configuration.items[0], startTime, endTime);

      assert.strictEqual(utilsExports.logQuery.mock.calls.length, 1);
      assert.deepStrictEqual(utilsExports.logQuery.mock.calls[0].arguments[0], configuration.items[0].settings.query);

      assert.strictEqual(Client.mock.calls.length, 1);
      assert.deepStrictEqual(Client.mock.calls[0].arguments[0], {
        host: configuration.settings.connectionSettings.host,
        port: configuration.settings.connectionSettings.port,
        user: configuration.settings.connectionSettings.username,
        password: configuration.settings.connectionSettings.password,
        database: configuration.settings.connectionSettings.database,
        connectionTimeoutMillis: configuration.settings.connectionSettings.connectionTimeout,
        query_timeout: 15_000,
        ssl: true
      });

      assert.strictEqual(clientConnect.mock.calls.length, 1);

      // The timeout of the item overrides the one of the client
      assert.deepStrictEqual(clientQuery.mock.calls[0].arguments, [
        {
          text: configuration.items[0].settings.query.replace(/@StartTime/g, '$1').replace(/@EndTime/g, '$2'),
          values: replacementParams,
          query_timeout: configuration.items[0].settings.requestTimeout
        }
      ]);

      assert.strictEqual(clientEnd.mock.calls.length, 1);

      assert.deepStrictEqual(utilsExports.generateReplacementParameters.mock.calls[0].arguments, [
        configuration.items[0].settings.query,
        formattedStartTime,
        formattedEndTime
      ]);

      assert.deepStrictEqual(result, [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
    });

    it('should get data from PostgreSQL without reference', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      const result = await south.queryData(configuration.items[1], startTime, endTime);

      assert.strictEqual(utilsExports.formatInstant.mock.calls.length, 0);
      assert.deepStrictEqual(utilsExports.logQuery.mock.calls[0].arguments[0], configuration.items[1].settings.query);

      assert.deepStrictEqual(result, [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
    });

    it('should manage query error', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      utilsExports.generateReplacementParameters.mock.mockImplementation(() => ({ startTime, endTime }));
      clientQuery.mock.mockImplementationOnce(async () => {
        throw new Error('query error');
      });

      await assert.rejects(south.queryData(configuration.items[0], startTime, endTime), new Error('query error'));

      assert.strictEqual(clientConnect.mock.calls.length, 1);
      assert.strictEqual(clientEnd.mock.calls.length, 1);
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
      clientQuery.mock.mockImplementationOnce(async () => ({ rows: [{ column_name: 'temp', description: 'Temperature' }] }));

      const result = await south.discover({ query: 'SELECT column_name, description FROM my_metadata_table' });

      assert.deepStrictEqual(utilsExports.extractDiscoveryQuery.mock.calls[0].arguments[0], {
        query: 'SELECT column_name, description FROM my_metadata_table'
      });
      assert.strictEqual(clientConnect.mock.calls.length, 1);
      assert.strictEqual(clientQuery.mock.calls[0].arguments[0], 'SELECT column_name, description FROM my_metadata_table');
      assert.strictEqual(clientEnd.mock.calls.length, 1);
      assert.deepStrictEqual(result, [{ column_name: 'temp', description: 'Temperature' }]);
    });

    it('should explore the tables of the database, schema-qualified, then the columns of a table', async () => {
      clientQuery.mock.mockImplementation(async query =>
        String(query).includes('information_schema.tables')
          ? { rows: [{ tableSchema: 'public', tableName: 'production', columnCount: 2, rowCount: '1200' }] }
          : {
              rows: [
                { name: 'id', type: 'integer', nullable: 'NO', columnDefault: null, primaryKey: true },
                { name: 'produced_at', type: 'timestamp with time zone', nullable: 'YES', columnDefault: 'now()', primaryKey: false }
              ]
            }
      );

      assert.deepStrictEqual(await south.explore(null), [
        {
          id: 'public.production',
          name: 'public.production',
          metadata: { columns: 2, rows: 1200, select: 'SELECT * FROM "public"."production"' },
          hasChildren: true
        }
      ]);
      assert.deepStrictEqual(await south.explore('public.production'), [
        { id: 'public.production.id', name: 'id', metadata: { nullable: 'no', type: 'integer', primaryKey: 'yes' }, hasChildren: false },
        {
          id: 'public.production.produced_at',
          name: 'produced_at',
          metadata: { nullable: 'yes', type: 'timestamp with time zone', default: 'now()' },
          hasChildren: false
        }
      ]);
      assert.deepStrictEqual(clientQuery.mock.calls.at(-1)!.arguments[1], ['public', 'production']);
      assert.strictEqual(clientEnd.mock.calls.length, 2);
    });

    it('should discover the item of each table checked in the explore modal, quoted and tracked as PostgreSQL reads them', async () => {
      mock.method(south, 'explore', async (parentId: string | null) =>
        parentId === null
          ? [{ id: 'public.production', name: 'public.production', metadata: { columns: 3 }, hasChildren: true }]
          : [
              { id: `${parentId}.id`, name: 'id', metadata: { type: 'int' }, hasChildren: false },
              { id: `${parentId}.value`, name: 'value', metadata: { type: 'float' }, hasChildren: false },
              { id: `${parentId}.produced_at`, name: 'produced_at', metadata: { type: 'timestamp with time zone' }, hasChildren: false }
            ]
      );

      const records = await south.discover({ nodeIds: ['public.production.value'] });

      assert.deepStrictEqual(records, [
        {
          id: 'public.production',
          name: 'public.production',
          query: 'SELECT "produced_at", "value" FROM "public"."production" WHERE "produced_at" > @StartTime AND "produced_at" <= @EndTime',
          plainQuery: 'SELECT "produced_at", "value" FROM "public"."production"',
          trackInstant: true,
          timeColumn: 'produced_at',
          dateTimeType: 'timestamptz'
        }
      ]);
    });

    it('should close the connection and rethrow when the discovery query fails', async () => {
      const queryError = new Error('bad query');
      clientQuery.mock.mockImplementationOnce(async () => {
        throw queryError;
      });

      await assert.rejects(south.discover({ query: 'SELECT 1' }), queryError);
      assert.strictEqual(clientEnd.mock.calls.length, 1);
    });
  });

  describe('SouthPostgreSQL without authentication', () => {
    let south: SouthPostgreSQLClass;
    const configuration = buildConfiguration({ port: 1521, username: '', password: '' }, items);

    beforeEach(() => {
      south = new SouthPostgreSQL(configuration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');
    });

    it('should manage connection error', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      utilsExports.generateReplacementParameters.mock.mockImplementation(() => ({ startTime, endTime }));
      Client.mock.mockImplementation(function () {
        throw new Error('connection error');
      });

      await assert.rejects(south.queryData(configuration.items[0], startTime, endTime), new Error('connection error'));
    });
  });

  describe('SouthPostgreSQL test connection', () => {
    let south: SouthPostgreSQLClass;
    const configuration = buildConfiguration({}, []);

    beforeEach(() => {
      south = new SouthPostgreSQL(configuration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');
    });

    it('Database is reachable and has tables', async () => {
      let queryCallCount = 0;
      clientQuery.mock.mockImplementation(async () => {
        queryCallCount++;
        if (queryCallCount === 1) return { rows: [{ table_count: 21 }] };
        return { rows: [{ version: 'PostgreSQL 14.5 on x86_64-pc-linux-gnu' }] };
      });

      const testResult = await south.testConnection();
      assert.deepStrictEqual(testResult, {
        items: [
          { key: 'Version', value: 'PostgreSQL 14.5 on x86_64-pc-linux-gnu' },
          { key: 'Tables', value: '21' }
        ]
      });
      assert.ok(clientEnd.mock.calls.length > 0);
    });

    it('Database is reachable but version is unavailable', async () => {
      let queryCallCount = 0;
      clientQuery.mock.mockImplementation(async () => {
        queryCallCount++;
        if (queryCallCount === 1) return { rows: [{ table_count: 5 }] };
        return { rows: [{}] };
      });

      const testResult = await south.testConnection();
      assert.deepStrictEqual(testResult, { items: [{ key: 'Tables', value: '5' }] });
      assert.ok(clientEnd.mock.calls.length > 0);
    });

    it('Unable to create connection', async () => {
      for (const errorMessage of Object.keys(ERROR_MESSAGES) as Array<ErrorMessages>) {
        Client.mock.mockImplementation(function () {
          throw new PGError(errorMessage);
        });
        await assert.rejects(south.testConnection(), new Error(`${ERROR_MESSAGES[errorMessage]} ${errorMessage}`));
      }
    });

    it('System table unreachable', async () => {
      const errorMessage = 'information_schema.TABLES does not exist';
      clientQuery.mock.mockImplementationOnce(async () => {
        throw new Error(errorMessage);
      });

      await assert.rejects(
        south.testConnection(),
        new Error(`Unable to read tables in database "${configuration.settings.connectionSettings.database}". ${errorMessage}`)
      );
      assert.ok(clientEnd.mock.calls.length > 0);
    });

    it('Database has no tables', async () => {
      clientQuery.mock.mockImplementation(async () => ({ rows: [{ table_count: 0 }] }));

      await assert.rejects(
        south.testConnection(),
        new Error(`Database "${configuration.settings.connectionSettings.database}" has no tables`)
      );
      assert.ok(clientEnd.mock.calls.length > 0);
    });

    it('Database does not return count of tables', async () => {
      clientQuery.mock.mockImplementation(async () => ({ rows: [] }));

      await assert.rejects(
        south.testConnection(),
        new Error(`Database "${configuration.settings.connectionSettings.database}" has no tables`)
      );
      assert.ok(clientEnd.mock.calls.length > 0);
    });

    it('Unable to connect to database without password', async () => {
      for (const errorMessage of Object.keys(ERROR_MESSAGES) as Array<ErrorMessages>) {
        clientConnect.mock.mockImplementationOnce(async () => {
          throw new PGError(errorMessage);
        });
        await assert.rejects(south.testConnection(), new Error(`${ERROR_MESSAGES[errorMessage]} ${errorMessage}`));
      }
    });
  });

  describe('SouthPostgreSQL parallel runs', () => {
    it('should run up to maxParallelRun work-units in parallel, within the ceiling of the manifest', () => {
      for (const [maxParallelRun, expected] of [
        [1, 1],
        [4, 4],
        [50, 8],
        [0, 1]
      ]) {
        const south = new SouthPostgreSQL(
          buildConfiguration({}, items, maxParallelRun),
          addContentCallback,
          createMock<SouthCacheRepository>(),
          'cacheFolder'
        );
        assert.strictEqual(south['getMaxParallelRun'](), expected);
      }
    });

    it('should open its own client for each query running at the same time when the connector is not running', async () => {
      const south = new SouthPostgreSQL(
        buildConfiguration({}, items, 2),
        addContentCallback,
        createMock<SouthCacheRepository>(),
        'cacheFolder'
      );
      const resolvers: Array<() => void> = [];
      clientQuery.mock.mockImplementation(() => new Promise(resolve => resolvers.push(() => resolve({ rows: [{ value: 1 }] }))));

      const runs = Promise.all([
        south.queryData(items[0], testData.constants.dates.DATE_1, testData.constants.dates.FAKE_NOW),
        south.queryData(items[1], testData.constants.dates.DATE_1, testData.constants.dates.FAKE_NOW)
      ]);
      await flushPromises();
      assert.strictEqual(Client.mock.calls.length, 2);
      assert.strictEqual(clientEnd.mock.calls.length, 0);

      resolvers.forEach(resolve => resolve());
      assert.deepStrictEqual(await runs, [[{ value: 1 }], [{ value: 1 }]]);
      assert.strictEqual(clientEnd.mock.calls.length, 2);
    });
    it('should share one connection pool between the queries while running, and end it on disconnect', async () => {
      const release = mock.fn((_error?: Error) => undefined);
      const on = mock.fn((_event: string, _listener: (error: Error) => void) => undefined);
      const poolEnd = mock.fn(async () => undefined);
      const Pool = mock.fn(function (_options: Record<string, unknown>) {
        return { connect: async () => ({ query: clientQuery, release }), on, end: poolEnd };
      });
      pgExports.Pool = Pool;
      const south = new SouthPostgreSQL(
        buildConfiguration({}, items, 2),
        addContentCallback,
        createMock<SouthCacheRepository>(),
        'cacheFolder'
      );
      await south.connect();

      await south.queryData(items[0], testData.constants.dates.DATE_1, testData.constants.dates.FAKE_NOW);
      await south.queryData(items[1], testData.constants.dates.DATE_1, testData.constants.dates.FAKE_NOW);
      assert.strictEqual(Pool.mock.calls.length, 1);
      const { max, idleTimeoutMillis } = Pool.mock.calls[0].arguments[0];
      assert.deepStrictEqual({ max, idleTimeoutMillis }, { max: 2, idleTimeoutMillis: 30000 });
      assert.deepStrictEqual(
        release.mock.calls.map(c => c.arguments),
        [[], []]
      );
      assert.strictEqual(Client.mock.calls.length, 0);

      // The error of an idle client is logged rather than crashing the process
      on.mock.calls[0].arguments[1](new Error('connection lost'));
      assert.ok(logger.error.mock.calls.some(c => c.arguments[0] === 'PostgreSQL connection pool error: connection lost'));

      await south.disconnect();
      assert.strictEqual(poolEnd.mock.calls.length, 1);
    });

    it('should close the client of a failed query rather than giving it to another query', async () => {
      const release = mock.fn((_error?: Error) => undefined);
      pgExports.Pool = mock.fn(function () {
        return { connect: async () => ({ query: clientQuery, release }), on: mock.fn(), end: mock.fn() };
      });
      const error = new Error('query error');
      clientQuery.mock.mockImplementationOnce(() => Promise.reject(error));
      const south = new SouthPostgreSQL(
        buildConfiguration({}, items, 2),
        addContentCallback,
        createMock<SouthCacheRepository>(),
        'cacheFolder'
      );
      await south.connect();

      await assert.rejects(south.queryData(items[0], testData.constants.dates.DATE_1, testData.constants.dates.FAKE_NOW), {
        message: 'query error'
      });
      assert.deepStrictEqual(release.mock.calls[0].arguments, [error]);
    });
  });
});
