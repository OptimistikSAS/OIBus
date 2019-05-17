const { createLogger, format, transports } = require('winston')
require('winston3-sqlite3')

const { combine, timestamp, printf, colorize } = format

class Logger {
  constructor(logParameters) {
    const { consoleLevel, fileLevel, filename, maxFiles, maxsize, tailable, sqliteLevel, sqliteFilename } = logParameters
    const defaultFormat = combine(timestamp(), printf(info => `${info.timestamp} ${info.level}: ${info.message}`))
    const consoleFormat = combine(colorize(), printf(info => `${info.level}: ${info.message}`))
    this.logger = createLogger({
      level: consoleLevel,
      format: defaultFormat,
      transports: [
        new transports.Console({ format: consoleFormat }),
        new transports.File({ filename, level: fileLevel, maxsize, maxFiles, tailable }),
        new transports.SQLite3({ filename: sqliteFilename, level: sqliteLevel, tableName: 'logs' }),
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
