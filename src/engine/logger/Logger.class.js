const path = require('path')
const pino = require('pino')

const ENGINE_LOG_LEVEL_ENTRY = 'engine'

class Logger {
  constructor(scope = 'main') {
    this.logger = null
    this.encryptionService = null
    this.scope = scope
  }

  static getDefaultLogger(scope) {
    if (!Logger.instance) {
      Logger.instance = new Logger(scope)
    }
    return Logger.instance
  }

  setEncryptionService(encryptionService) {
    this.encryptionService = encryptionService
  }

  async changeParameters(engineConfig, specificParameters = {}) {
    const logParameters = JSON.parse(JSON.stringify(engineConfig.logParameters))

    /**
     * Replacing global log parameters by specific one if not set to engine level
     */

    if (specificParameters.consoleLevel && specificParameters.consoleLevel !== ENGINE_LOG_LEVEL_ENTRY) {
      logParameters.consoleLog.level = specificParameters.consoleLevel
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

  silly(message) {
    this.logger?.trace(message)
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
      // Get the first CallSite outside the logger and outside pino library
      const callSite = this.stack.find((line) => line.getFileName().indexOf(path.basename(__filename)) === -1
        && line.getFileName().indexOf('node_modules/pino') === -1)
      return `${path.parse(callSite.getFileName()).name}(${callSite.getLineNumber()})`
    } finally {
      Error.prepareStackTrace = oldStackTrace
    }
  }
}

module.exports = Logger
