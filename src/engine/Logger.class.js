const path = require('path')

const { createLogger, format, transports } = require('winston')

const SqliteTransport = require('./SqliteWinstonTransport.class')

const { combine, timestamp, printf, colorize } = format

const ENGINE_LOG_LEVEL_ENTRY = 'engine'

class Logger {
  constructor() {
    const defaultFormat = combine(timestamp(), printf((info) => `${info.source} - ${info.timestamp} ${info.level}: ${info.message}`))

    this.logger = createLogger({
      format: defaultFormat,
      transports: [],
    })
  }

  static getDefaultLogger() {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  changeParameters(baseParameters, specificParameters = {}) {
    const logParameters = {
      ...baseParameters,
      ...this.removeDefaultSettings(specificParameters),
    }

    const { consoleLevel, fileLevel, filename, maxFiles, maxsize, tailable, sqliteLevel, sqliteFilename, sqliteMaxFileSize } = logParameters
    if (consoleLevel && consoleLevel !== 'none') {
      const consoleFormat = combine(timestamp(), printf((msg) => {
        const logPrefix = `${msg.source} - ${msg.timestamp}-${msg.level}:`
        return `${colorize().colorize(msg.level, logPrefix)} ${msg.message}`
      }))
      this.logger.add(new transports.Console({ format: consoleFormat, level: consoleLevel, handleExceptions: true }))
    }
    if (fileLevel && fileLevel !== 'none') {
      this.logger.add(new transports.File({ filename, level: fileLevel, maxsize, maxFiles, tailable, handleExceptions: true }))
    }
    if (sqliteLevel && sqliteLevel !== 'none') {
      this.logger.add(new SqliteTransport({ filename: sqliteFilename, level: sqliteLevel, maxFileSize: sqliteMaxFileSize, handleExceptions: true }))
    }
  }

  info(message) {
    if (this.logger.transports.length > 0) {
      this.logger.info(message, { source: this.getSource() })
    }
  }

  warn(message) {
    if (this.logger.transports.length > 0) {
      this.logger.warn(message, { source: this.getSource() })
    }
  }

  error(message) {
    if (this.logger.transports.length > 0) {
      this.logger.error(message.stack || message, { source: this.getSource() })
    }
  }

  debug(message) {
    if (this.logger.transports.length > 0) {
      this.logger.debug(message, { source: this.getSource() })
    }
  }

  silly(message) {
    if (this.logger.transports.length > 0) {
      this.logger.silly(message, { source: this.getSource() })
    }
  }

  /* eslint-disable-next-line class-methods-use-this */
  removeDefaultSettings(parameters) {
    if (parameters.consoleLevel === ENGINE_LOG_LEVEL_ENTRY) {
      delete parameters.consoleLevel
    }
    if (parameters.fileLevel === ENGINE_LOG_LEVEL_ENTRY) {
      delete parameters.fileLevel
    }
    if (parameters.sqliteLevel === ENGINE_LOG_LEVEL_ENTRY) {
      delete parameters.sqliteLevel
    }

    return parameters
  }

  /**
   * Use CallSite to extract filename, for more info read: https://v8.dev/docs/stack-trace-api#customizing-stack-traces
   * @returns {string} filename
   */
  getSource() {
    const oldStackTrace = Error.prepareStackTrace
    try {
      // eslint-disable-next-line handle-callback-err
      Error.prepareStackTrace = (err, structuredStackTrace) => structuredStackTrace
      Error.captureStackTrace(this)
      // Get the first CallSite outside the logger
      const callSite = this.stack.find((line) => line.getFileName().indexOf(path.basename(__filename)) === -1)
      return `${path.parse(callSite.getFileName()).name}(${callSite.getLineNumber()})`
    } finally {
      Error.prepareStackTrace = oldStackTrace
    }
  }
}

module.exports = Logger
