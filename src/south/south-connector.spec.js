const SouthConnector = require('./south-connector')

const databaseService = require('../service/database.service')

const utils = require('../service/utils')

const { defaultConfig: config } = require('../../tests/test-config')

// Mock fs
jest.mock('node:fs/promises')

// Mock utils class
jest.mock('../service/utils', () => ({
  delay: jest.fn(),
  generateIntervals: jest.fn(),
  createFolder: jest.fn(),
}))

// Mock OIBusEngine
const engine = {
  configService: { getConfig: () => ({ engineConfig: config.engine }) },
  cacheFolder: './cache',
  addValues: jest.fn(),
  addFile: jest.fn(),
}

// Mock services
jest.mock('../service/database.service')
jest.mock('../service/logger/logger.service')
jest.mock('../service/status.service')
jest.mock('../service/encryption.service', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))

const nowDateString = '2020-02-02T02:02:02.222Z'
let configuration = null
let south = null

describe('SouthConnector', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    configuration = { id: 'id', name: 'south', type: 'test', settings: {} }
    south = new SouthConnector(configuration, engine)
    await south.init()
  })

  it('should be properly initialized without support, without scan mode', async () => {
    expect(south.connected).toBeFalsy()
    expect(south.handlesPoints).toBeFalsy()
    expect(south.handlesFiles).toBeFalsy()
    expect(south.statusService.updateStatusDataStream).toHaveBeenCalledWith({})
    expect(south.statusService.updateStatusDataStream).toHaveBeenCalledWith({})
    expect(south.logger.error('SouthConnector should support at least 1 operation mode.'))
    expect(south.logger.error).toHaveBeenCalledWith('Scan mode or scan groups for South "south" are not defined.'
        + 'This South connector will not work.')
    expect(south.scanGroups).toEqual([])
    expect(south.logger.info('South connector "south" (id) of type test started.'))
  })

  it('should be properly initialized with support, without handlers and with scan mode', async () => {
    jest.clearAllMocks()
    south.handlesPoints = true
    south.handlesFiles = true
    south.supportedModes = {
      supportListen: true,
      supportLastPoint: true,
      supportFile: true,
      supportHistory: true,
    }
    south.scanMode = 'scanModeTest'

    await south.init()

    expect(south.lastCompletedAt[south.scanMode]).toEqual(new Date())
    expect(south.queryParts[south.scanMode]).toEqual(0)
    expect(south.ignoredReadsCounters[south.scanMode]).toEqual(0)
    expect(south.currentlyOnScan[south.scanMode]).toEqual(0)
    expect(south.logger.error('SouthConnector should implement the listen() method.'))
    expect(south.logger.error('SouthConnector should implement the lastPointQuery() method.'))
    expect(south.logger.error('SouthConnector should implement the fileQuery() method.'))
    expect(south.logger.error('SouthConnector should implement the historyQuery() method.'))
    expect(south.statusService.updateStatusDataStream).toHaveBeenCalledWith({
      'Number of files since OIBus has started': 0,
      'Number of values since OIBus has started': 0,
    })
  })

  it('should be properly initialized with scan groups', async () => {
    jest.clearAllMocks()
    south.points = [
      { pointId: 'myPointId1', scanMode: 'scanGroupTest' },
      { pointId: 'myPointId2', scanMode: 'anotherScanGroupTest' },
    ]
    south.scanGroups = [{ scanMode: 'scanGroupTest' }]

    await south.init()
    expect(south.lastCompletedAt.scanGroupTest).toEqual(new Date())
    expect(south.queryParts.scanGroupTest).toEqual(0)
    expect(south.ignoredReadsCounters.scanGroupTest).toEqual(0)
    expect(south.currentlyOnScan.scanGroupTest).toEqual(0)

    expect(south.scanGroups).toEqual([
      { name: 'scanGroupTest', scanMode: 'scanGroupTest', points: [{ pointId: 'myPointId1', scanMode: 'scanGroupTest' }] },
    ])
  })

  it('should be properly initialized with handlers and points only', async () => {
    south.points = [
      { pointId: 'myPointId1', scanMode: 'scanGroupTest' },
      { pointId: 'myPointId2', scanMode: 'anotherScanGroupTest' },
      { pointId: 'myPointId3', scanMode: 'listen' },
    ]

    await south.init()
    expect(south.lastCompletedAt.scanGroupTest).toEqual(new Date())
    expect(south.queryParts.scanGroupTest).toEqual(0)
    expect(south.ignoredReadsCounters.scanGroupTest).toEqual(0)
    expect(south.currentlyOnScan.scanGroupTest).toEqual(0)
    expect(south.lastCompletedAt.anotherScanGroupTest).toEqual(new Date())
    expect(south.queryParts.anotherScanGroupTest).toEqual(0)
    expect(south.ignoredReadsCounters.anotherScanGroupTest).toEqual(0)
    expect(south.currentlyOnScan.anotherScanGroupTest).toEqual(0)
  })

  it('should be initialized with settings startTime', async () => {
    south.startTime = '2022-01-09T00:00:00.000Z'
    south.points = [
      { pointId: 'myPointId1', scanMode: 'scanGroupTest' },
      { pointId: 'myPointId2', scanMode: 'anotherScanGroupTest' },
      { pointId: 'myPointId3', scanMode: 'listen' },
    ]

    await south.init()
    expect(south.lastCompletedAt.scanGroupTest).toEqual(new Date(south.startTime))
    expect(south.queryParts.scanGroupTest).toEqual(0)
    expect(south.ignoredReadsCounters.scanGroupTest).toEqual(0)
    expect(south.currentlyOnScan.scanGroupTest).toEqual(0)
    expect(south.lastCompletedAt.anotherScanGroupTest).toEqual(new Date(south.startTime))
    expect(south.queryParts.anotherScanGroupTest).toEqual(0)
    expect(south.ignoredReadsCounters.anotherScanGroupTest).toEqual(0)
    expect(south.currentlyOnScan.anotherScanGroupTest).toEqual(0)
  })

  it('should properly connect', async () => {
    expect(south.connected).toBeFalsy()
    await south.connect()
    expect(south.connected).toBeTruthy()
    expect(south.statusService.updateStatusDataStream).toHaveBeenCalledWith({ 'Connected at': new Date().toISOString() })
  })

  it('should properly disconnect', async () => {
    await south.connect()
    expect(south.connected).toBeTruthy()

    await south.disconnect()
    expect(south.connected).toBeFalsy()
    expect(south.logger.info).toHaveBeenCalledWith('South connector "south" (id) disconnected.')
    expect(south.statusService.updateStatusDataStream).toHaveBeenCalledWith({ 'Connected at': 'Not connected' })
  })

  it('should query a specific interval', async () => {
    south.scanMode = 'scanModeTest'
    south.historyQuery = jest.fn()
    south.southDatabase = {}
    await south.init()

    const startTime = new Date('2021-01-01T00:00:00.000Z')
    const endTime = new Date('2022-01-01T00:00:00.000Z')
    await south.querySpecificInterval('scanModeTest', startTime, endTime, false)
    expect(south.historyQuery).toHaveBeenCalledWith('scanModeTest', startTime, endTime)
    expect(databaseService.upsertConfig).toHaveBeenCalledWith(south.southDatabase, 'queryPart-scanModeTest', 1)
    expect(south.queryParts.scanModeTest).toEqual(1)
    expect(utils.delay).toHaveBeenCalledTimes(1)
    expect(utils.delay).toHaveBeenCalledWith(0)

    utils.delay.mockClear()
    await south.querySpecificInterval('scanModeTest', startTime, endTime, true)
    expect(south.queryParts.scanModeTest).toEqual(2)
    expect(databaseService.upsertConfig).toHaveBeenCalledWith(south.southDatabase, 'queryPart-scanModeTest', 2)
    expect(utils.delay).toHaveBeenCalledTimes(0)
  })

  it('should properly manage history query with 3 intervals', async () => {
    south.scanMode = 'scanModeTest'
    south.historyQuery = jest.fn()
    south.querySpecificInterval = jest.fn()
    south.southDatabase = {}
    const mockedIntervals = [{
      startTime: new Date('2019-01-01T00:00:00.000Z'),
      endTime: new Date('2020-01-01T00:00:00.000Z'),
    },
    {
      startTime: new Date('2020-01-01T00:00:00.000Z'),
      endTime: new Date('2021-01-01T00:00:00.000Z'),
    },
    {
      startTime: new Date('2021-01-01T00:00:00.000Z'),
      endTime: new Date(),
    }]
    utils.generateIntervals.mockReturnValue(mockedIntervals)
    await south.init()

    await south.historyQueryHandler('scanModeTest', new Date('2019-01-01T00:00:00.000Z'), new Date())
    expect(south.logger.trace).toHaveBeenCalledWith('Take back to interval number 0: \r\n'
        + `${JSON.stringify(mockedIntervals[0], null, 2)}\r\n`)
    expect(south.logger.trace).toHaveBeenCalledWith('Interval split in 3 sub-intervals: \r\n'
        + `[${JSON.stringify(mockedIntervals[0], null, 2)}\r\n`
        + `${JSON.stringify(mockedIntervals[1], null, 2)}\r\n`
        + '...\r\n'
        + `${JSON.stringify(mockedIntervals[mockedIntervals.length - 1], null, 2)}]`)
    expect(south.querySpecificInterval).toHaveBeenCalledTimes(3)
    expect(south.querySpecificInterval).toHaveBeenCalledWith(
      'scanModeTest',
      new Date('2019-01-01T00:00:00.000Z'),
      new Date('2020-01-01T00:00:00.000Z'),
      false,
    )
    expect(south.querySpecificInterval).toHaveBeenCalledWith(
      'scanModeTest',
      new Date('2020-01-01T00:00:00.000Z'),
      new Date('2021-01-01T00:00:00.000Z'),
      false,
    )
    expect(south.querySpecificInterval).toHaveBeenCalledWith(
      'scanModeTest',
      new Date('2021-01-01T00:00:00.000Z'),
      new Date(),
      true,
    )
  })

  it('should properly manage history query with 2 intervals', async () => {
    south.scanMode = 'scanModeTest'
    south.historyQuery = jest.fn()
    south.querySpecificInterval = jest.fn()
    south.southDatabase = {}
    const mockedIntervals = [{
      startTime: new Date('2019-01-01T00:00:00.000Z'),
      endTime: new Date('2020-01-01T00:00:00.000Z'),
    },
    {
      startTime: new Date('2020-01-01T00:00:00.000Z'),
      endTime: new Date('2021-01-01T00:00:00.000Z'),
    }]
    utils.generateIntervals.mockReturnValue(mockedIntervals)
    await south.init()

    await south.historyQueryHandler('scanModeTest', new Date('2019-01-01T00:00:00.000Z'), new Date())
    expect(south.querySpecificInterval).toHaveBeenCalledTimes(2)
    expect(south.logger.trace).toHaveBeenCalledWith('Take back to interval number 0: \r\n'
        + `${JSON.stringify(mockedIntervals[0], null, 2)}\r\n`)
    expect(south.logger.trace).toHaveBeenCalledWith('Interval split in 2 sub-intervals: \r\n'
        + `[${JSON.stringify(mockedIntervals[0], null, 2)}\r\n`
        + `${JSON.stringify(mockedIntervals[1], null, 2)}]`)
    expect(south.querySpecificInterval).toHaveBeenCalledWith(
      'scanModeTest',
      new Date('2019-01-01T00:00:00.000Z'),
      new Date('2020-01-01T00:00:00.000Z'),
      false,
    )
    expect(south.querySpecificInterval).toHaveBeenCalledWith(
      'scanModeTest',
      new Date('2020-01-01T00:00:00.000Z'),
      new Date('2021-01-01T00:00:00.000Z'),
      false,
    )
  })

  it('should properly manage history query with 1 intervals', async () => {
    south.scanMode = 'scanModeTest'
    south.historyQuery = jest.fn()
    south.querySpecificInterval = jest.fn()
    south.southDatabase = {}
    const mockedIntervals = [{
      startTime: new Date('2019-01-01T00:00:00.000Z'),
      endTime: new Date('2020-01-01T00:00:00.000Z'),
    }]
    utils.generateIntervals.mockReturnValue(mockedIntervals)
    await south.init()

    await south.historyQueryHandler('scanModeTest', new Date('2019-01-01T00:00:00.000Z'), new Date())
    expect(south.querySpecificInterval).toHaveBeenCalledTimes(1)
    expect(south.logger.trace).toHaveBeenCalledWith(`Querying interval: ${JSON.stringify(mockedIntervals[0], null, 2)}`)
    expect(south.querySpecificInterval).toHaveBeenCalledWith(
      'scanModeTest',
      new Date('2019-01-01T00:00:00.000Z'),
      new Date('2020-01-01T00:00:00.000Z'),
      false,
    )
  })

  it('should properly manage on scan calls', async () => {
    south.scanMode = 'scanModeTest'
    south.historyQueryHandler = jest.fn()
    south.lastPointQuery = jest.fn()
    south.fileQuery = jest.fn()
    south.supportedModes = { supportHistory: true, supportFile: true, supportLastPoint: true }
    south.ignoredReadsCounters.scanModeTest = 0
    south.currentlyOnScan.scanModeTest = 0
    south.scanGroups = [{ scanMode: 'scanModeTest', points: [{}] }]

    // call when not connected
    await south.onScan('scanModeTest')
    expect(south.logger.debug).toHaveBeenCalledWith('South "south" activated on scanMode: "scanModeTest".')
    expect(south.logger.debug).toHaveBeenCalledWith('South "south" not connected. Scan ignored 1 times.')

    // call when connected
    await south.connect()
    await south.onScan('scanModeTest')

    expect(south.lastPointQuery).toHaveBeenCalledTimes(1)
    expect(south.fileQuery).toHaveBeenCalledTimes(1)
    expect(south.historyQueryHandler).toHaveBeenCalledTimes(1)

    jest.clearAllMocks()
    south.supportedModes = { supportHistory: false, supportFile: false, supportLastPoint: true }
    await south.onScan('scanModeTest')

    expect(south.lastPointQuery).toHaveBeenCalledTimes(1)
    expect(south.fileQuery).not.toHaveBeenCalled()
    expect(south.historyQueryHandler).not.toHaveBeenCalled()
  })

  it('should skip scan if scan already ongoing', async () => {
    south.scanMode = 'scanModeTest'
    south.historyQueryHandler = jest.fn()
    south.supportedModes = { supportHistory: true }
    south.currentlyOnScan.scanModeTest = 1
    await south.connect()

    await south.onScan('scanModeTest')
    expect(south.logger.warn).toHaveBeenCalledWith('South "south" already scanning for scan mode "scanModeTest" '
        + 'since 2 scans.')
    expect(south.currentlyOnScan.scanModeTest).toEqual(2)
    expect(south.historyQueryHandler).not.toHaveBeenCalled()
  })

  it('should ignore if scan mode not found in scan groups', async () => {
    south.scanMode = 'scanModeTest'
    south.historyQueryHandler = jest.fn()
    south.supportedModes = { supportHistory: true }
    south.ignoredReadsCounters.scanModeTest = 0
    south.currentlyOnScan.scanModeTest = 0
    south.scanGroups = [{ scanMode: 'anotherScanMode' }]

    await south.connect()
    await south.onScan('scanModeTest')
    expect(south.logger.error).toHaveBeenCalledWith('South "south" has no scan group for scan mode "scanModeTest".')
    expect(south.historyQueryHandler).not.toHaveBeenCalled()

    south.scanGroups = [{ scanMode: 'scanModeTest' }]
    await south.onScan('scanModeTest')
    expect(south.logger.error).toHaveBeenCalledWith('South "south" has no point associated to the scan group "scanModeTest".')
    expect(south.historyQueryHandler).not.toHaveBeenCalled()

    south.scanGroups = [{ scanMode: 'scanModeTest', points: [{}] }]
    await south.onScan('scanModeTest')
    expect(south.historyQueryHandler).toHaveBeenCalledTimes(1)
  })

  it('should catch error on scan', async () => {
    south.lastPointQuery = jest.fn(() => {
      throw new Error('last point query error')
    })
    south.supportedModes = { supportLastPoint: true }
    south.ignoredReadsCounters.scanModeTest = 0
    south.currentlyOnScan.scanModeTest = 0

    await south.connect()
    await south.onScan('scanModeTest')
    expect(south.logger.error).toHaveBeenCalledWith('South "south" onScan failed for scan mode "scanModeTest": '
        + 'Error: last point query error.')
  })

  it('should properly add values', async () => {
    south.flush = jest.fn()

    // Timeout flush
    south.engine.bufferMax = 100
    south.engine.bufferTimeoutInterval = 1000
    await south.addValues([])
    jest.advanceTimersByTime(1000)
    expect(south.flush).toHaveBeenCalledWith()

    // Max flush
    south.engine.bufferMax = 1
    await south.addValues([{}, {}])
    expect(south.flush).toHaveBeenCalledWith('max-flush')
  })

  it('should not flush if timeout does not expire', async () => {
    south.flush = jest.fn()

    // Nothing to do
    south.engine.bufferMax = 10
    south.engine.bufferTimeout = setTimeout(south.flush, 1000)
    await south.addValues([{}])
    jest.advanceTimersByTime(500)

    await south.addValues([{}])
    expect(south.flush).not.toHaveBeenCalled()

    jest.advanceTimersByTime(500)
    expect(south.flush).toHaveBeenCalled()
  })

  it('should properly flush the data', async () => {
    const values = [{
      timestamp: '2020-02-02T01:02:02.000Z',
      pointId: 'point1',
      data: {
        value: 666.666,
        quality: true,
      },
    },
    {
      timestamp: '2021-02-02T01:02:02.000Z',
      pointId: 'point1',
      data: {
        value: 777.777,
        quality: true,
      },
    }]
    south.buffer = values

    await south.flush()
    expect(engine.addValues).toBeCalledWith('id', values)
    expect(south.statusService.updateStatusDataStream).toHaveBeenCalledWith({
      'Number of values since OIBus has started': south.numberOfRetrievedValues,
      'Last added points at': new Date().toISOString(),
      'Last added point id (value)': `point1 (${JSON.stringify(values[1].data)})`,
    })
  })

  it('it should manage timer in flush method', async () => {
    jest.clearAllMocks()
    south.bufferTimeout = setTimeout(() => null, 1000)
    south.buffer = []
    await south.flush()
    expect(south.bufferTimeout).toBeNull()
    expect(south.engine.addValues).not.toHaveBeenCalled()
    expect(south.statusService.updateStatusDataStream).not.toHaveBeenCalled()
  })

  it('should properly add file', async () => {
    await south.init()

    const filePath = 'path'
    const preserveFiles = true
    await south.addFile(filePath, preserveFiles)

    expect(engine.addFile).toBeCalledWith('id', filePath, preserveFiles)
  })
})
