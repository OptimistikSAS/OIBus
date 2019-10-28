const LoggerSingleton = require('./LoggerSingleton.class')

const DEFAULT_LOG_SOURCE = 'general'

class Logger {
  constructor(source) {
    this.source = source || DEFAULT_LOG_SOURCE
    this.loggerSingleton = LoggerSingleton.getInstance()
  }

  changeParameters(logParameters) {
    this.loggerSingleton.changeParameters(logParameters)
  }

  info(message) {
    this.loggerSingleton.info(message, this.source)
  }

  warn(message) {
    this.loggerSingleton.warn(message, this.source)
  }

  error(message) {
    this.loggerSingleton.error(message, this.source)
  }

  debug(message) {
    this.loggerSingleton.debug(message, this.source)
  }

  silly(message) {
    this.loggerSingleton.silly(message, this.source)
  }
}

module.exports = Logger
