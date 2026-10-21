import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, before, beforeEach, describe, it, type Mock, mock } from 'node:test';

import type { AdsDataType } from 'ads-client';

import type { OIBusTimeValue } from '../../../shared/model/common/content.model';
import type { SouthADSItemSettings, SouthADSSettings } from '../../../shared/model/connector/south-settings.model';

import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import testData from '../../tests/utils/test-data';
import { createMock, type Mocked, mockModule, reloadModule } from '../../tests/utils/test-utils';
import type SouthADSClass from './south-ads';

const nodeRequire = createRequire(import.meta.url);

const buildItem = (
  id: string,
  name: string,
  overrides: Partial<SouthConnectorItemEntity<SouthADSItemSettings>> = {}
): SouthConnectorItemEntity<SouthADSItemSettings> => ({
  id,
  name,
  enabled: true,
  settings: { address: name },
  scanMode: testData.scanMode.list[0],
  group: null,
  syncWithGroup: false,
  maxReadInterval: null,
  readDelay: null,
  startTimeOffset: null,
  endTimeOffset: null,
  recoveryStrategy: null,
  cachingStrategy: 'allValues',
  thresholdType: null,
  threshold: null,
  rangeLow: null,
  rangeHigh: null,
  maxCachingInterval: null,
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: '',
  ...overrides
});

const configuration: SouthConnectorEntity<SouthADSSettings, SouthADSItemSettings> = {
  id: 'southId',
  name: 'south',
  type: 'ads',
  description: 'my test connector',
  enabled: true,
  settings: {
    port: 851,
    netId: '10.211.55.3.1.1',
    clientAdsPort: 32750,
    routerTcpPort: 48898,
    clientAmsNetId: '10.211.55.2.1.1',
    routerAddress: '10.211.55.3',
    retryInterval: 10000,
    plcName: 'PLC_TEST.',
    boolAsText: 'integer',
    enumAsText: 'text',
    structureFiltering: [
      { name: 'ST_Example', fields: 'SomeReal,SomeDate' },
      { name: 'Tc2_Standard.TON', fields: '*' }
    ]
  },
  groups: [],
  items: [buildItem('id1', 'GVL_Test.TestINT1'), buildItem('id2', 'GVL_Test.TestINT2')],
  createdBy: '',
  updatedBy: '',
  createdAt: '',
  updatedAt: ''
};

const withSettings = (settings: Partial<SouthADSSettings>) => ({ ...configuration, settings: { ...configuration.settings, ...settings } });

const deviceInfoItems = (adsState: string) => ({
  items: [
    { key: 'Device name', value: 'TestDevice' },
    { key: 'Firmware version', value: '3.1.4000' },
    { key: 'ADS state', value: adsState },
    { key: 'Device state', value: '0' }
  ]
});

const intDataType = { type: 'INT', subItems: [], enumInfos: [] };
const symbol1 = { indexGroup: 0x4040, indexOffset: 0x0001, size: 2, type: 'INT' };
const symbol2 = { indexGroup: 0x4040, indexOffset: 0x0002, size: 2, type: 'INT' };
const rawSuccess = (...bytes: Array<number>) => ({ success: true, value: Buffer.from(bytes), errorCode: 0, errorStr: '' });

const timeValue = (pointId: string, value: string): OIBusTimeValue => ({
  pointId,
  timestamp: testData.constants.dates.FAKE_NOW,
  data: { value }
});

const lastValues = (...values: Array<[itemId: string, value: Array<string>, instant: string]>) =>
  new Map(
    values.map(([itemId, value, instant]) => [itemId, { itemId, groupId: null, queryTime: instant, value, trackedInstant: instant }])
  );

const logged = (logMock: Mock<(...args: Array<unknown>) => unknown>, predicate: (message: string) => boolean, argumentIndex = 0) =>
  logMock.mock.calls.some(c => typeof c.arguments[argumentIndex] === 'string' && predicate(c.arguments[argumentIndex] as string));

const createAdsClient = () => ({
  connection: { connected: true },
  connect: mock.fn(async () => ({ targetAmsNetId: 'targetAmsNetId', localAmsNetId: 'localAmsNetId', localAdsPort: 'localAdsPort' })),
  disconnect: mock.fn(async () => undefined),
  readValue: mock.fn(async (): Promise<unknown> => undefined),
  getSymbols: mock.fn(async (): Promise<Record<string, unknown>> => ({})),
  getDataType: mock.fn(async () => intDataType),
  readRawMulti: mock.fn(async (_commands: Array<unknown>): Promise<Array<unknown>> => []),
  convertFromRaw: mock.fn(async (_data: unknown, _dataType: unknown): Promise<unknown> => 0),
  readDeviceInfo: mock.fn(async () => ({ deviceName: 'TestDevice', majorVersion: 3, minorVersion: 1, versionBuild: 4000 })),
  readState: mock.fn(async () => ({ adsState: 5, adsStateStr: 'Run' as string | undefined, deviceState: 0 })),
  getSymbol: mock.fn(async (_address: string): Promise<unknown> => {
    throw new Error('getSymbol not implemented');
  })
});

describe('South ADS', () => {
  let SouthADS: typeof SouthADSClass;
  let south: SouthADSClass;
  let logger: PinoLogger;
  let southCacheRepository: Mocked<SouthCacheRepository>;
  let addContent: Mock<SouthADSClass['addContent']>;
  let adsClient: ReturnType<typeof createAdsClient>;

  // SUT does `new Client(...)`: a regular function is required
  const createAdsMocks = () => ({
    Client: mock.fn(function (_options: unknown) {
      return adsClient;
    })
  });
  const adsExports = { __esModule: true, ...createAdsMocks() };

  before(() => {
    mockModule(nodeRequire, 'ads-client', adsExports);
    mockModule(nodeRequire, '../../service/logger/logger.service', {
      loggerService: { createChildLogger: () => logger },
      default: class {}
    });

    SouthADS = reloadModule<{ default: typeof SouthADSClass }>(nodeRequire, './south-ads').default;
  });

  beforeEach(() => {
    logger = new PinoLogger();
    adsClient = createAdsClient();
    Object.assign(adsExports, createAdsMocks());
    southCacheRepository = createMock<SouthCacheRepository>({ getItemsLastValues: () => new Map() });
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthADS(
      configuration,
      mock.fn(async () => undefined),
      southCacheRepository,
      'cacheFolder'
    );
    addContent = mock.method(south, 'addContent', async () => undefined);
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  // Keeps the symbol cache empty: every item goes through the readAdsSymbol fallback path
  const skipSymbolCache = () => {
    south['buildSymbolCache'] = mock.fn(async () => undefined);
  };

  it('should properly connect to a remote instance', async () => {
    await south.start();
    await south.connect();
    assert.deepStrictEqual(adsExports.Client.mock.calls[0].arguments[0], {
      autoReconnect: false,
      localAdsPort: 32750,
      localAmsNetId: '10.211.55.2.1.1',
      routerAddress: '10.211.55.3',
      routerTcpPort: 48898,
      targetAdsPort: 851,
      targetAmsNetId: '10.211.55.3.1.1'
    });
  });

  it('should properly create connection options', async () => {
    south.connectorConfiguration = withSettings({ clientAmsNetId: null, clientAdsPort: null, routerAddress: null, routerTcpPort: null });
    const result = south.createConnectionOptions();
    assert.deepStrictEqual(result, {
      targetAmsNetId: configuration.settings.netId,
      targetAdsPort: configuration.settings.port,
      autoReconnect: false
    });
  });

  it('should retry to connect in case of failure', async () => {
    adsClient.connect.mock.mockImplementationOnce(() => {
      throw new Error('connection error');
    });
    mock.method(south, 'disconnectAdsClient', async () => undefined);

    await south.connect();
    assert.ok(logged(logger.error, message => message === 'ADS connect error: connection error'));

    // Timer is set for reconnect — disconnect should clear it
    await south.disconnect();
    // After disconnect, ticking should NOT trigger additional connect calls
    const connectCallsBefore = adsClient.connect.mock.calls.length;
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(adsClient.connect.mock.calls.length, connectCallsBefore);
  });

  it('should not retry to connect if disconnecting', async () => {
    adsClient.connect.mock.mockImplementationOnce(() => {
      throw new Error('connection error');
    });
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    south['disconnecting'] = true;

    await south.connect();
    assert.ok(logged(logger.error, message => message === 'ADS connect error: connection error'));
    assert.strictEqual(disconnect.mock.calls.length, 1);
    // No setTimeout should have been triggered — ticking should not cause additional connect calls
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(adsClient.connect.mock.calls.length, 1);
  });

  describe('parseValues', () => {
    const pointId = configuration.items[1].name;
    const parse = (dataType: string, value: unknown, subItems?: Array<AdsDataType>, enumInfo?: Array<{ name: string; value: number }>) =>
      south.parseValues(pointId, dataType, value, testData.constants.dates.FAKE_NOW, subItems, enumInfo);

    it('should parse BYTE value', () => {
      assert.deepStrictEqual(parse('BYTE', '123'), [timeValue(pointId, '123')]);
    });

    it('should parse BOOL value', () => {
      assert.deepStrictEqual(parse('BOOL', true), [timeValue(pointId, '1')]);
      assert.deepStrictEqual(parse('BOOL', false), [timeValue(pointId, '0')]);

      south.connectorConfiguration = withSettings({ boolAsText: 'text' });
      assert.deepStrictEqual(parse('BOOL', true), [timeValue(pointId, 'true')]);
    });

    it('should parse REAL value', () => {
      assert.deepStrictEqual(parse('REAL', '123.4'), [timeValue(pointId, '123.4')]);
    });

    it('should parse STRING value', () => {
      assert.deepStrictEqual(parse('STRING', 'string'), [timeValue(pointId, 'string')]);
      assert.deepStrictEqual(parse('STRING(35)', 'string'), [timeValue(pointId, 'string')]);
    });

    it('should parse DATE value', () => {
      assert.deepStrictEqual(parse('DATE', testData.constants.dates.FAKE_NOW), [timeValue(pointId, testData.constants.dates.FAKE_NOW)]);
    });

    it('should parse ARRAY [0..4] OF INT value', () => {
      assert.deepStrictEqual(parse('ARRAY [0..4] OF INT', [123, 456, 789]), [
        timeValue(`${pointId}.0`, '123'),
        timeValue(`${pointId}.1`, '456'),
        timeValue(`${pointId}.2`, '789')
      ]);
    });

    it('should parse ST_Example value', () => {
      const subItems = [
        {
          name: 'SomeText',
          type: 'STRING(50)',
          size: 51,
          offset: 0,
          adsDataType: 30,
          adsDataTypeStr: 'ADST_STRING',
          comment: '',
          attributes: [],
          rpcMethods: [],
          subItems: []
        },
        {
          name: 'SomeReal',
          type: 'REAL',
          size: 4,
          offset: 52,
          adsDataType: 4,
          adsDataTypeStr: 'ADST_REAL32',
          comment: '',
          attributes: [
            { name: 'DisplayMinValue', value: '-10000' },
            { name: 'DisplayMaxValue', value: '10000' }
          ],
          rpcMethods: [],
          subItems: []
        },
        {
          name: 'SomeDate',
          type: 'DATE_AND_TIME',
          size: 4,
          offset: 56,
          adsDataType: 19,
          adsDataTypeStr: 'ADST_UINT32',
          comment: '',
          attributes: [],
          rpcMethods: [],
          subItems: []
        }
      ] as unknown as Array<AdsDataType>;
      const value = { SomeText: 'Hello ads-client', SomeReal: 3.1415927410125732, SomeDate: '2020-04-13T12:25:33.000Z' };

      assert.deepStrictEqual(parse('ST_Example', value, subItems, []), [
        timeValue(`${pointId}.SomeReal`, '3.1415927410125732'),
        timeValue(`${pointId}.SomeDate`, '2020-04-13T12:25:33.000Z')
      ]);

      assert.deepStrictEqual(parse('Another_Struct', value, subItems, []), []);
      assert.ok(
        logged(
          logger.debug,
          message =>
            message ===
            `Data Structure Another_Struct not parsed for data ${pointId}. To parse it, please specify it in the connector settings`
        )
      );
    });

    it('should parse Enum value', () => {
      const enumInfo = [
        { name: 'Disabled', value: 0 },
        { name: 'Starting', value: 50 },
        { name: 'Running', value: 100 },
        { name: 'Stopping', value: 200 }
      ];

      assert.deepStrictEqual(parse('Enum', { name: 'Running', value: 100 }, [], enumInfo), [timeValue(pointId, 'Running')]);

      south.connectorConfiguration = withSettings({ enumAsText: 'integer' });
      assert.deepStrictEqual(parse('Enum', { name: 'Running', value: 100 }, [], enumInfo), [timeValue(pointId, '100')]);
    });

    it('should parse Bad Type value', () => {
      assert.deepStrictEqual(parse('BAD', 'value'), []);
      assert.ok(logged(logger.warn, message => message === `dataType BAD not supported yet for point ${pointId}. Value was "value"`));
    });
  });

  it('should query last point', async () => {
    skipSymbolCache();
    // Shaped like an actual OIBusTimeValue (rather than a bare `[1]`) since caching-strategy
    // filtering now reads `.data.value` off each produced value to compare against the cache.
    mock.method(south, 'readAdsSymbol', async () => [timeValue('p', '1')]);

    await south.directQuery(configuration.items);

    assert.strictEqual(addContent.mock.calls.length, 1);
    assert.deepStrictEqual(addContent.mock.calls[0].arguments[0], {
      type: 'time-values',
      content: [timeValue('p', '1'), timeValue('p', '1')]
    });
    assert.strictEqual(addContent.mock.calls[0].arguments[1], testData.constants.dates.FAKE_NOW);
    assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [configuration.items[0], configuration.items[1]]);
  });

  it('should manage query last point disconnect errors', async () => {
    skipSymbolCache();
    mock.method(south, 'readAdsSymbol', async () => {
      throw { ...new Error(''), message: 'Client is not connected' };
    });

    await south.directQuery(configuration.items);
    assert.ok(logged(logger.error, message => message.includes('ADS client disconnected while reading 2 item(s). Reconnecting'), 1));

    // Reconnect timer is now set — advancing time fires the reconnection
    assert.strictEqual(adsClient.connect.mock.calls.length, 0);
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(adsClient.connect.mock.calls.length, 1);
    // Disconnect clears the timer: no more calls after it
    await south.disconnect();
    const connectCallsAfterDisconnect = adsClient.connect.mock.calls.length;
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(adsClient.connect.mock.calls.length, connectCallsAfterDisconnect);
  });

  it('should manage query last point errors', async () => {
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    skipSymbolCache();
    mock.method(south, 'readAdsSymbol', async () => {
      throw new Error('read error');
    });

    await assert.rejects(south.directQuery(configuration.items), new Error('read error'));
    assert.strictEqual(disconnect.mock.calls.length, 0);
  });

  it('should test ADS connection and return device info', async () => {
    const disconnect = mock.method(south, 'disconnect', async () => undefined);

    const result = await south.testConnection();

    // testConnection() must never touch the connector's own disconnect()/this.client
    assert.strictEqual(disconnect.mock.calls.length, 0);
    assert.strictEqual(south['client'], null);
    assert.strictEqual(adsClient.disconnect.mock.calls.length, 1); // the local test client was closed instead
    assert.deepStrictEqual(result, deviceInfoItems('Run'));
  });

  it('should fall back to the numeric ADS state when adsStateStr is not provided', async () => {
    adsClient.readState.mock.mockImplementation(async () => ({ adsState: 5, adsStateStr: undefined, deviceState: 0 }));
    const disconnect = mock.method(south, 'disconnect', async () => undefined);

    const result = await south.testConnection();

    // testConnection() must never touch the connector's own disconnect()/this.client
    assert.strictEqual(disconnect.mock.calls.length, 0);
    assert.strictEqual(adsClient.disconnect.mock.calls.length, 1); // the local test client was closed instead
    assert.deepStrictEqual(result, deviceInfoItems('5'));
  });

  it('should close the local test client even when testConnection device info fetch fails', async () => {
    adsClient.readDeviceInfo.mock.mockImplementation(() => {
      throw new Error('readDeviceInfo failed');
    });
    const disconnect = mock.method(south, 'disconnect', async () => undefined);

    await assert.rejects(south.testConnection(), new Error('readDeviceInfo failed'));
    assert.strictEqual(disconnect.mock.calls.length, 0);
    assert.strictEqual(south['client'], null);
    assert.strictEqual(adsClient.disconnect.mock.calls.length, 1);
  });

  describe('with a live client', () => {
    let liveClient: SouthADSClass['client'];
    let reconnectTimeout: NodeJS.Timeout;

    beforeEach(async () => {
      await south.start();
      await south.connect();
      adsClient.connect.mock.resetCalls();
      liveClient = south['client'];
      assert.ok(liveClient !== null);
      reconnectTimeout = setTimeout(() => null, 1000);
      south['reconnectTimeout'] = reconnectTimeout;
    });

    const assertLiveClientUntouched = () => {
      // No new Client was created and connected — the live one was reused
      assert.strictEqual(adsClient.connect.mock.calls.length, 0);
      // this.client must be untouched: same reference, still set, never nulled or disconnected
      assert.strictEqual(south['client'], liveClient);
      assert.strictEqual(adsClient.disconnect.mock.calls.length, 0);
      // this.reconnectTimeout must be untouched
      assert.strictEqual(south['reconnectTimeout'], reconnectTimeout);
    };

    it('should reuse the live client in testConnection without touching this.client or reconnectTimeout', async () => {
      const result = await south.testConnection();

      assertLiveClientUntouched();
      assert.deepStrictEqual(result, deviceInfoItems('Run'));
    });

    it('should reuse the live client in testItem without touching this.client or reconnectTimeout', async () => {
      const mockedResult = { pointId: 'pointId', timestamp: '2024-06-10T14:00:00.000Z', data: { value: '42' } };
      const readAdsSymbol = mock.method(south, 'readAdsSymbol', async () => [mockedResult]);

      const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

      assertLiveClientUntouched();
      // readAdsSymbol was handed the reused live client, not a fresh one
      assert.strictEqual(readAdsSymbol.mock.calls[0].arguments[2], liveClient);
      assert.deepStrictEqual(result.result, { type: 'time-values', content: [mockedResult] });
      assert.strictEqual(result.connectionDuration, 0);
    });
  });

  it('should read symbol', async () => {
    adsClient.readValue.mock.mockImplementationOnce(
      async () => ({
        symbol: { type: 'Int8' },
        value: 1,
        timestamp: testData.constants.dates.FAKE_NOW,
        dataType: { subItems: [], enumInfos: [] }
      }),
      0
    );
    adsClient.readValue.mock.mockImplementationOnce(async () => ({ value: 2, timestamp: testData.constants.dates.FAKE_NOW }), 1);
    adsClient.readValue.mock.mockImplementationOnce(async () => {
      throw new Error('read error');
    }, 2);
    const parseValues = mock.method(south, 'parseValues', () => [{ value: 'my value' }]);
    const pointId = `${configuration.settings.plcName}${configuration.items[0].name}`;

    await south.start();
    await south.readAdsSymbol(configuration.items[0], testData.constants.dates.FAKE_NOW);
    await south.readAdsSymbol(configuration.items[0], testData.constants.dates.FAKE_NOW);

    assert.strictEqual(adsClient.readValue.mock.calls.length, 2);
    assert.strictEqual(parseValues.mock.calls.length, 2);
    assert.deepStrictEqual(parseValues.mock.calls[0].arguments, [pointId, 'Int8', 1, testData.constants.dates.FAKE_NOW, [], []]);
    assert.deepStrictEqual(parseValues.mock.calls[1].arguments, [
      pointId,
      undefined,
      2,
      testData.constants.dates.FAKE_NOW,
      undefined,
      undefined
    ]);
    await assert.rejects(south.readAdsSymbol(configuration.items[0], testData.constants.dates.FAKE_NOW), new Error('read error'));
  });

  it('should disconnect ads client', async () => {
    await south.connect();
    adsClient.disconnect.mock.mockImplementationOnce(async () => {
      throw new Error('disconnect error');
    });

    const disconnectedLogged = () =>
      logged(logger.info, message =>
        message.startsWith(`ADS client disconnected from ${configuration.settings.netId}:${configuration.settings.port} in`)
      );

    await south.disconnect();
    assert.ok(logged(logger.error, message => message.includes('ADS disconnect error') && message.includes('disconnect error')));
    assert.ok(!disconnectedLogged());

    await south.connect();
    const infoCallsAfterSecondConnect = logger.info.mock.calls.length;

    await south.disconnect();
    assert.ok(logger.info.mock.calls.length > infoCallsAfterSecondConnect);
    assert.ok(disconnectedLogged());
  });

  it('should test item and succeed', async () => {
    adsClient.connect.mock.mockImplementationOnce(async () => {
      mock.timers.tick(15);
      return { targetAmsNetId: 'targetAmsNetId', localAmsNetId: 'localAmsNetId', localAdsPort: 'localAdsPort' };
    });
    const disconnect = mock.method(south, 'disconnect', async () => undefined);
    const mockedResult = { pointId: 'pointId', timestamp: '2024-06-10T14:00:00.000Z', data: { value: '1234' } };
    mock.method(south, 'readAdsSymbol', async () => {
      mock.timers.tick(25);
      return [mockedResult];
    });

    // Note: no south.start()/south.connect() here — this.client must stay null so testItem()
    // exercises the "no live client" path and creates its own local client.
    const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);

    // testItem() must never touch the connector's own connect()/disconnect()/this.client
    assert.strictEqual(disconnect.mock.calls.length, 0);
    assert.strictEqual(south['client'], null);
    assert.strictEqual(adsClient.disconnect.mock.calls.length, 1); // the local test client was closed instead
    assert.deepStrictEqual(result, {
      result: { type: 'time-values', content: [mockedResult] },
      connectionDuration: 15,
      queryDuration: 25
    });
  });

  it('should test item and throw an error', async () => {
    adsClient.connect.mock.mockImplementationOnce(() => {
      throw new Error('undefined');
    });

    await assert.rejects(
      south.testItem(configuration.items[0], testData.south.itemTestingSettings),
      new Error('Unable to connect. undefined')
    );
    // Failure must not have left the connector's own this.client set or touched
    assert.strictEqual(south['client'], null);
  });

  describe('with a connected client', () => {
    beforeEach(async () => {
      await south.connect();
    });

    it('should use readRawMulti when items are found in the PLC symbol table', async () => {
      adsClient.getSymbols.mock.mockImplementationOnce(async () => ({ 'gvl_test.testint1': symbol1, 'gvl_test.testint2': symbol2 }));
      adsClient.readRawMulti.mock.mockImplementationOnce(async () => [rawSuccess(0x01, 0x00), rawSuccess(0x02, 0x00)]);
      adsClient.convertFromRaw.mock.mockImplementation(async () => 42);
      const parseValues = mock.method(south, 'parseValues', () => [{ pointId: 'p', timestamp: 'ts', data: { value: '42' } }]);

      await south.directQuery(configuration.items);

      // A single batched ADS request was made instead of one per item
      assert.strictEqual(adsClient.readRawMulti.mock.calls.length, 1);
      assert.deepStrictEqual(adsClient.readRawMulti.mock.calls[0].arguments[0], [
        { indexGroup: 0x4040, indexOffset: 0x0001, size: 2 },
        { indexGroup: 0x4040, indexOffset: 0x0002, size: 2 }
      ]);

      // convertFromRaw called once per successfully read item
      assert.strictEqual(adsClient.convertFromRaw.mock.calls.length, 2);
      assert.deepStrictEqual(adsClient.convertFromRaw.mock.calls[0].arguments[1], intDataType);

      // parseValues called with dataType fields from the cached AdsDataType
      assert.strictEqual(parseValues.mock.calls.length, 2);
      assert.deepStrictEqual(parseValues.mock.calls[0].arguments[1], 'INT');
      assert.deepStrictEqual(parseValues.mock.calls[0].arguments[4], []);
      assert.deepStrictEqual(parseValues.mock.calls[0].arguments[5], []);

      assert.strictEqual(addContent.mock.calls.length, 1);
    });

    it('should log an error and skip items where readRawMulti reports failure', async () => {
      adsClient.getSymbols.mock.mockImplementationOnce(async () => ({ 'gvl_test.testint1': symbol1, 'gvl_test.testint2': symbol2 }));
      adsClient.readRawMulti.mock.mockImplementationOnce(async () => [
        { success: false, value: undefined, errorCode: 0x700, errorStr: 'DEVICE_NOTFOUND' },
        rawSuccess(0x02, 0x00)
      ]);
      adsClient.convertFromRaw.mock.mockImplementation(async () => 2);
      mock.method(south, 'parseValues', () => [{ pointId: 'p2', timestamp: 'ts', data: { value: '2' } }]);

      await south.directQuery(configuration.items);

      assert.ok(
        logged(logger.error, message => message.includes(configuration.items[0].settings.address) && message.includes('DEVICE_NOTFOUND'), 1)
      );
      // Only one successful item contributed to content
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0], {
        type: 'time-values',
        content: [{ pointId: 'p2', timestamp: 'ts', data: { value: '2' } }]
      });
    });

    it('should warn when a configured item address is not found in the PLC symbol table', async () => {
      mock.method(south, 'readAdsSymbol', async () => []);
      // getSymbols returns only one of the two configured items
      adsClient.getSymbols.mock.mockImplementationOnce(async () => ({ 'gvl_test.testint1': symbol1 }));
      adsClient.readRawMulti.mock.mockImplementationOnce(async () => [rawSuccess(0x01, 0x00)]);
      mock.method(south, 'parseValues', () => []);

      await south.directQuery(configuration.items);

      assert.ok(
        logged(logger.warn, message => message.includes(configuration.items[1].settings.address) && message.includes('not found on PLC'), 1)
      );
    });

    it('should resolve array-indexed addresses via per-item getSymbol when not in bulk table', async () => {
      mock.method(south, 'parseValues', () => []);
      // getSymbols() bulk table is empty — items must fall through to per-item getSymbol
      adsClient.getSymbol.mock.mockImplementation(async (address: string) => ({ ...symbol1, name: address }));
      adsClient.readRawMulti.mock.mockImplementationOnce(async () => [rawSuccess(0x01, 0x00), rawSuccess(0x02, 0x00)]);

      await south.directQuery(configuration.items);

      // Both items were resolved via getSymbol (per-item path) and then read via readRawMulti
      assert.strictEqual(adsClient.getSymbol.mock.calls.length, 2);
      assert.strictEqual(adsClient.readRawMulti.mock.calls.length, 1);
    });

    it('should read uncached items concurrently when getSymbol fails', async () => {
      // All items fail to resolve (getSymbols is empty, getSymbol throws) → both go through concurrent readAdsSymbol fallback
      const readAdsSymbol = mock.method(south, 'readAdsSymbol', async () => []);

      await south.directQuery(configuration.items);

      // Both items were attempted (concurrent, not bailed on first failure)
      assert.strictEqual(readAdsSymbol.mock.calls.length, 2);
      assert.ok(
        logged(logger.warn, message => message.includes(configuration.items[0].settings.address) && message.includes('not found on PLC'), 1)
      );
    });

    it('should rebuild the symbol cache after a disconnect', async () => {
      mock.method(south, 'parseValues', () => []);
      adsClient.getSymbols.mock.mockImplementation(async () => ({ 'gvl_test.testint1': symbol1, 'gvl_test.testint2': symbol2 }));
      adsClient.readRawMulti.mock.mockImplementation(async () => [rawSuccess(0x01, 0x00), rawSuccess(0x02, 0x00)]);

      // First query — populates the symbol cache (getSymbols called once)
      await south.directQuery(configuration.items);
      assert.strictEqual(adsClient.getSymbols.mock.calls.length, 1);

      // Second query — cache hit, getSymbols is NOT called again
      await south.directQuery(configuration.items);
      assert.strictEqual(adsClient.getSymbols.mock.calls.length, 1);

      // Disconnect clears the cache (also sets this.client = null)
      mock.method(south, 'disconnectAdsClient', async () => undefined);
      await south.disconnect();

      // Reconnect so this.client is no longer null
      await south.connect();

      // Third query — cache was cleared, getSymbols is called again
      await south.directQuery(configuration.items);
      assert.strictEqual(adsClient.getSymbols.mock.calls.length, 2);
    });
  });

  describe('caching strategy filtering', () => {
    // Forces every item down the readAdsSymbol fallback path (buildSymbolCache no-op keeps the symbol
    // cache empty), which keeps these tests independent of the readRawMulti batching mechanics above.
    beforeEach(() => {
      skipSymbolCache();
    });

    // readAdsSymbol returns `values[item.name]` for each item
    const readValues = (values: Record<string, string>) => {
      mock.method(south, 'readAdsSymbol', async (item: SouthConnectorItemEntity<SouthADSItemSettings>) => [
        timeValue(item.name, values[item.name])
      ]);
    };

    it('should suppress a no-change value under cachingStrategy=onChange', async () => {
      readValues({ Var1: '42' });
      const item = buildItem('id1', 'Var1', { cachingStrategy: 'onChange' });
      southCacheRepository.getItemsLastValues.mock.mockImplementation(() => lastValues(['id1', ['42'], '2021-01-01T00:00:00.000Z']));

      await south.directQuery([item]);

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, []);
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], []);
      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments[1], []);
    });

    it('should cache a threshold-exceeding change', async () => {
      readValues({ Var1: '42' });
      const item = buildItem('id1', 'Var1', { cachingStrategy: 'threshold', thresholdType: 'absolute', threshold: 5 });
      southCacheRepository.getItemsLastValues.mock.mockImplementation(() => lastValues(['id1', ['30'], '2021-01-01T00:00:00.000Z']));

      await south.directQuery([item]);

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, [timeValue('Var1', '42')]);
      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments[1], [
        { itemId: 'id1', value: ['42'], instant: testData.constants.dates.FAKE_NOW }
      ]);
    });

    it('should compute a percentage-of-span threshold correctly, caching the value above it and suppressing the one below it', async () => {
      // rangeLow=0, rangeHigh=100 -> span=100; threshold=10% -> 10 absolute units
      // Var1: diff from 20 = 22 > 10, Var2: diff from 20 = 5 < 10
      readValues({ Var1: '42', Var2: '25' });
      const thresholdSettings = {
        cachingStrategy: 'threshold',
        thresholdType: 'percentage',
        threshold: 10,
        rangeLow: 0,
        rangeHigh: 100
      } as const;
      const overItem = buildItem('id1', 'Var1', thresholdSettings);
      const underItem = buildItem('id2', 'Var2', thresholdSettings);
      southCacheRepository.getItemsLastValues.mock.mockImplementation(() =>
        lastValues(['id1', ['20'], '2021-01-01T00:00:00.000Z'], ['id2', ['20'], '2021-01-01T00:00:00.000Z'])
      );

      await south.directQuery([overItem, underItem]);

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, [timeValue('Var1', '42')]);
      assert.deepStrictEqual(addContent.mock.calls[0].arguments[2], [overItem]);
    });

    it('should cache when maxCachingInterval elapses even without a qualifying change', async () => {
      readValues({ Var1: '42' });
      const item = buildItem('id1', 'Var1', { cachingStrategy: 'onChange', maxCachingInterval: 1000 });
      // previous cached value is identical (no onChange-qualifying diff), but well over an hour has
      // elapsed since trackedInstant
      southCacheRepository.getItemsLastValues.mock.mockImplementation(() => lastValues(['id1', ['42'], '2021-01-01T22:00:00.000Z']));

      await south.directQuery([item]);

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, [timeValue('Var1', '42')]);
    });

    it('should always cache the very first read for an item regardless of strategy', async () => {
      readValues({ Var1: '42' });
      const item = buildItem('id1', 'Var1', { cachingStrategy: 'onChange' });
      // getItemsLastValues default mock (set in beforeEach) returns an empty Map — no prior cached state

      await south.directQuery([item]);

      assert.deepStrictEqual(addContent.mock.calls[0].arguments[0].content, [timeValue('Var1', '42')]);
    });

    it('should call saveItemsLastValues with exactly the items actually cached in the cycle', async () => {
      // Var1 unchanged from previous -> suppressed, Var2 changed from previous -> cached
      readValues({ Var1: '42', Var2: '7' });
      const suppressedItem = buildItem('id1', 'Var1', { cachingStrategy: 'onChange' });
      const cachedItem = buildItem('id2', 'Var2', { cachingStrategy: 'onChange' });
      southCacheRepository.getItemsLastValues.mock.mockImplementation(() =>
        lastValues(['id1', ['42'], '2021-01-01T00:00:00.000Z'], ['id2', ['1'], '2021-01-01T00:00:00.000Z'])
      );

      await south.directQuery([suppressedItem, cachedItem]);

      assert.deepStrictEqual(southCacheRepository.saveItemsLastValues.mock.calls[0].arguments, [
        'southId',
        [{ itemId: 'id2', value: ['7'], instant: testData.constants.dates.FAKE_NOW }]
      ]);
    });
  });
});
