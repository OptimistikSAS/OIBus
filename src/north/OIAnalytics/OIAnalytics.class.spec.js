const fs = require('node:fs/promises')

const OIAnalytics = require('./OIAnalytics.class')

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

describe('North OIAnalytics', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    settings = {
      id: 'northId',
      name: 'oia',
      enabled: false,
      api: 'OIAnalytics',
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
      OIAnalytics: {
        host: 'https://hostname',
        endpoint: '/api/optimistik/data/values/upload',
        authentication: {
          type: 'Basic',
          username: 'anyuser',
          password: 'anypass',
        },
      },
      proxy: '',
      subscribedTo: [],
    }
    north = new OIAnalytics(settings, engine)
    await north.init()
  })

  it('should be properly initialized', () => {
    expect(north.canHandleValues).toBeTruthy()
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

    const expectedUrl = `${settings.OIAnalytics.host}/api/oianalytics/oibus/time-values?dataSourceId=${settings.name}`
    const expectedAuthentication = settings.OIAnalytics.authentication
    const expectedBody = JSON.stringify(values.map((value) => ({
      pointId: value.pointId,
      timestamp: value.timestamp,
      data: value.data,
    })))
    const expectedHeaders = { 'Content-Type': 'application/json' }
    expect(engine.requestService.httpSend).toHaveBeenCalledWith(
      expectedUrl,
      'POST',
      expectedAuthentication,
      null,
      expectedBody,
      expectedHeaders,
    )
  })

  it('should properly handle files', async () => {
    const filePath = '/path/to/file/example.file'
    jest.spyOn(fs, 'stat').mockImplementation(() => ({ size: 1000 }))

    await north.handleFile(filePath)

    const expectedUrl = `${settings.OIAnalytics.host}/api/oianalytics/value-upload/file?dataSourceId=${settings.name}`
    const expectedAuthentication = settings.OIAnalytics.authentication
    expect(engine.requestService.httpSend).toHaveBeenCalledWith(expectedUrl, 'POST', expectedAuthentication, null, filePath)
  })
})
