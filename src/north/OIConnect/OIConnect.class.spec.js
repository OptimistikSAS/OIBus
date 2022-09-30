const fs = require('node:fs/promises')

const OIConnect = require('./OIConnect.class')

const { defaultConfig: config } = require('../../../tests/testConfig')

// Mock fs
jest.mock('node:fs/promises')

// Mock OIBusEngine
const engine = {
  configService: { getConfig: () => ({ engineConfig: config.engine }) },
  cacheFolder: './cache',
  requestService: { httpSend: jest.fn() },
}

// Mock services
jest.mock('../../services/database.service')
jest.mock('../../engine/logger/Logger.class')
jest.mock('../../services/status.service.class')
jest.mock('../../services/EncryptionService.class', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))
jest.mock('../../engine/cache/ValueCache.class')
jest.mock('../../engine/cache/FileCache.class')

const nowDateString = '2020-02-02T02:02:02.222Z'
let settings = null
let north = null

describe('North OIConnect', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    settings = {
      id: 'northId',
      name: 'oic',
      api: 'OIConnect',
      enabled: false,
      OIConnect: {
        authentication: { password: '', type: 'Basic', username: '' },
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
        archive: {
          enabled: true,
          retentionDuration: 720,
        },
      },
      subscribedTo: [],
    }
    north = new OIConnect(settings, engine)
    await north.init()
  })

  it('should be properly initialized', () => {
    expect(north.canHandleFiles).toBeTruthy()
    expect(north.canHandleFiles).toBeTruthy()
  })

  it('should properly handle values in non verbose mode', async () => {
    const values = [
      {
        pointId: 'pointId',
        timestamp: nowDateString,
        data: { value: 666, quality: 'good' },
      },
    ]
    await north.handleValues(values)

    const expectedUrl = 'http://hostname:2223/addValues?name=OIBus:oic'
    const expectedAuthentication = settings.OIConnect.authentication
    const expectedBody = JSON.stringify(values)
    const expectedHeaders = { 'Content-Type': 'application/json' }

    expect(engine.requestService.httpSend).toHaveBeenCalledWith(expectedUrl, 'POST', expectedAuthentication, null, expectedBody, expectedHeaders)
  })

  it('should properly handle file', async () => {
    const filePath = '/path/to/file/example.file'
    jest.spyOn(fs, 'stat').mockImplementation(() => ({ size: 666 }))

    await north.handleFile(filePath)

    const expectedUrl = 'http://hostname:2223/addFile?name=OIBus:oic'
    const expectedAuthentication = settings.OIConnect.authentication
    expect(engine.requestService.httpSend).toHaveBeenCalledWith(expectedUrl, 'POST', expectedAuthentication, null, filePath)
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
