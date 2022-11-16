const NorthConnector = require('./north-connector')

const httpRequestStaticFunctions = require('../service/http-request-static-functions')

// Mock fs
jest.mock('node:fs/promises')

// Mock services
jest.mock('../service/database.service')
jest.mock('../service/logger/logger.service')
jest.mock('../service/status.service')
jest.mock('../service/certificate.service')
jest.mock('../service/encryption.service', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))
jest.mock('../service/utils')
jest.mock('../service/http-request-static-functions')
jest.mock('../service/cache/value-cache.service')
jest.mock('../service/cache/file-cache.service')
jest.mock('../service/cache/archive.service')

// Method used to flush promises called in setTimeout
const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate)
const nowDateString = '2020-02-02T02:02:02.222Z'
let configuration = null
let north = null

describe('NorthConnector', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    configuration = {
      id: 'id',
      name: 'north',
      type: 'test',
      settings: {},
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
    north = new NorthConnector(configuration, [{ name: 'proxyTest' }])
    await north.start('baseFolder', 'oibusName', {})
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
    await north.start('baseFolder', 'oibusName', {})
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
    north.cacheSettings.sendInterval = 0

    await north.start('baseFolder', 'oibusName', {})
    expect(north.resetValuesTimeout).not.toHaveBeenCalled()
    expect(north.resetFilesTimeout).not.toHaveBeenCalled()
    expect(north.logger.warn).toHaveBeenCalledWith('No send interval. No values or files will be sent.')
  })

  it('should properly disconnect', async () => {
    await north.connect()
    expect(north.connected).toBeTruthy()

    await north.disconnect()
    expect(north.connected).toBeFalsy()
    expect(north.logger.info).toHaveBeenCalledWith('North connector "north" (id) disconnected.')
  })

  it('should properly stop', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    north.disconnect = jest.fn()

    await north.stop()

    expect(north.logger.info).toHaveBeenCalledWith('Stopping North "north" (id).')
    expect(north.disconnect).toHaveBeenCalledTimes(1)
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
    expect(north.fileCache.stop).toHaveBeenCalledTimes(1)
    expect(north.valueCache.stop).toHaveBeenCalledTimes(1)
    expect(north.archiveService.stop).toHaveBeenCalledTimes(1)

    clearTimeoutSpy.mockClear()
    north.filesTimeout = null
    await north.stop()
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(0)
  })

  it('should properly cache values', () => {
    north.cacheValues([{}])
    expect(north.valueCache.cacheValues).toHaveBeenCalledWith([{}])
  })

  it('should properly cache file', () => {
    north.cacheFile('myFilePath', new Date().getTime())
    expect(north.fileCache.cacheFile).toHaveBeenCalledWith('myFilePath')
  })

  it('should get proxy', async () => {
    httpRequestStaticFunctions.createProxyAgent.mockImplementation(() => ({ proxyAgent: 'a field' }))
    expect(await north.getProxy()).toBeNull()
    expect(await north.getProxy('proxyTest')).toEqual({ proxyAgent: 'a field' })
    expect(await north.getProxy('anotherProxy')).toBeNull()
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

    expect(north.logger.trace).toHaveBeenCalledWith('No file to send in the cache folder.')
    expect(north.resetFilesTimeout).toHaveBeenCalledWith(configuration.caching.sendInterval)
  })

  it('should retry to send files if it fails', async () => {
    clearTimeout(north.filesTimeout)
    const fileToSend = { path: 'myFile' }
    north.fileCache.retrieveFileFromCache = jest.fn(() => fileToSend)
    north.archiveService.archiveOrRemoveFile = jest.fn()
    north.handleFile = jest.fn().mockImplementationOnce(() => {
      throw new Error('handleFile error 1')
    }).mockImplementationOnce(() => {
      throw new Error('handleFile error 2')
    }).mockImplementationOnce(() => {
      throw new Error('handleFile error 3')
    })

    await north.retrieveFromCacheAndSendFile()
    jest.advanceTimersByTime(configuration.caching.retryInterval)
    await flushPromises()
    jest.advanceTimersByTime(configuration.caching.retryInterval)
    await flushPromises()

    expect(north.handleFile).toHaveBeenCalledWith(fileToSend.path)
    expect(north.handleFile).toHaveBeenCalledTimes(3)
    expect(north.archiveService.archiveOrRemoveFile).toHaveBeenCalledTimes(0)
    expect(north.fileCache.manageErroredFiles).toHaveBeenCalledTimes(1)
    expect(north.fileCache.manageErroredFiles).toHaveBeenCalledWith(fileToSend.path)
  })

  it('should successfully send files', async () => {
    clearTimeout(north.filesTimeout)
    const fileToSend = { path: 'myFile' }
    north.fileCache.retrieveFileFromCache = jest.fn(() => fileToSend)
    north.archiveService.archiveOrRemoveFile = jest.fn()
    north.handleFile = jest.fn()

    await north.retrieveFromCacheAndSendFile()
    jest.advanceTimersByTime(configuration.caching.sendInterval)
    await flushPromises()
    expect(north.handleFile).toHaveBeenCalledWith(fileToSend.path)
    expect(north.handleFile).toHaveBeenCalledTimes(2)
    expect(north.archiveService.archiveOrRemoveFile).toHaveBeenCalledTimes(2)
    expect(north.archiveService.archiveOrRemoveFile).toHaveBeenCalledWith(fileToSend.path)
    expect(north.fileCache.manageErroredFiles).toHaveBeenCalledTimes(0)
  })

  it('should send file immediately', async () => {
    clearTimeout(north.filesTimeout)
    const fileToSend = { path: 'myFile' }
    north.fileCache.retrieveFileFromCache = jest.fn(() => fileToSend)
    north.archiveService.archiveOrRemoveFile = jest.fn()
    north.resetFilesTimeout = jest.fn()
    // handle file takes twice the sending interval time
    const promiseToResolve = new Promise((resolve) => {
      setTimeout(() => resolve(), configuration.caching.sendInterval * 2)
    })
    north.handleFile = jest.fn(() => promiseToResolve)

    north.retrieveFromCacheAndSendFile()
    jest.advanceTimersByTime(configuration.caching.sendInterval)
    await flushPromises()

    // Provoke an immediate sending request for next tick
    north.retrieveFromCacheAndSendFile()
    expect(north.logger.trace).toHaveBeenCalledWith('Already sending files...')

    jest.advanceTimersByTime(configuration.caching.sendInterval)
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
