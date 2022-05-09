const csv = require('papaparse')
const path = require('path')
const fs = require('fs/promises')
const EventEmitter = require('events')

const HistoryQuery = require('./HistoryQuery.class')
const BaseEngine = require('../engine/BaseEngine.class')
const HistoryQueryRepository = require('./HistoryQueryRepository.class')
const databaseService = require('../services/database.service')

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
   */
  constructor(configService) {
    super(configService)

    const { engineConfig } = this.configService.getConfig()
    const { historyQuery: { folder } } = engineConfig
    this.cacheFolder = folder
    this.historyQueryRepository = new HistoryQueryRepository(this.configService.getHistoryQueryConfigurationFileLocation())
  }

  /**
   * Method used to init async services (like logger when loki is used with Bearer token auth)
   * @param {object} engineConfig - the config retrieved from the file
   * @param {string} loggerScope - the scope used for the logger
   * @returns {Promise<void>} - The promise returns when the services are set
   */
  async initEngineServices(engineConfig, loggerScope = 'HistoryQueryEngine') {
    await super.initEngineServices(engineConfig, loggerScope)
    this.initializeStatusData()

    try {
      await fs.stat(this.cacheFolder)
    } catch (e) {
      this.logger.info(`Creating main history cache folder in ${this.cacheFolder}`)
      await fs.mkdir(this.cacheFolder, { recursive: true })
    }

    await this.historyQueryRepository.initialize()

    this.logger.info('Starting HistoryQueryEngine')
  }

  /**
   * Update engine status data to be displayed on the home screen
   * @returns {void}
   */
  initializeStatusData() {
    this.statusData = { ongoingHistoryQueryId: null }
    if (!this.eventEmitters['/history/engine/sse']) {
      this.eventEmitters['/history/engine/sse'] = {}
    } else {
      this.eventEmitters['/history/engine/sse'].events.removeAllListeners()
    }
    this.eventEmitters['/history/engine/sse'].events = new EventEmitter()
    this.eventEmitters['/history/engine/sse'].events.on('data', this.listener)
    this.eventEmitters['/history/engine/sse'].statusData = this.statusData
    this.updateStatusDataStream()
  }

  updateStatusDataStream() {
    this.eventEmitters['/history/engine/sse']?.events?.emit('data', this.statusData)
  }

  /**
   * Method used by the eventEmitter of the current protocol to write data to the socket and send them to the frontend
   * @param {object} data - The json object of data to send
   * @return {void}
   */
  listener = (data) => {
    if (data) {
      this.eventEmitters['/history/engine/sse']?.stream?.write(`data: ${JSON.stringify(data)}\n\n`)
    }
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
    this.logger.trace(`Add ${sanitizedValues?.length} values from "${this.historyQuery.dataSource.name || dataSourceId}"`)
    if (sanitizedValues.length) {
      const flattenedValues = sanitizedValues.map((sanitizedValue) => this.flattenObject(sanitizedValue))
      const csvContent = csv.unparse(flattenedValues)
      const filename = this.historyQuery.south.replaceFilenameWithVariable(this.historyQuery.south.filename)
      const filePath = path.join(this.historyQuery.dataCacheFolder, filename)
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
    this.logger.trace(`Add file from "${this.historyQuery.dataSource.name || dataSourceId}" with ${filePath}`)
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

    this.safeMode = safeMode || engineConfig.safeMode
    if (this.safeMode) {
      this.logger.warn('HistoryQuery Engine is running in safe mode')
      return
    }

    this.runNextHistoryQuery()
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
      this.statusData.ongoingHistorQueryId = null
      this.updateStatusDataStream()
      this.eventEmitters['/history/engine/sse']?.events?.removeAllListeners()
      this.eventEmitters['/history/engine/sse']?.stream?.destroy()
      this.historyQuery = null
    }
  }

  /**
   * Run the next history query
   * @returns {void}
   */
  async runNextHistoryQuery() {
    const historyQueryConfig = await this.historyQueryRepository.getNextToRun()
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
        this.statusData.ongoingHistoryQueryId = this.historyQuery.id
        this.updateStatusDataStream()
        this.historyQuery.start()
      }
    } else {
      this.logger.warn('No HistoryQuery to execute')
      this.statusData.ongoingHistoryQueryId = null
      this.updateStatusDataStream()
    }
  }

  /**
   * Get live status for a given HistoryQuery.
   * @param {string} id - The HistoryQuery id
   * @returns {object} - The live status
   */
  async getStatusForHistoryQuery(id) {
    const data = {
      north: { numberOfFilesToSend: 0 },
      south: [],
    }
    const { engineConfig } = this.configService.getConfig()
    const historyQueryConfig = await this.historyQueryRepository.get(id)
    if (historyQueryConfig) {
      const { historyQuery: { folder } } = engineConfig
      const databasePath = `${folder}/${historyQueryConfig.southId}.db`
      try {
        await fs.stat(databasePath)
        const entries = await databaseService.getHistoryQuerySouthData(databasePath)
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
   * @return {string} - The cache folder
   */
  getCacheFolder() {
    return this.historyQuery.cacheFolder
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
