const fs = require('fs')
const TransportStream = require('winston-transport')
const databaseService = require('../services/database.service')

const NUMBER_OF_RECORDS_TO_DELETE = 1
const DEFAULT_MAX_FILE_SIZE = 2000000

/**
 * class to support Winston logging to sqlite
 *
 * @class SqliteTransport
 * @extends {TransportStream}
 */
class SqliteTransport extends TransportStream {
  constructor(options) {
    super(options)
    // Expose the name of this Transport on the prototype.
    this.name = options.name || 'sqlite'
    this.database = null
    this.filename = options.filename || ':memory:'
    this.tableName = options.tableName || 'logs'
    this.maxFileSize = options.maxFileSize || DEFAULT_MAX_FILE_SIZE
  }

  /**
   * Core logging method exposed to Winston.
   * @param {Object} payload - object with logging info
   * @param {Function} callback - to be called when finished
   * @returns {undefined}
   */

  async log(payload, callback) {
    setImmediate(() => this.emit('logged', payload.level))

    // Perform the writing to the remote service
    if (!this.database) {
      this.database = await databaseService.createLogsDatabase(this.filename)
    }
    await databaseService.addLog(this.database, payload.timestamp, payload.level, payload.message)

    const logFile = fs.statSync(this.filename)
    if (logFile.size > this.maxFileSize) {
      await databaseService.deleteOldLogs(this.database, NUMBER_OF_RECORDS_TO_DELETE)
    }

    if (callback) callback()
  }
}

module.exports = SqliteTransport
