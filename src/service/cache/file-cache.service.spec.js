const path = require('node:path')
const fs = require('node:fs/promises')

const FileCache = require('./file-cache.service')

const { createFolder } = require('../utils')

jest.mock('node:fs/promises')

// Mock logger
const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
}
jest.mock('../../service/utils')
const northSendFilesCallback = jest.fn()
const northShouldRetryCallback = jest.fn()
// Method used to flush promises called in setTimeout
const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate)
const nowDateString = '2020-02-02T02:02:02.222Z'
let settings
let cache
describe('FileCache', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))
    settings = { sendInterval: 1000, groupCount: 1000, maxSendCount: 10000, retryCount: 3, retryInterval: 5000 }

    cache = new FileCache(
      'northId',
      logger,
      'myCacheFolder',
      northSendFilesCallback,
      northShouldRetryCallback,
      settings,
    )
  })

  it('should be properly initialized with files in cache', async () => {
    fs.readdir.mockImplementation(() => ['file1', 'file2'])
    fs.stat.mockImplementationOnce(() => ({ ctimeMs: 2 })).mockImplementationOnce(() => ({ ctimeMs: 1 }))

    await cache.start()
    expect(cache.northId).toEqual('northId')
    expect(cache.baseFolder).toEqual('myCacheFolder')
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files'))
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files-errors'))

    expect(logger.debug).toHaveBeenCalledWith('2 files in cache.')
    expect(logger.warn).toHaveBeenCalledWith('2 files in error cache.')
  })

  it('should be properly initialized with files in cache but error access', async () => {
    fs.readdir
      .mockImplementationOnce(() => ['file1', 'file2'])
      .mockImplementationOnce(() => {
        throw new Error('readdir error')
      })
    fs.stat.mockImplementationOnce(() => {
      throw new Error('stat error')
    }).mockImplementationOnce(() => ({ ctimeMs: 1 }))

    cache.settings.sendInterval = 0
    cache.resetFilesTimeout = jest.fn()

    await cache.start()
    expect(cache.northId).toEqual('northId')
    expect(cache.baseFolder).toEqual('myCacheFolder')
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files'))
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files-errors'))

    expect(logger.debug).toHaveBeenCalledWith('1 files in cache.')
    expect(logger.error).toHaveBeenCalledWith('Error while reading queue file '
        + `"${path.resolve(cache.fileFolder, 'file1')}": ${new Error('stat error')}`)
    expect(logger.error).toHaveBeenCalledWith(new Error('readdir error'))
    expect(cache.resetFilesTimeout).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith('No send interval. No file will be sent.')
  })

  it('should be properly initialized without files in cache', async () => {
    fs.readdir.mockImplementation(() => [])
    await cache.start()
    expect(cache.northId).toEqual('northId')
    expect(cache.baseFolder).toEqual('myCacheFolder')
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files'))
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files-errors'))

    expect(logger.debug).toHaveBeenCalledWith('No files in cache.')
    expect(logger.debug).toHaveBeenCalledWith('No error files in cache.')
  })

  it('should properly cache file', async () => {
    await cache.cacheFile('myFile.csv')

    expect(logger.debug).toHaveBeenCalledWith('Caching file "myFile.csv"...')
    expect(fs.copyFile).toHaveBeenCalledWith('myFile.csv', path.resolve('myCacheFolder', 'files', 'myFile-1580608922222.csv'))
    expect(logger.debug).toHaveBeenCalledWith(`File "myFile.csv" cached in "${path.resolve('myCacheFolder', 'files', 'myFile-1580608922222.csv')}".`)
  })

  it('should properly managed cache file error', async () => {
    fs.copyFile.mockImplementation(() => {
      throw new Error('copy file')
    })

    let error
    try {
      await cache.cacheFile('myFile.csv')
    } catch (copyError) {
      error = copyError
    }

    expect(error).toEqual(new Error('copy file'))
  })

  it('should properly retrieve file from cache', async () => {
    fs.readdir.mockImplementationOnce(() => []).mockImplementation(() => ['myFile1', 'myFile2'])
    fs.stat.mockImplementation(() => ({ mtime: new Date() }))

    const noFile = await cache.retrieveFileFromCache()
    expect(noFile).toEqual(null)

    const oneFile = await cache.retrieveFileFromCache()
    expect(oneFile).toEqual({
      path: path.resolve(cache.fileFolder, 'myFile1'),
      timestamp: 1580608922222,
    })
  })

  it('should properly manage error when retrieving file from cache', async () => {
    fs.readdir.mockImplementation(() => {
      throw new Error('readdir error')
    })

    const noFile = await cache.retrieveFileFromCache()
    expect(noFile).toEqual(null)
    expect(logger.error).toHaveBeenCalledWith(new Error('readdir error'))
  })

  it('should properly retrieve file from cache and manage file error', async () => {
    fs.readdir.mockImplementation(() => ['myFile1', 'myFile2', 'myFile3'])
    fs.stat.mockImplementationOnce(() => ({ mtime: new Date() }))
      .mockImplementationOnce(() => {
        throw new Error('stat error')
      })
      .mockImplementationOnce(() => ({ mtime: new Date('2010-02-01T02:02:02.222Z') }))

    const oneFile = await cache.retrieveFileFromCache()
    expect(oneFile).toEqual({
      path: path.resolve(cache.fileFolder, 'myFile3'),
      timestamp: 1264989722222,
    })
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledWith(new Error('stat error'))
  })

  it('should properly manage error files', async () => {
    fs.rename.mockImplementationOnce(() => {}).mockImplementationOnce(() => {
      throw new Error('rename error')
    })

    await cache.manageErroredFiles('myFile.csv')
    expect(logger.info).toHaveBeenCalledWith(`File "myFile.csv" moved to "${path.resolve(cache.errorFolder, 'myFile.csv')}".`)

    await cache.manageErroredFiles('myFile.csv')
    expect(logger.error).toHaveBeenCalledWith(new Error('rename error'))
  })

  it('should check if cache is empty', async () => {
    fs.readdir.mockImplementationOnce(() => [])
      .mockImplementationOnce(() => ['myFile1', 'myFile2'])
      .mockImplementationOnce(() => {
        throw new Error('readdir error')
      })
    const empty = await cache.isEmpty()
    expect(empty).toBeTruthy()
    const notEmpty = await cache.isEmpty()
    expect(notEmpty).toBeFalsy()

    const emptyBecauseOfError = await cache.isEmpty()
    expect(emptyBecauseOfError).toBeTruthy()
    expect(logger.error).toHaveBeenCalledTimes(1)
    expect(logger.error).toHaveBeenCalledWith(new Error('readdir error'))
  })

  it('should not retrieve files if already sending it', async () => {
    cache.sendingFilesInProgress = true
    await cache.sendFile()

    expect(cache.logger.trace).toHaveBeenCalledWith('Already sending files...')
    expect(cache.sendNextImmediately).toBeTruthy()
  })

  it('should not send files if no file to send', async () => {
    cache.getFileToSend = jest.fn(() => null)
    cache.resetFilesTimeout = jest.fn()
    await cache.sendFile()

    expect(cache.logger.trace).toHaveBeenCalledWith('No file to send...')
    expect(cache.resetFilesTimeout).toHaveBeenCalledWith(settings.sendInterval)
  })

  it('should retry to send files if it fails', async () => {
    const fileToSend = 'myFile'
    cache.getFileToSend = jest.fn(() => fileToSend)
    cache.manageErroredFiles = jest.fn()

    cache.northSendFilesCallback = jest.fn()
      .mockImplementationOnce(() => {
        throw new Error('handleFile error 0')
      })
      .mockImplementationOnce(() => {
        throw new Error('handleFile error 1')
      })
      .mockImplementationOnce(() => {
        throw new Error('handleFile error 2')
      })
      .mockImplementationOnce(() => {
        throw new Error('handleFile error 3')
      })

    await cache.sendFile()
    expect(logger.debug).toHaveBeenCalledWith('Retrying file in 5000 ms. Retry count: 1')
    jest.advanceTimersByTime(settings.retryInterval)
    expect(logger.debug).toHaveBeenCalledWith('Retrying file in 5000 ms. Retry count: 2')
    jest.advanceTimersByTime(settings.retryInterval)
    expect(logger.debug).toHaveBeenCalledWith('Retrying file in 5000 ms. Retry count: 3')
    jest.advanceTimersByTime(settings.retryInterval)

    expect(cache.northSendFilesCallback).toHaveBeenCalledWith(fileToSend)
    expect(cache.northSendFilesCallback).toHaveBeenCalledTimes(4)
    expect(cache.manageErroredFiles).toHaveBeenCalledTimes(1)
    expect(logger.debug).toHaveBeenCalledWith('Too many retries. The file won\'t be sent again.')
    expect(cache.manageErroredFiles).toHaveBeenCalledWith(fileToSend)
  })

  it('should successfully send files', async () => {
    const fileToSend = 'myFile'
    cache.getFileToSend = jest.fn(() => fileToSend)
    cache.northSendFilesCallback = jest.fn()
    cache.manageErroredFiles = jest.fn()
    cache.filesQueue = ['file1', 'myFile', 'file2']

    await cache.sendFile()
    jest.advanceTimersByTime(settings.sendInterval)
    await flushPromises()
    expect(cache.northSendFilesCallback).toHaveBeenCalledWith(fileToSend)
    expect(cache.northSendFilesCallback).toHaveBeenCalledTimes(2)
    expect(cache.manageErroredFiles).not.toHaveBeenCalled()
    expect(cache.filesQueue).toEqual(['file1', 'file2'])
  })

  it('should send file immediately', async () => {
    const fileToSend = 'myFile'
    cache.getFileToSend = jest.fn(() => fileToSend)
    cache.resetFilesTimeout = jest.fn()
    // handle file takes twice the sending interval time
    const promiseToResolve = new Promise((resolve) => {
      setTimeout(() => resolve(), settings.sendInterval * 2)
    })
    cache.northSendFilesCallback = jest.fn(() => promiseToResolve)

    cache.sendFile()
    jest.advanceTimersByTime(settings.sendInterval)
    expect(cache.sendNextImmediately).toBeFalsy()

    // Provoke an immediate sending request for next tick
    cache.sendFile()
    expect(logger.trace).toHaveBeenCalledWith('Already sending files...')
    expect(cache.sendNextImmediately).toBeTruthy()

    jest.advanceTimersByTime(settings.sendInterval)
    await flushPromises()

    expect(cache.northSendFilesCallback).toHaveBeenCalledTimes(1)
    expect(cache.northSendFilesCallback).toHaveBeenCalledWith(fileToSend)
    expect(cache.resetFilesTimeout).toHaveBeenCalledWith(100)

    await flushPromises()
  })

  it('should manage error in send file wrapper', async () => {
    cache.sendFile = jest.fn().mockImplementation(() => {
      throw new Error('send file error')
    })
    await cache.sendFileWrapper()
    expect(cache.sendFile).toHaveBeenCalled()
    expect(cache.logger.error).toHaveBeenCalledWith(new Error('send file error'))
  })

  it('should get file to send', async () => {
    cache.filesQueue = ['file1', 'file2']
    const file = await cache.getFileToSend()
    expect(file).toEqual(path.resolve(cache.fileFolder, 'file1'))

    cache.filesQueue = []
    const nullFile = await cache.getFileToSend()
    expect(nullFile).toBeNull()
  })

  it('should properly stop', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
    await cache.stop()
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
    expect(logger.debug).not.toHaveBeenCalled()

    cache.sendingFile$ = { promise: jest.fn() }
    clearTimeoutSpy.mockClear()
    await cache.stop()
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
    expect(logger.debug).toHaveBeenCalledWith('Waiting for connector to finish sending file...')
  })
})
