const fs = require('node:fs/promises')

const OIConnect = require('./north-oiconnect')

const httpRequestStaticFunctions = require('../../service/http-request-static-functions')
// Mock fs
jest.mock('node:fs/promises')

// Mock services
jest.mock('../../service/database.service')
jest.mock('../../service/status.service')
jest.mock('../../service/certificate.service')
jest.mock('../../service/encryption.service', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))
jest.mock('../../service/cache/value-cache.service')
jest.mock('../../service/cache/file-cache.service')
jest.mock('../../service/cache/archive.service')
jest.mock('../../service/utils')
jest.mock('../../service/http-request-static-functions')

// Mock logger
const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
}

const nowDateString = '2020-02-02T02:02:02.222Z'
let configuration = null
let north = null

describe('NorthOIConnect', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    configuration = {
      id: 'northId',
      name: 'oic',
      type: 'OIConnect',
      enabled: false,
      settings: {
        authentication: { secret: '', type: 'Basic', key: '' },
        timeout: 180000,
        host: 'http://hostname:2223',
        valuesEndpoint: '/addValues',
        fileEndpoint: '/addFile',
        proxy: '',
        stack: 'fetch',
      },
      caching: {
        sendInterval: 1000,
        retryInterval: 5000,
        groupCount: 10000,
        maxSendCount: 10000,
        timeout: 10,
        archive: {
          enabled: true,
          retentionDuration: 720,
        },
      },
      subscribedTo: [],
    }
    north = new OIConnect(configuration, [], logger)
    await north.start('baseFolder', 'oibusName')
  })

  it('should be properly initialized', () => {
    expect(north.canHandleFiles).toBeTruthy()
    expect(north.canHandleFiles).toBeTruthy()
  })

  it('should properly handle values', async () => {
    const values = [
      {
        pointId: 'pointId',
        timestamp: nowDateString,
        data: { value: 666, quality: 'good' },
      },
    ]
    await north.handleValues(values)

    const expectedUrl = 'http://hostname:2223/addValues?name=oibusName:oic'
    const expectedBody = JSON.stringify(values)
    const expectedHeaders = { 'Content-Type': 'application/json' }

    expect(httpRequestStaticFunctions.httpSend).toHaveBeenCalledWith(
      expectedUrl,
      'POST',
      expectedHeaders,
      expectedBody,
      configuration.caching.timeout,
      null,
    )
  })

  it('should properly handle file', async () => {
    const filePath = '/path/to/file/example.file'
    jest.spyOn(fs, 'stat').mockImplementation(() => ({ size: 666 }))

    await north.handleFile(filePath)

    const expectedUrl = 'http://hostname:2223/addFile?name=oibusName:oic'
    expect(httpRequestStaticFunctions.httpSend).toHaveBeenCalledWith(
      expectedUrl,
      'POST',
      {},
      filePath,
      configuration.caching.timeout,
      null,
    )
  })

  it('should not retry', () => {
    const error = { responseError: true, statusCode: 201 }
    const result = north.shouldRetry(error)

    expect(result).toBeFalsy()
  })

  it('should retry because of status code', () => {
    const error = { responseError: true, statusCode: 400 }
    const result = north.shouldRetry(error)

    expect(result).toBeTruthy()
  })

  it('should retry because of response error', () => {
    const error = { responseError: false }
    const result = north.shouldRetry(error)

    expect(result).toBeTruthy()
  })
})
