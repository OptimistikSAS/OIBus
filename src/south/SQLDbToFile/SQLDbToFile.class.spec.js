const fs = require('fs')
const path = require('path')

const mssql = require('mssql')
const mysql = require('mysql2/promise')
const { Client, types } = require('pg')

let oracledb
try {
  // eslint-disable-next-line no-undef,global-require,import/no-unresolved
  oracledb = require('oracledb')
} catch (e) {
  console.error('node-oracledb could not be loaded. Skipping oracle tests')
}
const sqlite = require('sqlite')
const csv = require('papaparse')

const SQLDbToFile = require('./SQLDbToFile.class')
const databaseService = require('../../services/database.service')
const config = require('../../../tests/testConfig').default
const EncryptionService = require('../../services/EncryptionService.class')

jest.mock('pg', () => ({
  Client: jest.fn(),
  types: jest.fn(),
}))

jest.mock('papaparse', () => ({ unparse: jest.fn() }))

// Mock database service
jest.mock('../../services/database.service', () => ({
  createConfigDatabase: jest.fn(() => 'configDatabase'),
  getConfig: jest.fn((_database, _key) => '2020-08-07T06:48:12.852Z'),
  upsertConfig: jest.fn(),
}))

// Mock logger
jest.mock('../../engine/Logger.class')

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock engine
const engine = jest.mock('../../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.addFile = jest.fn()

beforeEach(() => {
  jest.resetAllMocks()
  jest.useFakeTimers()
  jest.restoreAllMocks()
})

describe('sql-db-to-file', () => {
  const sqlConfig = config.south.dataSources[7]
  const sqlSouth = new SQLDbToFile(sqlConfig, engine)
  const nowDateString = '2020-02-02T02:02:02.222Z'
  const localTimezoneOffsetInMs = new Date('2020-02-02T02:02:02.222Z').getTimezoneOffset() * 60000

  it('should properly connect and set lastCompletedAt from database', async () => {
    databaseService.getConfig.mockReturnValue('2020-04-23T11:09:01.001Z')

    await sqlSouth.connect()

    expect(databaseService.createConfigDatabase).toBeCalledWith(`${config.engine.caching.cacheFolder}/${sqlConfig.id}.db`)
    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(sqlSouth.lastCompletedAt[sqlConfig.scanMode]).toEqual(new Date('2020-04-23T11:09:01.001Z'))
  })

  it('should properly connect and set lastCompletedAt from startTime', async () => {
    databaseService.getConfig.mockReturnValue(null)

    const tempConfig = { ...sqlConfig }
    tempConfig.startTime = '2020-02-02 02:02:02'
    const tempSqlSouth = new SQLDbToFile(tempConfig, engine)

    await tempSqlSouth.connect()

    expect(tempSqlSouth.lastCompletedAt[sqlConfig.scanMode]).toEqual(new Date('2020-02-02 02:02:02'))
  })

  it('should trigger an error on connection if timezone is invalid', async () => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => false)
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => true)

    const badConfig = { ...sqlConfig }
    badConfig.SQLDbToFile.timezone = undefined
    badConfig.SQLDbToFile.databasePath = undefined
    const badSqlSouth = new SQLDbToFile(badConfig, engine)

    expect(badSqlSouth.logger.error).toHaveBeenCalledWith('Invalid timezone supplied: undefined')

    expect(fs.mkdirSync).toHaveBeenCalledTimes(1)
  })

  it('should properly connect and set lastCompletedAt to now', async () => {
    const RealDate = Date
    global.Date = jest.fn(() => new RealDate(nowDateString))

    databaseService.getConfig.mockReturnValue(null)

    await sqlSouth.connect()

    expect(databaseService.createConfigDatabase).toBeCalledWith(`${config.engine.caching.cacheFolder}/${sqlConfig.id}.db`)
    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(sqlSouth.lastCompletedAt).not.toEqual(new Date(nowDateString).getTime())
    global.Date = RealDate
  })

  it('should properly get the latest date', () => {
    sqlSouth.timezone = 'UTC'
    const entryList1 = [
      { timestamp: '2021-03-30 10:30:00.150' },
      { timestamp: '2021-03-30 11:30:00.150' },
      { timestamp: '2021-03-30 12:30:00.150' },
    ]
    const entryList2 = [
      { timestamp: 1617107400000 }, // '2021-03-30 12:30:00'
      { timestamp: 1617103800000 }, // '2021-03-30 11:30:00'
      { timestamp: 1617100200000 }, // '2021-03-30 10:30:00'
    ]
    const entryList3 = [
      { timestamp: new Date(1617193800000) }, // '2021-03-31 12:30:00'
      { timestamp: new Date(1617186600000) }, // '2021-03-31 10:30:00'
      { timestamp: new Date(1617190200000) }, //  '2021-03-31 11:30:00'
    ]
    const entryList4 = [{ name: 'name1' }, { name: 'name2' }, { name: 'name3' }] // no timestamp

    const latestDate1 = sqlSouth.getLatestDate(entryList1, new Date('2020-02-02T02:02:02.000Z')) // with string format
    expect(latestDate1).toEqual(new Date('2021-03-30 12:30:00.151'))
    sqlSouth.logger.debug.mockClear()

    const latestDate2 = sqlSouth.getLatestDate(entryList2, new Date('2020-02-02T02:02:02.000Z')) // with number format - no ms
    expect(latestDate2).toEqual(new Date(1617107400001))
    sqlSouth.logger.debug.mockClear()

    const latestDate3 = sqlSouth.getLatestDate(entryList3, new Date('2020-02-02T02:02:02.000Z')) // with date format
    expect(latestDate3).toEqual(new Date(1617193800001))
    sqlSouth.logger.debug.mockClear()

    const latestDate4 = sqlSouth.getLatestDate(entryList4, new Date('2020-02-02T02:02:02.000Z')) // without timestamp
    expect(latestDate4).toEqual(new Date('2020-02-02T02:02:02.000Z'))
  })

  it('should quit historyQuery if timezone is invalid', async () => {
    const { timezone } = sqlSouth
    sqlSouth.timezone = undefined

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(sqlSouth.logger.error).toHaveBeenCalledWith('Invalid timezone')
    sqlSouth.timezone = timezone
  })

  it('should interact with MS SQL server if driver is mssql', async () => {
    sqlSouth.driver = 'mssql'
    const query = jest.fn(() => ({ recordsets: [[{ timestamp: new Date('2020-12-25T00:00:00.000Z') }]] }))
    const input = jest.fn(() => ({ query }))
    const request = jest.fn(() => ({ input }))
    const connect = jest.fn(() => ({ request }))
    jest.spyOn(mssql, 'ConnectionPool').mockImplementation(() => ({ connect }))
    jest.spyOn(mssql, 'close')

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    const expectedConfig = {
      server: sqlConfig.SQLDbToFile.host,
      port: sqlConfig.SQLDbToFile.port,
      user: sqlConfig.SQLDbToFile.username,
      password: sqlConfig.SQLDbToFile.password,
      database: sqlConfig.SQLDbToFile.database,
      connectionTimeout: sqlConfig.SQLDbToFile.connectionTimeout,
      requestTimeout: sqlConfig.SQLDbToFile.requestTimeout,
      options: { encrypt: sqlConfig.SQLDbToFile.encryption, trustServerCertificate: true },
    }
    expect(mssql.ConnectionPool).toHaveBeenCalledWith(expectedConfig)
    expect(connect).toBeCalledTimes(1)
    expect(request).toBeCalledTimes(1)
    expect(mssql.close).toHaveBeenCalledTimes(1)
  })

  it('should interact with MySQL server if driver is mysql', async () => {
    sqlSouth.driver = 'mysql'
    const startTime = new Date('2019-10-03T13:36:36.360Z')
    const endTime = new Date('2019-10-03T13:40:40.400Z')
    const valueTimestamp = new Date('2019-10-03T13:38:38.380Z')
    const connection = {
      execute: jest.fn((query, params) => (
        params[0] < valueTimestamp ? {
          rows: [{
            value: 75.2,
            timestamp: valueTimestamp,
          }],
        } : { rows: [] }
      )),
      end: jest.fn(),
    }
    jest.spyOn(mysql, 'createConnection').mockImplementation(() => connection)

    await sqlSouth.historyQuery(sqlConfig.scanMode, startTime, endTime)

    const expectedConfig = {
      host: sqlConfig.SQLDbToFile.host,
      port: sqlConfig.SQLDbToFile.port,
      user: sqlConfig.SQLDbToFile.username,
      password: sqlConfig.SQLDbToFile.password,
      database: sqlConfig.SQLDbToFile.database,
      connectTimeout: sqlConfig.SQLDbToFile.connectionTimeout,
      timezone: 'Z',
    }
    const expectedExecute = {
      sql: 'SELECT created_at AS timestamp, value1 AS temperature FROM oibus_test WHERE created_at > ? AND created_at <= ? LIMIT ?',
      timeout: sqlConfig.SQLDbToFile.requestTimeout,
    }
    const expectedExecuteParams = [
      new Date('2019-10-03T13:36:36.360Z'),
      new Date('2019-10-03T13:40:40.400Z'),
      sqlConfig.SQLDbToFile.maxReturnValues,
    ]
    expect(mysql.createConnection).toHaveBeenCalledWith(expectedConfig)
    expect(connection.execute).toBeCalledWith(expectedExecute, expectedExecuteParams)
    expect(connection.end).toBeCalledTimes(1)
    // eslint-disable-next-line max-len
    expect(sqlSouth.logger.debug).toBeCalledWith('Executing "SELECT created_at AS timestamp, value1 AS temperature FROM oibus_test WHERE created_at > @StartTime AND created_at <= @EndTime LIMIT @MaxReturnValues" with StartTime = 2019-10-03T13:36:36.360Z EndTime = 2019-10-03T13:40:40.400Z MaxReturnValues = 1000')

    mysql.createConnection.mockClear()
    connection.execute.mockClear()
    connection.end.mockClear()

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(mysql.createConnection).toHaveBeenCalledWith(expectedConfig)
    // expect(connection.execute).toBeCalledWith(expectedExecute, expectedExecuteParams)
    expect(connection.execute).toBeCalledTimes(1)
    expect(connection.end).toBeCalledTimes(1)
    sqlSouth.containsLastCompletedDate = true
  })

  it('should interact with MySQL server and catch request error', async () => {
    sqlSouth.driver = 'mysql'

    const connection = {
      execute: jest.fn(() => {
        throw new Error('execute error')
      }),
      end: jest.fn(),
    }
    jest.spyOn(mysql, 'createConnection').mockImplementationOnce(() => connection)

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(sqlSouth.logger.error).toBeCalledWith(new Error('execute error'))

    sqlSouth.logger.error.mockClear()
    jest.spyOn(mysql, 'createConnection').mockImplementationOnce(() => null)
    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))
    expect(sqlSouth.logger.error).toBeCalledWith(new TypeError('Cannot read property \'execute\' of null'))
  })

  it('should interact with PostgreSQL server if driver is postgresql', async () => {
    sqlSouth.driver = 'postgresql'
    const startTime = new Date('2019-10-03T13:36:36.360Z')
    const endTime = new Date('2019-10-03T13:40:40.400Z')
    const valueTimestamp = new Date('2019-10-03T13:38:38.380Z')
    types.setTypeParser = jest.fn()
    const client = {
      connect: jest.fn(),
      query: jest.fn((adaptedQuery, params) => (
        params[0] < valueTimestamp ? {
          rows: [{
            value: 75.2,
            timestamp: valueTimestamp,
          }],
        } : { rows: [] }
      )),
      end: jest.fn(),
    }
    Client.mockReturnValue(client)

    await sqlSouth.historyQuery(sqlConfig.scanMode, startTime, endTime)

    const expectedConfig = {
      host: sqlConfig.SQLDbToFile.host,
      port: sqlConfig.SQLDbToFile.port,
      user: sqlConfig.SQLDbToFile.username,
      password: sqlConfig.SQLDbToFile.password,
      database: sqlConfig.SQLDbToFile.database,
      query_timeout: sqlConfig.SQLDbToFile.requestTimeout,
    }
    const expectedQuery = 'SELECT created_at AS timestamp, value1 AS temperature FROM oibus_test WHERE created_at > $1 AND created_at <= $2 LIMIT $3'
    const expectedExecuteParams = [
      new Date('2019-10-03T13:36:36.360Z'),
      new Date('2019-10-03T13:40:40.400Z'),
      sqlConfig.SQLDbToFile.maxReturnValues,
    ]
    expect(types.setTypeParser).toBeCalledWith(1114, expect.any(Function))
    expect(Client).toBeCalledWith(expectedConfig)
    expect(client.connect).toBeCalledTimes(2)
    expect(client.query).toBeCalledWith(expectedQuery, expectedExecuteParams)
    expect(client.end).toBeCalledTimes(2)
  })

  it('should interact with PostgreSQL server and catch request error', async () => {
    sqlSouth.driver = 'postgresql'

    types.setTypeParser = jest.fn()
    const client = {
      connect: jest.fn(),
      query: jest.fn(() => {
        throw new Error('query error')
      }),
      end: jest.fn(),
    }
    Client.mockReturnValueOnce(client)

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(sqlSouth.logger.error).toBeCalledWith(new Error('query error'))
  })

  it('should interact with PostgreSQL server and not end connection if it is null', async () => {
    sqlSouth.driver = 'postgresql'

    types.setTypeParser = jest.fn()

    jest.mock('pg', () => ({
      Client: jest.fn(() => null),
      types: jest.fn(),
    }))

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(sqlSouth.logger.error).toBeCalledTimes(2)
  })

  it('should interact with Oracle server if driver is oracle', async () => {
    if (!oracledb) return
    sqlSouth.driver = 'oracle'
    const startTime = new Date('2019-10-03T13:36:36.360Z')
    const endTime = new Date('2019-10-03T13:40:40.400Z')
    const valueTimestamp = new Date('2019-10-03T13:38:38.380Z')
    const connection = {
      callTimeout: 0,
      execute: jest.fn((adaptedQuery, params) => (
        params[0] < valueTimestamp ? {
          rows: [{
            value: 75.2,
            timestamp: valueTimestamp,
          }],
        } : { rows: [] }
      )),
      close: jest.fn(),
    }
    jest.spyOn(oracledb, 'getConnection').mockImplementation(() => connection)

    await sqlSouth.historyQuery(sqlConfig.scanMode, startTime, endTime)

    const expectedConfig = {
      user: sqlConfig.SQLDbToFile.username,
      password: sqlConfig.SQLDbToFile.password,
      connectString: `${sqlConfig.SQLDbToFile.host}:${sqlConfig.SQLDbToFile.port}/${sqlConfig.SQLDbToFile.database}`,
    }
    // eslint-disable-next-line
    const expectedQuery = 'SELECT created_at AS timestamp, value1 AS temperature FROM oibus_test WHERE created_at > :date1 AND created_at <= :date2 LIMIT :values'
    const expectedExecuteParams = [
      new Date('2019-10-03T13:36:36.360Z'),
      new Date('2019-10-03T13:40:40.400Z'),
      sqlConfig.SQLDbToFile.maxReturnValues,
    ]
    expect(oracledb.getConnection).toHaveBeenCalledWith(expectedConfig)
    expect(connection.execute).toBeCalledTimes(2)
    expect(connection.execute).toBeCalledWith(expectedQuery, expectedExecuteParams)
    expect(connection.close).toBeCalledTimes(2)
  })

  it('should interact with Oracle server and catch request error', async () => {
    if (!oracledb) return
    sqlSouth.driver = 'oracle'

    const connection = {
      callTimeout: 0,
      execute: jest.fn(() => {
        throw new Error('execute error')
      }),
      close: jest.fn(),
    }
    jest.spyOn(oracledb, 'getConnection').mockImplementationOnce(() => connection)

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(sqlSouth.logger.error).toBeCalledWith(new Error('execute error'))

    sqlSouth.logger.error.mockClear()
    jest.spyOn(oracledb, 'getConnection').mockImplementationOnce(() => null)
    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))
    expect(sqlSouth.logger.error).toBeCalledWith(new TypeError('Cannot set property \'callTimeout\' of null'))
  })

  it('should interact with SQLite database server if driver is sqlite', async () => {
    sqlSouth.driver = 'sqlite'
    const startTime = new Date('2019-10-03T13:36:36.360Z')
    const endTime = new Date('2019-10-03T13:40:40.400Z')
    const valueTimestamp = new Date('2019-10-03T13:38:38.380Z')

    const finalize = jest.fn()
    const all = jest.fn((preparedParameters) => (
      preparedParameters['@StartTime'] < valueTimestamp ? {
        rows: [{
          value: 75.2,
          timestamp: valueTimestamp,
        }],
      } : { rows: [] }
    ))
    const prepare = jest.fn(() => ({ all, finalize }))
    const close = jest.fn()
    const database = {
      prepare,
      close,
    }
    jest.spyOn(sqlite, 'open').mockResolvedValue(database)

    await sqlSouth.historyQuery(sqlConfig.scanMode, startTime, endTime)

    expect(database.prepare).toBeCalledTimes(1)
    expect(database.close).toBeCalledTimes(1)

    database.close.mockClear()
    database.prepare.mockClear()
  })

  it('should interact with SQLite database and catch request error', async () => {
    sqlSouth.driver = 'sqlite'

    jest.spyOn(sqlite, 'open').mockImplementation(() => {
      throw new Error('test')
    })

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(sqlSouth.logger.error).toBeCalledWith(new Error('test'))
  })

  it('should trigger an error and catch it', async () => {
    sqlSouth.driver = 'mssql'

    const query = jest.fn(() => ({ recordsets: [[{ timestamp: new Date('2020-12-25T00:00:00.000Z') }]] }))
    const input = jest.fn(() => ({ query }))
    const request = jest.fn(() => ({ input }))
    const connect = jest.fn(() => ({ request }))
    jest.spyOn(mssql, 'ConnectionPool').mockImplementation(() => ({ connect }))
    jest.spyOn(mssql, 'close').mockImplementation(() => {
      throw new Error('test')
    })

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(sqlSouth.logger.error).toHaveBeenCalledWith(new Error('test'))
  })

  it('should log an error if invalid driver is specified', async () => {
    sqlSouth.driver = 'invalid'

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(sqlSouth.logger.error).toHaveBeenCalledWith('Driver invalid not supported by SQLDbToFile')
  })

  it('should not send file on emtpy result', async () => {
    sqlSouth.driver = 'mysql'

    sqlSouth.getDataFromMySQL = () => []

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(engine.addFile).not.toBeCalled()
  })

  it('should send uncompressed file when the result is not empty and compression is false', async () => {
    const RealDate = Date
    global.Date.now = jest.fn(() => new RealDate(nowDateString).getTime() + localTimezoneOffsetInMs)

    sqlSouth.driver = 'mysql'

    const startTime = new Date('2019-10-03T13:36:36.360Z')
    const endTime = new Date('2019-10-03T13:40:40.400Z')
    const valueTimestamp = new Date('2019-10-03T13:38:38.380Z')
    const rows = [{
      value: 75.2,
      timestamp: valueTimestamp,
    }]
    const csvContent = `value,timestamp${'\n'}${rows[0].value},${rows[0].timestamp}`
    sqlSouth.getDataFromMySQL = (startTimeParam, _) => (
      startTimeParam < valueTimestamp ? {
        rows: [{
          value: 75.2,
          timestamp: valueTimestamp,
        }],
      } : { rows: [] }
    )
    csv.unparse.mockReturnValue(csvContent)
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => true)

    await sqlSouth.historyQuery(sqlConfig.scanMode, startTime, endTime)

    const { engineConfig: { caching: { cacheFolder } } } = sqlSouth.engine.configService.getConfig()
    const tmpFolder = path.resolve(cacheFolder, sqlSouth.dataSource.id)
    const expectedPath = path.join(tmpFolder, 'sql-2020_02_02_02_02_02.csv')
    expect(csv.unparse).toBeCalledTimes(1)
    expect(fs.writeFileSync).toBeCalledWith(expectedPath, csvContent)
    expect(engine.addFile).toBeCalledWith('datasource-uuid-8', expectedPath, false)
    global.Date = RealDate
  })

  it('should send compressed file when the result is not empty and compression is true', async () => {
    const RealDate = Date
    global.Date.now = jest.fn(() => new RealDate(nowDateString).getTime() + localTimezoneOffsetInMs)

    sqlSouth.driver = 'mysql'

    const startTime = new Date('2019-10-03T13:36:36.360Z')
    const endTime = new Date('2019-10-03T13:40:40.400Z')
    const valueTimestamp = new Date('2019-10-03T13:38:38.380Z')
    const rows = [{
      value: 75.2,
      timestamp: valueTimestamp,
    }]
    const csvContent = `value,timestamp${'\n'}${rows[0].value},${rows[0].timestamp}`
    sqlSouth.getDataFromMySQL = (startTimeParam, _) => (
      startTimeParam < valueTimestamp ? rows : []
    )
    csv.unparse.mockReturnValue(csvContent)
    jest.spyOn(fs, 'writeFileSync')

    const { engineConfig: { caching: { cacheFolder } } } = sqlSouth.engine.configService.getConfig()
    const tmpFolder = path.resolve(cacheFolder, sqlSouth.dataSource.id)
    fs.mkdirSync(tmpFolder, { recursive: true })
    const targetCsv = path.join(tmpFolder, 'sql-2020_02_02_02_02_02.csv')
    const targetGzip = path.join(tmpFolder, 'sql-2020_02_02_02_02_02.csv.gz')
    const decompressedCsv = path.join(tmpFolder, 'decompressed.csv')
    sqlSouth.compression = true

    await sqlSouth.historyQuery(sqlConfig.scanMode, startTime, endTime)

    expect(csv.unparse).toBeCalledTimes(1)
    expect(fs.writeFileSync).toBeCalledWith(targetCsv, csvContent)
    expect(engine.addFile).toBeCalledWith('datasource-uuid-8', targetGzip, false)

    await sqlSouth.decompress(targetGzip, decompressedCsv)
    const targetBuffer = fs.readFileSync(decompressedCsv)
    expect(targetBuffer.toString()).toEqual(csvContent)

    sqlSouth.compression = false
    fs.rmdirSync(tmpFolder, { recursive: true })
    global.Date = RealDate
  })

  it('should manage fs unlink error and catch error', async () => {
    sqlSouth.driver = 'mysql'

    const startTime = new Date('2019-10-03T13:36:36.360Z')
    const endTime = new Date('2019-10-03T13:40:40.400Z')
    const valueTimestamp = new Date('2019-10-03T13:38:38.380Z')
    const rows = [{
      value: 75.2,
      timestamp: '2019-10-03T14:36:38.590Z',
    }]
    const csvContent = `value,timestamp${'\n'}${rows[0].value},${rows[0].timestamp}`
    sqlSouth.getDataFromMySQL = (startTimeParam, _) => (
      startTimeParam < valueTimestamp ? rows : []
    )
    csv.unparse.mockReturnValue(csvContent)
    jest.spyOn(fs, 'writeFileSync')
    jest.spyOn(fs, 'unlink')
    const mError = new Error('unlink Error')
    fs.unlink.mockImplementationOnce((filename, callback) => {
      callback(mError)
    })

    engine.addFile.mockImplementationOnce(() => {
      throw Error('add file error')
    })

    const { engineConfig: { caching: { cacheFolder } } } = sqlSouth.engine.configService.getConfig()
    const tmpFolder = path.resolve(cacheFolder, sqlSouth.dataSource.id)
    fs.mkdirSync(tmpFolder, { recursive: true })
    sqlSouth.compression = true

    await sqlSouth.historyQuery(sqlConfig.scanMode, startTime, endTime)

    expect(sqlSouth.logger.error).toHaveBeenCalledWith(new Error('unlink Error'))
    expect(sqlSouth.logger.error).toHaveBeenCalledWith(new Error('add file error'))

    sqlSouth.compression = false
    fs.rmdirSync(tmpFolder, { recursive: true })
  })

  it('should format date properly without timezone', () => {
    const actual = SQLDbToFile.formatDateWithTimezone(
      new Date(Date.UTC(2020, 2, 22, 22, 22, 22, 666)),
      'Europe/Paris',
      'YYYY_MM_DD HH:mm:ss.SSS',
    )
    const expected = '2020_03_22 22:22:22.666'
    expect(actual).toBe(expected)
  })

  it('should format date properly with timezone', () => {
    const actual = SQLDbToFile.formatDateWithTimezone(
      new Date(Date.UTC(2020, 2, 22, 22, 22, 22, 666)),
      'Europe/Paris',
      'YYYY_MM_DD HH:mm:ss.SSS Z',
    )
    const expected = '2020_03_22 22:22:22.666 +01:00'
    expect(actual).toBe(expected)
  })

  it('should generate proper replacement parameters when no parameters are used', () => {
    const query = 'SELECT timestamp,temperature FROM history'
    const startTime = new Date('2020-02-20 20:20:20.222')
    const endTime = new Date('2020-02-20 22:20:20.222')
    const maxReturnValues = 666

    const replacementParameters = SQLDbToFile.generateReplacementParameters(query, startTime, endTime, maxReturnValues)

    expect(replacementParameters).toEqual([])
  })

  it('should generate proper replacement parameters when some parameters are used', () => {
    const query = 'SELECT timestamp,temperature FROM history WHERE timestamp > @StartTime LIMIT @MaxReturnValues'
    const startTime = new Date('2020-02-20 20:20:20.222')
    const endTime = new Date('2020-02-20 22:20:20.222')
    const maxReturnValues = 666

    const replacementParameters = SQLDbToFile.generateReplacementParameters(query, startTime, endTime, maxReturnValues)

    expect(replacementParameters).toEqual([startTime, maxReturnValues])
  })

  it('should generate proper replacement parameters when all parameters are used', () => {
    const query = `
        SELECT timestamp,temperature
        FROM history
        WHERE
            timestamp > @StartTime
            AND timestamp <= @EndTime
            AND timestamp > @StartTime
        LIMIT @MaxReturnValues`
    const startTime = new Date('2020-02-20 20:20:20.222')
    const endTime = new Date('2020-02-20 22:20:20.222')
    const maxReturnValues = 666

    const replacementParameters = SQLDbToFile.generateReplacementParameters(query, startTime, endTime, maxReturnValues)

    expect(replacementParameters).toEqual([startTime, endTime, startTime, maxReturnValues])
  })
})
