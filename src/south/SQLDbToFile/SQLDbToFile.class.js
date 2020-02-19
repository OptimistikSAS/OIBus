const fs = require('fs')
const path = require('path')

const mssql = require('mssql')
const mysql = require('mysql2/promise')
const { Client, types } = require('pg')
const oracledb = require('oracledb')
const csv = require('fast-csv')
const moment = require('moment-timezone')

const ProtocolHandler = require('../ProtocolHandler.class')
const databaseService = require('../../services/database.service')

/**
 * Class SQLDbToFile
 */
class SQLDbToFile extends ProtocolHandler {
  /**
   * Constructor for SQLDbToFile
   * @constructor
   * @param {Object} dataSource - The data source
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    super(dataSource, engine)

    const {
      driver,
      host,
      port,
      username,
      password,
      domain,
      database,
      query,
      connectionTimeout,
      requestTimeout,
      filename,
      delimiter,
      timeColumn,
      timezone,
      dateFormat,
    } = this.dataSource.SQLDbToFile

    this.preserveFiles = false
    this.driver = driver
    this.host = host
    this.port = port
    this.username = username
    this.password = password
    this.domain = domain
    this.database = database
    this.query = query
    this.connectionTimeout = connectionTimeout
    this.timeColumn = timeColumn
    this.requestTimeout = requestTimeout
    this.filename = filename
    this.delimiter = delimiter
    this.dateFormat = dateFormat

    if (moment.tz.zone(timezone)) {
      this.timezone = timezone
    } else {
      this.logger.error(`Invalid timezone supplied: ${timezone}`)
    }

    const { engineConfig: { caching: { cacheFolder } } } = this.engine.configService.getConfig()
    this.tmpFolder = path.resolve(cacheFolder, this.dataSource.dataSourceId)

    // Create tmp folder if not exists
    if (!fs.existsSync(this.tmpFolder)) {
      fs.mkdirSync(this.tmpFolder, { recursive: true })
    }
  }

  async connect() {
    super.connect()
    const { dataSourceId, startTime } = this.dataSource
    const { engineConfig } = this.engine.configService.getConfig()
    const databasePath = `${engineConfig.caching.cacheFolder}/${dataSourceId}.db`
    this.configDatabase = await databaseService.createConfigDatabase(databasePath)

    this.lastCompletedAt = await databaseService.getConfig(this.configDatabase, 'lastCompletedAt')
    if (!this.lastCompletedAt) {
      this.lastCompletedAt = startTime ? new Date(startTime).toISOString() : new Date().toISOString()
    }
  }

  /**
   * Get entries from the database since the last query completion, write them into a CSV file and send to the Engine.
   * @param {*} _scanMode - The scan mode
   * @return {void}
   */
  async onScan(_scanMode) {
    if (!this.timezone) {
      this.logger.error('Invalid timezone')
      return
    }

    let result = []
    try {
      switch (this.driver) {
        case 'mssql':
          result = await this.getDataFromMSSQL()
          break
        case 'mysql':
          result = await this.getDataFromMySQL()
          break
        case 'postgresql':
          result = await this.getDataFromPostgreSQL()
          break
        case 'oracle':
          result = await this.getDataFromOracle()
          break
        default:
          this.logger.error(`Driver ${this.driver} not supported by ${this.dataSource.dataSourceId}`)
          result = []
      }
    } catch (error) {
      this.logger.error(error)
    }

    this.logger.debug(`Found ${result.length} results`)

    if (result.length > 0) {
      result.forEach((entry) => {
        if (entry[this.timeColumn] && (entry[this.timeColumn] instanceof Date) && (entry[this.timeColumn] > new Date(this.lastCompletedAt))) {
          this.lastCompletedAt = entry[this.timeColumn].toISOString()
        }
      })
      if (this.lastCompletedAt) {
        this.logger.debug(`Updating lastCompletedAt to ${this.lastCompletedAt}`)
      } else {
        this.logger.debug('lastCompletedAt not used')
      }
      await databaseService.upsertConfig(this.configDatabase, 'lastCompletedAt', this.lastCompletedAt)
      const csvContent = await this.generateCSV(result)
      if (csvContent) {
        const filename = this.filename.replace('@date', moment().format('YYYY_MM_DD_HH_mm_ss'))
        const filePath = path.join(this.tmpFolder, filename)
        try {
          this.logger.debug(`Writing CSV file at ${filePath}`)
          fs.writeFileSync(filePath, csvContent)
          this.logger.debug(`Sending ${filePath} to Engine.`)
          this.addFile(filePath)
        } catch (error) {
          this.logger.error(error)
        }
      }
    }
  }

  /**
   * Get new entries from MSSQL database.
   * @returns {void}
   */
  async getDataFromMSSQL() {
    const adaptedQuery = this.query
    this.logger.debug(`Executing "${adaptedQuery}"`)

    const config = {
      user: this.username,
      password: this.decryptPassword(this.password),
      server: this.host,
      port: this.port,
      database: this.database,
      connectionTimeout: this.connectionTimeout,
      requestTimeout: this.requestTimeout,
    }
    // domain is optional and allow to activate the ntlm authentication on windows.
    if (this.domain) config.domain = this.domain

    let data = []
    try {
      const pool = await new mssql.ConnectionPool(config).connect()
      const result = await pool.request()
        .input('date1', mssql.DateTimeOffset, new Date(this.lastCompletedAt))
        .query(adaptedQuery)
      const [first] = result.recordsets
      data = first
    } catch (error) {
      this.logger.error(error)
    } finally {
      await mssql.close()
    }

    return data
  }

  /**
   * Get new entries from MySQL database.
   * @returns {void}
   */
  async getDataFromMySQL() {
    const adaptedQuery = this.query.replace('@date1', '?')
    this.logger.debug(`Executing "${adaptedQuery}"`)

    const config = {
      host: this.host,
      port: this.port,
      user: this.username,
      password: this.decryptPassword(this.password),
      database: this.database,
      connectTimeout: this.connectionTimeout,
      timezone: 'Z',
    }

    let connection = null
    let data = []
    try {
      connection = await mysql.createConnection(config)
      const [rows] = await connection.execute(
        { sql: adaptedQuery, timeout: this.requestTimeout },
        [new Date(this.lastCompletedAt)],
      )
      data = rows
    } catch (error) {
      this.logger.error(error)
    } finally {
      if (connection) {
        await connection.end()
      }
    }

    return data
  }

  /**
   * Get new entries from PostgreSQL database.
   * @returns {void}
   */
  async getDataFromPostgreSQL() {
    const adaptedQuery = this.query.replace('@date1', '$1')
    this.logger.debug(`Executing "${adaptedQuery}"`)

    const config = {
      host: this.host,
      port: this.port,
      user: this.username,
      password: this.decryptPassword(this.password),
      database: this.database,
      query_timeout: this.requestTimeout,
    }

    types.setTypeParser(1114, (str) => new Date(`${str}Z`))
    const client = new Client(config)
    let data = []
    try {
      await client.connect()
      const { rows } = await client.query(adaptedQuery, [new Date(this.lastCompletedAt)])
      data = rows
    } catch (error) {
      this.logger.error(error)
    } finally {
      if (client) {
        await client.end()
      }
    }

    return data
  }

  /**
   * Get new entries from Oracle database.
   * @returns {void}
   */
  async getDataFromOracle() {
    const adaptedQuery = this.query.replace('@date1', ':date1')
    this.logger.debug(`Executing "${adaptedQuery}"`)

    const config = {
      user: this.username,
      password: this.decryptPassword(this.password),
      connectString: `${this.host}:${this.port}/${this.database}`,
    }

    let connection
    let data = []
    try {
      process.env.ORA_SDTZ = 'UTC'
      oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT
      connection = await oracledb.getConnection(config)
      connection.callTimeout = this.requestTimeout
      const { rows } = await connection.execute(adaptedQuery, [new Date(this.lastCompletedAt)])
      data = rows
    } catch (error) {
      this.logger.error(error)
    } finally {
      if (connection) {
        try {
          await connection.close()
        } catch (error) {
          this.logger.error(error)
        }
      }
    }

    return data
  }

  /**
   * Format date taking into account the timezone configuration.
   * Since we don't know how the date is actually stored in the database, we read it as UTC time
   * and format it as it would be in the configured timezone.
   * Ex: With timezone "Europe/Paris" the date "2019-01-01 00:00:00" will be converted to "Tue Jan 01 2019 00:00:00 GMT+0100"
   * @param {Date} date - The date to format
   * @param {String} timezone - The timezone to use to replace the timezone of the date
   * @param {String} dateFormat - The format of the date to use for the return result
   * @returns {string} - The formatted date with timezone
   */
  static formatDateWithTimezone(date, timezone, dateFormat) {
    const timestampWithoutTZAsString = moment.utc(date).format('YYYY-MM-DD HH:mm:ss.SSS')
    return moment.tz(timestampWithoutTZAsString, timezone).format(dateFormat)
  }

  /**
   * Generate CSV file from the values.
   * @param {object[]} result - The query result
   * @returns {Promise<string>} - The CSV content
   */
  generateCSV(result) {
    const transform = (row) => {
      Object.entries(row).forEach(([column, value]) => {
        if (value instanceof Date) {
          row[column] = SQLDbToFile.formatDateWithTimezone(value, this.timezone, this.dateFormat)
        }
      })
      return (row)
    }
    const options = {
      headers: true,
      delimiter: this.delimiter,
      transform,
    }
    return csv.writeToString(result, options)
  }
}

module.exports = SQLDbToFile
