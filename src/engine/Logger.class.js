// This logger supported by winston doesn't print to log when we use start debugging to run the application
// so I added a parameter debugMode to permit it to perform differently to print logs to the console
// this is just a stuppid way to garantee the debugging work and need to be changed one day
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
