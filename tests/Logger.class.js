const { createLogger, format, transports } = require('winston')

const { combine, timestamp, printf } = format
class Logger {
  constructor(logParameters) {
    this.logParameters = logParameters
  }

  getLogger() {
    const { consoleLevel, fileLevel, filename } = this.logParameters
    const fileFormat = printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    const consoleFormat = printf(info => `${info.level}: ${info.message}`)
    const logger = createLogger({
      level: consoleLevel,
      format: combine(timestamp(), fileFormat),
      transports: [new transports.Console({ format: consoleFormat }), new transports.File({ filename, level: fileLevel })],
    })
    return logger
  }
}

module.exports = Logger
