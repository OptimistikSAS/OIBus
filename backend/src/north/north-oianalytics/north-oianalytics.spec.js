import fs from 'node:fs/promises'

import OIAnalytics from './north-oianalytics.ts'

import * as httpRequestStaticFunctions from '../../service/http-request-static-functions.ts'

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
jest.mock('../../service/proxy.service')
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

const proxyService = { getProxy: jest.fn() }

const nowDateString = '2020-02-02T02:02:02.222Z'
let configuration = null
let north = null

describe('NorthOIAnalytics', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    proxyService.getProxy.mockReturnValue(null)

    configuration = {
      id: 'northId',
      name: 'oia',
      enabled: false,
      type: 'OIAnalytics',
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
      settings: {
        host: 'https://hostname',
        endpoint: '/api/optimistik/data/values/upload',
        authentication: {
          type: 'Basic',
          username: 'anyuser',
          password: 'anypass',
        },
        proxy: '',
      },
      subscribedTo: [],
    }
    north = new OIAnalytics(configuration, proxyService, logger)
    await north.start()
  })

  it('should be properly initialized', () => {
    expect(north.manifest.modes.points).toBeTruthy()
    expect(north.manifest.modes.files).toBeTruthy()
    expect(north.proxyService.getProxy).toHaveBeenCalledWith('')
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

    const expectedUrl = `${configuration.settings.host}/api/oianalytics/oibus/time-values?dataSourceId=${configuration.name}`
    const expectedBody = JSON.stringify(values.map((value) => ({
      timestamp: value.timestamp,
      data: value.data,
      pointId: value.pointId,
    })))
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

  it('should properly handle files', async () => {
    const filePath = '/path/to/file/example.file'
    jest.spyOn(fs, 'stat').mockImplementation(() => ({ size: 1000 }))

    await north.handleFile(filePath)

    const expectedUrl = `${configuration.settings.host}/api/oianalytics/value-upload/file?dataSourceId=${configuration.name}`
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
