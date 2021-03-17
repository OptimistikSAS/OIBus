const fs = require('fs')

const OIConnect = require('./OIConnect.class')
const config = require('../../../tests/testConfig').default

// Mock logger
jest.mock('../../engine/logger/Logger.class')

// Mock engine
const engine = jest.mock('../../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.requestService = { httpSend: jest.fn() }
engine.eventEmitters = {}

let oiconnectNorth = null
const oiconnectConfig = config.north.applications[1]
const timestamp = new Date().toISOString()

beforeEach(async () => {
  jest.resetAllMocks()
  oiconnectNorth = new OIConnect(oiconnectConfig, engine)
  await oiconnectNorth.init()
})

describe('OIConnect', () => {
  it('should be properly initialized', () => {
    expect(oiconnectNorth.canHandleFiles).toBeTruthy()
    expect(oiconnectNorth.canHandleFiles).toBeTruthy()
  })

  it('should properly handle values in non verbose mode', async () => {
    const values = [
      {
        pointId: 'pointId',
        timestamp,
        data: { value: 666, quality: 'good' },
      },
    ]
    await oiconnectNorth.handleValues(values)

    const expectedUrl = 'http://hostname:2223/addValues?name=OIBus:monoiconnect'
    const expectedAuthentication = config.north.applications[1].OIConnect.authentication
    const expectedBody = JSON.stringify(values)
    const expectedHeaders = { 'Content-Type': 'application/json' }

    expect(engine.requestService.httpSend).toHaveBeenCalledWith(expectedUrl, 'POST', expectedAuthentication, null, expectedBody, expectedHeaders)
  })

  it('should properly handle file', async () => {
    const filePath = '/path/to/file/example.file'
    jest.spyOn(fs, 'statSync').mockImplementation(() => ({ size: 666 }))

    await oiconnectNorth.handleFile(filePath)

    const expectedUrl = 'http://hostname:2223/addFile?name=OIBus:monoiconnect'
    const expectedAuthentication = config.north.applications[1].OIConnect.authentication
    expect(engine.requestService.httpSend).toHaveBeenCalledWith(expectedUrl, 'POST', expectedAuthentication, null, filePath)
  })
})
