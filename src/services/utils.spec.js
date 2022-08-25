const path = require('node:path')
const fs = require('node:fs/promises')

const minimist = require('minimist')
const FormData = require('form-data')

const { DateTime } = require('luxon')
const utils = require('./utils')

jest.mock('node:fs/promises')
jest.mock('minimist')

const nowDateString = '2020-02-02T02:02:02.222Z'

describe('Service utils', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))
  })

  it('should properly generate form-data body', () => {
    const filepath = '/path/to/note-1610983920007.txt'

    const formData = utils.generateFormDataBodyFromFile(filepath)

    expect(formData).toBeInstanceOf(FormData)
  })

  it('should check if config file exists', () => {
    utils.checkOrCreateConfigFile('myConfigFile.json', {})
    expect(fs.stat).toHaveBeenCalledWith('myConfigFile.json')
    expect(fs.writeFile).not.toHaveBeenCalled()
  })

  it('should create config file if it does not exist', () => {
    fs.stat = jest.fn(() => {
      throw new Error('file doest not exist')
    })
    utils.checkOrCreateConfigFile('myConfigFile.json', {})
    expect(fs.stat).toHaveBeenCalledWith('myConfigFile.json')
    expect(fs.writeFile).toHaveBeenCalledWith('myConfigFile.json', '{}', 'utf8')
  })

  it('should not read a non JSON file', async () => {
    try {
      await utils.tryReadFile('myConfigFile')
    } catch (err) {
      expect(err).toEqual(new Error('You must provide a JSON file for the configuration!'))
    }
  })

  it('should not read a non JSON file', async () => {
    fs.readFile = jest.fn(() => '{ "config": {} }')
    const result = await utils.tryReadFile('myConfigFile.json')
    expect(result).toEqual({ config: {} })
  })

  it('should backup config file', async () => {
    await utils.backupConfigFile('./myConfigFile.json')
    expect(fs.copyFile).toHaveBeenCalledWith('./myConfigFile.json', 'myConfigFile-1580608922222.json')
  })

  it('should save config file', async () => {
    await utils.saveConfig('./myConfigFile.json', {})
    expect(fs.writeFile).toHaveBeenCalledWith('./myConfigFile.json', '{}', 'utf8')
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

  it('should properly compress', async () => {
    // await compress('myInputFile', 'myOutputFile')
    // jest.spyOn(fs, 'createReadStream').mockImplementation(() => [])
    // jest.spyOn(fs, 'createWriteStream').mockImplementation(() => [])
    //
    // expect(zlib.createGzip).toHaveBeenCalledWith({ level: 9 })
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
})
