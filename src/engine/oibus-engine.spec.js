import OIBusEngine from './oibus-engine.js'
import EncryptionService from '../service/encryption.service.js'
import config from '../config/default-config.json'
import ConfigurationService from '../service/configuration.service.js'

// Mock EncryptionService
EncryptionService.getInstance = () => ({
  decryptText: (password) => password,
  setKeyFolder: () => {},
  checkOrCreatePrivateKey: () => {},
})

// Mock services
jest.mock('../service/configuration.service')
jest.mock('../service/logger/logger.service')

// Mock logger
const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
}

let engine = null

describe('OIBusEngine', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers()

    const mockConfigService = { getConfig: jest.fn() }
    mockConfigService.getConfig.mockReturnValue({
      engineConfig: config.engine,
      southConfig: config.south,
    })

    ConfigurationService.mockImplementation(() => mockConfigService)

    const mockLoggerService = { createChildLogger: jest.fn(() => logger) }
    engine = new OIBusEngine(mockConfigService, {}, mockLoggerService)
    await engine.initEngineServices(config.engine)
  })

  it('should be properly initialized', () => {
    expect(engine.addFileCount).toEqual(0)
    expect(engine.addValuesCount).toEqual(0)
    expect(engine.addValuesMessages).toEqual(0)
  })

  it('should add values', async () => {
    const sampleValues = [
      {
        timestamp: 'today',
        pointId: 'point1',
        data: {
          value: 0,
          quality: 192,
        },
      }, {
        timestamp: 'today',
        pointId: 'point2',
        data: {
          value: -3.98,
          quality: 192,
        },
      },
      {
        timestamp: 'today',
        pointId: 'point3',
        data: {
          value: null,
          quality: 192,
        },
      }, {
        timestamp: 'today',
        pointId: 'point4',
        data: {
          value: undefined,
          quality: 192,
        },
      }, {
        timestamp: 'today',
        pointId: 'point5',
        data: undefined,
      },
      {
        timestamp: 'today',
        pointId: 'point6',
        data: { value: '' },
      }]

    engine.activeSouths = [{ settings: { id: 'southId' } }]
    await engine.addValues('southId', sampleValues)
  })
})
