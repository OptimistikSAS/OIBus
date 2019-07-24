const fs = require('fs')
const path = require('path')

const mssql = require('mssql')
const csv = require('fast-csv')

const ProtocolHandler = require('../ProtocolHandler.class')
const databaseService = require('../../services/database.service')

/**
 * Class SQLFile
 */
class SQLFile extends ProtocolHandler {
  /**
   * Constructor for SQLFile
   * @constructor
   * @param {Object} dataSource - The data source
   * @param {Engine} engine - The engine
   * @return {void}
   */
  constructor(dataSource, engine) {
    super(dataSource, engine)

    const { driver, host, port, username, password, database, query, delimiter, tmpFolder } = this.dataSource

    this.preserveFiles = false
    this.driver = driver
    this.host = host
    this.port = port
    this.username = username
    this.password = password
    this.database = database
    this.query = query
    this.delimiter = delimiter
    this.tmpFolder = path.resolve(tmpFolder)

    // Create tmp folder if not exists
    if (!fs.existsSync(this.tmpFolder)) {
      fs.mkdirSync(this.tmpFolder, { recursive: true })
    }
  }

  async connect() {
    const { dataSourceId, startTime } = this.dataSource

    const databasePath = `${this.engine.config.engine.caching.cacheFolder}/${dataSourceId}.db`
    this.configDatabase = await databaseService.createConfigDatabase(databasePath)

    this.lastCompletedAt = await databaseService.getConfig(this.configDatabase, 'lastCompletedAt')
    if (!this.lastCompletedAt) {
      this.lastCompletedAt = new Date(startTime).toISOString() || new Date().toISOString()
    }
  }

  /**
   * Get entries from the database since the last query completion, write them into a CSV file and send to the Engine.
   * @param {*} _scanMode - The scan mode
   * @return {void}
   */
  async onScan(_scanMode) {
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
          result = []
      }
    } catch (error) {
      this.logger.error(error)
    }

    this.logger.debug(`Found ${result.length} results`)

    if (result.length > 0) {
      this.lastCompletedAt = result.slice(-1).pop().timestamp.toISOString()
      this.logger.debug(`Updating lastCompletedAt to ${this.lastCompletedAt}`)
      await databaseService.upsertConfig(this.configDatabase, 'lastCompletedAt', this.lastCompletedAt)

      const csvContent = await this.generateCSV(result)
      if (csvContent) {
        const filePath = path.join(this.tmpFolder, 'sql.csv')
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
    }

    let data = []
    try {
      const pool = await mssql.connect(config)
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
    this.logger.info(this.query)

    return []
  }

  /**
   * Get new entries from PostgreSQL database.
   * @returns {void}
   */
  async getDataFromPostgreSQL() {
    this.logger.info(this.query)

    return []
  }

  /**
   * Get new entries from Oracle database.
   * @returns {void}
   */
  async getDataFromOracle() {
    this.logger.info(this.query)

    return []
  }

  /**
   * Generate CSV file from the values.
   * @param {object[]} result - The query result
   * @returns {Promise<string>} - The CSV content
   */
  generateCSV(result) {
    const options = {
      headers: true,
      delimiter: this.delimiter,
    }
    return csv.writeToString(result, options)
  }
}

SQLFile.schema = require('./schema')

module.exports = SQLFile
