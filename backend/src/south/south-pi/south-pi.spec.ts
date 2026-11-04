import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { OIBusContent, OIBusRecordListContent } from '../../../shared/model/common/content.model';
import type { SouthItemSettings, SouthPIItemSettings, SouthPISettings } from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, type Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type * as PiLoaderType from './pi-loader';
import type { IPi, PiConnection, PiReadResult, PiServerInfo } from './pi-loader';
import type SouthPIClass from './south-pi';

const nodeRequire = createRequire(import.meta.url);

const INFO: PiServerInfo = { name: 'PISRV1', version: '3.4.445.688', uniqueId: 'b6f3a7c2' };

const buildItem = (
  id: string,
  settings: SouthPIItemSettings,
  scanMode = testData.scanMode.list[0]
): SouthConnectorItemEntity<SouthPIItemSettings> => ({
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

const pointItem = buildItem('id1', { type: 'point-id', piPoint: 'SINUSOID' });
const sameSourceItem = buildItem('id2', { type: 'point-id', piPoint: 'SINUSOID' });
const otherPointItem = buildItem('id3', { type: 'point-id', piPoint: 'CDT158' });
const queryItem = buildItem('id4', { type: 'point-query', piQuery: 'tag:=BA*' });
const missingSettingsItem = buildItem('id5', { type: 'point-id' });

const buildConfiguration = (settings: Partial<SouthPISettings> = {}): SouthConnectorEntity<SouthPISettings, SouthPIItemSettings> => ({
  id: 'southId',
  name: 'south',
  type: 'osisoft-pi',
  description: 'my test connector',
  enabled: true,
  settings: { serverName: null, retryInterval: 1000, ...settings },
  groups: [],
  items: [pointItem, sameSourceItem, otherPointItem, queryItem],
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
});
const configuration = buildConfiguration();

const START = '2026-01-01T00:00:00.000Z';
const END = '2026-01-01T01:00:00.000Z';

const emptyResult = (): PiReadResult => ({ points: [], notFound: [], queries: [] });

describe('SouthPI', () => {
  let SouthPI: typeof SouthPIClass;
  let south: SouthPIClass;
  let logger: PinoLogger;
  let addContentCallback: Mock<
    (southId: string, data: OIBusContent, queryTime: string, items: Array<SouthConnectorItemEntity<SouthItemSettings>>) => Promise<void>
  >;
  // Every connection opened through the mocked package, in order
  let connections: Array<Mocked<PiConnection>>;
  // The result of the reads of the connections opened next
  let nextRead: () => Promise<PiReadResult>;

  const createConnection = () => {
    const connection = createMock<PiConnection>({
      info: INFO,
      recordedValues: async () => nextRead(),
      disconnect: async () => undefined
    });
    connections.push(connection);
    return connection;
  };
  const createPiMocks = () => ({
    PiConnection: {
      connect: mock.fn(async (_options?: { serverName?: string; connectionTimeout?: number }) => createConnection())
    }
  });
  const piExports = createPiMocks();
  const createLoaderMocks = () => ({
    ...nodeRequire('./pi-loader'),
    loadPi: mock.fn((): IPi | null => piExports)
  });
  const loaderExports: typeof PiLoaderType = createLoaderMocks();
  const latestConnection = () => connections.at(-1)!;

  before(() => {
    mockModule(nodeRequire, './pi-loader', loaderExports);
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthPI = reloadModule<{ default: typeof SouthPIClass }>(nodeRequire, './south-pi').default;
  });

  const createSouth = (southConfiguration = configuration) =>
    new SouthPI(southConfiguration, addContentCallback, createMock<SouthCacheRepository>(), 'cacheFolder');

  beforeEach(() => {
    logger = new PinoLogger();
    connections = [];
    nextRead = async () => emptyResult();
    addContentCallback = mock.fn(async () => undefined);
    Object.assign(piExports, createPiMocks());
    Object.assign(loaderExports, createLoaderMocks());
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = createSouth();
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  describe('connection', () => {
    it('should connect to the default PI Data Archive, and disconnect', async () => {
      const connected = mock.fn();
      south.connectedEvent.on('connected', connected);

      await south.connect();

      assert.deepStrictEqual(piExports.PiConnection.connect.mock.calls[0].arguments, [{ serverName: undefined }]);
      assert.ok(logger.debug.mock.calls.some(c => c.arguments[0] === 'Connecting to the default PI Data Archive'));
      assert.ok(logger.info.mock.calls.some(c => c.arguments[0].includes('Connected to the PI Data Archive PISRV1 (version 3.4.445.688)')));
      assert.strictEqual(connected.mock.calls.length, 1);

      await south.disconnect();
      assert.strictEqual(latestConnection().disconnect.mock.calls.length, 1);
      assert.ok(logger.info.mock.calls.some(c => c.arguments[0].includes('Disconnected from the PI Data Archive')));
    });

    it('should connect to the named PI Data Archive', async () => {
      south = createSouth(buildConfiguration({ serverName: ' PISRV2 ' }));
      await south.connect();
      assert.deepStrictEqual(piExports.PiConnection.connect.mock.calls[0].arguments, [{ serverName: 'PISRV2' }]);
      assert.ok(logger.debug.mock.calls.some(c => c.arguments[0] === 'Connecting to the PI Data Archive "PISRV2"'));
    });

    it('should not show an empty version in the connection log', async () => {
      piExports.PiConnection.connect.mock.mockImplementation(async () => {
        const connection = createConnection();
        Object.assign(connection, { info: { ...INFO, version: '' } });
        return connection;
      });
      await south.connect();
      assert.ok(logger.info.mock.calls.some(c => /Connected to the PI Data Archive PISRV1 in \d+ ms/.test(c.arguments[0])));
    });

    it('should reconnect after the retry interval when the connection fails', async () => {
      piExports.PiConnection.connect.mock.mockImplementation(async () => {
        throw new Error('[-10722] PINET: Timeout on PI RPC or System Call');
      });

      await south.connect();
      assert.strictEqual(piExports.PiConnection.connect.mock.calls.length, 1);
      assert.ok(
        logger.error.mock.calls.some(
          c =>
            c.arguments[0].includes('Error while connecting to the PI Data Archive. Reconnecting in 1000 ms.') &&
            c.arguments[0].includes('[-10722] PINET')
        )
      );

      mock.timers.tick(configuration.settings.retryInterval);
      await new Promise(resolve => setImmediate(resolve));
      assert.strictEqual(piExports.PiConnection.connect.mock.calls.length, 2);
    });

    it('should fail to connect when the PI library is not available', async () => {
      loaderExports.loadPi = mock.fn(() => null);

      await south.connect();

      assert.strictEqual(piExports.PiConnection.connect.mock.calls.length, 0);
      assert.ok(
        logger.error.mock.calls.some(c => c.arguments[0].includes('PI library not available: the PI south connector only runs on Windows'))
      );
      await south.disconnect();
    });

    it('should not reconnect when disconnecting', async () => {
      piExports.PiConnection.connect.mock.mockImplementation(async () => {
        throw new Error('connection failed');
      });
      south['disconnecting'] = true;
      const disconnect = mock.method(south, 'disconnect', async () => undefined);

      await south.connect();

      assert.strictEqual(disconnect.mock.calls.length, 0);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(piExports.PiConnection.connect.mock.calls.length, 1);
    });

    it('should not schedule a second reconnection when one is pending', async () => {
      piExports.PiConnection.connect.mock.mockImplementation(async () => {
        throw new Error('connection failed');
      });
      await south.connect();
      south['reconnectTimeout'] = setTimeout(() => undefined, 5000);
      const disconnect = mock.method(south, 'disconnect');

      // connect() clears the pending reconnection first: only the guard of a reconnection set in the meantime is checked
      piExports.PiConnection.connect.mock.mockImplementation(async () => {
        south['reconnectTimeout'] = setTimeout(() => undefined, 5000);
        throw new Error('connection failed');
      });
      await south.connect();
      assert.strictEqual(disconnect.mock.calls.length, 0);
    });

    it('should log an error when disconnecting fails', async () => {
      await south.connect();
      latestConnection().disconnect.mock.mockImplementation(async () => {
        throw new Error('helper gone');
      });

      await south.disconnect();

      assert.ok(logger.error.mock.calls.some(c => c.arguments[0] === 'Error while disconnecting from the PI Data Archive: helper gone'));
      assert.strictEqual(south['connection'], null);
    });

    it('should clear a pending reconnection when disconnecting', async () => {
      piExports.PiConnection.connect.mock.mockImplementation(async () => {
        throw new Error('connection failed');
      });
      await south.connect();
      assert.notStrictEqual(south['reconnectTimeout'], null);

      await south.disconnect();

      assert.strictEqual(south['reconnectTimeout'], null);
      mock.timers.tick(configuration.settings.retryInterval);
      assert.strictEqual(piExports.PiConnection.connect.mock.calls.length, 1);
    });
  });

  describe('testConnection', () => {
    it('should connect with a throwaway connection and return the server and its version', async () => {
      const result = await south.testConnection();

      assert.deepStrictEqual(result, {
        items: [
          { key: 'Server', value: 'PISRV1' },
          { key: 'Version', value: '3.4.445.688' }
        ]
      });
      assert.strictEqual(latestConnection().disconnect.mock.calls.length, 1);
      assert.strictEqual(south['connection'], null, 'the connector itself stays disconnected');
    });

    it('should leave out an empty version', async () => {
      piExports.PiConnection.connect.mock.mockImplementation(async () => {
        const connection = createConnection();
        Object.assign(connection, { info: { ...INFO, version: '' } });
        return connection;
      });
      assert.deepStrictEqual(await south.testConnection(), { items: [{ key: 'Server', value: 'PISRV1' }] });
    });

    it('should reject when the connection fails', async () => {
      piExports.PiConnection.connect.mock.mockImplementation(async () => {
        throw new Error('PI Data Archive "OTHER" is not in the known servers table of PI AF Client');
      });
      await assert.rejects(south.testConnection(), {
        message: 'PI Data Archive "OTHER" is not in the known servers table of PI AF Client'
      });
    });
  });

  describe('testItem', () => {
    const testingSettings = { history: { startTime: START, endTime: END } };

    it('should read the item with a throwaway connection and return its records', async () => {
      nextRead = async () => ({
        ...emptyResult(),
        points: [{ name: 'SINUSOID', point: 'SINUSOID', values: [{ timestamp: START, value: 1.5, good: true }] }]
      });

      const result = await south.testItem(pointItem, testingSettings);

      assert.deepStrictEqual(result.result, { type: 'record-list', content: [{ pointId: 'item1', timestamp: START, value: 1.5 }] });
      assert.strictEqual(typeof result.connectionDuration, 'number');
      assert.strictEqual(typeof result.queryDuration, 'number');
      assert.deepStrictEqual(latestConnection().recordedValues.mock.calls[0].arguments, [
        START,
        END,
        { points: ['SINUSOID'], queries: [] }
      ]);
      assert.strictEqual(latestConnection().disconnect.mock.calls.length, 1);
      assert.strictEqual(addContentCallback.mock.calls.length, 0);
    });

    it('should disconnect the throwaway connection when the read fails, and log a failing disconnection', async () => {
      nextRead = async () => {
        throw new Error('Read timed out after 1000 ms');
      };
      const connection = createConnection();
      connection.disconnect.mock.mockImplementation(async () => {
        throw new Error('helper gone');
      });
      piExports.PiConnection.connect.mock.mockImplementation(async () => connection);

      await assert.rejects(south.testItem(queryItem, testingSettings), { message: 'Read timed out after 1000 ms' });

      assert.strictEqual(connection.disconnect.mock.calls.length, 1);
      assert.ok(logger.error.mock.calls.some(c => c.arguments[0] === 'Error while disconnecting the test connection: helper gone'));
    });
  });

  describe('historyQuery', () => {
    beforeEach(async () => {
      await south.connect();
    });

    it('should fail when not connected', async () => {
      await south.disconnect();
      await assert.rejects(south.historyQuery([pointItem], START, END), { message: 'Not connected to the PI Data Archive' });
    });

    it('should read the point and query items in one call, and send their records', async () => {
      nextRead = async () => ({
        points: [
          {
            name: 'SINUSOID',
            point: 'SINUSOID',
            values: [
              { timestamp: '2026-01-01T00:10:00.000Z', value: 1.5, good: true },
              { timestamp: '2026-01-01T00:20:00.000Z', value: 'I/O Timeout', good: false }
            ]
          },
          { name: 'CDT158', point: 'CDT158', values: [{ timestamp: '2026-01-01T00:30:00.000Z', value: 12, good: true }] }
        ],
        notFound: [],
        queries: [
          {
            query: 'tag:=BA*',
            points: [{ point: 'BA:ACTIVE.1', values: [{ timestamp: '2026-01-01T00:40:00.000Z', value: 'Active', good: true }] }]
          }
        ]
      });

      const result = await south.historyQuery([pointItem, sameSourceItem, otherPointItem, queryItem, missingSettingsItem], START, END);

      assert.deepStrictEqual(latestConnection().recordedValues.mock.calls[0].arguments, [
        START,
        END,
        { points: ['SINUSOID', 'CDT158'], queries: ['tag:=BA*'] }
      ]);
      const records = [
        { pointId: 'item1', timestamp: '2026-01-01T00:10:00.000Z', value: 1.5 },
        { pointId: 'item1', timestamp: '2026-01-01T00:20:00.000Z', value: 'I/O Timeout' },
        { pointId: 'item2', timestamp: '2026-01-01T00:10:00.000Z', value: 1.5 },
        { pointId: 'item2', timestamp: '2026-01-01T00:20:00.000Z', value: 'I/O Timeout' },
        { pointId: 'item3', timestamp: '2026-01-01T00:30:00.000Z', value: 12 },
        { pointId: 'BA:ACTIVE.1', timestamp: '2026-01-01T00:40:00.000Z', value: 'Active' }
      ];
      assert.strictEqual(addContentCallback.mock.calls.length, 1);
      const [southId, content, queryTime] = addContentCallback.mock.calls[0].arguments;
      assert.strictEqual(southId, 'southId');
      assert.deepStrictEqual((content as OIBusRecordListContent).content, records);
      assert.strictEqual(queryTime, testData.constants.dates.FAKE_NOW);
      assert.deepStrictEqual(result, { trackedInstant: '2026-01-01T00:40:00.001Z', value: records.at(-1) });
      assert.strictEqual(logger.warn.mock.calls.length, 0);
    });

    it('should log the points not found and the failed reads, and keep the other values', async () => {
      nextRead = async () => ({
        points: [],
        notFound: ['SINUSOID', 'CDT158'],
        pointsError: '[-11091] Event Not Found',
        queries: [
          { query: 'tag:=BA*', points: [], error: '[-12010] Bad query' },
          { query: 'tag:=OTHER*', points: [{ point: 'OTHER', values: [{ timestamp: START, value: null, good: false }] }] }
        ]
      });
      const otherQueryItem = buildItem('id6', { type: 'point-query', piQuery: 'tag:=OTHER*' });

      const result = await south.historyQuery([pointItem, otherPointItem, queryItem, otherQueryItem], START, END);

      const warnings = logger.warn.mock.calls.map(c => c.arguments[1]);
      assert.deepStrictEqual(warnings, [
        'PI points not found: SINUSOID, CDT158',
        'Error with the query of 2 items. [-11091] Event Not Found',
        'Error with the query of item item4. [-12010] Bad query'
      ]);
      // The next query starts just after the last value, even one at the start of the time range
      assert.deepStrictEqual(result, {
        trackedInstant: '2026-01-01T00:00:00.001Z',
        value: { pointId: 'OTHER', timestamp: START, value: '' }
      });
    });

    it('should send nothing when no value is found', async () => {
      const result = await south.historyQuery([pointItem], START, END);

      assert.strictEqual(addContentCallback.mock.calls.length, 0);
      assert.deepStrictEqual(result, { trackedInstant: null, value: null });
      assert.ok(logger.debug.mock.calls.some(c => String(c.arguments[1]).startsWith('No result found')));
    });

    it('should send a boolean value as a string', async () => {
      nextRead = async () => ({
        ...emptyResult(),
        points: [{ name: 'SINUSOID', point: 'SINUSOID', values: [{ timestamp: END, value: true, good: true }] }]
      });

      const result = await south.historyQuery([pointItem], START, END);

      assert.deepStrictEqual(result.value, { pointId: 'item1', timestamp: END, value: 'true' });
    });

    it('should reject when the whole read fails', async () => {
      nextRead = async () => {
        throw new Error('[-10734] PINET: Broken Connection');
      };
      await assert.rejects(south.historyQuery([pointItem], START, END), { message: '[-10734] PINET: Broken Connection' });
      assert.strictEqual(addContentCallback.mock.calls.length, 0);
    });
  });
});
