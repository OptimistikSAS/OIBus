const fs = require('node:fs/promises')
const path = require('node:path')

const mssql = require('mssql')
const mysql = require('mysql2/promise')
// eslint-disable-next-line import/no-unresolved
const oracledb = require('oracledb')
const { Client, types } = require('pg')

const SQL = require('./SQL.class')
const utils = require('./utils')
const mainUtils = require('../../services/utils')

// Mock utils class
jest.mock('./utils', () => ({
  generateCSV: jest.fn(),
  getMostRecentDate: jest.fn(),
  generateReplacementParameters: jest.fn(),
}))

// Mock utils class
jest.mock('../../services/utils', () => ({
  replaceFilenameWithVariable: jest.fn(),
  compress: jest.fn(),
  createFolder: jest.fn(),
}))

const databaseService = require('../../services/database.service')

const { defaultConfig: config } = require('../../../tests/testConfig')

const mockDatabase = {
  prepare: jest.fn(),
  close: jest.fn(),
}
jest.mock('better-sqlite3', () => () => (mockDatabase))
jest.mock('pg', () => ({
  Client: jest.fn(),
  types: jest.fn(),
}))

// Mock fs
jest.mock('node:fs/promises')

// Mock OIBusEngine
const engine = {
  configService: { getConfig: () => ({ engineConfig: config.engine }) },
  cacheFolder: './cache',
  addValues: jest.fn(),
  addFile: jest.fn(),
}

// Mock services
jest.mock('../../services/database.service')
jest.mock('../../engine/logger/Logger.class')
jest.mock('../../services/status.service.class')
jest.mock('../../services/EncryptionService.class', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))

const nowDateString = '2020-02-02T02:02:02.222Z'
let settings = null
let south = null

describe('South SQL', () => {
  beforeEach(async () => {
    jest.resetAllMocks()
    jest.useFakeTimers().setSystemTime(new Date(nowDateString))

    utils.getMostRecentDate.mockReturnValue(new Date(nowDateString))
    utils.generateReplacementParameters.mockReturnValue([new Date(nowDateString), new Date(nowDateString)])

    mainUtils.replaceFilenameWithVariable.mockReturnValue('myFile')
    settings = {
      id: 'southId',
      name: 'SQL',
      protocol: 'SQL',
      enabled: false,
      SQL: {
        port: 1433,
        password: 'popopopopopopopopo',
        connectionTimeout: 1000,
        requestTimeout: 1000,
        databasePath: './test.db',
        host: '192.168.0.11',
        driver: 'mssql',
        username: 'oibus_user',
        database: 'oibus',
        query:
            'SELECT created_at AS timestamp, value1 AS temperature '
            + 'FROM oibus_test WHERE created_at > @StartTime AND created_at <= @EndTime',
        delimiter: ',',
        filename: 'sql-@CurrentDate.csv',
        scanMode: 'everySecond',
        timeColumn: 'timestamp',
        timezone: 'Europe/Paris',
        dateFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
        timeFormat: 'yyyy-MM-dd HH:mm:ss.SSS',
        compression: false,
      },
      scanMode: 'every10Second',
      points: [],
    }
    south = new SQL(settings, engine)
  })

  it('should properly connect and set lastCompletedAt from database', async () => {
    databaseService.getConfig.mockReturnValue('2020-04-23T11:09:01.001Z')

    await south.init()
    await south.connect()

    expect(databaseService.createConfigDatabase).toBeCalledWith(path.resolve(`cache/south-${south.settings.id}/cache.db`))
    expect(databaseService.getConfig).toHaveBeenCalledTimes(2)
    expect(south.lastCompletedAt[settings.scanMode]).toEqual(new Date('2020-04-23T11:09:01.001Z'))
  })

  it('should log error if temp folder creation fails', async () => {
    fs.mkdir = jest.fn().mockImplementation(() => {
      throw new Error('mkdir error test')
    })

    await south.init()

    expect(south.logger.error).toHaveBeenCalledWith(new Error('mkdir error test'))
  })

  it('should properly connect and set lastCompletedAt from startTime', async () => {
    databaseService.getConfig.mockReturnValue(null)

    const tempConfig = { ...settings }
    tempConfig.startTime = '2020-02-02 02:02:02'
    const tempSqlSouth = new SQL(tempConfig, engine)
    await tempSqlSouth.init()
    await tempSqlSouth.connect()

    expect(tempSqlSouth.lastCompletedAt[settings.scanMode]).toEqual(new Date('2020-02-02 02:02:02'))
  })

  it('should trigger an error on connection if timezone is invalid', async () => {
    const badConfig = {
      ...settings,
      SQL: {
        ...settings.SQL,
        timezone: undefined,
        databasePath: undefined,
      },
    }
    const badSqlSouth = new SQL(badConfig, engine)
    await badSqlSouth.init()

    expect(badSqlSouth.logger.error).toHaveBeenCalledWith('Invalid timezone supplied: "undefined".')

    expect(fs.mkdir).toHaveBeenCalledTimes(1)
  })

  it('should properly connect and set lastCompletedAt to now', async () => {
    databaseService.getConfig.mockReturnValue(null)
    await south.init()
    await south.connect()

    expect(databaseService.createConfigDatabase).toBeCalledWith(path.resolve(`cache/south-${south.settings.id}/cache.db`))
    expect(databaseService.getConfig).toHaveBeenCalledTimes(2)
    expect(south.lastCompletedAt).not.toEqual(new Date(nowDateString).getTime())
  })

  it('should quit historyQuery if timezone is invalid', async () => {
    await south.init()
    await south.connect()
    south.timezone = undefined

    await expect(south.historyQuery(
      settings.scanMode,
      new Date('2019-10-03T13:36:38.590Z'),
      new Date('2019-10-03T15:36:38.590Z'),
    )).rejects.toThrowError('Invalid timezone. Check the South "southId" settings.')
  })

  it('should interact with MSSQL server if driver is mssql', async () => {
    await south.init()
    await south.connect()

    south.driver = 'mssql'
    const query = jest.fn(() => ({ recordsets: [[{ timestamp: new Date('2020-12-25T00:00:00.000Z') }]] }))
    const input = jest.fn()
    const request = jest.fn(() => ({ input, query }))
    const connect = jest.fn(() => ({ request, close: jest.fn() }))
    jest.spyOn(mssql, 'ConnectionPool').mockImplementation(() => ({ connect }))
    jest.spyOn(mssql, 'close')

    await south.historyQuery(settings.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    const expectedConfig = {
      server: settings.SQL.host,
      port: settings.SQL.port,
      user: settings.SQL.username,
      password: settings.SQL.password,
      database: settings.SQL.database,
      connectionTimeout: settings.SQL.connectionTimeout,
      requestTimeout: settings.SQL.requestTimeout,
      options: {
        encrypt: settings.SQL.encryption,
        trustServerCertificate: true,
      },
    }
    expect(mssql.ConnectionPool).toHaveBeenCalledWith(expectedConfig)
    expect(connect).toBeCalledTimes(1)
    expect(request).toBeCalledTimes(1)
    expect(mssql.close).toHaveBeenCalledTimes(1)
  })

  it('should interact with MSSQL server and catch request error', async () => {
    await south.init()
    await south.connect()

    south.driver = 'mssql'

    const query = jest.fn(() => {
      throw new Error('query error')
    })
    const input = jest.fn()
    const request = jest.fn(() => ({ input, query }))
    const connect = jest.fn(() => ({ request, close: jest.fn() }))
    jest.spyOn(mssql, 'ConnectionPool').mockImplementation(() => ({ connect }))
    jest.spyOn(mssql, 'close')

    await expect(south.historyQuery(
      settings.scanMode,
      new Date('2019-10-03T13:36:38.590Z'),
      new Date('2019-10-03T15:36:38.590Z'),
    )).rejects.toThrowError('query error')
    expect(mssql.close).toHaveBeenCalledTimes(1)
  })

  it('should interact with MySQL server if driver is mysql', async () => {
    const startTime = new Date('2019-10-03T13:36:36.360Z')
    const endTime = new Date('2019-10-03T13:40:40.400Z')
    utils.generateReplacementParameters.mockReturnValue([startTime, endTime])

    await south.init()
    await south.connect()

    south.driver = 'mysql'

    const valueTimestamp = new Date('2019-10-03T13:38:38.380Z')
    const connection = {
      execute: jest.fn((_query, params) => (
        params[0] < valueTimestamp ? [[{
          value: 75.2,
          timestamp: valueTimestamp,
        }]] : [[]]
      )),
      end: jest.fn(),
    }
    jest.spyOn(mysql, 'createConnection').mockImplementation(() => connection)

    await south.historyQuery(settings.scanMode, startTime, endTime)

    const expectedConfig = {
      host: settings.SQL.host,
      port: settings.SQL.port,
      user: settings.SQL.username,
      password: settings.SQL.password,
      database: settings.SQL.database,
      connectTimeout: settings.SQL.connectionTimeout,
      timezone: 'Z',
    }
    const expectedExecute = {
      sql: 'SELECT created_at AS timestamp, value1 AS temperature FROM oibus_test WHERE created_at > ? AND created_at <= ?',
      timeout: settings.SQL.requestTimeout,
    }
    const expectedExecuteParams = [
      new Date('2019-10-03T13:36:36.360Z'),
      new Date('2019-10-03T13:40:40.400Z'),
    ]
    expect(mysql.createConnection).toHaveBeenCalledWith(expectedConfig)
    expect(connection.execute).toBeCalledWith(expectedExecute, expectedExecuteParams)
    expect(connection.end).toBeCalledTimes(1)
    expect(south.logger.info)
      .toBeCalledWith('Executing "SELECT created_at AS timestamp, value1 AS temperature '
          + 'FROM oibus_test WHERE created_at > @StartTime AND created_at <= @EndTime" '
          + 'with StartTime = 2019-10-03T13:36:36.360Z EndTime = 2019-10-03T13:40:40.400Z')

    mysql.createConnection.mockClear()
    connection.execute.mockClear()
    connection.end.mockClear()

    await south.historyQuery(settings.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(mysql.createConnection).toHaveBeenCalledWith(expectedConfig)
    expect(connection.execute).toBeCalledTimes(1)
    expect(connection.end).toBeCalledTimes(1)
  })

  it('should interact with MySQL server and catch request error', async () => {
    await south.init()
    await south.connect()

    south.driver = 'mysql'

    const connection = {
      execute: jest.fn(() => {
        throw new Error('execute error')
      }),
      end: jest.fn(),
    }
    jest.spyOn(mysql, 'createConnection').mockImplementationOnce(() => connection)

    await expect(south.historyQuery(
      settings.scanMode,
      new Date('2019-10-03T13:36:38.590Z'),
      new Date('2019-10-03T15:36:38.590Z'),
    )).rejects.toThrowError('execute error')

    jest.spyOn(mysql, 'createConnection').mockImplementationOnce(() => null)
    await expect(south.historyQuery(
      settings.scanMode,
      new Date('2019-10-03T13:36:38.590Z'),
      new Date('2019-10-03T15:36:38.590Z'),
    )).rejects.toThrowError('Cannot read properties of null (reading \'execute\')')
  })

  it('should interact with PostgreSQL server if driver is postgresql', async () => {
    const startTime = new Date('2019-10-03T13:36:36.360Z')
    const endTime = new Date('2019-10-03T13:40:40.400Z')
    utils.generateReplacementParameters.mockReturnValue([startTime, endTime])

    await south.init()
    await south.connect()

    south.driver = 'postgresql'
    const valueTimestamp = new Date('2019-10-03T13:38:38.380.000Z')
    types.setTypeParser = jest.fn()
    const client = {
      connect: jest.fn(),
      query: jest.fn((adaptedQuery, params) => (
        params[0] < valueTimestamp ? {
          rows: [{
            value: 75.2,
            timestamp: '2019-10-03 15:38:38.380',
          }],
        } : { rows: [] }
      )),
      end: jest.fn(),
    }
    Client.mockReturnValue(client)

    await south.historyQuery(settings.scanMode, startTime, endTime)

    const expectedConfig = {
      host: settings.SQL.host,
      port: settings.SQL.port,
      user: settings.SQL.username,
      password: settings.SQL.password,
      database: settings.SQL.database,
      query_timeout: settings.SQL.requestTimeout,
    }
    const expectedQuery = 'SELECT created_at AS timestamp, value1 AS temperature FROM oibus_test WHERE created_at > $1 AND created_at <= $2'
    const expectedExecuteParams = [
      new Date('2019-10-03T13:36:36.360Z'),
      new Date('2019-10-03T13:40:40.400Z'),
    ]
    expect(types.setTypeParser).toBeCalledWith(1114, expect.any(Function))
    expect(Client).toBeCalledWith(expectedConfig)
    expect(client.connect).toBeCalledTimes(1)
    expect(client.query).toBeCalledWith(expectedQuery, expectedExecuteParams)
    expect(client.end).toBeCalledTimes(1)
  })

  it('should interact with PostgreSQL server and catch request error', async () => {
    await south.init()
    await south.connect()

    south.driver = 'postgresql'

    types.setTypeParser = jest.fn()
    const client = {
      connect: jest.fn(),
      query: jest.fn(() => {
        throw new Error('query error')
      }),
      end: jest.fn(),
    }
    Client.mockReturnValueOnce(client)

    await expect(south.historyQuery(
      settings.scanMode,
      new Date('2019-10-03T13:36:38.590Z'),
      new Date('2019-10-03T15:36:38.590Z'),
    )).rejects.toThrowError('query error')
  })

  it('should interact with Oracle server if driver is oracle', async () => {
    await south.init()
    await south.connect()

    south.driver = 'oracle'
    const startTime = new Date('2019-10-03T13:36:36.360Z')
    const endTime = new Date('2019-10-03T13:40:40.400Z')
    utils.generateReplacementParameters.mockReturnValue([startTime, endTime])
    const valueTimestamp = new Date('2019-10-03T13:38:38.380Z')
    const connection = {
      callTimeout: 0,
      execute: jest.fn((_adaptedQuery, params) => (
        params[0] < valueTimestamp ? {
          rows: [{
            value: 75.2,
            timestamp: '2019-10-03 15:38:38.380',
          }],
        } : { rows: [] }
      )),
      close: jest.fn(),
    }
    jest.spyOn(oracledb, 'getConnection').mockImplementation(() => connection)

    await south.historyQuery(settings.scanMode, startTime, endTime)

    const expectedConfig = {
      user: settings.SQL.username,
      password: settings.SQL.password,
      connectString: `${settings.SQL.host}:${settings.SQL.port}/${settings.SQL.database}`,
    }

    const expectedQuery = 'SELECT created_at AS timestamp, value1 AS temperature FROM oibus_test '
        + 'WHERE created_at > :date1 AND created_at <= :date2'
    const expectedExecuteParams = [
      new Date('2019-10-03T13:36:36.360Z'),
      new Date('2019-10-03T13:40:40.400Z'),
    ]
    expect(oracledb.getConnection).toHaveBeenCalledWith(expectedConfig)
    expect(connection.execute).toBeCalledTimes(1)
    expect(connection.execute).toBeCalledWith(expectedQuery, expectedExecuteParams)
    expect(connection.close).toBeCalledTimes(1)
  })

  it('should interact with Oracle server and catch request error', async () => {
    await south.init()
    await south.connect()

    south.driver = 'oracle'

    const connection = {
      callTimeout: 0,
      execute: jest.fn(() => {
        throw new Error('execute error')
      }),
      close: jest.fn(),
    }
    jest.spyOn(oracledb, 'getConnection').mockImplementationOnce(() => connection)

    await expect(south.historyQuery(
      settings.scanMode,
      new Date('2019-10-03T13:36:38.590Z'),
      new Date('2019-10-03T15:36:38.590Z'),
    )).rejects.toThrowError('execute error')
  })

  it('should interact with SQLite database server if driver is sqlite', async () => {
    const all = jest.fn(() => ([]))
    mockDatabase.prepare.mockReturnValue({ all })
    await south.init()
    await south.connect()

    south.driver = 'sqlite'
    const startTime = new Date('2019-10-03T13:36:36.360Z')
    const endTime = new Date('2019-10-03T13:40:40.400Z')

    await south.historyQuery(settings.scanMode, startTime, endTime)

    expect(mockDatabase.prepare).toBeCalledTimes(1)
    expect(mockDatabase.close).toBeCalledTimes(1)
  })

  it('should interact with SQLite database and catch request error', async () => {
    mockDatabase.prepare = () => {
      throw new Error('test')
    }
    await south.init()
    await south.connect()

    south.driver = 'sqlite'

    await expect(south.historyQuery(
      settings.scanMode,
      new Date('2019-10-03T13:36:38.590Z'),
      new Date('2019-10-03T15:36:38.590Z'),
    )).rejects.toThrowError('test')
  })

  it('should log an error if an invalid driver is specified', async () => {
    await south.init()
    await south.connect()

    south.driver = 'invalid'

    await expect(south.historyQuery(
      settings.scanMode,
      new Date('2019-10-03T13:36:38.590Z'),
      new Date('2019-10-03T15:36:38.590Z'),
    )).rejects.toThrowError('SQL driver "invalid" not supported for South "SQL".')
  })

  it('should not send file on emtpy result', async () => {
    await south.init()
    await south.connect()

    south.driver = 'mysql'

    south.getDataFromMySQL = () => []

    await south.historyQuery(settings.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(engine.addFile).not.toBeCalled()
  })

  it('should send an uncompressed file when the result is not empty and compression is false', async () => {
    await south.init()
    await south.connect()

    south.driver = 'mysql'

    const startTime = new Date('2019-10-03T13:36:36.360Z')
    const endTime = new Date('2019-10-03T13:40:40.400Z')
    const valueTimestamp = new Date('2019-10-03T13:38:38.380')

    const rows = [{
      value: 75.2,
      timestamp: '2019-10-03 15:38:38.380',
    }]
    const csvContent = `value,timestamp${'\n'}${rows[0].value},${rows[0].timestamp}`
    south.getDataFromMySQL = (startTimeParam, _) => (
      startTimeParam < valueTimestamp
        ? [{
          value: 75.2,
          timestamp: '2019-10-03 15:38:38.380',
        }] : []
    )
    utils.generateCSV.mockReturnValue(csvContent)
    jest.spyOn(fs, 'writeFile').mockImplementation(() => true)

    await south.historyQuery(settings.scanMode, startTime, endTime)

    const tmpFolder = path.resolve(`cache/south-${south.settings.id}/tmp`)
    const expectedPath = path.join(tmpFolder, 'myFile')
    expect(utils.generateCSV).toBeCalledTimes(1)
    expect(fs.writeFile).toBeCalledWith(expectedPath, csvContent)
    expect(engine.addFile).toBeCalledWith('southId', expectedPath, false)
  })

  it('should send a compressed file when the result is not empty and compression is true', async () => {
    await south.init()
    await south.connect()

    south.driver = 'mysql'
    south.compression = true
    const startTime = new Date('2019-10-03T13:36:36.360Z')
    const endTime = new Date('2019-10-03T13:40:40.400Z')
    const valueTimestamp = new Date('2019-10-03T13:38:38.380')

    const rows = [{
      value: 75.2,
      timestamp: '2019-10-03 15:38:38.380',
    }]
    const csvContent = `value,timestamp${'\n'}${rows[0].value},${rows[0].timestamp}`
    south.getDataFromMySQL = (startTimeParam, _) => (
      startTimeParam < valueTimestamp
        ? [{
          value: 75.2,
          timestamp: '2019-10-03 15:38:38.380',
        }] : []
    )
    utils.generateCSV.mockReturnValue(csvContent)

    const tmpFolder = path.resolve(`cache/south-${south.settings.id}/tmp`)
    const expectedPath = path.join(tmpFolder, 'myFile')
    const expectedCompressedPath = path.join(tmpFolder, 'myFile.gz')

    await south.historyQuery(settings.scanMode, startTime, endTime)

    expect(utils.generateCSV).toBeCalledTimes(1)
    expect(fs.writeFile).toBeCalledWith(expectedPath, csvContent)
    expect(fs.unlink).toBeCalledWith(expectedPath)
    expect(mainUtils.compress).toBeCalledWith(expectedPath, expectedCompressedPath)
    expect(engine.addFile).toBeCalledWith('southId', expectedCompressedPath, false)

    // try again with unlink error
    jest.clearAllMocks()
    fs.unlink.mockImplementation(() => {
      throw new Error('unlink error')
    })

    await south.historyQuery(settings.scanMode, startTime, endTime)
    expect(utils.generateCSV).toBeCalledTimes(1)
    expect(fs.writeFile).toBeCalledWith(expectedPath, csvContent)
    expect(fs.unlink).toBeCalledWith(expectedPath)
    expect(south.logger.error).toBeCalledWith(new Error('unlink error'))
    expect(mainUtils.compress).toBeCalledWith(expectedPath, expectedCompressedPath)
    expect(engine.addFile).toBeCalledWith('southId', expectedCompressedPath, false)
  })
})
