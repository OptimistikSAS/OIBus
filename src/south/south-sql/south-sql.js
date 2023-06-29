const fs = require("fs").promises;
import path from 'path'

import db from 'better-sqlite3'
import mssql from 'mssql'
import { createConnection } from 'mysql2/promise'
import * as pg from 'pg'
import { DateTime } from 'luxon'
import humanizeDuration from 'humanize-duration'

import SouthConnector from '../south-connector.js'
import manifest from './manifest.js'
import { generateCSV, getMostRecentDate, generateReplacementParameters } from './utils.js'
import { replaceFilenameWithVariable, compress } from '../../service/utils.js'

let oracledb = null
// eslint-disable-next-line import/no-unresolved
import('oracledb')
  .then((obj) => {
    oracledb = obj.default
    console.info('oracledb loaded')
  })
  .catch(() => {
    console.error('Could not load oracledb')
  })

let odbc = null
import('odbc')
  .then((obj) => {
    odbc = obj
    console.info('odbc loaded')
  })
  .catch(() => {
    console.error('Could not load odbc')
  })

/**
 * Class SouthSQL - Retrieve data from SQL databases and send them to the cache as CSV files.
 * Available drivers are :
 * - MSSQL
 * - MySQL / MariaDB
 * - Oracle
 * - PostgreSQL
 * - SQLite
 */
export default class SouthSQL extends SouthConnector {
  static category = manifest.category

  /**
   * Constructor for SouthSQL
   * @constructor
   * @param {Object} configuration - The South connector configuration
   * @param {ProxyService} proxyService - The proxy service
   * @param {Function} engineAddValuesCallback - The Engine add values callback
   * @param {Function} engineAddFilesCallback - The Engine add file callback
   * @param {Object} logger - The Pino child logger to use
   * @return {void}
   */
  constructor(
    configuration,
    proxyService,
    engineAddValuesCallback,
    engineAddFilesCallback,
    logger,
  ) {
    super(
      configuration,
      proxyService,
      engineAddValuesCallback,
      engineAddFilesCallback,
      logger,
      manifest,
    )

    const {
      driver,
      odbcDriverPath,
      databasePath,
      host,
      port,
      username,
      password,
      domain,
      database,
      encryption,
      selfSigned,
      query,
      connectionTimeout,
      requestTimeout,
      filename,
      delimiter,
      timeColumn,
      timezone,
      dateFormat,
      compression,
      maxReadInterval,
      readIntervalDelay,
    } = configuration.settings

    this.driver = driver
    this.odbcDriverPath = odbcDriverPath
    this.databasePath = databasePath ? path.resolve(databasePath) : null
    this.host = host
    this.port = port
    this.username = username
    this.password = password
    this.domain = domain
    this.database = database
    this.encryption = encryption
    this.selfSigned = selfSigned
    this.query = query
    this.connectionTimeout = connectionTimeout
    this.timeColumn = timeColumn
    this.requestTimeout = requestTimeout
    this.filename = filename
    this.delimiter = delimiter
    this.dateFormat = dateFormat
    this.compression = compression
    this.maxReadInterval = maxReadInterval
    this.readIntervalDelay = readIntervalDelay
    this.timezone = timezone
  }

  /**
   * Initialize services (logger, certificate, status data) at startup
   * @param {String} baseFolder - The base cache folder
   * @param {String} oibusName - The OIBus name
   * @returns {Promise<void>} - The result promise
   */
  async start(baseFolder, oibusName) {
    await super.start(baseFolder, oibusName)

    this.tmpFolder = path.resolve(this.baseFolder, 'tmp')
    // Create tmp folder to write files locally before sending them to the cache
    try {
      await fs.mkdir(this.tmpFolder, { recursive: true })
    } catch (mkdirError) {
      this.logger.error(mkdirError)
    }

    if (!this.timezone || !DateTime.local().setZone(this.timezone).isValid) {
      this.logger.error(`Invalid timezone supplied: "${this.timezone}".`)
      this.timezone = null
    }
  }

  /**
   * Get entries from the database between startTime and endTime (if used in the SQL query)
   * and write them into a CSV file and send it to the engine.
   * @param {String} scanMode - The scan mode
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @returns {Promise<void>} - The result promise
   */
  async historyQuery(scanMode, startTime, endTime) {
    if (!this.timezone) {
      throw new Error(`Invalid timezone. Check the South "${this.id}" configuration.`)
    }

    let updatedStartTime = startTime
    this.logQuery(this.query, updatedStartTime, endTime)

    let result
    const requestStartTime = new Date().getTime()
    switch (this.driver) {
      case 'mssql':
        result = await this.getDataFromMSSQL(updatedStartTime, endTime)
        break
      case 'mysql':
        result = await this.getDataFromMySQL(updatedStartTime, endTime)
        break
      case 'postgresql':
        result = await this.getDataFromPostgreSQL(updatedStartTime, endTime)
        break
      case 'oracle':
        result = await this.getDataFromOracle(updatedStartTime, endTime)
        break
      case 'sqlite':
        result = await this.getDataFromSqlite(updatedStartTime, endTime)
        break
      case 'odbc':
        result = await this.getDataFromOdbc(updatedStartTime, endTime)
        break
      case 'ip21':
        result = await this.getDataFromIp21(updatedStartTime, endTime)
        break
      default:
        throw new Error(`SQL driver "${this.driver}" not supported for South "${this.name}".`)
    }
    const requestFinishTime = new Date().getTime()
    this.logger.info(`Found ${result.length} results in ${humanizeDuration(requestFinishTime - requestStartTime)}.`)

    if (result.length > 0) {
      const csvContent = generateCSV(result, this.timezone, this.dateFormat, this.delimiter)

      const filename = replaceFilenameWithVariable(this.filename, this.queryParts[scanMode], this.name)
      const filePath = path.join(this.tmpFolder, filename)

      this.logger.debug(`Writing CSV file at "${filePath}".`)
      await fs.writeFile(filePath, csvContent)

      if (this.compression) {
        // Compress and send the compressed file
        const gzipPath = `${filePath}.gz`
        await compress(filePath, gzipPath)

        try {
          await fs.unlink(filePath)
          this.logger.info(`File "${filePath}" compressed and deleted.`)
        } catch (unlinkError) {
          this.logger.error(unlinkError)
        }

        this.logger.debug(`Sending compressed file "${gzipPath}" to Engine.`)
        await this.addFile(gzipPath, false)
      } else {
        this.logger.debug(`Sending file "${filePath}" to Engine.`)
        await this.addFile(filePath, false)
      }

      const oldLastCompletedAt = this.lastCompletedAt[scanMode]
      updatedStartTime = getMostRecentDate(result, updatedStartTime, this.timeColumn, this.timezone)
      this.lastCompletedAt[scanMode] = updatedStartTime
      if (this.lastCompletedAt[scanMode].getTime() !== oldLastCompletedAt.getTime()) {
        this.logger.debug(`Updating lastCompletedAt to ${this.lastCompletedAt[scanMode].toISOString()}.`)
        this.setConfig(`lastCompletedAt-${scanMode}`, this.lastCompletedAt[scanMode].toISOString())
      } else {
        this.logger.debug(`No update for lastCompletedAt. Last value: ${this.lastCompletedAt[scanMode].toISOString()}.`)
      }
    } else {
      this.logger.debug('No result found.')
    }
  }

  /**
   * Apply the SQL query to the target MSSQL database.
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @returns {Promise<Object[]>} - The new entries
   */
  async getDataFromMSSQL(startTime, endTime) {
    const adaptedQuery = this.query

    const config = {
      user: this.username,
      password: this.password ? await this.encryptionService.decryptText(this.password) : '',
      server: this.host,
      port: this.port,
      database: this.database,
      connectionTimeout: this.connectionTimeout,
      requestTimeout: this.requestTimeout,
      options: {
        encrypt: this.encryption,
        trustServerCertificate: true,
      },
    }
    // domain is optional and allow to activate the ntlm authentication on Windows
    if (this.domain) config.domain = this.domain

    let data = []
    try {
      const pool = await new mssql.ConnectionPool(config).connect()
      const request = pool.request()
      if (this.query.indexOf('@StartTime') !== -1) {
        request.input('StartTime', DateTime.fromJSDate(startTime, { zone: this.timezone }).toFormat('yyyy-MM-dd HH:mm:ss.SSS'))
      }
      if (this.query.indexOf('@EndTime') !== -1) {
        request.input('EndTime', DateTime.fromJSDate(endTime, { zone: this.timezone }).toFormat('yyyy-MM-dd HH:mm:ss.SSS'))
      }
      const result = await request.query(adaptedQuery)
      const [first] = result.recordsets
      data = first
      await pool.close()
    } catch (error) {
      await mssql.close()
      throw error
    }
    await mssql.close()
    return data
  }

  /**
   * Apply the SQL query to the target MySQL / MariaDB database.
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @returns {Promise<Object[]>} - The SQL results
   */
  async getDataFromMySQL(startTime, endTime) {
    const adaptedQuery = this.query.replace(/@StartTime/g, '?').replace(/@EndTime/g, '?')

    const config = {
      host: this.host,
      port: this.port,
      user: this.username,
      password: await this.encryptionService.decryptText(this.password),
      database: this.database,
      connectTimeout: this.connectionTimeout,
      timezone: 'Z',
    }

    let connection = null
    let data = []
    try {
      connection = await createConnection(config)

      const params = generateReplacementParameters(this.query, startTime, endTime)
      const [rows] = await connection.execute(
        {
          sql: adaptedQuery,
          timeout: this.requestTimeout,
        },
        params,
      )
      data = rows
    } catch (error) {
      if (connection) {
        await connection.end()
      }
      throw error
    }
    if (connection) {
      await connection.end()
    }

    return data
  }

  /**
   * Apply the SQL query to the target PostgreSQL database.
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @returns {Promise<Object[]>} - The SQL results
   */
  async getDataFromPostgreSQL(startTime, endTime) {
    const adaptedQuery = this.query.replace(/@StartTime/g, '$1').replace(/@EndTime/g, '$2')

    const config = {
      host: this.host,
      port: this.port,
      user: this.username,
      password: await this.encryptionService.decryptText(this.password),
      database: this.database,
      query_timeout: this.requestTimeout,
    }

    pg.types.setTypeParser(1114, (str) => new Date(`${str}Z`))
    const connection = new pg.Client(config)
    let data = []
    try {
      await connection.connect()
      const params = generateReplacementParameters(this.query, startTime, endTime)
      const { rows } = await connection.query(adaptedQuery, params)
      data = rows
    } catch (error) {
      await connection.end()
      throw error
    }
    if (connection) {
      await connection.end()
    }

    return data
  }

  /**
   * Apply the SQL query to the target Oracle database.
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @returns {Promise<Object[]>} - The SQL results
   */
  async getDataFromOracle(startTime, endTime) {
    if (!oracledb) {
      throw new Error('oracledb library not loaded.')
    }

    const adaptedQuery = this.query.replace(/@StartTime/g, ':date1').replace(/@EndTime/g, ':date2')

    const config = {
      user: this.username,
      password: await this.encryptionService.decryptText(this.password),
      connectString: `${this.host}:${this.port}/${this.database}`,
    }

    let connection = null
    let data = []
    try {
      process.env.ORA_SDTZ = 'UTC'
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT
      connection = await oracledb.getConnection(config)
      connection.callTimeout = this.requestTimeout
      const params = generateReplacementParameters(this.query, startTime, endTime)
      const { rows } = await connection.execute(adaptedQuery, params)
      data = rows
    } catch (error) {
      if (connection) {
        await connection.close()
      }
      throw error
    }
    if (connection) {
      await connection.close()
    }

    return data
  }

  /**
   * Apply the SQL query to the target SQLite database.
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @returns {Promise<Object[]>} - The SQL results
   */
  async getDataFromSqlite(startTime, endTime) {
    const adaptedQuery = this.query

    let database = null
    let data = []
    try {
      database = db(this.databasePath)
      const stmt = database.prepare(adaptedQuery)
      const preparedParameters = {}
      if (this.query.indexOf('@StartTime') !== -1) {
        preparedParameters.StartTime = startTime.getTime()
      }
      if (this.query.indexOf('@EndTime') !== -1) {
        preparedParameters.EndTime = endTime.getTime()
      }

      data = stmt.all(preparedParameters)
    } catch (error) {
      if (database) {
        database.close()
      }
      throw error
    }
    if (database) {
      database.close()
    }
    return data
  }

  /**
   * Apply the SQL query to the target ODBC database.
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @returns {Promise<Object[]>} - The SQL results
   */
  async getDataFromOdbc(startTime, endTime) {
    if (!odbc) {
      throw new Error('odbc library not loaded.')
    }

    const adaptedQuery = this.query
      .replace(/@StartTime/g, DateTime.fromJSDate(startTime, { zone: this.timezone }).toFormat(this.dateFormat, { locale: 'en-US' }).toUpperCase())
      .replace(/@EndTime/g, DateTime.fromJSDate(endTime, { zone: this.timezone }).toFormat(this.dateFormat, { locale: 'en-US' }).toUpperCase())

    let connectionString = `Driver=${this.odbcDriverPath};SERVER=${this.host},${this.port};TrustServerCertificate=${this.selfSigned ? 'yes' : 'no'};`
    connectionString += `Database=${this.database};UID=${this.username}`
    this.logger.debug(`Connecting with ODBC: ${`${connectionString};PWD=<secret>`}`)
    let connection = null
    let data = []
    try {
      const connectionConfig = {
        connectionString: `${connectionString};PWD=${await this.encryptionService.decryptText(this.password)}`,
        connectionTimeout: this.connectionTimeout,
        loginTimeout: this.connectionTimeout,
      }
      this.logger.debug(`Executing query ${adaptedQuery}`)
      connection = await odbc.connect(connectionConfig)

      data = await connection.query(adaptedQuery)
    } catch (error) {
      if (error.odbcErrors?.length > 0) {
        error.odbcErrors.forEach((odbcError) => {
          this.logger.error(odbcError.message)
        })
      }
      if (connection) {
        await connection.close()
      }
      throw error
    }
    if (connection) {
      await connection.close()
    }
    return data
  }

  /**
   * Apply the SQL query to the target IP21 database with AspenTech SQLplus driver.
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @returns {Promise<Object[]>} - The SQL results
   */
  async getDataFromIp21(startTime, endTime) {
    if (!odbc) {
      throw new Error('odbc library not loaded.')
    }

    const adaptedQuery = this.query
      .replace(/@StartTime/g, DateTime.fromJSDate(startTime, { zone: this.timezone }).toFormat(this.dateFormat, { locale: 'en-US' }).toUpperCase())
      .replace(/@EndTime/g, DateTime.fromJSDate(endTime, { zone: this.timezone }).toFormat(this.dateFormat, { locale: 'en-US' }).toUpperCase())

    const connectionString = `Driver=AspenTech SQLplus;HOST=${this.host};PORT=${this.port}`
    this.logger.debug(`Connecting with ODBC: ${connectionString}`)
    let connection = null
    let data = []
    try {
      const connectionConfig = {
        connectionString: `${connectionString}`,
        connectionTimeout: this.connectionTimeout,
        loginTimeout: this.connectionTimeout,
      }
      connection = await odbc.connect(connectionConfig)

      this.logger.debug(`Executing query ${adaptedQuery}`)
      data = await connection.query(adaptedQuery)
      this.logger.debug(`Found ${data?.length} data IP21`)
    } catch (error) {
      if (error.odbcErrors?.length > 0) {
        error.odbcErrors.forEach((odbcError) => {
          this.logger.error(odbcError.message)
        })
      }
      if (connection) {
        await connection.close()
      }
      throw error
    }
    if (connection) {
      await connection.close()
    }
    return data
  }

  /**
   * Log the executed query with replacements values for query variables
   * @param {String} query - The query
   * @param {Date} startTime - The replaced StartTime
   * @param {Date} endTime - The replaced EndTime
   * @returns {void}
   */
  logQuery(query, startTime, endTime) {
    const startTimeLog = query.indexOf('@StartTime') !== -1 ? `StartTime = ${startTime.toISOString()}` : ''
    const endTimeLog = query.indexOf('@EndTime') !== -1 ? `EndTime = ${endTime.toISOString()}` : ''
    this.logger.info(`Executing "${query}" with ${startTimeLog} ${endTimeLog}`)
    this.statusService.updateStatusDataStream({ 'Last SQL request': `"${query}" with ${startTimeLog} ${endTimeLog}` })
  }
}
