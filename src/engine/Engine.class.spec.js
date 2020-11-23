const Engine = require('./Engine.class')
const Logger = require('./Logger.class')
const EncryptionService = require('../services/EncryptionService.class')

// Mock logger
jest.mock('./Logger.class')
Logger.getDefaultLogger = () => new Logger()

// Mock EncryptionService
EncryptionService.getInstance = () => ({
  decryptText: (password) => password,
  setKeyFolder: () => {
  },
  checkOrCreatePrivateKey: () => {
  },
})

beforeEach(() => {
  jest.resetAllMocks()
  jest.useFakeTimers()
})

const engine = new Engine('/tests/oibus_win.json')

describe('Engine', () => {
  it('should be properly initialized', () => {
    expect(engine.addFileCount).toEqual(0)
    expect(engine.addValuesCount).toEqual(0)
    expect(engine.addValuesMessages).toEqual(0)
    expect(engine.aliveSignal.enabled).toEqual(false)
  })

  it('should add values', async () => {
    const sampleValues = [{
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

    const sanitizedValues = [{
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
      pointId: 'point6',
      data: { value: '' },
    }]

    engine.cache.cacheValues = jest.fn()
    await engine.addValues('sourceId', sampleValues)
    expect(engine.cache.cacheValues).toBeCalledWith('sourceId', sanitizedValues)
  })
})
