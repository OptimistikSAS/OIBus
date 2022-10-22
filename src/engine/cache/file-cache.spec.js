const path = require('node:path')
const fs = require('node:fs/promises')

const FileCache = require('./file-cache')

const { createFolder } = require('../../service/utils')

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
// Method used to flush promises called in setTimeout
const flushPromises = () => new Promise(jest.requireActual('timers').setImmediate)
const nowDateString = '2020-02-02T02:02:02.222Z'
let cache = null
describe('FileCache', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    cache = new FileCache('northId', logger, 'myCacheFolder', true, 1)
  })

  it('should be properly initialized with files in cache', async () => {
    cache.refreshArchiveFolder = jest.fn()
    fs.readdir.mockImplementation(() => ['file1'])
    await cache.init()
    expect(cache.northId).toEqual('northId')
    expect(cache.baseFolder).toEqual('myCacheFolder')
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files'))
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'errors'))
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'archive'))

    expect(logger.debug).toHaveBeenCalledWith('1 files in cache.')
    expect(logger.warn).toHaveBeenCalledWith('1 files in error cache.')

    expect(cache.refreshArchiveFolder).toHaveBeenCalledTimes(1)
  })

  it('should be properly initialized without files in cache', async () => {
    cache.refreshArchiveFolder = jest.fn()
    fs.readdir.mockImplementation(() => [])
    cache.retentionDuration = 0
    await cache.init()
    expect(cache.northId).toEqual('northId')
    expect(cache.baseFolder).toEqual('myCacheFolder')
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files'))
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'errors'))
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'archive'))

    expect(logger.debug).toHaveBeenCalledWith('No files in cache.')
    expect(logger.debug).toHaveBeenCalledWith('No error files in cache.')

    expect(cache.refreshArchiveFolder).not.toHaveBeenCalled()
  })

  it('should be properly initialized with a readdir error', async () => {
    cache.refreshArchiveFolder = jest.fn()
    fs.readdir.mockImplementation(() => {
      throw new Error('readdir error')
    })
    cache.retentionDuration = 0
    await cache.init()

    expect(logger.error).toHaveBeenCalledWith(new Error('readdir error'))
    expect(logger.error).toHaveBeenCalledTimes(2)

    expect(cache.refreshArchiveFolder).not.toHaveBeenCalled()
  })

  it('should be properly initialized without archive files', async () => {
    cache.archiveFiles = false
    cache.refreshArchiveFolder = jest.fn()
    fs.readdir.mockImplementation(() => [])
    cache.retentionDuration = 0
    await cache.init()
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files'))
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'errors'))
    expect(createFolder).toHaveBeenCalledTimes(2)

    expect(cache.refreshArchiveFolder).not.toHaveBeenCalled()
  })

  it('should properly stop', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

    cache.stop()
    expect(clearTimeoutSpy).not.toHaveBeenCalled()

    cache.archiveTimeout = 1
    cache.stop()
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1)
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

  it('should properly move file from cache to archive folder', async () => {
    fs.rename.mockImplementationOnce(() => {}).mockImplementationOnce(() => {
      throw new Error('rename error')
    })

    await cache.removeFileFromCache('myFile.csv', true)
    expect(logger.debug).toHaveBeenCalledWith(`File "myFile.csv" moved to "${path.resolve(cache.archiveFolder, 'myFile.csv')}".`)

    await cache.removeFileFromCache('myFile.csv', true)
    expect(logger.error).toHaveBeenCalledWith(new Error('rename error'))
  })

  it('should properly remove file from cache', async () => {
    fs.unlink.mockImplementationOnce(() => {}).mockImplementationOnce(() => {
      throw new Error('unlink error')
    })

    await cache.removeFileFromCache('myFile.csv', false)
    expect(logger.debug).toHaveBeenCalledWith('File "myFile.csv" removed from disk.')

    await cache.removeFileFromCache('myFile.csv', false)
    expect(logger.error).toHaveBeenCalledWith(new Error('unlink error'))
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

  it('should refresh archive folder', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')

    fs.readdir.mockImplementationOnce(() => []).mockImplementation(() => ['myFile1', 'myFile2'])
    cache.removeFileIfTooOld = jest.fn()

    await cache.refreshArchiveFolder()
    expect(clearTimeoutSpy).not.toHaveBeenCalled()
    expect(logger.debug).toHaveBeenCalledWith('Parse archive folder to remove old files.')
    expect(logger.debug).toHaveBeenCalledWith(`The archive folder "${path.resolve('myCacheFolder', 'archive')}" is empty. Nothing to delete.`)

    jest.advanceTimersByTime(3600000)
    await flushPromises()

    expect(cache.removeFileIfTooOld).toHaveBeenCalledTimes(2)
  })

  it('should manage archive folder readdir error', async () => {
    fs.readdir.mockImplementationOnce(() => {
      throw new Error('readdir error')
    })
    cache.removeFileIfTooOld = jest.fn()

    await cache.refreshArchiveFolder()
    expect(cache.removeFileIfTooOld).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(new Error('readdir error'))
  })

  it('should remove file if too old', async () => {
    fs.stat.mockImplementationOnce(() => ({ mtimeMs: new Date('2020-02-01T02:02:02.222Z').getTime() }))
      .mockImplementationOnce(() => ({ mtimeMs: new Date('2020-02-02T02:02:01.222Z').getTime() }))

    await cache.removeFileIfTooOld('myOldFile.csv', new Date(), 'archiveFolder')
    expect(fs.unlink).toHaveBeenCalledWith(path.join('archiveFolder', 'myOldFile.csv'))
    expect(logger.debug).toHaveBeenCalledWith(`File "${path.join('archiveFolder', 'myOldFile.csv')}" removed from archive.`)
    await cache.removeFileIfTooOld('myNewFile.csv', new Date(), 'archiveFolder')
    expect(logger.debug).toHaveBeenCalledTimes(1)
    expect(fs.unlink).toHaveBeenCalledTimes(1)
  })

  it('should log an error if can not remove old file', async () => {
    fs.stat.mockImplementationOnce(() => ({ mtimeMs: new Date('2020-02-01T02:02:02.222Z').getTime() }))
    fs.unlink.mockImplementationOnce(() => {
      throw new Error('unlink error')
    })

    await cache.removeFileIfTooOld('myOldFile.csv', new Date(), 'archiveFolder')
    expect(logger.error).toHaveBeenCalledWith(new Error('unlink error'))
  })

  it('should log an error if a problem occur accessing the file', async () => {
    fs.stat.mockImplementationOnce(() => {
      throw new Error('stat error')
    })

    await cache.removeFileIfTooOld('myOldFile.csv', new Date(), 'archiveFolder')
    expect(fs.unlink).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(new Error('stat error'))
    expect(logger.error).toHaveBeenCalledTimes(1)
  })
})
