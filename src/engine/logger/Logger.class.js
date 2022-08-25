const path = require('node:path')

const pino = require('pino')

const ENGINE_LOG_LEVEL_ENTRY = 'engine'

/**
 * Manage pino loggers
 * Four loggers are supported:
 *  - Console
 *  - File
 *  - SQLite {@SQLiteLoggerTransport}
 *  - Loki {@LokiLoggerTransport}
 * @class Logger
 */
class Logger {
  /**
   * Constructor for Logger
   * @constructor
   * @param {String} scope - Gives the scope of the logger (the engine, the connector...)
   */
  constructor(scope = 'main') {
    this.logger = null
    this.encryptionService = null
    this.scope = scope
  }

  /**
   * Set the encryption service to use the same one as the calling object
   * @param {EncryptionService} encryptionService - The encryption service
   * @return {void}
   */
  setEncryptionService(encryptionService) {
    this.encryptionService = encryptionService
  }

  /**
   * Run the appropriate pino log transports according to the configuration
   * @param {Object} engineConfig - The engine configuration for the logs
   * @param {Object} specificParameters - Override some log settings from a connector
   * @returns {Promise<void>} - The result promise
   */
  async changeParameters(engineConfig, specificParameters = {}) {
    const logParameters = JSON.parse(JSON.stringify(engineConfig.logParameters))

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

    const targets = []
    const { consoleLog, fileLog, sqliteLog, lokiLog } = logParameters
    if (consoleLog.level !== 'none') {
      targets.push({ target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: consoleLog.level })
    }

    if (fileLog.level !== 'none') {
      targets.push({ target: 'pino/file', options: { destination: fileLog.fileName, mkdir: true }, level: fileLog.level })
    }

    if (sqliteLog.level !== 'none') {
      targets.push({
        target: path.join(__dirname, 'SqliteLoggerTransport.class.js'),
        options: {
          fileName: sqliteLog.fileName,
          maxFileSize: sqliteLog.maxSize,
        },
        level: sqliteLog.level,
      })
    }

    if (lokiLog.level !== 'none') {
      try {
        targets.push({
          target: path.join(__dirname, 'LokiLoggerTransport.class.js'),
          options: {
            username: lokiLog.username,
            password: this.encryptionService.decryptText(lokiLog.password),
            tokenAddress: lokiLog.tokenAddress,
            lokiAddress: lokiLog.lokiAddress,
            engineName: engineConfig.engineName,
            interval: lokiLog.interval,
          },
          level: lokiLog.level,
        })
      } catch (error) {
        // In case of bad decryption, an error is triggered, so instead of leaving the process, the error will just be
        // logged in the console and loki won't be activated
        console.error(error)
      }
    }

    if (targets.length > 0) {
      this.logger = await pino({
        mixin: () => ({
          source: this.getSource(),
          scope: this.scope,
        }),
        base: undefined,
        level: 'trace', // default to trace since each transport has its defined level
        timestamp: pino.stdTimeFunctions.isoTime,
        transport: { targets },
      })
    }
  }

  info(message) {
    this.logger?.info(message)
  }

  warn(message) {
    this.logger?.warn(message)
  }

  error(message) {
    this.logger?.error(message.stack || message)
  }

  debug(message) {
    this.logger?.debug(message)
  }

  trace(message) {
    this.logger?.trace(message)
  }

  /**
   * Use CallSite to extract filename, for more info read: https://v8.dev/docs/stack-trace-api#customizing-stack-traces
   * @returns {String} filename
   */
  getSource() {
    const oldStackTrace = Error.prepareStackTrace
    try {
      Error.prepareStackTrace = (err, structuredStackTrace) => structuredStackTrace
      Error.captureStackTrace(this)
      // Get the first CallSite outside the logger and outside pino library
      const callSite = this.stack.find((line) => line.getFileName().indexOf(path.basename(__filename)) === -1
        && line.getFileName().indexOf('pino') === -1)
      return `${path.parse(callSite.getFileName()).name}(${callSite.getLineNumber()})`
    } finally {
      Error.prepareStackTrace = oldStackTrace
    }
  }
}

module.exports = Logger
