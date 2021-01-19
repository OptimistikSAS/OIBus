const fs = require('fs')

const OIConnect = require('./OIConnect.class')
const config = require('../../../tests/testConfig').default

// Mock logger
jest.mock('../../engine/Logger.class')

// Mock engine
const engine = jest.genMockFromModule('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.requestService = {
  postJsonValues: jest.fn(),
  postFile: jest.fn(),
}

beforeEach(() => {
  jest.resetAllMocks()
})

describe('Console north', () => {
  const timestamp = new Date().toISOString()
  const oiconnectNorth = new OIConnect(config.north.applications[1], engine)

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

    const expectedUrl = 'http://hostname:2223/addValues?dataSourceId=OIBus:monoiconnect'
    const expectedAuthentication = config.north.applications[1].OIConnect.authentication
    expect(engine.requestService.postJsonValues).toHaveBeenCalledWith(expectedUrl, values, expectedAuthentication, null)
  })

  it('should properly handle file', async () => {
    const filePath = '/path/to/file/example.file'
    jest.spyOn(fs, 'statSync').mockImplementation(() => ({ size: 666 }))

    await oiconnectNorth.handleFile(filePath)

    const expectedUrl = 'http://hostname:2223/addFile?dataSourceId=OIBus:monoiconnect'
    const expectedAuthentication = config.north.applications[1].OIConnect.authentication
    expect(engine.requestService.postFile).toHaveBeenCalledWith(expectedUrl, filePath, expectedAuthentication, null)
  })
})
