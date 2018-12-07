const { createLogger, format, transports } = require('winston')

const { combine, timestamp, printf, colorize } = format

class Logger {
  constructor(logParameters) {
    const { consoleLevel, fileLevel, filename, maxFiles, maxsize, tailable } = logParameters
    const defaultFormat = combine(timestamp(), printf(info => `${info.timestamp} ${info.level}: ${info.message}`))
    const consoleFormat = combine(colorize(), printf(info => `${info.level}: ${info.message}`))
    this.logger = createLogger({
      level: consoleLevel,
      format: defaultFormat,
      transports: [
        new transports.Console({ format: consoleFormat }),
        new transports.File({ filename, level: fileLevel, maxsize, maxFiles, tailable }),
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
    this.logger.error(message)
  }

  debug(message) {
    this.logger.debug(message)
  }
}

module.exports = Logger
