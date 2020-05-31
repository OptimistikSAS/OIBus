const fs = require('fs')

const FolderScanner = require('./FolderScanner.class')
const databaseService = require('../../services/database.service')
const config = require('../../../tests/testConfig').default

// Mock engine
const engine = {
  configService: { getConfig: () => ({ engineConfig: config.engine }) },
  addFile: jest.fn(),
}

// Mock database service
jest.mock('../../services/database.service', () => ({
  // createConfigDatabase: jest.fn(() => 'configDatabase'),
  createFolderScannerDatabase: jest.fn(() => 'createFolderScannerDatabase'),
  upsertFolderScanner: jest.fn(),
  getFolderScannerModifyTime: () => Promise.resolve(new Date('2000-01-01T12:00:00.000Z')),
}))

beforeEach(() => {
  jest.resetAllMocks()
})

const folderScanner = new FolderScanner(config.south.dataSources[5], engine)

describe('folder-scanner', () => {
  it('should connect properly', () => {
    folderScanner.connect()
    expect(databaseService.createFolderScannerDatabase).toHaveBeenCalledWith('./cache/FolderScanner.db')
  })
  it('onScan: should exit if folder does not exist', () => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => false)
    folderScanner.onScan('xxx')
    expect(databaseService.createFolderScannerDatabase).toHaveBeenCalledTimes(0)
  })
  it('onScan: should exit if folder does not exist', () => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => false)
    folderScanner.onScan('xxx')
    expect(databaseService.createFolderScannerDatabase).toHaveBeenCalledTimes(0)
  })
  it('onScan: should exit if folder is empty', () => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true)
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => [])
    folderScanner.onScan('xxx')
    expect(databaseService.createFolderScannerDatabase).toHaveBeenCalledTimes(0)
  })
  it('onScan: should exit if file does not match regex', () => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true)
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => ['badfile'])
    jest.spyOn(fs, 'existsSync').mockImplementation(() => false)
    folderScanner.onScan('xxx')
    expect(databaseService.createFolderScannerDatabase).toHaveBeenCalledTimes(0)
  })
  /*
  it('onScan: should addFile() if file match conditions', () => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => true)
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => ['file.txt'])
    jest.spyOn(fs, 'statSync').mockImplementation(() => ({ mtimeMs: new Date('2030-01-01T12:00:00.000Z') }))
    folderScanner.onScan('xxx')
    // folderScanner.addFile = jest.fn()
    // expect(folderScanner.addFile).toHaveBeenCalled()
    expect(databaseService.upsertFolderScanner).toHaveBeenCalledTimes(1)
  })
  */
})
