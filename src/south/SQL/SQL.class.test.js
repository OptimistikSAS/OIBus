const mysql = require('mysql2/promise')
const { Client } = require('pg')
const mssql = require('mssql')

const SQL = require('./SQL.class')
const { integrationTestConfig: testConfig } = require('../../../tests/testConfig')
const EncryptionService = require('../../services/EncryptionService.class')

// Mock logger
jest.mock('../../engine/logger/Logger.class')

// Mock EncryptionService
EncryptionService.getInstance = () => ({ decryptText: (password) => password })

// Mock engine
const engine = jest.mock('../../engine/OIBusEngine.class')
engine.configService = { getConfig: () => ({ engineConfig: testConfig.engine }) }
engine.addFile = jest.fn()
engine.getCacheFolder = () => testConfig.engine.caching.cacheFolder
engine.eventEmitters = {}

describe('MySQL Integration test', () => {
  const southMysqlConfig = testConfig.south.dataSources[0]
  const mysqlConfig = {
    host: southMysqlConfig.SQL.host,
    user: southMysqlConfig.SQL.username,
    password: southMysqlConfig.SQL.password,
    database: southMysqlConfig.SQL.database,
    port: southMysqlConfig.SQL.port,
    connectTimeout: southMysqlConfig.SQL.connectionTimeout,
  }

  beforeAll(async () => {
    const connection = await mysql.createConnection(mysqlConfig)
    await connection.query('CREATE TABLE IF NOT EXISTS history (temperature double, created_at datetime)')

    await connection.query('INSERT INTO history (temperature, created_at) '
        + 'VALUES (18, \'2018-10-03T13:40:40\'), (19, \'2019-10-03T13:40:40\'), (20, \'2020-10-03T13:40:40\'), (21, \'2021-10-03T13:40:40\')')
    await connection.end()

    southMysqlConfig.SQL.query = 'SELECT temperature, created_at as timestamp FROM history WHERE created_at > @StartTime AND created_at < @EndTime'
  })

  afterAll(async () => {
    const connection = await mysql.createConnection(mysqlConfig)
    await connection.query('DROP TABLE history')
    await connection.end()
  })

  it('should retrieve some values in the MySQL database', async () => {
    const sqlSouth = new SQL(southMysqlConfig, engine)

    await sqlSouth.init()
    await sqlSouth.connect()

    expect(sqlSouth.connected).toEqual(true)

    const result = await sqlSouth.getDataFromMySQL(
      '2018-10-03T13:36:36',
      '2021-10-03T13:40:40',
    )

    expect(result).toEqual([
      { temperature: 18, timestamp: new Date('2018-10-03T13:40:40.000Z') },
      { temperature: 19, timestamp: new Date('2019-10-03T13:40:40.000Z') },
      { temperature: 20, timestamp: new Date('2020-10-03T13:40:40.000Z') },
    ])
  })
})

describe('PostgreSQL Integration test', () => {
  const southPostgresqlConfig = testConfig.south.dataSources[1]
  const postgresqlConfig = {
    host: southPostgresqlConfig.SQL.host,
    user: southPostgresqlConfig.SQL.username,
    password: southPostgresqlConfig.SQL.password,
    database: southPostgresqlConfig.SQL.database,
    port: southPostgresqlConfig.SQL.port,
  }

  beforeAll(async () => {
    const connection = new Client(postgresqlConfig)
    await connection.connect()
    await connection.query('CREATE TABLE IF NOT EXISTS history (temperature INT, created_at TIMESTAMP)')
    await connection.query('INSERT INTO history (temperature, created_at) '
        + 'VALUES (18, \'2018-10-03T13:40:40\'), (19, \'2019-10-03T13:40:40\'), (20, \'2020-10-03T13:40:40\'), (21, \'2021-10-03T13:40:40\')')
    await connection.end()

    southPostgresqlConfig.SQL.query = 'SELECT temperature, created_at as timestamp FROM history '
        + 'WHERE created_at > @StartTime AND created_at < @EndTime'
  })

  afterAll(async () => {
    const connection = new Client(postgresqlConfig)
    await connection.connect()
    await connection.query('DROP TABLE history')
    await connection.end()
  })

  it('should retrieve some values in the PostgreSQL database', async () => {
    const sqlSouth = new SQL(southPostgresqlConfig, engine)

    await sqlSouth.init()
    await sqlSouth.connect()

    expect(sqlSouth.connected).toEqual(true)

    const result = await sqlSouth.getDataFromPostgreSQL(
      '2018-10-03T13:36:36',
      '2021-10-03T13:40:40',
    )

    expect(result).toEqual([
      { temperature: 18, timestamp: new Date('2018-10-03T13:40:40.000Z') },
      { temperature: 19, timestamp: new Date('2019-10-03T13:40:40.000Z') },
      { temperature: 20, timestamp: new Date('2020-10-03T13:40:40.000Z') },
    ])
  })
})

describe('MSSQL Integration test', () => {
  const southMssqlConfig = testConfig.south.dataSources[2]
  const mssqlConfig = {
    user: southMssqlConfig.SQL.username,
    password: southMssqlConfig.SQL.password,
    server: southMssqlConfig.SQL.host,
    port: southMssqlConfig.SQL.port,
    connectionTimeout: southMssqlConfig.SQL.connectionTimeout,
    requestTimeout: southMssqlConfig.SQL.requestTimeout,
    options: {
      encrypt: southMssqlConfig.SQL.encryption,
      trustServerCertificate: true,
    },
  }

  beforeAll(async () => {
    await mssql.connect(mssqlConfig)

    await mssql.query(`CREATE DATABASE ${process.env.MSSQL_DATABASE};`)

    await mssql.query(`USE ${process.env.MSSQL_DATABASE}; CREATE TABLE history (temperature INT, created_at DATETIME);`)
    await mssql.query(`USE ${process.env.MSSQL_DATABASE}; INSERT INTO history (temperature, created_at)
        VALUES (18, '2018-10-03T13:40:40'), (19, '2019-10-03T13:40:40'), (20, '2020-10-03T13:40:40'), (21, '2021-10-03T13:40:40');`)
    await mssql.close()

    southMssqlConfig.SQL.query = `USE ${process.env.MSSQL_DATABASE}; SELECT temperature, created_at as timestamp FROM history
        WHERE created_at > @StartTime AND created_at < @EndTime`
  })

  afterAll(async () => {
    await mssql.connect(mssqlConfig)
    await mssql.query(`DROP DATABASE ${process.env.MSSQL_DATABASE};`)
    await mssql.close()
  })

  it('should retrieve some values in the MSSQL database', async () => {
    const sqlSouth = new SQL(southMssqlConfig, engine)

    await sqlSouth.init()
    await sqlSouth.connect()

    expect(sqlSouth.connected).toEqual(true)

    const result = await sqlSouth.getDataFromMSSQL(
      '2018-10-03T13:36:36',
      '2021-10-03T13:40:40',
    )

    expect(result).toEqual([
      { temperature: 18, timestamp: new Date('2018-10-03T13:40:40.000Z') },
      { temperature: 19, timestamp: new Date('2019-10-03T13:40:40.000Z') },
      { temperature: 20, timestamp: new Date('2020-10-03T13:40:40.000Z') },
    ])
  })
})
