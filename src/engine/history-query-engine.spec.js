const HistoryQueryEngine = require('./history-query-engine')
const config = require('../config/default-config.json')
const ConfigurationService = require('../service/configuration.service')

// Mock fs
jest.mock('node:fs/promises')

// Mock logger
const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
}

// Mock services
jest.mock('./history-query/history-query-repository')
jest.mock('../service/database.service')
jest.mock('../service/configuration.service')
jest.mock('../service/logger/logger.service')
jest.mock('../service/encryption.service', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))

let engine = null

describe('HistoryQueryEngine', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.useFakeTimers()

    const mockConfigService = { getConfig: jest.fn() }
    mockConfigService.getConfig.mockReturnValue({
      engineConfig: config.engine,
      southConfig: config.south,
    })

    ConfigurationService.mockImplementation(() => mockConfigService)
    const mockLoggerService = { createChildLogger: jest.fn(() => logger) }

    engine = new HistoryQueryEngine(mockConfigService, {}, mockLoggerService)
  })

  it('should be properly initialized', async () => {
    await engine.initEngineServices(config.engine)
    expect(engine.historyOnGoing).toBeFalsy()
  })

  it('should add values', async () => {
    await engine.initEngineServices(config.engine)

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

    const cacheValues = jest.fn()
    engine.historyQuery = { north: { canHandleValues: true, cacheValues }, south: { settings: { name: 'mySouth' } } }
    await engine.addValues('southId', sampleValues)
    expect(cacheValues).toHaveBeenCalledTimes(1)
    expect(cacheValues).toHaveBeenCalledWith('southId', sampleValues)
  })
})
