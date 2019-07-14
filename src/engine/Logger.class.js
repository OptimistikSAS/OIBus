const { createLogger, format, transports } = require('winston')
const TransportStream = require('winston-transport')
const databaseService = require('../services/database.service')
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
    databaseService.addLog(this.database, payload.timestamp, payload.level, payload.message)
    if (callback) callback()
  }
}

const { combine, timestamp, printf, colorize } = format

class Logger {
  constructor(logParameters) {
    const { consoleLevel, fileLevel, filename, maxFiles, maxsize, tailable, sqliteLevel, sqliteFilename } = logParameters
    const defaultFormat = combine(timestamp(), printf((info) => `${info.timestamp} ${info.level}: ${info.message}`))
    const consoleFormat = combine(colorize({ all: true }), printf((info) => `${info.level}: ${info.message}`))
    this.logger = createLogger({
      level: consoleLevel,
      format: defaultFormat,
      transports: [
        new transports.Console({ format: consoleFormat }),
        new transports.File({ filename, level: fileLevel, maxsize, maxFiles, tailable }),
        new SqliteTransport({ filename: sqliteFilename, level: sqliteLevel }),
      ],
    })
  }

  info(message) {
    this.logger.info(message)
  }

  warn(message) {
    this.logger.warn(message)
  }

  error(message) {
    this.logger.error(message.stack || message)
  }

  debug(message) {
    this.logger.debug(message)
  }
}

module.exports = Logger
