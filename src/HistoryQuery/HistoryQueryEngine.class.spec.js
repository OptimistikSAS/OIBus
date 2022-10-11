const HistoryQueryEngine = require('./HistoryQueryEngine.class')
const config = require('../config/defaultConfig.json')
const ConfigService = require('../services/config.service.class')

// Mock fs
jest.mock('node:fs/promises')

// Mock services
jest.mock('../services/database.service')
jest.mock('./HistoryQueryRepository.class')
jest.mock('../services/config.service.class')
jest.mock('../engine/logger/Logger.class')
jest.mock('../services/EncryptionService.class', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))

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

    ConfigService.mockImplementation(() => mockConfigService)

    engine = new HistoryQueryEngine(mockConfigService)
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
