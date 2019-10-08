const { createLogger, format, transports } = require('winston')
const SqliteTransport = require('./SqliteWinstonTransport.class')

const { combine, timestamp, printf, colorize } = format

class Logger {
  constructor() {
    if (Logger.instance) {
      return Logger.instance
    }
    Logger.instance = this
    const defaultFormat = combine(timestamp(), printf((info) => `${info.timestamp} ${info.level}: ${info.message}`))
    const consoleFormat = combine(timestamp(), printf((msg) => `${colorize().colorize(msg.level, `${msg.timestamp}-${msg.level}:`)} ${msg.message}`))
    this.logger = createLogger({
      level: 'debug',
      format: defaultFormat,
      transports: [
        new transports.Console({ format: consoleFormat, handleExceptions: true }),
      ],
    })
    return Logger.instance
  }

  changeParameters(logParameters) {
    const { consoleLevel, fileLevel, filename, maxFiles, maxsize, tailable, sqliteLevel, sqliteFilename, sqliteMaxFileSize } = logParameters
    this.logger.level = consoleLevel
    this.logger.add(new transports.File({ filename, level: fileLevel, maxsize, maxFiles, tailable, handleExceptions: true }))
    this.logger.add(new SqliteTransport({ filename: sqliteFilename, level: sqliteLevel, maxFileSize: sqliteMaxFileSize, handleExceptions: true }))
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

  silly(message) {
    this.logger.silly(message)
  }
}

module.exports = Logger
