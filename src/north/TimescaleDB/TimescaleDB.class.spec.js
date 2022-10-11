const pg = require('pg')

const TimescaleDB = require('./TimescaleDB.class')

const { defaultConfig: config } = require('../../../tests/testConfig')

jest.mock('pg', () => ({ Client: jest.fn() }))

// Mock fs
jest.mock('node:fs/promises')

// Mock OIBusEngine
const engine = {
  configService: { getConfig: () => ({ engineConfig: config.engine }) },
  cacheFolder: './cache',
  requestService: { httpSend: jest.fn() },
}

// Mock services
jest.mock('../../services/database.service')
jest.mock('../../engine/logger/Logger.class')
jest.mock('../../services/status.service.class')
jest.mock('../../services/EncryptionService.class', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))
jest.mock('../../engine/cache/ValueCache.class')
jest.mock('../../engine/cache/FileCache.class')

const nowDateString = '2020-02-02T02:02:02.222Z'
const values = [
  {
    pointId: 'ANA/BL1RCP05',
    timestamp: nowDateString,
    data: { value: 666, quality: 'good' },
  },
]
let settings = null
let north = null

describe('North TimescaleDB', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    settings = {
      id: 'northId',
      name: 'timescale',
      type: 'TimescaleDB',
      enabled: false,
      TimescaleDB: {
        password: 'anypass',
        user: 'anyuser',
        host: 'anyhost',
        db: 'anydb',
        useDataKeyValue: false,
        regExp: '(.*)',
        table: '%1$s',
        optFields: '',
        keyParentValue: '',
        timestampPathInDataValue: '',
      },
      caching: {
        sendInterval: 1000,
        retryInterval: 5000,
        groupCount: 10000,
        maxSendCount: 10000,
        archive: {
          enabled: true,
          retentionDuration: 720,
        },
      },
      subscribedTo: [],
    }
    north = new TimescaleDB(settings, engine)
  })

  it('should properly handle values and publish them', async () => {
    const client = {
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
    }
    pg.Client.mockReturnValue(client)
    await north.init()
    await north.connect()

    expect(north.canHandleValues).toBeTruthy()
    expect(north.canHandleFiles).toBeFalsy()

    expect(north.logger.info).toHaveBeenCalledWith('North connector "timescale" of type TimescaleDB '
        + 'started with url: postgres://anyuser:anypass@anyhost/anydb.')

    await north.handleValues(values)

    const expectedUrl = `postgres://${settings.TimescaleDB.user}:${settings.TimescaleDB.password}`
      + `@${settings.TimescaleDB.host}/${settings.TimescaleDB.db}`
    const expectedQuery = 'BEGIN;'
      + 'insert into "ANA/BL1RCP05"("value","quality","timestamp") values(\'666\',\'good\',\'2020-02-02T02:02:02.222Z\');'
      + 'COMMIT'

    expect(pg.Client).toBeCalledWith(expectedUrl)
    expect(client.connect).toBeCalledTimes(1)
    expect(client.query).toBeCalledWith(expectedQuery)

    await north.disconnect()
    expect(client.end).toBeCalledTimes(1)
  })

  it('should properly handle connection errors', async () => {
    await north.init()
    const client = {
      connect: jest.fn(() => {
        throw new Error('test')
      }),
      end: jest.fn(),
    }
    pg.Client.mockReturnValue(client)

    await north.disconnect()
    expect(client.end).not.toHaveBeenCalled()

    await expect(north.connect()).rejects.toThrowError('test')
  })

  it('should properly handle values with publish error', async () => {
    await north.init()
    const client = {
      connect: jest.fn(),
      query: jest.fn(() => {
        throw new Error('queryError')
      }),
    }
    pg.Client.mockReturnValue(client)
    await north.connect()

    await expect(north.handleValues(values)).rejects.toThrowError('queryError')

    await expect(north.handleValues([{
      pointId: 'ANA/BL1RCP05',
      timestamp: nowDateString,
      data: null,
    }])).rejects.toThrowError('Cannot convert undefined or null to object')
  })

  it('should properly handle values with optional fields and table errors', async () => {
    await north.init()
    const client = { connect: jest.fn(), query: jest.fn() }
    pg.Client.mockReturnValue(client)
    await north.connect()

    north.optFields = 'site:%2$s,unit:%3$s,sensor:%4$s'

    await north.handleValues(values)

    expect(north.logger.error).toHaveBeenCalledWith('RegExp returned by (.*) for ANA/BL1RCP05 doesn\'t '
        + 'have enough groups for optionals fields site:%2$s,unit:%3$s,sensor:%4$s')

    north.table = '%1$s.%2$s'
    await north.handleValues(values)

    expect(north.logger.error).toHaveBeenCalledWith('RegExp returned by (.*) for ANA/BL1RCP05 doesn\'t '
        + 'have enough groups for table %1$s.%2$s')
  })

  it('should properly handle values with optional fields', async () => {
    await north.init()
    const client = { connect: jest.fn(), query: jest.fn() }
    pg.Client.mockReturnValue(client)
    await north.connect()

    north.optFields = 'site:%2$s,unit:%3$s,sensor:%4$s'
    north.regExp = '(.*)-(.*)-(.*)-(.*)'

    const expectedQuery = 'BEGIN;'
        + 'insert into "SENSOR_TABLE"("value","quality","site","unit","sensor","timestamp") '
        + 'values(\'666\',\'good\',\'SITE1\',\'UNIT1\',\'ANA/BL1RCP05\',\'2020-02-02T02:02:02.222Z\');'
        + 'COMMIT'

    await north.handleValues([
      {
        pointId: 'SENSOR_TABLE-SITE1-UNIT1-ANA/BL1RCP05',
        timestamp: nowDateString,
        data: { value: 666, quality: 'good' },
      },
    ])

    expect(client.query).toBeCalledWith(expectedQuery)
  })

  it('should properly handle values with only optional fields and timestamp', async () => {
    await north.init()
    const client = { connect: jest.fn(), query: jest.fn() }
    pg.Client.mockReturnValue(client)
    await north.connect()

    north.optFields = 'site:%2$s,unit:%3$s,sensor:%4$s'
    north.regExp = '(.*)-(.*)-(.*)-(.*)'

    const expectedQuery = 'BEGIN;'
        + 'insert into "SENSOR_TABLE"("site","unit","sensor","timestamp") '
        + 'values(\'SITE1\',\'UNIT1\',\'ANA/BL1RCP05\',\'2020-02-02T02:02:02.222Z\');'
        + 'COMMIT'

    await north.handleValues([
      {
        pointId: 'SENSOR_TABLE-SITE1-UNIT1-ANA/BL1RCP05',
        data: {},
        timestamp: nowDateString,
      },
    ])

    expect(client.query).toBeCalledWith(expectedQuery)
  })

  it('should properly handle values with useDataKeyValue', async () => {
    await north.init()
    const client = {
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
    }
    pg.Client.mockReturnValue(client)
    await north.connect()

    north.useDataKeyValue = true
    north.keyParentValue = 'level'

    await north.handleValues([{
      pointId: 'ANA/BL1RCP05',
      timestamp: nowDateString,
      data: {
        value: { level: { value: 666 } },
        quality: 'good',
      },
    }])

    const expectedUrl = `postgres://${settings.TimescaleDB.user}:${settings.TimescaleDB.password}`
      + `@${settings.TimescaleDB.host}/${settings.TimescaleDB.db}`
    const expectedQuery = 'BEGIN;'
      + 'insert into "ANA/BL1RCP05"("value","timestamp") values(\'666\',\'2020-02-02T02:02:02.222Z\');'
      + 'COMMIT'

    expect(pg.Client).toBeCalledWith(expectedUrl)
    expect(client.connect).toBeCalledTimes(1)
    expect(client.query).toBeCalledWith(expectedQuery)

    await north.disconnect()
    expect(client.end).toBeCalledTimes(1)
  })

  it('should properly retrieve timestamp with timestampPathInDataValue', async () => {
    await north.init()
    const client = {
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
    }
    pg.Client.mockReturnValue(client)
    await north.connect()

    north.timestampPathInDataValue = 'associatedTimestamp.timestamp'
    north.useDataKeyValue = true
    const valuesWithTimestamp = [
      {
        pointId: 'ANA/BL1RCP05',
        data: {
          value: { numericValue: 555, anotherNumericValue: 444, associatedTimestamp: { timestamp: nowDateString } },
          quality: 'good',
        },
      },
      {
        pointId: 'ANA/BL1RCP06',
        data: {
          value: { numericValue: '666', associatedTimestamp: { timestamp: nowDateString } },
          quality: 'good',
        },
      },
      {
        pointId: 'ANA/BL1RCP07',
        data: {
          value: { numericValue: '777', associatedTimestamp: { timestamp: nowDateString } },
          quality: 'good',
        },
      },
      {
        pointId: 'ANA/BL1RCP08',
        data: {
          value: { numericValue: 888, associatedTimestamp: { timestamp: nowDateString } },
          quality: 'good',
        },
      },
    ]

    await north.handleValues(valuesWithTimestamp)
    const expectedUrl = `postgres://${settings.TimescaleDB.user}:${settings.TimescaleDB.password}`
      + `@${settings.TimescaleDB.host}/${settings.TimescaleDB.db}`
    const expectedQuery = 'BEGIN;'
      + 'insert into "ANA/BL1RCP05"("numericValue","anotherNumericValue","timestamp") values(\'555\',\'444\',\'2020-02-02T02:02:02.222Z\');'
      + 'insert into "ANA/BL1RCP06"("numericValue","timestamp") values(\'666\',\'2020-02-02T02:02:02.222Z\');'
      + 'insert into "ANA/BL1RCP07"("numericValue","timestamp") values(\'777\',\'2020-02-02T02:02:02.222Z\');'
      + 'insert into "ANA/BL1RCP08"("numericValue","timestamp") values(\'888\',\'2020-02-02T02:02:02.222Z\');'
      + 'COMMIT'

    expect(pg.Client).toBeCalledWith(expectedUrl)
    expect(client.connect).toBeCalledTimes(1)
    expect(client.query).toBeCalledWith(expectedQuery)

    await north.disconnect()
    expect(client.end).toBeCalledTimes(1)
  })
})
