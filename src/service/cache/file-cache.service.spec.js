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
const nowDateString = '2020-02-02T02:02:02.222Z'
let cache = null
describe('FileCache', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    cache = new FileCache('northId', logger, 'myCacheFolder', true, 1)
  })

  it('should be properly initialized with files in cache', async () => {
    fs.readdir.mockImplementation(() => ['file1'])
    await cache.start()
    expect(cache.northId).toEqual('northId')
    expect(cache.baseFolder).toEqual('myCacheFolder')
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files'))
    expect(createFolder).toHaveBeenCalledWith(path.resolve('myCacheFolder', 'files-errors'))

    expect(logger.debug).toHaveBeenCalledWith('1 files in cache.')
    expect(logger.warn).toHaveBeenCalledWith('1 files in error cache.')
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

  it('should be properly initialized with a readdir error', async () => {
    fs.readdir.mockImplementation(() => {
      throw new Error('readdir error')
    })
    await cache.start()

    expect(logger.error).toHaveBeenCalledWith(new Error('readdir error'))
    expect(logger.error).toHaveBeenCalledTimes(2)
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
})
