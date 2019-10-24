const { createLogger, format, transports } = require('winston')
const SqliteTransport = require('./SqliteWinstonTransport.class')

const { combine, timestamp, printf, colorize } = format

const DEFAULT_LOG_SOURCE = 'general'

class Logger {
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

  changeParameters(logParameters) {
    const { consoleLevel, fileLevel, filename, maxFiles, maxsize, tailable, sqliteLevel, sqliteFilename, sqliteMaxFileSize } = logParameters
    this.logger.level = consoleLevel
    this.logger.add(new transports.File({ filename, level: fileLevel, maxsize, maxFiles, tailable, handleExceptions: true }))
    this.logger.add(new SqliteTransport({ filename: sqliteFilename, level: sqliteLevel, maxFileSize: sqliteMaxFileSize, handleExceptions: true }))
  }

  info(message, source = DEFAULT_LOG_SOURCE) {
    this.logger.info(message, { source })
  }

  warn(message, source = DEFAULT_LOG_SOURCE) {
    this.logger.warn(message, { source })
  }

  error(message, source = DEFAULT_LOG_SOURCE) {
    this.logger.error(message.stack || message, { source })
  }

  debug(message, source = DEFAULT_LOG_SOURCE) {
    this.logger.debug(message, { source })
  }

  silly(message, source = DEFAULT_LOG_SOURCE) {
    this.logger.silly(message, { source })
  }
}

module.exports = Logger
