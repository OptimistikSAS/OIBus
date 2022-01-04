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
const engine = jest.mock('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.eventEmitters = {}
engine.addFile = jest.fn()
engine.addValues = jest.fn()
engine.encryptionService = { decryptText: (password) => password }
engine.logger = { error: jest.fn(), info: jest.fn(), debug: jest.fn() }

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
      endpoint: '/api/oianalytics/time-values/query',
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
          queryParamValue: '@LastCompletedDate',
        },
        {
          queryParamKey: 'to',
          queryParamValue: '@CurrentDate',
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
  }

  it('should create RestApi connector and connect', async () => {
    const southRestApi = new RestApi(restApiConfig, engine)

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

    jest.spyOn(fs, 'stat').mockImplementationOnce(() => false)
    jest.spyOn(fs, 'mkdir').mockImplementationOnce(() => false)
    databaseService.getConfig.mockReturnValueOnce(() => Promise.reject(new Error('')))
    await southRestApi.connect()

    expect(fs.stat).toHaveBeenCalled()
    expect(fs.mkdir).not.toHaveBeenCalled()

    const nowDateString = '2020-02-02T02:02:02.222Z'
    const RealDate = Date
    global.Date = jest.fn(() => new RealDate(nowDateString))
    jest.spyOn(fs, 'stat').mockImplementationOnce(() => {
      throw Error('not found exeption')
    })
    databaseService.getConfig.mockReturnValue(null)
    await southRestApi.connect()
    expect(fs.mkdir).toHaveBeenCalled()
    expect(southRestApi.lastCompletedAt).toEqual('2020-02-02T02:02:02.222Z')
    global.Date = RealDate
  })

  it('should fail to scan', async () => {
    const nowDateString = '2020-02-02T02:02:02.222Z'
    const RealDate = Date
    global.Date = jest.fn(() => new RealDate(nowDateString))

    // Test fetch status error with basic auth
    const southRestApi = new RestApi(restApiConfig, engine)
    await southRestApi.connect()
    fetch.mockReturnValue(Promise.resolve({ ok: false, status: 400, statusText: 'statusText' }))
    await southRestApi.onScanImplementation()

    expect(fetch).toHaveBeenCalledWith(
      // eslint-disable-next-line max-len
      'http://localhost:4200/api/oianalytics/time-values/query?from=2020-02-02T02%3A02%3A02.222Z&to=2020-02-02T02%3A02%3A02.222Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      { agent: null, headers: { Authorization: 'Basic dXNlcjpwYXNzd29yZA==' }, method: 'GET', timeout: 1000 },
    )
    // eslint-disable-next-line max-len
    expect(southRestApi.logger.info).toHaveBeenCalledWith('Requesting data with Basic authentication and GET method: http://localhost:4200/api/oianalytics/time-values/query?from=2020-02-02T02%3A02%3A02.222Z&to=2020-02-02T02%3A02%3A02.222Z&aggregation=RAW_VALUES&data-reference=SP_003_X')
    expect(southRestApi.logger.error).toHaveBeenCalledWith('{"responseError":true,"statusCode":400,"error":{}}')

    // Test fetch error and bearer auth
    southRestApi.logger.error.mockClear()
    fetch.mockClear()
    fetch.mockReturnValue(Promise.reject(new Error()))
    southRestApi.authentication.type = 'Bearer'
    southRestApi.authentication.token = 'myToken'
    await southRestApi.onScanImplementation()
    expect(fetch).toHaveBeenCalledWith(
      // eslint-disable-next-line max-len
      'http://localhost:4200/api/oianalytics/time-values/query?from=2020-02-02T02%3A02%3A02.222Z&to=2020-02-02T02%3A02%3A02.222Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
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
    await southRestApi.onScanImplementation()
    expect(fetch).toHaveBeenCalledWith(
      // eslint-disable-next-line max-len
      'http://localhost:4200/api/oianalytics/time-values/query?from=2020-02-02T02%3A02%3A02.222Z&to=2020-02-02T02%3A02%3A02.222Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
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
    await southRestApi.onScanImplementation()
    expect(fetch).toHaveBeenCalledWith(
      // eslint-disable-next-line max-len
      'http://localhost:4200/api/oianalytics/time-values/query',
      {
        agent: { },
        headers: { },
        method: 'GET',
        timeout: 1000,
      },
    )

    southRestApi.authentication.type = 'Basic'
    global.Date = RealDate
  })

  it('should successfully scan http endpoint with oianalytics time values', async () => {
    const nowDateString = '2020-02-02T02:02:02.222Z'
    const RealDate = Date
    global.Date = jest.fn(() => new RealDate(nowDateString))
    global.Date.now = jest.fn(() => new RealDate(nowDateString).getTime())

    const endpointResult = [{
      dataReference: 'dataReference',
      unit: 'g/L',
      values: [{
        timestamp: '2020-01-01T00:00:00Z',
        value: 1,
      }, {
        timestamp: '2020-01-02T00:00:00Z',
        value: 2,
      }],
    }]
    const southRestApi = new RestApi(restApiConfig, engine)
    await southRestApi.connect()
    fetch.mockReturnValue(Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'statusText',
      json: () => new Promise((resolve) => {
        resolve(endpointResult)
      }),
    }))
    await southRestApi.onScanImplementation()

    // eslint-disable-next-line max-len
    expect(southRestApi.logger.info).toHaveBeenCalledWith('Requesting data with Basic authentication and GET method: http://localhost:4200/api/oianalytics/time-values/query?from=2020-02-02T02%3A02%3A02.222Z&to=2020-02-02T02%3A02%3A02.222Z&aggregation=RAW_VALUES&data-reference=SP_003_X')
    expect(csv.unparse).toHaveBeenCalledWith(
      [{ pointId: 'dataReference', timestamp: '2020-01-01T00:00:00Z', unit: 'g/L', value: 1 },
        { pointId: 'dataReference', timestamp: '2020-01-02T00:00:00Z', unit: 'g/L', value: 2 }],
      { delimiter: ',', header: true },
    )

    // Test Raw parser with compression
    southRestApi.payloadParser = 'Raw'
    southRestApi.compression = true
    southRestApi.compress = jest.fn()
    await southRestApi.onScanImplementation()
    expect(csv.unparse).toHaveBeenCalledWith(endpointResult, { delimiter: ',', header: true })
    expect(southRestApi.compress).toHaveBeenCalled()

    // Test Raw parser with file write error
    jest.spyOn(fs, 'writeFile').mockImplementationOnce(() => {
      throw new Error('test during compression')
    })
    southRestApi.setConfig = jest.fn()
    await southRestApi.onScanImplementation()
    expect(southRestApi.setConfig).not.toHaveBeenCalled()

    // Test Raw parser with addValues
    southRestApi.convertToCsv = false
    southRestApi.addValues = jest.fn()
    await southRestApi.onScanImplementation()
    expect(southRestApi.addValues).toHaveBeenCalled()

    southRestApi.compression = false
    southRestApi.payloadParser = 'SLIMS'
    await southRestApi.onScanImplementation()
    // TODO: test when implemented

    southRestApi.payloadParser = 'Bad parser'
    await southRestApi.onScanImplementation()
    expect(southRestApi.logger.error).toHaveBeenCalledWith('Could not format the results with parser "Bad parser"')
    global.Date = RealDate
  })
})
