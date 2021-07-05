const fs = require('fs/promises')
const path = require('path')

const FolderScanner = require('./FolderScanner.class')
const databaseService = require('../../services/database.service')
const config = require('../../../tests/testConfig').default

// Mock engine
const engine = jest.mock('../../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.addFile = jest.fn()
engine.eventEmitters = {}

// Mock the logger
jest.mock('../../engine/logger/Logger.class')

// Mock database service
jest.mock('../../services/database.service')

let folderScanner = null
const folderScannerConfig = config.south.dataSources[6]

beforeEach(async () => {
  // Clears mock.calls and mock.instances before each it()
  jest.clearAllMocks()
  jest.resetAllMocks()
  jest.restoreAllMocks()
  folderScanner = new FolderScanner(folderScannerConfig, engine)
  await folderScanner.init()
})

describe('FolderScanner', () => {
  it('should connect properly', async () => {
    await folderScanner.connect()
    expect(databaseService.createConfigDatabase).toHaveBeenCalledWith(`./cache/${folderScannerConfig.id}.db`)
  })

  it('onScan: should exit if folder does not exist', async () => {
    const memory = folderScanner.inputFolder
    folderScanner.inputFolder = 'badfolder'

    jest.spyOn(fs, 'readdir').mockImplementationOnce(() => {
      throw new Error('test')
    })
    await folderScanner.lastPointQuery('xxx')
    folderScanner.lastPointQuery('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(folderScanner.engine.addFile).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
    expect(folderScanner.logger.error).toHaveBeenCalledTimes(1)
    // restore value
    folderScanner.inputFolder = memory
  })

  it('onScan: should exit if folder is empty', async () => {
    jest.spyOn(fs, 'readdir').mockImplementation(() => Promise.resolve([]))
    await folderScanner.lastPointQuery('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(folderScanner.engine.addFile).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
    expect(folderScanner.logger.debug).toHaveBeenCalledTimes(1)
  })

  it('onScan: should exit if file does not match regex', async () => {
    jest.spyOn(fs, 'readdir').mockImplementation(() => Promise.resolve(['badfile']))
    await folderScanner.lastPointQuery('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(folderScanner.engine.addFile).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })

  it('onScan: should exit if file is not old enough', async () => {
    jest.spyOn(fs, 'readdir').mockImplementation(() => Promise.resolve(['test.csv']))
    jest.spyOn(fs, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() + 666 }))
    await folderScanner.lastPointQuery('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(folderScanner.engine.addFile).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })

  it('onScan: should not addFile() if file match conditions with preserveFiles true and already sent', async () => {
    folderScanner.preserveFiles = true
    jest.spyOn(fs, 'readdir').mockImplementation(() => Promise.resolve(['test.csv']))
    jest.spyOn(fs, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    databaseService.getConfig.mockImplementation(() => new Date().getTime())
    await folderScanner.lastPointQuery('xxx')
    // flush promises see https://stackoverflow.com/a/51045733/6763331
    // need because addFile is in async loop and can happen after onScan.
    await new Promise(setImmediate)
    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(folderScanner.engine.addFile).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })

  it('onScan: should addFile() if file match conditions with preserveFiles false and compression false', async () => {
    jest.spyOn(fs, 'readdir').mockImplementation(() => Promise.resolve(['test.csv']))
    jest.spyOn(fs, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    folderScanner.preserveFiles = false
    await folderScanner.lastPointQuery('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(engine.addFile).toHaveBeenCalledWith(
      folderScanner.dataSource.id,
      path.join(folderScanner.inputFolder, 'test.csv'),
      false,
    )
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })

  it('onScan: should addFile() if file match conditions with preserveFiles true and compression false', async () => {
    folderScanner.preserveFiles = true
    jest.spyOn(fs, 'readdir').mockImplementation(() => Promise.resolve(['test.csv']))
    jest.spyOn(fs, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    databaseService.getConfig.mockImplementation(() => new Date().getTime() - 25 * 3600 * 1000)
    await folderScanner.lastPointQuery('xxx')
    // flush promises see https://stackoverflow.com/a/51045733/6763331
    // need because addFile is in async loop and can happen after onScan.
    await new Promise(setImmediate)
    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(folderScanner.engine.addFile).toHaveBeenCalledWith(
      folderScanner.dataSource.id,
      path.join(folderScanner.inputFolder, 'test.csv'),
      true,
    )
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(1)
  })

  it('onScan: should addFile() if file match conditions with preserveFiles true and ignoreModifiedDate true', async () => {
    folderScanner.preserveFiles = true
    folderScanner.ignoreModifiedDate = true
    jest.spyOn(fs, 'readdir').mockImplementation(() => Promise.resolve(['test.csv']))
    jest.spyOn(fs, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
    databaseService.getConfig.mockImplementation(() => new Date().getTime() - 25 * 3600 * 1000)
    await folderScanner.lastPointQuery('xxx')
    // flush promises see https://stackoverflow.com/a/51045733/6763331
    // need because addFile is in async loop and can happen after onScan.
    await new Promise(setImmediate)
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(engine.addFile).toHaveBeenCalledWith(
      folderScanner.dataSource.id,
      path.join(folderScanner.inputFolder, 'test.csv'),
      true,
    )
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(1)
    folderScanner.ignoreModifiedDate = false
  })

  it('onScan: should addFile() if file match conditions with preserveFiles false and compression true', async () => {
    jest.spyOn(fs, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))

    const referenceCsv = path.resolve('./tests/test.csv')
    const targetCsv = path.join(folderScanner.inputFolder, 'test.csv')
    const targetGzip = path.join(folderScanner.inputFolder, 'test.csv.gz')

    await fs.mkdir(folderScanner.inputFolder, { recursive: true })
    await fs.copyFile(referenceCsv, targetCsv)
    folderScanner.preserveFiles = false
    folderScanner.compression = true

    await folderScanner.lastPointQuery('xxx')

    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(engine.addFile).toHaveBeenCalledWith(folderScanner.dataSource.id, targetGzip, false)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)

    const decompressedCsv = path.join(folderScanner.inputFolder, 'decompressed.csv')
    await folderScanner.decompress(targetGzip, decompressedCsv)
    const referenceBuffer = await fs.readFile(referenceCsv)
    const targetBuffer = await fs.readFile(decompressedCsv)
    expect(targetBuffer).toEqual(referenceBuffer)
    jest.restoreAllMocks()
    await fs.rmdir(folderScanner.inputFolder, { recursive: true })
  })

  it('onScan: should addFile() if file match conditions with preserveFiles true and compression true', async () => {
    jest.spyOn(fs, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))

    const referenceCsv = path.resolve('./tests/test.csv')
    const targetCsv = path.join(folderScanner.inputFolder, 'test.csv')
    const targetGzip = path.join(folderScanner.inputFolder, 'test.csv.gz')
    folderScanner.preserveFiles = true
    folderScanner.compression = true
    databaseService.getConfig.mockImplementation(() => new Date().getTime() - 25 * 3600 * 1000)
    await fs.mkdir(folderScanner.inputFolder, { recursive: true })
    await fs.copyFile(referenceCsv, targetCsv)

    await folderScanner.lastPointQuery('xxx')

    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(engine.addFile).toHaveBeenCalledWith(folderScanner.dataSource.id, targetGzip, false)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(1)

    const decompressedCsv = path.join(folderScanner.inputFolder, 'decompressed.csv')
    await folderScanner.decompress(targetGzip, decompressedCsv)
    const referenceBuffer = await fs.readFile(referenceCsv)
    const targetBuffer = await fs.readFile(decompressedCsv)
    expect(targetBuffer).toEqual(referenceBuffer)

    jest.restoreAllMocks()
    await fs.rmdir(folderScanner.inputFolder, { recursive: true })
  })
})
