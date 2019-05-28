const fs = require('fs')
const path = require('path')

const mssql = require('mssql')
const Json2csvParser = require('json2csv').Parser

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
    this.lastCompletedAt = SQLFile.getDateTime()

    // Create tmp folder if not exists
    if (!fs.existsSync(this.tmpFolder)) {
      fs.mkdirSync(this.tmpFolder, { recursive: true })
    }
  }

  /**
   * Get current date in DateTime format to use in query
   * @return {string} - The DateTime
   */
  static getDateTime() {
    return new Date().toISOString().slice(0, 23).replace('T', ' ')
  }

  async connect() {
    const databasePath = `${this.engine.config.engine.caching.cacheFolder}/${this.dataSource.dataSourceId}.db`
    this.configDatabase = await databaseService.createConfigDatabase(databasePath)

    this.lastCompletedAt = await databaseService.getConfig(this.configDatabase, 'lastCompletedAt')
    if (!this.lastCompletedAt) {
      this.lastCompletedAt = SQLFile.getDateTime()
    }
  }

  /**
   * Get entries from the database since the last query completion, write them into a CSV file and send to the Engine.
   * @param {*} _scanMode - The scan mode
   * @return {void}
   */
  async onScan(_scanMode) {
    const now = SQLFile.getDateTime()
    const query = this.query.replace('$date1', this.lastCompletedAt).replace('$date2', now)
    this.logger.debug(`Executing "${query}"`)

    let result = []
    try {
      switch (this.driver) {
        case 'mssql':
          result = await this.getDataFromMSSQL(query)
          break
        case 'mysql':
          result = await this.getDataFromMySQL(query)
          break
        case 'postgresql':
          result = await this.getDataFromPostgreSQL(query)
          break
        case 'oracle':
          result = await this.getDataFromOracle(query)
          break
        default:
          result = []
      }

      this.lastCompletedAt = now
      await databaseService.upsertConfig(this.configDatabase, 'lastCompletedAt', this.lastCompletedAt)
    } catch (error) {
      this.logger.error(error)
    }

    this.logger.debug(`Found ${result.length} results`)

    if (result.length > 0) {
      const csv = this.generateCSV(result)
      if (csv) {
        const filePath = path.join(this.tmpFolder, 'sql.csv')
        try {
          this.logger.debug(`Writing CSV file at ${filePath}`)
          fs.writeFileSync(filePath, csv)

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
   * @param {string} query - The query to execute
   * @returns {void}
   */
  async getDataFromMSSQL(query) {
    const config = {
      user: this.username,
      password: this.decryptPassword(this.password),
      server: this.host,
      port: this.port,
      database: this.database,
    }
    await mssql.connect(config)
    const result = await mssql.query(query)
    await mssql.close()

    return result.recordsets[0]
  }

  /**
   * Get new entries from MySQL database.
   * @param {string} query - The query to execute
   * @returns {void}
   */
  async getDataFromMySQL(query) {
    this.logger.info(query)

    return []
  }

  /**
   * Get new entries from PostgreSQL database.
   * @param {string} query - The query to execute
   * @returns {void}
   */
  async getDataFromPostgreSQL(query) {
    this.logger.info(query)

    return []
  }

  /**
   * Get new entries from Oracle database.
   * @param {string} query - The query to execute
   * @returns {void}
   */
  async getDataFromOracle(query) {
    this.logger.info(query)

    return []
  }

  /**
   * Generate CSV file from the values.
   * @param {object[]} result - The query result
   * @returns {String} - The CSV content
   */
  generateCSV(result) {
    let csv = null

    try {
      const json2csvParser = new Json2csvParser({ delimiter: this.delimiter })
      csv = json2csvParser.parse(result)
    } catch (error) {
      this.logger.error(error)
    }

    return csv
  }
}

SQLFile.schema = require('./schema')

module.exports = SQLFile
