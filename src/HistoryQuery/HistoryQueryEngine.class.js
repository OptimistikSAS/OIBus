const csv = require('papaparse')
const moment = require('moment-timezone')
const path = require('path')
const fs = require('fs')
const HistoryQuery = require('./HistoryQuery.class')
const BaseEngine = require('../engine/BaseEngine.class')

/**
 *
 * at startup, handles initialization of applications, protocols and config.
 * @class Engine
 */
class Engine extends BaseEngine {
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
      const filename = this.historyQuery.filePattern.replace('@date', moment().format('YYYY_MM_DD_HH_mm_ss'))
      const folder = path.join(this.cacheFolder, this.historyQuery.id)
      if (!fs.existsSync(folder)) {
        this.logger.info(`Creating HistoryQuery cache folder in ${folder}`)
        fs.mkdirSync(folder, { recursive: true })
      }
      const filePath = path.join(folder, filename)
      fs.writeFileSync(filePath, csvContent)
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
    this.logger.info('Starting HistoryQueryEngine')
    if (safeMode || this.check) {
      this.logger.warn('HistoryQuery is not executed in safe mode')
      return
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

module.exports = Engine
