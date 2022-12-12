import path from 'node:path'
import fs from 'node:fs/promises'

import FileCache from './file-cache.service.js'

import { createFolder, asyncFilter, dirSize } from '../utils.js'

jest.mock('node:fs/promises')

// Mock logger
const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
}
jest.mock('../utils.js')
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
    dirSize.mockReturnValue(5)
    settings = { sendInterval: 1000, groupCount: 1000, maxSendCount: 10000, retryCount: 3, retryInterval: 5000, maxSize: 10 }

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

    expect(logger.debug).toHaveBeenCalledWith('Caching file "myFile.csv"... (cache size : 0 MB)')
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

  fit('should send file immediately', async () => {
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

  it('should return empty file list when the error folder is empty', async () => {
    const fromDate = '2022-11-11T11:11:11.111'
    const toDate = '2022-11-12T11:11:11.111'
    const nameFilter = 'ile'
    const pageNumber = 1
    cache.getFiles = jest.fn().mockReturnValue([])

    const result = await cache.getErrorFiles(fromDate, toDate, nameFilter, pageNumber)
    expect(cache.getFiles).toBeCalledWith(cache.errorFolder)
    expect(result).toEqual([])
  })

  it('should return filtered file list when the error folder is not empty', async () => {
    const nameFilter = 'ile'
    const fromDate = '2022-11-11T11:11:11.111'
    const toDate = '2022-11-12T11:11:11.111'
    const pageNumber = 1
    const filenames = ['file1.name', 'file2.name', 'file3.name']
    cache.getFiles = jest.fn().mockReturnValue(Promise.resolve(filenames))
    asyncFilter.mockReturnValue(['file1.name', 'file2.name'])

    const result = await cache.getErrorFiles(fromDate, toDate, nameFilter, pageNumber)
    expect(cache.getFiles).toBeCalledWith(cache.errorFolder)
    expect(asyncFilter).toHaveBeenCalled()
    expect(result).toEqual(['file1.name', 'file2.name'])
  })

  it('should remove error files', async () => {
    const filenames = ['file1.name', 'file2.name', 'file3.name']

    await cache.removeErrorFiles(filenames)
    expect(fs.unlink).toHaveBeenNthCalledWith(1, path.join(cache.errorFolder, filenames[0]))
    expect(fs.unlink).toHaveBeenNthCalledWith(2, path.join(cache.errorFolder, filenames[1]))
    expect(fs.unlink).toHaveBeenNthCalledWith(3, path.join(cache.errorFolder, filenames[2]))
  })

  it('should retry error files', async () => {
    const filenames = ['file1.name', 'file2.name', 'file3.name']

    await cache.retryErrorFiles(filenames)
    expect(fs.rename).toHaveBeenNthCalledWith(1, path.join(cache.errorFolder, filenames[0]), path.join(cache.fileFolder, filenames[0]))
    expect(fs.rename).toHaveBeenNthCalledWith(2, path.join(cache.errorFolder, filenames[1]), path.join(cache.fileFolder, filenames[1]))
    expect(fs.rename).toHaveBeenNthCalledWith(3, path.join(cache.errorFolder, filenames[2]), path.join(cache.fileFolder, filenames[2]))
  })

  it('should remove all error files when the error folder is not empty', async () => {
    const filenames = ['file1.name', 'file2.name', 'file3.name']
    cache.getFiles = jest.fn().mockReturnValue(Promise.resolve(filenames))
    cache.removeErrorFiles = jest.fn()

    await cache.removeAllErrorFiles()
    expect(cache.removeErrorFiles).toHaveBeenCalledWith(filenames)
  })

  it('should not remove any error file when the error folder is empty', async () => {
    cache.getFiles = jest.fn().mockReturnValue(Promise.resolve([]))
    cache.removeErrorFiles = jest.fn()

    await cache.removeAllErrorFiles()
    expect(cache.removeErrorFiles).not.toHaveBeenCalled()
  })

  it('should retry all error files when the error folder is not empty', async () => {
    const filenames = ['file1.name', 'file2.name', 'file3.name']
    cache.getFiles = jest.fn().mockReturnValue(Promise.resolve(filenames))
    cache.retryErrorFiles = jest.fn()

    await cache.retryAllErrorFiles()
    expect(cache.retryErrorFiles).toHaveBeenCalledWith(filenames)
  })

  it('should not remove any error file when the error folder is empty', async () => {
    cache.getFiles = jest.fn().mockReturnValue(Promise.resolve([]))
    cache.retryErrorFiles = jest.fn()

    await cache.retryAllErrorFiles()
    expect(cache.retryErrorFiles).not.toHaveBeenCalled()
  })

  it('should get files from a folder', async () => {
    const folder = 'folder'
    const filenames = ['file1.name', 'file2.name']
    fs.readdir = jest.fn().mockReturnValue(filenames)

    const result = await cache.getFiles(folder)
    expect(fs.readdir).toHaveBeenCalledWith(folder)
    expect(result).toEqual(filenames)
  })

  it('should match file with date and name', async () => {
    const folder = 'folder'
    const filename = 'file.name'
    const fromDate = '2022-11-11T11:11:11.111'
    const toDate = '2022-11-12T11:11:11.111'
    fs.stat = jest.fn().mockReturnValue({ mtimeMs: new Date('2022-11-12T00:00:00.000').getTime() })

    const match = await cache.matchFile(folder, filename, fromDate, toDate, 'ile')
    expect(fs.stat).toBeCalledWith(path.join(folder, filename))
    expect(match).toBeTruthy()
  })

  it('should not match file without date match', async () => {
    const folder = 'folder'
    const filename = 'file.name'
    const fromDate = '2022-11-11T11:11:11.111'
    const toDate = '2022-11-12T11:11:11.111'
    fs.stat = jest.fn().mockReturnValue({ mtimeMs: new Date('2022-11-13T00:00:00.000').getTime() })

    const match = await cache.matchFile(folder, filename, fromDate, toDate, 'ile')
    expect(fs.stat).toBeCalledWith(path.join(folder, filename))
    expect(match).toBeFalsy()
  })

  it('should not match file without name match', async () => {
    const folder = 'folder'
    const filename = 'file.name'
    const fromDate = '2022-11-11T11:11:11.111'
    const toDate = '2022-11-12T11:11:11.111'
    fs.stat = jest.fn().mockReturnValue({ mtimeMs: new Date('2022-11-13T00:00:00.000').getTime() })

    const match = await cache.matchFile(folder, filename, fromDate, toDate, 'noMatch')
    expect(fs.stat).toBeCalledWith(path.join(folder, filename))
    expect(match).toBeFalsy()
  })
})
