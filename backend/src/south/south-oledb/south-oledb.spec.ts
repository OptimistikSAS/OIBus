import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { OIBusContent, OIBusRecordListContent } from '../../../shared/model/common/content.model';
import type { SouthItemSettings, SouthOLEDBItemSettings, SouthOLEDBSettings } from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, type Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type * as OleDbLoaderType from './oledb-loader';
import type { IOleDb, OleDbColumn, OleDbConnection, OleDbConnectionInfo, OleDbQueryResult } from './oledb-loader';
import type SouthOLEDBClass from './south-oledb';

const nodeRequire = createRequire(import.meta.url);

const INFO: OleDbConnectionInfo = { provider: 'MSOLEDBSQL.1', dataSource: 'localhost', database: 'oibus', serverVersion: '16.00.1000' };

const trackingInstant: SouthOLEDBItemSettings['trackingInstant'] = {
  trackInstant: true,
  fieldName: 'timestamp',
  dateTimeInput: { type: 'string', timezone: 'Europe/Paris', format: 'yyyy-MM-dd HH:mm:ss.SSS', locale: 'en-US' }
};

const buildItem = (
  id: string,
  query: string,
  itemTrackingInstant: SouthOLEDBItemSettings['trackingInstant'],
  scanMode = testData.scanMode.list[0]
): SouthConnectorItemEntity<SouthOLEDBItemSettings> => ({
  id,
  name: id.replace('id', 'item'),
  description: null,
  enabled: true,
  settings: { query, trackingInstant: itemTrackingInstant },
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
  settings: Partial<SouthOLEDBSettings> = {}
): SouthConnectorEntity<SouthOLEDBSettings, SouthOLEDBItemSettings> => ({
  id: 'southId',
  name: 'south',
  type: 'oledb',
  description: 'my test connector',
  enabled: true,
  settings: {
    connectionString: 'Provider=MSOLEDBSQL;Data Source=localhost;Initial Catalog=oibus;User Id=oibus',
    password: 'encrypted-password',
    connectionTimeout: 1000,
    retryInterval: 1000,
    requestTimeout: 2000,
    maxParallelRun: 1,
    ...settings
  },
  groups: [],
  items: [
    buildItem('id1', 'SELECT * FROM logs WHERE timestamp > @StartTime AND timestamp <= @EndTime', trackingInstant),
    buildItem('id2', 'SELECT * FROM logs', null),
    buildItem('id3', 'SELECT * FROM logs', { trackInstant: false }, testData.scanMode.list[1])
  ],
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
});
const configuration = buildConfiguration();

const timestampColumn = (type: OleDbColumn['type']): OleDbColumn => ({ name: 'timestamp', type, dataTypeName: 'DBTYPE' });
const valueColumn: OleDbColumn = { name: 'value', type: 'number', dataTypeName: 'DBTYPE_R8' };
const queryResult = (timestampType: OleDbColumn['type'], timestamps: Array<string | number | boolean | null>): OleDbQueryResult => ({
  columns: [timestampColumn(timestampType), valueColumn],
  records: timestamps.map((timestamp, index) => ({ timestamp, value: index }))
});

describe('SouthOLEDB', () => {
  let SouthOLEDB: typeof SouthOLEDBClass;
  let south: SouthOLEDBClass;
  let logger: PinoLogger;
  let addContentCallback: Mock<
    (southId: string, data: OIBusContent, queryTime: string, items: Array<SouthConnectorItemEntity<SouthItemSettings>>) => Promise<void>
  >;
  // Every connection opened through the mocked package, in order
  let connections: Array<Mocked<OleDbConnection>>;
  // The result of the queries of the connections opened next
  let nextQuery: (sql: string) => Promise<OleDbQueryResult>;

  const createConnection = () => {
    const connection = createMock<OleDbConnection>({
      info: INFO,
      query: (sql: string) => nextQuery(sql),
      disconnect: async () => undefined
    });
    connections.push(connection);
    return connection;
  };
  const createOleDbMocks = () => ({
    OleDbConnection: {
      connect: mock.fn(async (_connectionString: string, _options?: { connectionTimeout?: number }) => createConnection())
    }
  });
  const oledbExports = createOleDbMocks();
  const createLoaderMocks = () => ({
    ...nodeRequire('./oledb-loader'),
    loadOleDb: mock.fn((): IOleDb | null => oledbExports)
  });
  const loaderExports: typeof OleDbLoaderType = createLoaderMocks();
  const latestConnection = () => connections.at(-1)!;

  before(() => {
    mockModule(nodeRequire, './oledb-loader', loaderExports);
    mockModule(nodeRequire, '../../service/encryption.service', {
      __esModule: true,
      encryptionService: new EncryptionServiceMock('', '')
    });
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthOLEDB = reloadModule<{ default: typeof SouthOLEDBClass }>(nodeRequire, './south-oledb').default;
  });

  const createSouth = (southConfiguration = configuration) =>
    new SouthOLEDB(southConfiguration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');

  beforeEach(() => {
    logger = new PinoLogger();
    connections = [];
    nextQuery = async () => ({ columns: [], records: [] });
    addContentCallback = mock.fn(async () => undefined);
    Object.assign(oledbExports, createOleDbMocks());
    Object.assign(loaderExports, createLoaderMocks());
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = createSouth();
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('connection', () => {
    it('should connect with the connection string, the password and the connection timeout, and disconnect', async () => {
      const connected = mock.fn();
      south.connectedEvent.on('connected', connected);

      await south.connect();

      assert.deepStrictEqual(oledbExports.OleDbConnection.connect.mock.calls[0].arguments, [
        'Provider=MSOLEDBSQL;Data Source=localhost;Initial Catalog=oibus;User Id=oibus;Password=encrypted-password;',
        { connectionTimeout: 1000 }
      ]);
      assert.ok(
        logger.debug.mock.calls.some(c =>
          c.arguments[0].includes('Provider=MSOLEDBSQL;Data Source=localhost;Initial Catalog=oibus;User Id=oibus;Password=<secret>;')
        )
      );
      assert.ok(
        logger.info.mock.calls.some(c =>
          c.arguments[0].includes('Connected to the OLE DB data source localhost/oibus (provider MSOLEDBSQL.1)')
        )
      );
      assert.strictEqual(connected.mock.calls.length, 1);

      await south.disconnect();
      assert.strictEqual(latestConnection().disconnect.mock.calls.length, 1);
      assert.ok(logger.info.mock.calls.some(c => c.arguments[0].includes('Disconnected from the OLE DB data source')));
    });

    it('should keep a connection string ending with a separator and without password as it is', async () => {
      south = createSouth(buildConfiguration({ connectionString: 'Provider=MSOLEDBSQL;Integrated Security=SSPI;  ', password: null }));
      await south.connect();
      assert.strictEqual(oledbExports.OleDbConnection.connect.mock.calls[0].arguments[0], 'Provider=MSOLEDBSQL;Integrated Security=SSPI;');

      south = createSouth(buildConfiguration({ connectionString: 'Provider=MSOLEDBSQL;', password: 'secret' }));
      await south.connect();
      assert.strictEqual(oledbExports.OleDbConnection.connect.mock.calls[1].arguments[0], 'Provider=MSOLEDBSQL;Password=secret;');
    });

    it('should not show an empty database in the connection log', async () => {
      oledbExports.OleDbConnection.connect.mock.mockImplementation(async () => {
        const connection = createConnection();
        Object.assign(connection, { info: { ...INFO, database: '' } });
        return connection;
      });
      await south.connect();
      assert.ok(
        logger.info.mock.calls.some(c => c.arguments[0].includes('Connected to the OLE DB data source localhost (provider MSOLEDBSQL.1)'))
      );
    });

    it('should reconnect after the retry interval when the connection fails', async () => {
      oledbExports.OleDbConnection.connect.mock.mockImplementation(async () => {
        throw new Error("The 'MSOLEDBSQL' provider is not registered on the local machine.");
      });

      await south.connect();
      assert.strictEqual(oledbExports.OleDbConnection.connect.mock.calls.length, 1);
      assert.ok(
        logger.error.mock.calls.some(
          c =>
            c.arguments[0].includes('Error while connecting to the OLE DB data source. Reconnecting in 1000 ms.') &&
            c.arguments[0].includes('provider is not registered')
        )
      );

      mock.timers.tick(configuration.settings.retryInterval);
      await new Promise(resolve => setImmediate(resolve));
      assert.strictEqual(oledbExports.OleDbConnection.connect.mock.calls.length, 2);
    });

    it('should fail to connect when the OLE DB library is not available', async () => {
      loaderExports.loadOleDb = mock.fn(() => null);

      await south.connect();

      assert.strictEqual(oledbExports.OleDbConnection.connect.mock.calls.length, 0);
      assert.ok(
        logger.error.mock.calls.some(c =>
          c.arguments[0].includes('OLE DB library not available: the OLEDB south connector only runs on Windows')
        )
      );
      await south.disconnect();
    });

    it('should not reconnect when disconnecting', async () => {
      oledbExports.OleDbConnection.connect.mock.mockImplementation(async () => {
        throw new Error('connection failed');
      });
      south['disconnecting'] = true;
      const disconnect = mock.method(south, 'disconnect', async () => undefined);

      await south.connect();

      assert.strictEqual(disconnect.mock.calls.length, 0);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(oledbExports.OleDbConnection.connect.mock.calls.length, 1);
    });

    it('should not reconnect a disabled connector', async () => {
      south = createSouth({ ...configuration, enabled: false });
      oledbExports.OleDbConnection.connect.mock.mockImplementation(async () => {
        throw new Error('connection failed');
      });

      await south.connect();
      mock.timers.tick(configuration.settings.retryInterval);

      assert.strictEqual(oledbExports.OleDbConnection.connect.mock.calls.length, 1);
    });

    it('should clear the reconnect timeout on disconnect', async () => {
      oledbExports.OleDbConnection.connect.mock.mockImplementation(async () => {
        throw new Error('connection failed');
      });
      await south.connect();

      await south.disconnect();
      mock.timers.tick(configuration.settings.retryInterval);

      assert.strictEqual(oledbExports.OleDbConnection.connect.mock.calls.length, 1);
      assert.strictEqual(south['reconnectTimeout'], null);
    });

    it('should log an error when the connection fails to close', async () => {
      await south.connect();
      latestConnection().disconnect.mock.mockImplementation(async () => {
        throw new Error('helper gone');
      });

      await south.disconnect();

      assert.ok(logger.error.mock.calls.some(c => c.arguments[0] === 'Error while disconnecting from the OLE DB data source: helper gone'));
      assert.ok(!logger.info.mock.calls.some(c => c.arguments[0].includes('Disconnected from the OLE DB data source')));
      assert.strictEqual(south['connections'].size, 0);
    });
  });

  describe('testConnection', () => {
    it('should return the connection info from a throwaway connection', async () => {
      const result = await south.testConnection();

      assert.deepStrictEqual(result, {
        items: [
          { key: 'Provider', value: 'MSOLEDBSQL.1' },
          { key: 'Data source', value: 'localhost' },
          { key: 'Database', value: 'oibus' },
          { key: 'Version', value: '16.00.1000' }
        ]
      });
      assert.strictEqual(latestConnection().disconnect.mock.calls.length, 1);
      assert.strictEqual(south['connections'].size, 0);
    });

    it('should leave out the info the provider does not give', async () => {
      oledbExports.OleDbConnection.connect.mock.mockImplementation(async () => {
        const connection = createConnection();
        Object.assign(connection, { info: { ...INFO, database: '', serverVersion: '' } });
        return connection;
      });

      assert.deepStrictEqual((await south.testConnection()).items, [
        { key: 'Provider', value: 'MSOLEDBSQL.1' },
        { key: 'Data source', value: 'localhost' }
      ]);
    });

    it('should throw when the connection fails', async () => {
      oledbExports.OleDbConnection.connect.mock.mockImplementation(async () => {
        throw new Error('Login failed for user oibus.');
      });
      await assert.rejects(south.testConnection(), new Error('Login failed for user oibus.'));
    });
  });

  describe('testItem', () => {
    it('should query with formatted dates on a throwaway connection and return record-list content', async () => {
      await south.connect();
      const liveConnection = latestConnection();
      nextQuery = async () => queryResult('datetime', ['2020-03-15 10:00:00.000']);

      const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

      const testConnection = latestConnection();
      assert.notStrictEqual(testConnection, liveConnection);
      assert.deepStrictEqual(testConnection.query.mock.calls[0].arguments, [
        'SELECT * FROM logs WHERE timestamp > 2020-03-15 01:00:00.000 AND timestamp <= 2020-03-20 01:00:00.000',
        { timeout: 2000 }
      ]);
      assert.deepStrictEqual(result, {
        result: { type: 'record-list', content: [{ timestamp: '2020-03-15 10:00:00.000', value: 0 }] },
        connectionDuration: 0,
        queryDuration: 0
      });
      assert.strictEqual(testConnection.disconnect.mock.calls.length, 1);
      assert.strictEqual(liveConnection.query.mock.calls.length, 0);
      assert.deepStrictEqual(south['idleConnections'], [liveConnection]);
    });

    it('should close the throwaway connection when the query fails', async () => {
      nextQuery = async () => {
        throw new Error("Invalid object name 'logs'.");
      };
      await assert.rejects(
        south.testItem(configuration.items[1], testData.south.itemTestingSettings),
        new Error("Invalid object name 'logs'.")
      );
      assert.strictEqual(latestConnection().disconnect.mock.calls.length, 1);
    });

    it('should log an error when the throwaway connection fails to close', async () => {
      oledbExports.OleDbConnection.connect.mock.mockImplementation(async () => {
        const connection = createConnection();
        connection.disconnect.mock.mockImplementation(async () => {
          throw new Error('helper gone');
        });
        return connection;
      });

      await south.testItem(configuration.items[1], testData.south.itemTestingSettings);

      assert.ok(logger.error.mock.calls.some(c => c.arguments[0] === 'Error while disconnecting the test connection: helper gone'));
    });
  });

  describe('historyQuery', () => {
    const startTime = testData.constants.dates.DATE_1;
    const endTime = testData.constants.dates.DATE_2;

    it('should query on the connection of connect() and send the records', async () => {
      await south.connect();
      nextQuery = async () => queryResult('datetime', ['2020-03-15T10:00:00.000', '2020-03-16 10:00:00.000']);

      const result = await south.historyQuery([configuration.items[0]], startTime, endTime);

      assert.strictEqual(connections.length, 1);
      assert.deepStrictEqual(latestConnection().query.mock.calls[0].arguments, [
        'SELECT * FROM logs WHERE timestamp > 2020-03-15 01:00:00.000 AND timestamp <= 2020-03-20 01:00:00.000',
        { timeout: 2000 }
      ]);
      // Sent as the provider returned them: formatting them is the job of the transformers
      const content = [
        { timestamp: '2020-03-15T10:00:00.000', value: 0 },
        { timestamp: '2020-03-16 10:00:00.000', value: 1 }
      ];
      assert.deepStrictEqual(addContentCallback.mock.calls[0].arguments.slice(0, 4), [
        configuration.id,
        { type: 'record-list', content },
        testData.constants.dates.FAKE_NOW,
        [configuration.items[0]]
      ]);
      assert.deepStrictEqual(result, { trackedInstant: '2020-03-16T09:00:00.000Z', value: content[1] });
      assert.deepStrictEqual(south['idleConnections'], [latestConnection()], 'the connection is back in the pool');
    });

    it('should leave the records and the query as they are without tracking instant', async () => {
      await south.connect();
      nextQuery = async () => queryResult('datetime', ['2020-03-15 10:00:00.000']);

      const result = await south.historyQuery([configuration.items[1]], startTime, endTime);

      assert.strictEqual(latestConnection().query.mock.calls[0].arguments[0], 'SELECT * FROM logs');
      assert.deepStrictEqual(result, { trackedInstant: null, value: { timestamp: '2020-03-15 10:00:00.000', value: 0 } });
    });

    it('should send nothing when the query finds no result', async () => {
      await south.connect();

      const result = await south.historyQuery([configuration.items[2]], startTime, endTime);

      assert.strictEqual(addContentCallback.mock.calls.length, 0);
      assert.deepStrictEqual(result, { trackedInstant: null, value: null });
    });

    it('should close the connection of a failed query and open a new one on the next run', async () => {
      const connected = mock.fn();
      await south.connect();
      south.connectedEvent.on('connected', connected);
      const failedConnection = latestConnection();
      nextQuery = async () => {
        throw new Error('Query timed out after 2000 ms');
      };

      await assert.rejects(south.historyQuery([configuration.items[1]], startTime, endTime), new Error('Query timed out after 2000 ms'));
      assert.strictEqual(failedConnection.disconnect.mock.calls.length, 1);
      assert.strictEqual(south['connections'].size, 0);

      nextQuery = async () => ({ columns: [], records: [] });
      await south.historyQuery([configuration.items[1]], startTime, endTime);
      assert.strictEqual(connections.length, 2);
      assert.strictEqual(latestConnection().query.mock.calls.length, 1);
      assert.strictEqual(connected.mock.calls.length, 0, 'no new connection is signaled to the engine');
    });

    it('should open its connection when connect() could not', async () => {
      oledbExports.OleDbConnection.connect.mock.mockImplementationOnce(async () => {
        throw new Error('network error');
      });
      await south.connect();

      await south.historyQuery([configuration.items[1]], startTime, endTime);
      assert.strictEqual(connections.length, 1);

      // The pending reconnection reuses it
      mock.timers.tick(configuration.settings.retryInterval);
      await new Promise(resolve => setImmediate(resolve));
      assert.strictEqual(connections.length, 1);
      await south.disconnect();
    });

    it('should run parallel queries on their own connections and reuse them', async () => {
      south = createSouth(buildConfiguration({ maxParallelRun: 2 }));
      await south.connect();
      const resolvers: Array<() => void> = [];
      nextQuery = () =>
        new Promise(resolve => {
          resolvers.push(() => resolve({ columns: [], records: [] }));
        });

      const first = south.historyQuery([configuration.items[1]], startTime, endTime);
      const second = south.historyQuery([configuration.items[2]], startTime, endTime);
      await new Promise(resolve => setImmediate(resolve));

      assert.strictEqual(connections.length, 2, 'a second connection is opened for the second query');
      assert.strictEqual(connections[0].query.mock.calls.length, 1);
      assert.strictEqual(connections[1].query.mock.calls.length, 1);
      resolvers.forEach(resolve => resolve());
      await Promise.all([first, second]);
      assert.strictEqual(south['idleConnections'].length, 2);

      nextQuery = async () => ({ columns: [], records: [] });
      await south.historyQuery([configuration.items[1]], startTime, endTime);
      assert.strictEqual(connections.length, 2, 'an idle connection is reused');

      await south.disconnect();
      assert.ok(connections.every(connection => connection.disconnect.mock.calls.length === 1));
    });

    it('should close a connection still running a query on disconnect, and not give it back to the pool', async () => {
      await south.connect();
      let resolveQuery: () => void = () => undefined;
      nextQuery = () =>
        new Promise(resolve => {
          resolveQuery = () => resolve({ columns: [], records: [] });
        });
      const running = south.historyQuery([configuration.items[1]], startTime, endTime);
      await new Promise(resolve => setImmediate(resolve));

      await south.disconnect();
      resolveQuery();
      await running;

      assert.strictEqual(latestConnection().disconnect.mock.calls.length, 1);
      assert.deepStrictEqual(south['idleConnections'], []);
    });
  });

  describe('tracking instant', () => {
    const startTime = testData.constants.dates.DATE_1;
    const endTime = testData.constants.dates.DATE_2;
    const runWith = async (
      dateTimeInput: NonNullable<SouthOLEDBItemSettings['trackingInstant']>['dateTimeInput'],
      result: OleDbQueryResult
    ) => {
      const item = buildItem('id', 'SELECT * FROM logs', { trackInstant: true, fieldName: 'timestamp', dateTimeInput });
      await south.connect();
      nextQuery = async () => result;
      return south.historyQuery([item], startTime, endTime);
    };
    const sentContent = () => (addContentCallback.mock.calls[0].arguments[1] as OIBusRecordListContent).content;

    it('should read a date time column without offset in the timezone of the item, ignoring its format', async () => {
      const query = queryResult('datetime', ['2020-03-15T10:00:00.000', '2020-03-14T10:00:00.000']);
      const result = await runWith({ type: 'string', timezone: 'Europe/Paris', format: 'dd/MM/yyyy', locale: 'en-US' }, query);
      assert.deepStrictEqual(sentContent(), [
        { timestamp: '2020-03-15T10:00:00.000', value: 0 },
        { timestamp: '2020-03-14T10:00:00.000', value: 1 }
      ]);
      assert.strictEqual(result.trackedInstant, '2020-03-15T09:00:00.000Z');
    });

    it('should read a date time column without offset in UTC when the item has no timezone', async () => {
      const result = await runWith({ type: 'iso-string' }, queryResult('datetime', ['2020-03-15T10:00:00.000']));
      assert.strictEqual(result.trackedInstant, '2020-03-15T10:00:00.000Z');
    });

    it('should read a date time column with offset as it is', async () => {
      const result = await runWith(
        { type: 'string', timezone: 'Asia/Tokyo', format: 'yyyy', locale: 'en-US' },
        queryResult('datetimeoffset', ['2020-03-15T10:00:00.000+01:00'])
      );
      assert.strictEqual(result.trackedInstant, '2020-03-15T09:00:00.000Z');
    });

    it('should convert the other columns according to the date time input of the item', async () => {
      const result = await runWith({ type: 'unix-epoch-ms' }, queryResult('number', [1584266400000, null, '']));
      assert.deepStrictEqual(sentContent(), [
        { timestamp: 1584266400000, value: 0 },
        { timestamp: null, value: 1 },
        { timestamp: '', value: 2 }
      ]);
      assert.strictEqual(result.trackedInstant, '2020-03-15T10:00:00.000Z');
    });

    it('should not track a value that cannot be converted, keep it in the records and warn once', async () => {
      const result = await runWith(
        { type: 'iso-string' },
        {
          columns: [timestampColumn('datetime'), valueColumn],
          records: [
            { timestamp: 'not a date', value: 0 },
            { timestamp: true, value: 1 },
            { timestamp: '2020-03-15T10:00:00.000', value: 2 }
          ]
        }
      );
      assert.deepStrictEqual(
        sentContent().map(record => record.timestamp),
        ['not a date', true, '2020-03-15T10:00:00.000']
      );
      assert.strictEqual(result.trackedInstant, '2020-03-15T10:00:00.000Z');
      assert.strictEqual(logger.warn.mock.calls.length, 1);
      assert.ok(
        logger.warn.mock.calls[0].arguments[1].includes(
          'Could not convert the values of the tracking field "timestamp": Invalid date time "not a date"'
        )
      );
    });

    it('should not track anything when the tracking field is missing', async () => {
      const result = await runWith({ type: 'iso-string' }, { columns: [valueColumn], records: [{ value: 1 }] });
      assert.deepStrictEqual(result, { trackedInstant: null, value: { value: 1 } });
    });
  });

  it('should run up to maxParallelRun queries in parallel, within a ceiling', () => {
    assert.strictEqual(createSouth(buildConfiguration({ maxParallelRun: 0 }))['getMaxParallelRun'](), 1);
    assert.strictEqual(createSouth(buildConfiguration({ maxParallelRun: 3 }))['getMaxParallelRun'](), 3);
    assert.strictEqual(createSouth(buildConfiguration({ maxParallelRun: 20 }))['getMaxParallelRun'](), 8);
  });
});
