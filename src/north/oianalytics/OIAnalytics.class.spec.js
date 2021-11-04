const fs = require('fs')
const OIAnalytics = require('./OIAnalytics.class')
const config = require('../../../tests/testConfig').default

// Mock engine
const engine = jest.createMockFromModule('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.requestService = { httpSend: jest.fn() }
engine.eventEmitters = {}

// Mock the logger
jest.mock('../../engine/Logger.class')

describe('oi-analytics', () => {
  const timestamp = new Date().toISOString()
  const oiAnalyticsConfig = config.north.applications[2]
  const oiAnalytics = new OIAnalytics(oiAnalyticsConfig, engine)

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

    const expectedUrl = `${oiAnalyticsConfig.OIAnalytics.host}/api/oianalytics/oibus/data/time_values?dataSourceId=${oiAnalyticsConfig.name}`
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
    jest.spyOn(fs, 'statSync').mockImplementation(() => ({ size: 1000 }))

    await oiAnalytics.handleFile(filePath)

    const expectedUrl = `${oiAnalyticsConfig.OIAnalytics.host}/api/oianalytics/data/values/upload?dataSourceId=${oiAnalyticsConfig.name}`
    const expectedAuthentication = oiAnalyticsConfig.OIAnalytics.authentication
    expect(engine.requestService.httpSend).toHaveBeenCalledWith(expectedUrl, 'POST', expectedAuthentication, null, filePath)
  })
})
