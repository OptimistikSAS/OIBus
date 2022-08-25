const fs = require('node:fs/promises')
const path = require('node:path')

const db = require('better-sqlite3')
const mssql = require('mssql')
const mysql = require('mysql2/promise')
const { Client, types } = require('pg')
const { DateTime } = require('luxon')
const humanizeDuration = require('humanize-duration')

const SouthConnector = require('../SouthConnector.class')
const { generateCSV, getMostRecentDate, generateReplacementParameters } = require('./utils')
const { replaceFilenameWithVariable, compress } = require('../../services/utils')

let oracledb
/**
 * Class SQL - Retrieve data from SQL databases and send them to the cache as CSV files.
 * Available drivers are :
 * - MSSQL
 * - MySQL / MariaDB
 * - Oracle
 * - PostgreSQL
 * - SQLite
 */
class SQL extends SouthConnector {
  static category = 'DatabaseOut'

  /**
   * Constructor for SQL
   * @constructor
   * @param {Object} settings - The South connector settings
   * @param {BaseEngine} engine - The Engine
   * @return {void}
   */
  constructor(settings, engine) {
    super(settings, engine, {
      supportListen: false,
      supportLastPoint: false,
      supportFile: false,
      supportHistory: true,
    })
    this.canHandleHistory = true
    this.handlesFiles = true

    const {
      driver,
      databasePath,
      host,
      port,
      username,
      password,
      domain,
      database,
      encryption,
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
    } = this.settings.SQL

    this.driver = driver
    this.databasePath = databasePath ? path.resolve(databasePath) : null
    this.host = host
    this.port = port
    this.username = username
    this.password = password
    this.domain = domain
    this.database = database
    this.encryption = encryption
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
    this.tmpFolder = path.resolve(this.engine.getCacheFolder(), this.settings.id)
  }

  /**
   * Initialize services (logger, certificate, status data)
   * @returns {Promise<void>} - The result promise
   */
  async init() {
    await super.init()
    try {
      // eslint-disable-next-line global-require,import/no-unresolved,import/no-extraneous-dependencies
      oracledb = require('oracledb')
    } catch {
      this.logger.warn('Could not load node oracledb')
    }

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
      throw new Error(`Invalid timezone. Check the South "${this.settings.id}" settings.`)
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
      default:
        throw new Error(`SQL driver "${this.driver}" not supported for South "${this.settings.name}".`)
    }
    const requestFinishTime = new Date().getTime()
    this.logger.info(`Found ${result.length} results in ${humanizeDuration(requestFinishTime - requestStartTime)}.`)

    if (result.length > 0) {
      const csvContent = generateCSV(result, this.timezone, this.dateFormat, this.delimiter)

      const filename = replaceFilenameWithVariable(this.filename, this.queryParts[scanMode], this.settings.name)
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
      this.logger.debug(`No result found between ${startTime.toISOString()} and ${endTime.toISOString()}.`)
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
      password: this.password ? this.encryptionService.decryptText(this.password) : '',
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
        request.input('StartTime', mssql.DateTimeOffset, startTime)
      }
      if (this.query.indexOf('@EndTime') !== -1) {
        request.input('EndTime', mssql.DateTimeOffset, endTime)
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
      password: this.encryptionService.decryptText(this.password),
      database: this.database,
      connectTimeout: this.connectionTimeout,
      timezone: 'Z',
    }

    let connection = null
    let data = []
    try {
      connection = await mysql.createConnection(config)

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
      password: this.encryptionService.decryptText(this.password),
      database: this.database,
      query_timeout: this.requestTimeout,
    }

    types.setTypeParser(1114, (str) => new Date(`${str}Z`))
    const connection = new Client(config)
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
      password: this.encryptionService.decryptText(this.password),
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

module.exports = SQL
