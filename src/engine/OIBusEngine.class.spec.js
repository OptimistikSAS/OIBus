import { jest } from '@jest/globals'

import OIBusEngine from './OIBusEngine.class.js'
import EncryptionService from '../services/EncryptionService.class.js'
import { defaultConfig } from '../../tests/testConfig.js'

jest.mock('./Cache.class.js')

// Mock EncryptionService
EncryptionService.getInstance = () => ({
  decryptText: (password) => password,
  setKeyFolder: () => {},
  checkOrCreatePrivateKey: () => {},
})

let engine = null

beforeEach(async () => {
  const mockConfigService = { getConfig: jest.fn() }
  mockConfigService.getConfig.mockReturnValue({
    engineConfig: defaultConfig.engine,
    southConfig: defaultConfig.south,
  })

  engine = new OIBusEngine(mockConfigService, EncryptionService.getInstance())
  await engine.initEngineServices(defaultConfig.engine)
})

describe('Engine', () => {
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
      },
      {
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
      },
      {
        timestamp: 'today',
        pointId: 'point4',
        data: {
          value: undefined,
          quality: 192,
        },
      },
      {
        timestamp: 'today',
        pointId: 'point5',
        data: undefined,
      },
      {
        timestamp: 'today',
        pointId: 'point6',
        data: { value: '' },
      },
    ]

    engine.cache.cacheValues = jest.fn()
    await engine.addValues('sourceId', sampleValues)
    expect(engine.cache.cacheValues).toBeCalledWith('sourceId', sampleValues)
  })
})
