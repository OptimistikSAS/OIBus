const fs = require('fs')
const path = require('path')

const mssql = require('mssql')
const mysql = require('mysql2/promise')
const { Client, types } = require('pg')
const oracledb = require('oracledb')
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
const engine = jest.genMockFromModule('../../engine/Engine.class')
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

  it('should properly connect and set lastCompletedAt from database', async () => {
    databaseService.getConfig.mockReturnValue('2020-08-07T06:48:12.852Z')

    await sqlSouth.connect()

    expect(databaseService.createConfigDatabase).toBeCalledWith(`${config.engine.caching.cacheFolder}/${sqlConfig.dataSourceId}.db`)
    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(sqlSouth.lastCompletedAt).toEqual('2020-08-07T06:48:12.852Z')
  })

  it('should properly connect and set lastCompletedAt from startDate', async () => {
    const tempConfig = { ...sqlConfig }
    tempConfig.SQLDbToFile.startDate = '2010-01-01T08:00:00.000Z'
    const tempSqlSouth = new SQLDbToFile(tempConfig, engine)

    await tempSqlSouth.connect()

    expect(tempSqlSouth.lastCompletedAt).toEqual('2010-01-01T08:00:00.000Z')
  })

  it('should trigger an error on connection if timezone is invalid and create folder', async () => {
    jest.spyOn(fs, 'existsSync').mockImplementation(() => false)
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => true)

    const badConfig = { ...sqlConfig }
    badConfig.SQLDbToFile.timezone = undefined
    const badSqlSouth = new SQLDbToFile(badConfig, engine)

    expect(badSqlSouth.logger.error).toHaveBeenCalledWith('Invalid timezone supplied: undefined')

    expect(fs.mkdirSync).toHaveBeenCalledTimes(1)
  })

  it('should properly connect and set lastCompletedAt now', async () => {
    const RealDate = Date
    global.Date = jest.fn(() => new RealDate(nowDateString))

    databaseService.getConfig.mockReturnValue(null)

    await sqlSouth.connect()

    expect(databaseService.createConfigDatabase).toBeCalledWith(`${config.engine.caching.cacheFolder}/${sqlConfig.dataSourceId}.db`)
    expect(databaseService.getConfig).toHaveBeenCalledTimes(1)
    expect(sqlSouth.lastCompletedAt).not.toEqual(new Date(nowDateString).getTime())
    global.Date = RealDate
  })

  it('should quit onScan if timezone is invalid', async () => {
    const { timezone } = sqlSouth
    sqlSouth.timezone = undefined

    await sqlSouth.onScan(sqlConfig.scanMode)

    expect(sqlSouth.logger.error).toHaveBeenCalledWith('Invalid timezone')
    sqlSouth.timezone = timezone
  })

  it('should interact with MS SQL server if driver is mssql', async () => {
    sqlSouth.lastCompletedAt = '2020-02-02T02:02:02.222Z'
    sqlSouth.driver = 'mssql'
    const query = jest.fn(() => ({ recordsets: [[{ timestamp: new Date('2020-12-25T00:00:00.000Z') }]] }))
    const input = jest.fn(() => ({ query }))
    const request = jest.fn(() => ({ input }))
    const connect = jest.fn(() => ({ request }))
    jest.spyOn(mssql, 'ConnectionPool').mockImplementation(() => ({ connect }))
    jest.spyOn(mssql, 'close')

    await sqlSouth.onScan(sqlConfig.scanMode)

    expect(sqlSouth.lastCompletedAt).toBe('2020-12-25T00:00:00.000Z')

    const expectedConfig = {
      server: sqlConfig.SQLDbToFile.host,
      port: sqlConfig.SQLDbToFile.port,
      user: sqlConfig.SQLDbToFile.username,
      password: sqlConfig.SQLDbToFile.password,
      database: sqlConfig.SQLDbToFile.database,
      connectionTimeout: sqlConfig.SQLDbToFile.connectionTimeout,
      requestTimeout: sqlConfig.SQLDbToFile.requestTimeout,
      options: { encrypt: sqlConfig.SQLDbToFile.encryption },
    }
    expect(mssql.ConnectionPool).toHaveBeenCalledWith(expectedConfig)
    expect(connect).toBeCalledTimes(1)
    expect(request).toBeCalledTimes(1)
    expect(mssql.close).toHaveBeenCalledTimes(1)
    sqlSouth.lastCompletedAt = '2020-02-02T02:02:02.222Z'
  })

  it('should interact with MS SQL server and not set lastCompletedAt', async () => {
    sqlSouth.driver = 'mssql'
    sqlSouth.lastCompletedAt = undefined
    sqlSouth.domain = 'TestDomain'
    const query = jest.fn(() => ({ recordsets: [[{ timestamp: 'not a timestamp' }]] }))
    const input = jest.fn(() => ({ query }))
    const request = jest.fn(() => ({ input }))
    const connect = jest.fn(() => ({ request }))
    jest.spyOn(mssql, 'ConnectionPool').mockImplementation(() => ({ connect }))
    jest.spyOn(mssql, 'close')

    await sqlSouth.onScan(sqlConfig.scanMode)

    const expectedConfig = {
      server: sqlConfig.SQLDbToFile.host,
      port: sqlConfig.SQLDbToFile.port,
      user: sqlConfig.SQLDbToFile.username,
      password: sqlConfig.SQLDbToFile.password,
      database: sqlConfig.SQLDbToFile.database,
      connectionTimeout: sqlConfig.SQLDbToFile.connectionTimeout,
      requestTimeout: sqlConfig.SQLDbToFile.requestTimeout,
      options: { encrypt: sqlConfig.SQLDbToFile.encryption },
      domain: 'TestDomain',
    }
    expect(mssql.ConnectionPool).toHaveBeenCalledWith(expectedConfig)

    expect(sqlSouth.logger.debug).toHaveBeenCalledWith('lastCompletedAt not used')
    sqlSouth.lastCompletedAt = '2020-02-02T02:02:02.222Z'
  })

  it('should interact with MS SQL server with no LastCompletedDate and catch error', async () => {
    sqlSouth.driver = 'mssql'
    sqlSouth.containsLastCompletedDate = false
    const query = jest.fn(() => { throw new Error('request error') })
    const request = jest.fn(() => ({ query }))
    const connect = jest.fn(() => ({ request }))
    jest.spyOn(mssql, 'ConnectionPool').mockImplementation(() => ({ connect }))
    jest.spyOn(mssql, 'close')

    await sqlSouth.onScan(sqlConfig.scanMode)

    expect(sqlSouth.logger.error).toHaveBeenCalledWith(new Error('request error'))
    sqlSouth.containsLastCompletedDate = true
  })

  it('should interact with MySQL server if driver is mysql', async () => {
    sqlSouth.driver = 'mysql'

    const connection = {
      execute: jest.fn(() => ([{
        value: 75.2,
        timestamp: '2019-10-03T14:36:38.590Z',
      }])),
      end: jest.fn(),
    }
    jest.spyOn(mysql, 'createConnection').mockImplementation(() => connection)

    await sqlSouth.onScan(sqlConfig.scanMode)

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
      sql: 'SELECT created_at AS timestamp, value1 AS temperature FROM oibus_test WHERE created_at > ?',
      timeout: sqlConfig.SQLDbToFile.requestTimeout,
    }
    const expectedExecuteParams = [new Date(nowDateString)]
    expect(mysql.createConnection).toHaveBeenCalledWith(expectedConfig)
    expect(connection.execute).toBeCalledWith(expectedExecute, expectedExecuteParams)
    expect(connection.end).toBeCalledTimes(1)
    // eslint-disable-next-line max-len
    expect(sqlSouth.logger.debug).toBeCalledWith('Executing "SELECT created_at AS timestamp, value1 AS temperature FROM oibus_test WHERE created_at > ?" with LastCompletedDate')
  })

  it('should interact with MySQL server and catch request error', async () => {
    sqlSouth.driver = 'mysql'

    const connection = {
      execute: jest.fn(() => {
        throw new Error('execute error')
      }),
      end: jest.fn(),
    }
    jest.spyOn(mysql, 'createConnection').mockImplementation(() => connection)

    await sqlSouth.onScan(sqlConfig.scanMode)

    expect(sqlSouth.logger.error).toBeCalledWith(new Error('execute error'))
  })

  it('should interact with PostgreSQL server if driver is postgresql', async () => {
    sqlSouth.driver = 'postgresql'

    types.setTypeParser = jest.fn()
    const client = {
      connect: jest.fn(),
      query: jest.fn(() => ({
        rows: [{
          value: 75.2,
          timestamp: '2019-10-03T14:36:38.590Z',
        }],
      })),
      end: jest.fn(),
    }
    Client.mockReturnValue(client)

    await sqlSouth.onScan(sqlConfig.scanMode)

    const expectedConfig = {
      host: sqlConfig.SQLDbToFile.host,
      port: sqlConfig.SQLDbToFile.port,
      user: sqlConfig.SQLDbToFile.username,
      password: sqlConfig.SQLDbToFile.password,
      database: sqlConfig.SQLDbToFile.database,
      query_timeout: sqlConfig.SQLDbToFile.requestTimeout,
    }
    const expectedQuery = 'SELECT created_at AS timestamp, value1 AS temperature FROM oibus_test WHERE created_at > $1'
    const expectedExecuteParams = [new Date(nowDateString)]
    expect(types.setTypeParser).toBeCalledWith(1114, expect.any(Function))
    expect(Client).toBeCalledWith(expectedConfig)
    expect(client.connect).toBeCalledTimes(1)
    expect(client.query).toBeCalledWith(expectedQuery, expectedExecuteParams)
    expect(client.end).toBeCalledTimes(1)
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
    Client.mockReturnValue(client)

    await sqlSouth.onScan(sqlConfig.scanMode)

    expect(sqlSouth.logger.error).toBeCalledWith(new Error('query error'))
  })

  it('should interact with Oracle server if driver is oracle', async () => {
    sqlSouth.driver = 'oracle'

    const connection = {
      callTimeout: 0,
      execute: jest.fn(() => ({
        rows: [{
          value: 75.2,
          timestamp: '2019-10-03T14:36:38.590Z',
        }],
      })),
      close: jest.fn(),
    }
    jest.spyOn(oracledb, 'getConnection').mockImplementation(() => connection)

    await sqlSouth.onScan(sqlConfig.scanMode)

    const expectedConfig = {
      user: sqlConfig.SQLDbToFile.username,
      password: sqlConfig.SQLDbToFile.password,
      connectString: `${sqlConfig.SQLDbToFile.host}:${sqlConfig.SQLDbToFile.port}/${sqlConfig.SQLDbToFile.database}`,
    }
    const expectedQuery = 'SELECT created_at AS timestamp, value1 AS temperature FROM oibus_test WHERE created_at > :date1'
    const expectedExecuteParams = [new Date(nowDateString)]
    expect(oracledb.getConnection).toHaveBeenCalledWith(expectedConfig)
    expect(connection.execute).toBeCalledWith(expectedQuery, expectedExecuteParams)
    expect(connection.close).toBeCalledTimes(1)
  })

  it('should interact with Oracle server and catch request error', async () => {
    sqlSouth.driver = 'oracle'

    const connection = {
      callTimeout: 0,
      execute: jest.fn(() => {
        throw new Error('execute error')
      }),
      close: jest.fn(),
    }
    jest.spyOn(oracledb, 'getConnection').mockImplementation(() => connection)

    await sqlSouth.onScan(sqlConfig.scanMode)

    expect(sqlSouth.logger.error).toBeCalledWith(new Error('execute error'))
  })

  it('should trigger an error and catch it', async () => {
    sqlSouth.driver = 'mssql'

    const query = jest.fn(() => ({ recordsets: [[{ timestamp: new Date('2020-12-25T00:00:00.000Z') }]] }))
    const input = jest.fn(() => ({ query }))
    const request = jest.fn(() => ({ input }))
    const connect = jest.fn(() => ({ request }))
    jest.spyOn(mssql, 'ConnectionPool').mockImplementation(() => ({ connect }))
    jest.spyOn(mssql, 'close').mockImplementation(() => { throw new Error('test') })

    await sqlSouth.onScan(sqlConfig.scanMode)

    expect(sqlSouth.logger.error).toHaveBeenCalledWith(new Error('test'))
  })

  it('should log an error if invalid driver is specified', async () => {
    sqlSouth.driver = 'invalid'

    await sqlSouth.onScan(sqlConfig.scanMode)

    expect(sqlSouth.logger.error).toHaveBeenCalledWith('Driver invalid not supported by SQLDbToFile')
  })

  it('should not send file on emtpy result', async () => {
    sqlSouth.driver = 'mysql'

    sqlSouth.getDataFromMySQL = () => []

    await sqlSouth.onScan(sqlConfig.scanMode)

    expect(engine.addFile).not.toBeCalled()
  })

  it('should send uncompressed file when the result is not empty and compression is false', async () => {
    const RealDate = Date
    global.Date = jest.fn(() => new RealDate(nowDateString))

    sqlSouth.driver = 'mysql'

    const rows = [{
      value: 75.2,
      timestamp: '2019-10-03T14:36:38.590Z',
    }]
    const csvContent = `value,timestamp${'\n'}${rows[0].value},${rows[0].timestamp}`
    sqlSouth.getDataFromMySQL = () => rows
    csv.unparse.mockReturnValue(csvContent)
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => true)

    await sqlSouth.onScan(sqlConfig.scanMode)

    const { engineConfig: { caching: { cacheFolder } } } = sqlSouth.engine.configService.getConfig()
    const tmpFolder = path.resolve(cacheFolder, sqlSouth.dataSource.dataSourceId)
    const expectedPath = path.join(tmpFolder, 'sql-2020_02_02_02_02_02.csv')
    expect(csv.unparse).toBeCalledTimes(1)
    expect(fs.writeFileSync).toBeCalledWith(expectedPath, csvContent)
    expect(engine.addFile).toBeCalledWith('SQLDbToFile', expectedPath, false)
    global.Date = RealDate
  })

  it('should send compressed file when the result is not empty and compression is true', async () => {
    const RealDate = Date
    global.Date = jest.fn(() => new RealDate(nowDateString))

    sqlSouth.driver = 'mysql'

    const rows = [{
      value: 75.2,
      timestamp: '2019-10-03T14:36:38.590Z',
    }]
    const csvContent = `value,timestamp${'\n'}${rows[0].value},${rows[0].timestamp}`
    sqlSouth.getDataFromMySQL = () => rows
    csv.unparse.mockReturnValue(csvContent)
    jest.spyOn(fs, 'writeFileSync')

    const { engineConfig: { caching: { cacheFolder } } } = sqlSouth.engine.configService.getConfig()
    const tmpFolder = path.resolve(cacheFolder, sqlSouth.dataSource.dataSourceId)
    fs.mkdirSync(tmpFolder, { recursive: true })
    const targetCsv = path.join(tmpFolder, 'sql-2020_02_02_02_02_02.csv')
    const targetGzip = path.join(tmpFolder, 'sql-2020_02_02_02_02_02.csv.gz')
    const decompressedCsv = path.join(tmpFolder, 'decompressed.csv')
    sqlSouth.compression = true

    await sqlSouth.onScan(sqlConfig.scanMode)

    expect(csv.unparse).toBeCalledTimes(1)
    expect(fs.writeFileSync).toBeCalledWith(targetCsv, csvContent)
    expect(engine.addFile).toBeCalledWith('SQLDbToFile', targetGzip, false)

    await sqlSouth.decompress(targetGzip, decompressedCsv)
    const targetBuffer = fs.readFileSync(decompressedCsv)
    expect(targetBuffer.toString()).toEqual(csvContent)

    sqlSouth.compression = false
    fs.rmdirSync(tmpFolder, { recursive: true })
    global.Date = RealDate
  })

  it('should manage fs unlink error and catch error', async () => {
    const RealDate = Date
    global.Date = jest.fn(() => new RealDate(nowDateString))

    sqlSouth.driver = 'mysql'

    const rows = [{
      value: 75.2,
      timestamp: '2019-10-03T14:36:38.590Z',
    }]
    const csvContent = `value,timestamp${'\n'}${rows[0].value},${rows[0].timestamp}`
    sqlSouth.getDataFromMySQL = () => rows
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
    const tmpFolder = path.resolve(cacheFolder, sqlSouth.dataSource.dataSourceId)
    fs.mkdirSync(tmpFolder, { recursive: true })
    sqlSouth.compression = true

    await sqlSouth.onScan(sqlConfig.scanMode)

    expect(sqlSouth.logger.error).toHaveBeenCalledWith(new Error('unlink Error'))
    expect(sqlSouth.logger.error).toHaveBeenCalledWith(new Error('add file error'))

    sqlSouth.compression = false
    fs.rmdirSync(tmpFolder, { recursive: true })
    global.Date = RealDate
  })

  it('should format date properly', () => {
    const actual = SQLDbToFile.formatDateWithTimezone(
      new Date('2019-01-01 00:00:00Z'),
      'Europe/Paris',
      'YYYY-MM-DD HH:mm:ss',
    )
    const expected = '2019-01-01 00:00:00'
    expect(actual).toBe(expected)
  })
})
