// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import ads from 'ads-client';
import SouthADS from './south-ads';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/service/logger/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/service/encryption-service.mock';
import { SouthADSItemSettings, SouthADSSettings } from '../../../shared/model/south-settings.model';
import SouthConnectorRepository from '../../repository/config/south-connector.repository';
import SouthConnectorRepositoryMock from '../../tests/__mocks__/repository/config/south-connector-repository.mock';
import ScanModeRepository from '../../repository/config/scan-mode.repository';
import ScanModeRepositoryMock from '../../tests/__mocks__/repository/config/scan-mode-repository.mock';
import SouthCacheRepository from '../../repository/cache/south-cache.repository';
import SouthCacheRepositoryMock from '../../tests/__mocks__/repository/cache/south-cache-repository.mock';
import SouthCacheServiceMock from '../../tests/__mocks__/service/south-cache-service.mock';
import { SouthConnectorEntity } from '../../model/south-connector.model';
import testData from '../../tests/utils/test-data';

// End of global variables

jest.mock('node:fs/promises');
jest.mock('ads-client');
jest.mock('../../service/utils');

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const southConnectorRepository: SouthConnectorRepository = new SouthConnectorRepositoryMock();
const scanModeRepository: ScanModeRepository = new ScanModeRepositoryMock();
const southCacheRepository: SouthCacheRepository = new SouthCacheRepositoryMock();
const southCacheService = new SouthCacheServiceMock();

jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return southCacheService;
    }
);

const logger: pino.Logger = new PinoLogger();
const addContentCallback = jest.fn();

const readSymbol = jest.fn();
const disconnect = jest.fn();

describe('South ADS', () => {
  let south: SouthADS;
  const configuration: SouthConnectorEntity<SouthADSSettings, SouthADSItemSettings> = {
    id: 'southId',
    name: 'south',
    type: 'test',
    description: 'my test connector',
    enabled: true,
    history: {
      maxInstantPerItem: true,
      maxReadInterval: 3600,
      readDelay: 0,
      overlap: 0
    },
    settings: {
      port: 851,
      netId: '10.211.55.3.1.1',
      clientAdsPort: 32750,
      routerTcpPort: 48898,
      clientAmsNetId: '10.211.55.2.1.1',
      routerAddress: '10.211.55.3',
      retryInterval: 10000,
      plcName: 'PLC_TEST.',
      boolAsText: 'Integer',
      enumAsText: 'Text',
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
    items: [
      {
        id: 'id1',
        name: 'GVL_Test.TestINT1',
        enabled: true,
        settings: {
          address: 'GVL_Test.TestINT1'
        },
        scanModeId: 'scanModeId1'
      },
      {
        id: 'id2',
        name: 'GVL_Test.TestINT2',
        enabled: true,
        settings: {
          address: 'GVL_Test.TestINT2'
        },
        scanModeId: 'scanModeId1'
      }
    ]
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(testData.constants.dates.FAKE_NOW));
    (southConnectorRepository.findSouthById as jest.Mock).mockReturnValue(configuration);

    // Mock ADS Client constructor and the used function
    ads.Client.mockReturnValue({
      connection: {
        connected: true
      },
      connect: () =>
        new Promise(resolve => {
          resolve({});
        }),
      disconnect,
      readSymbol
    });

    south = new SouthADS(
      configuration,
      addContentCallback,
      encryptionService,
      southConnectorRepository,
      southCacheRepository,
      scanModeRepository,
      logger,
      'baseFolder'
    );
  });

  it('should properly connect to a remote instance', async () => {
    await south.start();
    await south.connect();
    expect(ads.Client).toHaveBeenCalledWith({
      autoReconnect: false,
      localAdsPort: 32750,
      localAmsNetId: '10.211.55.2.1.1',
      routerAddress: '10.211.55.3',
      routerTcpPort: 48898,
      targetAdsPort: 851,
      targetAmsNetId: '10.211.55.3.1.1'
    });
  });

  it('should retry to connect in case of failure', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    ads.Client.mockReturnValue({
      connect: () =>
        new Promise((resolve, reject) => {
          reject();
        })
    });

    south.disconnectAdsClient = jest.fn();
    await south.connect();
    expect(logger.error).toHaveBeenCalledTimes(1);

    await south.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should parse BYTE value', () => {
    const result = south.parseValues(configuration.items[1].name, 'BYTE', '123', testData.constants.dates.FAKE_NOW, [], []);
    expect(result).toEqual([
      {
        pointId: configuration.items[1].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '123' }
      }
    ]);
  });

  it('should parse BOOL value', () => {
    expect(south.parseValues(configuration.items[1].name, 'BOOL', true, testData.constants.dates.FAKE_NOW, [], [])).toEqual([
      {
        pointId: configuration.items[1].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '1' }
      }
    ]);
    expect(south.parseValues(configuration.items[1].name, 'BOOL', false, testData.constants.dates.FAKE_NOW, [], [])).toEqual([
      {
        pointId: configuration.items[1].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '0' }
      }
    ]);

    configuration.settings.boolAsText = 'Text';
    expect(south.parseValues(configuration.items[1].name, 'BOOL', true, testData.constants.dates.FAKE_NOW, [], [])).toEqual([
      {
        pointId: configuration.items[1].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: 'true' }
      }
    ]);
  });

  it('should parse REAL value', () => {
    expect(south.parseValues(configuration.items[1].name, 'REAL', '123.4', testData.constants.dates.FAKE_NOW, [], [])).toEqual([
      {
        pointId: configuration.items[1].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '123.4' }
      }
    ]);
  });

  it('should parse STRING value', () => {
    expect(south.parseValues(configuration.items[1].name, 'STRING', 'string', testData.constants.dates.FAKE_NOW, [], [])).toEqual([
      {
        pointId: configuration.items[1].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: 'string' }
      }
    ]);

    expect(south.parseValues(configuration.items[1].name, 'STRING(35)', 'string', testData.constants.dates.FAKE_NOW, [], [])).toEqual([
      {
        pointId: configuration.items[1].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: 'string' }
      }
    ]);
  });

  it('should parse DATE value', () => {
    expect(
      south.parseValues(configuration.items[1].name, 'DATE', testData.constants.dates.FAKE_NOW, testData.constants.dates.FAKE_NOW)
    ).toEqual([
      {
        pointId: configuration.items[1].name,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: testData.constants.dates.FAKE_NOW }
      }
    ]);
  });

  it('should parse ARRAY [0..4] OF INT value', () => {
    expect(
      south.parseValues(configuration.items[1].name, 'ARRAY [0..4] OF INT', [123, 456, 789], testData.constants.dates.FAKE_NOW, [], [])
    ).toEqual([
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
        arrayData: [],
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
        arrayData: [],
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
        arrayData: [],
        subItems: []
      }
    ];
    expect(
      south.parseValues(
        configuration.items[1].name,
        'ST_Example',
        { SomeText: 'Hello ads-client', SomeReal: 3.1415927410125732, SomeDate: '2020-04-13T12:25:33.000Z' },
        testData.constants.dates.FAKE_NOW,
        subItems,
        []
      )
    ).toEqual([
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
    ]);

    expect(
      south.parseValues(
        configuration.items[1].name,
        'Another_Struct',
        { SomeText: 'Hello ads-client', SomeReal: 3.1415927410125732, SomeDate: '2020-04-13T12:25:33.000Z' },
        testData.constants.dates.FAKE_NOW,
        subItems,
        []
      )
    ).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      `Data Structure Another_Struct not parsed for data ${configuration.items[1].name}. To parse it, please specify it in the connector settings`
    );
  });

  it('should parse Enum value', () => {
    const enumInfo = [
      { name: 'Disabled', value: 0 },
      { name: 'Starting', value: 50 },
      {
        name: 'Running',
        value: 100
      },
      { name: 'Stopping', value: 200 }
    ];
    expect(
      south.parseValues(
        configuration.items[1].name,
        'Enum',
        { name: 'Running', value: 100 },
        testData.constants.dates.FAKE_NOW,
        [],
        enumInfo
      )
    ).toEqual([
      {
        pointId: `${configuration.items[1].name}`,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: 'Running' }
      }
    ]);

    configuration.settings.enumAsText = 'Integer';

    expect(
      south.parseValues(
        configuration.items[1].name,
        'Enum',
        { name: 'Running', value: 100 },
        testData.constants.dates.FAKE_NOW,
        [],
        enumInfo
      )
    ).toEqual([
      {
        pointId: `${configuration.items[1].name}`,
        timestamp: testData.constants.dates.FAKE_NOW,
        data: { value: '100' }
      }
    ]);
  });

  it('should parse Bad Type value', () => {
    expect(south.parseValues(configuration.items[1].name, 'BAD', 'value', testData.constants.dates.FAKE_NOW)).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(`dataType BAD not supported yet for point ${configuration.items[1].name}. Value was "value"`);
  });

  it('should query last point', async () => {
    south.addContent = jest.fn();
    south.readAdsSymbol = jest.fn().mockReturnValue([1]);
    await south.lastPointQuery(configuration.items);
    expect(south.addContent).toHaveBeenCalledWith({ type: 'time-values', content: [1, 1] });
  });

  it('should manage query last point disconnect errors', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    south.addContent = jest.fn();
    south.readAdsSymbol = jest.fn().mockImplementationOnce(() => {
      throw { ...new Error(''), message: 'Client is not connected' };
    });
    await south.lastPointQuery(configuration.items);
    expect(logger.error).toHaveBeenCalledWith('ADS client disconnected. Reconnecting');
    expect(south.addContent).not.toHaveBeenCalledWith();
    expect(clearTimeoutSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(configuration.settings.retryInterval);
    await south.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should manage query last point errors', async () => {
    south.addContent = jest.fn();
    south.disconnect = jest.fn();
    south.readAdsSymbol = jest.fn().mockImplementationOnce(() => {
      throw new Error('read error');
    });
    await expect(south.lastPointQuery(configuration.items)).rejects.toThrow('read error');
    expect(south.disconnect).not.toHaveBeenCalled();
    expect(south.addContent).not.toHaveBeenCalled();
  });

  it('should test ADS connection', async () => {
    // Mock ADS Client constructor and the used function
    ads.Client.mockReturnValue({
      connection: {
        connected: true
      },
      connect: () =>
        new Promise(resolve => {
          resolve({
            targetAmsNetId: 'targetAmsNetId',
            localAmsNetId: 'localAmsNetId',
            localAdsPort: 'localAdsPort'
          });
        }),
      disconnect,
      readSymbol
    });

    south.disconnect = jest.fn();
    await south.testConnection();
    expect(south.disconnect).toHaveBeenCalledTimes(1);
  });

  it('should read symbol', async () => {
    readSymbol
      .mockImplementationOnce(() => {
        return new Promise(resolve => {
          resolve({
            symbol: {
              type: 'Int8'
            },
            value: 1,
            timestamp: testData.constants.dates.FAKE_NOW,
            type: {
              subItems: [],
              enumInfo: []
            }
          });
        });
      })
      .mockImplementationOnce(() => {
        return new Promise(resolve => {
          resolve({
            value: 2,
            timestamp: testData.constants.dates.FAKE_NOW
          });
        });
      })
      .mockImplementationOnce(() => {
        return new Promise((resolve, reject) => {
          reject(new Error('read error'));
        });
      });
    south.parseValues = jest.fn().mockReturnValue([{ value: 'my value' }]);

    await south.start();
    await south.readAdsSymbol(configuration.items[0], testData.constants.dates.FAKE_NOW);
    await south.readAdsSymbol(configuration.items[0], testData.constants.dates.FAKE_NOW);

    expect(readSymbol).toHaveBeenCalledTimes(2);
    expect(south.parseValues).toHaveBeenCalledTimes(2);
    expect(south.parseValues).toHaveBeenCalledWith(
      `${configuration.settings.plcName}${configuration.items[0].name}`,
      'Int8',
      1,
      testData.constants.dates.FAKE_NOW,
      [],
      []
    );
    expect(south.parseValues).toHaveBeenCalledWith(
      `${configuration.settings.plcName}${configuration.items[0].name}`,
      undefined,
      2,
      testData.constants.dates.FAKE_NOW,
      undefined,
      undefined
    );
    await expect(south.readAdsSymbol(configuration.items[0], testData.constants.dates.FAKE_NOW)).rejects.toThrow('read error');
  });

  it('should disconnect ads client', async () => {
    await south.connect();
    disconnect
      .mockImplementationOnce(() => {
        return new Promise((resolve, reject) => {
          reject(new Error('disconnect error'));
        });
      })
      .mockImplementationOnce(() => {
        return new Promise(resolve => {
          resolve('');
        });
      });
    await south.disconnect();
    expect(logger.error).toHaveBeenCalledWith(`ADS disconnect error. ${new Error('disconnect error')}`);
    expect(logger.info).toHaveBeenCalledWith(`ADS client disconnected from ${configuration.settings.netId}:${configuration.settings.port}`);
    expect(logger.info).toHaveBeenCalledTimes(4);

    await south.connect();

    await south.disconnect();
    expect(logger.info).toHaveBeenCalledTimes(8);
  });

  it('should test item and sucess', async () => {
    south.connect = jest.fn();
    south.disconnect = jest.fn();
    const readAdsSymbol = (south.readAdsSymbol = jest.fn());
    readAdsSymbol.mockReturnValue([
      {
        pointId: 'pointId',
        timestamp: '2024-06-10T14:00:00.000Z',
        data: {
          value: 1234
        }
      }
    ]);
    await south.start();
    const callback = jest.fn();
    await south.testItem(configuration.items[0], callback);
    expect(south.disconnect).toHaveBeenCalledTimes(1);
  });

  it('should test item and throw an error', async () => {
    const connect = (south.connect = jest.fn());
    connect.mockRejectedValue('undefined');
    const readAdsSymbol = (south.readAdsSymbol = jest.fn());
    readAdsSymbol.mockReturnValue([
      {
        pointId: 'pointId',
        timestamp: '2024-06-10T14:00:00.000Z',
        data: {
          value: 1234
        }
      }
    ]);
    const callback = jest.fn();
    await expect(south.testItem(configuration.items[0], callback)).rejects.toThrow(new Error(`Unable to connect. undefined`));
  });
});
