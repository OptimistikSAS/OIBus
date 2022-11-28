const path = require('node:path')

const pino = require('pino')
const FileCleanupService = require('./file-cleanup.service')
const { createFolder } = require('../utils')

const LOG_FOLDER_NAME = 'logs'
const LOG_FILE_NAME = 'journal.log'
const LOG_DB_NAME = 'journal.db'

/**
 * Manage pino loggers
 * Four loggers are supported:
 *  - Console
 *  - File
 *  - SQLite
 *  - Loki
 * @class LoggerService
 */
class LoggerService {
  /**
   * Constructor for Logger
   * @constructor
   */
  constructor() {
    this.logger = null
    this.encryptionService = null
    this.fileCleanUpService = null
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
   * @param {String} oibusName - The OIBus name
   * @param {Object} defaultLogParameters - The default logs parameters
   * @returns {Promise<void>} - The result promise
   */
  async start(oibusName, defaultLogParameters) {
    await createFolder(LOG_FOLDER_NAME)
    const logParameters = JSON.parse(JSON.stringify(defaultLogParameters))
    const targets = []
    const { consoleLog, fileLog, sqliteLog, lokiLog } = logParameters
    targets.push({ target: 'pino-pretty', options: { colorize: true, singleLine: true }, level: consoleLog.level })

    const filePath = fileLog.fileName ? path.resolve(LOG_FOLDER_NAME, fileLog.fileName) : path.resolve(LOG_FOLDER_NAME, LOG_FILE_NAME)
    targets.push({
      target: 'pino-roll',
      options: {
        file: filePath,
        size: fileLog.maxSize,
      },
      level: fileLog.level,
    })

    if (sqliteLog) {
      const sqlDatabaseName = sqliteLog.fileName ? path.resolve(LOG_FOLDER_NAME, sqliteLog.fileName) : path.resolve(LOG_FOLDER_NAME, LOG_DB_NAME)

      targets.push({
        target: path.join(__dirname, 'sqlite-transport.js'),
        options: {
          fileName: sqlDatabaseName,
          maxNumberOfLogs: sqliteLog.maxNumberOfLogs,
        },
        level: sqliteLog.level,
      })
    }

    if (lokiLog?.lokiAddress) {
      try {
        targets.push({
          target: path.join(__dirname, 'loki-transport.js'),
          options: {
            username: lokiLog.username,
            password: lokiLog.password ? await this.encryptionService.decryptText(lokiLog.password) : '',
            tokenAddress: lokiLog.tokenAddress,
            lokiAddress: lokiLog.lokiAddress,
            oibusName,
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

    this.logger = await pino({
      mixin: this.pinoMixin.bind(this),
      base: undefined,
      level: 'trace', // default to trace since each transport has its defined level
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: { targets },
    })

    this.fileCleanUpService = new FileCleanupService(
      path.parse(filePath).dir,
      this.createChildLogger('logger-service'),
      path.parse(filePath).base,
      fileLog.numberOfFiles,
    )
    await this.fileCleanUpService.start()
  }

  /**
   * Create a child logger from the main logger already set up
   * @param {String} scope - The scope of the logger (Engine, South, North...)
   * @returns {Object} - The child logger
   */
  createChildLogger(scope) {
    return this.logger.child({ scope })
  }

  /**
   * Mixin method to add parameters to the logs for Pino logger
   * @returns {{ source: String}} - Add scope and source to the log
   */
  pinoMixin() {
    return { source: this.getSource() }
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

  /**
   * Stop the logger and associated services
   * @return {void}
   */
  stop() {
    this.fileCleanUpService.stop()
  }
}

module.exports = LoggerService
