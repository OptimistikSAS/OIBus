const fs = require('fs')
const path = require('path')

const FolderScanner = require('./FolderScanner.class')
const databaseService = require('../../services/database.service')
const config = require('../../../tests/testConfig').default

// Mock engine
const engine = jest.genMockFromModule('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.addFile = jest.fn()

// Mock the logger
jest.mock('../../engine/Logger.class')

// Mock database service
jest.mock('../../services/database.service')

beforeEach(() => {
  // Clears mock.calls and mock.instances before each it()
  jest.clearAllMocks()
  jest.resetAllMocks()
  jest.restoreAllMocks()
})

const folderScanner = new FolderScanner(config.south.dataSources[6], engine)

describe('folder-scanner', () => {
  it('should connect properly', async () => {
    await folderScanner.connect()
    expect(databaseService.createConfigDatabase).toHaveBeenCalledWith('./cache/FolderScanner.db')
  })
  it('onScan: should exit if folder does not exist', () => {
    jest.spyOn(fs, 'accessSync').mockImplementationOnce(() => {
      throw new Error('test')
    })
    jest.spyOn(fs, 'readdirSync').mockImplementationOnce(() => {
      throw new Error('test')
    })
    folderScanner.onScanImplementation('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(folderScanner.engine.addFile).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
    expect(folderScanner.logger.error).toHaveBeenCalledTimes(2)
  })
  it('onScan: should catch readdirSync error if folder is not readable', () => {
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => { throw new Error() })
    folderScanner.onScanImplementation('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(folderScanner.engine.addFile).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })
  it('onScan: should exit if folder is empty', () => {
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => [])
    folderScanner.onScanImplementation('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(folderScanner.engine.addFile).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })
  it('onScan: should exit if file does not match regex', () => {
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => ['badfile'])
    folderScanner.onScanImplementation('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(folderScanner.engine.addFile).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })
  it('onScan: should exit if file is not old enough', () => {
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => ['test.csv'])
    jest.spyOn(fs, 'statSync').mockImplementation(() => ({ mtimeMs: new Date().getTime() + 666 }))
    folderScanner.onScanImplementation('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(folderScanner.engine.addFile).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })
  it('onScan: should not addFile() if file match conditions with preserveFiles true and already sent', async () => {
    folderScanner.preserveFiles = true
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => ['test.csv'])
    jest.spyOn(fs, 'statSync').mockImplementation(() => ({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    databaseService.getConfig.mockImplementation(() => new Date().getTime())
    folderScanner.onScanImplementation('xxx')
    // flush promises see https://stackoverflow.com/a/51045733/6763331
    // need because addFile is in async loop and can happen after onScan.
    await new Promise(setImmediate)
    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(folderScanner.engine.addFile).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })
  it('onScan: should addFile() if file match conditions with preserveFiles false and compression false', async () => {
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => ['test.csv'])
    jest.spyOn(fs, 'statSync').mockImplementation(() => ({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    folderScanner.preserveFiles = false
    await folderScanner.onScanImplementation('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(folderScanner.engine.addFile).toHaveBeenCalledWith(
      folderScanner.dataSource.dataSourceId,
      path.join(folderScanner.inputFolder, 'test.csv'),
      false,
    )
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })
  it('onScan: should addFile() if file match conditions with preserveFiles true and compression false', async () => {
    folderScanner.preserveFiles = true
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => ['test.csv'])
    jest.spyOn(fs, 'statSync').mockImplementation(() => ({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    databaseService.getConfig.mockImplementation(() => new Date().getTime() - 25 * 3600 * 1000)
    folderScanner.onScanImplementation('xxx')
    // flush promises see https://stackoverflow.com/a/51045733/6763331
    // need because addFile is in async loop and can happen after onScan.
    await new Promise(setImmediate)
    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(folderScanner.engine.addFile).toHaveBeenCalledWith(
      folderScanner.dataSource.dataSourceId,
      path.join(folderScanner.inputFolder, 'test.csv'),
      true,
    )
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(1)
  })
  it('onScan: should addFile() if file match conditions with preserveFiles true and ignoreModifiedDate true', async () => {
    folderScanner.preserveFiles = true
    folderScanner.ignoreModifiedDate = true
    jest.spyOn(fs, 'readdirSync').mockImplementation(() => ['test.csv'])
    jest.spyOn(fs, 'statSync').mockImplementation(() => ({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    databaseService.getConfig.mockImplementation(() => new Date().getTime() - 25 * 3600 * 1000)
    folderScanner.onScanImplementation('xxx')
    // flush promises see https://stackoverflow.com/a/51045733/6763331
    // need because addFile is in async loop and can happen after onScan.
    await new Promise(setImmediate)
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(folderScanner.engine.addFile).toHaveBeenCalledWith(
      folderScanner.dataSource.dataSourceId,
      path.join(folderScanner.inputFolder, 'test.csv'),
      true,
    )
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(1)
    folderScanner.ignoreModifiedDate = false
  })
  it('onScan: should addFile() if file match conditions with preserveFiles false and compression true', async () => {
    jest.spyOn(fs, 'statSync').mockImplementation(() => ({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))

    const referenceCsv = path.resolve('./tests/test.csv')
    const targetCsv = path.join(folderScanner.inputFolder, 'test.csv')
    const targetGzip = path.join(folderScanner.inputFolder, 'test.csv.gz')

    fs.mkdirSync(folderScanner.inputFolder, { recursive: true })
    fs.copyFileSync(referenceCsv, targetCsv)
    folderScanner.preserveFiles = false
    folderScanner.compression = true

    await folderScanner.onScanImplementation('xxx')

    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(folderScanner.engine.addFile).toHaveBeenCalledWith(folderScanner.dataSource.dataSourceId, targetGzip, false)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)

    const decompressedCsv = path.join(folderScanner.inputFolder, 'decompressed.csv')
    await folderScanner.decompress(targetGzip, decompressedCsv)
    const referenceBuffer = fs.readFileSync(referenceCsv)
    const targetBuffer = fs.readFileSync(decompressedCsv)
    expect(targetBuffer).toEqual(referenceBuffer)
    jest.restoreAllMocks()
    fs.rmdirSync(folderScanner.inputFolder, { recursive: true })
  })
  it('onScan: should addFile() if file match conditions with preserveFiles true and compression true', async () => {
    jest.spyOn(fs, 'statSync').mockImplementation(() => ({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))

    const referenceCsv = path.resolve('./tests/test.csv')
    const targetCsv = path.join(folderScanner.inputFolder, 'test.csv')
    const targetGzip = path.join(folderScanner.inputFolder, 'test.csv.gz')
    folderScanner.preserveFiles = true
    folderScanner.compression = true
    databaseService.getConfig.mockImplementation(() => new Date().getTime() - 25 * 3600 * 1000)
    fs.mkdirSync(folderScanner.inputFolder, { recursive: true })
    fs.copyFileSync(referenceCsv, targetCsv)

    await folderScanner.onScanImplementation('xxx')

    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(folderScanner.engine.addFile).toHaveBeenCalledWith(folderScanner.dataSource.dataSourceId, targetGzip, false)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(1)

    const decompressedCsv = path.join(folderScanner.inputFolder, 'decompressed.csv')
    await folderScanner.decompress(targetGzip, decompressedCsv)
    const referenceBuffer = fs.readFileSync(referenceCsv)
    const targetBuffer = fs.readFileSync(decompressedCsv)
    expect(targetBuffer).toEqual(referenceBuffer)

    jest.restoreAllMocks()
    fs.rmdirSync(folderScanner.inputFolder, { recursive: true })
  })
})
