const ads = require('ads-client')

const path = require('node:path')
const ADS = require('./south-ads')

const databaseService = require('../../service/database.service')

// Mock ads client
jest.mock('ads-client')

const addValues = jest.fn()
const addFiles = jest.fn()

// Mock fs
jest.mock('node:fs/promises')

// Mock services
jest.mock('../../service/database.service')
jest.mock('../../service/logger/logger.service')
jest.mock('../../service/status.service')
jest.mock('../../service/encryption.service', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))

// Global variable used to simulate ADS library returned values
const GVLTestByte = {
  value: 1234,
  type: {
    name: '',
    type: 'BYTE',
  },
  symbol: {
    name: 'GVL_Test.TestByte',
    type: 'BYTE',
  },
}
const GVLTestWord = {
  value: 1234,
  type: {
    name: '',
    type: 'WORD',
  },
  symbol: {
    name: 'GVL_Test.TestWord',
    type: 'WORD',
  },
}
const GVLTestDWord = {
  value: 1234,
  type: {
    name: '',
    type: 'DWORD',
  },
  symbol: {
    name: 'GVL_Test.TestDWord',
    type: 'DWORD',
  },
}
const GVLTestSINT = {
  value: 1234,
  type: {
    name: '',
    type: 'SINT',
  },
  symbol: {
    name: 'GVL_Test.TestSINT',
    type: 'SINT',
  },
}
const GVLTestUSINT = {
  value: 1234,
  type: {
    name: '',
    type: 'USINT',
  },
  symbol: {
    name: 'GVL_Test.TestUSINT',
    type: 'USINT',
  },
}
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
    attributes: [{ name: 'DisplayMinValue', value: '#x8000' }, { name: 'DisplayMaxValue', value: '#x7fff' }],
    rpcMethods: [],
    arrayData: [],
    subItems: [],
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
    reserved: { type: 'Buffer', data: [0, 0, 0, 0] },
  },
}
const GVLTestUINT = {
  value: 1234,
  type: {
    name: '',
    type: 'UINT',
  },
  symbol: {
    name: 'GVL_Test.TestUINT',
    type: 'UINT',
  },
}
const GVLTestDINT = {
  value: 1234,
  type: {
    name: '',
    type: 'DINT',
  },
  symbol: {
    name: 'GVL_Test.TestDINT',
    type: 'DINT',
  },
}
const GVLTestUDINT = {
  value: 1234,
  type: {
    name: '',
    type: 'UDINT',
  },
  symbol: {
    name: 'GVL_Test.TestUDINT',
    type: 'UDINT',
  },
}
const GVLTestLINT = {
  value: 1234,
  type: {
    name: '',
    type: 'LINT',
  },
  symbol: {
    name: 'GVL_Test.TestLINT',
    type: 'LINT',
  },
}
const GVLTestULINT = {
  value: 1234,
  type: {
    name: '',
    type: 'ULINT',
  },
  symbol: {
    name: 'GVL_Test.TestULINT',
    type: 'ULINT',
  },
}
const GVLTestTIME = {
  value: 1234,
  type: {
    name: '',
    type: 'TIME',
  },
  symbol: {
    name: 'GVL_Test.TestTIME',
    type: 'TIME',
  },
}
const GVLTestTimeOfDay = {
  value: 1234,
  type: {
    name: '',
    type: 'TIME_OF_DAY',
  },
  symbol: {
    name: 'GVL_Test.TestTIME_OF_DAY',
    type: 'TIME_OF_DAY',
  },
}
const GVLTestREAL = {
  value: 1234,
  type: {
    name: '',
    type: 'REAL',
  },
  symbol: {
    name: 'GVL_Test.TestREAL',
    type: 'REAL',
  },
}
const GVLTestLREAL = {
  value: 1234,
  type: {
    name: '',
    type: 'LREAL',
  },
  symbol: {
    name: 'GVL_Test.TestLREAL',
    type: 'LREAL',
  },
}
const GVLTestDATE = {
  value: '2020-02-02',
  type: {
    name: '',
    type: 'DATE',
  },
  symbol: {
    name: 'GVL_Test.TestDATE',
    type: 'DATE',
  },
}
const GVLTestDateAndTime = {
  value: '2020-02-02 02:02:02.222',
  type: {
    name: '',
    type: 'DATE_AND_TIME',
  },
  symbol: {
    name: 'GVL_Test.TestDATE_AND_TIME',
    type: 'DATE_AND_TIME',
  },
}
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
    attributes: [{ name: 'DisplayMinValue', value: '#x8000' }, { name: 'DisplayMaxValue', value: '#x7fff' }],
    rpcMethods: [],
    arrayData: [],
    subItems: [],
    enumInfo: [{ name: 'Disabled', value: 0 }, { name: 'Starting', value: 50 }, {
      name: 'Running',
      value: 100,
    }, { name: 'Stopping', value: 200 }],
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
    reserved: { type: 'Buffer', data: [0, 0, 0, 0] },
  },
}
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
    subItems: [],
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
    reserved: { type: 'Buffer', data: [0, 0] },
  },
}
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
    attributes: [{ name: 'DisplayMinValue', value: '#x8000' }, { name: 'DisplayMaxValue', value: '#x7fff' }],
    rpcMethods: [],
    arrayData: [{ startIndex: 0, length: 5 }],
    subItems: [],
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
    reserved: { type: 'Buffer', data: [0, 0] },
  },
}
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
    subItems: [{
      name: 'IN',
      type: 'BOOL',
      size: 1,
      offset: 8,
      adsDataType: 33,
      adsDataTypeStr: 'ADST_BIT',
      comment: ' starts timer with rising edge, resets timer with falling edge ',
      attributes: [{ name: 'DisplayMinValue', value: '0' }, { name: 'DisplayMaxValue', value: '1' }],
      rpcMethods: [],
      arrayData: [],
      subItems: [],
    }, {
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
      subItems: [],
    }, {
      name: 'Q',
      type: 'BOOL',
      size: 1,
      offset: 16,
      adsDataType: 33,
      adsDataTypeStr: 'ADST_BIT',
      comment: ' gets TRUE, delay time (PT) after a rising edge at IN ',
      attributes: [{ name: 'DisplayMinValue', value: '0' }, { name: 'DisplayMaxValue', value: '1' }],
      rpcMethods: [],
      arrayData: [],
      subItems: [],
    }, {
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
      subItems: [],
    }, {
      name: 'M',
      type: 'BOOL',
      size: 1,
      offset: 24,
      adsDataType: 33,
      adsDataTypeStr: 'ADST_BIT',
      comment: '',
      attributes: [{ name: 'DisplayMinValue', value: '0' }, { name: 'DisplayMaxValue', value: '1' }],
      rpcMethods: [],
      arrayData: [],
      subItems: [],
    }, {
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
      subItems: [],
    }],
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
    reserved: { type: 'Buffer', data: [0, 0, 0, 0, 0] },
  },
}
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
    subItems: [{
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
      subItems: [],
    }, {
      name: 'SomeReal',
      type: 'REAL',
      size: 4,
      offset: 52,
      adsDataType: 4,
      adsDataTypeStr: 'ADST_REAL32',
      comment: '',
      attributes: [{ name: 'DisplayMinValue', value: '-10000' }, { name: 'DisplayMaxValue', value: '10000' }],
      rpcMethods: [],
      arrayData: [],
      subItems: [],
    }, {
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
      subItems: [],
    }],
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
    reserved: { type: 'Buffer', data: [0, 0, 0, 0, 0, 0, 0] },
  },
}
const GVLTestARRAY2 = {
  value: [{
    SomeText: 'Just for demo purposes',
    SomeReal: 3.1415927410125732,
    SomeDate: '2020-04-13T12:25:33.000Z',
  }, {
    SomeText: 'Hello ads-client',
    SomeReal: 3.1415927410125732,
    SomeDate: '2020-04-13T12:25:33.000Z',
  }, {
    SomeText: 'Hello ads-client',
    SomeReal: 3.1415927410125732,
    SomeDate: '2020-04-13T12:25:33.000Z',
  }, {
    SomeText: 'Hello ads-client',
    SomeReal: 3.1415927410125732,
    SomeDate: '2020-04-13T12:25:33.000Z',
  }, { SomeText: 'Hello ads-client', SomeReal: 3.1415927410125732, SomeDate: '2020-04-13T12:25:33.000Z' }],
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
    subItems: [{
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
      subItems: [],
    }, {
      name: 'SomeReal',
      type: 'REAL',
      size: 4,
      offset: 52,
      adsDataType: 4,
      adsDataTypeStr: 'ADST_REAL32',
      comment: '',
      attributes: [{ name: 'DisplayMinValue', value: '-10000' }, { name: 'DisplayMaxValue', value: '10000' }],
      rpcMethods: [],
      arrayData: [],
      subItems: [],
    }, {
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
      subItems: [],
    }],
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
    reserved: { type: 'Buffer', data: [0, 0] },
  },
}
const GVLTestBadType = {
  value: 1234,
  type: {
    name: '',
    type: 'BAD_TYPE',
  },
  symbol: {
    name: 'GVL_Test.TestBadType',
    type: 'BAD_TYPE',
  },
}
// End of global variables

const nowDateString = '2020-02-02T02:02:02.222Z'
let configuration = null
let south = null

describe('South ADS', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    // Mock ADS Client constructor and the used function
    ads.Client.mockReturnValue({
      connect: () => new Promise((resolve) => {
        resolve({})
      }),
      disconnect: () => new Promise((resolve) => {
        resolve()
      }),
      readSymbol: jest.fn(),
    })

    // Mock database service getConfig returned value
    databaseService.getConfig.mockReturnValue('1587640141001.0')

    configuration = {
      id: 'southId',
      name: 'ADS Test',
      type: 'ADS',
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
            fields: 'SomeReal,SomeDate',
          },
          {
            name: 'Tc2_Standard.TON',
            fields: '*',
          },
        ],
      },
      points: [
        {
          pointId: 'GVL_Test.TestENUM',
          scanMode: 'every10Seconds',
        },
        {
          pointId: 'GVL_Test.TestINT',
          scanMode: 'every10Seconds',
        },
        {
          pointId: 'GVL_Test.TestSTRING',
          scanMode: 'every10Seconds',
        },
        {
          pointId: 'GVL_Test.ExampleSTRUCT',
          scanMode: 'everySecond',
        },
        {
          pointId: 'GVL_Test.TestARRAY',
          scanMode: 'every10Seconds',
        },
        {
          pointId: 'GVL_Test.TestARRAY2',
          scanMode: 'every10Seconds',
        },
        {
          pointId: 'GVL_Test.TestTimer',
          scanMode: 'every10Seconds',
        },
        {
          pointId: 'GVL_Test.TestBadType',
          scanMode: 'every1Hour',
        },
        {
          pointId: 'GVL_Test.TestByte',
          scanMode: 'every3Hours',
        },
        {
          pointId: 'GVL_Test.TestWord',
          scanMode: 'every3Hours',
        },
        {
          pointId: 'GVL_Test.TestDWord',
          scanMode: 'every3Hours',
        },
        {
          pointId: 'GVL_Test.TestSINT',
          scanMode: 'every3Hours',
        },
        {
          pointId: 'GVL_Test.TestUSINT',
          scanMode: 'every3Hours',
        },
        {
          pointId: 'GVL_Test.TestUINT',
          scanMode: 'every3Hours',
        },
        {
          pointId: 'GVL_Test.TestDINT',
          scanMode: 'every3Hours',
        },
        {
          pointId: 'GVL_Test.TestUDINT',
          scanMode: 'every3Hours',
        },
        {
          pointId: 'GVL_Test.TestLINT',
          scanMode: 'every3Hours',
        },
        {
          pointId: 'GVL_Test.TestULINT',
          scanMode: 'every3Hours',
        },
        {
          pointId: 'GVL_Test.TestTIME',
          scanMode: 'every3Hours',
        },
        {
          pointId: 'GVL_Test.TestTIME_OF_DAY',
          scanMode: 'every3Hours',
        },
        {
          pointId: 'GVL_Test.TestREAL',
          scanMode: 'every3Hours',
        },
        {
          pointId: 'GVL_Test.TestLREAL',
          scanMode: 'every3Hours',
        },
        {
          pointId: 'GVL_Test.TestDATE',
          scanMode: 'every3Hours',
        },
        {
          pointId: 'GVL_Test.TestDATE_AND_TIME',
          scanMode: 'every3Hours',
        },
      ],
    }
    south = new ADS(configuration, addValues, addFiles)
    await south.start('baseFolder', 'oibusName', {})
  })

  it('should be properly initialized', () => {
    expect(south.netId).toEqual(configuration.settings.netId)
    expect(south.port).toEqual(configuration.settings.port)
  })

  it('should properly connect to a remote instance', async () => {
    await south.connect()
    expect(databaseService.createConfigDatabase).toBeCalledWith(path.resolve(`baseFolder/south-${south.id}/cache.db`))
    expect(south.connected).toBeTruthy()
    expect(ads.Client).toHaveBeenCalledWith({
      autoReconnect: false,
      localAdsPort: 32750,
      localAmsNetId: '10.211.55.2.1.1',
      routerAddress: '10.211.55.3',
      routerTcpPort: 48898,
      targetAdsPort: 851,
      targetAmsNetId: '10.211.55.3.1.1',
    })
  })

  it('should properly connect to a locale instance', async () => {
    south.netId = '127.0.0.1.1.1'
    south.clientAmsNetId = null
    south.clientAdsPort = null
    south.routerAddress = null
    south.routerTcpPort = null
    await south.connect()
    expect(databaseService.createConfigDatabase).toBeCalledWith(path.resolve(`baseFolder/south-${south.id}/cache.db`))
    expect(south.connected).toBeTruthy()
    expect(ads.Client).toHaveBeenCalledWith({
      autoReconnect: false,
      targetAdsPort: 851,
      targetAmsNetId: '127.0.0.1.1.1',
    })
  })

  it('should retry to connect in case of failure', async () => {
    ads.Client.mockReturnValue({
      connect: () => new Promise((resolve, reject) => {
        reject()
      }),

    })
    await south.connect()

    expect(south.connected).toBeFalsy()
    expect(south.logger.error).toBeCalledTimes(1)
    expect(south.reconnectTimeout).not.toBeUndefined()
  })

  it('should properly query last points', async () => {
    await south.connect()

    south.connected = true
    south.client = { readSymbol: jest.fn() }
    south.client.readSymbol.mockReturnValueOnce(new Promise((resolve) => {
      resolve(GVLTestENUM)
    }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestINT)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestSTRING)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestARRAY)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestARRAY2)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestTimer)
      }))

    await south.lastPointQuery('every10Seconds')
    jest.runOnlyPendingTimers()

    expect(south.client.readSymbol).toBeCalledWith('GVL_Test.TestENUM')
    expect(south.client.readSymbol).toBeCalledWith('GVL_Test.TestINT')
    expect(south.client.readSymbol).toBeCalledWith('GVL_Test.TestSTRING')
    expect(south.client.readSymbol).toBeCalledWith('GVL_Test.TestARRAY')
    expect(south.client.readSymbol).toBeCalledWith('GVL_Test.TestARRAY2')
    expect(south.client.readSymbol).toBeCalledWith('GVL_Test.TestTimer')

    expect(south.client.readSymbol).toBeCalledTimes(6) // two points are set in the config with every10Seconds scan mode
    expect(south.logger.error).toBeCalledTimes(0)

    // Test boolean value as integer
    expect(addValues).toHaveBeenCalledWith(
      configuration.id,
      [
        {
          pointId: 'PLC_TEST.GVL_Test.TestENUM',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: 'Running' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestINT',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '1234' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestSTRING',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: 'Hello this is a test string' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY.0',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '0' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY.1',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '10' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY.2',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '200' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY.3',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3000' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY.4',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '4000' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.0.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.0.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-04-13T12:25:33.000Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.1.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.1.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-04-13T12:25:33.000Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.2.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.2.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-04-13T12:25:33.000Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.3.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.3.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-04-13T12:25:33.000Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.4.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.4.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-04-13T12:25:33.000Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestTimer.IN',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '0' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestTimer.PT',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2500' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestTimer.Q',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '0' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestTimer.ET',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '0' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestTimer.M',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '1' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestTimer.StartTime',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '0' },
        },
      ],
    )

    south.client.readSymbol.mockReturnValueOnce(new Promise((resolve) => {
      resolve(GVLExampleSTRUCT)
    }))

    await south.lastPointQuery('everySecond')

    expect(south.client.readSymbol).toBeCalledWith('GVL_Test.ExampleSTRUCT')
    expect(south.logger.error).toBeCalledTimes(0)
    // The SomeText field is not called because not specified in the structure filtering config
    expect(addValues).not.toHaveBeenCalledWith(
      configuration.id,
      [{ pointId: 'PLC_TEST.GVL_Test.ExampleSTRUCT.SomeText', timestamp: nowDateString, data: { value: 'Hello ads-client' } }],
    )

    south.structureFiltering = [
      {
        name: 'Tc2_Standard.TON',
        fields: '*',
      },
    ]

    south.client.readSymbol.mockReturnValueOnce(new Promise((resolve) => { resolve(GVLExampleSTRUCT) }))
    await south.lastPointQuery('everySecond')

    expect(south.logger.debug).toHaveBeenCalledWith('Data Structure ST_Example not parsed for data '
        + 'PLC_TEST.GVL_Test.ExampleSTRUCT. To parse it, please specify it in the connector settings.')

    south.boolAsText = 'Text'
    south.enumAsText = 'Integer'

    south.client.readSymbol.mockReturnValueOnce(new Promise((resolve) => { resolve(GVLTestENUM) }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestINT)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestSTRING)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestARRAY)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestARRAY2)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestTimer)
      }))
    await south.lastPointQuery('every10Seconds')

    // Test boolean value as text
    expect(addValues).toHaveBeenCalledWith(
      configuration.id,
      [
        {
          pointId: 'PLC_TEST.GVL_Test.TestENUM',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: 'Running' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestINT',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '1234' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestSTRING',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: 'Hello this is a test string' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY.0',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '0' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY.1',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '10' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY.2',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '200' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY.3',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3000' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY.4',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '4000' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.0.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.0.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-04-13T12:25:33.000Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.1.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.1.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-04-13T12:25:33.000Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.2.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.2.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-04-13T12:25:33.000Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.3.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.3.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-04-13T12:25:33.000Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.4.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.4.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-04-13T12:25:33.000Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestTimer.IN',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '0' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestTimer.PT',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2500' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestTimer.Q',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '0' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestTimer.ET',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '0' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestTimer.M',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '1' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestTimer.StartTime',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '0' },
        },
      ],
    )
    // Test enum value as integer
    expect(addValues).toHaveBeenCalledWith(
      configuration.id,
      [
        {
          pointId: 'PLC_TEST.GVL_Test.TestENUM',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: 'Running' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestINT',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '1234' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestSTRING',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: 'Hello this is a test string' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY.0',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '0' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY.1',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '10' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY.2',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '200' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY.3',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3000' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY.4',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '4000' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.0.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.0.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-04-13T12:25:33.000Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.1.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.1.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-04-13T12:25:33.000Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.2.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.2.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-04-13T12:25:33.000Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.3.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.3.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-04-13T12:25:33.000Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.4.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.4.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-04-13T12:25:33.000Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestTimer.IN',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '0' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestTimer.PT',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2500' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestTimer.Q',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '0' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestTimer.ET',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '0' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestTimer.M',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '1' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestTimer.StartTime',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '0' },
        },
      ],
    )

    south.client.readSymbol.mockReturnValueOnce(new Promise((resolve) => {
      resolve(GVLTestBadType)
    }))
    await south.lastPointQuery('every1Hour')
    expect(south.logger.warn).toHaveBeenCalledWith('dataType BAD_TYPE not supported yet for point PLC_TEST.GVL_Test.TestBadType. Value was 1234')

    // Tests other data types
    south.client.readSymbol.mockReturnValueOnce(new Promise((resolve) => {
      resolve(GVLTestByte)
    }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestWord)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestDWord)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestSINT)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestUSINT)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestUINT)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestDINT)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestUDINT)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestLINT)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestULINT)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestTIME)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestTimeOfDay)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestREAL)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestLREAL)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestDATE)
      }))
      .mockReturnValueOnce(new Promise((resolve) => {
        resolve(GVLTestDateAndTime)
      }))

    addValues.mockClear()
    await south.lastPointQuery('every3Hours')
    jest.runOnlyPendingTimers()

    expect(addValues).toHaveBeenCalledTimes(1)
  })

  it('should not read when no point for scan mode', async () => {
    await south.connect()
    await expect(south.lastPointQuery('every5Seconds'))
      .rejects.toThrowError('lastPointQuery ignored: no points to read for scanMode: "every5Seconds".')
    expect(south.client.readSymbol).toBeCalledTimes(0)
  })

  it('should catch errors on last points query', async () => {
    south.connected = true
    south.client = { readSymbol: jest.fn() }
    south.client.readSymbol.mockReturnValueOnce(new Promise((resolve, reject) => {
      reject(new Error('readError'))
    })).mockReturnValue(new Promise((resolve, reject) => {
      const error = new Error('connectionError')
      error.message = 'Client is not connected'
      reject(error)
    }))
    let readError
    try {
      await south.lastPointQuery('every10Seconds')
    } catch (error) {
      readError = error
    }

    expect(readError).toEqual(new Error('readError'))

    south.disconnect = jest.fn()
    south.connect = jest.fn()
    await south.lastPointQuery('every10Seconds')
    expect(south.disconnect).toHaveBeenCalledTimes(1)
    expect(south.logger.error).toHaveBeenCalledWith('ADS client disconnected. Reconnecting')
    expect(south.connect).not.toHaveBeenCalled()
    jest.advanceTimersByTime(configuration.settings.retryInterval)
    expect(south.connect).toHaveBeenCalledTimes(1)
  })

  it('should properly disconnect and clearTimeout', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    south.connected = true
    south.client = { readSymbol: jest.fn(), disconnect: jest.fn(), connection: { connected: true } }
    south.client.disconnect.mockReturnValue(new Promise((resolve) => {
      resolve()
    }))

    south.reconnectTimeout = true
    await south.disconnect()
    expect(south.connected).toBeFalsy()
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
  })

  it('should properly disconnect when client does not exists', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    south.connected = true
    south.client = { readSymbol: jest.fn(), disconnect: jest.fn(), connection: { connected: true } }
    south.client.disconnect.mockReturnValue(new Promise((resolve, reject) => {
      reject(new Error('disconnection error'))
    }))
    await south.disconnect()
    expect(south.connected).toBeFalsy()
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(0)
    expect(south.logger.error).toHaveBeenCalledWith('ADS disconnect error')
  })

  it('should properly disconnect when client throw an error', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    south.connected = true
    await south.disconnect()
    expect(south.connected).toBeFalsy()
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(0)
  })

  it('disconnect should do nothing if not connected', async () => {
    south.connected = false

    const disconnect = jest.fn()
    south.client = { disconnect }
    south.client.disconnect.mockReturnValue(new Promise((resolve) => {
      resolve()
    }))
    await south.disconnect()

    expect(south.connected).toBeFalsy()
    expect(disconnect).not.toBeCalled()
  })
})
