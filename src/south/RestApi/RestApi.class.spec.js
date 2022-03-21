const fs = require('fs/promises')
const fetch = require('node-fetch')
const csv = require('papaparse')

const RestApi = require('./RestApi.class')
const databaseService = require('../../services/database.service')
const config = require('../../config/defaultConfig.json')

// Mock node-fetch
jest.mock('node-fetch')

// Mock fs
jest.mock('fs/promises', () => ({
  stat: jest.fn(() => new Promise((resolve) => {
    resolve(true)
  })),
  mkdir: jest.fn(() => new Promise((resolve) => {
    resolve('fileContent')
  })),
  writeFile: jest.fn(() => new Promise((resolve) => {
    resolve(true)
  })),
}))

jest.mock('papaparse', () => ({ unparse: jest.fn() }))
jest.mock('https', () => ({ Agent: jest.fn() }))

// Mock logger
jest.mock('../../engine/logger/Logger.class')

// Mock engine
const engine = jest.mock('../../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.getCacheFolder = () => config.engine.caching.cacheFolder
engine.eventEmitters = {}
engine.addFile = jest.fn()
engine.addValues = jest.fn()
engine.encryptionService = { decryptText: (password) => password }

// Mock database service
jest.mock('../../services/database.service', () => ({
  createConfigDatabase: jest.fn(() => 'configDatabase'),
  getConfig: jest.fn((_database, _key) => '1587640141001.0'),
  upsertConfig: jest.fn(),
}))

beforeEach(() => {
  jest.resetAllMocks()
  jest.clearAllMocks()
})

describe('RestAPI south', () => {
  const restApiConfig = {
    id: 'restApiId',
    name: 'RestAPI',
    enabled: true,
    protocol: 'RestAPI',
    RestApi: {
      port: 4200,
      connectionTimeout: 1000,
      requestTimeout: 1000,
      host: 'http://localhost',
      compression: false,
      requestMethod: 'GET',
      endpoint: '/api/oianalytics/data/values/query',
      delimiter: ',',
      dateFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
      fileName: 'rast-api-results_@CurrentDate.csv',
      timeColumn: 'timestamp',
      timezone: 'Europe/Paris',
      authentication: {
        username: 'user',
        password: 'password',
        type: 'Basic',
      },
      queryParams: [
        {
          queryParamKey: 'from',
          queryParamValue: '@StartTime',
        },
        {
          queryParamKey: 'to',
          queryParamValue: '@EndTime',
        },
        {
          queryParamKey: 'aggregation',
          queryParamValue: 'RAW_VALUES',
        },
        {
          queryParamKey: 'data-reference',
          queryParamValue: 'SP_003_X',
        },
      ],
      acceptSelfSigned: false,
      convertToCsv: true,
      payloadParser: 'OIAnalytics time values',
    },
    scanMode: 'every10Seconds',
  }

  it('should call mkdir', async () => {
    const southRestApi = new RestApi(restApiConfig, engine)

    jest.spyOn(fs, 'stat').mockImplementationOnce(() => false)
    jest.spyOn(fs, 'mkdir').mockImplementationOnce(() => false)
    await southRestApi.init()
    expect(fs.stat).toHaveBeenCalled()
    expect(fs.mkdir).not.toHaveBeenCalled()
  })

  it('should create RestApi connector and connect', async () => {
    const nowDateString = '2020-02-02T02:02:02.222Z'
    const RealDate = Date
    global.Date = jest.fn(() => new RealDate(nowDateString))
    databaseService.getConfig.mockReturnValue(null)

    const southRestApi = new RestApi(restApiConfig, engine)
    await southRestApi.init()

    expect(southRestApi.requestMethod)
      .toEqual(restApiConfig.RestApi.requestMethod)
    expect(southRestApi.host)
      .toEqual(restApiConfig.RestApi.host)
    expect(southRestApi.port)
      .toEqual(restApiConfig.RestApi.port)
    expect(southRestApi.endpoint)
      .toEqual(restApiConfig.RestApi.endpoint)
    expect(southRestApi.queryParams)
      .toEqual(restApiConfig.RestApi.queryParams)
    expect(southRestApi.authentication)
      .toEqual(restApiConfig.RestApi.authentication)
    expect(southRestApi.connectionTimeout)
      .toEqual(restApiConfig.RestApi.connectionTimeout)
    expect(southRestApi.requestTimeout)
      .toEqual(restApiConfig.RestApi.requestTimeout)
    expect(southRestApi.fileName)
      .toEqual(restApiConfig.RestApi.fileName)
    expect(southRestApi.compression)
      .toEqual(restApiConfig.RestApi.compression)
    expect(southRestApi.delimiter)
      .toEqual(restApiConfig.RestApi.delimiter)
    expect(southRestApi.dateFormat)
      .toEqual(restApiConfig.RestApi.dateFormat)
    expect(southRestApi.timeColumn)
      .toEqual(restApiConfig.RestApi.timeColumn)
    expect(southRestApi.acceptSelfSigned)
      .toEqual(restApiConfig.RestApi.acceptSelfSigned)
    expect(southRestApi.payloadParser)
      .toEqual(restApiConfig.RestApi.payloadParser)
    expect(southRestApi.convertToCsv)
      .toEqual(restApiConfig.RestApi.convertToCsv)
    expect(southRestApi.canHandleHistory)
      .toEqual(true)
    expect(southRestApi.handlesFiles)
      .toEqual(true)

    await southRestApi.connect()
    expect(southRestApi.lastCompletedAt[restApiConfig.scanMode]).toEqual(new Date('2020-02-02T02:02:02.222Z'))
    global.Date = RealDate
  })

  it('should fail to scan', async () => {
    // Test fetch status error with basic auth
    const southRestApi = new RestApi(restApiConfig, engine)
    await southRestApi.init()
    await southRestApi.connect()
    fetch.mockReturnValue(Promise.resolve({ ok: false, status: 400, statusText: 'statusText' }))
    await southRestApi.historyQuery(restApiConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(fetch).toHaveBeenCalledWith(
      // eslint-disable-next-line max-len
      'http://localhost:4200/api/oianalytics/data/values/query?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      { agent: null, headers: { Authorization: 'Basic dXNlcjpwYXNzd29yZA==' }, method: 'GET', timeout: 1000 },
    )
    // eslint-disable-next-line max-len
    expect(southRestApi.logger.info).toHaveBeenCalledWith('Requesting data with Basic authentication and GET method: http://localhost:4200/api/oianalytics/data/values/query?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X')
    expect(southRestApi.logger.error).toHaveBeenCalledWith('{"responseError":true,"statusCode":400,"error":{}}')

    // Test fetch error and bearer auth
    southRestApi.logger.error.mockClear()
    fetch.mockClear()
    fetch.mockReturnValue(Promise.reject(new Error()))
    southRestApi.authentication.type = 'Bearer'
    southRestApi.authentication.token = 'myToken'
    await southRestApi.historyQuery(restApiConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))
    expect(fetch).toHaveBeenCalledWith(
      // eslint-disable-next-line max-len
      'http://localhost:4200/api/oianalytics/data/values/query?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      {
        agent: null,
        headers: { Authorization: 'Bearer myToken' },
        method: 'GET',
        timeout: 1000,
      },
    )
    expect(southRestApi.logger.error).toHaveBeenCalledWith('{"responseError":false,"error":{}}')

    // Test fetch with API Key
    southRestApi.logger.error.mockClear()
    fetch.mockClear()
    fetch.mockReturnValue(Promise.reject(new Error()))
    southRestApi.authentication.type = 'API Key'
    southRestApi.authentication.key = 'myKey'
    southRestApi.authentication.secretKey = 'mySecret'
    await southRestApi.historyQuery(restApiConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))
    expect(fetch).toHaveBeenCalledWith(
      // eslint-disable-next-line max-len
      'http://localhost:4200/api/oianalytics/data/values/query?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      {
        agent: null,
        headers: { myKey: 'mySecret' },
        method: 'GET',
        timeout: 1000,
      },
    )

    // Test with no auth and no queryParams and accept self-signed certificates
    southRestApi.authentication.type = ''
    southRestApi.queryParams = []
    southRestApi.acceptSelfSigned = true
    await southRestApi.historyQuery(restApiConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))
    expect(fetch).toHaveBeenCalledWith(
      // eslint-disable-next-line max-len
      'http://localhost:4200/api/oianalytics/data/values/query',
      {
        agent: { },
        headers: { },
        method: 'GET',
        timeout: 1000,
      },
    )

    southRestApi.authentication.type = 'Basic'
  })

  it('should successfully scan http endpoint with oianalytics time values', async () => {
    const nowDateString = '2020-02-02T02:02:02.222Z'
    const RealDate = Date
    global.Date = jest.fn(() => new RealDate(nowDateString))
    global.Date.now = jest.fn(() => new RealDate(nowDateString).getTime())

    const endpointResult = [
      {
        type: 'time-values',
        unit: { id: '2', label: 'g/L' },
        data: {
          dataType: 'RAW_TIME_DATA',
          id: 'D4',
          reference: 'SP_003_X',
          description: 'Concentration O2 fermentation',
        },
        timestamps: ['2022-01-01T00:00:00Z', '2022-01-01T00:10:00Z'],
        values: [63.6414804414747, 87.2277880675425],
      },
    ]
    const southRestApi = new RestApi(restApiConfig, engine)
    await southRestApi.init()
    await southRestApi.connect()
    fetch.mockReturnValue(Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'statusText',
      json: () => new Promise((resolve) => {
        resolve(endpointResult)
      }),
    }))
    await southRestApi.historyQuery(restApiConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    // eslint-disable-next-line max-len
    expect(southRestApi.logger.info).toHaveBeenCalledWith('Requesting data with Basic authentication and GET method: http://localhost:4200/api/oianalytics/data/values/query?from=2020-02-02T02%3A02%3A02.222Z&to=2020-02-02T02%3A02%3A02.222Z&aggregation=RAW_VALUES&data-reference=SP_003_X')
    expect(csv.unparse).toHaveBeenCalledWith(
      [{ pointId: 'SP_003_X', timestamp: '2022-01-01T00:00:00Z', unit: 'g/L', value: 63.6414804414747 },
        { pointId: 'SP_003_X', timestamp: '2022-01-01T00:10:00Z', unit: 'g/L', value: 87.2277880675425 }],
      { delimiter: ',', header: true },
    )

    // Test Raw parser with compression
    southRestApi.payloadParser = 'Raw'
    southRestApi.compression = true
    southRestApi.compress = jest.fn()
    await southRestApi.historyQuery(restApiConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))
    expect(csv.unparse).toHaveBeenCalledWith(endpointResult, { delimiter: ',', header: true })
    expect(southRestApi.compress).toHaveBeenCalled()

    // Test Raw parser with file write error
    jest.spyOn(fs, 'writeFile').mockImplementationOnce(() => {
      throw new Error('test during compression')
    })
    southRestApi.setConfig = jest.fn()
    await southRestApi.historyQuery(restApiConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))
    expect(southRestApi.setConfig).not.toHaveBeenCalled()

    // Test Raw parser with addValues
    southRestApi.convertToCsv = false
    southRestApi.addValues = jest.fn()
    await southRestApi.historyQuery(restApiConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))
    expect(southRestApi.addValues).toHaveBeenCalled()

    southRestApi.compression = false
    southRestApi.payloadParser = 'SLIMS'
    await southRestApi.historyQuery(restApiConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))
    // TODO: test when implemented

    southRestApi.payloadParser = 'Bad parser'
    await southRestApi.historyQuery(restApiConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))
    expect(southRestApi.logger.error).toHaveBeenCalledWith('Parser "Bad parser" does not exist')
    global.Date = RealDate
  })
})
