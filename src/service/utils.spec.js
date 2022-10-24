const path = require('node:path')
const fs = require('node:fs/promises')
const fsSync = require('node:fs')
const zlib = require('node:zlib')

const minimist = require('minimist')
const FormData = require('form-data')

const { DateTime } = require('luxon')
const utils = require('./utils')

jest.mock('node:zlib')
jest.mock('node:fs/promises')
jest.mock('node:fs')
jest.mock('minimist')

const nowDateString = '2020-02-02T02:02:02.222Z'

describe('Service utils', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))
  })

  it('should properly generate form-data body', () => {
    const filepath = '/path/to/note-1610983920007.txt'
    const myReadStream = {
      pipe: jest.fn().mockReturnThis(),
      on: jest.fn().mockImplementation((event, handler) => {
        handler()
        return this
      }),
      pause: jest.fn(),
    }

    const formData = utils.generateFormDataBodyFromFile(path.parse(filepath), myReadStream)

    expect(formData).toBeInstanceOf(FormData)
  })

  it('should parse command line arguments without args', () => {
    minimist.mockReturnValue({})
    const result = utils.getCommandLineArguments()

    expect(result).toEqual({ check: false, configFile: path.resolve('oibus.json') })
  })

  it('should parse command line arguments with args', () => {
    minimist.mockReturnValue({ check: true, config: 'myConfig.json' })
    const result = utils.getCommandLineArguments()

    expect(result).toEqual({ check: true, configFile: path.resolve('myConfig.json') })
  })

  it('should delay', async () => {
    const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((callback) => {
      callback()
    })

    await utils.delay(1000)
    jest.advanceTimersToNextTimer()
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1000)
  })

  it('should return only one interval', () => {
    const startTime = new Date('2020-01-01T00:00:00.000Z')
    const endTime = new Date('2020-01-01T01:00:00.000Z')
    const expectedIntervals = [{ startTime, endTime }]
    const results = utils.generateIntervals(startTime, endTime, 3600)
    expect(results).toEqual(expectedIntervals)
  })

  it('should return two intervals', () => {
    const startTime1 = new Date('2020-01-01T00:00:00.000Z')
    const endTime1 = new Date('2020-01-01T01:00:00.000Z')
    const startTime2 = new Date('2020-01-01T01:00:00.000Z')
    const endTime2 = new Date('2020-01-01T02:00:00.000Z')
    const expectedIntervals = [
      { startTime: startTime1, endTime: endTime1 },
      { startTime: startTime2, endTime: endTime2 },
    ]
    const results = utils.generateIntervals(startTime1, endTime2, 3600)
    expect(results).toEqual(expectedIntervals)
  })

  it('should format date properly', () => {
    const test1 = utils.generateDateWithTimezone(
      '2020-02-22 22:22:22.666',
      'Europe/Paris',
      'yyyy-MM-dd HH:mm:ss.SSS',
    )
    const expectedResult1 = '2020-02-22T21:22:22.666Z'
    expect(test1).toBe(expectedResult1)

    const test2 = utils.generateDateWithTimezone(
      '2020-02-22T22:22:22.666Z',
      'Europe/Paris',
      'yyyy-MM-dd HH:mm:ss.SSS',
    )
    const expectedResult2 = '2020-02-22T22:22:22.666Z'
    expect(test2).toBe(expectedResult2)
  })

  it('should properly name file with variables in the name', () => {
    expect(utils.replaceFilenameWithVariable(
      'myFileName.csv',
      0,
      'south',
    )).toEqual('myFileName.csv')
    expect(utils.replaceFilenameWithVariable(
      'myFileName-@QueryPart.csv',
      0,
      'south',
    )).toEqual('myFileName-0.csv')
    expect(utils.replaceFilenameWithVariable(
      'myFileName-@ConnectorName-@QueryPart.csv',
      0,
      'south',
    )).toEqual('myFileName-south-0.csv')
    expect(utils.replaceFilenameWithVariable(
      'myFileName-@ConnectorName-@CurrentDate.csv',
      0,
      'south',
    )).toEqual(`myFileName-south-${DateTime.local().toFormat('yyyy_MM_dd_HH_mm_ss_SSS')}.csv`)
    expect(utils.replaceFilenameWithVariable(
      'myFileName-@ConnectorName-@QueryPart-@CurrentDate.csv',
      17,
      'south',
    )).toEqual(`myFileName-south-17-${DateTime.local().toFormat('yyyy_MM_dd_HH_mm_ss_SSS')}.csv`)
  })

  it('should properly check if a file exists or not', async () => {
    fs.stat = jest.fn(() => {
      throw new Error('File does not exist')
    })
    expect(await utils.filesExists('myConfigFile.json')).toEqual(false)

    fs.stat = jest.fn(() => null)
    expect(await utils.filesExists('myConfigFile.json')).toEqual(true)
  })

  it('should properly check if a file exists or not', async () => {
    const folderToCreate = 'myFolder'
    fs.mkdir = jest.fn()
    fs.stat = jest.fn(() => null)

    await utils.createFolder(folderToCreate)
    expect(fs.mkdir).not.toHaveBeenCalled()

    fs.stat = jest.fn(() => {
      throw new Error('File does not exist')
    })

    await utils.createFolder(folderToCreate)

    expect(fs.mkdir).toHaveBeenCalledTimes(1)
    expect(fs.mkdir).toHaveBeenCalledWith(path.resolve(folderToCreate), { recursive: true })
  })

  it('should properly compress file', async () => {
    const myReadStream = {
      pipe: jest.fn().mockReturnThis(),
      on: jest.fn().mockImplementation((event, handler) => {
        handler('compression error')
        return this
      }),
    }
    fsSync.createReadStream.mockReturnValueOnce(myReadStream)

    const myWriteStream = {
      pipe: jest.fn().mockReturnThis(),
      on: jest.fn().mockImplementation((event, handler) => {
        handler()
        return this
      }),
    }
    fsSync.createWriteStream.mockReturnValueOnce(myWriteStream)

    zlib.createGzip.mockReturnValue({})
    let expectedError = null
    try {
      await utils.compress('myInputFile', 'myOutputFile')
    } catch (error) {
      expectedError = error
    }
    expect(expectedError).toEqual('compression error')
    expect(fsSync.createReadStream).toBeCalledTimes(1)
    expect(fsSync.createReadStream).toHaveBeenCalledWith('myInputFile')
    expect(myReadStream.pipe).toBeCalledTimes(2)
    expect(fsSync.createWriteStream).toBeCalledTimes(1)
    expect(fsSync.createWriteStream).toHaveBeenCalledWith('myOutputFile')
  })
})
