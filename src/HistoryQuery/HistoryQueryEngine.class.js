const path = require('node:path')
const fs = require('node:fs/promises')

const HistoryQuery = require('./HistoryQuery.class')
const BaseEngine = require('../engine/BaseEngine.class')
const HistoryQueryRepository = require('./HistoryQueryRepository.class')
const databaseService = require('../services/database.service')
const StatusService = require('../services/status.service.class')
const MainCache = require('../engine/cache/MainCache.class')

/**
 *
 * at startup, handles initialization of applications, protocols and config.
 * @class HistoryQueryEngine
 */
class HistoryQueryEngine extends BaseEngine {
  /**
   * Constructor for Engine
   * Reads the config file and create the corresponding Object.
   * Makes the necessary changes to the pointId attributes.
   * Checks for critical entries such as scanModes and data sources.
   * @constructor
   * @param {ConfigService} configService - The config service
   * @param {EncryptionService} encryptionService - The encryption service
   */
  constructor(configService, encryptionService) {
    super(configService, encryptionService)

    const { engineConfig } = this.configService.getConfig()
    const { historyQuery: { folder } } = engineConfig
    this.cacheFolder = folder

    this.statusService = new StatusService()
    this.historyQueryRepository = null
  }

  /**
   * Method used to init async services (like logger when loki is used with Bearer token auth)
   * @param {Object} engineConfig - the config retrieved from the file
   * @param {String} loggerScope - the scope used for the logger
   * @returns {Promise<void>} - The result promise
   */
  async initEngineServices(engineConfig, loggerScope = 'HistoryQueryEngine') {
    await super.initEngineServices(engineConfig, loggerScope)
    this.statusService.updateStatusDataStream({ ongoingHistoryQueryId: null })

    try {
      await fs.stat(this.cacheFolder)
    } catch (e) {
      this.logger.debug(`Creating history cache folder "${this.cacheFolder}".`)
      await fs.mkdir(this.cacheFolder, { recursive: true })
    }
    this.historyQueryRepository = new HistoryQueryRepository(this.configService.getHistoryQueryConfigurationFileLocation())
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
      this.logger.warn(`North "${this.historyQuery.north.settings.name}" used in history query ${this.historyQuery.id} `
          + 'does not handle values. Retrieved values are discarded.')
      return
    }

    this.logger.trace(`Add ${values.length} historian values to cache from South "${this.historyQuery.south.settings.name}".`)
    if (values.length) {
      this.historyQuery.north.cacheValues(southId, values)
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
      this.logger.warn(`North "${this.historyQuery.north.settings.name}" used in history query ${this.historyQuery.id} `
          + 'does not handle files. Retrieved files are discarded.')
      return
    }

    this.logger.trace(`Add file "${filePath}" to cache from South "${this.historyQuery.south.settings.name}".`)

    const timestamp = new Date().getTime()
    // When compressed file is received the name looks like filename.txt.gz
    const filenameInfo = path.parse(filePath)
    const cacheFilename = `${filenameInfo.name}-${timestamp}${filenameInfo.ext}`
    const cachePath = path.join(this.getCacheFolder(), cacheFilename)

    try {
      // Move or copy the file into the cache folder
      await MainCache.transferFile(this.logger, filePath, cachePath, false)
      await this.historyQuery.north.cacheFile(cachePath, timestamp)
    } catch (error) {
      this.logger.error(error)
    }
  }

  /**
   * Creates a new instance for every application and protocol and connects them.
   * Creates CronJobs based on the ScanModes and starts them.
   *
   * @param {Boolean} safeMode - Whether to start in safe mode
   * @return {Promise<void>} - The result promise
   */
  async start(safeMode = false) {
    const { engineConfig } = this.configService.getConfig()
    await this.initEngineServices(engineConfig)

    this.safeMode = safeMode || engineConfig.safeMode
    if (this.safeMode) {
      this.logger.warn('HistoryQuery Engine is running in safe mode')
      return
    }

    await this.runNextHistoryQuery()
  }

  /**
   * Gracefully stop every Timer, Protocol and Application
   * @return {Promise<void>} - The stop promise
   */
  async stop() {
    if (this.safeMode) {
      return
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
    const historyQuerySettings = this.historyQueryRepository.getNextToRun()
    if (!historyQuerySettings) {
      this.logger.info('No HistoryQuery to execute.')
      this.statusService.updateStatusDataStream({ ongoingHistoryQueryId: null })
      return
    }
    this.logger.debug(`Preparing to start history query "${historyQuerySettings.id}".`)

    const { southConfig, northConfig } = this.configService.getConfig()
    const southToUse = southConfig.dataSources.find((southSettings) => southSettings.id === historyQuerySettings.southId)
    if (!southToUse) {
      this.logger.error(`Invalid South ID "${historyQuerySettings.southId}" for history query "${historyQuerySettings.id}".`)
      return
    }
    const northToUse = northConfig.applications.find((northSettings) => northSettings.id === historyQuerySettings.northId)
    if (!northToUse) {
      this.logger.error(`Invalid North ID "${historyQuerySettings.northId}" for history query "${historyQuerySettings.id}".`)
      return
    }

    this.historyQuery = new HistoryQuery(this, historyQuerySettings, southToUse, northToUse)
    this.statusService.updateStatusDataStream({ ongoingHistoryQueryId: historyQuerySettings.id })
    this.logger.info(`Starting history query "${historyQuerySettings.id}".`)
    await this.historyQuery.start()
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
        this.logger.info(`The South database (${databasePath}) for HistoryQuery ${historyQueryConfig.name} doesn't exists`)
      }
    }

    return data
  }

  /**
   * Get cache folder
   * @return {String} - The cache folder
   */
  getCacheFolder() {
    return this.historyQuery.cacheFolder
  }
}

module.exports = HistoryQueryEngine
