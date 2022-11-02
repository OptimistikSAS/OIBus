const pg = require('pg')

const TimescaleDB = require('./north-timescale-db')

jest.mock('pg', () => ({ Client: jest.fn() }))

// Mock fs
jest.mock('node:fs/promises')

// Mock services
jest.mock('../../service/database.service')
jest.mock('../../service/logger/logger.service')
jest.mock('../../service/status.service')
jest.mock('../../service/certificate.service')
jest.mock('../../service/encryption.service', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))
jest.mock('../../engine/cache/value-cache')
jest.mock('../../engine/cache/file-cache')

const nowDateString = '2020-02-02T02:02:02.222Z'
const values = [
  {
    pointId: 'ANA/BL1RCP05',
    timestamp: nowDateString,
    data: { value: 666, quality: 'good' },
  },
]
let configuration = null
let north = null

describe('North TimescaleDB', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    configuration = {
      id: 'northId',
      name: 'timescale',
      type: 'TimescaleDB',
      enabled: false,
      settings: {
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
    north = new TimescaleDB(configuration, [])
  })

  it('should properly handle values and publish them', async () => {
    const client = {
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
    }
    pg.Client.mockReturnValue(client)
    await north.start('baseFolder', 'oibusName', {})
    await north.connect()

    expect(north.canHandleValues).toBeTruthy()
    expect(north.canHandleFiles).toBeFalsy()

    expect(north.logger.info).toHaveBeenCalledWith('North connector "timescale" of type TimescaleDB '
        + 'started with url: postgres://anyuser:anypass@anyhost/anydb.')

    await north.handleValues(values)

    const expectedUrl = `postgres://${configuration.settings.user}:${configuration.settings.password}`
      + `@${configuration.settings.host}/${configuration.settings.db}`
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
    await north.start('baseFolder', 'oibusName', {})
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
    await north.start('baseFolder', 'oibusName', {})

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
    await north.start('baseFolder', 'oibusName', {})

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
    await north.start('baseFolder', 'oibusName', {})

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
    await north.start('baseFolder', 'oibusName', {})

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
    await north.start('baseFolder', 'oibusName', {})

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

    const expectedUrl = `postgres://${configuration.settings.user}:${configuration.settings.password}`
      + `@${configuration.settings.host}/${configuration.settings.db}`
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
    await north.start('baseFolder', 'oibusName', {})

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
    const expectedUrl = `postgres://${configuration.settings.user}:${configuration.settings.password}`
      + `@${configuration.settings.host}/${configuration.settings.db}`
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
