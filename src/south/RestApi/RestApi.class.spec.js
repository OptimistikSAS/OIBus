const fs = require('node:fs/promises')
const path = require('node:path')

const fetch = require('node-fetch')
const RestApi = require('./RestApi.class')
const utils = require('./utils')
const mainUtils = require('../../services/utils')

const databaseService = require('../../services/database.service')

const { defaultConfig: config } = require('../../../tests/testConfig')

// Mock utils class
jest.mock('./utils', () => ({
  generateCSV: jest.fn(),
  formatQueryParams: jest.fn(),
  parsers: { Raw: jest.fn() },
  httpGetWithBody: jest.fn(),
}))

// Mock utils class
jest.mock('../../services/utils', () => ({
  replaceFilenameWithVariable: jest.fn(),
  compress: jest.fn(),
  createFolder: jest.fn(),
}))

// Mock node-fetch
jest.mock('node-fetch')

// Mock fs
jest.mock('node:fs/promises')

// Mock https
jest.mock('https', () => ({ Agent: jest.fn() }))

// Mock OIBusEngine
const engine = {
  configService: { getConfig: () => ({ engineConfig: config.engine }) },
  cacheFolder: './cache',
  addValues: jest.fn(),
  addFile: jest.fn(),
}

// Mock services
jest.mock('../../services/database.service')
jest.mock('../../engine/logger/Logger.class')
jest.mock('../../services/status.service.class')
jest.mock('../../services/EncryptionService.class', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))

const nowDateString = '2020-02-02T02:02:02.222Z'
let settings = null
let south = null

describe('South Rest API', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    utils.formatQueryParams.mockReturnValue('?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z'
        + '&aggregation=RAW_VALUES&data-reference=SP_003_X')
    mainUtils.replaceFilenameWithVariable.mockReturnValue('myFile')

    settings = {
      id: 'southId',
      name: 'RestAPI',
      enabled: true,
      protocol: 'RestAPI',
      RestApi: {
        port: 4200,
        connectionTimeout: 1000,
        requestTimeout: 1000,
        host: 'localhost',
        protocol: 'http',
        compression: false,
        requestMethod: 'GET',
        endpoint: '/api/oianalytics/data/values/query',
        delimiter: ',',
        dateFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
        fileName: 'rast-api-results_@CurrentDate.csv',
        timeColumn: 'timestamp',
        timezone: 'Europe/Paris',
        variableDateFormat: 'ISO',
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
        payloadParser: 'Raw',
      },
      scanMode: 'every10Seconds',
    }
    south = new RestApi(settings, engine)
  })

  it('should create RestApi connector and connect', async () => {
    databaseService.getConfig.mockReturnValue(null)
    await south.init()

    expect(south.requestMethod).toEqual(settings.RestApi.requestMethod)
    expect(south.host).toEqual(settings.RestApi.host)
    expect(south.port).toEqual(settings.RestApi.port)
    expect(south.endpoint).toEqual(settings.RestApi.endpoint)
    expect(south.queryParams).toEqual(settings.RestApi.queryParams)
    expect(south.authentication).toEqual(settings.RestApi.authentication)
    expect(south.connectionTimeout).toEqual(settings.RestApi.connectionTimeout)
    expect(south.requestTimeout).toEqual(settings.RestApi.requestTimeout)
    expect(south.fileName).toEqual(settings.RestApi.fileName)
    expect(south.compression).toEqual(settings.RestApi.compression)
    expect(south.delimiter).toEqual(settings.RestApi.delimiter)
    expect(south.protocol).toEqual(settings.RestApi.protocol)
    expect(south.variableDateFormat).toEqual(settings.RestApi.variableDateFormat)
    expect(south.acceptSelfSigned).toEqual(settings.RestApi.acceptSelfSigned)
    expect(south.payloadParser).toEqual(settings.RestApi.payloadParser)
    expect(south.convertToCsv).toEqual(settings.RestApi.convertToCsv)
    expect(south.canHandleHistory).toEqual(true)
    expect(south.handlesFiles).toEqual(true)

    await south.connect()
    expect(south.lastCompletedAt[settings.scanMode]).toEqual(new Date('2020-02-02T02:02:02.222Z'))
  })

  it('should log error if temp folder creation fails', async () => {
    fs.mkdir = jest.fn().mockImplementation(() => {
      throw new Error('mkdir error test')
    })

    await south.init()

    expect(south.logger.error).toHaveBeenCalledWith(new Error('mkdir error test'))
  })

  it('should fail to scan', async () => {
    fetch.mockReturnValue(Promise.resolve({ ok: false, status: 400, statusText: 'statusText' }))
    await south.init()
    await south.connect()

    await expect(south.historyQuery(
      settings.scanMode,
      new Date('2019-10-03T13:36:38.590Z'),
      new Date('2019-10-03T15:36:38.590Z'),
    )).rejects.toThrowError('HTTP request failed with status code 400 and message: statusText.')

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/oianalytics/data/values/query'
        + '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      { agent: null, headers: { Authorization: 'Basic dXNlcjpwYXNzd29yZA==' }, method: 'GET', timeout: 1000 },
    )
    expect(south.logger.info).toHaveBeenCalledWith('Requesting data with Basic authentication and GET '
        + 'method: "http://localhost:4200/api/oianalytics/data/values/query'
        + '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X".')

    // Test fetch error and bearer auth
    south.logger.info.mockClear()
    fetch.mockClear()
    south.authentication.type = 'Bearer'
    south.authentication.token = 'myToken'
    await expect(south.historyQuery(
      settings.scanMode,
      new Date('2019-10-03T13:36:38.590Z'),
      new Date('2019-10-03T15:36:38.590Z'),
    )).rejects.toThrowError('HTTP request failed with status code 400 and message: statusText.')
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/oianalytics/data/values/query'
        + '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      {
        agent: null,
        headers: { Authorization: 'Bearer myToken' },
        method: 'GET',
        timeout: 1000,
      },
    )

    // Test fetch with API Key
    fetch.mockClear()
    south.authentication.type = 'API Key'
    south.authentication.key = 'myKey'
    south.authentication.secretKey = 'mySecret'
    await expect(south.historyQuery(
      settings.scanMode,
      new Date('2019-10-03T13:36:38.590Z'),
      new Date('2019-10-03T15:36:38.590Z'),
    )).rejects.toThrowError('HTTP request failed with status code 400 and message: statusText.')
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/oianalytics/data/values/query?'
        + 'from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      {
        agent: null,
        headers: { myKey: 'mySecret' },
        method: 'GET',
        timeout: 1000,
      },
    )

    // Test with no auth and accept self-signed certificates
    south.authentication.type = ''
    south.queryParams = []
    south.acceptSelfSigned = true
    await expect(south.historyQuery(
      settings.scanMode,
      new Date('2019-10-03T13:36:38.590Z'),
      new Date('2019-10-03T15:36:38.590Z'),
    )).rejects.toThrowError('HTTP request failed with status code 400 and message: statusText.')
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/oianalytics/data/values/query'
        + '?from=2019-10-03T13%3A36%3A38.590Z&to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      {
        agent: { },
        headers: { },
        method: 'GET',
        timeout: 1000,
      },
    )
  })

  it('should successfully scan http endpoint', async () => {
    utils.parsers.Raw = jest.fn((results) => ({ httpResults: results, latestDateRetrieved: new Date('2020-01-01T00:00:00.000Z') }))
    const endpointResult = [
      {
        value: 'val1',
        timestamp: new Date('2020-01-01T00:00:00.000Z'),
      },
    ]
    fetch.mockReturnValue(Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'statusText',
      json: () => new Promise((resolve) => {
        resolve(endpointResult)
      }),
    }))
    await south.init()
    await south.connect()

    await south.historyQuery(settings.scanMode, new Date('2020-01-01T00:00:00.000Z'), new Date('2021-01-01T00:00:00.000Z'))
    expect(utils.generateCSV).toHaveBeenCalledWith(endpointResult, ',')

    jest.clearAllMocks()
    // Test Raw parser with addValues
    south.convertToCsv = false
    south.addValues = jest.fn()
    south.lastCompletedAt[settings.scanMode] = new Date('2020-01-01T00:00:00.000Z')
    await south.historyQuery(settings.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))
    expect(south.addValues).toHaveBeenCalled()
    expect(south.logger.debug).toHaveBeenCalledWith('No update for lastCompletedAt. Last value: 2020-01-01T00:00:00.000Z.')

    south.payloadParser = 'Bad parser'
    await expect(south.historyQuery(
      settings.scanMode,
      new Date('2019-10-03T13:36:38.590Z'),
      new Date('2019-10-03T15:36:38.590Z'),
    )).rejects.toThrowError('Parser "Bad parser" does not exist.')
  })

  it('should return empty results', async () => {
    utils.parsers.Raw = jest.fn(() => ({ httpResults: [], latestDateRetrieved: new Date() }))
    const endpointResult = []
    fetch.mockReturnValue(Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'statusText',
      json: () => new Promise((resolve) => {
        resolve(endpointResult)
      }),
    }))
    await south.init()
    await south.connect()

    await south.historyQuery(settings.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(south.logger.debug).toHaveBeenCalledWith('No result found between 2019-10-03T13:36:38.590Z and 2019-10-03T15:36:38.590Z.')
  })

  it('should use http get with body function with self signed certificates accepted and without authentication', async () => {
    await south.init()
    await south.connect()

    south.body = '{ startTime: @StartTime, endTime: @EndTime }'
    south.acceptSelfSigned = true
    south.authentication.type = null

    await south.historyQuery(settings.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(utils.httpGetWithBody).toHaveBeenCalledWith(
      '{ startTime: 2019-10-03T13:36:38.590Z, endTime: 2019-10-03T15:36:38.590Z }',
      {
        agent: {},
        headers: {
          'Content-Length': 74,
          'Content-Type': 'application/json',
        },
        host: 'localhost',
        method: 'GET',
        path: '/api/oianalytics/data/values/query',
        port: 4200,
        protocol: 'http:',
        timeout: 1000,
      },

    )
  })

  it('should use http get with body function with ISO dates', async () => {
    await south.init()
    await south.connect()

    south.body = '{ startTime: @StartTime, endTime: @EndTime }'

    await south.historyQuery(settings.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(utils.httpGetWithBody).toHaveBeenCalledWith(
      '{ startTime: 2019-10-03T13:36:38.590Z, endTime: 2019-10-03T15:36:38.590Z }',
      {
        agent: null,
        headers: {
          Authorization: 'Basic dXNlcjpwYXNzd29yZA==',
          'Content-Length': 74,
          'Content-Type': 'application/json',
        },
        host: 'localhost',
        method: 'GET',
        path: '/api/oianalytics/data/values/query',
        port: 4200,
        protocol: 'http:',
        timeout: 1000,
      },

    )
  })

  it('should use http get with body function with numerical dates', async () => {
    await south.init()
    await south.connect()

    south.body = '{ startTime: @StartTime, endTime: @EndTime }'
    south.variableDateFormat = 'number'

    await south.historyQuery(settings.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(utils.httpGetWithBody).toHaveBeenCalledWith(
      '{ startTime: 1570109798590, endTime: 1570116998590 }',
      {
        agent: null,
        headers: {
          Authorization: 'Basic dXNlcjpwYXNzd29yZA==',
          'Content-Length': 52,
          'Content-Type': 'application/json',
        },
        host: 'localhost',
        method: 'GET',
        path: '/api/oianalytics/data/values/query',
        port: 4200,
        protocol: 'http:',
        timeout: 1000,
      },

    )
  })

  it('should use http with body and ISO dates', async () => {
    utils.parsers.Raw = jest.fn(() => ({ httpResults: [], latestDateRetrieved: new Date() }))

    fetch.mockReturnValue(Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'statusText',
      json: () => new Promise((resolve) => {
        resolve([])
      }),
    }))

    await south.init()
    await south.connect()

    south.requestMethod = 'PUT'
    south.body = '{ startTime: @StartTime, endTime: @EndTime }'

    await south.historyQuery(settings.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/oianalytics/data/values/query?from=2019-10-03T13%3A36%3A38.590Z&'
        + 'to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      {
        agent: null,
        body: '{ startTime: 2019-10-03T13:36:38.590Z, endTime: 2019-10-03T15:36:38.590Z }',
        headers: {
          Authorization: 'Basic dXNlcjpwYXNzd29yZA==',
          'Content-Length': 74,
          'Content-Type': 'application/json',
        },
        method: 'PUT',
        timeout: 1000,
      },

    )
  })

  it('should use http with body and numerical dates', async () => {
    utils.parsers.Raw = jest.fn(() => ({ httpResults: [], latestDateRetrieved: new Date() }))

    fetch.mockReturnValue(Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'statusText',
      json: () => new Promise((resolve) => {
        resolve([])
      }),
    }))

    await south.init()
    await south.connect()
    south.variableDateFormat = 'number'

    south.requestMethod = 'PUT'
    south.body = '{ startTime: @StartTime, endTime: @EndTime }'

    await south.historyQuery(settings.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4200/api/oianalytics/data/values/query?from=2019-10-03T13%3A36%3A38.590Z&'
        + 'to=2019-10-03T15%3A36%3A38.590Z&aggregation=RAW_VALUES&data-reference=SP_003_X',
      {
        agent: null,
        body: '{ startTime: 1570109798590, endTime: 1570116998590 }',
        headers: {
          Authorization: 'Basic dXNlcjpwYXNzd29yZA==',
          'Content-Length': 52,
          'Content-Type': 'application/json',
        },
        method: 'PUT',
        timeout: 1000,
      },

    )
  })

  it('should manage parsing error', async () => {
    utils.parsers.Raw = jest.fn(() => {
      throw new Error('raw parsing error')
    })
    fetch.mockReturnValue(Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'statusText',
      json: () => new Promise((resolve) => {
        resolve([])
      }),
    }))
    await south.init()
    await south.connect()

    await expect(south.historyQuery(
      settings.scanMode,
      new Date('2019-10-03T13:36:38.590Z'),
      new Date('2019-10-03T15:36:38.590Z'),
    )).rejects.toThrowError('raw parsing error')
  })

  it('should successfully create a compressed file', async () => {
    utils.parsers.Raw = jest.fn((results) => ({ httpResults: results, latestDateRetrieved: new Date() }))
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
    fetch.mockReturnValue(Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'statusText',
      json: () => new Promise((resolve) => {
        resolve(endpointResult)
      }),
    }))
    utils.generateCSV.mockReturnValue('')
    south.compression = true
    const tmpFolder = path.resolve(`cache/south-${south.settings.id}/tmp`)
    const expectedPath = path.join(tmpFolder, 'myFile')
    const expectedCompressedPath = path.join(tmpFolder, 'myFile.gz')
    const startTime = new Date('2019-10-03T13:36:38.590Z')
    const endTime = new Date('2019-10-03T15:36:38.590Z')
    await south.init()
    await south.connect()

    await south.historyQuery(settings.scanMode, startTime, endTime)
    expect(utils.generateCSV).toHaveBeenCalledWith(endpointResult, ',')
    expect(fs.writeFile).toHaveBeenCalledWith(expectedPath, '')
    expect(mainUtils.compress).toHaveBeenCalledWith(expectedPath, expectedCompressedPath)
    expect(fs.writeFile).toHaveBeenCalledWith(expectedPath, '')
    expect(fs.unlink).toHaveBeenCalledWith(expectedPath)
    expect(south.engine.addFile).toHaveBeenCalledWith('southId', expectedCompressedPath, false)

    // try again with unlink error
    jest.clearAllMocks()
    fs.unlink.mockImplementation(() => {
      throw new Error('unlink error')
    })

    await south.historyQuery(settings.scanMode, startTime, endTime)
    expect(utils.generateCSV).toBeCalledTimes(1)
    expect(fs.writeFile).toBeCalledWith(expectedPath, '')
    expect(fs.unlink).toBeCalledWith(expectedPath)
    expect(south.logger.error).toBeCalledWith(new Error('unlink error'))
    expect(mainUtils.compress).toBeCalledWith(expectedPath, expectedCompressedPath)
    expect(engine.addFile).toBeCalledWith('southId', expectedCompressedPath, false)
  })
})
