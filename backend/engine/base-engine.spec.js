import BaseEngine from './base-engine.js'
import EncryptionService from '../service/encryption.service.js'
import ConfigurationService from '../service/configuration.service.js'

import { testConfig } from '../tests/test-config.js'

// Mock logger
const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
}

// Mock services
jest.mock('../service/configuration.service')
jest.mock('../service/logger/logger.service')
jest.mock('../service/encryption.service', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))

let engine = null

describe('BaseEngine', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers()

    const mockConfigService = { getConfig: jest.fn() }
    mockConfigService.getConfig.mockReturnValue({
      engineConfig: testConfig.engine,
      southConfig: testConfig.south,
    })
    ConfigurationService.mockImplementation(() => mockConfigService)

    engine = new BaseEngine(
      'version',
      mockConfigService,
      EncryptionService.getInstance(),
      {},
      'myCacheFolder',
    )
    engine.logger = logger

    await engine.initEngineServices(testConfig.engine)
  })

  it('should warn when calling add values', async () => {
    const sampleValues = [{
      timestamp: 'today',
      pointId: 'point1',
      data: {
        value: 0,
        quality: 192,
      },
    }]

    await engine.addValues('southId', sampleValues)

    expect(engine.logger.warn).toHaveBeenCalledWith('addValues() should be surcharged. Called with South "southId" and 1 values.')
  })

  it('should warn when calling add file', async () => {
    await engine.addFile('southId', 'filePath', false)

    expect(engine.logger.warn).toHaveBeenCalledWith('addFile() should be surcharged. Called with South "southId", file "filePath" and false.')
  })

  it('should warn when calling start', async () => {
    await engine.start()
    expect(engine.logger.warn).toHaveBeenCalledWith('start() should be surcharged. Called with safe mode false.')

    await engine.start(true)
    expect(engine.logger.warn).toHaveBeenCalledWith('start() should be surcharged. Called with safe mode true.')
  })

  it('should warn when calling stop', async () => {
    await engine.stop()
    expect(engine.logger.warn).toHaveBeenCalledWith('stop() should be surcharged.')
  })

  it('should create south', () => {
    const south = engine.createSouth(testConfig.south[0])
    expect(south.constructor.name).toEqual('SouthFolderScanner')
  })

  it('should not create south if it does not exist', () => {
    engine.createSouth({ type: 'badType', name: 'bad' })
    expect(engine.logger.error).toHaveBeenCalledWith('South connector for "bad" is not found: badType')
  })

  it('should not create south if settings are wrong', () => {
    engine.createSouth({ type: 'FolderScanner', name: 'bad', settings: null })
    expect(engine.logger.error).toHaveBeenCalledWith(expect.stringContaining('Error when creating South connector "bad": '
        + 'TypeError: Cannot read properties of null (reading \'scanGroups\')'))
  })

  it('should retrieve installed South list', () => {
    const southList = engine.getSouthList()
    const expectedResult = [
      {
        category: 'DatabaseOut',
        connectorName: 'SQL',
      },
      {
        category: 'FileOut',
        connectorName: 'FolderScanner',
      },
      {
        category: 'IoT',
        connectorName: 'OPCUA_HA',
      },
      {
        category: 'IoT',
        connectorName: 'OPCUA_DA',
      },
      {
        category: 'IoT',
        connectorName: 'MQTT',
      },
      {
        category: 'IoT',
        connectorName: 'ADS',
      },
      {
        category: 'IoT',
        connectorName: 'Modbus',
      },
      {
        category: 'IoT',
        connectorName: 'OPCHDA',
      },
      {
        category: 'API',
        connectorName: 'RestApi',
      },
    ]

    expect(southList).toEqual(expectedResult)
  })

  it('should not create north if it does not exist', () => {
    engine.createNorth({ type: 'badType', name: 'bad' })
    expect(engine.logger.error).toHaveBeenCalledWith('North connector for "bad" is not found: badType')
  })

  it('should not create north if settings are wrong', () => {
    engine.createNorth({ type: 'Console', name: 'bad', settings: null })
    expect(engine.logger.error).toHaveBeenCalledWith(expect.stringContaining('Error when creating North connector "bad": TypeError: '
        + 'Cannot destructure property \'verbose\' of'))
  })

  it('should create north', () => {
    const north = engine.createNorth(testConfig.north[0])
    expect(north.constructor.name).toEqual('Console')
  })

  it('should retrieve installed North list', () => {
    const northList = engine.getNorthList()
    const expectedResults = [
      {
        category: 'Optimistik',
        connectorName: 'OIAnalytics',
      },
      {
        category: 'Optimistik',
        connectorName: 'OIConnect',
      },
      {
        category: 'FileIn',
        connectorName: 'FileWriter',
      },
      {
        category: 'FileIn',
        connectorName: 'AmazonS3',
      },
      {
        category: 'DatabaseIn',
        connectorName: 'InfluxDB',
      },
      {
        category: 'DatabaseIn',
        connectorName: 'TimescaleDB',
      },
      {
        category: 'DatabaseIn',
        connectorName: 'MongoDB',
      },
      {
        category: 'IoT',
        connectorName: 'MQTT',
      },
      {
        category: 'Debug',
        connectorName: 'Console',
      },
      {
        category: 'API',
        connectorName: 'WATSYConnect',
      },
      {
        category: 'API',
        connectorName: 'CsvToHttp',
      },
    ]
    expect(northList).toEqual(expectedResults)
  })
})
