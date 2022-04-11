const fs = require('fs/promises')
const path = require('path')
const sqlite = require('sqlite')
const sqlite3 = require('sqlite3')
const mssql = require('mssql')
const mysql = require('mysql2/promise')
const {
  Client,
  types,
} = require('pg')
const csv = require('papaparse')
const { DateTime } = require('luxon')
const humanizeDuration = require('humanize-duration')

const ProtocolHandler = require('../ProtocolHandler.class')

let oracledb
try {
  // eslint-disable-next-line global-require,import/no-unresolved,import/no-extraneous-dependencies
  oracledb = require('oracledb')
} catch {
  console.error('Could not load node oracledb')
}

/**
 * Class SQL
 */
class SQL extends ProtocolHandler {
  static category = 'DatabaseOut'

  /**
   * Constructor for SQL
   * @constructor
   * @param {Object} dataSource - The data source
   * @param {BaseEngine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    super(dataSource, engine, {
      supportListen: false,
      supportLastPoint: false,
      supportFile: false,
      supportHistory: true,
    })

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
    } = this.dataSource.SQL

    this.preserveFiles = false
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
    this.tmpFolder = path.resolve(this.engine.getCacheFolder(), this.dataSource.id)

    this.canHandleHistory = true
    this.handlesFiles = true
  }

  async init() {
    await super.init()
    try {
      await fs.mkdir(this.tmpFolder, { recursive: true })
    } catch (mkdirError) {
      this.logger.error(mkdirError)
    }
    if (!this.timezone || !DateTime.local()
      .setZone(this.timezone).isValid) {
      this.logger.error(`Invalid timezone supplied: ${this.timezone}`)
      this.timezone = null
    }
  }

  async connect() {
    await super.connect()
    this.statusData['Connected at'] = new Date().toISOString()
    this.updateStatusDataStream()
    this.connected = true
  }

  /**
   * Function used to parse an entry and get latest date
   * @param {*} entryList - on sql result item
   * @param {Date} startTime - The reference date
   * @return {Date} date - the updated date in iso string format
   */
  getLatestDate(entryList, startTime) {
    let newLastCompletedAt = startTime
    entryList.forEach((entry) => {
      if (entry[this.timeColumn]) {
        let entryDate
        if (entry[this.timeColumn] instanceof Date) {
          entryDate = entry[this.timeColumn]
        } else if (typeof entry[this.timeColumn] === 'number') {
          entryDate = DateTime.fromMillis(entry[this.timeColumn], { zone: this.timezone })
            .setZone('utc')
            .toJSDate()
        } else {
          if (DateTime.fromISO(entry[this.timeColumn], { zone: this.timezone }).isValid) {
            entryDate = DateTime.fromISO(entry[this.timeColumn], { zone: this.timezone })
              .setZone('utc')
              .toJSDate()
          }
          if (DateTime.fromSQL(entry[this.timeColumn], { zone: this.timezone }).isValid) {
            entryDate = DateTime.fromSQL(entry[this.timeColumn], { zone: this.timezone })
              .setZone('utc')
              .toJSDate()
          }
        }
        if (entryDate > new Date(newLastCompletedAt)) {
          newLastCompletedAt = DateTime.fromMillis(entryDate.setMilliseconds(entryDate.getMilliseconds() + 1))
            .setZone('utc')
            .toJSDate()
        }
      }
    })
    return newLastCompletedAt
  }

  /**
   * Get entries from the database since the last query completion,
   * write them into a CSV file and send to the Engine.
   * @param {String} scanMode - The scan mode
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @return {Promise<number>} - The on scan promise: -1 if an error occurred, 0 otherwise
   */
  async historyQuery(scanMode, startTime, endTime) {
    if (!this.connected) {
      this.logger.error(`The connector ${this.dataSource.name} has been stopped.`)
      return -1
    }
    if (!this.timezone) {
      this.logger.error('Invalid timezone')
      return -1
    }

    let updatedStartTime = startTime
    this.ongoingReads[scanMode] = true
    let result
    result = []
    try {
      this.logQuery(this.query, updatedStartTime, endTime)
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
          this.logger.error(`Driver ${this.driver} not supported by ${this.dataSource.name}`)
          return -1
      }
      const requestFinishTime = new Date().getTime()
      this.logger.info(`Found ${result.length} results in ${humanizeDuration(requestFinishTime - requestStartTime)}`)
    } catch (error) {
      this.logger.error(error)
      return -1
    }

    if (result.length > 0) {
      const csvContent = await this.generateCSV(result)
      if (csvContent) {
        const filename = this.replaceFilenameWithVariable(this.filename, this.queryParts[scanMode])
        const filePath = path.join(this.tmpFolder, filename)
        try {
          this.logger.debug(`Writing CSV file at ${filePath}`)
          await fs.writeFile(filePath, csvContent)

          if (this.compression) {
            // Compress and send the compressed file
            const gzipPath = `${filePath}.gz`
            await this.compress(filePath, gzipPath)

            try {
              await fs.unlink(filePath)
              this.logger.info(`File ${filePath} compressed and deleted`)
            } catch (unlinkError) {
              this.logger.error(unlinkError)
            }

            this.logger.debug(`Sending compressed ${gzipPath} to Engine.`)
            this.addFile(gzipPath, this.preserveFiles)
          } else {
            this.logger.debug(`Sending ${filePath} to Engine.`)
            this.addFile(filePath, this.preserveFiles)
          }
        } catch (error) {
          this.logger.error(error)
          return -1
        }
      }
    } else {
      this.logger.debug(`No result found between ${startTime.toISOString()} and ${endTime.toISOString()}`)
    }

    const oldLastCompletedAt = this.lastCompletedAt[scanMode]
    updatedStartTime = this.getLatestDate(result, updatedStartTime)
    this.lastCompletedAt[scanMode] = updatedStartTime
    if (this.lastCompletedAt[scanMode] !== oldLastCompletedAt) {
      this.logger.debug(`Updating lastCompletedAt to ${this.lastCompletedAt[scanMode].toISOString()}`)
      await this.setConfig(`lastCompletedAt-${scanMode}`, this.lastCompletedAt[scanMode].toISOString())
    } else {
      this.logger.debug(`No update for lastCompletedAt. Last value: ${this.lastCompletedAt[scanMode].toISOString()}`)
    }

    this.ongoingReads[scanMode] = false
    return 0
  }

  /**
   * Get new entries from MSSQL database.
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @returns {Promise<array>} - The new entries
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
    // domain is optional and allow to activate the ntlm authentication on windows.
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
    } catch (error) {
      this.logger.error(error)
    } finally {
      await mssql.close()
    }

    return data
  }

  /**
   * Get new entries from MySQL database.
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @returns {Promise<array>} - The new entries
   */
  async getDataFromMySQL(startTime, endTime) {
    const adaptedQuery = this.query.replace(/@StartTime/g, '?')
      .replace(/@EndTime/g, '?')

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

      const params = SQL.generateReplacementParameters(this.query, startTime, endTime)
      const [rows] = await connection.execute(
        {
          sql: adaptedQuery,
          timeout: this.requestTimeout,
        },
        params,
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
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @returns {Promise<array>} - The new entries
   */
  async getDataFromPostgreSQL(startTime, endTime) {
    const adaptedQuery = this.query.replace(/@StartTime/g, '$1')
      .replace(/@EndTime/g, '$2')

    const config = {
      host: this.host,
      port: this.port,
      user: this.username,
      password: this.encryptionService.decryptText(this.password),
      database: this.database,
      query_timeout: this.requestTimeout,
    }

    types.setTypeParser(1114, (str) => new Date(`${str}Z`))
    let connection = null
    let data = []
    try {
      connection = new Client(config)
      await connection.connect()
      const params = SQL.generateReplacementParameters(this.query, startTime, endTime)
      const { rows } = await connection.query(adaptedQuery, params)
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
   * Get new entries from Oracle database.
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @returns {Promise<array>} - The data
   */
  async getDataFromOracle(startTime, endTime) {
    if (this.engine.m1) {
      this.logger.error('Oracle not supported on apple m1')
      return []
    }

    const adaptedQuery = this.query.replace(/@StartTime/g, ':date1')
      .replace(/@EndTime/g, ':date2')

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
      const params = SQL.generateReplacementParameters(this.query, startTime, endTime)
      const { rows } = await connection.execute(adaptedQuery, params)
      data = rows
    } catch (error) {
      this.logger.error(error)
    } finally {
      if (connection) {
        await connection.close()
      }
    }

    return data
  }

  /**
   * Get new entries from local SQLite db file
   * @param {Date} startTime - The start time
   * @param {Date} endTime - The end time
   * @returns {Promise<array>} - The new entries
   */
  async getDataFromSqlite(startTime, endTime) {
    const adaptedQuery = this.query

    let database = null
    let data = []
    try {
      database = await sqlite.open({
        filename: this.databasePath,
        driver: sqlite3.Database,
      })
      const stmt = await database.prepare(adaptedQuery)
      const preparedParameters = {}
      if (this.query.indexOf('@StartTime') !== -1) {
        preparedParameters['@StartTime'] = startTime
      }
      if (this.query.indexOf('@EndTime') !== -1) {
        preparedParameters['@EndTime'] = endTime
      }

      data = await stmt.all(preparedParameters)
      await stmt.finalize()
    } catch (error) {
      this.logger.error(error)
    } finally {
      if (database) {
        await database.close()
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
    return DateTime.fromJSDate(date, { zone: 'utc' })
      .toFormat(dateFormat)
  }

  /**
   * Generate CSV file from the values.
   * @param {object[]} result - The query result
   * @returns {Promise<string>} - The CSV content
   */
  generateCSV(result) {
    // loop through each value and format date to timezone if value is Date
    result.forEach((row) => {
      Object.keys(row)
        .forEach((key) => {
          const value = row[key]
          if (value instanceof Date) {
            row[key] = SQL.formatDateWithTimezone(value, this.timezone, this.dateFormat)
          }
        })
    })
    const options = {
      header: true,
      delimiter: this.delimiter,
    }
    return csv.unparse(result, options)
  }

  /**
   * Log the executed query with replacements
   * @param {string} query - The query
   * @param {Date} startTime - The replaced StartTime
   * @param {Date} endTime - The replaced EndTime
   * @returns {void}
   */
  logQuery(query, startTime, endTime) {
    const startTimeLog = query.indexOf('@StartTime') !== -1 ? `StartTime = ${startTime.toISOString()}` : ''
    const endTimeLog = query.indexOf('@EndTime') !== -1 ? `EndTime = ${endTime.toISOString()}` : ''
    this.logger.info(`Executing "${query}" with ${startTimeLog} ${endTimeLog}`)
    this.statusData['Last SQL request'] = `"${query}" with ${startTimeLog} ${endTimeLog}`
    this.updateStatusDataStream()
  }

  /**
   * Generate replacements parameters
   * @param {string} query - The query
   * @param {Date} startTime - The StartTime
   * @param {Date} endTime - The EndTime
   * @return {any[]} - The replacement parameters
   */
  static generateReplacementParameters(query, startTime, endTime) {
    const startTimeOccurrences = SQL.getOccurrences(query, '@StartTime', startTime)
    const endTimeOccurrences = SQL.getOccurrences(query, '@EndTime', endTime)
    const occurrences = startTimeOccurrences.concat(endTimeOccurrences)
    occurrences.sort((a, b) => (a.index - b.index))
    return occurrences.map((occurrence) => occurrence.value)
  }

  /**
   * Get all occurrences of a substring with a value
   * @param {string} str - The string to look for occurrences in
   * @param {string} keyword - The keyword
   * @param {any} value - The value to assign to the occurrences index
   * @return {object[]} - The result as { index, value}
   */
  static getOccurrences(str, keyword, value) {
    const occurrences = []
    let occurrenceIndex = str.indexOf(keyword, 0)
    while (occurrenceIndex > -1) {
      occurrences.push({
        index: occurrenceIndex,
        value,
      })
      occurrenceIndex = str.indexOf(keyword, occurrenceIndex + 1)
    }
    return occurrences
  }
}

module.exports = SQL
