const mssql = require('mssql')
const mysql = require('mysql2/promise')
const { Client } = require('pg')
const oracledb = require('oracledb')
const Logger = require('../../src/engine/logger/Logger.class')

const host = '127.0.0.1'
const user = 'oibus'
const password = 'oibus123'
const database = 'oibus'
const table = 'history'
const logger = new Logger()
const possibleDestinations = ['mysql', 'mssql', 'postgresql', 'oracle']

const insertValueIntoMSSQL = async (query) => {
  const config = {
    server: host,
    user: 'sa',
    password: 'Oibus123@',
    database,
    connectionTimeout: 500,
    encrypt: false,
  }

  await mssql.connect(config)
  // eslint-disable-next-line max-len
  await mssql.query("IF OBJECT_ID(N'dbo.history', N'U') IS NULL BEGIN   CREATE TABLE dbo.history (temperature float); END;")
  await mssql.query(query)
  await mssql.close()
}

const insertValueIntoMySQL = async (query) => {
  const config = {
    host,
    user,
    password,
    database,
    port: 5306,
    connectTimeout: 500,
  }

  const connection = await mysql.createConnection(config)
  await connection.query('CREATE TABLE IF NOT EXISTS history (temperature double)')
  await connection.query(query)
  await connection.close()
}

const insertValueIntoPostgreSQL = async (query) => {
  const config = {
    host,
    user,
    password,
    database,
    connectionTimeoutMillis: 1000,
    query_timeout: 1000,
  }

  const client = new Client(config)
  await client.connect()
  await client.query('CREATE TABLE IF NOT EXISTS history (temperature double precision)')
  await client.query(query)
  await client.end()
}

const insertValueIntoOracle = async (query) => {
  const config = {
    user,
    password,
    connectString: 'localhost:1433',
    poolTimeout: 500,
    privilege: oracledb.SYSDBA,
  }

  oracledb.autoCommit = true
  const connection = await oracledb.getConnection(config)
  connection.callTimeout = 500
  await connection.execute('CREATE TABLE IF NOT EXISTS history (temperature number)')
  await connection.execute(query)
  await connection.close()
}

const insertValue = async (destination) => {
  const value = (100 * Math.random()).toFixed(2)
  const query = `INSERT INTO ${table} (temperature) VALUES (${value})`
  try {
    switch (destination) {
      case 'mysql': {
        await insertValueIntoMySQL(query)
        break
      }
      case 'mssql': {
        await insertValueIntoMSSQL(query)
        break
      }
      case 'postgresql': {
        await insertValueIntoPostgreSQL(query)
        break
      }
      case 'oracle': {
        await insertValueIntoOracle(query)
        break
      }
      default: {
        console.error('Wrong destination name given! (Please choose among the following dbs: mysql, mssql, postgresql or oracle)')
        break
      }
    }
    logger.info(`Inserted temperature value: ${value}`)
  } catch (error) {
    console.error(error)
  }
}

const argumentParser = () => {
  const args = process.argv.slice(2)
  if (!args.length) {
    logger.error('No parameter given!')
    process.exit(1)
  }
  return Object.assign(...args.map((arg) => ({ [arg.split('=')[0]]: arg.split('=')[1] })))
}

const bulkInsert = (destination, rowNumber) => {
  Array.from({ length: rowNumber }, () => (destination === 'all' ? possibleDestinations.map((dest) => insertValue(dest))
    : insertValue(destination)))
}

const liveInsert = (destination, milliseconds) => {
  setInterval(() => (
    destination === 'all' ? possibleDestinations.map((dest) => insertValue(dest))
      : insertValue(destination)
  ), milliseconds)
}

const seedDestination = () => {
  const paramValues = argumentParser()

  if (paramValues['bulk-insert']) {
    bulkInsert(paramValues.destination || 'all', paramValues['bulk-insert'])
  } else if (paramValues['live-insert']) {
    liveInsert(paramValues.destination || 'all', paramValues['live-insert'])
  } else {
    logger.info('No parameter given, running in default mode. Live insert starting...')
    liveInsert(paramValues.destination || 'all', 1000)
  }
}

seedDestination()
