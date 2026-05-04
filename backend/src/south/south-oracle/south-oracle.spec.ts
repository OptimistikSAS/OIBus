import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
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
  SouthOracleItemSettings,
  SouthOracleItemSettingsDateTimeFields,
  SouthOracleSettings
} from '../../../shared/model/south-settings.model';
import type SouthOracleClass from './south-oracle';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';

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

describe('SouthOracle', () => {
  let SouthOracle: typeof SouthOracleClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn(async (_southId: string, _data: OIBusContent, _queryTime: string, _items: SouthConnectorItemEntity<SouthItemSettings>[]) => undefined);
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
  let southCacheService: SouthCacheServiceMock;

  const ping = mock.fn();
  const close = mock.fn();
  const execute = mock.fn(async () => ({ rows: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }] }));
  const getConnection = mock.fn(async () => ({ ping, close, execute, callTimeout: 0 }));
  const initOracleClient = mock.fn();

  const oracledbExports: Record<string, unknown> = {
    __esModule: true,
    default: null,
    getConnection,
    initOracleClient,
    outFormat: 0,
    OUT_FORMAT_OBJECT: 4001,
    oracleClientVersion: undefined
  };
  oracledbExports.default = oracledbExports;

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
    mockModule(nodeRequire, 'oracledb', oracledbExports);
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
    SouthOracle = reloadModule<{ default: typeof SouthOracleClass }>(nodeRequire, './south-oracle').default;
  });

  beforeEach(() => {
    southCacheService = new SouthCacheServiceMock();
    ping.mock.resetCalls();
    close.mock.resetCalls();
    execute.mock.resetCalls();
    addContentCallback.mock.resetCalls();
    initOracleClient.mock.resetCalls();
    oracledbExports.getConnection = mock.fn(async () => ({ ping, close, execute, callTimeout: 0 }));
    oracledbExports.initOracleClient = initOracleClient;
    oracledbExports.oracleClientVersion = undefined;
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

  describe('SouthOracle with authentication', () => {
    let south: SouthOracleClass;
    const configuration: SouthConnectorEntity<SouthOracleSettings, SouthOracleItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'oracle',
      description: 'my test connector',
      enabled: true,
      settings: {
        thickMode: true,
        host: 'localhost',
        port: 1521,
        database: 'db',
        username: 'username',
        password: 'password',
        connectionTimeout: 1000
      },
      groups: [],
      items: [
        {
          id: 'id1',
          name: 'item1',
          enabled: true,
          settings: {
            query: 'query1',
            requestTimeout: 1000,
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthOracleItemSettingsDateTimeFields,
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
            requestTimeout: 1000,
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
            requestTimeout: 1000,
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthOracleItemSettingsDateTimeFields,
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
      south = new SouthOracle(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
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

    it('should get data from Oracle', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      const formattedStart = '2020-01-01 00:00:00.000';
      const formattedEnd = '2022-01-01 00:00:00.000';

      let formatCallCount = 0;
      utilsExports.formatInstant = mock.fn(() => {
        formatCallCount++;
        if (formatCallCount === 1) return formattedStart;
        if (formatCallCount === 2) return formattedEnd;
        return startTime;
      });

      const replacementParams = { startTime: formattedStart, endTime: formattedEnd };
      utilsExports.generateReplacementParameters = mock.fn(() => replacementParams);

      const mockExecute = mock.fn(async (_sql: string, _params: unknown) => ({
        rows: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]
      }));
      const mockClose = mock.fn();
      oracledbExports.getConnection = mock.fn(async () => ({ ping, close: mockClose, execute: mockExecute, callTimeout: 0 }));

      const result = await south.queryData(configuration.items[0], startTime, endTime);

      assert.strictEqual((utilsExports.formatInstant as ReturnType<typeof mock.fn>).mock.calls.length, 2);
      assert.strictEqual((utilsExports.logQuery as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual(
        (utilsExports.logQuery as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0],
        configuration.items[0].settings.query
      );

      assert.strictEqual((oracledbExports.getConnection as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual((oracledbExports.getConnection as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0], {
        user: configuration.settings.username,
        password: 'password',
        connectString: `${configuration.settings.host}:${configuration.settings.port}/${configuration.settings.database}?connect_timeout=${configuration.settings.connectionTimeout}ms`
      });

      assert.strictEqual((utilsExports.generateReplacementParameters as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual((utilsExports.generateReplacementParameters as ReturnType<typeof mock.fn>).mock.calls[0].arguments, [
        configuration.items[0].settings.query,
        formattedStart,
        formattedEnd
      ]);

      assert.strictEqual(mockExecute.mock.calls.length, 1);
      assert.deepStrictEqual(
        mockExecute.mock.calls[0].arguments[0],
        configuration.items[0].settings.query.replace(/@StartTime/g, ':date1').replace(/@EndTime/g, ':date2')
      );
      assert.deepStrictEqual(mockExecute.mock.calls[0].arguments[1], replacementParams);

      assert.strictEqual(mockClose.mock.calls.length, 1);
      assert.deepStrictEqual(result, [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
    });

    it('should get data from Oracle when rows is null', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      const mockExecute = mock.fn(async () => ({ rows: null }));
      const mockClose = mock.fn();
      oracledbExports.getConnection = mock.fn(async () => ({ ping, close: mockClose, execute: mockExecute, callTimeout: 0 }));

      const result = await south.queryData(configuration.items[0], startTime, endTime);
      assert.deepStrictEqual(result, []);
      assert.strictEqual(mockClose.mock.calls.length, 1);
    });

    it('should get data from Oracle without datetime reference', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      const mockExecute = mock.fn(async (_sql: string, _params: unknown) => ({
        rows: [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]
      }));
      const mockClose = mock.fn();
      oracledbExports.getConnection = mock.fn(async () => ({ ping, close: mockClose, execute: mockExecute, callTimeout: 0 }));

      const result = await south.queryData(configuration.items[1], startTime, endTime);

      assert.strictEqual((utilsExports.formatInstant as ReturnType<typeof mock.fn>).mock.calls.length, 0);
      assert.strictEqual((utilsExports.logQuery as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual(
        (utilsExports.logQuery as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0],
        configuration.items[1].settings.query
      );
      assert.deepStrictEqual(result, [{ timestamp: '2020-02-01T00:00:00.000Z' }, { timestamp: '2020-03-01T00:00:00.000Z' }]);
    });

    it('should manage query error', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      const replacementParams = { startTime, endTime };
      utilsExports.generateReplacementParameters = mock.fn(() => replacementParams);

      const mockExecute = mock.fn((_sql: string, _params: unknown) => {
        throw new Error('query error');
      });
      const mockClose = mock.fn();
      oracledbExports.getConnection = mock.fn(async () => ({ ping, close: mockClose, execute: mockExecute, callTimeout: 0 }));

      let error: unknown;
      try {
        await south.queryData(configuration.items[0], startTime, endTime);
      } catch (err) {
        error = err;
      }

      assert.strictEqual(mockExecute.mock.calls.length, 1);
      assert.deepStrictEqual(
        mockExecute.mock.calls[0].arguments[0],
        configuration.items[0].settings.query.replace(/@StartTime/g, ':date1').replace(/@EndTime/g, ':date2')
      );
      assert.deepStrictEqual(mockExecute.mock.calls[0].arguments[1], replacementParams);
      assert.deepStrictEqual(error, new Error('query error'));
      assert.strictEqual(mockClose.mock.calls.length, 1);
    });

    it('should test item', async () => {
      const formattedInstant = '2020-01-01T00:00:00.000Z';
      const queryDataMock = mock.method(
        south,
        'queryData',
        mock.fn(async () => [
          { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
          { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
        ])
      );
      utilsExports.formatInstant = mock.fn(() => formattedInstant);
      utilsExports.convertDateTimeToInstant = mock.fn((instant: unknown) => instant);

      await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
      const { startTime, endTime } = testData.south.itemTestingSettings.history!;
      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[0], startTime, endTime]);
    });

    it('should test item without datetimeFields', async () => {
      const formattedInstant = '2020-01-01T00:00:00.000Z';
      const queryDataMock = mock.method(
        south,
        'queryData',
        mock.fn(async () => [
          { timestamp: '2020-02-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 123 },
          { timestamp: '2020-03-01T00:00:00.000Z', anotherTimestamp: '2023-02-01T00:00:00.000Z', value: 456 }
        ])
      );
      utilsExports.formatInstant = mock.fn(() => formattedInstant);
      utilsExports.convertDateTimeToInstant = mock.fn((instant: unknown) => instant);

      await south.testItem(configuration.items[1], testData.south.itemTestingSettings);
      const { startTime, endTime } = testData.south.itemTestingSettings.history!;
      assert.deepStrictEqual(queryDataMock.mock.calls[0].arguments, [configuration.items[1], startTime, endTime]);
    });
  });

  describe('SouthOracle without authentication but with thick mode', () => {
    let south: SouthOracleClass;
    const configuration: SouthConnectorEntity<SouthOracleSettings, SouthOracleItemSettings> = {
      id: 'southId',
      name: 'south',
      type: 'oracle',
      description: 'my test connector',
      enabled: true,
      settings: {
        host: 'localhost',
        port: 1521,
        database: 'db',
        username: null,
        password: null,
        connectionTimeout: 0,
        thickMode: true,
        oracleClient: 'path'
      },
      groups: [],
      items: [
        {
          id: 'id1',
          name: 'item1',
          enabled: true,
          settings: {
            query: 'query1',
            requestTimeout: 1000,
            dateTimeFields: [
              {
                fieldName: 'anotherTimestamp',
                useAsReference: false,
                type: 'unix-epoch-ms',
                timezone: null,
                format: null,
                locale: null
              } as unknown as SouthOracleItemSettingsDateTimeFields,
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
            requestTimeout: 1000,
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
        }
      ],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    beforeEach(() => {
      south = new SouthOracle(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    });

    it('should call initOracleClient when thick mode is enabled and oracleClientVersion is not set', () => {
      assert.strictEqual((oracledbExports.initOracleClient as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual((oracledbExports.initOracleClient as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0], {
        libDir: path.resolve(configuration.settings.oracleClient!)
      });
    });

    it('should manage connection error', async () => {
      const startTime = '2020-01-01T00:00:00.000Z';
      const endTime = '2022-01-01T00:00:00.000Z';

      oracledbExports.getConnection = mock.fn(() => {
        throw new Error('connection error');
      });

      let error: unknown;
      try {
        await south.queryData(configuration.items[0], startTime, endTime);
      } catch (err) {
        error = err;
      }

      assert.strictEqual((oracledbExports.getConnection as ReturnType<typeof mock.fn>).mock.calls.length, 1);
      assert.deepStrictEqual((oracledbExports.getConnection as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0], {
        user: undefined,
        password: undefined,
        connectString: `${configuration.settings.host}:${configuration.settings.port}/${configuration.settings.database}`
      });
      assert.deepStrictEqual(error, new Error('connection error'));
    });
  });

  describe('SouthOracle test connection', () => {
    let south: SouthOracleClass;
    const configuration: SouthConnectorEntity<SouthOracleSettings, SouthOracleItemSettings> = {
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
        thickMode: false
      },
      groups: [],
      items: [],
      createdBy: '',
      updatedBy: '',
      createdAt: '',
      updatedAt: ''
    };

    beforeEach(() => {
      south = new SouthOracle(configuration, addContentCallback, southCacheRepository, logger, 'cacheFolder');
    });

    it('Database is reachable and has tables', async () => {
      let executeCallCount = 0;
      const mockExecute = mock.fn(async () => {
        executeCallCount++;
        if (executeCallCount === 1) return { rows: [{ TABLE_COUNT: 21 }] };
        return { rows: 0 };
      });
      const mockPing = mock.fn();
      const mockClose = mock.fn();
      oracledbExports.getConnection = mock.fn(async () => ({ ping: mockPing, close: mockClose, execute: mockExecute, callTimeout: 0 }));

      await south.testConnection();

      assert.ok(mockClose.mock.calls.length > 0);
    });

    it('Database is reachable but returns no tables', async () => {
      const mockExecute = mock.fn(async () => ({ rows: [{ TABLE_COUNT: 0 }] }));
      const mockPing = mock.fn();
      const mockClose = mock.fn();
      oracledbExports.getConnection = mock.fn(async () => ({ ping: mockPing, close: mockClose, execute: mockExecute, callTimeout: 0 }));

      await assert.rejects(south.testConnection(), new Error(`No tables in the "${configuration.settings.username}" schema`));
      assert.ok(mockClose.mock.calls.length > 0);
    });

    it('Unable to create connection', async () => {
      const errorMessage = 'Error creating connection';

      for (const code of Object.keys(ERROR_CODES) as Array<ErrorCodes>) {
        oracledbExports.getConnection = mock.fn(() => {
          throw new OracleDBError(errorMessage, code);
        });
        await assert.rejects(south.testConnection(), new Error(`${ERROR_CODES[code]} ${errorMessage}`));
      }
    });

    it('Unable to ping database', async () => {
      const errorMessage = 'Error pinging database';

      for (const code of Object.keys(ERROR_CODES) as Array<ErrorCodes>) {
        const mockClose = mock.fn();
        oracledbExports.getConnection = mock.fn(async () => ({
          ping: () => {
            throw new OracleDBError(errorMessage, code);
          },
          close: mockClose,
          callTimeout: 0
        }));
        await assert.rejects(south.testConnection(), new Error(`${ERROR_CODES[code]} ${errorMessage}`));
        assert.ok(mockClose.mock.calls.length > 0);
      }
    });

    it('System table unreachable', async () => {
      const errorMessage = 'ALL_TABLES does not exist';
      const mockExecute = mock.fn(() => {
        throw new Error(errorMessage);
      });
      const mockPing = mock.fn();
      const mockClose = mock.fn();
      oracledbExports.getConnection = mock.fn(async () => ({ ping: mockPing, close: mockClose, execute: mockExecute, callTimeout: 0 }));

      await assert.rejects(
        south.testConnection(),
        new Error(`Unable to read tables in database "${configuration.settings.database}": ${errorMessage}`)
      );
      assert.ok(mockClose.mock.calls.length > 0);
    });

    it('Database does not return count of tables', async () => {
      const mockExecute = mock.fn(async () => ({ rows: [] }));
      const mockPing = mock.fn();
      const mockClose = mock.fn();
      oracledbExports.getConnection = mock.fn(async () => ({ ping: mockPing, close: mockClose, execute: mockExecute, callTimeout: 0 }));

      await assert.rejects(south.testConnection(), new Error(`No tables in the "${configuration.settings.username}" schema`));
      assert.ok(mockClose.mock.calls.length > 0);
    });

    it('Unable to ping database without password', async () => {
      const savedUsername = configuration.settings.username;
      const savedPassword = configuration.settings.password;
      configuration.settings.username = '';
      configuration.settings.password = '';
      const errorMessage = 'Error pinging database';

      for (const code of Object.keys(ERROR_CODES) as Array<ErrorCodes>) {
        const mockClose = mock.fn();
        oracledbExports.getConnection = mock.fn(async () => ({
          ping: () => {
            throw new OracleDBError(errorMessage, code);
          },
          close: mockClose,
          callTimeout: 0
        }));
        await assert.rejects(south.testConnection(), new Error(`${ERROR_CODES[code]} ${errorMessage}`));
      }

      configuration.settings.username = savedUsername;
      configuration.settings.password = savedPassword;
    });
  });
});
