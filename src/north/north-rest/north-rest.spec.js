import RestApi from './north-rest.js'

import * as httpRequestStaticFunctions from '../../service/http-request-static-functions.js'
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

const values = [
  {
    pointId: 'ANA/BL1RCP05',
    timestamp: '2020-02-02T02:02:02.222Z',
    data: {
      value: 666,
      quality: 'good',
    },
  },
  {
    pointId: 'ANA/CL1RCP06',
    timestamp: '2020-02-02T02:02:02.222Z',
    data: {
      value: 111,
      quality: 'good',
    },
  },
]
const map = {
  '[].pointId': '[].containerid',
  '[].timestamp': '[].values[].Time',
  '[].data.value': '[].values[].Value?',
}

let configuration = null
let north = null

describe('North RestApi', () => {
  beforeEach(async () => {
    jest.resetAllMocks()

    configuration = {
      id: 'northId',
      name: 'restapi',
      settings: {
        url: 'http://localhost:3000',
        requestMethod: 'POST',
        password: 'password',
        user: 'user',
        authType: 'Basic',
        headers: [{ key: 'header1', value: 'headerValue1' }],
        map: JSON.stringify(map),
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
    }
    north = new RestApi(configuration, {}, logger)
  })

  it('should be properly initialized', async () => {
    await north.start('baseFolder', 'oibusName')

    expect(north.manifest.modes.points).toBeTruthy()
    expect(north.manifest.modes.files).toBeFalsy()
  })

  it('should properly send data', async () => {
    await north.start('baseFolder', 'oibusName')

    await north.handleValues(values)

    const expectedUrl = configuration.settings.url
    const expectedRequestMethod = configuration.settings.requestMethod
    const expectedBody = JSON.stringify([
      {
        containerid: 'ANA/BL1RCP05',
        values: [{ Time: '2020-02-02T02:02:02.222Z', Value: 666 }],
      },
      {
        containerid: 'ANA/CL1RCP06',
        values: [{ Time: '2020-02-02T02:02:02.222Z', Value: 111 }],
      },
    ])
    const expectedHeaders = { header1: 'headerValue1' }
    expect(httpRequestStaticFunctions.httpSend).toHaveBeenCalledWith(
      expectedUrl,
      expectedRequestMethod,
      expectedHeaders,
      expectedBody,
      configuration.caching.timeout,
      null,
    )
    expect(httpRequestStaticFunctions.httpSend).toHaveBeenCalledTimes(1)
  })
})
