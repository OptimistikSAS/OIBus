const fs = require('fs/promises')
const path = require('path')
const {
  Settings,
  DateTime,
} = require('luxon')

const mssql = require('mssql')
const mysql = require('mysql2/promise')
const {
  Client,
  types,
} = require('pg')

let oracledb
try {
  // eslint-disable-next-line global-require,import/no-unresolved,import/no-extraneous-dependencies
  oracledb = require('oracledb')
} catch (e) {
  console.error('node-oracledb could not be loaded. Skipping oracle tests')
}
const sqlite = require('sqlite')
const csv = require('papaparse')

const SQL = require('./SQL.class')
const databaseService = require('../../services/database.service')
const config = require('../../../tests/testConfig').default
const EncryptionService = require('../../services/EncryptionService.class')

// Mock fs
jest.mock('fs/promises', () => ({
  exists: jest.fn(() => new Promise((resolve) => {
    resolve(true)
  })),
  mkdir: jest.fn(() => new Promise((resolve) => {
    resolve(true)
  })),
  writeFile: jest.fn(() => new Promise((resolve) => {
    resolve(true)
  })),
  unlink: jest.fn(() => new Promise((resolve) => {
    resolve(true)
  })),
}))

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
jest.mock('../../engine/logger/Logger.class')

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock engine
const engine = jest.mock('../../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: config.engine }) }
engine.addFile = jest.fn()
engine.getCacheFolder = () => config.engine.caching.cacheFolder
engine.eventEmitters = {}

let sqlSouth = null
const nowDateString = '2020-02-02T02:02:02.222Z'
const sqlConfig = config.south.dataSources[7]
Settings.now = () => new Date(nowDateString).valueOf()
const RealDate = Date
beforeEach(async () => {
  jest.resetAllMocks()
  jest.clearAllMocks()
  jest.useFakeTimers()
  jest.restoreAllMocks()
  sqlSouth = new SQL(sqlConfig, engine)
  global.Date = jest.fn(() => new RealDate(nowDateString))
  global.Date.UTC = jest.fn(() => new RealDate(nowDateString).toUTCString())
})

afterEach(() => {
  global.Date = RealDate
})

describe('SQL', () => {
  it('should properly connect and set lastCompletedAt from database', async () => {
    await sqlSouth.init()
    databaseService.getConfig.mockReturnValue('2020-04-23T11:09:01.001Z')
    await sqlSouth.connect()

    expect(databaseService.createConfigDatabase)
      .toBeCalledWith(`${config.engine.caching.cacheFolder}/${sqlConfig.id}.db`)
    expect(databaseService.getConfig)
      .toHaveBeenCalledTimes(2)
    expect(sqlSouth.lastCompletedAt[sqlConfig.scanMode])
      .toEqual(new Date('2020-04-23T11:09:01.001Z'))
  })

  it('should properly connect and set lastCompletedAt from startTime', async () => {
    await sqlSouth.init()
    databaseService.getConfig.mockReturnValue(null)

    const tempConfig = { ...sqlConfig }
    tempConfig.startTime = '2020-02-02 02:02:02'
    const tempSqlSouth = new SQL(tempConfig, engine)
    await tempSqlSouth.init()
    await tempSqlSouth.connect()

    expect(tempSqlSouth.lastCompletedAt[sqlConfig.scanMode])
      .toEqual(new Date('2020-02-02 02:02:02'))
  })

  it('should trigger an error on connection if timezone is invalid', async () => {
    const badConfig = {
      ...sqlConfig,
      SQL: {
        ...sqlConfig.SQL,
        timezone: undefined,
        databasePath: undefined,
      },
    }
    const badSqlSouth = new SQL(badConfig, engine)
    await badSqlSouth.init()

    expect(badSqlSouth.logger.error)
      .toHaveBeenCalledWith('Invalid timezone supplied: undefined')

    expect(fs.mkdir)
      .toHaveBeenCalledTimes(1)
  })

  it('should properly connect and set lastCompletedAt to now', async () => {
    databaseService.getConfig.mockReturnValue(null)
    await sqlSouth.init()
    await sqlSouth.connect()

    expect(databaseService.createConfigDatabase)
      .toBeCalledWith(`${config.engine.caching.cacheFolder}/${sqlConfig.id}.db`)
    expect(databaseService.getConfig)
      .toHaveBeenCalledTimes(2)
    expect(sqlSouth.lastCompletedAt)
      .not
      .toEqual(new Date(nowDateString).getTime())
  })

  it('should properly get the latest date', async () => {
    await sqlSouth.init()
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
    expect(latestDate1)
      .toEqual(new Date('2021-03-30 12:30:00.151'))
    sqlSouth.logger.debug.mockClear()

    const latestDate2 = sqlSouth.getLatestDate(entryList2, new Date('2020-02-02T02:02:02.000Z')) // with number format - no ms
    expect(latestDate2)
      .toEqual(new Date(1617107400001))
    sqlSouth.logger.debug.mockClear()

    const latestDate3 = sqlSouth.getLatestDate(entryList3, new Date('2020-02-02T02:02:02.000Z')) // with date format
    expect(latestDate3)
      .toEqual(new Date(1617193800001))
    sqlSouth.logger.debug.mockClear()

    const latestDate4 = sqlSouth.getLatestDate(entryList4, new Date('2020-02-02T02:02:02.000Z')) // without timestamp
    expect(latestDate4)
      .toEqual(new Date('2020-02-02T02:02:02.000Z'))
  })

  it('should quit historyQuery if timezone is invalid', async () => {
    await sqlSouth.init()
    await sqlSouth.connect()
    const { timezone } = sqlSouth
    sqlSouth.timezone = undefined

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(sqlSouth.logger.error)
      .toHaveBeenCalledWith('Invalid timezone')
    sqlSouth.timezone = timezone
  })

  it('should interact with MS SQL server if driver is mssql', async () => {
    await sqlSouth.init()
    await sqlSouth.connect()

    sqlSouth.driver = 'mssql'
    const query = jest.fn(() => ({ recordsets: [[{ timestamp: new Date('2020-12-25T00:00:00.000Z') }]] }))
    const input = jest.fn(() => ({ query }))
    const request = jest.fn(() => ({ input }))
    const connect = jest.fn(() => ({ request }))
    jest.spyOn(mssql, 'ConnectionPool')
      .mockImplementation(() => ({ connect }))
    jest.spyOn(mssql, 'close')

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    const expectedConfig = {
      server: sqlConfig.SQL.host,
      port: sqlConfig.SQL.port,
      user: sqlConfig.SQL.username,
      password: sqlConfig.SQL.password,
      database: sqlConfig.SQL.database,
      connectionTimeout: sqlConfig.SQL.connectionTimeout,
      requestTimeout: sqlConfig.SQL.requestTimeout,
      options: {
        encrypt: sqlConfig.SQL.encryption,
        trustServerCertificate: true,
      },
    }
    expect(mssql.ConnectionPool)
      .toHaveBeenCalledWith(expectedConfig)
    expect(connect)
      .toBeCalledTimes(1)
    expect(request)
      .toBeCalledTimes(1)
    expect(mssql.close)
      .toHaveBeenCalledTimes(1)
  })

  it('should interact with MySQL server if driver is mysql', async () => {
    global.Date = RealDate
    await sqlSouth.init()
    await sqlSouth.connect()

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
    jest.spyOn(mysql, 'createConnection')
      .mockImplementation(() => connection)

    await sqlSouth.historyQuery(sqlConfig.scanMode, startTime, endTime)

    const expectedConfig = {
      host: sqlConfig.SQL.host,
      port: sqlConfig.SQL.port,
      user: sqlConfig.SQL.username,
      password: sqlConfig.SQL.password,
      database: sqlConfig.SQL.database,
      connectTimeout: sqlConfig.SQL.connectionTimeout,
      timezone: 'Z',
    }
    const expectedExecute = {
      sql: 'SELECT created_at AS timestamp, value1 AS temperature FROM oibus_test WHERE created_at > ? AND created_at <= ?',
      timeout: sqlConfig.SQL.requestTimeout,
    }
    const expectedExecuteParams = [
      new Date('2019-10-03T13:36:36.360Z'),
      new Date('2019-10-03T13:40:40.400Z'),
    ]
    expect(mysql.createConnection)
      .toHaveBeenCalledWith(expectedConfig)
    expect(connection.execute)
      .toBeCalledWith(expectedExecute, expectedExecuteParams)
    expect(connection.end)
      .toBeCalledTimes(1)
    expect(sqlSouth.logger.info)
      // eslint-disable-next-line max-len
      .toBeCalledWith('Executing "SELECT created_at AS timestamp, value1 AS temperature FROM oibus_test WHERE created_at > @StartTime AND created_at <= @EndTime" with StartTime = 2019-10-03T13:36:36.360Z EndTime = 2019-10-03T13:40:40.400Z')

    mysql.createConnection.mockClear()
    connection.execute.mockClear()
    connection.end.mockClear()

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(mysql.createConnection)
      .toHaveBeenCalledWith(expectedConfig)
    // expect(connection.execute).toBeCalledWith(expectedExecute, expectedExecuteParams)
    expect(connection.execute)
      .toBeCalledTimes(1)
    expect(connection.end)
      .toBeCalledTimes(1)
    sqlSouth.containsLastCompletedDate = true
  })

  it('should interact with MySQL server and catch request error', async () => {
    await sqlSouth.init()
    await sqlSouth.connect()

    sqlSouth.driver = 'mysql'

    const connection = {
      execute: jest.fn(() => {
        throw new Error('execute error')
      }),
      end: jest.fn(),
    }
    jest.spyOn(mysql, 'createConnection')
      .mockImplementationOnce(() => connection)

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(sqlSouth.logger.error)
      .toBeCalledWith(new Error('execute error'))

    sqlSouth.logger.error.mockClear()
    jest.spyOn(mysql, 'createConnection')
      .mockImplementationOnce(() => null)
    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))
    expect(sqlSouth.logger.error)
      .toBeCalledWith(new TypeError('Cannot read properties of null (reading \'execute\')'))
  })

  it('should interact with PostgreSQL server if driver is postgresql', async () => {
    await sqlSouth.init()
    await sqlSouth.connect()

    sqlSouth.driver = 'postgresql'
    const startTime = DateTime.fromISO('2019-10-03T13:36:36.360Z')
      .toJSDate()
    const endTime = DateTime.fromISO('2019-10-03T13:40:40.400Z')
      .toJSDate()
    const valueTimestamp = DateTime.fromSQL('2019-10-03 15:38:38.380', { zone: sqlSouth.timezone })
      .toJSDate()
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

    await sqlSouth.historyQuery(sqlConfig.scanMode, startTime, endTime)

    const expectedConfig = {
      host: sqlConfig.SQL.host,
      port: sqlConfig.SQL.port,
      user: sqlConfig.SQL.username,
      password: sqlConfig.SQL.password,
      database: sqlConfig.SQL.database,
      query_timeout: sqlConfig.SQL.requestTimeout,
    }
    const expectedQuery = 'SELECT created_at AS timestamp, value1 AS temperature FROM oibus_test WHERE created_at > $1 AND created_at <= $2'
    const expectedExecuteParams = [
      new Date('2019-10-03T13:36:36.360Z'),
      new Date('2019-10-03T13:40:40.400Z'),
    ]
    expect(types.setTypeParser)
      .toBeCalledWith(1114, expect.any(Function))
    expect(Client)
      .toBeCalledWith(expectedConfig)
    expect(client.connect)
      .toBeCalledTimes(1)
    expect(client.query)
      .toBeCalledWith(expectedQuery, expectedExecuteParams)
    expect(client.end)
      .toBeCalledTimes(1)
  })

  it('should interact with PostgreSQL server and catch request error', async () => {
    await sqlSouth.init()
    await sqlSouth.connect()

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

    expect(sqlSouth.logger.error)
      .toBeCalledWith(new Error('query error'))
  })

  it('should interact with PostgreSQL server and not end connection if it is null', async () => {
    await sqlSouth.init()
    await sqlSouth.connect()

    sqlSouth.driver = 'postgresql'

    types.setTypeParser = jest.fn()

    jest.mock('pg', () => ({
      Client: jest.fn(() => null),
      types: jest.fn(),
    }))

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(sqlSouth.logger.error)
      .toBeCalledTimes(2)
  })

  it('should interact with Oracle server if driver is oracle', async () => {
    await sqlSouth.init()
    await sqlSouth.connect()

    if (!oracledb) return
    sqlSouth.driver = 'oracle'
    const startTime = DateTime.fromISO('2019-10-03T13:36:36.360Z')
      .toJSDate()
    const endTime = DateTime.fromISO('2019-10-03T13:40:40.400Z')
      .toJSDate()
    const valueTimestamp = DateTime.fromSQL('2019-10-03 15:38:38.380', { zone: sqlSouth.timezone })
      .toJSDate()
    const connection = {
      callTimeout: 0,
      execute: jest.fn((adaptedQuery, params) => (
        params[0] < valueTimestamp ? {
          rows: [{
            value: 75.2,
            timestamp: '2019-10-03 15:38:38.380',
          }],
        } : { rows: [] }
      )),
      close: jest.fn(),
    }
    jest.spyOn(oracledb, 'getConnection')
      .mockImplementation(() => connection)

    await sqlSouth.historyQuery(sqlConfig.scanMode, startTime, endTime)

    const expectedConfig = {
      user: sqlConfig.SQL.username,
      password: sqlConfig.SQL.password,
      connectString: `${sqlConfig.SQL.host}:${sqlConfig.SQL.port}/${sqlConfig.SQL.database}`,
    }
    // eslint-disable-next-line
    const expectedQuery = 'SELECT created_at AS timestamp, value1 AS temperature FROM oibus_test WHERE created_at > :date1 AND created_at <= :date2'
    const expectedExecuteParams = [
      new Date('2019-10-03T13:36:36.360Z'),
      new Date('2019-10-03T13:40:40.400Z'),
    ]
    expect(oracledb.getConnection)
      .toHaveBeenCalledWith(expectedConfig)
    expect(connection.execute)
      .toBeCalledTimes(1)
    expect(connection.execute)
      .toBeCalledWith(expectedQuery, expectedExecuteParams)
    expect(connection.close)
      .toBeCalledTimes(1)
  })

  it('should interact with Oracle server and catch request error', async () => {
    await sqlSouth.init()
    await sqlSouth.connect()

    if (!oracledb) return
    sqlSouth.driver = 'oracle'

    const connection = {
      callTimeout: 0,
      execute: jest.fn(() => {
        throw new Error('execute error')
      }),
      close: jest.fn(),
    }
    jest.spyOn(oracledb, 'getConnection')
      .mockImplementationOnce(() => connection)

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(sqlSouth.logger.error)
      .toBeCalledWith(new Error('execute error'))

    sqlSouth.logger.error.mockClear()
    jest.spyOn(oracledb, 'getConnection')
      .mockImplementationOnce(() => null)
    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))
    expect(sqlSouth.logger.error)
      .toBeCalledWith(new TypeError('Cannot set properties of null (setting \'callTimeout\')'))
  })

  it('should interact with SQLite database server if driver is sqlite', async () => {
    await sqlSouth.init()
    await sqlSouth.connect()

    sqlSouth.driver = 'sqlite'
    const startTime = DateTime.fromISO('2019-10-03T13:36:36.360Z')
      .toJSDate()
    const endTime = DateTime.fromISO('2019-10-03T13:40:40.400Z')
      .toJSDate()
    const valueTimestamp = DateTime.fromSQL('2019-10-03 15:38:38.380', { zone: sqlSouth.timezone })
      .toJSDate()

    const finalize = jest.fn()
    const all = jest.fn((preparedParameters) => (
      preparedParameters['@StartTime'] < valueTimestamp
        ? [{
          value: 75.2,
          timestamp: '2019-10-03 15:38:38.380',
        }]
        : []
    ))
    const prepare = jest.fn(() => ({
      all,
      finalize,
    }))
    const close = jest.fn()
    const database = {
      prepare,
      close,
    }
    jest.spyOn(sqlite, 'open')
      .mockResolvedValue(database)

    await sqlSouth.historyQuery(sqlConfig.scanMode, startTime, endTime)

    expect(database.prepare)
      .toBeCalledTimes(1)
    expect(database.close)
      .toBeCalledTimes(1)

    database.close.mockClear()
    database.prepare.mockClear()
  })

  it('should interact with SQLite database and catch request error', async () => {
    await sqlSouth.init()
    await sqlSouth.connect()

    sqlSouth.driver = 'sqlite'

    jest.spyOn(sqlite, 'open')
      .mockImplementation(() => {
        throw new Error('test')
      })

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(sqlSouth.logger.error)
      .toBeCalledWith(new Error('test'))
  })

  it('should trigger an error and catch it', async () => {
    await sqlSouth.init()
    await sqlSouth.connect()

    sqlSouth.driver = 'mssql'

    const query = jest.fn(() => ({ recordsets: [[{ timestamp: new Date('2020-12-25T00:00:00.000Z') }]] }))
    const input = jest.fn(() => ({ query }))
    const request = jest.fn(() => ({ input }))
    const connect = jest.fn(() => ({ request }))
    jest.spyOn(mssql, 'ConnectionPool')
      .mockImplementation(() => ({ connect }))
    jest.spyOn(mssql, 'close')
      .mockImplementation(() => {
        throw new Error('test')
      })

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(sqlSouth.logger.error)
      .toHaveBeenCalledWith(new Error('test'))
  })

  it('should log an error if invalid driver is specified', async () => {
    await sqlSouth.init()
    await sqlSouth.connect()

    sqlSouth.driver = 'invalid'

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(sqlSouth.logger.error)
      .toHaveBeenCalledWith('Driver invalid not supported by SQL')
  })

  it('should not send file on emtpy result', async () => {
    await sqlSouth.init()
    await sqlSouth.connect()

    sqlSouth.driver = 'mysql'

    sqlSouth.getDataFromMySQL = () => []

    await sqlSouth.historyQuery(sqlConfig.scanMode, new Date('2019-10-03T13:36:38.590Z'), new Date('2019-10-03T15:36:38.590Z'))

    expect(engine.addFile)
      .not
      .toBeCalled()
  })

  it('should send uncompressed file when the result is not empty and compression is false', async () => {
    global.Date = RealDate
    await sqlSouth.init()
    await sqlSouth.connect()

    sqlSouth.driver = 'mysql'

    const startTime = DateTime.fromISO('2019-10-03T13:36:36.360Z')
      .toJSDate()
    const endTime = DateTime.fromISO('2019-10-03T13:40:40.400Z')
      .toJSDate()
    const valueTimestamp = DateTime.fromSQL('2019-10-03 15:38:38.380', { zone: sqlSouth.timezone })
      .toJSDate()

    const rows = [{
      value: 75.2,
      timestamp: '2019-10-03 15:38:38.380',
    }]
    const csvContent = `value,timestamp${'\n'}${rows[0].value},${rows[0].timestamp}`
    sqlSouth.getDataFromMySQL = (startTimeParam, _) => (
      startTimeParam < valueTimestamp
        ? [{
          value: 75.2,
          timestamp: '2019-10-03 15:38:38.380',
        }] : []
    )
    csv.unparse.mockReturnValue(csvContent)
    jest.spyOn(fs, 'writeFile')
      .mockImplementation(() => true)

    await sqlSouth.historyQuery(sqlConfig.scanMode, startTime, endTime)

    const { engineConfig: { caching: { cacheFolder } } } = sqlSouth.engine.configService.getConfig()
    const tmpFolder = path.resolve(cacheFolder, sqlSouth.dataSource.id)
    const expectedPath = path.join(tmpFolder, 'sql-2020_02_02_02_02_02_222.csv')
    expect(csv.unparse)
      .toBeCalledTimes(1)
    expect(fs.writeFile)
      .toBeCalledWith(expectedPath, csvContent)
    expect(engine.addFile)
      .toBeCalledWith('datasource-uuid-8', expectedPath, false)
  })

  it('should send compressed file when the result is not empty and compression is true', async () => {
    global.Date = RealDate
    await sqlSouth.init()
    await sqlSouth.connect()

    sqlSouth.driver = 'mysql'

    const startTime = DateTime.fromISO('2019-10-03T13:36:36.360Z')
      .toJSDate()
    const endTime = DateTime.fromISO('2019-10-03T13:40:40.400Z')
      .toJSDate()
    const valueTimestamp = DateTime.fromSQL('2019-10-03 15:38:38.380', { zone: sqlSouth.timezone })
      .toJSDate()
    const rows = [{
      value: 75.2,
      timestamp: '2019-10-03 15:38:38.380',
    }]
    const csvContent = `value,timestamp${'\n'}${rows[0].value},${rows[0].timestamp}`
    sqlSouth.getDataFromMySQL = (startTimeParam, _) => (
      startTimeParam < valueTimestamp ? rows : []
    )
    csv.unparse.mockReturnValue(csvContent)
    jest.spyOn(fs, 'writeFile')

    const { engineConfig: { caching: { cacheFolder } } } = sqlSouth.engine.configService.getConfig()
    const tmpFolder = path.resolve(cacheFolder, sqlSouth.dataSource.id)
    const targetCsv = path.join(tmpFolder, 'sql-2020_02_02_02_02_02_222.csv')
    const targetGzip = path.join(tmpFolder, 'sql-2020_02_02_02_02_02_222.csv.gz')
    sqlSouth.compression = true
    sqlSouth.compress = jest.fn()

    await sqlSouth.historyQuery(sqlConfig.scanMode, startTime, endTime)

    expect(csv.unparse)
      .toBeCalledTimes(1)
    expect(fs.writeFile)
      .toBeCalledWith(targetCsv, csvContent)
    expect(engine.addFile)
      .toBeCalledWith('datasource-uuid-8', targetGzip, false)
  })

  it('should manage fs unlink error and catch error', async () => {
    global.Date = RealDate
    await sqlSouth.init()
    await sqlSouth.connect()

    sqlSouth.driver = 'mysql'

    const startTime = DateTime.fromISO('2019-10-03T13:36:36.360Z')
      .toJSDate()
    const endTime = DateTime.fromISO('2019-10-03T13:40:40.400Z')
      .toJSDate()
    const valueTimestamp = DateTime.fromSQL('2019-10-03 15:38:38.380', { zone: sqlSouth.timezone })
      .toJSDate()
    const rows = [{
      value: 75.2,
      timestamp: '2019-10-03 15:38:38.380',
    }]
    const csvContent = `value,timestamp${'\n'}${rows[0].value},${rows[0].timestamp}`
    sqlSouth.getDataFromMySQL = (startTimeParam, _) => (
      startTimeParam < valueTimestamp ? rows : []
    )
    csv.unparse.mockReturnValue(csvContent)
    fs.unlink = jest.fn(() => {
      throw Error('unlink Error')
    })

    engine.addFile.mockImplementationOnce(() => {
      throw Error('add file error')
    })

    const { engineConfig: { caching: { cacheFolder } } } = sqlSouth.engine.configService.getConfig()
    const tmpFolder = path.resolve(cacheFolder, sqlSouth.dataSource.id)
    await fs.mkdir(tmpFolder, { recursive: true })
    sqlSouth.compression = true

    sqlSouth.compress = jest.fn()
    await sqlSouth.historyQuery(sqlConfig.scanMode, startTime, endTime)

    expect(sqlSouth.logger.error)
      .toHaveBeenCalledWith(new Error('unlink Error'))
    expect(sqlSouth.logger.error)
      .toHaveBeenCalledWith(new Error('add file error'))

    sqlSouth.compression = false
  })

  it('should format date properly without timezone', () => {
    global.Date = RealDate
    const actual = SQL.formatDateWithTimezone(
      new Date(Date.UTC(2020, 2, 22, 22, 22, 22, 666)),
      'Europe/Paris',
      'yyyy_MM_dd HH:mm:ss.SSS',
    )
    const expected = '2020_03_22 22:22:22.666'
    expect(actual).toBe(expected)
  })

  it('should format date properly with timezone', () => {
    global.Date = RealDate
    const actual = SQL.formatDateWithTimezone(
      new Date(Date.UTC(2020, 2, 22, 22, 22, 22, 666)),
      'Europe/Paris',
      'yyyy_MM_dd HH:mm:ss.SSS ZZ',
    )
    const expected = '2020_03_22 22:22:22.666 +00:00'
    expect(actual).toBe(expected)
  })

  it('should generate proper replacement parameters when no parameters are used', () => {
    const query = 'SELECT timestamp,temperature FROM history'
    const startTime = new Date('2020-02-20 20:20:20.222')
    const endTime = new Date('2020-02-20 22:20:20.222')
    const maxReturnValues = 666

    const replacementParameters = SQL.generateReplacementParameters(query, startTime, endTime, maxReturnValues)

    expect(replacementParameters)
      .toEqual([])
  })

  it('should generate proper replacement parameters when some parameters are used', () => {
    global.Date = RealDate
    const query = 'SELECT timestamp,temperature FROM history WHERE timestamp > @StartTime LIMIT @MaxReturnValues'
    const startTime = new Date('2020-02-20 20:20:20.222')
    const endTime = new Date('2020-02-20 22:20:20.222')

    const replacementParameters = SQL.generateReplacementParameters(query, startTime, endTime)

    expect(replacementParameters)
      .toEqual([startTime])
  })

  it('should generate proper replacement parameters when all parameters are used', () => {
    const query = `
          SELECT timestamp, temperature
          FROM history
          WHERE
              timestamp
              > @StartTime
            AND timestamp <= @EndTime
            AND timestamp
              > @StartTime
              LIMIT @MaxReturnValues`
    const startTime = new Date('2020-02-20 20:20:20.222')
    const endTime = new Date('2020-02-20 22:20:20.222')

    const replacementParameters = SQL.generateReplacementParameters(query, startTime, endTime)

    expect(replacementParameters)
      .toEqual([startTime, endTime, startTime])
  })
})
