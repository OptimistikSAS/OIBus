const { createLogger, format, transports } = require('winston')

const SqliteTransport = require('./SqliteWinstonTransport.class')

const { combine, timestamp, printf, colorize } = format

const DEFAULT_LOG_SOURCE = 'general'
const ENGINE_LOG_LEVEL_ENTRY = 'engine'

class Logger {
  constructor(source) {
    this.source = source || DEFAULT_LOG_SOURCE

    const defaultFormat = combine(timestamp(), printf((info) => `${info.source} - ${info.timestamp} ${info.level}: ${info.message}`))
    const consoleFormat = combine(timestamp(), printf((msg) => {
      const logPrefix = `${msg.source} - ${msg.timestamp}-${msg.level}:`
      return `${colorize().colorize(msg.level, logPrefix)} ${msg.message}`
    }))
    this.logger = createLogger({
      level: 'info',
      format: defaultFormat,
      transports: [
        new transports.Console({ format: consoleFormat, handleExceptions: true }),
      ],
    })
  }

  static getDefaultLogger(source) {
    if (!Logger.instance) {
      Logger.instance = new Logger(source)
    }
    return Logger.instance
  }

  changeParameters(baseParameters, specificParameters = {}, source = null) {
    this.source = source || this.source

    const logParameters = {
      ...baseParameters,
      ...this.removeDefaultSettings(specificParameters),
    }

    const { consoleLevel, fileLevel, filename, maxFiles, maxsize, tailable, sqliteLevel, sqliteFilename, sqliteMaxFileSize } = logParameters
    this.logger.level = consoleLevel
    this.logger.add(new transports.File({ filename, level: fileLevel, maxsize, maxFiles, tailable, handleExceptions: true }))
    this.logger.add(new SqliteTransport({ filename: sqliteFilename, level: sqliteLevel, maxFileSize: sqliteMaxFileSize, handleExceptions: true }))
  }

  info(message) {
    this.logger.info(message, { source: this.source })
  }

  warn(message) {
    this.logger.warn(message, { source: this.source })
  }

  error(message) {
    this.logger.error(message.stack || message, { source: this.source })
  }

  debug(message) {
    this.logger.debug(message, { source: this.source })
  }

  silly(message) {
    this.logger.silly(message, { source: this.source })
  }

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
}

module.exports = Logger
