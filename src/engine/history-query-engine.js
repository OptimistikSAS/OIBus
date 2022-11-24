const path = require('node:path')
const fs = require('node:fs/promises')

const humanizeDuration = require('humanize-duration')

const HistoryQuery = require('./history-query/history-query')
const BaseEngine = require('./base-engine')
const HistoryQueryRepository = require('./history-query/history-query-repository')
const databaseService = require('../service/database.service')

const CACHE_FOLDER = './cache/history-query'
const HISTORY_QUERIES_DB = './history-query.db'
const HISTORY_TIMER_INTERVAL = 10000

/**
 * Manage history queries by running {@link HistoryQuery} one after another
 * @class HistoryQueryEngine
 */
class HistoryQueryEngine extends BaseEngine {
  /**
   * Constructor for Engine
   * Reads the config file and create the corresponding Object.
   * Makes the necessary changes to the pointId attributes.
   * Checks for critical entries such as scanModes and data sources.
   * @constructor
   * @param {ConfigurationService} configService - The config service
   * @param {EncryptionService} encryptionService - The encryption service
   * @param {LoggerService} loggerService - The logger service
   */
  constructor(configService, encryptionService, loggerService) {
    super(
      configService,
      encryptionService,
      loggerService,
      CACHE_FOLDER,
    )
    this.cacheFolder = path.resolve(CACHE_FOLDER)

    this.historyQueryRepository = null
    this.nextHistoryInterval = null
    this.historyOnGoing = false
  }

  /**
   * Method used to init async services (like logger when loki is used with Bearer token auth)
   * @param {Object} engineConfig - the config retrieved from the file
   * @returns {Promise<void>} - The result promise
   */
  async initEngineServices(engineConfig) {
    await super.initEngineServices(engineConfig)
    this.logger = this.loggerService.createChildLogger('HistoryQueryEngine')

    this.statusService.updateStatusDataStream({ ongoingHistoryQueryId: null })

    try {
      await fs.stat(this.cacheFolder)
    } catch (e) {
      this.logger.debug(`Creating history cache folder "${this.cacheFolder}".`)
      await fs.mkdir(this.cacheFolder, { recursive: true })
    }
    this.historyQueryRepository = new HistoryQueryRepository(path.resolve(HISTORY_QUERIES_DB))
    this.logger.info('Starting HistoryQuery Engine.')
  }

  /**
   * Add new values from a South connector to the Engine.
   * The Engine will forward the values to the Cache.
   * @param {String} southId - The South generating the value
   * @param {Object[]} values - Array of values
   * @return {Promise<void>} - The result promise
   */
  async addValues(southId, values) {
    if (!this.historyQuery.north.canHandleValues) {
      this.logger.warn(`North "${this.historyQuery.north.name}" used in history query ${this.historyQuery.id} `
          + 'does not handle values. Retrieved values are discarded.')
      return
    }

    this.logger.trace(`Add ${values.length} historian values to cache from South "${this.historyQuery.south.name}".`)
    if (values.length) {
      await this.historyQuery.north.cacheValues(southId, values)
    }
  }

  /**
   * Add a new file from a South connector to the Engine.
   * The Engine will forward the file to the Cache.
   * @param {String} southId - The South connector id
   * @param {String} filePath - The path to the File
   * @param {Boolean} _preserveFiles - Whether to preserve the file at the original location
   * @return {Promise<void>} - The result promise
   */
  async addFile(southId, filePath, _preserveFiles) {
    if (!this.historyQuery.north.canHandleFiles) {
      this.logger.warn(`North "${this.historyQuery.north.name}" used in history query ${this.historyQuery.id} `
          + 'does not handle files. Retrieved files are discarded.')
      return
    }

    this.logger.trace(`Add file "${filePath}" to cache from South "${this.historyQuery.south.name}".`)

    const timestamp = new Date().getTime()
    // When compressed file is received the name looks like filename.txt.gz
    const filenameInfo = path.parse(filePath)
    const cacheFilename = `${filenameInfo.name}-${timestamp}${filenameInfo.ext}`
    const cachePath = path.join(this.cacheFolder, cacheFilename)

    try {
      await this.historyQuery.north.cacheFile(cachePath, timestamp)
      try {
        await fs.unlink(filePath)
      } catch (unlinkError) {
        this.logger.error(unlinkError)
      }
    } catch (error) {
      this.logger.error(error)
    }
  }

  /**
   * Creates a new instance for each {@link HistoryQuery}
   * @param {Boolean} safeMode - Whether to start in safe mode
   * @return {Promise<void>} - The result promise
   */
  async start(safeMode = false) {
    const { engineConfig } = this.configService.getConfig()
    await this.initEngineServices(engineConfig)

    this.safeMode = safeMode || engineConfig.safeMode
    if (this.safeMode) {
      this.logger.warn('HistoryQuery Engine is running in safe mode.')
      return
    }

    this.nextHistoryInterval = setInterval(this.runNextHistoryQuery.bind(this), HISTORY_TIMER_INTERVAL)
  }

  /**
   * Gracefully stop every Timer, Protocol and Application
   * @return {Promise<void>} - The stop promise
   */
  async stop() {
    if (this.safeMode) {
      return
    }

    if (this.nextHistoryInterval) {
      clearInterval(this.nextHistoryInterval)
    }

    if (this.historyQuery) {
      await this.historyQuery.stop()
      this.historyQuery = null
    }
    this.statusService.updateStatusDataStream({ ongoingHistoryQueryId: null })
    this.statusService.stop()
  }

  /**
   * Run the next history query
   * @returns {Promise<void>} - The result promise
   */
  async runNextHistoryQuery() {
    if (this.historyQuery?.historyConfiguration.status === HistoryQuery.STATUS_FINISHED) {
      this.logger.info(`History query done in ${humanizeDuration(this.historyQueryStartTime - new Date().getTime())}.`)
      this.historyOnGoing = false
      this.historyQuery = null
    }
    if (this.historyQuery && this.historyOnGoing) {
      this.logger.trace(`History query "${this.historyQuery.historyConfiguration.id}" already ongoing.`)
      return
    }

    const historyConfiguration = this.historyQueryRepository.getNextToRun()
    if (!historyConfiguration) {
      this.logger.trace('No History query to execute.')
      this.statusService.updateStatusDataStream({ ongoingHistoryQueryId: null })
      return
    }
    this.logger.info(`Preparing to start history query "${historyConfiguration.id}".`)

    const { southConfig, northConfig } = this.configService.getConfig()
    const southToUse = southConfig.find((southSettings) => southSettings.id === historyConfiguration.southId)
    if (!southToUse) {
      this.logger.error(`Invalid South ID "${historyConfiguration.southId}" for history query "${historyConfiguration.id}".`)
      historyConfiguration.enabled = false
      this.historyQueryRepository.update(historyConfiguration)
      return
    }
    const northToUse = northConfig.find((northSettings) => northSettings.id === historyConfiguration.northId)
    if (!northToUse) {
      this.logger.error(`Invalid North ID "${historyConfiguration.northId}" for history query "${historyConfiguration.id}".`)
      historyConfiguration.enabled = false
      this.historyQueryRepository.update(historyConfiguration)
      return
    }

    const historyLogger = this.loggerService.createChildLogger(`History: ${historyConfiguration.id}`)

    this.historyQuery = new HistoryQuery(this, historyConfiguration, southToUse, northToUse, historyLogger)
    this.statusService.updateStatusDataStream({ ongoingHistoryQueryId: historyConfiguration.id })
    this.logger.info(`Starting history query "${historyConfiguration.id}".`)
    this.historyOnGoing = true
    this.historyQueryStartTime = new Date().getTime()
    try {
      await this.historyQuery.start()
    } catch (err) {
      this.logger.error(err)
      await this.historyQuery?.stop()
      this.historyQuery = null
      this.historyOnGoing = false
    }
  }

  /**
   * Get live status for a given HistoryQuery.
   * @param {String} id - The HistoryQuery id
   * @returns {Object} - The live status
   */
  async getStatusForHistoryQuery(id) {
    const data = {
      north: { numberOfFilesToSend: 0 },
      south: [],
    }
    const { engineConfig } = this.configService.getConfig()
    const historyQueryConfig = this.historyQueryRepository.get(id)
    if (historyQueryConfig) {
      const { historyQuery: { folder } } = engineConfig
      const databasePath = `${folder}/${historyQueryConfig.southId}.db`
      try {
        await fs.stat(databasePath)
        const entries = databaseService.getHistoryQuerySouthData(databasePath)
        data.south = entries.map((entry) => ({
          scanMode: entry.name.replace('lastCompletedAt-', ''),
          lastCompletedDate: entry.value,
        }))
      } catch (e) {
        this.logger.info(`The South database (${databasePath}) for HistoryQuery ${historyQueryConfig.name} doesn't exist.`)
      }
    }

    return data
  }
}

module.exports = HistoryQueryEngine
