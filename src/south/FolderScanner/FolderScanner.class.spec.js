const fs = require('node:fs/promises')
const path = require('node:path')

const FolderScanner = require('./FolderScanner.class')

const databaseService = require('../../services/database.service')

const { defaultConfig: config } = require('../../../tests/testConfig')
const utils = require('../../services/utils')

// Mock utils class
jest.mock('../../services/utils', () => ({ compress: jest.fn() }))

// Mock OIBusEngine
const engine = {
  configService: { getConfig: () => ({ engineConfig: config.engine }) },
  getCacheFolder: () => config.engine.caching.cacheFolder,
  addValues: jest.fn(),
  addFile: jest.fn(),
}

// Mock services
jest.mock('../../services/database.service')
jest.mock('../../engine/logger/Logger.class')
jest.mock('../../services/status.service.class')
jest.mock('../../services/EncryptionService.class', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))

const nowDateString = '2020-02-02T02:02:02.222Z'
let settings = null
let south = null

describe('South FolderScanner', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    settings = {
      id: 'southId',
      name: 'FolderScanner',
      protocol: 'FolderScanner',
      enabled: true,
      FolderScanner: {
        preserveFiles: true,
        ignoreModifiedDate: false,
        minAge: 0,
        inputFolder: './input/',
        scanMode: 'every5Second',
        regex: '.*.csv',
        compression: false,
      },
      points: [],
      scanMode: 'every10Second',
    }
    south = new FolderScanner(settings, engine)
    await south.init()
    databaseService.getConfig.mockClear()
  })

  it('should connect properly', async () => {
    await south.connect()
    expect(databaseService.createConfigDatabase).toHaveBeenCalledWith(`./cache/${settings.id}.db`)
  })

  it('fileQuery should exit if the input folder does not exist', async () => {
    south.inputFolder = 'badfolder'

    jest.spyOn(fs, 'readdir').mockImplementationOnce(() => {
      throw new Error('test')
    })
    await expect(south.fileQuery('xxx')).rejects.toThrowError('test')

    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(south.engine.addFile).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })

  it('fileQuery should exit if the input folder is empty', async () => {
    jest.spyOn(fs, 'readdir').mockImplementation(() => Promise.resolve([]))
    await south.fileQuery('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(south.engine.addFile).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
    expect(south.logger.debug).toHaveBeenCalledTimes(1)
  })

  it('fileQuery should exit if the file does not match the regex', async () => {
    jest.spyOn(fs, 'readdir').mockImplementation(() => Promise.resolve(['badfile']))
    await south.fileQuery('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(south.engine.addFile).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })

  it('fileQuery should exit if the file is not old enough', async () => {
    jest.spyOn(fs, 'readdir').mockImplementation(() => Promise.resolve(['test.csv']))
    jest.spyOn(fs, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() + 666 }))
    await south.fileQuery('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(south.engine.addFile).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })

  it('fileQuery should not add the file to cache it matches conditions with preserveFiles true and has already been sent', async () => {
    south.preserveFiles = true
    jest.spyOn(fs, 'readdir').mockImplementation(() => Promise.resolve(['test.csv']))
    jest.spyOn(fs, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    databaseService.getConfig.mockImplementation(() => new Date().getTime())
    await south.fileQuery('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(south.engine.addFile).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })

  it('fileQuery should add the file to cache if it matches conditions with preserveFiles false and compression false', async () => {
    jest.spyOn(fs, 'readdir').mockImplementation(() => Promise.resolve(['test.csv']))
    jest.spyOn(fs, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    south.preserveFiles = false
    await south.fileQuery('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(engine.addFile).toHaveBeenCalledWith(
      south.settings.id,
      path.join(south.inputFolder, 'test.csv'),
      false,
    )
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })

  it('fileQuery should add the file to cache if it matches conditions with preserveFiles true and compression false', async () => {
    south.preserveFiles = true
    jest.spyOn(fs, 'readdir').mockImplementation(() => Promise.resolve(['test.csv']))
    jest.spyOn(fs, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    databaseService.getConfig.mockImplementation(() => new Date().getTime() - 25 * 3600 * 1000)
    await south.fileQuery('xxx')

    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(south.engine.addFile).toHaveBeenCalledWith(
      south.settings.id,
      path.join(south.inputFolder, 'test.csv'),
      true,
    )
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(1)
  })

  it('fileQuery should add the file to cache if it matches conditions with preserveFiles true and ignoreModifiedDate true', async () => {
    south.preserveFiles = true
    south.ignoreModifiedDate = true
    jest.spyOn(fs, 'readdir').mockImplementation(() => Promise.resolve(['test.csv']))
    jest.spyOn(fs, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    databaseService.getConfig.mockImplementation(() => new Date().getTime() - 25 * 3600 * 1000)
    await south.fileQuery('xxx')

    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(engine.addFile).toHaveBeenCalledWith(
      south.settings.id,
      path.join(south.inputFolder, 'test.csv'),
      true,
    )
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(1)
    south.ignoreModifiedDate = false
  })

  it('fileQuery should add the file to cache if it matches conditions with preserveFiles false and compression true', async () => {
    jest.spyOn(fs, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    jest.spyOn(fs, 'readdir').mockImplementation(() => Promise.resolve([
      'myFirstFile.csv',
    ]))

    south.preserveFiles = false
    south.compression = true

    await south.fileQuery('xxx')

    expect(utils.compress).toHaveBeenCalledTimes(1)
    expect(engine.addFile).toHaveBeenCalledWith(
      south.settings.id,
      path.resolve(south.inputFolder, 'myFirstFile.csv.gz'),
      false,
    )
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })

  it('fileQuery should add the file to cache if it matches conditions with preserveFiles true and compression true', async () => {
    jest.spyOn(fs, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    jest.spyOn(fs, 'readdir').mockImplementation(() => Promise.resolve([
      'myFirstFile.csv',
    ]))
    databaseService.getConfig.mockImplementation(() => new Date().getTime() - 25 * 3600 * 1000)

    south.preserveFiles = true
    south.compression = true

    await south.fileQuery('xxx')

    expect(utils.compress).toHaveBeenCalledTimes(1)
    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(engine.addFile).toHaveBeenCalledWith(
      south.settings.id,
      path.join(south.inputFolder, 'myFirstFile.csv.gz'),
      false,
    )
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(1)
  })
})
