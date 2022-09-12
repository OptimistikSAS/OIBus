const OIBusEngine = require('./OIBusEngine.class')
const EncryptionService = require('../services/EncryptionService.class')
const config = require('../config/defaultConfig.json')
const ConfigService = require('../services/config.service.class')

// Mock EncryptionService
EncryptionService.getInstance = () => ({
  decryptText: (password) => password,
  setKeyFolder: () => {
  },
  checkOrCreatePrivateKey: () => {
  },
})

// Mock configService
jest.mock('../services/config.service.class')

let engine = null

beforeEach(async () => {
  jest.resetAllMocks()
  jest.useFakeTimers()

  const mockConfigService = { getConfig: jest.fn() }
  mockConfigService.getConfig.mockReturnValue({
    engineConfig: config.engine,
    southConfig: config.south,
  })

  ConfigService.mockImplementation(() => mockConfigService)

  engine = new OIBusEngine(mockConfigService)
  await engine.initEngineServices(config.engine)
})

describe('Engine', () => {
  it('should be properly initialized', () => {
    expect(engine.addFileCount)
      .toEqual(0)
    expect(engine.addValuesCount)
      .toEqual(0)
    expect(engine.addValuesMessages)
      .toEqual(0)
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

    EncryptionService.getInstance = () => ({
      decryptText: (password) => password,
      setKeyFolder: () => {
      },
      checkOrCreatePrivateKey: () => {
      },
    })

    const cacheValues = jest.fn()
    engine.activeApis = {
      id1: {
        canHandleValues: true,
        isSubscribed: () => true,
        cacheValues,
      },
      id2: {
        canHandleValues: true,
        isSubscribed: () => false,
        cacheValues,
      },
      id3: {
        canHandleValues: false,
        isSubscribed: () => true,
        cacheValues,
      },
    }

    await engine.addValues('sourceId', sampleValues)
    expect(cacheValues)
      .toBeCalledWith('sourceId', sampleValues)
  })
})
