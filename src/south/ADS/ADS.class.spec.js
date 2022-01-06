const ads = require('ads-client')
const ADS = require('./ADS.class')
const databaseService = require('../../services/database.service')
const config = require('../../../tests/testConfig').default
const EncryptionService = require('../../services/EncryptionService.class')

// Mock ads client
jest.mock('ads-client')

// Mock database service
jest.mock('../../services/database.service', () => ({
  createConfigDatabase: jest.fn(() => 'configDatabase'),
  getConfig: jest.fn((_database, _key) => '1587640141001.0'),
  upsertConfig: jest.fn(),
}))

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock logger
jest.mock('../../engine/logger/Logger.class')

// Mock engine
const engine = jest.mock('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.addValues = jest.fn()
engine.eventEmitters = {}

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
const nowDateString = '2020-02-02T02:02:02.222Z'
// End of global variables

const adsConfig = config.south.dataSources[9]
let adsSouth = null

beforeEach(async () => {
  jest.resetAllMocks()
  jest.useFakeTimers()
  // Mock ads Client constructor and the used function
  ads.Client.mockReturnValue({
    connect: () => new Promise((resolve) => {
      resolve({})
    }),
    disconnect: () => new Promise((resolve) => {
      resolve()
    }),
    readSymbol: jest.fn(), // () => new Promise((resolve) => resolve()),
  })
  databaseService.getConfig.mockReturnValue('1587640141001.0')
  adsSouth = new ADS(adsConfig, engine)
  await adsSouth.init()
})

describe('ADS south', () => {
  it('should be properly initialized', () => {
    expect(adsSouth.netId)
      .toEqual(adsConfig.ADS.netId)
    expect(adsSouth.port)
      .toEqual(adsConfig.ADS.port)
  })

  it('should properly connect', async () => {
    await adsSouth.connect()
    expect(databaseService.createConfigDatabase)
      .toBeCalledWith(`${config.engine.caching.cacheFolder}/${adsConfig.id}.db`)

    expect(adsSouth.connected)
      .toBeTruthy()

    expect(adsSouth.reconnectTimeout).toBe(null)
  })

  it('should retry to connect in case of failure', async () => {
    adsSouth.client = {
      connect: () => new Promise((resolve, reject) => {
        reject()
      }),
    }
    await adsSouth.connectToAdsServer()

    expect(adsSouth.connected)
      .toBeFalsy()

    expect(adsSouth.logger.error)
      .toBeCalledTimes(1)

    expect(adsSouth.reconnectTimeout).not.toBe(null)
  })

  it('should properly read onScan', async () => {
    jest.useFakeTimers()
    const RealDate = Date
    global.Date = jest.fn(() => new RealDate(nowDateString))

    adsSouth.connected = true
    adsSouth.client = { readSymbol: jest.fn() }
    adsSouth.client.readSymbol.mockReturnValueOnce(new Promise((resolve) => {
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

    await adsSouth.onScanImplementation('every10Seconds')
    jest.runOnlyPendingTimers()

    expect(adsSouth.client.readSymbol).toBeCalledWith('GVL_Test.TestENUM')
    expect(adsSouth.client.readSymbol).toBeCalledWith('GVL_Test.TestINT')
    expect(adsSouth.client.readSymbol).toBeCalledWith('GVL_Test.TestSTRING')
    expect(adsSouth.client.readSymbol).toBeCalledWith('GVL_Test.TestARRAY')
    expect(adsSouth.client.readSymbol).toBeCalledWith('GVL_Test.TestARRAY2')
    expect(adsSouth.client.readSymbol).toBeCalledWith('GVL_Test.TestTimer')

    expect(adsSouth.client.readSymbol)
      .toBeCalledTimes(6) // two points are set in the config with every10Seconds scan mode
    expect(adsSouth.logger.error)
      .toBeCalledTimes(0)

    // Test boolean value as integer
    expect(engine.addValues)
      .toHaveBeenCalledWith(
        'datasource-uuid-10',
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
            data: { value: '2020-02-02T02:02:02.222Z' },
          },
          {
            pointId: 'PLC_TEST.GVL_Test.TestARRAY2.1.SomeReal',
            timestamp: '2020-02-02T02:02:02.222Z',
            data: { value: '3.1415927410125732' },
          },
          {
            pointId: 'PLC_TEST.GVL_Test.TestARRAY2.1.SomeDate',
            timestamp: '2020-02-02T02:02:02.222Z',
            data: { value: '2020-02-02T02:02:02.222Z' },
          },
          {
            pointId: 'PLC_TEST.GVL_Test.TestARRAY2.2.SomeReal',
            timestamp: '2020-02-02T02:02:02.222Z',
            data: { value: '3.1415927410125732' },
          },
          {
            pointId: 'PLC_TEST.GVL_Test.TestARRAY2.2.SomeDate',
            timestamp: '2020-02-02T02:02:02.222Z',
            data: { value: '2020-02-02T02:02:02.222Z' },
          },
          {
            pointId: 'PLC_TEST.GVL_Test.TestARRAY2.3.SomeReal',
            timestamp: '2020-02-02T02:02:02.222Z',
            data: { value: '3.1415927410125732' },
          },
          {
            pointId: 'PLC_TEST.GVL_Test.TestARRAY2.3.SomeDate',
            timestamp: '2020-02-02T02:02:02.222Z',
            data: { value: '2020-02-02T02:02:02.222Z' },
          },
          {
            pointId: 'PLC_TEST.GVL_Test.TestARRAY2.4.SomeReal',
            timestamp: '2020-02-02T02:02:02.222Z',
            data: { value: '3.1415927410125732' },
          },
          {
            pointId: 'PLC_TEST.GVL_Test.TestARRAY2.4.SomeDate',
            timestamp: '2020-02-02T02:02:02.222Z',
            data: { value: '2020-02-02T02:02:02.222Z' },
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

    adsSouth.client.readSymbol.mockReturnValueOnce(new Promise((resolve) => {
      resolve(GVLExampleSTRUCT)
    }))

    await adsSouth.onScanImplementation('everySecond')

    expect(adsSouth.client.readSymbol).toBeCalledWith('GVL_Test.ExampleSTRUCT')
    expect(adsSouth.logger.error)
      .toBeCalledTimes(0)
    // The SomeText field is not called because not specified in the structure filtering config
    expect(engine.addValues)
      .not.toHaveBeenCalledWith(
        'datasource-uuid-10',
        [{ pointId: 'PLC_TEST.GVL_Test.ExampleSTRUCT.SomeText', timestamp: nowDateString, data: { value: 'Hello ads-client' } }],
      )

    adsSouth.structureFiltering = [
      {
        name: 'Tc2_Standard.TON',
        fields: '*',
      },
    ]

    adsSouth.client.readSymbol.mockReturnValueOnce(new Promise((resolve) => {
      resolve(GVLExampleSTRUCT)
    }))
    await adsSouth.onScanImplementation('everySecond')

    expect(adsSouth.logger.debug)
      .toHaveBeenCalledWith('Data Structure ST_Example not parsed for data PLC_TEST.GVL_Test.ExampleSTRUCT. To parse it, please specify it in the connector settings.') // eslint-disable-line max-len

    adsSouth.boolAsText = 'Text'
    adsSouth.enumAsText = 'Integer'

    adsSouth.client.readSymbol.mockReturnValueOnce(new Promise((resolve) => {
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
    await adsSouth.onScanImplementation('every10Seconds')

    // Test boolean value as text
    expect(engine.addValues).toHaveBeenCalledWith(
      'datasource-uuid-10',
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
          data: { value: '2020-02-02T02:02:02.222Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.1.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.1.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-02-02T02:02:02.222Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.2.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.2.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-02-02T02:02:02.222Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.3.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.3.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-02-02T02:02:02.222Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.4.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.4.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-02-02T02:02:02.222Z' },
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
    expect(engine.addValues).toHaveBeenCalledWith(
      'datasource-uuid-10',
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
          data: { value: '2020-02-02T02:02:02.222Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.1.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.1.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-02-02T02:02:02.222Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.2.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.2.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-02-02T02:02:02.222Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.3.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.3.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-02-02T02:02:02.222Z' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.4.SomeReal',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '3.1415927410125732' },
        },
        {
          pointId: 'PLC_TEST.GVL_Test.TestARRAY2.4.SomeDate',
          timestamp: '2020-02-02T02:02:02.222Z',
          data: { value: '2020-02-02T02:02:02.222Z' },
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

    adsSouth.client.readSymbol.mockReturnValueOnce(new Promise((resolve) => {
      resolve(GVLTestBadType)
    }))
    await adsSouth.onScanImplementation('every1Hour')
    expect(adsSouth.logger.warn)
      .toHaveBeenCalledWith('dataType BAD_TYPE not supported yet for point PLC_TEST.GVL_Test.TestBadType. Value was 1234')

    // Tests other data types
    adsSouth.client.readSymbol.mockReturnValueOnce(new Promise((resolve) => {
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

    engine.addValues.mockClear()
    await adsSouth.onScanImplementation('every3Hours')
    jest.runOnlyPendingTimers()

    expect(engine.addValues)
      .toHaveBeenCalledTimes(1)

    global.Date = RealDate
  })

  it('should not read when no point', async () => {
    await adsSouth.connect()
    await adsSouth.onScanImplementation('every5Seconds')
    // no point for every5Seconds
    expect(adsSouth.client.readSymbol)
      .toBeCalledTimes(0)
  })

  it('should catch errors on scan', async () => {
    adsSouth.connected = true
    adsSouth.client = { readSymbol: jest.fn() }
    adsSouth.client.readSymbol.mockReturnValue(new Promise((resolve, reject) => {
      reject(new Error('test'))
    }))
    await adsSouth.onScanImplementation('every10Seconds')

    expect(adsSouth.logger.error)
      .toBeCalledTimes(6)
  })

  it('should properly disconnect and clearTimeout', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    adsSouth.connected = true
    adsSouth.client = { readSymbol: jest.fn(), disconnect: jest.fn() }
    adsSouth.client.disconnect.mockReturnValue(new Promise((resolve) => {
      resolve()
    }))

    adsSouth.reconnectTimeout = true
    await adsSouth.disconnect()

    expect(adsSouth.connected)
      .toBeFalsy()

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)

    await adsSouth.onScanImplementation()

    expect(adsSouth.client.readSymbol)
      .not
      .toBeCalled()
  })

  it('disconnect should do nothing if not connected', async () => {
    adsSouth.connected = false

    adsSouth.client = { disconnect: jest.fn() }
    adsSouth.client.disconnect.mockReturnValue(new Promise((resolve) => {
      resolve()
    }))
    await adsSouth.disconnect()

    expect(adsSouth.connected)
      .toBeFalsy()

    expect(adsSouth.client.disconnect)
      .not
      .toBeCalled()
  })
})
