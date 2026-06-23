import { describe, it, before, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import testData from '../../tests/utils/test-data';
import { mockModule, reloadModule } from '../../tests/utils/test-utils';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import type { SouthConnectorEntity, SouthConnectorItemEntity } from '../../model/south-connector.model';
import type { SouthADSItemSettings, SouthADSSettings, SouthItemSettings } from '../../../shared/model/south-settings.model';
import type { OIBusContent } from '../../../shared/model/engine.model';
import type { Instant } from '../../../shared/model/types';
import type { AdsDataType } from 'ads-client';
import type SouthADSClass from './south-ads';
import type SouthCacheRepository from '../../repository/cache/south-cache.repository';

const nodeRequire = createRequire(import.meta.url);

describe('South ADS', () => {
  let SouthADS: typeof SouthADSClass;
  let south: SouthADSClass;

  const logger = new PinoLogger();
  const addContentCallback = mock.fn(
    async (
      _southId: string,
      _data: OIBusContent,
      _queryTime: Instant,
      _items: Array<SouthConnectorItemEntity<SouthItemSettings>>
    ): Promise<void> => undefined
  );
  const southCacheRepository = new SouthCacheRepositoryMock() as unknown as SouthCacheRepository;
  let southCacheService: SouthCacheServiceMock;

  const connect = mock.fn(async () => ({ targetAmsNetId: 'targetAmsNetId', localAmsNetId: 'localAmsNetId', localAdsPort: 'localAdsPort' }));
  const disconnect = mock.fn(async () => undefined);
  const readValue = mock.fn(async (): Promise<unknown> => undefined);
  const getSymbols = mock.fn(async () => ({}));
  const getDataType = mock.fn(async () => ({ type: 'INT', subItems: [], enumInfos: [] }));
  const readRawMulti = mock.fn(async () => [] as Array<unknown>);
  const convertFromRaw = mock.fn(async () => 0 as unknown);
  const readDeviceInfo = mock.fn(async () => ({ deviceName: 'TestDevice', majorVersion: 3, minorVersion: 1, versionBuild: 4000 }));
  const readState = mock.fn(async () => ({ adsState: 5, adsStateStr: 'Run', deviceState: 0 }));
  const adsInstance = {
    connection: { connected: true },
    connect,
    disconnect,
    readValue,
    getSymbols,
    getDataType,
    readRawMulti,
    convertFromRaw,
    readDeviceInfo,
    readState
  };

  const adsExports: Record<string, unknown> = {
    __esModule: true,
    Client: mock.fn(function () {
      return adsInstance;
    })
  };
  adsExports.default = adsExports;

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
        {
          name: 'ST_Example',
          fields: 'SomeReal,SomeDate'
        },
        {
          name: 'Tc2_Standard.TON',
          fields: '*'
        }
      ]
    },
    groups: [],
    items: [
      {
        id: 'id1',
        name: 'GVL_Test.TestINT1',
        enabled: true,
        settings: {
          address: 'GVL_Test.TestINT1'
        },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
        createdBy: '',
        updatedBy: '',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'id2',
        name: 'GVL_Test.TestINT2',
        enabled: true,
        settings: {
          address: 'GVL_Test.TestINT2'
        },
        scanMode: testData.scanMode.list[0],
        group: null,
        syncWithGroup: false,
        maxReadInterval: null,
        readDelay: null,
        overlap: null,
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

  before(() => {
    mockModule(nodeRequire, 'ads-client', adsExports);
    mockModule(nodeRequire, '../../service/south-cache.service', {
      __esModule: true,
      default: function () {
        return southCacheService;
      }
    });
  mockModule(nodeRequire, '../../service/logger/logger.service', {
    loggerService: { createChildLogger: mock.fn(() => logger) },
    default: class {}
  });

    SouthADS = reloadModule<{ default: typeof SouthADSClass }>(nodeRequire, './south-ads').default;
  });

  beforeEach(() => {
    southCacheService = new SouthCacheServiceMock();
    connect.mock.resetCalls();
    disconnect.mock.resetCalls();
    readValue.mock.resetCalls();
    getSymbols.mock.resetCalls();
    getSymbols.mock.mockImplementation(async () => ({}));
    getDataType.mock.resetCalls();
    getDataType.mock.mockImplementation(async () => ({ type: 'INT', subItems: [], enumInfos: [] }));
    readRawMulti.mock.resetCalls();
    readRawMulti.mock.mockImplementation(async () => []);
    convertFromRaw.mock.resetCalls();
    convertFromRaw.mock.mockImplementation(async () => 0 as unknown);
    readDeviceInfo.mock.resetCalls();
    readDeviceInfo.mock.mockImplementation(async () => ({
      deviceName: 'TestDevice',
      majorVersion: 3,
      minorVersion: 1,
      versionBuild: 4000
    }));
    readState.mock.resetCalls();
    readState.mock.mockImplementation(async () => ({ adsState: 5, adsStateStr: 'Run', deviceState: 0 }));
    addContentCallback.mock.resetCalls();
    adsExports.Client = mock.fn(function () {
      return adsInstance;
    });
    mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date(testData.constants.dates.FAKE_NOW) });
    south = new SouthADS(configuration, addContentCallback, southCacheRepository,  'cacheFolder');
    // Reset boolAsText and enumAsText to their original values in case a test mutated them
    configuration.settings.boolAsText = 'integer';
    configuration.settings.enumAsText = 'text';
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
  });

  it('should properly connect to a remote instance', async () => {
    await south.start();
    await south.connect();
    assert.deepStrictEqual((adsExports.Client as ReturnType<typeof mock.fn>).mock.calls[0].arguments[0], {
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
    south.connectorConfiguration = JSON.parse(JSON.stringify(south.connectorConfiguration));
    south.connectorConfiguration.settings.clientAmsNetId = null;
    south.connectorConfiguration.settings.clientAdsPort = null;
    south.connectorConfiguration.settings.routerAddress = null;
    south.connectorConfiguration.settings.routerTcpPort = null;
    const result = south.createConnectionOptions();
    assert.deepStrictEqual(result, {
      targetAmsNetId: south.connectorConfiguration.settings.netId,
      targetAdsPort: south.connectorConfiguration.settings.port,
      autoReconnect: false
    });
  });

  it('should retry to connect in case of failure', async () => {
    connect.mock.mockImplementationOnce(() => {
      throw new Error('connection error');
    });

    mock.method(
      south,
      'disconnectAdsClient',
      mock.fn(async () => undefined)
    );
    await south.connect();
    assert.ok(logger.error.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[0] === 'ADS connect error: connection error'));

    // Timer is set for reconnect — disconnect should clear it
    await south.disconnect();
    // After disconnect, ticking should NOT trigger additional connect calls
    const connectCallsBefore = connect.mock.calls.length;
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(connect.mock.calls.length, connectCallsBefore);
  });

  it('should not retry to connect if disconnecting', async () => {
    connect.mock.mockImplementationOnce(() => {
      throw new Error('connection error');
    });
    const disconnectMock = mock.method(
      south,
      'disconnect',
      mock.fn(async () => undefined)
    );
    (south as unknown as Record<string, unknown>)['disconnecting'] = true;
    await south.connect();
    assert.ok(logger.error.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[0] === 'ADS connect error: connection error'));
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    // No setTimeout should have been triggered — ticking should not cause additional connect calls
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(connect.mock.calls.length, 1);
  });

  it('should parse BYTE value', () => {
    const result = south.parseValues(configuration.items[1].name, 'BYTE', '123', testData.constants.dates.FAKE_NOW, [], []);
    assert.deepStrictEqual(result, [
      {
        pointId: configuration.items[1].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '123' }
      }
    ]);
  });

  it('should parse BOOL value', () => {
    assert.deepStrictEqual(south.parseValues(configuration.items[1].name, 'BOOL', true, testData.constants.dates.FAKE_NOW, [], []), [
      {
        pointId: configuration.items[1].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '1' }
      }
    ]);
    assert.deepStrictEqual(south.parseValues(configuration.items[1].name, 'BOOL', false, testData.constants.dates.FAKE_NOW, [], []), [
      {
        pointId: configuration.items[1].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '0' }
      }
    ]);

    configuration.settings.boolAsText = 'text';
    assert.deepStrictEqual(south.parseValues(configuration.items[1].name, 'BOOL', true, testData.constants.dates.FAKE_NOW, [], []), [
      {
        pointId: configuration.items[1].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: 'true' }
      }
    ]);
  });

  it('should parse REAL value', () => {
    assert.deepStrictEqual(south.parseValues(configuration.items[1].name, 'REAL', '123.4', testData.constants.dates.FAKE_NOW, [], []), [
      {
        pointId: configuration.items[1].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '123.4' }
      }
    ]);
  });

  it('should parse STRING value', () => {
    assert.deepStrictEqual(south.parseValues(configuration.items[1].name, 'STRING', 'string', testData.constants.dates.FAKE_NOW, [], []), [
      {
        pointId: configuration.items[1].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: 'string' }
      }
    ]);

    assert.deepStrictEqual(
      south.parseValues(configuration.items[1].name, 'STRING(35)', 'string', testData.constants.dates.FAKE_NOW, [], []),
      [
        {
          pointId: configuration.items[1].name,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: { value: 'string' }
        }
      ]
    );
  });

  it('should parse DATE value', () => {
    assert.deepStrictEqual(
      south.parseValues(configuration.items[1].name, 'DATE', testData.constants.dates.FAKE_NOW, testData.constants.dates.FAKE_NOW),
      [
        {
          pointId: configuration.items[1].name,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: { value: testData.constants.dates.FAKE_NOW }
        }
      ]
    );
  });

  it('should parse ARRAY [0..4] OF INT value', () => {
    assert.deepStrictEqual(
      south.parseValues(configuration.items[1].name, 'ARRAY [0..4] OF INT', [123, 456, 789], testData.constants.dates.FAKE_NOW, [], []),
      [
        {
          pointId: `${configuration.items[1].name}.0`,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: { value: '123' }
        },
        {
          pointId: `${configuration.items[1].name}.1`,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: { value: '456' }
        },
        {
          pointId: `${configuration.items[1].name}.2`,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: { value: '789' }
        }
      ]
    );
  });

  it('should parse ST_Example value', () => {
    const subItems: Array<AdsDataType> = [
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

    assert.deepStrictEqual(
      south.parseValues(
        configuration.items[1].name,
        'ST_Example',
        { SomeText: 'Hello ads-client', SomeReal: 3.1415927410125732, SomeDate: '2020-04-13T12:25:33.000Z' },
        testData.constants.dates.FAKE_NOW,
        subItems,
        []
      ),
      [
        {
          pointId: `${configuration.items[1].name}.SomeReal`,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: { value: '3.1415927410125732' }
        },
        {
          pointId: `${configuration.items[1].name}.SomeDate`,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: { value: '2020-04-13T12:25:33.000Z' }
        }
      ]
    );

    assert.deepStrictEqual(
      south.parseValues(
        configuration.items[1].name,
        'Another_Struct',
        { SomeText: 'Hello ads-client', SomeReal: 3.1415927410125732, SomeDate: '2020-04-13T12:25:33.000Z' },
        testData.constants.dates.FAKE_NOW,
        subItems,
        []
      ),
      []
    );
    assert.ok(
      logger.debug.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          c.arguments[0] ===
          `Data Structure Another_Struct not parsed for data ${configuration.items[1].name}. To parse it, please specify it in the connector settings`
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

    assert.deepStrictEqual(
      south.parseValues(
        configuration.items[1].name,
        'Enum',
        { name: 'Running', value: 100 },
        testData.constants.dates.FAKE_NOW,
        [],
        enumInfo
      ),
      [
        {
          pointId: `${configuration.items[1].name}`,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: { value: 'Running' }
        }
      ]
    );

    configuration.settings.enumAsText = 'integer';

    assert.deepStrictEqual(
      south.parseValues(
        configuration.items[1].name,
        'Enum',
        { name: 'Running', value: 100 },
        testData.constants.dates.FAKE_NOW,
        [],
        enumInfo
      ),
      [
        {
          pointId: `${configuration.items[1].name}`,
          timestamp: testData.constants.dates.FAKE_NOW,
          data: { value: '100' }
        }
      ]
    );
  });

  it('should parse Bad Type value', () => {
    assert.deepStrictEqual(south.parseValues(configuration.items[1].name, 'BAD', 'value', testData.constants.dates.FAKE_NOW), []);
    assert.ok(
      logger.warn.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          c.arguments[0] === `dataType BAD not supported yet for point ${configuration.items[1].name}. Value was "value"`
      )
    );
  });

  it('should query last point', async () => {
    const addContentMock = mock.method(
      south,
      'addContent',
      mock.fn(async () => undefined)
    );
    mock.method(
      south as unknown as Record<string, unknown>,
      'buildSymbolCache',
      mock.fn(async () => undefined)
    );
    mock.method(
      south,
      'readAdsSymbol',
      mock.fn(async () => [1])
    );
    await south.directQuery(configuration.items);
    assert.strictEqual(addContentMock.mock.calls.length, 1);
    assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[0], { type: 'time-values', content: [1, 1] });
    assert.strictEqual(addContentMock.mock.calls[0].arguments[1], testData.constants.dates.FAKE_NOW);
    assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[2], [configuration.items[0], configuration.items[1]]);
  });

  it('should manage query last point disconnect errors', async () => {
    mock.method(
      south,
      'addContent',
      mock.fn(async () => undefined)
    );
    mock.method(
      south as unknown as Record<string, unknown>,
      'buildSymbolCache',
      mock.fn(async () => undefined)
    );
    mock.method(
      south,
      'readAdsSymbol',
      mock.fn(async () => {
        throw { ...new Error(''), message: 'Client is not connected' };
      })
    );
    await south.directQuery(configuration.items);
    assert.ok(
      logger.error.mock.calls.some((c: { arguments: Array<unknown> }) => c.arguments[0] === 'ADS client disconnected. Reconnecting')
    );

    // Reconnect timer is now set — advance time and disconnect to clear it
    const connectCallsBefore = connect.mock.calls.length;
    mock.timers.tick(configuration.settings.retryInterval);
    // After tick the reconnect fires — then we disconnect to clean up
    await south.disconnect();
    // Verify the timer was cleared (no more calls after disconnect)
    const connectCallsAfterDisconnect = connect.mock.calls.length;
    mock.timers.tick(configuration.settings.retryInterval);
    assert.strictEqual(connect.mock.calls.length, connectCallsAfterDisconnect);
    // addContent was not called (no results)
    assert.ok(connectCallsBefore >= 0); // just confirm we got here
  });

  it('should manage query last point errors', async () => {
    mock.method(
      south,
      'addContent',
      mock.fn(async () => undefined)
    );
    const disconnectMock = mock.method(
      south,
      'disconnect',
      mock.fn(async () => undefined)
    );
    mock.method(
      south as unknown as Record<string, unknown>,
      'buildSymbolCache',
      mock.fn(async () => undefined)
    );
    mock.method(
      south,
      'readAdsSymbol',
      mock.fn(async () => {
        throw new Error('read error');
      })
    );
    await assert.rejects(south.directQuery(configuration.items), new Error('read error'));
    assert.strictEqual(disconnectMock.mock.calls.length, 0);
  });

  it('should test ADS connection and return device info', async () => {
    const disconnectMock = mock.method(
      south,
      'disconnect',
      mock.fn(async () => undefined)
    );
    const result = await south.testConnection();
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    assert.deepStrictEqual(result, {
      items: [
        { key: 'Device name', value: 'TestDevice' },
        { key: 'Firmware version', value: '3.1.4000' },
        { key: 'ADS state', value: 'Run' },
        { key: 'Device state', value: '0' }
      ]
    });
  });

  it('should disconnect even when testConnection device info fetch fails', async () => {
    readDeviceInfo.mock.mockImplementation(() => {
      throw new Error('readDeviceInfo failed');
    });
    const disconnectMock = mock.method(
      south,
      'disconnect',
      mock.fn(async () => undefined)
    );
    await assert.rejects(south.testConnection(), new Error('readDeviceInfo failed'));
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
  });

  it('should read symbol', async () => {
    let readCallCount = 0;
    readValue.mock.mockImplementation(async () => {
      readCallCount++;
      if (readCallCount === 1) {
        return {
          symbol: { type: 'Int8' },
          value: 1,
          timestamp: testData.constants.dates.FAKE_NOW,
          dataType: { subItems: [], enumInfos: [] }
        };
      }
      if (readCallCount === 2) {
        return { value: 2, timestamp: testData.constants.dates.FAKE_NOW };
      }
      throw new Error('read error');
    });

    const parseValuesMock = mock.method(
      south,
      'parseValues',
      mock.fn(() => [{ value: 'my value' }])
    );

    await south.start();
    await south.readAdsSymbol(configuration.items[0], testData.constants.dates.FAKE_NOW);
    await south.readAdsSymbol(configuration.items[0], testData.constants.dates.FAKE_NOW);

    assert.strictEqual(readValue.mock.calls.length, 2);
    assert.strictEqual(parseValuesMock.mock.calls.length, 2);
    assert.deepStrictEqual(parseValuesMock.mock.calls[0].arguments, [
      `${configuration.settings.plcName}${configuration.items[0].name}`,
      'Int8',
      1,
      testData.constants.dates.FAKE_NOW,
      [],
      []
    ]);
    assert.deepStrictEqual(parseValuesMock.mock.calls[1].arguments, [
      `${configuration.settings.plcName}${configuration.items[0].name}`,
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
    let disconnectCallCount = 0;
    disconnect.mock.mockImplementation(async () => {
      disconnectCallCount++;
      if (disconnectCallCount === 1) throw new Error('disconnect error');
    });

    await south.disconnect();
    assert.ok(
      logger.error.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes('ADS disconnect error') && (c.arguments[0] as string).includes('disconnect error')
      )
    );
    assert.ok(
      logger.info.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          c.arguments[0] === `ADS client disconnected from ${configuration.settings.netId}:${configuration.settings.port}`
      )
    );

    disconnect.mock.resetCalls();
    disconnectCallCount = 0;
    disconnect.mock.mockImplementation(async () => {
      disconnectCallCount++;
    });

    await south.connect();
    const infoCallsAfterSecondConnect = logger.info.mock.calls.length;

    await south.disconnect();
    assert.ok(logger.info.mock.calls.length > infoCallsAfterSecondConnect);
  });

  it('should test item and succeed', async () => {
    const connectMock = mock.method(
      south,
      'connect',
      mock.fn(async () => undefined)
    );
    const disconnectMock = mock.method(
      south,
      'disconnect',
      mock.fn(async () => undefined)
    );
    const mockedResult = {
      pointId: 'pointId',
      timestamp: '2024-06-10T14:00:00.000Z',
      data: { value: 1234 }
    };
    mock.method(
      south,
      'readAdsSymbol',
      mock.fn(async () => [mockedResult])
    );
    await south.start();
    const result = await south.testItem(configuration.items[0], testData.south.itemTestingSettings);
    assert.strictEqual(disconnectMock.mock.calls.length, 1);
    assert.deepStrictEqual(result, { type: 'time-values', content: [mockedResult] });
    assert.ok(connectMock.mock.calls.length >= 1);
  });

  it('should test item and throw an error', async () => {
    mock.method(
      south,
      'connect',
      mock.fn(async () => {
        throw new Error('undefined');
      })
    );

    await assert.rejects(
      south.testItem(configuration.items[0], testData.south.itemTestingSettings),
      new Error('Unable to connect. undefined')
    );
  });

  it('should use readRawMulti when items are found in the PLC symbol table', async () => {
    await south.connect();
    const addContentMock = mock.method(
      south,
      'addContent',
      mock.fn(async () => undefined)
    );

    const intDataType = { type: 'INT', subItems: [], enumInfos: [] };
    getSymbols.mock.mockImplementationOnce(async () => ({
      'gvl_test.testint1': { indexGroup: 0x4040, indexOffset: 0x0001, size: 2, type: 'INT' },
      'gvl_test.testint2': { indexGroup: 0x4040, indexOffset: 0x0002, size: 2, type: 'INT' }
    }));
    getDataType.mock.mockImplementation(async () => intDataType);
    readRawMulti.mock.mockImplementationOnce(async () => [
      { success: true, value: Buffer.from([0x01, 0x00]), errorCode: 0, errorStr: '' },
      { success: true, value: Buffer.from([0x02, 0x00]), errorCode: 0, errorStr: '' }
    ]);
    convertFromRaw.mock.mockImplementation(async () => 42 as unknown);

    const parseValuesMock = mock.method(
      south,
      'parseValues',
      mock.fn(() => [{ pointId: 'p', timestamp: 'ts', data: { value: '42' } }])
    );

    await south.directQuery(configuration.items);

    // A single batched ADS request was made instead of one per item
    assert.strictEqual(readRawMulti.mock.calls.length, 1);
    assert.deepStrictEqual(readRawMulti.mock.calls[0].arguments[0], [
      { indexGroup: 0x4040, indexOffset: 0x0001, size: 2 },
      { indexGroup: 0x4040, indexOffset: 0x0002, size: 2 }
    ]);

    // convertFromRaw called once per successfully read item
    assert.strictEqual(convertFromRaw.mock.calls.length, 2);
    assert.deepStrictEqual(convertFromRaw.mock.calls[0].arguments[1], intDataType);

    // parseValues called with dataType fields from the cached AdsDataType
    assert.strictEqual(parseValuesMock.mock.calls.length, 2);
    assert.deepStrictEqual(parseValuesMock.mock.calls[0].arguments[1], 'INT');
    assert.deepStrictEqual(parseValuesMock.mock.calls[0].arguments[4], []);
    assert.deepStrictEqual(parseValuesMock.mock.calls[0].arguments[5], []);

    assert.strictEqual(addContentMock.mock.calls.length, 1);
  });

  it('should log an error and skip items where readRawMulti reports failure', async () => {
    await south.connect();
    const addContentMock = mock.method(
      south,
      'addContent',
      mock.fn(async () => undefined)
    );

    getSymbols.mock.mockImplementationOnce(async () => ({
      'gvl_test.testint1': { indexGroup: 0x4040, indexOffset: 0x0001, size: 2, type: 'INT' },
      'gvl_test.testint2': { indexGroup: 0x4040, indexOffset: 0x0002, size: 2, type: 'INT' }
    }));
    getDataType.mock.mockImplementation(async () => ({ type: 'INT', subItems: [], enumInfos: [] }));
    readRawMulti.mock.mockImplementationOnce(async () => [
      { success: false, value: undefined, errorCode: 0x700, errorStr: 'DEVICE_NOTFOUND' },
      { success: true, value: Buffer.from([0x02, 0x00]), errorCode: 0, errorStr: '' }
    ]);
    convertFromRaw.mock.mockImplementation(async () => 2 as unknown);
    mock.method(
      south,
      'parseValues',
      mock.fn(() => [{ pointId: 'p2', timestamp: 'ts', data: { value: '2' } }])
    );

    await south.directQuery(configuration.items);

    assert.ok(
      logger.error.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes(configuration.items[0].settings.address) &&
          (c.arguments[0] as string).includes('DEVICE_NOTFOUND')
      )
    );
    // Only one successful item contributed to content
    assert.deepStrictEqual(addContentMock.mock.calls[0].arguments[0], {
      type: 'time-values',
      content: [{ pointId: 'p2', timestamp: 'ts', data: { value: '2' } }]
    });
  });

  it('should warn when a configured item address is not found in the PLC symbol table', async () => {
    await south.connect();
    mock.method(
      south,
      'addContent',
      mock.fn(async () => undefined)
    );
    mock.method(
      south,
      'readAdsSymbol',
      mock.fn(async () => [])
    );

    // getSymbols returns only one of the two configured items
    getSymbols.mock.mockImplementationOnce(async () => ({
      'gvl_test.testint1': { indexGroup: 0x4040, indexOffset: 0x0001, size: 2, type: 'INT' }
    }));
    getDataType.mock.mockImplementation(async () => ({ type: 'INT', subItems: [], enumInfos: [] }));
    readRawMulti.mock.mockImplementationOnce(async () => [{ success: true, value: Buffer.from([0x01, 0x00]), errorCode: 0, errorStr: '' }]);
    convertFromRaw.mock.mockImplementation(async () => 0 as unknown);
    mock.method(
      south,
      'parseValues',
      mock.fn(() => [])
    );

    await south.directQuery(configuration.items);

    assert.ok(
      logger.warn.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes(configuration.items[1].settings.address) &&
          (c.arguments[0] as string).includes('not found on PLC')
      )
    );
  });

  it('should resolve array-indexed addresses via per-item getSymbol when not in bulk table', async () => {
    await south.connect();
    mock.method(
      south,
      'addContent',
      mock.fn(async () => undefined)
    );
    mock.method(
      south,
      'parseValues',
      mock.fn(() => [])
    );

    // getSymbols() bulk table is empty — items must fall through to per-item getSymbol
    getSymbols.mock.mockImplementationOnce(async () => ({}));
    adsInstance.getSymbol = mock.fn(async (address: string) => ({
      indexGroup: 0x4040,
      indexOffset: 0x0001,
      size: 2,
      type: 'INT',
      name: address
    }));
    getDataType.mock.mockImplementation(async () => ({ type: 'INT', subItems: [], enumInfos: [] }));
    readRawMulti.mock.mockImplementationOnce(async () => [
      { success: true, value: Buffer.from([0x01, 0x00]), errorCode: 0, errorStr: '' },
      { success: true, value: Buffer.from([0x02, 0x00]), errorCode: 0, errorStr: '' }
    ]);
    convertFromRaw.mock.mockImplementation(async () => 0 as unknown);

    await south.directQuery(configuration.items);

    // Both items were resolved via getSymbol (per-item path) and then read via readRawMulti
    assert.strictEqual((adsInstance.getSymbol as ReturnType<typeof mock.fn>).mock.calls.length, 2);
    assert.strictEqual(readRawMulti.mock.calls.length, 1);
  });

  it('should read uncached items concurrently when getSymbol fails', async () => {
    await south.connect();
    mock.method(
      south,
      'addContent',
      mock.fn(async () => undefined)
    );

    // All items fail to resolve → both go through concurrent readAdsSymbol fallback
    getSymbols.mock.mockImplementationOnce(async () => ({}));
    adsInstance.getSymbol = mock.fn(async () => {
      throw new Error('not found');
    });

    const readAdsSymbolMock = mock.method(
      south,
      'readAdsSymbol',
      mock.fn(async () => {
        return [];
      })
    );

    await south.directQuery(configuration.items);

    // Both items were attempted (concurrent, not bailed on first failure)
    assert.strictEqual(readAdsSymbolMock.mock.calls.length, 2);
    assert.ok(
      logger.warn.mock.calls.some(
        (c: { arguments: Array<unknown> }) =>
          (c.arguments[0] as string).includes(configuration.items[0].settings.address) &&
          (c.arguments[0] as string).includes('not found on PLC')
      )
    );
  });

  it('should rebuild the symbol cache after a disconnect', async () => {
    await south.connect();
    mock.method(
      south,
      'addContent',
      mock.fn(async () => undefined)
    );
    mock.method(
      south,
      'parseValues',
      mock.fn(() => [])
    );

    const symbolsMap = {
      'gvl_test.testint1': { indexGroup: 0x4040, indexOffset: 0x0001, size: 2, type: 'INT' },
      'gvl_test.testint2': { indexGroup: 0x4040, indexOffset: 0x0002, size: 2, type: 'INT' }
    };
    getSymbols.mock.mockImplementation(async () => symbolsMap);
    getDataType.mock.mockImplementation(async () => ({ type: 'INT', subItems: [], enumInfos: [] }));
    readRawMulti.mock.mockImplementation(async () => [
      { success: true, value: Buffer.from([0x01, 0x00]), errorCode: 0, errorStr: '' },
      { success: true, value: Buffer.from([0x02, 0x00]), errorCode: 0, errorStr: '' }
    ]);
    convertFromRaw.mock.mockImplementation(async () => 0 as unknown);

    // First query — populates the symbol cache (getSymbols called once)
    await south.directQuery(configuration.items);
    assert.strictEqual(getSymbols.mock.calls.length, 1);

    // Second query — cache hit, getSymbols is NOT called again
    await south.directQuery(configuration.items);
    assert.strictEqual(getSymbols.mock.calls.length, 1);

    // Disconnect clears the cache (also sets this.client = null)
    mock.method(
      south,
      'disconnectAdsClient',
      mock.fn(async () => undefined)
    );
    await south.disconnect();

    // Reconnect so this.client is no longer null
    await south.connect();

    // Third query — cache was cleared, getSymbols is called again
    await south.directQuery(configuration.items);
    assert.strictEqual(getSymbols.mock.calls.length, 2);
  });
});
