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
import ProxyService from '../../service/proxy.service';
import { OibusItemDTO, SouthConnectorDTO } from '../../../../shared/model/south-connector.model';

// Global variable used to simulate ADS library returned values
const GVLTestByte = {
  value: 1234,
  type: {
    name: '',
    type: 'BYTE'
  },
  symbol: {
    name: 'GVL_Test.TestByte',
    type: 'BYTE'
  }
};
const GVLTestWord = {
  value: 1234,
  type: {
    name: '',
    type: 'WORD'
  },
  symbol: {
    name: 'GVL_Test.TestWord',
    type: 'WORD'
  }
};
const GVLTestDWord = {
  value: 1234,
  type: {
    name: '',
    type: 'DWORD'
  },
  symbol: {
    name: 'GVL_Test.TestDWord',
    type: 'DWORD'
  }
};
const GVLTestSINT = {
  value: 1234,
  type: {
    name: '',
    type: 'SINT'
  },
  symbol: {
    name: 'GVL_Test.TestSINT',
    type: 'SINT'
  }
};
const GVLTestUSINT = {
  value: 1234,
  type: {
    name: '',
    type: 'USINT'
  },
  symbol: {
    name: 'GVL_Test.TestUSINT',
    type: 'USINT'
  }
};
const GVLTestINT = {
  value: 1234,
  type: {
    name: '',
    type: 'INT',
    size: 2,
    offset: 0,
    adsDataType: 2,
    adsDataTypeStr: 'ADST_INT16',
    comment: '',
    attributes: [
      { name: 'DisplayMinValue', value: '#x8000' },
      { name: 'DisplayMaxValue', value: '#x7fff' }
    ],
    rpcMethods: [],
    arrayData: [],
    subItems: []
  },
  symbol: {
    indexGroup: 16448,
    indexOffset: 385044,
    size: 2,
    adsDataType: 2,
    adsDataTypeStr: 'ADST_INT16',
    flags: 8,
    flagsStr: ['TypeGuid'],
    arrayDimension: 0,
    nameLength: 16,
    typeLength: 3,
    commentLength: 0,
    name: 'GVL_Test.TestINT',
    type: 'INT',
    comment: '',
    arrayData: [],
    typeGuid: '95190718000000000000000000000006',
    attributes: [],
    reserved: { type: 'Buffer', data: [0, 0, 0, 0] }
  }
};
const GVLTestUINT = {
  value: 1234,
  type: {
    name: '',
    type: 'UINT'
  },
  symbol: {
    name: 'GVL_Test.TestUINT',
    type: 'UINT'
  }
};
const GVLTestDINT = {
  value: 1234,
  type: {
    name: '',
    type: 'DINT'
  },
  symbol: {
    name: 'GVL_Test.TestDINT',
    type: 'DINT'
  }
};
const GVLTestUDINT = {
  value: 1234,
  type: {
    name: '',
    type: 'UDINT'
  },
  symbol: {
    name: 'GVL_Test.TestUDINT',
    type: 'UDINT'
  }
};
const GVLTestLINT = {
  value: 1234,
  type: {
    name: '',
    type: 'LINT'
  },
  symbol: {
    name: 'GVL_Test.TestLINT',
    type: 'LINT'
  }
};
const GVLTestULINT = {
  value: 1234,
  type: {
    name: '',
    type: 'ULINT'
  },
  symbol: {
    name: 'GVL_Test.TestULINT',
    type: 'ULINT'
  }
};
const GVLTestTIME = {
  value: 1234,
  type: {
    name: '',
    type: 'TIME'
  },
  symbol: {
    name: 'GVL_Test.TestTIME',
    type: 'TIME'
  }
};
const GVLTestTimeOfDay = {
  value: 1234,
  type: {
    name: '',
    type: 'TIME_OF_DAY'
  },
  symbol: {
    name: 'GVL_Test.TestTIME_OF_DAY',
    type: 'TIME_OF_DAY'
  }
};
const GVLTestREAL = {
  value: 1234,
  type: {
    name: '',
    type: 'REAL'
  },
  symbol: {
    name: 'GVL_Test.TestREAL',
    type: 'REAL'
  }
};
const GVLTestLREAL = {
  value: 1234,
  type: {
    name: '',
    type: 'LREAL'
  },
  symbol: {
    name: 'GVL_Test.TestLREAL',
    type: 'LREAL'
  }
};
const GVLTestDATE = {
  value: '2020-02-02',
  type: {
    name: '',
    type: 'DATE'
  },
  symbol: {
    name: 'GVL_Test.TestDATE',
    type: 'DATE'
  }
};
const GVLTestDateAndTime = {
  value: '2020-02-02 02:02:02.222',
  type: {
    name: '',
    type: 'DATE_AND_TIME'
  },
  symbol: {
    name: 'GVL_Test.TestDATE_AND_TIME',
    type: 'DATE_AND_TIME'
  }
};
const GVLTestENUM = {
  value: { name: 'Running', value: 100 },
  type: {
    name: '',
    type: 'INT',
    size: 2,
    offset: 0,
    adsDataType: 2,
    adsDataTypeStr: 'ADST_INT16',
    comment: '',
    attributes: [
      { name: 'DisplayMinValue', value: '#x8000' },
      { name: 'DisplayMaxValue', value: '#x7fff' }
    ],
    rpcMethods: [],
    arrayData: [],
    subItems: [],
    enumInfo: [
      { name: 'Disabled', value: 0 },
      { name: 'Starting', value: 50 },
      {
        name: 'Running',
        value: 100
      },
      { name: 'Stopping', value: 200 }
    ]
  },
  symbol: {
    indexGroup: 16448,
    indexOffset: 385198,
    size: 2,
    adsDataType: 2,
    adsDataTypeStr: 'ADST_INT16',
    flags: 8,
    flagsStr: ['TypeGuid'],
    arrayDimension: 0,
    nameLength: 17,
    typeLength: 10,
    commentLength: 0,
    name: 'GVL_Test.TestENUM',
    type: 'E_TestEnum',
    comment: '',
    arrayData: [],
    typeGuid: '853bb1203c0bb9c43bc95d289d79ee1a',
    attributes: [],
    reserved: { type: 'Buffer', data: [0, 0, 0, 0] }
  }
};
const GVLTestSTRING = {
  value: 'Hello this is a test string',
  type: {
    name: '',
    type: 'STRING',
    size: 81,
    offset: 0,
    adsDataType: 30,
    adsDataTypeStr: 'ADST_STRING',
    comment: '',
    attributes: [],
    rpcMethods: [],
    arrayData: [],
    subItems: []
  },
  symbol: {
    indexGroup: 16448,
    indexOffset: 385046,
    size: 81,
    adsDataType: 30,
    adsDataTypeStr: 'ADST_STRING',
    flags: 8,
    flagsStr: ['TypeGuid'],
    arrayDimension: 0,
    nameLength: 19,
    typeLength: 10,
    commentLength: 0,
    name: 'GVL_Test.TestSTRING',
    type: 'STRING',
    comment: '',
    arrayData: [],
    typeGuid: '95190718000000000000000100000050',
    attributes: [],
    reserved: { type: 'Buffer', data: [0, 0] }
  }
};
const GVLTestARRAY = {
  value: [0, 10, 200, 3000, 4000],
  type: {
    name: '',
    type: 'INT',
    size: 2,
    offset: 0,
    adsDataType: 2,
    adsDataTypeStr: 'ADST_INT16',
    comment: '',
    attributes: [
      { name: 'DisplayMinValue', value: '#x8000' },
      { name: 'DisplayMaxValue', value: '#x7fff' }
    ],
    rpcMethods: [],
    arrayData: [{ startIndex: 0, length: 5 }],
    subItems: []
  },
  symbol: {
    indexGroup: 16448,
    indexOffset: 385188,
    size: 10,
    adsDataType: 2,
    adsDataTypeStr: 'ADST_INT16',
    flags: 8,
    flagsStr: ['TypeGuid'],
    arrayDimension: 0,
    nameLength: 18,
    typeLength: 19,
    commentLength: 0,
    name: 'GVL_Test.TestARRAY',
    type: 'ARRAY [0..4] OF INT',
    comment: '',
    arrayData: [],
    typeGuid: '604d5ea97c593f2a8e4aa0564cc93a32',
    attributes: [],
    reserved: { type: 'Buffer', data: [0, 0] }
  }
};
const GVLTestTimer = {
  value: { IN: false, PT: 2500, Q: false, ET: 0, M: true, StartTime: 0 },
  type: {
    name: '',
    type: 'Tc2_Standard.TON',
    size: 32,
    offset: 0,
    adsDataType: 65,
    adsDataTypeStr: 'ADST_BIGTYPE',
    comment: '',
    attributes: [],
    rpcMethods: [],
    arrayData: [],
    subItems: [
      {
        name: 'IN',
        type: 'BOOL',
        size: 1,
        offset: 8,
        adsDataType: 33,
        adsDataTypeStr: 'ADST_BIT',
        comment: ' starts timer with rising edge, resets timer with falling edge ',
        attributes: [
          { name: 'DisplayMinValue', value: '0' },
          { name: 'DisplayMaxValue', value: '1' }
        ],
        rpcMethods: [],
        arrayData: [],
        subItems: []
      },
      {
        name: 'PT',
        type: 'TIME',
        size: 4,
        offset: 12,
        adsDataType: 19,
        adsDataTypeStr: 'ADST_UINT32',
        comment: ' time to pass, before Q is set ',
        attributes: [],
        rpcMethods: [],
        arrayData: [],
        subItems: []
      },
      {
        name: 'Q',
        type: 'BOOL',
        size: 1,
        offset: 16,
        adsDataType: 33,
        adsDataTypeStr: 'ADST_BIT',
        comment: ' gets TRUE, delay time (PT) after a rising edge at IN ',
        attributes: [
          { name: 'DisplayMinValue', value: '0' },
          { name: 'DisplayMaxValue', value: '1' }
        ],
        rpcMethods: [],
        arrayData: [],
        subItems: []
      },
      {
        name: 'ET',
        type: 'TIME',
        size: 4,
        offset: 20,
        adsDataType: 19,
        adsDataTypeStr: 'ADST_UINT32',
        comment: ' elapsed time ',
        attributes: [],
        rpcMethods: [],
        arrayData: [],
        subItems: []
      },
      {
        name: 'M',
        type: 'BOOL',
        size: 1,
        offset: 24,
        adsDataType: 33,
        adsDataTypeStr: 'ADST_BIT',
        comment: '',
        attributes: [
          { name: 'DisplayMinValue', value: '0' },
          { name: 'DisplayMaxValue', value: '1' }
        ],
        rpcMethods: [],
        arrayData: [],
        subItems: []
      },
      {
        name: 'StartTime',
        type: 'TIME',
        size: 4,
        offset: 28,
        adsDataType: 19,
        adsDataTypeStr: 'ADST_UINT32',
        comment: '',
        attributes: [],
        rpcMethods: [],
        arrayData: [],
        subItems: []
      }
    ]
  },
  symbol: {
    indexGroup: 16448,
    indexOffset: 385504,
    size: 32,
    adsDataType: 65,
    adsDataTypeStr: 'ADST_BIGTYPE',
    flags: 8,
    flagsStr: ['TypeGuid'],
    arrayDimension: 0,
    nameLength: 18,
    typeLength: 16,
    commentLength: 0,
    name: 'GVL_Test.TestTimer',
    type: 'Tc2_Standard.TON',
    comment: '',
    arrayData: [],
    typeGuid: '999e6d563f3ae1d8b38117896beeb42b',
    attributes: [],
    reserved: { type: 'Buffer', data: [0, 0, 0, 0, 0] }
  }
};
const GVLExampleSTRUCT = {
  value: { SomeText: 'Hello ads-client', SomeReal: 3.1415927410125732, SomeDate: '2020-04-13T12:25:33.000Z' },
  type: {
    name: '',
    type: 'ST_Example',
    size: 60,
    offset: 0,
    adsDataType: 65,
    adsDataTypeStr: 'ADST_BIGTYPE',
    comment: '',
    attributes: [],
    rpcMethods: [],
    arrayData: [],
    subItems: [
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
    ]
  },
  symbol: {
    indexGroup: 16448,
    indexOffset: 385128,
    size: 60,
    adsDataType: 65,
    adsDataTypeStr: 'ADST_BIGTYPE',
    flags: 8,
    flagsStr: ['TypeGuid'],
    arrayDimension: 0,
    nameLength: 22,
    typeLength: 10,
    commentLength: 0,
    name: 'GVL_Test.ExampleSTRUCT',
    type: 'ST_Example',
    comment: '',
    arrayData: [],
    typeGuid: 'e13aa365c6331920e28111f564fc0798',
    attributes: [],
    reserved: { type: 'Buffer', data: [0, 0, 0, 0, 0, 0, 0] }
  }
};
const GVLTestARRAY2 = {
  value: [
    {
      SomeText: 'Just for demo purposes',
      SomeReal: 3.1415927410125732,
      SomeDate: '2020-04-13T12:25:33.000Z'
    },
    {
      SomeText: 'Hello ads-client',
      SomeReal: 3.1415927410125732,
      SomeDate: '2020-04-13T12:25:33.000Z'
    },
    {
      SomeText: 'Hello ads-client',
      SomeReal: 3.1415927410125732,
      SomeDate: '2020-04-13T12:25:33.000Z'
    },
    {
      SomeText: 'Hello ads-client',
      SomeReal: 3.1415927410125732,
      SomeDate: '2020-04-13T12:25:33.000Z'
    },
    { SomeText: 'Hello ads-client', SomeReal: 3.1415927410125732, SomeDate: '2020-04-13T12:25:33.000Z' }
  ],
  type: {
    name: '',
    type: 'ST_Example',
    size: 60,
    offset: 0,
    adsDataType: 65,
    adsDataTypeStr: 'ADST_BIGTYPE',
    comment: '',
    attributes: [],
    rpcMethods: [],
    arrayData: [{ startIndex: 0, length: 5 }],
    subItems: [
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
    ]
  },
  symbol: {
    indexGroup: 16448,
    indexOffset: 385200,
    size: 300,
    adsDataType: 65,
    adsDataTypeStr: 'ADST_BIGTYPE',
    flags: 8,
    flagsStr: ['TypeGuid'],
    arrayDimension: 0,
    nameLength: 19,
    typeLength: 26,
    commentLength: 0,
    name: 'GVL_Test.TestARRAY2',
    type: 'ARRAY [0..4] OF ST_Example',
    comment: '',
    arrayData: [],
    typeGuid: '146efad4ba6a260a6ccbb1a328353dac',
    attributes: [],
    reserved: { type: 'Buffer', data: [0, 0] }
  }
};
const GVLTestBadType = {
  value: 1234,
  type: {
    name: '',
    type: 'BAD_TYPE'
  },
  symbol: {
    name: 'GVL_Test.TestBadType',
    type: 'BAD_TYPE'
  }
};
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

const addValues = jest.fn();
const addFile = jest.fn();

const logger: pino.Logger = new PinoLogger();

const encryptionService: EncryptionService = new EncryptionServiceMock('', '');
const repositoryService: RepositoryService = new RepositoryServiceMock();
const proxyService: ProxyService = new ProxyService(repositoryService.proxyRepository, encryptionService);

const items: Array<OibusItemDTO> = [
  {
    id: 'id1',
    name: 'GVL_Test.TestENUM',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id1',
    name: 'GVL_Test.TestINT',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id1',
    name: 'GVL_Test.TestSTRING',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id1',
    name: 'GVL_Test.ExampleSTRUCT',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id1',
    name: 'GVL_Test.TestARRAY',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id1',
    name: 'GVL_Test.TestARRAY2',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id1',
    name: 'GVL_Test.TestTimer',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id1',
    name: 'GVL_Test.TestBadType',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id1',
    name: 'GVL_Test.TestByte',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id1',
    name: 'GVL_Test.TestWord',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id1',
    name: 'GVL_Test.TestDWord',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id1',
    name: 'GVL_Test.TestSINT',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id1',
    name: 'GVL_Test.TestUSINT',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id1',
    name: 'GVL_Test.TestUINT',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id1',
    name: 'GVL_Test.TestDINT',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id1',
    name: 'GVL_Test.TestUDINT',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id1',
    name: 'GVL_Test.TestLINT',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id1',
    name: 'GVL_Test.TestULINT',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id1',
    name: 'GVL_Test.TestTIME',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },

  {
    id: 'id1',
    name: 'GVL_Test.TestTIME_OF_DAY',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'GVL_Test.TestREAL',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'GVL_Test.TestLREAL',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'GVL_Test.TestDATE',
    connectorId: 'southId',
    settings: {},
    scanModeId: 'scanModeId1'
  },
  {
    id: 'id2',
    name: 'GVL_Test.TestDATE_AND_TIME',
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
      connect: () =>
        new Promise(resolve => {
          resolve({});
        }),
      disconnect: () =>
        new Promise(resolve => {
          resolve({});
        }),
      readSymbol: jest.fn()
    });

    south = new SouthADS(
      configuration,
      items,
      addValues,
      addFile,
      encryptionService,
      proxyService,
      repositoryService,
      logger,
      'baseFolder',
      true
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
});
