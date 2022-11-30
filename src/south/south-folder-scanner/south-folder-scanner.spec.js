import fs from 'node:fs/promises'
import path from 'node:path'

import FolderScanner from './south-folder-scanner.js'

import * as databaseService from '../../service/database.service.js'

import * as utils from '../../service/utils.js'

// Mock utils class
jest.mock('../../service/utils')

const addValues = jest.fn()
const addFiles = jest.fn()

// Mock fs
jest.mock('node:fs/promises')

// Mock services
jest.mock('../../service/database.service')
jest.mock('../../service/status.service')
jest.mock('../../service/encryption.service', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))

// Mock logger
const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
}

const nowDateString = '2020-02-02T02:02:02.222Z'
let configuration = null
let south = null

describe('SouthFolderScanner', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    configuration = {
      id: 'southId',
      name: 'FolderScanner',
      type: 'FolderScanner',
      enabled: true,
      settings: {
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
    south = new FolderScanner(configuration, {}, addValues, addFiles, logger)
    await south.start('baseFolder', 'oibusName')
    databaseService.getConfig.mockClear()
  })

  it('should connect properly', async () => {
    await south.connect()
    expect(databaseService.createConfigDatabase).toHaveBeenCalledWith(path.resolve(`baseFolder/south-${configuration.id}/cache.db`))
  })

  it('fileQuery should exit if the input folder does not exist', async () => {
    south.inputFolder = 'badfolder'

    fs.readdir.mockImplementationOnce(() => {
      throw new Error('test')
    })
    await expect(south.fileQuery('xxx')).rejects.toThrowError('test')

    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(addFiles).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })

  it('fileQuery should exit if the input folder is empty', async () => {
    fs.readdir.mockImplementation(() => Promise.resolve([]))
    await south.fileQuery('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(addFiles).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
    expect(south.logger.debug).toHaveBeenCalledTimes(1)
  })

  it('fileQuery should exit if the file does not match the regex', async () => {
    fs.readdir.mockImplementation(() => Promise.resolve(['badfile']))
    await south.fileQuery('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(addFiles).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })

  it('fileQuery should exit if the file is not old enough', async () => {
    fs.readdir.mockImplementation(() => Promise.resolve(['test.csv']))
    fs.stat.mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() + 666 }))
    await south.fileQuery('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(addFiles).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })

  it('fileQuery should not add the file to cache it matches conditions with preserveFiles true and has already been sent', async () => {
    south.preserveFiles = true
    fs.readdir.mockImplementation(() => Promise.resolve(['test.csv']))
    fs.stat.mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    databaseService.getConfig.mockImplementation(() => new Date().getTime())
    await south.fileQuery('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(addFiles).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })

  it('fileQuery should add the file to cache if it matches conditions with preserveFiles false and compression false', async () => {
    fs.readdir.mockImplementation(() => Promise.resolve(['test.csv']))
    fs.stat.mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    south.preserveFiles = false
    await south.fileQuery('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(addFiles).toHaveBeenCalledWith(
      south.id,
      path.join(south.inputFolder, 'test.csv'),
      false,
    )
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })

  it('fileQuery should add the file to cache if it matches conditions with preserveFiles true and compression false', async () => {
    south.preserveFiles = true
    fs.readdir.mockImplementation(() => Promise.resolve(['test.csv']))
    fs.stat.mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    databaseService.getConfig.mockImplementation(() => new Date().getTime() - 25 * 3600 * 1000)
    await south.fileQuery('xxx')

    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(addFiles).toHaveBeenCalledWith(
      south.id,
      path.join(south.inputFolder, 'test.csv'),
      true,
    )
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(1)
  })

  it('fileQuery should add the file to cache if it matches conditions with preserveFiles true and ignoreModifiedDate true', async () => {
    south.preserveFiles = true
    south.ignoreModifiedDate = true
    fs.readdir.mockImplementation(() => Promise.resolve(['test.csv']))
    fs.stat.mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    databaseService.getConfig.mockImplementation(() => new Date().getTime() - 25 * 3600 * 1000)
    await south.fileQuery('xxx')

    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(addFiles).toHaveBeenCalledWith(
      south.id,
      path.join(south.inputFolder, 'test.csv'),
      true,
    )
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(1)
    south.ignoreModifiedDate = false
  })

  it('fileQuery should add the file to cache if it matches conditions with preserveFiles false and compression true', async () => {
    fs.stat.mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    fs.readdir.mockImplementation(() => Promise.resolve([
      'myFirstFile.csv',
    ]))
    south.preserveFiles = false
    south.compression = true

    await south.fileQuery('xxx')

    expect(utils.compress).toHaveBeenCalledTimes(1)
    expect(addFiles).toHaveBeenCalledWith(
      south.id,
      path.resolve(south.inputFolder, 'myFirstFile.csv.gz'),
      false,
    )
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })

  it('fileQuery should add the raw file if compression fails', async () => {
    fs.stat.mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    fs.readdir.mockImplementation(() => Promise.resolve([
      'myFirstFile.csv',
    ]))
    utils.compress.mockImplementation(() => {
      throw new Error('compression error')
    })
    south.preserveFiles = false
    south.compression = true

    await south.fileQuery('xxx')

    expect(utils.compress).toHaveBeenCalledTimes(1)
    expect(south.logger.error).toHaveBeenCalledWith('Error compressing file "myFirstFile.csv". Sending it raw instead.')

    expect(addFiles).toHaveBeenCalledWith(
      south.id,
      path.resolve(south.inputFolder, 'myFirstFile.csv'),
      false,
    )
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })

  it('fileQuery should properly send file if unlink fails after compression', async () => {
    fs.stat.mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    fs.readdir.mockImplementation(() => Promise.resolve([
      'myFirstFile.csv',
    ]))
    fs.unlink.mockImplementation(() => {
      throw new Error('unlink error')
    })
    south.preserveFiles = false
    south.compression = true

    await south.fileQuery('xxx')

    expect(utils.compress).toHaveBeenCalledTimes(1)
    expect(south.logger.error).toHaveBeenCalledWith(new Error('unlink error'))

    expect(addFiles).toHaveBeenCalledWith(
      south.id,
      path.resolve(south.inputFolder, 'myFirstFile.csv.gz'),
      false,
    )
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })

  it('fileQuery should add the file to cache if it matches conditions with preserveFiles true and compression true', async () => {
    fs.stat.mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    fs.readdir.mockImplementation(() => Promise.resolve([
      'myFirstFile.csv',
    ]))
    databaseService.getConfig.mockImplementation(() => new Date().getTime() - 25 * 3600 * 1000)

    south.preserveFiles = true
    south.compression = true

    await south.fileQuery('xxx')

    expect(utils.compress).toHaveBeenCalledTimes(1)
    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(addFiles).toHaveBeenCalledWith(
      south.id,
      path.join(south.inputFolder, 'myFirstFile.csv.gz'),
      false,
    )
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(1)
  })
})
