const fs = require('fs')
const path = require('path')
const sqlite = require('sqlite')
const sqlite3 = require('sqlite3')
const mssql = require('mssql')
const mysql = require('mysql2/promise')
const { Client, types } = require('pg')
const csv = require('papaparse')
const moment = require('moment-timezone')
const ProtocolHandler = require('../ProtocolHandler.class')

let oracledb
try {
  // eslint-disable-next-line global-require,import/no-unresolved
  oracledb = require('oracledb')
} catch {
  console.error('Could not load node oracledb')
}

/**
 * Class SQLDbToFile
 */
class SQLDbToFile extends ProtocolHandler {
  static category = 'DatabaseOut'

  /**
   * Constructor for SQLDbToFile
   * @constructor
   * @param {Object} dataSource - The data source
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    super(dataSource, engine, { supportListen: false, supportLastPoint: false, supportFile: false, supportHistory: true })

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
    } = this.dataSource.SQLDbToFile

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
    this.containsLastCompletedDate = query.includes('@LastCompletedDate')
    this.connectionTimeout = connectionTimeout
    this.timeColumn = timeColumn
    this.requestTimeout = requestTimeout
    this.filename = filename
    this.delimiter = delimiter
    this.dateFormat = dateFormat
    this.compression = compression

    if (moment.tz.zone(timezone)) {
      this.timezone = timezone
    } else {
      this.logger.error(`Invalid timezone supplied: ${timezone}`)
    }

    const { engineConfig: { caching: { cacheFolder } } } = this.engine.configService.getConfig()
    this.tmpFolder = path.resolve(cacheFolder, this.dataSource.id)

    // Create tmp folder if not exists
    if (!fs.existsSync(this.tmpFolder)) {
      fs.mkdirSync(this.tmpFolder, { recursive: true })
    }

    this.canHandleHistory = true
    this.handlesFiles = true
  }

  /**
   * Function used to parse an entry and update the lastCompletedAt if needed
   * @param {*} entryList - on sql result item
   * @param {Date} actualLastCompletedAt - The actual last completed date
   * @return {string} date - the updated date in iso string format
   */
  setLastCompletedAt(entryList, actualLastCompletedAt) {
    let newLastCompletedAt = actualLastCompletedAt
    entryList.forEach((entry) => {
      if (entry[this.timeColumn] instanceof Date && entry[this.timeColumn] > newLastCompletedAt) {
        newLastCompletedAt = entry[this.timeColumn]
      } else if (entry[this.timeColumn] && new Date(entry[this.timeColumn]).toString() !== 'Invalid Date') {
        const entryDate = new Date(moment.tz(entry[this.timeColumn], this.timezone).tz('UTC').toISOString())
        if (entryDate > newLastCompletedAt) {
          newLastCompletedAt = entryDate.toISOString()
        }
      }
    })

    if (newLastCompletedAt !== actualLastCompletedAt) {
      this.logger.debug(`Updating lastCompletedAt to ${newLastCompletedAt}`)
    } else {
      this.logger.debug('lastCompletedAt not used')
    }
    return newLastCompletedAt
  }

  /**
   * Get entries from the database since the last query completion, write them into a CSV file and send to the Engine.
   * @param {*} scanMode - The scan mode
   * @return {void}
   */
  async onScanImplementation(scanMode) {
    if (!this.timezone) {
      this.logger.error('Invalid timezone')
      return
    }

    if (this.ongoingReads[scanMode]) {
      this.logger.silly(`onScan ignored: ongoingReads[${scanMode}]: ${this.ongoingReads[scanMode]}`)
      return
    }

    this.ongoingReads[scanMode] = true

    let result = []
    try {
      switch (this.driver) {
        case 'mssql':
          result = await this.getDataFromMSSQL(this.lastCompletedAt[scanMode])
          break
        case 'mysql':
          result = await this.getDataFromMySQL(this.lastCompletedAt[scanMode])
          break
        case 'postgresql':
          result = await this.getDataFromPostgreSQL(this.lastCompletedAt[scanMode])
          break
        case 'oracle':
          result = await this.getDataFromOracle(this.lastCompletedAt[scanMode])
          break
        case 'sqlite':
          result = await this.getDataFromSqlite(this.lastCompletedAt[scanMode])
          break
        default:
          this.logger.error(`Driver ${this.driver} not supported by ${this.dataSource.name}`)
          result = []
      }
    } catch (error) {
      this.logger.error(error)
    }

    this.logger.debug(`Found ${result.length} results`)

    if (result.length > 0) {
      this.lastCompletedAt[scanMode] = this.setLastCompletedAt(result, this.lastCompletedAt[scanMode])
      await this.setConfig(`astCompletedAt-${scanMode}`, this.lastCompletedAt[scanMode].getTime())
      const csvContent = await this.generateCSV(result)
      if (csvContent) {
        const filename = this.filename.replace('@date', moment().format('YYYY_MM_DD_HH_mm_ss'))
        const filePath = path.join(this.tmpFolder, filename)
        try {
          this.logger.debug(`Writing CSV file at ${filePath}`)
          fs.writeFileSync(filePath, csvContent)

          if (this.compression) {
            // Compress and send the compressed file
            const gzipPath = `${filePath}.gz`
            await this.compress(filePath, gzipPath)

            fs.unlink(filePath, (unlinkError) => {
              if (unlinkError) {
                this.logger.error(unlinkError)
              } else {
                this.logger.info(`File ${filePath} compressed and deleted`)
              }
            })

            this.logger.debug(`Sending compressed ${gzipPath} to Engine.`)
            this.addFile(gzipPath, this.preserveFiles)
          } else {
            this.logger.debug(`Sending ${filePath} to Engine.`)
            this.addFile(filePath, this.preserveFiles)
          }
        } catch (error) {
          this.logger.error(error)
        }
      }
    }

    this.ongoingReads[scanMode] = false
  }

  /**
   * Get new entries from MSSQL database.
   * @param {Date} lastCompletedAt - The last completed date
   * @returns {void}
   */
  async getDataFromMSSQL(lastCompletedAt) {
    const adaptedQuery = this.query
    this.logger.debug(`Executing "${adaptedQuery}" ${this.containsLastCompletedDate ? 'with' : 'without'} LastCompletedDate`)

    const config = {
      user: this.username,
      password: this.encryptionService.decryptText(this.password),
      server: this.host,
      port: this.port,
      database: this.database,
      connectionTimeout: this.connectionTimeout,
      requestTimeout: this.requestTimeout,
      options: { encrypt: this.encryption, trustServerCertificate: true },
    }
    // domain is optional and allow to activate the ntlm authentication on windows.
    if (this.domain) config.domain = this.domain

    let data = []
    try {
      const pool = await new mssql.ConnectionPool(config).connect()
      let result
      if (this.containsLastCompletedDate) {
        result = await pool.request()
          .input('LastCompletedDate', mssql.DateTimeOffset, lastCompletedAt)
          .query(adaptedQuery)
      } else {
        result = await pool.request()
          .query(adaptedQuery)
      }
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
   * @param {Date} lastCompletedAt - The last completed date
   * @returns {void}
   */
  async getDataFromMySQL(lastCompletedAt) {
    const adaptedQuery = this.query.replace(/@LastCompletedDate/g, '?')
    this.logger.debug(`Executing "${adaptedQuery}" ${this.containsLastCompletedDate ? 'with' : 'without'} LastCompletedDate`)

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
      const params = this.containsLastCompletedDate ? [lastCompletedAt] : []
      const [rows] = await connection.execute(
        { sql: adaptedQuery, timeout: this.requestTimeout },
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
   * @param {Date} lastCompletedAt - The last completed date
   * @returns {void}
   */
  async getDataFromPostgreSQL(lastCompletedAt) {
    const adaptedQuery = this.query.replace(/@LastCompletedDate/g, '$1')
    this.logger.debug(`Executing "${adaptedQuery}" ${this.containsLastCompletedDate ? 'with' : 'without'} LastCompletedDate`)

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
      const params = this.containsLastCompletedDate ? [lastCompletedAt] : []
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
   * @param {Date} lastCompletedAt - The last completed date
   * @returns {void}
   */
  async getDataFromOracle(lastCompletedAt) {
    if (this.engine.m1) {
      this.logger.error('Oracle not supported on apple m1')
      return []
    }
    const adaptedQuery = this.query.replace(/@LastCompletedDate/g, ':date1')
    this.logger.debug(`Executing "${adaptedQuery}" ${this.containsLastCompletedDate ? 'with' : 'without'} LastCompletedDate`)

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
      const params = this.containsLastCompletedDate ? [lastCompletedAt] : []
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
   * @param {Date} lastCompletedAt - The last completed date
   * @returns {void}
   */
  async getDataFromSqlite(lastCompletedAt) {
    const adaptedQuery = this.query
    this.logger.debug(`Executing "${adaptedQuery}" ${this.containsLastCompletedDate ? 'with' : 'without'} LastCompletedDate`)

    let database = null
    let data = []
    try {
      database = await sqlite.open({ filename: this.databasePath, driver: sqlite3.Database })
      const stmt = await database.prepare(adaptedQuery)
      const preparedParameters = this.containsLastCompletedDate ? { '@LastCompletedDate': lastCompletedAt } : {}
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
    const timestampWithoutTZAsString = moment.utc(date).format('YYYY-MM-DD HH:mm:ss.SSS')
    return moment.tz(timestampWithoutTZAsString, timezone).format(dateFormat)
  }

  /**
   * Generate CSV file from the values.
   * @param {object[]} result - The query result
   * @returns {Promise<string>} - The CSV content
   */
  generateCSV(result) {
    // loop through each value and format date to timezone if value is Date
    result.forEach((row) => {
      Object.keys(row).forEach((key) => {
        const value = row[key]
        if (value instanceof Date) {
          row[key] = SQLDbToFile.formatDateWithTimezone(value, this.timezone, this.dateFormat)
        }
      })
    })
    const options = {
      header: true,
      delimiter: this.delimiter,
    }
    return csv.unparse(result, options)
  }
}

module.exports = SQLDbToFile
