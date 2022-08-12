const fs = require('fs/promises')
const OIAnalytics = require('./OIAnalytics.class')
const { defaultConfig: config } = require('../../../tests/testConfig')

// Mock engine
const engine = jest.mock('../../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.requestService = { httpSend: jest.fn() }
engine.eventEmitters = {}

// Mock the logger
jest.mock('../../engine/logger/Logger.class')

let oiAnalytics = null
const timestamp = new Date().toISOString()
const oiAnalyticsConfig = {
  id: 'north-oianalytics',
  name: 'RawFileSender',
  enabled: false,
  api: 'OIAnalytics',
  caching: {
    sendInterval: 15000,
    retryInterval: 10000,
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

beforeEach(async () => {
  jest.resetAllMocks()
  jest.clearAllMocks()
  oiAnalytics = new OIAnalytics(oiAnalyticsConfig, engine)
  await oiAnalytics.init()
})

describe('OIAnalytics', () => {
  it('should be properly initialized', () => {
    expect(oiAnalytics.canHandleValues).toBeTruthy()
    expect(oiAnalytics.canHandleFiles).toBeTruthy()
  })

  it('should properly handle values', async () => {
    const values = [
      {
        pointId: 'pointId',
        timestamp,
        data: { value: 666, quality: 'good' },
        name: 'South',
      },
    ]
    await oiAnalytics.handleValues(values)

    const expectedUrl = `${oiAnalyticsConfig.OIAnalytics.host}/api/oianalytics/oibus/time-values?dataSourceId=${oiAnalyticsConfig.name}`
    const expectedAuthentication = oiAnalyticsConfig.OIAnalytics.authentication
    const expectedBody = JSON.stringify(values.map((value) => ({
      timestamp: value.timestamp,
      data: value.data,
      pointId: value.pointId,
    })))
    const expectedHeaders = { 'Content-Type': 'application/json' }
    expect(engine.requestService.httpSend).toHaveBeenCalledWith(expectedUrl, 'POST', expectedAuthentication, null, expectedBody, expectedHeaders)
  })

  it('should properly handle files', async () => {
    const filePath = '/path/to/file/example.file'
    jest.spyOn(fs, 'stat').mockImplementation(() => ({ size: 1000 }))

    await oiAnalytics.handleFile(filePath)

    const expectedUrl = `${oiAnalyticsConfig.OIAnalytics.host}/api/oianalytics/value-upload/file?dataSourceId=${oiAnalyticsConfig.name}`
    const expectedAuthentication = oiAnalyticsConfig.OIAnalytics.authentication
    expect(engine.requestService.httpSend).toHaveBeenCalledWith(expectedUrl, 'POST', expectedAuthentication, null, filePath)
  })
})
