// @ts-ignore
import ads from 'ads-client';
import SouthADS from './south-ads';
import DatabaseMock from '../../tests/__mocks__/database.mock';
import pino from 'pino';
import PinoLogger from '../../tests/__mocks__/logger.mock';
import EncryptionService from '../../service/encryption.service';
import EncryptionServiceMock from '../../tests/__mocks__/encryption-service.mock';
import RepositoryService from '../../service/repository.service';
import RepositoryServiceMock from '../../tests/__mocks__/repository-service.mock';
import { SouthConnectorItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';

// End of global variables

jest.mock('node:fs/promises');
jest.mock('ads-client');
jest.mock('../../service/utils');
const database = new DatabaseMock();
jest.mock(
  '../../service/south-cache.service',
  () =>
    function () {
      return {
        southCacheRepository: {
          database
        }
      };
    }
);

jest.mock(
  '../../service/south-connector-metrics.service',
  () =>
    function () {
      return {
        initMetrics: jest.fn(),
        updateMetrics: jest.fn(),
        get stream() {
          return { stream: 'myStream' };
        },
        metrics: {
          numberOfValuesRetrieved: 1,
          numberOfFilesRetrieved: 1
        }
      };
    }
);

const addValues = jest.fn();
const addFile = jest.fn();
const readSymbol = jest.fn();
const disconnect = jest.fn();
const logger: pino.Logger = new PinoLogger();

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();

const items: Array<SouthConnectorItemDTO> = [
  {
    id: 'id1',
    name: 'GVL_Test.TestINT1',
    enabled: true,
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'GVL_Test.TestINT2',
    enabled: true,
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  }
];

const nowDateString = '2020-02-02T02:02:02.222Z';

let south: SouthADS;
const configuration: SouthConnectorDTO = {
  id: 'southId',
  name: 'south',
  type: 'test',
  description: 'my test connector',
  enabled: true,
  history: {
    maxInstantPerItem: true,
    maxReadInterval: 3600,
    readDelay: 0
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
  }
};

describe('South ADS', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(new Date(nowDateString));

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

    south = new SouthADS(configuration, items, addValues, addFile, encryptionService, repositoryService, logger, 'baseFolder');
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
    ads.Client.mockReturnValue({
      connect: () =>
        new Promise((resolve, reject) => {
          reject();
        })
    });
    south.disconnect = jest.fn();
    await south.connect();

    expect(logger.error).toBeCalledTimes(1);
  });

  it('should parse BYTE value', () => {
    const result = south.parseValues(items[1].name, 'BYTE', '123', nowDateString, [], []);
    expect(result).toEqual([
      {
        pointId: items[1].name,
        timestamp: nowDateString,
        data: { value: '123' }
      }
    ]);
  });

  it('should parse BOOL value', () => {
    expect(south.parseValues(items[1].name, 'BOOL', true, nowDateString, [], [])).toEqual([
      {
        pointId: items[1].name,
        timestamp: nowDateString,
        data: { value: '1' }
      }
    ]);
    expect(south.parseValues(items[1].name, 'BOOL', false, nowDateString, [], [])).toEqual([
      {
        pointId: items[1].name,
        timestamp: nowDateString,
        data: { value: '0' }
      }
    ]);

    configuration.settings.boolAsText = 'Text';
    expect(south.parseValues(items[1].name, 'BOOL', true, nowDateString, [], [])).toEqual([
      {
        pointId: items[1].name,
        timestamp: nowDateString,
        data: { value: 'true' }
      }
    ]);
  });

  it('should parse REAL value', () => {
    expect(south.parseValues(items[1].name, 'REAL', '123.4', nowDateString, [], [])).toEqual([
      {
        pointId: items[1].name,
        timestamp: nowDateString,
        data: { value: '123.4' }
      }
    ]);
  });

  it('should parse STRING value', () => {
    expect(south.parseValues(items[1].name, 'STRING', 'string', nowDateString, [], [])).toEqual([
      {
        pointId: items[1].name,
        timestamp: nowDateString,
        data: { value: 'string' }
      }
    ]);

    expect(south.parseValues(items[1].name, 'STRING(35)', 'string', nowDateString, [], [])).toEqual([
      {
        pointId: items[1].name,
        timestamp: nowDateString,
        data: { value: 'string' }
      }
    ]);
  });

  it('should parse DATE value', () => {
    expect(south.parseValues(items[1].name, 'DATE', nowDateString, nowDateString)).toEqual([
      {
        pointId: items[1].name,
        timestamp: nowDateString,
        data: { value: nowDateString }
      }
    ]);
  });

  it('should parse ARRAY [0..4] OF INT value', () => {
    expect(south.parseValues(items[1].name, 'ARRAY [0..4] OF INT', [123, 456, 789], nowDateString, [], [])).toEqual([
      {
        pointId: `${items[1].name}.0`,
        timestamp: nowDateString,
        data: { value: '123' }
      },
      {
        pointId: `${items[1].name}.1`,
        timestamp: nowDateString,
        data: { value: '456' }
      },
      {
        pointId: `${items[1].name}.2`,
        timestamp: nowDateString,
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
        items[1].name,
        'ST_Example',
        { SomeText: 'Hello ads-client', SomeReal: 3.1415927410125732, SomeDate: '2020-04-13T12:25:33.000Z' },
        nowDateString,
        subItems,
        []
      )
    ).toEqual([
      {
        pointId: `${items[1].name}.SomeReal`,
        timestamp: nowDateString,
        data: { value: '3.1415927410125732' }
      },
      {
        pointId: `${items[1].name}.SomeDate`,
        timestamp: nowDateString,
        data: { value: '2020-04-13T12:25:33.000Z' }
      }
    ]);

    expect(
      south.parseValues(
        items[1].name,
        'Another_Struct',
        { SomeText: 'Hello ads-client', SomeReal: 3.1415927410125732, SomeDate: '2020-04-13T12:25:33.000Z' },
        nowDateString,
        subItems,
        []
      )
    ).toEqual([]);
    expect(logger.debug).toHaveBeenCalledWith(
      `Data Structure Another_Struct not parsed for data ${items[1].name}. To parse it, please specify it in the connector settings`
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
    expect(south.parseValues(items[1].name, 'Enum', { name: 'Running', value: 100 }, nowDateString, [], enumInfo)).toEqual([
      {
        pointId: `${items[1].name}`,
        timestamp: nowDateString,
        data: { value: 'Running' }
      }
    ]);

    configuration.settings.enumAsText = 'Integer';

    expect(south.parseValues(items[1].name, 'Enum', { name: 'Running', value: 100 }, nowDateString, [], enumInfo)).toEqual([
      {
        pointId: `${items[1].name}`,
        timestamp: nowDateString,
        data: { value: '100' }
      }
    ]);
  });

  it('should parse Bad Type value', () => {
    expect(south.parseValues(items[1].name, 'BAD', 'value', nowDateString)).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(`dataType BAD not supported yet for point ${items[1].name}. Value was "value"`);
  });

  it('should query last point', async () => {
    south.addValues = jest.fn();
    south.readAdsSymbol = jest.fn().mockReturnValue([1]);
    await south.lastPointQuery(items);
    expect(south.addValues).toHaveBeenCalledWith([1, 1]);
  });

  it('should manage query last point disconnect errors', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    south.addValues = jest.fn();
    south.readAdsSymbol = jest.fn().mockImplementationOnce(() => {
      throw { ...new Error(''), message: 'Client is not connected' };
    });
    await south.lastPointQuery(items);
    expect(logger.error).toHaveBeenCalledWith('ADS client disconnected. Reconnecting');
    expect(south.addValues).not.toHaveBeenCalledWith();
    expect(clearTimeoutSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(configuration.settings.retryInterval);
    await south.disconnect();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('should manage query last point errors', async () => {
    south.addValues = jest.fn();
    south.disconnect = jest.fn();
    south.readAdsSymbol = jest.fn().mockImplementationOnce(() => {
      throw new Error('read error');
    });
    await expect(south.lastPointQuery(items)).rejects.toThrowError('read error');
    expect(south.disconnect).not.toHaveBeenCalled();
    expect(south.addValues).not.toHaveBeenCalledWith();
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
    expect(logger.info).toHaveBeenCalledWith(
      'Connected to targetAmsNetId with local AmsNetId localAmsNetId and local port localAdsPort. Disconnecting...'
    );
    expect(logger.info).toHaveBeenCalledWith('ADS connection correctly closed');
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
            timestamp: nowDateString,
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
            timestamp: nowDateString
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
    await south.readAdsSymbol('item', nowDateString);
    await south.readAdsSymbol('item', nowDateString);

    expect(readSymbol).toHaveBeenCalledTimes(2);
    expect(south.parseValues).toHaveBeenCalledTimes(2);
    expect(south.parseValues).toHaveBeenCalledWith(`${configuration.settings.plcName}item`, 'Int8', 1, nowDateString, [], []);
    expect(south.parseValues).toHaveBeenCalledWith(
      `${configuration.settings.plcName}item`,
      undefined,
      2,
      nowDateString,
      undefined,
      undefined
    );
    await expect(south.readAdsSymbol('item', nowDateString)).rejects.toThrowError('read error');
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
});
