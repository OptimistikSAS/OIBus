const mysql = require('mysql2/promise')
const { Client } = require('pg')
const mssql = require('mssql')

const SQL = require('./south-sql')
const { integrationTestConfig: testConfig } = require('../../../tests/test-config')

// Mock fs
jest.mock('node:fs/promises')

// Mock services
jest.mock('../../service/database.service')
jest.mock('../../service/status.service')
jest.mock('../../service/encryption.service', () => ({ getInstance: () => ({ decryptText: (password) => password }) }))

// Mock OIBusEngine
const engine = {
  configService: { getConfig: () => ({ engineConfig: testConfig.engine }) },
  cacheFolder: './cache',
  addValues: jest.fn(),
  addFile: jest.fn(),
}
// Mock logger
const logger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  trace: jest.fn(),
}

describe('MySQL Integration test', () => {
  const configuration = testConfig.south[0]
  const mysqlConfig = {
    host: configuration.settings.host,
    user: configuration.settings.username,
    password: configuration.settings.password,
    database: configuration.settings.database,
    port: configuration.settings.port,
    connectTimeout: configuration.settings.connectionTimeout,
  }

  beforeAll(async () => {
    const connection = await mysql.createConnection(mysqlConfig)
    await connection.query('CREATE TABLE IF NOT EXISTS history (temperature double, created_at datetime)')

    await connection.query('INSERT INTO history (temperature, created_at) '
        + 'VALUES (18, \'2018-10-03T13:40:40\'), (19, \'2019-10-03T13:40:40\'), (20, \'2020-10-03T13:40:40\'), (21, \'2021-10-03T13:40:40\')')
    await connection.end()

    configuration.settings.query = 'SELECT temperature, created_at as timestamp FROM history '
        + 'WHERE created_at > @StartTime AND created_at < @EndTime'
  })

  afterAll(async () => {
    const connection = await mysql.createConnection(mysqlConfig)
    await connection.query('DROP TABLE history')
    await connection.end()
  })

  it('should retrieve some values in the MySQL database', async () => {
    const south = new SQL(configuration, engine, logger)

    await south.start('baseFolder', 'oibusName')
    await south.connect()

    expect(south.connected).toEqual(true)

    const result = await south.getDataFromMySQL(
      new Date('2018-10-03T13:36:36'),
      new Date('2021-10-03T13:40:40'),
    )

    expect(result).toEqual([
      { temperature: 18, timestamp: new Date('2018-10-03T13:40:40.000Z') },
      { temperature: 19, timestamp: new Date('2019-10-03T13:40:40.000Z') },
      { temperature: 20, timestamp: new Date('2020-10-03T13:40:40.000Z') },
    ])
  })
})

describe('PostgreSQL Integration test', () => {
  const configuration = testConfig.south[1]
  const postgresqlConfig = {
    host: configuration.settings.host,
    user: configuration.settings.username,
    password: configuration.settings.password,
    database: configuration.settings.database,
    port: configuration.settings.port,
  }

  beforeAll(async () => {
    const connection = new Client(postgresqlConfig)
    await connection.connect()
    await connection.query('CREATE TABLE IF NOT EXISTS history (temperature INT, created_at TIMESTAMP)')
    await connection.query('INSERT INTO history (temperature, created_at) '
        + 'VALUES (18, \'2018-10-03T13:40:40\'), (19, \'2019-10-03T13:40:40\'), (20, \'2020-10-03T13:40:40\'), (21, \'2021-10-03T13:40:40\')')
    await connection.end()

    configuration.settings.query = 'SELECT temperature, created_at as timestamp FROM history '
        + 'WHERE created_at > @StartTime AND created_at < @EndTime'
  })

  afterAll(async () => {
    const connection = new Client(postgresqlConfig)
    await connection.connect()
    await connection.query('DROP TABLE history')
    await connection.end()
  })

  it('should retrieve some values in the PostgreSQL database', async () => {
    const south = new SQL(configuration, engine, logger)

    await south.start('baseFolder', 'oibusName')
    await south.connect()

    expect(south.connected).toEqual(true)

    const result = await south.getDataFromPostgreSQL(
      new Date('2018-10-03T13:36:36'),
      new Date('2021-10-03T13:40:40'),
    )

    expect(result).toEqual([
      { temperature: 18, timestamp: new Date('2018-10-03T13:40:40.000Z') },
      { temperature: 19, timestamp: new Date('2019-10-03T13:40:40.000Z') },
      { temperature: 20, timestamp: new Date('2020-10-03T13:40:40.000Z') },
    ])
  })
})

describe('MSSQL Integration test', () => {
  const configuration = testConfig.south[2]
  const mssqlConfig = {
    user: configuration.settings.username,
    password: configuration.settings.password,
    server: configuration.settings.host,
    port: configuration.settings.port,
    connectionTimeout: configuration.settings.connectionTimeout,
    requestTimeout: configuration.settings.requestTimeout,
    options: {
      encrypt: configuration.settings.encryption,
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

    configuration.settings.query = `USE ${process.env.MSSQL_DATABASE}; SELECT temperature, created_at as timestamp FROM history
        WHERE created_at > @StartTime AND created_at < @EndTime`
  })

  afterAll(async () => {
    await mssql.connect(mssqlConfig)
    await mssql.query(`DROP DATABASE ${process.env.MSSQL_DATABASE};`)
    await mssql.close()
  })

  it('should retrieve some values in the MSSQL database', async () => {
    const south = new SQL(configuration, engine, logger)

    await south.start('baseFolder', 'oibusName')
    await south.connect()

    expect(south.connected).toEqual(true)

    const result = await south.getDataFromMSSQL(
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
