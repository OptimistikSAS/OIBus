import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import testData from '../../tests/utils/test-data';
import {mockModule, reloadModule} from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type { OIBusContent } from '../../../shared/model/engine.model';
import type { SouthItemSettings } from '../../../shared/model/south-settings.model';
import type {
  SouthPostgreSQLItemSettings,
  SouthPostgreSQLItemSettingsDateTimeFields,
  SouthPostgreSQLSettings
} from '../../../shared/model/south-settings.model';
import type SouthPostgreSQLClass from './south-postgresql';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import { DateTime } from 'luxon';

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

describe('SouthPostgreSQL', () => {
  let SouthPostgreSQL: typeof SouthPostgreSQLClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn(async (_southId: string, _data: OIBusContent, _queryTime: string, _items: SouthConnectorItemEntity<SouthItemSettings>[]) => undefined);
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
  let southCacheService: SouthCacheServiceMock;

  const clientConnect = mock.fn(async () => undefined);
  const clientQuery = mock.fn(async (_query?: unknown): Promise<unknown> => ({
    rows: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]
  }));
  const clientEnd = mock.fn(async () => undefined);

  const pgExports: Record<string, unknown> = {
    __esModule: true,
    Client: mock.fn(function () {
      return { connect: clientConnect, query: clientQuery, end: clientEnd };
    })
  };
  pgExports.default = pgExports;

  const utilsExports = {
    convertDateTimeToInstant: mock.fn((instant: unknown) => instant),
    formatInstant: mock.fn((instant: unknown) => instant),
    generateCsvContent: mock.fn(() => ''),
    generateFilenameForSerialization: mock.fn(() => 'filename.csv'),
    generateReplacementParameters: mock.fn((): unknown => []),
    logQuery: mock.fn(),
    persistResults: mock.fn(async () => undefined)
  };

  before(() => {
    mockModule(nodeRequire, '../../service/utils', utilsExports);
    mockModule(nodeRequire, 'pg', pgExports);
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
    SouthPostgreSQL = reloadModule<{ default: typeof SouthPostgreSQLClass }>(nodeRequire, './south-postgresql').default;
  });

  beforeEach(() => {
    southCacheService = new SouthCacheServiceMock();
    clientConnect.mock.resetCalls();
    clientQuery.mock.resetCalls();
    clientEnd.mock.resetCalls();
    addContentCallback.mock.resetCalls();
    pgExports.Client = mock.fn(function () {
      return { connect: clientConnect, query: clientQuery, end: clientEnd };
    });
    utilsExports.convertDateTimeToInstant = mock.fn((instant: unknown) => instant);
    utilsExports.formatInstant = mock.fn((instant: unknown) => instant);
    utilsExports.generateCsvContent = mock.fn(() => '');
    utilsExports.generateFilenameForSerialization = mock.fn(() => 'filename.csv');
    utilsExports.generateReplacementParameters = mock.fn(() => []);
    utilsExports.logQuery = mock.fn();
    utilsExports.persistResults = mock.fn(async () => undefined);
    mock.timers.enable({ apis: ['Date'], now: new Date(testData.constants.dates.FAKE_NOW) });
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('SouthPostgreSQL with authentication', () => {
    let south: SouthPostgreSQLClass;
    const configuration: SouthConnectorEntity<SouthPostgreSQLSettings, SouthPostgreSQLItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'postgresql',
      description: 'my test connector',
      enabled: true,
      settings: {
        host: 'localhost',
        port: 5432,
        database: 'db',
        sslMode: true,
        username: 'username',
        password: 'password',
        connectionTimeout: 1000,
        requestTimeout: 1000
      },
      groups: [],
      items: [
        {
          id: 'id1',
          name: 'item1',
          enabled: true,
          settings: {
            query: 'query1',
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthPostgreSQLItemSettingsDateTimeFields,
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
              outputTimestampFormat: 'yyyy-MM-dd',
              outputTimezone: 'Europe/Paris'
            }
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
        },
        {
          id: 'id2',
          name: 'item2',
          enabled: true,
          settings: {
            query: 'query2',
            dateTimeFields: null,
            serialization: {
              type: 'csv',
              filename: 'sql-@CurrentDate.csv',
              delimiter: 'COMMA',
              compression: true,
              outputTimestampFormat: 'yyyy-MM-dd',
              outputTimezone: 'Europe/Paris'
            }
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
        },
        {
          id: 'id3',
          name: 'item3',
          enabled: true,
          settings: {
            query: 'query3',
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthPostgreSQLItemSettingsDateTimeFields,
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
              outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss',
              outputTimezone: 'Europe/Paris'
            }
          },
          scanMode: testData.scanMode.list[1],
          group: null,
          syncWithGroup: false,
          maxReadInterval: 3600,
          readDelay: 0,
          overlap: 0,
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

    beforeEach(() => {
      south = new SouthPostgreSQL(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
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
      utilsExports.formatInstant = mock.fn(() => '2020-02-01 00:00:00.000');
      utilsExports.convertDateTimeToInstant = mock.fn((instant: unknown) => instant);

      const result = await south.historyQuery(configuration.items, startTime, testData.constants.dates.FAKE_NOW);
      assert.strictEqual((utilsExports.persistResults as ReturnType<typeof mock.fn>).mock.calls.length, 1);
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
      assert.ok(
        logger.info.mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            (c.arguments[0] as string).includes('Found 2 results') && (c.arguments[0] as string).includes(configuration.items[0].name)
        )
      );
    });

    it('should properly run historyQuery without result', async () => {
      const startTime = testData.constants.dates.DATE_1;
      const queryDataMock = mock.method(
        south,
        'queryData',
        mock.fn(async () => [])
      );

      const result = await south.historyQuery(configuration.items, startTime, testData.constants.dates.FAKE_NOW);
      assert.strictEqual((utilsExports.persistResults as ReturnType<typeof mock.fn>).mock.calls.length, 0);
      assert.strictEqual(queryDataMock.mock.calls.length, 1);
      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [
        configuration.items[0],
        testData.constants.dates.DATE_1,
        testData.constants.dates.FAKE_NOW
      ]);
      assert.deepStrictEqual(result, { trackedInstant: null, value: null });
      assert.ok(
        logger.debug.mock.calls.some(
          (c: { arguments: Array<unknown> }) =>
            (c.arguments[0] as string).includes('No result found') && (c.arguments[0] as string).includes(configuration.items[0].name)
        )
      );
    });

    it('should get data from PostgreSQL', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      const formattedStartTime = DateTime.fromISO(startTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS');
      const formattedEndTime = DateTime.fromISO(endTime).toFormat('yyyy-MM-dd HH:mm:ss.SSS');

      const replacementParams = { startTime: formattedStartTime, endTime: formattedEndTime };
      utilsExports.generateReplacementParameters = mock.fn(() => replacementParams);

      let formatCallCount = 0;
      utilsExports.formatInstant = mock.fn(() => {
        formatCallCount++;
        if (formatCallCount === 1) return formattedStartTime;
        if (formatCallCount === 2) return formattedEndTime;
        return startTime;
      });

      const result = await south.queryData(configuration.items[0], startTime, endTime);

      assert.strictEqual((utilsExports.logQuery as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual(
        (utilsExports.logQuery as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0],
        configuration.items[0].settings.query
      );

      assert.strictEqual((pgExports.Client as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual((pgExports.Client as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0], {
        host: configuration.settings.host,
        port: configuration.settings.port,
        user: configuration.settings.username,
        password: configuration.settings.password,
        database: configuration.settings.database,
        connectionTimeoutMillis: configuration.settings.connectionTimeout,
        query_timeout: configuration.settings.requestTimeout,
        ssl: true
      });

      assert.strictEqual(clientConnect.mock.calls.length, 1);

      assert.deepStrictEqual(clientQuery.mock.calls[0].arguments, [
        configuration.items[0].settings.query.replace(/@StartTime/g, '$1').replace(/@EndTime/g, '$2'),
        replacementParams
      ]);

      assert.strictEqual(clientEnd.mock.calls.length, 1);

      assert.deepStrictEqual((utilsExports.generateReplacementParameters as ReturnType<typeof mock.fn>).mock.calls[0].arguments, [
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

      assert.strictEqual((utilsExports.formatInstant as ReturnType<typeof mock.fn>).mock.calls.length, 0);
      assert.deepStrictEqual(
        (utilsExports.logQuery as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0],
        configuration.items[1].settings.query
      );

      assert.deepStrictEqual(result, [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
    });

    it('should manage query error', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      utilsExports.generateReplacementParameters = mock.fn(() => ({ startTime, endTime }));
      clientQuery.mock.resetCalls();
      clientQuery.mock.mockImplementationOnce(() => {
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
        mock.fn(async () => [
          { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
          { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
        ])
      );
      utilsExports.formatInstant = mock.fn(() => testData.constants.dates.DATE_1);
      utilsExports.convertDateTimeToInstant = mock.fn((instant: unknown) => instant);

      await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
      const { startTime, endTime } = testData.south.itemTestingSettings.history!;
      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[0], startTime, endTime]);
    });

    it('should test item without datetimeFields', async () => {
      const queryDataMock = mock.method(
        south,
        'queryData',
        mock.fn(async () => [
          { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
          { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
        ])
      );
      utilsExports.formatInstant = mock.fn(() => testData.constants.dates.DATE_1);
      utilsExports.convertDateTimeToInstant = mock.fn((instant: unknown) => instant);

      await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
      const { startTime, endTime } = testData.south.itemTestingSettings.history!;
      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[1], startTime, endTime]);
    });
  });

  describe('SouthPostgreSQL without authentication', () => {
    let south: SouthPostgreSQLClass;
    const configuration: SouthConnectorEntity<SouthPostgreSQLSettings, SouthPostgreSQLItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'postgresql',
      description: 'my test connector',
      enabled: true,
      settings: {
        host: 'localhost',
        port: 1521,
        database: 'db',
        sslMode: false,
        username: '',
        password: '',
        connectionTimeout: 1000,
        requestTimeout: 1000
      },
      groups: [],
      items: [
        {
          id: 'id1',
          name: 'item1',
          enabled: true,
          settings: {
            query: 'query1',
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthPostgreSQLItemSettingsDateTimeFields,
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
              outputTimestampFormat: 'yyyy-MM-dd',
              outputTimezone: 'Europe/Paris'
            }
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
        },
        {
          id: 'id2',
          name: 'item2',
          enabled: true,
          settings: {
            query: 'query2',
            dateTimeFields: null,
            serialization: {
              type: 'csv',
              filename: 'sql-@CurrentDate.csv',
              delimiter: 'COMMA',
              compression: true,
              outputTimestampFormat: 'yyyy-MM-dd',
              outputTimezone: 'Europe/Paris'
            }
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
        },
        {
          id: 'id3',
          name: 'item3',
          enabled: true,
          settings: {
            query: 'query3',
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthPostgreSQLItemSettingsDateTimeFields,
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
              outputTimestampFormat: 'yyyy-MM-dd HH:mm:ss',
              outputTimezone: 'Europe/Paris'
            }
          },
          scanMode: testData.scanMode.list[1],
          group: null,
          syncWithGroup: false,
          maxReadInterval: 3600,
          readDelay: 0,
          overlap: 0,
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

    beforeEach(() => {
      south = new SouthPostgreSQL(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    });

    it('should manage connection error', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      utilsExports.generateReplacementParameters = mock.fn(() => ({ startTime, endTime }));
      pgExports.Client = mock.fn(function () {
        throw new Error('connection error');
      });

      await assert.rejects(south.queryData(configuration.items[0], startTime, endTime), new Error('connection error'));
    });
  });

  describe('SouthPostgreSQL test connection', () => {
    let south: SouthPostgreSQLClass;
    const configuration: SouthConnectorEntity<SouthPostgreSQLSettings, SouthPostgreSQLItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'postgresql',
      description: 'my test connector',
      enabled: true,
      settings: {
        host: 'localhost',
        port: 5432,
        database: 'db',
        sslMode: false,
        username: 'username',
        password: 'password',
        connectionTimeout: 1000,
        requestTimeout: 1000
      },
      groups: [],
      items: [],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    beforeEach(() => {
      south = new SouthPostgreSQL(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    });

    it('Database is reachable and has tables', async () => {
      let queryCallCount = 0;
      clientQuery.mock.resetCalls();
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
      clientQuery.mock.resetCalls();
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
        clientConnect.mock.resetCalls();
        clientEnd.mock.resetCalls();
        pgExports.Client = mock.fn(function () {
          throw new PGError(errorMessage);
        });
        await assert.rejects(south.testConnection(), new Error(`${ERROR_MESSAGES[errorMessage]} ${errorMessage}`));
      }
    });

    it('System table unreachable', async () => {
      const errorMessage = 'information_schema.TABLES does not exist';
      clientQuery.mock.resetCalls();
      clientQuery.mock.mockImplementationOnce(async () => {
        throw new Error(errorMessage);
      });

      await assert.rejects(
        south.testConnection(),
        new Error(`Unable to read tables in database "${configuration.settings.database}". ${errorMessage}`)
      );
      assert.ok(clientEnd.mock.calls.length > 0);
    });

    it('Database has no tables', async () => {
      clientQuery.mock.resetCalls();
      clientQuery.mock.mockImplementation(async () => ({ rows: [{ table_count: 0 }] }));

      await assert.rejects(south.testConnection(), new Error(`Database "${configuration.settings.database}" has no tables`));
      assert.ok(clientEnd.mock.calls.length > 0);
    });

    it('Database does not return count of tables', async () => {
      clientQuery.mock.resetCalls();
      clientQuery.mock.mockImplementation(async () => ({ rows: [] }));

      await assert.rejects(south.testConnection(), new Error(`Database "${configuration.settings.database}" has no tables`));
      assert.ok(clientEnd.mock.calls.length > 0);
    });

    it('Unable to connect to database without password', async () => {
      for (const errorMessage of Object.keys(ERROR_MESSAGES) as Array<ErrorMessages>) {
        clientConnect.mock.resetCalls();
        clientEnd.mock.resetCalls();
        clientConnect.mock.mockImplementationOnce(async () => {
          throw new PGError(errorMessage);
        });
        await assert.rejects(south.testConnection(), new Error(`${ERROR_MESSAGES[errorMessage]} ${errorMessage}`));
      }
    });
  });
});
