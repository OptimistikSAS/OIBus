const path = require('path')

const { createLogger, format, transports } = require('winston')
const LokiTransport = require('winston-loki')

const SqliteTransport = require('./SqliteWinstonTransport.class')

const { combine, timestamp, printf, colorize } = format

const ENGINE_LOG_LEVEL_ENTRY = 'engine'

class Logger {
  constructor() {
    const defaultFormat = combine(timestamp(), printf((info) => `${info.source} - ${info.timestamp} ${info.level}: ${info.message}`))
    const consoleFormat = combine(timestamp(), printf((info) => {
      const logPrefix = `${info.source} - ${info.timestamp}-${info.level}:`
      return `${colorize().colorize(info.level, logPrefix)} ${info.message}`
    }))
    this.logger = createLogger({
      level: 'info',
      format: defaultFormat,
      transports: [
        new transports.Console({ format: consoleFormat, handleExceptions: true }),
      ],
    })
  }

  static getDefaultLogger() {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  changeParameters(baseParameters, specificParameters = {}) {
    const logParameters = { ...baseParameters }

    /**
     * Replacing global log parameters by specific one if not set to engine level
     */
    if (specificParameters.consoleLevel && specificParameters.consoleLevel !== ENGINE_LOG_LEVEL_ENTRY) {
      logParameters.consoleLog.level = specificParameters.consoleLevel
    }
    if (specificParameters.fileLevel && specificParameters.fileLevel !== ENGINE_LOG_LEVEL_ENTRY) {
      logParameters.fileLog.level = specificParameters.fileLevel
    }
    if (specificParameters.sqliteLevel && specificParameters.sqliteLevel !== ENGINE_LOG_LEVEL_ENTRY) {
      logParameters.sqliteLog.level = specificParameters.sqliteLevel
    }
    if (specificParameters.lokiLevel && specificParameters.lokiLevel !== ENGINE_LOG_LEVEL_ENTRY) {
      logParameters.lokiLog.level = specificParameters.lokiLevel
    }
    const { consoleLog, fileLog, sqliteLog, lokiLog } = logParameters
    this.logger.level = consoleLog.level
    if (fileLog.level !== 'none') {
      this.logger.add(new transports.File({
        filename: fileLog.fileName,
        level: fileLog.level,
        maxsize: fileLog.maxSize,
        maxFiles: fileLog.numberOfFiles,
        tailable: fileLog.tailable,
        handleExceptions: true,
      }))
    }

    if (sqliteLog.level !== 'none') {
      this.logger.add(new SqliteTransport({
        fileName: sqliteLog.fileName,
        level: sqliteLog.level,
        maxFileSize: sqliteLog.maxSize,
        handleExceptions: true,
      }))
    }

    if (lokiLog.level !== 'none') {
      this.logger.add(new LokiTransport({
        host: lokiLog.host,
        json: true,
        batching: true,
        replaceTimestamp: true,
        interval: lokiLog.interval,
        labels: { oibus: lokiLog.identifier },
      }))
    }
  }

  info(message) {
    this.logger.info(message, { source: this.getSource() })
  }

  warn(message) {
    this.logger.warn(message, { source: this.getSource() })
  }

  error(message) {
    this.logger.error(message.stack || message, { source: this.getSource() })
  }

  debug(message) {
    this.logger.debug(message, { source: this.getSource() })
  }

  silly(message) {
    this.logger.silly(message, { source: this.getSource() })
  }

  /**
   * Use CallSite to extract filename, for more info read: https://v8.dev/docs/stack-trace-api#customizing-stack-traces
   * @returns {string} filename
   */
  getSource() {
    const oldStackTrace = Error.prepareStackTrace
    try {
      // eslint-disable-next-line handle-callback-err
      Error.prepareStackTrace = (err, structuredStackTrace) => structuredStackTrace
      Error.captureStackTrace(this)
      // Get the first CallSite outside the logger
      const callSite = this.stack.find((line) => line.getFileName().indexOf(path.basename(__filename)) === -1)
      return `${path.parse(callSite.getFileName()).name}(${callSite.getLineNumber()})`
    } finally {
      Error.prepareStackTrace = oldStackTrace
    }
  }
}

module.exports = Logger
