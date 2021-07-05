const fs = require('fs')
const path = require('path')

const FolderScanner = require('./FolderScanner.class')
const databaseService = require('../../services/database.service')
const config = require('../../../tests/testConfig').default

// Mock engine
const engine = jest.createMockFromModule('../../engine/OIBusEngine.class')
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
    expect(databaseService.createConfigDatabase).toHaveBeenCalledWith(`./cache/${config.south.dataSources[6].id}.db`)
  })
  it('onScan: should exit if folder does not exist', async () => {
    const memory = folderScanner.inputFolder
    folderScanner.inputFolder = 'badfolder'
    jest.spyOn(fs, 'access').mockImplementation((pathLike, mode, callback) => {
      callback('error')
    })
    jest.spyOn(fs, 'readdirSync').mockImplementationOnce(() => {
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
    jest.spyOn(fs.promises, 'readdir').mockImplementation(() => Promise.resolve([]))
    await folderScanner.lastPointQuery('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(folderScanner.engine.addFile).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
    expect(folderScanner.logger.debug).toHaveBeenCalledTimes(1)
  })
  it('onScan: should exit if file does not match regex', async () => {
    jest.spyOn(fs.promises, 'readdir').mockImplementation(() => Promise.resolve(['badfile']))
    await folderScanner.lastPointQuery('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(folderScanner.engine.addFile).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })
  it('onScan: should exit if file is not old enough', async () => {
    jest.spyOn(fs.promises, 'readdir').mockImplementation(() => Promise.resolve(['test.csv']))
    jest.spyOn(fs.promises, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() + 666 }))
    await folderScanner.lastPointQuery('xxx')
    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(folderScanner.engine.addFile).toHaveBeenCalledTimes(0)
    expect(databaseService.upsertConfig).toHaveBeenCalledTimes(0)
  })
  it('onScan: should not addFile() if file match conditions with preserveFiles true and already sent', async () => {
    folderScanner.preserveFiles = true
    jest.spyOn(fs.promises, 'readdir').mockImplementation(() => Promise.resolve(['test.csv']))
    jest.spyOn(fs.promises, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
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
    jest.spyOn(fs.promises, 'readdir').mockImplementation(() => Promise.resolve(['test.csv']))
    jest.spyOn(fs.promises, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
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
    jest.spyOn(fs.promises, 'readdir').mockImplementation(() => Promise.resolve(['test.csv']))
    jest.spyOn(fs.promises, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
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
    jest.spyOn(fs.promises, 'readdir').mockImplementation(() => Promise.resolve(['test.csv']))
    jest.spyOn(fs.promises, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))
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
    jest.spyOn(fs.promises, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))

    const referenceCsv = path.resolve('./tests/test.csv')
    const targetCsv = path.join(folderScanner.inputFolder, 'test.csv')
    const targetGzip = path.join(folderScanner.inputFolder, 'test.csv.gz')

    fs.mkdirSync(folderScanner.inputFolder, { recursive: true })
    fs.copyFileSync(referenceCsv, targetCsv)
    folderScanner.preserveFiles = false
    folderScanner.compression = true

    await folderScanner.lastPointQuery('xxx')

    expect(databaseService.getConfig).toHaveBeenCalledTimes(0)
    expect(engine.addFile).toHaveBeenCalledWith(folderScanner.dataSource.id, targetGzip, false)
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
    jest.spyOn(fs.promises, 'stat').mockImplementation(() => Promise.resolve({ mtimeMs: new Date().getTime() - 24 * 3600 * 1000 }))

    const referenceCsv = path.resolve('./tests/test.csv')
    const targetCsv = path.join(folderScanner.inputFolder, 'test.csv')
    const targetGzip = path.join(folderScanner.inputFolder, 'test.csv.gz')
    folderScanner.preserveFiles = true
    folderScanner.compression = true
    databaseService.getConfig.mockImplementation(() => new Date().getTime() - 25 * 3600 * 1000)
    fs.mkdirSync(folderScanner.inputFolder, { recursive: true })
    fs.copyFileSync(referenceCsv, targetCsv)

    await folderScanner.lastPointQuery('xxx')

    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(engine.addFile).toHaveBeenCalledWith(folderScanner.dataSource.id, targetGzip, false)
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
