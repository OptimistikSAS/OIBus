const { createLogger, format, transports } = require('winston')

const SqliteTransport = require('./SqliteWinstonTransport.class')

const { combine, timestamp, printf, colorize } = format

class LoggerSingleton {
  constructor() {
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

  static getInstance() {
    if (!LoggerSingleton.instance) {
      LoggerSingleton.instance = new LoggerSingleton()
    }
    return LoggerSingleton.instance
  }

  changeParameters(logParameters) {
    const { consoleLevel, fileLevel, filename, maxFiles, maxsize, tailable, sqliteLevel, sqliteFilename, sqliteMaxFileSize } = logParameters
    this.logger.level = consoleLevel
    this.logger.add(new transports.File({ filename, level: fileLevel, maxsize, maxFiles, tailable, handleExceptions: true }))
    this.logger.add(new SqliteTransport({ filename: sqliteFilename, level: sqliteLevel, maxFileSize: sqliteMaxFileSize, handleExceptions: true }))
  }

  info(message, source) {
    this.logger.info(message, { source })
  }

  warn(message, source) {
    this.logger.warn(message, { source })
  }

  error(message, source) {
    this.logger.error(message.stack || message, { source })
  }

  debug(message, source) {
    this.logger.debug(message, { source })
  }

  silly(message, source) {
    this.logger.silly(message, { source })
  }
}

module.exports = LoggerSingleton
