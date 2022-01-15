const fs = require('fs/promises')
const OIConnect = require('./OIConnect.class')
const config = require('../../../tests/testConfig').default

// Mock logger
jest.mock('../../engine/logger/Logger.class')

// Mock engine
const engine = jest.mock('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.requestService = { httpSend: jest.fn() }
engine.eventEmitters = {}

let oiConnect = null
const oiConnectConfig = config.north.applications[1]
const timestamp = new Date().toISOString()

beforeEach(async () => {
  jest.resetAllMocks()
  jest.clearAllMocks()
  oiConnect = new OIConnect(oiConnectConfig, engine)
  await oiConnect.init()
})

describe('OIConnect', () => {
  it('should be properly initialized', () => {
    expect(oiConnect.canHandleFiles).toBeTruthy()
    expect(oiConnect.canHandleFiles).toBeTruthy()
  })

  it('should properly handle values in non verbose mode', async () => {
    const values = [
      {
        pointId: 'pointId',
        timestamp,
        data: { value: 666, quality: 'good' },
      },
    ]
    await oiConnect.handleValues(values)

    const expectedUrl = 'http://hostname:2223/addValues?name=OIBus:monoiconnect'
    const expectedAuthentication = oiConnectConfig.OIConnect.authentication
    const expectedBody = JSON.stringify(values)
    const expectedHeaders = { 'Content-Type': 'application/json' }

    expect(engine.requestService.httpSend).toHaveBeenCalledWith(expectedUrl, 'POST', expectedAuthentication, null, expectedBody, expectedHeaders)
  })

  it('should properly handle file', async () => {
    const filePath = '/path/to/file/example.file'
    jest.spyOn(fs, 'stat').mockImplementation(() => ({ size: 666 }))

    await oiConnect.handleFile(filePath)

    const expectedUrl = 'http://hostname:2223/addFile?name=OIBus:monoiconnect'
    const expectedAuthentication = oiConnectConfig.OIConnect.authentication
    expect(engine.requestService.httpSend).toHaveBeenCalledWith(expectedUrl, 'POST', expectedAuthentication, null, filePath)
  })
})
