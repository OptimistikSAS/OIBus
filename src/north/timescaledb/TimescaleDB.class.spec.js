const pg = require('pg')

const ApiHandler = require('../ApiHandler.class')
const TimescaleDB = require('./TimescaleDB.class')
const config = require('../../../tests/testConfig').default
const EncryptionService = require('../../services/EncryptionService.class')

// Mock logger
jest.mock('../../engine/logger/Logger.class')

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock engine
const engine = jest.mock('../../engine/Engine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.logger = { error: jest.fn(), info: jest.fn(), silly: jest.fn() }
engine.eventEmitters = {}

jest.mock('pg', () => ({ Client: jest.fn() }))

const timescaleDbConfig = config.north.applications[4]
const timestamp = new Date('2020-02-29T12:12:12Z').toISOString()
const values = [
  {
    pointId: 'ANA/BL1RCP05',
    timestamp,
    data: { value: 666, quality: 'good' },
  },
]
beforeEach(() => {
  jest.resetAllMocks()
  jest.useFakeTimers()
  jest.restoreAllMocks()
})

describe('TimescaleDB north', () => {
  it('should properly handle values and publish them', async () => {
    const timescaleDbNorth = new TimescaleDB(timescaleDbConfig, engine)
    expect(timescaleDbNorth.canHandleValues).toBeTruthy()
    expect(timescaleDbNorth.canHandleFiles).toBeFalsy()

    const client = {
      connect: jest.fn((callback) => callback()),
      query: jest.fn(),
      end: jest.fn(),
    }
    pg.Client.mockReturnValue(client)
    await timescaleDbNorth.connect()

    expect(timescaleDbNorth.logger.info).toHaveBeenCalledWith('Connection To TimescaleDB: OK')
    let expectedResult = null
    let expectedError = null
    try {
      expectedResult = await timescaleDbNorth.handleValues(values)
    } catch (error) {
      expectedError = error
    }
    const expectedUrl = `postgres://${timescaleDbConfig.TimescaleDB.user}:${timescaleDbConfig.TimescaleDB.password}`
      + `@${timescaleDbConfig.TimescaleDB.host}/${timescaleDbConfig.TimescaleDB.db}`
    const expectedQuery = 'BEGIN;'
      + 'insert into "ANA/BL1RCP05"("value","quality","timestamp") values(\'666\',\'good\',\'2020-02-29T12:12:12.000Z\');'
      + 'COMMIT'

    expect(pg.Client).toBeCalledWith(expectedUrl)
    expect(expectedResult).toEqual(values.length)
    expect(expectedError).toBeNull()
    expect(client.connect).toBeCalledTimes(1)
    expect(client.query).toBeCalledWith(expectedQuery)

    await timescaleDbNorth.disconnect()
    expect(client.end).toBeCalledTimes(1)
  })

  it('should properly handle connection errors', async () => {
    const timescaleDbNorth = new TimescaleDB(timescaleDbConfig, engine)
    const client = { connect: jest.fn((callback) => callback('error')), end: jest.fn() }
    pg.Client.mockReturnValue(client)

    await timescaleDbNorth.disconnect()
    expect(client.end).not.toHaveBeenCalled()

    await timescaleDbNorth.connect()
    expect(timescaleDbNorth.logger.error).toHaveBeenCalledWith('Error during connection to TimescaleDB: error')
  })

  it('should properly handle values with publish error', async () => {
    const timescaleDbNorth = new TimescaleDB(timescaleDbConfig, engine)
    const client = { connect: jest.fn(), query: jest.fn(() => Promise.reject()) }
    pg.Client.mockReturnValue(client)
    await timescaleDbNorth.connect()
    let expectedResult = null
    let expectedError = null
    try {
      expectedResult = await timescaleDbNorth.handleValues(values)
    } catch (error) {
      expectedError = error
    }

    expect(expectedResult).toBeNull()
    expect(expectedError).toEqual(ApiHandler.STATUS.COMMUNICATION_ERROR)

    // test error building query
    try {
      await timescaleDbNorth.handleValues([{
        pointId: 'ANA/BL1RCP05',
        timestamp,
        data: null,
      }])
    } catch (error) {
      expectedError = error
    }

    expect(expectedError).toEqual(ApiHandler.STATUS.COMMUNICATION_ERROR)

    // eslint-disable-next-line max-len
    expect(timescaleDbNorth.logger.error).toHaveBeenCalledWith(expect.stringContaining('Issue to build query: BEGIN; TypeError: Cannot convert undefined or null to object'))
  })

  it('should properly handle values with optional fields and table errors', async () => {
    const timescaleDbNorth = new TimescaleDB(timescaleDbConfig, engine)
    const client = { connect: jest.fn(), query: jest.fn() }
    pg.Client.mockReturnValue(client)
    await timescaleDbNorth.connect()

    timescaleDbNorth.optFields = 'site:%2$s,unit:%3$s,sensor:%4$s'

    await timescaleDbNorth.handleValues(values)

    // eslint-disable-next-line max-len
    expect(timescaleDbNorth.logger.error).toHaveBeenCalledWith('RegExp returned by (.*) for ANA/BL1RCP05 doesn\'t have enough groups for optionals fields site:%2$s,unit:%3$s,sensor:%4$s')

    timescaleDbNorth.table = '%1$s.%2$s'
    await timescaleDbNorth.handleValues(values)

    // eslint-disable-next-line max-len
    expect(timescaleDbNorth.logger.error).toHaveBeenCalledWith('RegExp returned by (.*) for ANA/BL1RCP05 doesn\'t have enough groups for table %1$s.%2$s')
  })

  it('should properly handle values with optional fields', async () => {
    const timescaleDbNorth = new TimescaleDB(timescaleDbConfig, engine)
    const client = { connect: jest.fn(), query: jest.fn() }
    pg.Client.mockReturnValue(client)
    await timescaleDbNorth.connect()

    timescaleDbNorth.optFields = 'site:%2$s,unit:%3$s,sensor:%4$s'
    timescaleDbNorth.regExp = '(.*)-(.*)-(.*)-(.*)'

    const expectedQuery = 'BEGIN;'
      // eslint-disable-next-line max-len
      + 'insert into "SENSOR_TABLE"("value","quality","site","unit","sensor","timestamp") values(\'666\',\'good\',\'SITE1\',\'UNIT1\',\'ANA/BL1RCP05\',\'2020-02-29T12:12:12.000Z\');'
      + 'COMMIT'

    await timescaleDbNorth.handleValues([
      {
        pointId: 'SENSOR_TABLE-SITE1-UNIT1-ANA/BL1RCP05',
        timestamp,
        data: { value: 666, quality: 'good' },
      },
    ])

    expect(client.query).toBeCalledWith(expectedQuery)
  })

  it('should properly handle values with only optional fields and timestamp', async () => {
    const timescaleDbNorth = new TimescaleDB(timescaleDbConfig, engine)
    const client = { connect: jest.fn(), query: jest.fn() }
    pg.Client.mockReturnValue(client)
    await timescaleDbNorth.connect()

    timescaleDbNorth.optFields = 'site:%2$s,unit:%3$s,sensor:%4$s'
    timescaleDbNorth.regExp = '(.*)-(.*)-(.*)-(.*)'

    const expectedQuery = 'BEGIN;'
      // eslint-disable-next-line max-len
      + 'insert into "SENSOR_TABLE"("site","unit","sensor","timestamp") values(\'SITE1\',\'UNIT1\',\'ANA/BL1RCP05\',\'2020-02-29T12:12:12.000Z\');'
      + 'COMMIT'

    await timescaleDbNorth.handleValues([
      {
        pointId: 'SENSOR_TABLE-SITE1-UNIT1-ANA/BL1RCP05',
        data: {},
        timestamp,
      },
    ])

    expect(client.query).toBeCalledWith(expectedQuery)
  })

  it('should properly handle values with useDataKeyValue', async () => {
    const timescaleDbNorth = new TimescaleDB(timescaleDbConfig, engine)
    const client = {
      connect: jest.fn((callback) => callback()),
      query: jest.fn(),
      end: jest.fn(),
    }
    pg.Client.mockReturnValue(client)
    await timescaleDbNorth.connect()
    expect(timescaleDbNorth.logger.info).toHaveBeenCalledWith('Connection To TimescaleDB: OK')

    timescaleDbNorth.useDataKeyValue = true
    timescaleDbNorth.keyParentValue = 'level'
    let expectedResult = null
    let expectedError = null
    try {
      expectedResult = await timescaleDbNorth.handleValues([{
        pointId: 'ANA/BL1RCP05',
        timestamp,
        data: {
          value: { level: { value: 666 } },
          quality: 'good',
        },
      }])
    } catch (error) {
      expectedError = error
    }
    const expectedUrl = `postgres://${timescaleDbConfig.TimescaleDB.user}:${timescaleDbConfig.TimescaleDB.password}`
      + `@${timescaleDbConfig.TimescaleDB.host}/${timescaleDbConfig.TimescaleDB.db}`
    const expectedQuery = 'BEGIN;'
      + 'insert into "ANA/BL1RCP05"("value","timestamp") values(\'666\',\'2020-02-29T12:12:12.000Z\');'
      + 'COMMIT'

    expect(pg.Client).toBeCalledWith(expectedUrl)
    expect(expectedResult).toEqual(values.length)
    expect(expectedError).toBeNull()
    expect(client.connect).toBeCalledTimes(1)
    expect(client.query).toBeCalledWith(expectedQuery)

    await timescaleDbNorth.disconnect()
    expect(client.end).toBeCalledTimes(1)
  })

  it('should properly retrieve timestamp with timestampPathInDataValue', async () => {
    const timescaleDbNorth = new TimescaleDB(timescaleDbConfig, engine)
    const client = {
      connect: jest.fn((callback) => callback()),
      query: jest.fn(),
      end: jest.fn(),
    }
    pg.Client.mockReturnValue(client)
    await timescaleDbNorth.connect()
    expect(timescaleDbNorth.logger.info).toHaveBeenCalledWith('Connection To TimescaleDB: OK')

    timescaleDbNorth.timestampPathInDataValue = 'associatedTimestamp.timestamp'
    timescaleDbNorth.useDataKeyValue = true
    const valuesWithTimestamp = [
      {
        pointId: 'ANA/BL1RCP05',
        data: {
          value: { numericValue: 555, anotherNumericValue: 444, associatedTimestamp: { timestamp } },
          quality: 'good',
        },
      },
      {
        pointId: 'ANA/BL1RCP06',
        data: {
          value: { numericValue: '666', associatedTimestamp: { timestamp } },
          quality: 'good',
        },
      },
      {
        pointId: 'ANA/BL1RCP07',
        data: {
          value: { numericValue: '777', associatedTimestamp: { timestamp } },
          quality: 'good',
        },
      },
      {
        pointId: 'ANA/BL1RCP08',
        data: {
          value: { numericValue: 888, associatedTimestamp: { timestamp } },
          quality: 'good',
        },
      },
    ]

    let expectedResult = null
    let expectedError = null
    try {
      expectedResult = await timescaleDbNorth.handleValues(valuesWithTimestamp)
    } catch (error) {
      expectedError = error
    }
    const expectedUrl = `postgres://${timescaleDbConfig.TimescaleDB.user}:${timescaleDbConfig.TimescaleDB.password}`
      + `@${timescaleDbConfig.TimescaleDB.host}/${timescaleDbConfig.TimescaleDB.db}`
    const expectedQuery = 'BEGIN;'
      + 'insert into "ANA/BL1RCP05"("numericValue","anotherNumericValue","timestamp") values(\'555\',\'444\',\'2020-02-29T12:12:12.000Z\');'
      + 'insert into "ANA/BL1RCP06"("numericValue","timestamp") values(\'666\',\'2020-02-29T12:12:12.000Z\');'
      + 'insert into "ANA/BL1RCP07"("numericValue","timestamp") values(\'777\',\'2020-02-29T12:12:12.000Z\');'
      + 'insert into "ANA/BL1RCP08"("numericValue","timestamp") values(\'888\',\'2020-02-29T12:12:12.000Z\');'
      + 'COMMIT'

    expect(pg.Client).toBeCalledWith(expectedUrl)
    expect(expectedResult).toEqual(valuesWithTimestamp.length)
    expect(expectedError).toBeNull()
    expect(client.connect).toBeCalledTimes(1)
    expect(client.query).toBeCalledWith(expectedQuery)

    await timescaleDbNorth.disconnect()
    expect(client.end).toBeCalledTimes(1)
  })
})
