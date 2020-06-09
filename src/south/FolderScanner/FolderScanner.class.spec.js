const fs = require('fs')

const FolderScanner = require('./FolderScanner.class')
const databaseService = require('../../services/database.service')
const config = require('../../../tests/testConfig').default

// Mock engine
const engine = jest.genMockFromModule('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }

// Mock the logger
jest.mock('../../engine/Logger.class', () => (function logger() {
  return {
    silly: () => jest.fn(),
    debug: () => jest.fn(),
    info: () => jest.fn(),
    error: () => jest.fn(),
    warn: () => jest.fn(),
  }
}))

// Mock database service
jest.mock('../../services/database.service')
/*
 databaseService = {
  createFolderScannerDatabase: jest.fn(),
  upsertFolderScanner: jest.fn(() => { throw (new Error('dberr')) }).mockName('upsertFolderScanner'),
  getFolderScannerModifyTime: () => Promise.resolve(new Date('2000-01-01T12:00:00.000Z')),
}

*/
beforeEach(() => {
  // Clears mock.calls and mock.instances before each it()
  jest.clearAllMocks()
})

const folderScanner = new FolderScanner(config.south.dataSources[5], engine)
folderScanner.addFile = jest.fn()

describe('folder-scanner', () => {
  it('should connect properly', () => {
    folderScanner.connect()
    expect(databaseService.createFolderScannerDatabase).toHaveBeenCalledWith('./cache/FolderScanner.db')
  })
  it('onScan: should exit if folder does not exist', () => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => false)
    jest.spyOn(fs, 'readdirSync')
    folderScanner.onScan('xxx')
    expect(fs.readdirSync).toHaveBeenCalledTimes(0)
  })
  it('onScan: should catch readdirSync error if folder is not readable', () => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true)
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => { throw new Error() })
    jest.spyOn(folderScanner, 'checkConditions')
    jest.spyOn(folderScanner.logger, 'error')
    folderScanner.onScan('xxx')
    expect(fs.readdirSync).toHaveBeenCalledTimes(1)
    expect(folderScanner.checkConditions).toHaveBeenCalledTimes(0)
    expect(folderScanner.logger.error).toHaveBeenCalledTimes(1)
  })
  it('onScan: should exit if folder is empty', () => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true)
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => [])
    jest.spyOn(folderScanner, 'checkConditions')
    folderScanner.onScan('xxx')
    expect(folderScanner.checkConditions).toHaveBeenCalledTimes(0)
  })
  it('onScan: should exit if file does not match regex', () => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true)
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => ['badfile'])
    jest.spyOn(folderScanner, 'checkConditions')
    jest.spyOn(folderScanner, 'sendFile')
    folderScanner.onScan('xxx')
    expect(folderScanner.checkConditions).toHaveBeenCalledTimes(1)
    expect(folderScanner.sendFile).toHaveBeenCalledTimes(0)
  })
  it('onScan: should addFile() if file match conditions with preserveFiles true', async () => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true)
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => ['file.txt'])
    jest.spyOn(fs, 'statSync').mockImplementation(() => ({ mtimeMs: new Date('2030-01-01T12:00:00.000Z') }))
    folderScanner.onScan('xxx')
    // flush promises see https://stackoverflow.com/a/51045733/6763331
    // need because addFile is in async loop and can happen after onScan.
    await new Promise(setImmediate)
    expect(folderScanner.addFile).toHaveBeenCalled()
    expect(databaseService.upsertFolderScanner).toHaveBeenCalledTimes(1)
  })
  it('onScan: should addFile() if file match conditions with preserveFiles false', async () => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true)
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => ['file.txt'])
    jest.spyOn(fs, 'statSync').mockImplementation(() => ({ mtimeMs: new Date('2030-01-01T12:00:00.000Z') }))
    folderScanner.preserveFiles = false
    folderScanner.onScan('xxx')
    // flush promises see https://stackoverflow.com/a/51045733/6763331
    // need because addFile is in async loop and can happen after onScan.
    await new Promise(setImmediate)
    expect(folderScanner.addFile).toHaveBeenCalled()
    expect(databaseService.upsertFolderScanner).toHaveBeenCalledTimes(0)
  })
})
