const fs = require('node:fs/promises')
const NorthConnector = require('./north-connector')

const { defaultConfig: config } = require('../../tests/test-config')

// Mock OIBusEngine
const engine = {
  configService: { getConfig: () => ({ engineConfig: config.engine }) },
  cacheFolder: './cache',
  requestService: { httpSend: jest.fn() },
}

// Mock fs
jest.mock('node:fs/promises')

// Mock services
jest.mock('../service/database.service')
jest.mock('../service/logger/logger.service')
jest.mock('../service/status.service')
jest.mock('../service/certificate.service')
jest.mock('../service/encryption.service', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))
jest.mock('../service/utils')
jest.mock('../engine/cache/value-cache')
jest.mock('../engine/cache/file-cache')

// Method used to flush promises called in setTimeout
const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate)
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
      type: 'test',
      NorthConnector: {},
      caching: {
        sendInterval: 1000,
        retryInterval: 5000,
        groupCount: 10000,
        maxSendCount: 10000,
        retryCount: 2,
        archive: {
          enabled: true,
          retentionDuration: 720,
        },
      },
    }
    north = new NorthConnector(settings, engine)
    await north.init()
  })

  afterEach(() => {
    jest.clearAllTimers()
  })

  it('should be properly initialized', async () => {
    expect(north.connected).toBeFalsy()
    expect(north.canHandleValues).toBeFalsy()
    expect(north.canHandleFiles).toBeFalsy()
    expect(north.statusService.updateStatusDataStream).toHaveBeenCalledWith({})

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

  it('should be properly initialized with sendInterval set to 0', async () => {
    north.resetValuesTimeout = jest.fn()
    north.resetFilesTimeout = jest.fn()
    north.caching.sendInterval = 0

    await north.init()
    expect(north.resetValuesTimeout).not.toHaveBeenCalled()
    expect(north.resetFilesTimeout).not.toHaveBeenCalled()
    expect(north.logger.warn).toHaveBeenCalledWith('No send interval. No values or files will be sent.')
  })

  it('should properly disconnect', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    await north.connect()
    expect(north.connected).toBeTruthy()

    await north.disconnect()
    expect(north.connected).toBeFalsy()
    expect(north.logger.info).toHaveBeenCalledWith('North connector "north" (id) disconnected.')
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2)

    clearTimeoutSpy.mockClear()

    north.valuesTimeout = null
    north.filesTimeout = null
    await north.disconnect()
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(0)
  })

  it('should not cache values if no values are sent', () => {
    north.cacheValues('southId', [])
    expect(north.valueCache.cacheValues).not.toHaveBeenCalled()
  })

  it('should properly cache values', () => {
    north.cacheValues('southId', [{}])
    expect(north.valueCache.cacheValues).toHaveBeenCalledWith('southId', [{}])
  })

  it('should properly cache values and immediately send them if max group count is reached', () => {
    north.valueCache.getNumberOfValues.mockReturnValue(settings.caching.groupCount)
    north.cacheValues('southId', [{}])
    expect(north.valueCache.cacheValues).toHaveBeenCalledWith('southId', [{}])
    expect(north.logger.trace).toHaveBeenCalledWith(`Group count reached: ${settings.caching.groupCount} `
        + `>= ${settings.caching.groupCount}`)
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

  it('should not retrieve values if already sending it', async () => {
    north.sendingValuesInProgress = true
    await north.retrieveFromCacheAndSendValues()

    expect(north.logger.trace).toHaveBeenCalledWith('Already sending values...')
    expect(north.resendValuesImmediately).toBeTruthy()
  })

  it('should not send values if no values to send', async () => {
    north.valueCache.retrieveValuesFromCache = jest.fn(() => [])
    north.resetValuesTimeout = jest.fn()
    await north.retrieveFromCacheAndSendValues()

    expect(north.logger.trace).toHaveBeenCalledWith('No values to send in the cache database.')
    expect(north.resetValuesTimeout).toHaveBeenCalledWith(settings.caching.sendInterval)
  })

  it('should successfully send values', async () => {
    const valuesToSend = [{ value: 'myValue' }]
    north.valueCache.retrieveValuesFromCache = jest.fn(() => valuesToSend)
    north.handleValues = jest.fn()
    await north.retrieveFromCacheAndSendValues()
    jest.advanceTimersByTime(settings.caching.sendInterval)
    await flushPromises()

    expect(north.handleValues).toHaveBeenCalledWith(valuesToSend)
    expect(north.handleValues).toHaveBeenCalledTimes(2)
  })

  it('should send values immediately', async () => {
    clearTimeout(north.valuesTimeout)
    clearTimeout(north.filesTimeout)
    const valuesToSend = [{ value: 'myValue' }]
    north.valueCache.retrieveValuesFromCache = jest.fn(() => valuesToSend)
    north.resetValuesTimeout = jest.fn()
    // handle values takes twice the sending interval time
    const promiseToResolve = new Promise((resolve) => {
      setTimeout(() => resolve(), settings.caching.sendInterval * 2)
    })
    north.handleValues = jest.fn(() => promiseToResolve)

    north.retrieveFromCacheAndSendValues()
    jest.advanceTimersByTime(settings.caching.sendInterval)

    // Provoke an immediate sending request for next tick
    north.retrieveFromCacheAndSendValues()
    expect(north.logger.trace).toHaveBeenCalledWith('Already sending values...')

    jest.advanceTimersByTime(settings.caching.sendInterval)
    await flushPromises()

    expect(north.handleValues).toHaveBeenCalledTimes(1)
    expect(north.handleValues).toHaveBeenCalledWith(valuesToSend)
    expect(north.resetValuesTimeout).toHaveBeenCalledWith(0)

    await flushPromises()
  })

  it('should retry to send values if it fails', async () => {
    clearTimeout(north.valuesTimeout)
    clearTimeout(north.filesTimeout)
    const valuesToSend = [{ value: 'myValue' }]
    north.valueCache.retrieveValuesFromCache = jest.fn(() => valuesToSend)
    north.handleValues = jest.fn().mockImplementationOnce(() => {
      throw new Error('handleValues error 1')
    }).mockImplementationOnce(() => {
      throw new Error('handleValues error 2')
    }).mockImplementationOnce(() => {
      throw new Error('handleValues error 3')
    })
    await north.retrieveFromCacheAndSendValues()
    jest.advanceTimersByTime(settings.caching.retryInterval)
    jest.advanceTimersByTime(settings.caching.retryInterval)

    expect(north.handleValues).toHaveBeenCalledWith(valuesToSend)
    expect(north.handleValues).toHaveBeenCalledTimes(3)
    expect(north.valueCache.manageErroredValues).toHaveBeenCalledTimes(1)
    expect(north.valueCache.manageErroredValues).toHaveBeenCalledWith(valuesToSend)
  })

  it('should not retrieve files if already sending it', async () => {
    north.sendingFilesInProgress = true
    await north.retrieveFromCacheAndSendFile()

    expect(north.logger.trace).toHaveBeenCalledWith('Already sending files...')
    expect(north.resendFilesImmediately).toBeTruthy()
  })

  it('should not send files if no file to send', async () => {
    north.fileCache.retrieveFileFromCache = jest.fn(() => null)
    north.resetFilesTimeout = jest.fn()
    await north.retrieveFromCacheAndSendFile()

    expect(north.logger.trace).toHaveBeenCalledWith('No file to send in the cache database.')
    expect(north.resetFilesTimeout).toHaveBeenCalledWith(settings.caching.sendInterval)
  })

  it('should not send files if it does not exist', async () => {
    const fileToSend = { path: 'myFile' }
    north.fileCache.retrieveFileFromCache = jest.fn(() => fileToSend)
    north.fileCache.removeFileFromCache = jest.fn()
    fs.stat = jest.fn().mockImplementationOnce(() => {
      throw new Error('file does not exist')
    })

    await north.retrieveFromCacheAndSendFile()

    expect(north.logger.error).toHaveBeenCalledWith(`File "${fileToSend.path}" not found! The file has been removed from the cache.`)
    expect(north.fileCache.removeFileFromCache).toHaveBeenCalledWith(fileToSend.path, false)
  })

  it('should retry to send files if it fails', async () => {
    clearTimeout(north.valuesTimeout)
    clearTimeout(north.filesTimeout)
    const fileToSend = { path: 'myFile' }
    north.fileCache.retrieveFileFromCache = jest.fn(() => fileToSend)
    north.fileCache.removeFileFromCache = jest.fn()
    north.handleFile = jest.fn().mockImplementationOnce(() => {
      throw new Error('handleFile error 1')
    }).mockImplementationOnce(() => {
      throw new Error('handleFile error 2')
    }).mockImplementationOnce(() => {
      throw new Error('handleFile error 3')
    })

    await north.retrieveFromCacheAndSendFile()
    jest.advanceTimersByTime(settings.caching.retryInterval)
    await flushPromises()
    jest.advanceTimersByTime(settings.caching.retryInterval)
    await flushPromises()

    expect(north.handleFile).toHaveBeenCalledWith(fileToSend.path)
    expect(north.handleFile).toHaveBeenCalledTimes(3)
    expect(north.fileCache.removeFileFromCache).toHaveBeenCalledTimes(0)
    expect(north.fileCache.manageErroredFiles).toHaveBeenCalledTimes(1)
    expect(north.fileCache.manageErroredFiles).toHaveBeenCalledWith(fileToSend.path)
  })

  it('should successfully send files', async () => {
    clearTimeout(north.valuesTimeout)
    clearTimeout(north.filesTimeout)
    const fileToSend = { path: 'myFile' }
    north.fileCache.retrieveFileFromCache = jest.fn(() => fileToSend)
    north.fileCache.removeFileFromCache = jest.fn()
    north.handleFile = jest.fn()

    await north.retrieveFromCacheAndSendFile()
    jest.advanceTimersByTime(settings.caching.sendInterval)
    await flushPromises()
    expect(north.handleFile).toHaveBeenCalledWith(fileToSend.path)
    expect(north.handleFile).toHaveBeenCalledTimes(2)
    expect(north.fileCache.removeFileFromCache).toHaveBeenCalledTimes(2)
    expect(north.fileCache.removeFileFromCache).toHaveBeenCalledWith(fileToSend.path, settings.caching.archive.enabled)
    expect(north.fileCache.manageErroredFiles).toHaveBeenCalledTimes(0)
  })

  it('should send file immediately', async () => {
    clearTimeout(north.valuesTimeout)
    clearTimeout(north.filesTimeout)
    const fileToSend = { path: 'myFile' }
    north.fileCache.retrieveFileFromCache = jest.fn(() => fileToSend)
    north.fileCache.removeFileFromCache = jest.fn()
    north.resetFilesTimeout = jest.fn()
    // handle file takes twice the sending interval time
    const promiseToResolve = new Promise((resolve) => {
      setTimeout(() => resolve(), settings.caching.sendInterval * 2)
    })
    north.handleFile = jest.fn(() => promiseToResolve)

    north.retrieveFromCacheAndSendFile()
    jest.advanceTimersByTime(settings.caching.sendInterval)
    await flushPromises()

    // Provoke an immediate sending request for next tick
    north.retrieveFromCacheAndSendFile()
    expect(north.logger.trace).toHaveBeenCalledWith('Already sending files...')

    jest.advanceTimersByTime(settings.caching.sendInterval)
    await flushPromises()

    expect(north.handleFile).toHaveBeenCalledTimes(1)
    expect(north.handleFile).toHaveBeenCalledWith(fileToSend.path)
    expect(north.resetFilesTimeout).toHaveBeenCalledWith(0)

    await flushPromises()
  })

  it('should properly check if a north is subscribed to a south', () => {
    expect(north.isSubscribed('southId')).toBeTruthy()
    north.subscribedTo = []
    expect(north.isSubscribed('southId')).toBeTruthy()
    north.subscribedTo = ['anotherSouth']
    expect(north.isSubscribed('southId')).toBeFalsy()
    north.subscribedTo = ['anotherSouth', 'southId']
    expect(north.isSubscribed('southId')).toBeTruthy()
  })

  it('should check if North caches are empty', async () => {
    north.valueCache.isEmpty.mockReturnValue(true)
    north.fileCache.isEmpty.mockReturnValue(Promise.resolve(true))
    expect(await north.isCacheEmpty()).toBeTruthy()

    north.valueCache.isEmpty.mockReturnValue(true)
    north.fileCache.isEmpty.mockReturnValue(Promise.resolve(false))
    expect(await north.isCacheEmpty()).toBeFalsy()

    north.valueCache.isEmpty.mockReturnValue(false)
    north.fileCache.isEmpty.mockReturnValue(Promise.resolve(true))
    expect(await north.isCacheEmpty()).toBeFalsy()

    north.valueCache.isEmpty.mockReturnValue(false)
    north.fileCache.isEmpty.mockReturnValue(Promise.resolve(false))
    expect(await north.isCacheEmpty()).toBeFalsy()
  })
})
