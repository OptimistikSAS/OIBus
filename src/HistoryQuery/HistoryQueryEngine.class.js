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
   */
  constructor(configFile) {
    super(configFile)

    const { engineConfig } = this.configService.getConfig()
    const { historyQuery: { folder } } = engineConfig
    this.folder = folder

    this.historyQuery = null
  }

  /**
   * Add a new Value from a data source to the Engine.
   * The Engine will forward the Value to the Cache.
   * @param {string} dataSourceId - The South generating the value
   * @param {object} values - array of values
   * @return {void}
   */
  async addValues(dataSourceId, values) {
    this.logger.warn(`addValues() should be surcharged ${dataSourceId} ${values}`)
  }

  /**
   * Notify the Engine that the end of the specified read interval was reached.
   * The Engine will jump to the next HistoryQuery.
   * @param {string} _dataSourceId - The South generating the value
   * @return {void}
   */
  async readIntervalEndReached(_dataSourceId) {
    await this.historyQuery.stop()
  }

  /**
   * Add a new File from an data source to the Engine.
   * The Engine will forward the File to the Cache.
   * @param {string} dataSourceId - The South generating the file
   * @param {string} filePath - The path to the File
   * @param {boolean} preserveFiles - Whether to preserve the file at the original location
   * @return {void}
   */
  addFile(dataSourceId, filePath, preserveFiles) {
    this.logger.warn(`addFile() should be surcharged ${dataSourceId} ${filePath} ${preserveFiles}`)
  }

  /**
   * Creates a new instance for every application and protocol and connects them.
   * Creates CronJobs based on the ScanModes and starts them.
   *
   * @param {boolean} safeMode - Whether to start in safe mode
   * @return {void}
   */
  async start(safeMode = false) {
    this.logger.warn(`start() should be surcharged ${safeMode}`)
  }

  /**
   * Gracefully stop every Timer, Protocol and Application
   * @return {Promise<void>} - The stop promise
   */
  async stop() {
    this.logger.warn('stop() should be surcharged')
  }
}

module.exports = Engine
