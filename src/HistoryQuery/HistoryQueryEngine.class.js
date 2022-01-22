const csv = require('papaparse')
const path = require('path')
const fs = require('fs/promises')
const EventEmitter = require('events')
const { DateTime } = require('luxon')

const HistoryQuery = require('./HistoryQuery.class')
const BaseEngine = require('../engine/BaseEngine.class')

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
   * @param {string} configFile - The config file
   * @param {boolean} check - the engine will quit
   */
  constructor(configFile, check) {
    super(configFile)

    const { engineConfig } = this.configService.getConfig()
    const { historyQuery: { folder } } = engineConfig
    this.cacheFolder = folder
    this.historyQueries = []
    this.check = check
  }

  /**
   * Method used to init async services (like logger when loki is used with Bearer token auth)
   * @param {object} engineConfig - the config retrieved from the file
   * @param {string} loggerScope - the scope used for the logger
   * @returns {Promise<void>} - The promise returns when the services are set
   */
  async initEngineServices(engineConfig, loggerScope = 'HistoryQueryEngine') {
    await super.initEngineServices(engineConfig, loggerScope)

    try {
      await fs.stat(this.cacheFolder)
    } catch (e) {
      this.logger.info(`Creating main history cache folder in ${this.cacheFolder}`)
      await fs.mkdir(this.cacheFolder, { recursive: true })
    }

    this.logger.info('Starting HistoryQueryEngine')
  }

  /**
   * Update engine status data to be displayed on the home screen
   * @returns {void}
   */
  initializeStatusData() {
    if (!this.eventEmitters['/history-query-engine/sse']) {
      this.eventEmitters['/history-query-engine/sse'] = {}
      this.eventEmitters['/history-query-engine/sse'].events = new EventEmitter()
      this.eventEmitters['/history-query-engine/sse'].events.setMaxListeners(0)
      this.eventEmitters['/history-query-engine/sse'].events.on('data', this.listener)
      this.eventEmitters['/history-query-engine/sse'].statusData = this.statusData
      this.updateStatusDataStream()
    }
    this.liveStatusInterval = setInterval(() => {
      this.updateStatusDataStream()
    }, 5000)
  }

  updateStatusDataStream() {
    this.eventEmitters['/history-query-engine/sse']?.events?.emit('data', this.statusData)
  }

  /**
   * Add a new Value from a data source to the Engine.
   * The Engine will forward the Value to the Cache.
   * @param {string} dataSourceId - The South generating the value
   * @param {object} values - array of values
   * @return {void}
   */
  async addValues(dataSourceId, values) {
    const sanitizedValues = values.filter((value) => value?.data?.value !== undefined && value?.data?.value !== null)
    this.logger.silly(`Add ${sanitizedValues?.length} values from "${this.historyQuery.dataSource.name || dataSourceId}"`)
    if (sanitizedValues.length) {
      const flattenedValues = sanitizedValues.map((sanitizedValue) => this.flattenObject(sanitizedValue))
      const csvContent = csv.unparse(flattenedValues)
      const filename = this.historyQuery.filePattern.replace('@CurrentDate', DateTime.local().toFormat('yyyy_MM_dd_HH_mm_ss_SSS'))
      const folder = path.join(this.cacheFolder, this.historyQuery.dataSource.id)

      try {
        await fs.stat(folder)
      } catch (e) {
        this.logger.info(`Creating HistoryQuery cache folder in ${folder}`)
        await fs.mkdir(folder, { recursive: true })
      }

      const filePath = path.join(folder, filename)
      await fs.writeFile(filePath, csvContent)
    }
  }

  /**
   * Add a new File from an data source to the Engine.
   * The Engine will forward the File to the Cache.
   * @param {string} dataSourceId - The South generating the file
   * @param {string} filePath - The path to the File
   * @param {boolean} _preserveFiles - Whether to preserve the file at the original location
   * @return {void}
   */
  addFile(dataSourceId, filePath, _preserveFiles) {
    // The south will already store the files in the cache folder, so no copy is needed
    this.logger.silly(`Add file from "${this.historyQuery.dataSource.name || dataSourceId}" with ${filePath}`)
  }

  /**
   * Creates a new instance for every application and protocol and connects them.
   * Creates CronJobs based on the ScanModes and starts them.
   *
   * @param {boolean} safeMode - Whether to start in safe mode
   * @return {void}
   */
  async start(safeMode = false) {
    const { engineConfig } = this.configService.getConfig()
    await this.initEngineServices(engineConfig)
    if (safeMode || this.check) {
      this.logger.warn('HistoryQuery is not executed in safe (or check) mode')
    }
    this.runNextHistoryQuery()
  }

  /**
   * Gracefully stop every Timer, Protocol and Application
   * @return {Promise<void>} - The stop promise
   */
  async stop() {
    if (this.historyQuery) {
      await this.historyQuery.stop()
    }
  }

  /**
   * Get the next history query config
   * @returns {object|null} - The next history query config
   */
  getNextHistoryQueryConfig() {
    const historyQueryConfigs = this.configService.getActiveHistoryQueryConfiguration()
    const activeHistoryQueryConfigs = historyQueryConfigs.filter((historyQueryConfig) => historyQueryConfig.enabled && !historyQueryConfig.paused)

    const ongoingHistoryQueries = activeHistoryQueryConfigs.filter(
      (historyQueryConfig) => [HistoryQuery.STATUS_EXPORTING, HistoryQuery.STATUS_IMPORTING].includes(historyQueryConfig.status),
    )
    if (ongoingHistoryQueries.length > 0) {
      return ongoingHistoryQueries.sort((a, b) => a.order - b.order)[0]
    }

    const pendingHistoryQueries = activeHistoryQueryConfigs.filter((historyQueryConfig) => historyQueryConfig.status === HistoryQuery.STATUS_PENDING)
    if (pendingHistoryQueries.length > 0) {
      return pendingHistoryQueries.sort((a, b) => a.order - b.order)[0]
    }

    return null
  }

  /**
   * Run the next history query
   * @returns {void}
   */
  runNextHistoryQuery() {
    const historyQueryConfig = this.getNextHistoryQueryConfig()
    if (historyQueryConfig) {
      this.logger.info(`Preparing to start HistoryQuery: ${historyQueryConfig.id}`)

      const { southConfig, northConfig } = this.configService.getConfig()
      const dataSourceToUse = southConfig.dataSources.find((dataSource) => dataSource.id === historyQueryConfig.southId)
      if (!dataSourceToUse) {
        this.logger.error(`Invalid dataSource ${historyQueryConfig.southId} for HistoryQuery ${historyQueryConfig.id}`)
      }
      const applicationToUse = northConfig.applications.find((application) => application.id === historyQueryConfig.northId)
      if (!applicationToUse) {
        this.logger.error(`Invalid application ${historyQueryConfig.southId} for HistoryQuery ${historyQueryConfig.id}`)
      }

      if (dataSourceToUse && applicationToUse) {
        this.historyQuery = new HistoryQuery(this, this.logger, historyQueryConfig, dataSourceToUse, applicationToUse)
        this.historyQuery.start()
      }
    } else {
      this.logger.warn('No HistoryQuery to execute')
    }
  }

  /**
   * Get cache folder
   * @return {string} - The cache folder
   */
  getCacheFolder() {
    return this.cacheFolder
  }

  /**
   * Flatten JSON object.
   * @param {object} object - The object to flatten
   * @return {{}} - The flattened object
   */
  flattenObject(object) {
    const flatValue = {}

    Object.entries(object).forEach(([topKey, topValue]) => {
      if (typeof topValue === 'object') {
        const flatObject = this.flattenObject(topValue)
        Object.entries(flatObject).forEach(([subKey, subValue]) => {
          flatValue[`${topKey}.${subKey}`] = subValue
        })
      } else {
        flatValue[topKey] = topValue
      }
    })

    return flatValue
  }
}

module.exports = HistoryQueryEngine
