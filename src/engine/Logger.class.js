// This logger supported by winston doesn't print to log when we use start debugging to run the application
// so I added a parameter debugMode to permit it to perform differently to print logs to the console
// this is just a stuppid way to garantee the debugging work and need to be changed one day
const { createLogger, format, transports } = require('winston')

const { combine, timestamp, printf } = format
class Logger {
  constructor(logParameters) {
    const { consoleLevel, fileLevel, filename } = logParameters
    this.debugMode = logParameters.debugMode
    const fileFormat = printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    const consoleFormat = printf(info => `${info.level}: ${info.message}`)
    this.logger = createLogger({
      level: consoleLevel,
      format: combine(timestamp(), fileFormat),
      transports: [new transports.Console({ format: consoleFormat }), new transports.File({ filename, level: fileLevel })],
    })
  }

  info(message) {
    this.logger.info(message)
    if (this.debugMode) console.log(message)
  }

  warn(message) {
    this.logger.warn(message)
    if (this.debugMode) console.warn(message)
  }

  error(message) {
    this.logger.error(message)
    if (this.debugMode) console.error(message)
  }

  debug(message) {
    this.logger.debug(message)
    if (this.debugMode) console.debug(message)
  }
}

module.exports = Logger
