const fs = require('fs')
const path = require('path')

const mssql = require('mssql')
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
      this.logger.error(`Invalid timezone supplied: ${this.timezone}`)
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
      return
    }

    let result = []
    try {
      switch (this.driver) {
        case 'mssql':
          result = await this.getDataFromMSSQL()
          break
        case 'mysql':
        case 'postgresql':
        case 'oracle':
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
    const adaptedQuery = this.query.replace('@date2', 'GETDATE()')
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
   * Generate CSV file from the values.
   * @param {object[]} result - The query result
   * @returns {Promise<string>} - The CSV content
   */
  generateCSV(result) {
    const transform = (row) => {
      if (row[this.timeColumn] instanceof Date) {
        row[this.timeColumn] = moment.tz(row[this.timeColumn], this.timezone).format(this.dateFormat)
      }
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
