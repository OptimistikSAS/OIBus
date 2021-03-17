const fs = require('fs')
const path = require('path')
const ApiHandler = require('../ApiHandler.class')
const FileWriter = require('./FileWriter.class')
const config = require('../../../tests/testConfig').default

// Mock database service
jest.mock('../../services/database.service', () => {})

// Mock logger
jest.mock('../../engine/Logger.class')

// Mock engine
const engine = jest.mock('../../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }

beforeEach(() => {
  jest.resetAllMocks()
})

describe('FileWriter north', () => {
  const nowDateString = '2020-02-02T02:02:02.222Z'
  const localTimezoneOffsetInMs = new Date('2020-02-02T02:02:02.222Z').getTimezoneOffset() * 60000
  const fileWriterConfig = config.north.applications[7]
  const fileWriterNorth = new FileWriter(fileWriterConfig, engine)
  it('should be properly initialized', () => {
    expect(fileWriterNorth.canHandleFiles).toBeTruthy()
    expect(fileWriterNorth.canHandleValues).toBeTruthy()
    expect(fileWriterNorth.prefixFileName).toBe('')
    expect(fileWriterNorth.suffixFileName).toBe('')
    expect(fileWriterNorth.outputFolder).toEqual(path.resolve(fileWriterConfig.FileWriter.outputFolder))
  })

  it('should properly handle values', async () => {
    const RealDate = Date
    global.Date = jest.fn(() => ({ getTime: () => new RealDate(nowDateString).getTime() + localTimezoneOffsetInMs }))
    const values = [
      {
        timestamp: '2021-07-29T12:13:31.883Z',
        data: { value: 666, quality: 'good' },
        pointId: 'pointId',
      },
    ]
    jest.spyOn(fs, 'writeFile').mockImplementation(() => true)
    const handleValueResults = await fileWriterNorth.handleValues(values)
    const expectedData = JSON.stringify(values)
    const expectedFileName = `${fileWriterNorth.prefixFileName}${new Date().getTime()}${fileWriterNorth.suffixFileName}.json`
    const expectedOutputFolder = path.resolve(fileWriterNorth.outputFolder)
    const expectedPath = path.join(expectedOutputFolder, expectedFileName)
    expect(fs.writeFile).toBeCalledWith(expectedPath, expectedData)
    expect(handleValueResults).toEqual(values.length)
    global.Date = RealDate
  })

  it('should properly catch handle values error', async () => {
    const values = [
      {
        timestamp: '2021-07-29T12:13:31.883Z',
        data: { value: 666, quality: 'good' },
        pointId: 'pointId',
      },
    ]
    jest.spyOn(fs, 'writeFile').mockImplementationOnce(() => {
      throw new Error('Error handling values')
    })
    const handleValuesResult = await fileWriterNorth.handleValues(values)
    expect(fileWriterNorth.logger.error).toHaveBeenCalledTimes(1)
    expect(handleValuesResult).toEqual(ApiHandler.STATUS.LOGIC_ERROR)
  })

  it('should properly handle files', async () => {
    jest.spyOn(fs, 'statSync').mockImplementation(() => ({ size: 666 }))
    jest.spyOn(fs, 'copyFileSync').mockImplementation(() => true)
    const filePath = '/path/to/file/example.file'
    const extension = path.extname(filePath)
    let expectedFileName = path.basename(filePath, extension)
    expectedFileName = `${fileWriterNorth.prefixFileName}${expectedFileName}${fileWriterNorth.suffixFileName}${extension}`
    const expectedOutputFolder = path.resolve(fileWriterNorth.outputFolder)
    const handleFileResult = await fileWriterNorth.handleFile(filePath)
    expect(fs.copyFileSync).toBeCalledWith(filePath, path.join(expectedOutputFolder, expectedFileName))
    expect(handleFileResult).toEqual(ApiHandler.STATUS.SUCCESS)
  })

  it('should properly catch handle file error', async () => {
    jest.spyOn(fs, 'statSync').mockImplementation(() => ({ size: 666 }))
    jest.spyOn(fs, 'copyFileSync').mockImplementation(() => true)
    const filePath = '/path/to/file/example.file'
    jest.spyOn(fs, 'copyFileSync').mockImplementationOnce(() => {
      throw new Error('Error handling files')
    })
    const handlerFileResult = await fileWriterNorth.handleFile(filePath)
    expect(fileWriterNorth.logger.error).toHaveBeenCalledTimes(1)
    expect(handlerFileResult).toEqual(ApiHandler.STATUS.LOGIC_ERROR)
  })
})
