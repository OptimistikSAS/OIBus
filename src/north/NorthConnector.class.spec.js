const NorthConnector = require('./NorthConnector.class')

const { defaultConfig: config } = require('../../tests/testConfig')

// Mock OIBusEngine
const engine = {
  configService: { getConfig: () => ({ engineConfig: config.engine }) },
  cacheFolder: './cache',
  requestService: { httpSend: jest.fn() },
}

// Mock fs
jest.mock('node:fs/promises')

// Mock services
jest.mock('../services/database.service')
jest.mock('../engine/logger/Logger.class')
jest.mock('../services/status.service.class')
jest.mock('../services/EncryptionService.class', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))
jest.mock('../engine/cache/ValueCache.class')
jest.mock('../engine/cache/FileCache.class')

const nowDateString = '2020-02-02T02:02:02.222Z'
let settings = null
let north = null

describe('NorthConnector', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    settings = {
      id: 'id',
      name: 'north',
      api: 'test',
      NorthConnector: {},
      caching: {
        sendInterval: 1000,
        retryInterval: 5000,
        groupCount: 10000,
        maxSendCount: 10000,
        archive: {
          enabled: true,
          retentionDuration: 720,
        },
      },
    }
    north = new NorthConnector(settings, engine)
    await north.init()
  })

  it('should be properly initialized', async () => {
    expect(north.connected).toBeFalsy()
    expect(north.canHandleValues).toBeFalsy()
    expect(north.canHandleFiles).toBeFalsy()
    expect(north.statusService.updateStatusDataStream).toHaveBeenCalledWith({})
    expect(north.settings).toEqual(settings)

    north.canHandleFiles = true
    north.canHandleValues = true
    await north.init()
    expect(north.statusService.updateStatusDataStream).toHaveBeenCalledWith({
      'Number of values sent since OIBus has started': 0,
      'Number of files sent since OIBus has started': 0,
    })

    await north.connect()
    expect(north.connected).toBeTruthy()

    expect(north.logger.info).toHaveBeenCalledWith('North connector "north" of type test started.')

    await north.connect('additional info')
    expect(north.logger.info).toHaveBeenCalledWith('North connector "north" of type test started with additional info.')
  })

  it('should properly disconnect', async () => {
    await north.connect()
    expect(north.connected).toBeTruthy()

    await north.disconnect()
    expect(north.connected).toBeFalsy()
    expect(north.logger.info).toHaveBeenCalledWith('North connector "north" (id) disconnected.')
  })

  it('should properly cache values', () => {
    north.cacheValues('southId', [{}])
    expect(north.valueCache.cacheValues).toHaveBeenCalledWith('southId', [{}])
  })

  it('should properly cache file', () => {
    north.cacheFile('myFilePath', new Date().getTime())
    expect(north.fileCache.cacheFile).toHaveBeenCalledWith('myFilePath')
  })

  it('should get proxy', () => {
    expect(north.getProxy()).toBeNull()

    north.engineConfig.proxies = [{ name: 'proxyTest' }]
    expect(north.getProxy('proxyTest')).toEqual(north.engineConfig.proxies[0])
  })

  it('should properly check if a north is subscribed to a south', () => {
    expect(north.isSubscribed('southId')).toBeTruthy()
    north.settings.subscribedTo = []
    expect(north.isSubscribed('southId')).toBeTruthy()
    north.settings.subscribedTo = ['anotherSouth']
    expect(north.isSubscribed('southId')).toBeFalsy()
    north.settings.subscribedTo = ['anotherSouth', 'southId']
    expect(north.isSubscribed('southId')).toBeTruthy()
  })
})
